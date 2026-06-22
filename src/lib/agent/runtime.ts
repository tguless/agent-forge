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
};

async function* streamToolLoop(ctx: StreamLoopContext): AsyncGenerator<TurnEvent> {
  const { scopeType, scopeSlug, signal, candidate, opts, maxSteps, emit } = ctx;
  const maxRetries = sdkMaxRetries(candidate.provider);

  const agent = new ToolLoopAgent({
    model: createLanguageModel(candidate.provider, candidate.modelId),
    instructions: opts.instructions,
    tools: opts.tools,
    stopWhen: stepCountIs(maxSteps),
    maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    maxRetries,
  });

  assertNotCancelled(signal);
  let stepText = '';

  const streamResult = await agent.stream({ prompt: opts.prompt, abortSignal: signal });

  for await (const part of streamResult.fullStream) {
    assertNotCancelled(signal);

    if (part.type === 'text-delta') {
      stepText += part.text;
      continue;
    }

    if (part.type === 'finish-step' && stepText.trim()) {
      yield emit({ role: 'AGENT', turnType: 'THINKING', content: stepText.trim() });
      stepText = '';
      continue;
    }

    if (part.type === 'tool-call') {
      const input = 'input' in part ? part.input : undefined;
      yield emit({
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
      yield emit({
        role: 'TOOL',
        turnType: 'TOOL_RESULT',
        toolName: part.toolName,
        toolOutput: output,
        content:
          typeof output === 'string' ? output : JSON.stringify(output ?? null).slice(0, 2000),
      });
      continue;
    }

    if (part.type === 'tool-error') {
      const err = 'error' in part ? part.error : 'Tool error';
      yield emit({
        role: 'TOOL',
        turnType: 'ERROR',
        toolName: part.toolName,
        content: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (part.type === 'error') {
      const err = 'error' in part ? part.error : 'Model stream error';
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  if (stepText.trim()) {
    yield emit({ role: 'AGENT', turnType: 'THINKING', content: stepText.trim() });
  }

  yield emit({ role: 'SYSTEM', turnType: 'COMPLETE', content: 'Run complete.' });
  yield { type: 'done', scopeSlug };
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

  let lastError: unknown;

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
        });
        return;
      } catch (error) {
        lastError = error;
        if (signal?.aborted || isAbortError(error)) {
          yield emit({ role: 'SYSTEM', turnType: 'ERROR', content: 'Cancelled by user.' });
          yield { type: 'cancelled', scopeSlug };
          return;
        }

        const hasFallback = i < candidates.length - 1 && isProviderFallbackEligible(error);
        if (hasFallback) {
          const next = candidates[i + 1];
          const message = error instanceof Error ? error.message : 'Agent run failed';
          yield emit({
            role: 'SYSTEM',
            turnType: 'MESSAGE',
            content: `${candidate.label} failed (${message.slice(0, 180)}). Switching to ${next.label}…`,
          });
          continue;
        }

        const message = error instanceof Error ? error.message : 'Agent run failed';
        yield emit({ role: 'SYSTEM', turnType: 'ERROR', content: message });
        yield { type: 'error', message };
        return;
      }
    }

    const message = lastError instanceof Error ? lastError.message : 'Agent run failed';
    yield emit({ role: 'SYSTEM', turnType: 'ERROR', content: message });
    yield { type: 'error', message };
  } finally {
    unregisterRun(scopeType, scopeSlug);
  }
}
