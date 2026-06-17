/**
 * Retry policy for Agent Forge LLM and image API calls.
 *
 * ToolLoopAgent uses the Vercel AI SDK, which already retries retryable APICallErrors
 * with exponential backoff (2s base, 2× factor) and honors `retry-after-ms` /
 * `retry-after` when the delay is 0–60s (Anthropic 429 pattern). We tune `maxRetries`
 * only; backoff timing stays SDK-internal.
 *
 * Direct clients (Anthropic SDK, Gemini) use AWS-style capped exponential backoff
 * with full jitter: delay = random(0, 1) × min(cap, base × 2^attempt).
 *
 * @see https://docs.aws.amazon.com/general/latest/gr/api-retries.html
 */

function readInt(name: string, fallback: number, min = 0, max = 20): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return Math.floor(n);
}

/** Per HTTP call retries inside AI SDK ToolLoopAgent (default 6 → 7 total attempts; SDK default is 2). */
export function anthropicSdkMaxRetries(): number {
  return readInt('FORGE_ANTHROPIC_MAX_RETRIES', 6, 0, 12);
}

/** Direct `@anthropic-ai/sdk` client (e.g. forge example generator). */
export function anthropicClientMaxRetries(): number {
  return readInt('FORGE_ANTHROPIC_CLIENT_MAX_RETRIES', anthropicSdkMaxRetries(), 0, 12);
}

/** Gemini image generation retries per generateContent call. */
export function geminiMaxRetries(): number {
  return readInt('FORGE_GEMINI_MAX_RETRIES', 5, 0, 10);
}

/** Throttling base delay (AWS standard: 1000ms for rate limits). */
export const THROTTLE_BACKOFF_BASE_MS = readInt('FORGE_RETRY_BASE_MS', 1000, 100, 10_000);

/** Max single backoff wait (AWS cap: 20s; Anthropic Retry-After can be ~60s). */
export const THROTTLE_BACKOFF_CAP_MS = readInt('FORGE_RETRY_CAP_MS', 60_000, 5_000, 120_000);

export function isRetryableHttpError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return true;
  }
  if (msg.includes('503') || msg.includes('502') || msg.includes('504') || msg.includes('500')) {
    return true;
  }
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up')
  ) {
    return true;
  }
  return false;
}

/** Full jitter: uniform random in [0, min(cap, base × 2^attempt)]. */
export function throttleBackoffMs(attempt: number): number {
  const ceiling = Math.min(THROTTLE_BACKOFF_CAP_MS, THROTTLE_BACKOFF_BASE_MS * 2 ** attempt);
  return Math.floor(Math.random() * ceiling);
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export async function retryWithFullJitter<T>(
  fn: () => Promise<T>,
  opts?: {
    maxRetries?: number;
    signal?: AbortSignal;
    label?: string;
    shouldRetry?: (err: unknown) => boolean;
  },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? geminiMaxRetries();
  const shouldRetry = opts?.shouldRetry ?? isRetryableHttpError;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries || !shouldRetry(err)) throw err;
      const delay = throttleBackoffMs(attempt);
      console.warn(
        `[retryPolicy] ${opts?.label ?? 'call'} failed (attempt ${attempt + 1}/${maxRetries + 1}); waiting ${delay}ms`,
      );
      await sleep(delay, opts?.signal);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Retry exhausted');
}
