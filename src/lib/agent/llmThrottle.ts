/**
 * Proactive TPM pacing + decaying backoff state for OpenAI/Anthropic text calls.
 *
 * Uses a rolling 60s token budget (estimated from text length) so multi-step
 * ToolLoopAgent runs stay under org TPM limits. On 429 / rate_limit_exceeded,
 * pairs with retryPolicy.retryWithDecayingBackoff for server-suggested waits
 * plus exponential backoff that decays after successful calls.
 */
import {
  THROTTLE_BACKOFF_BASE_MS,
  THROTTLE_BACKOFF_CAP_MS,
  sleep,
  throttleBackoffMs,
} from './retryPolicy';

function readInt(name: string, fallback: number, min = 0, max = 2_000_000): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return Math.floor(n);
}

/** Soft TPM cap for proactive pacing (0 = disable). Default 180k leaves headroom under 200k. */
export function llmTpmBudget(): number {
  return readInt('FORGE_LLM_TPM_BUDGET', 180_000, 0, 2_000_000);
}

/** Minimum pause between LLM HTTP calls within a run. */
export function llmMinStepMs(): number {
  return readInt('FORGE_LLM_MIN_STEP_MS', 400, 0, 30_000);
}

/** App-level rate-limit retries beyond AI SDK maxRetries (whole-call or early stream). */
export function llmRateLimitMaxRetries(): number {
  return readInt('FORGE_LLM_RATE_LIMIT_RETRIES', 8, 0, 20);
}

/** After a successful call, multiply pressure backoff by this (0–1). Default 0.55. */
const BACKOFF_DECAY = readInt('FORGE_LLM_BACKOFF_DECAY_PERCENT', 55, 10, 99) / 100;

type WindowEntry = { at: number; tokens: number };

const rollingWindow: WindowEntry[] = [];
let pressureBackoffMs = 0;
let lastCallAt = 0;

export function estimateTokensFromText(text: string): number {
  const len = text.length;
  if (len === 0) return 0;
  return Math.max(1, Math.ceil(len / 3.5));
}

export function estimateAgentCallTokens(input: {
  instructions?: string;
  prompt?: string;
  extraContextChars?: number;
  outputBudget?: number;
}): number {
  const inputChars =
    (input.instructions?.length ?? 0) +
    (input.prompt?.length ?? 0) +
    (input.extraContextChars ?? 0);
  const inputTokens = estimateTokensFromText('x'.repeat(inputChars));
  const outputTokens = input.outputBudget ?? readInt('FORGE_LLM_STEP_OUTPUT_ESTIMATE', 8000, 500, 32_000);
  return inputTokens + outputTokens;
}

function pruneWindow(now: number): void {
  while (rollingWindow.length > 0 && now - rollingWindow[0].at >= 60_000) {
    rollingWindow.shift();
  }
}

function windowTokenSum(): number {
  return rollingWindow.reduce((sum, entry) => sum + entry.tokens, 0);
}

export function recordLlmUsage(tokens: number): void {
  if (tokens <= 0) return;
  rollingWindow.push({ at: Date.now(), tokens });
}

/** Decay pressure after a successful LLM call. */
export function noteLlmSuccess(): void {
  if (pressureBackoffMs <= 0) return;
  pressureBackoffMs = Math.max(0, Math.floor(pressureBackoffMs * BACKOFF_DECAY));
}

export function parseRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as {
    message?: string;
    retryAfterMs?: number;
    responseHeaders?: Record<string, string>;
  };

  if (typeof e.retryAfterMs === 'number' && e.retryAfterMs > 0) {
    return Math.min(e.retryAfterMs, THROTTLE_BACKOFF_CAP_MS);
  }

  const headers = e.responseHeaders;
  if (headers) {
    const raw = headers['retry-after-ms'] ?? headers['Retry-After-Ms'];
    if (raw) {
      const ms = Number(raw);
      if (Number.isFinite(ms) && ms > 0) return Math.min(ms, THROTTLE_BACKOFF_CAP_MS);
    }
    const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.min(Math.ceil(seconds * 1000), THROTTLE_BACKOFF_CAP_MS);
      }
    }
  }

  const msg = String(e.message ?? error ?? '');
  const tryAgain = msg.match(/try again in ([\d.]+)\s*s/i);
  if (tryAgain) {
    return Math.min(Math.ceil(parseFloat(tryAgain[1]) * 1000) + 250, THROTTLE_BACKOFF_CAP_MS);
  }

  return null;
}

export function normalizeLlmError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message && error.message !== '[object Object]') return error;
  }

  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const nested =
      e.error && typeof e.error === 'object' ? (e.error as Record<string, unknown>) : null;
    const code = String(nested?.code ?? e.code ?? '').trim();
    const message = String(
      nested?.message ??
        e.message ??
        (code ? `LLM error (${code})` : JSON.stringify(nested ?? e)),
    ).trim();
    const err = new Error(message || 'LLM error');
    if (code) (err as Error & { code?: string }).code = code;
    const statusCode = nested?.statusCode ?? e.statusCode;
    if (typeof statusCode === 'number') {
      (err as Error & { statusCode?: number }).statusCode = statusCode;
    }
    const retryAfterMs = nested?.retryAfterMs ?? e.retryAfterMs;
    if (typeof retryAfterMs === 'number') {
      (err as Error & { retryAfterMs?: number }).retryAfterMs = retryAfterMs;
    }
    return err;
  }

  return new Error(String(error ?? 'LLM error'));
}

export function isRateLimitError(error: unknown): boolean {
  const normalized = normalizeLlmError(error);
  if (normalized.name === 'AbortError') return false;
  const e = normalized as Error & { statusCode?: number; code?: string };
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('abort')) return false;
  const code = String(e.code ?? '').toLowerCase();
  return (
    code === 'rate_limit_exceeded' ||
    e.statusCode === 429 ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('tokens per min') ||
    msg.includes('tpm') ||
    msg.includes('too many requests')
  );
}

async function waitMs(ms: number, signal?: AbortSignal, label?: string): Promise<void> {
  if (ms <= 0) return;
  console.warn(`[llmThrottle] ${label ?? 'call'} waiting ${ms}ms (TPM pacing / rate limit)`);
  await sleep(ms, signal);
}

/**
 * Block until the rolling TPM budget has room and inter-call spacing is satisfied.
 */
export async function acquireLlmBudget(
  estimatedTokens: number,
  opts?: { signal?: AbortSignal; label?: string },
): Promise<void> {
  const budget = llmTpmBudget();
  const minStep = llmMinStepMs();
  const label = opts?.label;

  while (true) {
    if (opts?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const now = Date.now();
    pruneWindow(now);
    const used = windowTokenSum();
    const spacingWait = Math.max(0, minStep - (now - lastCallAt));
    const pressureWait = pressureBackoffMs;
    const pacingWait = Math.max(spacingWait, pressureWait);

    if (budget <= 0) {
      if (pacingWait > 0) await waitMs(pacingWait, opts?.signal, label);
      lastCallAt = Date.now();
      if (pressureWait > 0) pressureBackoffMs = Math.max(0, Math.floor(pressureBackoffMs * BACKOFF_DECAY));
      return;
    }

    if (used + estimatedTokens <= budget) {
      if (pacingWait > 0) await waitMs(pacingWait, opts?.signal, label);
      lastCallAt = Date.now();
      if (pressureWait > 0) pressureBackoffMs = Math.max(0, Math.floor(pressureBackoffMs * BACKOFF_DECAY));
      return;
    }

    const oldest = rollingWindow[0];
    const windowWait = oldest ? Math.max(500, 60_000 - (now - oldest.at)) : 1000;
    await waitMs(Math.min(windowWait, 5000), opts?.signal, label);
  }
}

/** Wait after a rate-limit error; grows pressure backoff for subsequent proactive pacing. */
export async function waitAfterRateLimit(
  error: unknown,
  attempt: number,
  opts?: { signal?: AbortSignal; label?: string },
): Promise<void> {
  const parsed = parseRetryAfterMs(error);
  const jittered = throttleBackoffMs(attempt);
  const wait = Math.max(parsed ?? 0, jittered, THROTTLE_BACKOFF_BASE_MS);

  pressureBackoffMs = Math.min(
    THROTTLE_BACKOFF_CAP_MS,
    Math.max(THROTTLE_BACKOFF_BASE_MS, Math.floor((pressureBackoffMs || THROTTLE_BACKOFF_BASE_MS) * 1.8)),
  );

  await waitMs(wait, opts?.signal, opts?.label);
}

export async function retryWithDecayingBackoff<T>(
  fn: () => Promise<T>,
  opts?: {
    maxRetries?: number;
    signal?: AbortSignal;
    label?: string;
    estimatedTokens?: number;
    shouldRetry?: (err: unknown) => boolean;
  },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? llmRateLimitMaxRetries();
  const shouldRetry = opts?.shouldRetry ?? isRateLimitError;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (opts?.estimatedTokens != null && opts.estimatedTokens > 0) {
        await acquireLlmBudget(opts.estimatedTokens, { signal: opts.signal, label: opts.label });
      }
      const result = await fn();
      noteLlmSuccess();
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries || !shouldRetry(err)) throw err;
      console.warn(
        `[llmThrottle] ${opts?.label ?? 'call'} rate limited (attempt ${attempt + 1}/${maxRetries + 1})`,
        err instanceof Error ? err.message : err,
      );
      await waitAfterRateLimit(err, attempt, { signal: opts?.signal, label: opts?.label });
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('LLM retry exhausted');
}
