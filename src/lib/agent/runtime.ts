/**
 * Generic multi-turn agent runtime via the Vercel AI SDK ToolLoopAgent.
 * The agent orchestrates its own steps — we do not hardcode a pipeline.
 *
 * Used by both the business-consulting agent and the (migrated) forge loop.
 * Mirrors terraform/debate-fact-checker/web/src/lib/agent/run-agent.ts.
 *
 * @see https://ai-sdk.dev/docs/agents/overview
 */
import { stepCountIs, ToolLoopAgent, type ToolSet } from 'ai';
import {
  acquireLlmBudget,
  estimateAgentCallTokens,
  estimateTokensFromText,
  isRateLimitError,
  llmRateLimitMaxRetries,
  normalizeLlmError,
  recordLlmUsage,
  retryWithDecayingBackoff,
  waitAfterRateLimit,
} from './llmThrottle';
import {
  createLanguageModel,
  isProviderFallbackEligible,
  resolveLlmCandidates,
  sdkMaxRetries,
  type ResolvedLlmCandidate,
} from './textModel';
import { persistTurn } from './turns';
import { unregisterRun } from './runRegistry';
import type { TurnEvent, TurnScopeType } from './types';

const DEFAULT_MAX_STEPS = Number(process.env.FORGE_MAX_STEPS || 40);
const DEFAULT_MAX_OUTPUT_TOKENS = Number(process.env.FORGE_MAX_OUTPUT_TOKENS || 8000);

export type RunToolLoopOptions = {
  scopeType: TurnScopeType;
  scopeSlug: string;
  /** System prompt for the agent. */
  instructions: string;
  /** First user turn. */
  prompt: string;
  /** Zod-typed tools (from `tool()`), keyed by tool name. */
  tools: ToolSet;
  maxSteps?: number;
  maxOutputTokens?: number;
  /** Model id override for the configured provider(s). */
  model?: string;
  signal?: AbortSignal;
  startNote?: string;
};

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Cancelled by user', 'AbortError');
  }
}

type StreamLoopContext = {
  scopeType: TurnScopeType;
  scopeSlug: string;
  signal?: AbortSignal;
  candidate: ResolvedLlmCandidate;
  opts: RunToolLoopOptions;
  maxSteps: number;
  emit: (data: Parameters<typeof persistTurn>[3]) => { type: 'turn'; turn: ReturnType<typeof persistTurn> };
  getTurnIndex: () => number;
};

async function* consumeAgentStream(
  ctx: StreamLoopContext,
  streamResult: Awaited<ReturnType<ToolLoopAgent['stream']>>,
  streamAttempt: number,
  streamProgress: { agentTurns: number },
): AsyncGenerator<TurnEvent> {
  const { signal, opts, emit, candidate } = ctx;
  let stepText = '';
  let extraContextChars = 0;

  const trackEmit = (data: Parameters<typeof persistTurn>[3]) => {
    const event = emit(data);
    if (data.role === 'AGENT' || data.role === 'TOOL') streamProgress.agentTurns += 1;
    return event;
  };

  for await (const part of streamResult.fullStream) {
    assertNotCancelled(signal);

    if (part.type === 'text-delta') {
      stepText += part.text;
      continue;
    }

    if (part.type === 'finish-step' && stepText.trim()) {
      const stepTokens = estimateTokensFromText(stepText);
      recordLlmUsage(stepTokens + (opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS));
      extraContextChars += stepText.length;
      yield trackEmit({ role: 'AGENT', turnType: 'THINKING', content: stepText.trim() });
      stepText = '';

      const nextEstimate = estimateAgentCallTokens({
        instructions: opts.instructions,
        prompt: opts.prompt,
        extraContextChars,
      });
      await acquireLlmBudget(nextEstimate, { signal, label: candidate.label });
      continue;
    }

    if (part.type === 'tool-call') {
      const input = 'input' in part ? part.input : undefined;
      yield trackEmit({
        role: 'AGENT',
        turnType: 'TOOL_CALL',
        content: `Calling ${part.toolName}`,
        toolName: part.toolName,
        toolInput: input,
      });
      continue;
    }

    if (part.type === 'tool-result') {
      const output = 'output' in part ? part.output : undefined;
      const serialized =
        typeof output === 'string' ? output : JSON.stringify(output ?? null).slice(0, 2000);
      extraContextChars += serialized.length;
      yield trackEmit({
        role: 'TOOL',
        turnType: 'TOOL_RESULT',
        toolName: part.toolName,
        toolOutput: output,
        content: serialized,
      });
      continue;
    }

    if (part.type === 'tool-error') {
      const err = 'error' in part ? part.error : 'Tool error';
      yield trackEmit({
        role: 'TOOL',
        turnType: 'ERROR',
        toolName: part.toolName,
        content: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (part.type === 'error') {
      const raw = 'error' in part ? part.error : part;
      const err = normalizeLlmError(raw);
      if (isRateLimitError(err)) {
        await waitAfterRateLimit(err, streamAttempt, {
          signal,
          label: `${candidate.label} stream step`,
        });
      }
      throw err;
    }
  }

  if (stepText.trim()) {
    recordLlmUsage(estimateTokensFromText(stepText));
    yield trackEmit({ role: 'AGENT', turnType: 'THINKING', content: stepText.trim() });
  }
}

async function* streamToolLoop(ctx: StreamLoopContext): AsyncGenerator<TurnEvent> {
  const { scopeType, scopeSlug, signal, candidate, opts, maxSteps, emit } = ctx;
  const maxRetries = sdkMaxRetries(candidate.provider);
  const streamRetries = llmRateLimitMaxRetries();
  const callEstimate = estimateAgentCallTokens({
    instructions: opts.instructions,
    prompt: opts.prompt,
  });

  const agent = new ToolLoopAgent({
    model: createLanguageModel(candidate.provider, candidate.modelId),
    instructions: opts.instructions,
    tools: opts.tools,
    stopWhen: stepCountIs(maxSteps),
    maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    maxRetries,
  });

  assertNotCancelled(signal);
  const streamProgress = { agentTurns: 0 };

  for (let streamAttempt = 0; streamAttempt <= streamRetries; streamAttempt++) {
    streamProgress.agentTurns = 0;
    try {
      const streamResult = await retryWithDecayingBackoff(
        () => agent.stream({ prompt: opts.prompt, abortSignal: signal }),
        {
          signal,
          label: `${candidate.label} stream`,
          estimatedTokens: callEstimate,
        },
      );

      yield* consumeAgentStream(ctx, streamResult, streamAttempt, streamProgress);
      yield emit({ role: 'SYSTEM', turnType: 'COMPLETE', content: 'Run complete.' });
      yield { type: 'done', scopeSlug };
      return;
    } catch (error) {
      const err = normalizeLlmError(error);
      const canRetryStream =
        isRateLimitError(err) &&
        streamAttempt < streamRetries &&
        streamProgress.agentTurns === 0;

      if (!canRetryStream) throw err;

      console.warn(
        `[runtime] ${candidate.label} stream rate limited before agent progress; retry ${streamAttempt + 1}/${streamRetries}`,
        err.message,
      );
    }
  }
}

/**
 * Drive a ToolLoopAgent run, persisting + yielding each turn.
 * Status/post-conditions are the caller's responsibility (this stays generic).
 */
export async function* runToolLoop(opts: RunToolLoopOptions): AsyncGenerator<TurnEvent> {
  const { scopeType, scopeSlug, signal } = opts;
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  let turnIndex = 0;
  const candidates = resolveLlmCandidates({ model: opts.model, role: 'author' });

  const emit = (data: Parameters<typeof persistTurn>[3]) => {
    const turn = persistTurn(scopeType, scopeSlug, turnIndex++, data);
    return { type: 'turn', turn } as const;
  };

  const primary = candidates[0];
  const startLabel = primary
    ? `${primary.label} · ${maxSteps} steps`
    : `${maxSteps} steps (no LLM key configured)`;

  yield emit({
    role: 'SYSTEM',
    turnType: 'MESSAGE',
    content: opts.startNote ?? `Agent run started (ToolLoopAgent · ${startLabel}).`,
  });

  if (candidates.length === 0) {
    yield emit({ role: 'SYSTEM', turnType: 'ERROR', content: 'No text LLM API key configured.' });
    yield { type: 'error', message: 'No text LLM API key configured.' };
    unregisterRun(scopeType, scopeSlug);
    return;
  }

  let lastError: Error | undefined;

  try {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      try {
        yield* streamToolLoop({
          scopeType,
          scopeSlug,
          signal,
          candidate,
          opts,
          maxSteps,
          emit,
          getTurnIndex: () => turnIndex,
        });
        return;
      } catch (error) {
        lastError = normalizeLlmError(error);
        if (signal?.aborted || isAbortError(error)) {
          yield emit({ role: 'SYSTEM', turnType: 'ERROR', content: 'Cancelled by user.' });
          yield { type: 'cancelled', scopeSlug };
          return;
        }

        const hasFallback = i < candidates.length - 1 && isProviderFallbackEligible(lastError);
        if (hasFallback) {
          const next = candidates[i + 1];
          const message = lastError.message;
          yield emit({
            role: 'SYSTEM',
            turnType: 'MESSAGE',
            content: `${candidate.label} failed (${message.slice(0, 180)}). Switching to ${next.label}…`,
          });
          continue;
        }

        const message = lastError.message;
        yield emit({ role: 'SYSTEM', turnType: 'ERROR', content: message });
        yield { type: 'error', message };
        return;
      }
    }

    const message = lastError?.message ?? 'Agent run failed';
    yield emit({ role: 'SYSTEM', turnType: 'ERROR', content: message });
    yield { type: 'error', message };
  } finally {
    unregisterRun(scopeType, scopeSlug);
  }
}
