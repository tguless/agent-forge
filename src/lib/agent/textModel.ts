/**
 * Configurable text LLM provider for Agent Forge (OpenAI default, Anthropic fallback).
 */
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { anthropicSdkMaxRetries, openaiSdkMaxRetries } from './retryPolicy';

export type LlmProvider = 'openai' | 'anthropic';

export type TextModelRole = 'author';

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-nano';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';

function normalizeProvider(raw: string | undefined): LlmProvider | null {
  const v = raw?.trim().toLowerCase();
  if (!v || v === 'none' || v === 'off') return null;
  if (v === 'openai' || v === 'gpt') return 'openai';
  if (v === 'anthropic' || v === 'claude') return 'anthropic';
  return null;
}

export function configuredLlmProvider(): LlmProvider {
  return normalizeProvider(process.env.FORGE_LLM_PROVIDER) ?? 'openai';
}

export function configuredLlmFallbackProvider(): LlmProvider | null {
  return normalizeProvider(process.env.FORGE_LLM_FALLBACK_PROVIDER);
}

function providerHasKey(provider: LlmProvider): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY?.trim();
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

export function textLlmConfigured(): boolean {
  const primary = configuredLlmProvider();
  const fallback = configuredLlmFallbackProvider();
  if (providerHasKey(primary)) return true;
  if (fallback && providerHasKey(fallback)) return true;
  return false;
}

export function textLlmConfigError(): string {
  const primary = configuredLlmProvider();
  const fallback = configuredLlmFallbackProvider();
  const keys =
    primary === 'openai'
      ? 'OPENAI_API_KEY'
      : 'ANTHROPIC_API_KEY';
  const fallbackHint =
    fallback && fallback !== primary
      ? ` or ${fallback === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} (fallback)`
      : '';
  return `${keys}${fallbackHint} missing — add to .env.local and retry.`;
}

export function defaultModelForProvider(provider: LlmProvider, role: TextModelRole = 'author'): string {
  void role;
  if (provider === 'openai') {
    return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  }
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
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
  const primary = configuredLlmProvider();
  const fallback = configuredLlmFallbackProvider();
  const explicitModel = opts?.model?.trim();
  const out: ResolvedLlmCandidate[] = [];

  const push = (provider: LlmProvider) => {
    if (!providerHasKey(provider)) return;
    const modelId = explicitModel || defaultModelForProvider(provider, role);
    const label = provider === 'openai' ? `OpenAI ${modelId}` : `Claude ${modelId}`;
    if (out.some((c) => c.provider === provider && c.modelId === modelId)) return;
    out.push({ provider, modelId, label });
  };

  push(primary);
  if (fallback && fallback !== primary) push(fallback);

  return out;
}

export function createLanguageModel(provider: LlmProvider, modelId: string): LanguageModel {
  return provider === 'openai' ? openai(modelId) : anthropic(modelId);
}

export function sdkMaxRetries(provider: LlmProvider): number {
  return provider === 'openai' ? openaiSdkMaxRetries() : anthropicSdkMaxRetries();
}

export function isProviderFallbackEligible(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const e = error as { name?: string; message?: string; statusCode?: number };
  if (e.name === 'AbortError') return false;
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('abort')) return false;
  if (
    msg.includes('credit') ||
    msg.includes('billing') ||
    msg.includes('quota') ||
    msg.includes('insufficient') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('not_found') ||
    msg.includes('model:') ||
    e.statusCode === 401 ||
    e.statusCode === 403 ||
    e.statusCode === 404 ||
    e.statusCode === 429
  ) {
    return true;
  }
  return true;
}
