/**
 * Configurable text LLM provider for Agent Forge (OpenAI default, optional Claude fallback).
 * Runtime provider/model selection comes from /config (SQLite) with .env.local as bootstrap default.
 */
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { getLlmSettings } from '@/lib/forgeConfigStore';
import {
  modelForProvider,
  type ForgeLlmSettings,
  type LlmProviderChoice,
} from '@/lib/forgeLlmSettings';
import { anthropicSdkMaxRetries, openaiSdkMaxRetries } from './retryPolicy';
import {
  isRateLimitError,
  llmRateLimitMaxRetries,
  retryWithDecayingBackoff,
} from './llmThrottle';

export type LlmProvider = LlmProviderChoice;

export type TextModelRole = 'author';

function providerHasKey(provider: LlmProvider): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY?.trim();
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

export function modelMatchesProvider(modelId: string, provider: LlmProvider): boolean {
  const id = modelId.trim().toLowerCase();
  if (!id) return false;
  if (provider === 'anthropic') return id.includes('claude');
  return id.includes('gpt') || id.startsWith('o') || id.includes('chatgpt');
}

function activeLlmSettings(): ForgeLlmSettings {
  return getLlmSettings();
}

export function configuredLlmProvider(): LlmProvider {
  return activeLlmSettings().primaryProvider;
}

export function configuredLlmFallbackProvider(): LlmProvider | null {
  const fallback = activeLlmSettings().fallbackProvider;
  return fallback === 'none' ? null : fallback;
}

export function resolveModelId(
  provider: LlmProvider,
  role: TextModelRole = 'author',
  explicit?: string,
): string | null {
  void role;
  if (explicit && modelMatchesProvider(explicit, provider)) return explicit.trim();
  const settings = activeLlmSettings();
  const pick = modelForProvider(settings, provider);
  if (!pick) return null;
  return modelMatchesProvider(pick, provider) ? pick : null;
}

export function textLlmConfigured(): boolean {
  return resolveLlmCandidates().length > 0;
}

export function textLlmConfigError(): string {
  const settings = activeLlmSettings();
  const primary = settings.primaryProvider;
  const fallback = configuredLlmFallbackProvider();
  const parts: string[] = [];

  if (!providerHasKey(primary)) {
    parts.push(primary === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY');
  } else if (!resolveModelId(primary, 'author')) {
    parts.push(primary === 'openai' ? 'OpenAI model (config or OPENAI_MODEL)' : 'Anthropic model (config or ANTHROPIC_MODEL)');
  }

  if (fallback) {
    if (!providerHasKey(fallback)) {
      parts.push(fallback === 'openai' ? 'OPENAI_API_KEY (fallback)' : 'ANTHROPIC_API_KEY (fallback)');
    } else if (!resolveModelId(fallback, 'author')) {
      parts.push(
        fallback === 'openai'
          ? 'OpenAI fallback model (config or OPENAI_MODEL)'
          : 'Anthropic fallback model (config or ANTHROPIC_MODEL)',
      );
    }
  }

  if (parts.length === 0) return 'Text LLM is not configured — set provider and models under /config or in .env.local.';
  return `${parts.join(' and ')} missing — add keys on the server and pick models in Forge configuration.`;
}

export type ResolvedLlmCandidate = {
  provider: LlmProvider;
  modelId: string;
  label: string;
};

export function resolveLlmCandidates(opts?: {
  model?: string;
  role?: TextModelRole;
}): ResolvedLlmCandidate[] {
  const role = opts?.role ?? 'author';
  const settings = activeLlmSettings();
  const explicitModel = opts?.model?.trim();
  const out: ResolvedLlmCandidate[] = [];

  const push = (provider: LlmProvider) => {
    if (!providerHasKey(provider)) return;
    const modelId = resolveModelId(provider, role, explicitModel);
    if (!modelId) return;
    const label = provider === 'openai' ? `OpenAI ${modelId}` : `Claude ${modelId}`;
    if (out.some((c) => c.provider === provider && c.modelId === modelId)) return;
    out.push({ provider, modelId, label });
  };

  push(settings.primaryProvider);
  const fallback = settings.fallbackProvider;
  if (fallback !== 'none' && fallback !== settings.primaryProvider) push(fallback);

  return out;
}

export function createLanguageModel(provider: LlmProvider, modelId: string): LanguageModel {
  return provider === 'openai' ? openai(modelId) : anthropic(modelId);
}

export function sdkMaxRetries(provider: LlmProvider): number {
  return provider === 'openai' ? openaiSdkMaxRetries() : anthropicSdkMaxRetries();
}

export function isProviderFallbackEligible(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string; statusCode?: number; code?: string };
  if (e.name === 'AbortError') return false;
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('abort')) return false;
  const code = String(e.code ?? '').toLowerCase();
  return (
    code === 'rate_limit_exceeded' ||
    msg.includes('credit') ||
    msg.includes('billing') ||
    msg.includes('quota') ||
    msg.includes('insufficient') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('tokens per min') ||
    msg.includes('tpm') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('not_found') ||
    msg.includes('model_not_found') ||
    msg.includes('model:') ||
    msg.includes('timeout') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    e.statusCode === 401 ||
    e.statusCode === 403 ||
    e.statusCode === 404 ||
    e.statusCode === 429 ||
    e.statusCode === 502 ||
    e.statusCode === 503 ||
    e.statusCode === 504
  );
}

export async function runWithLlmCandidates<T>(
  opts: {
    role?: TextModelRole;
    model?: string;
    label?: string;
  },
  fn: (candidate: ResolvedLlmCandidate) => Promise<T>,
): Promise<{ result: T; candidate: ResolvedLlmCandidate }> {
  const candidates = resolveLlmCandidates({ role: opts.role, model: opts.model });
  if (candidates.length === 0) throw new Error(textLlmConfigError());

  const attempts: string[] = [];
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const result = await retryWithDecayingBackoff(
        () => fn(candidate),
        {
          label: `${opts.label ?? 'call'} · ${candidate.label}`,
          maxRetries: llmRateLimitMaxRetries(),
          shouldRetry: isRateLimitError,
        },
      );
      return { result, candidate };
    } catch (error) {
      lastError = error;
      attempts.push(`${candidate.label}: ${error instanceof Error ? error.message : String(error)}`);
      const hasFallback = i < candidates.length - 1 && isProviderFallbackEligible(error);
      if (!hasFallback) break;
      console.warn(
        `[textModel] ${opts.label ?? 'call'} — ${candidate.label} failed; trying fallback`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const detail = attempts.join(' | ');
  throw new Error(detail || (lastError instanceof Error ? lastError.message : 'Text LLM call failed'));
}
