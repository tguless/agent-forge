export type LlmProviderChoice = 'openai' | 'anthropic';

export type LlmFallbackChoice = LlmProviderChoice | 'none';

export type ForgeLlmSettings = {
  /** Primary text LLM vendor for agent, business, and example runs. */
  primaryProvider: LlmProviderChoice;
  /** Optional second provider when the primary hits billing, rate limits, or model errors. */
  fallbackProvider: LlmFallbackChoice;
  /** OpenAI model id (e.g. gpt-5.4-nano). Empty string = use OPENAI_MODEL from .env.local. */
  openaiModel: string;
  /** Anthropic model id (e.g. claude-sonnet-4-5). Empty string = use ANTHROPIC_MODEL from .env.local. */
  anthropicModel: string;
};

export const FORGE_LLM_SETTINGS_DB_KEY = 'llm.settings';

export const LLM_PROVIDER_OPTIONS: { value: LlmProviderChoice; label: string; hint: string }[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    hint: 'Uses OPENAI_API_KEY from the server environment.',
  },
  {
    value: 'anthropic',
    label: 'Anthropic (Claude)',
    hint: 'Uses ANTHROPIC_API_KEY from the server environment.',
  },
];

export const LLM_FALLBACK_OPTIONS: { value: LlmFallbackChoice; label: string; hint: string }[] = [
  {
    value: 'none',
    label: 'None',
    hint: 'Do not try a second provider when the primary fails.',
  },
  ...LLM_PROVIDER_OPTIONS,
];

function normalizeProvider(value: unknown, fallback: LlmProviderChoice): LlmProviderChoice {
  if (value === 'openai' || value === 'anthropic') return value;
  return fallback;
}

function normalizeFallback(value: unknown, fallback: LlmFallbackChoice): LlmFallbackChoice {
  if (value === 'none' || value === 'openai' || value === 'anthropic') return value;
  return fallback;
}

export function defaultForgeLlmSettingsFromEnv(): ForgeLlmSettings {
  const envPrimary = process.env.FORGE_LLM_PROVIDER?.trim().toLowerCase();
  const envFallback = process.env.FORGE_LLM_FALLBACK_PROVIDER?.trim().toLowerCase();

  let primaryProvider: LlmProviderChoice = 'openai';
  if (envPrimary === 'anthropic' || envPrimary === 'claude') primaryProvider = 'anthropic';
  if (envPrimary === 'openai' || envPrimary === 'gpt') primaryProvider = 'openai';

  let fallbackProvider: LlmFallbackChoice = 'none';
  if (envFallback === 'openai' || envFallback === 'gpt') fallbackProvider = 'openai';
  if (envFallback === 'anthropic' || envFallback === 'claude') fallbackProvider = 'anthropic';

  return {
    primaryProvider,
    fallbackProvider,
    openaiModel: process.env.OPENAI_MODEL?.trim() ?? '',
    anthropicModel: process.env.ANTHROPIC_MODEL?.trim() ?? '',
  };
}

export function normalizeForgeLlmSettings(parsed: Partial<ForgeLlmSettings> | null | undefined): ForgeLlmSettings {
  const envDefaults = defaultForgeLlmSettingsFromEnv();
  const primaryProvider = normalizeProvider(parsed?.primaryProvider, envDefaults.primaryProvider);
  let fallbackProvider = normalizeFallback(parsed?.fallbackProvider, envDefaults.fallbackProvider);
  if (fallbackProvider === primaryProvider) fallbackProvider = 'none';

  return {
    primaryProvider,
    fallbackProvider,
    openaiModel: typeof parsed?.openaiModel === 'string' ? parsed.openaiModel.trim() : envDefaults.openaiModel,
    anthropicModel:
      typeof parsed?.anthropicModel === 'string' ? parsed.anthropicModel.trim() : envDefaults.anthropicModel,
  };
}

export function modelForProvider(settings: ForgeLlmSettings, provider: LlmProviderChoice): string {
  const fromSettings = provider === 'openai' ? settings.openaiModel : settings.anthropicModel;
  if (fromSettings) return fromSettings;
  const fromEnv =
    provider === 'openai'
      ? process.env.OPENAI_MODEL?.trim()
      : process.env.ANTHROPIC_MODEL?.trim();
  return fromEnv ?? '';
}

export type ForgeLlmRuntimeStatus = {
  openaiKeyConfigured: boolean;
  anthropicKeyConfigured: boolean;
  activePrimary: string;
  activeFallback: string | null;
  openaiModelResolved: string | null;
  anthropicModelResolved: string | null;
};

export function describeForgeLlmRuntime(settings: ForgeLlmSettings): ForgeLlmRuntimeStatus {
  const openaiModelResolved = modelForProvider(settings, 'openai') || null;
  const anthropicModelResolved = modelForProvider(settings, 'anthropic') || null;
  const activePrimary =
    settings.primaryProvider === 'openai'
      ? `OpenAI ${openaiModelResolved ?? '(model not set)'}`
      : `Claude ${anthropicModelResolved ?? '(model not set)'}`;
  const activeFallback =
    settings.fallbackProvider === 'none'
      ? null
      : settings.fallbackProvider === 'openai'
        ? `OpenAI ${openaiModelResolved ?? '(model not set)'}`
        : `Claude ${anthropicModelResolved ?? '(model not set)'}`;

  return {
    openaiKeyConfigured: !!process.env.OPENAI_API_KEY?.trim(),
    anthropicKeyConfigured: !!process.env.ANTHROPIC_API_KEY?.trim(),
    activePrimary,
    activeFallback,
    openaiModelResolved,
    anthropicModelResolved,
  };
}
