export type TextFillTiming = 'none' | 'stagger' | 'random';

export type ForgeUiSettings = {
  /** Looping type readout while ARWES text fills in. */
  textFillSoundsEnabled: boolean;
  /** Click and error bleeps on buttons and CTAs. */
  buttonSoundsEnabled: boolean;
  /** How box text fill delays are assigned across cards and detail sections. */
  textFillTiming: TextFillTiming;
  /** Upper bound (ms) for random start delays when textFillTiming is random. */
  textFillRandomMaxMs: number;
  /** Fraction of glyphs revealed before the type readout stops (0.5–1). */
  typeReadoutStopRatio: number;
  /** Full ARWES grid scan-line sweep cycle in seconds (all pages with grid backdrop). */
  gridMovingLinesIntervalSec: number;
};

export const READOUT_STOP_RATIO_MIN = 0.5;
export const READOUT_STOP_RATIO_MAX = 1;

export const TEXT_FILL_RANDOM_MAX_MS_MIN = 0;
export const TEXT_FILL_RANDOM_MAX_MS_MAX = 5000;

export const GRID_MOVING_LINES_INTERVAL_SEC_MIN = 15;
export const GRID_MOVING_LINES_INTERVAL_SEC_MAX = 120;
export const GRID_MOVING_LINES_INTERVAL_SEC_DEFAULT = 25;
export const GRID_MOVING_LINES_INTERVAL_SEC_STEP = 5;

export const DEFAULT_FORGE_UI_SETTINGS: ForgeUiSettings = {
  textFillSoundsEnabled: true,
  buttonSoundsEnabled: true,
  textFillTiming: 'none',
  textFillRandomMaxMs: 800,
  typeReadoutStopRatio: 0.88,
  gridMovingLinesIntervalSec: GRID_MOVING_LINES_INTERVAL_SEC_DEFAULT,
};

export const FORGE_UI_SETTINGS_DB_KEY = 'ui.settings';

const TEXT_FILL_TIMING_VALUES: TextFillTiming[] = ['none', 'stagger', 'random'];

export function isTextFillTiming(value: unknown): value is TextFillTiming {
  return typeof value === 'string' && TEXT_FILL_TIMING_VALUES.includes(value as TextFillTiming);
}

export function clampReadoutStopRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FORGE_UI_SETTINGS.typeReadoutStopRatio;
  return Math.min(READOUT_STOP_RATIO_MAX, Math.max(READOUT_STOP_RATIO_MIN, value));
}

export function clampTextFillRandomMaxMs(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FORGE_UI_SETTINGS.textFillRandomMaxMs;
  return Math.min(
    TEXT_FILL_RANDOM_MAX_MS_MAX,
    Math.max(TEXT_FILL_RANDOM_MAX_MS_MIN, Math.round(value)),
  );
}

export function clampGridMovingLinesIntervalSec(value: number): number {
  if (!Number.isFinite(value)) return GRID_MOVING_LINES_INTERVAL_SEC_DEFAULT;
  const stepped =
    Math.round(value / GRID_MOVING_LINES_INTERVAL_SEC_STEP) * GRID_MOVING_LINES_INTERVAL_SEC_STEP;
  return Math.min(
    GRID_MOVING_LINES_INTERVAL_SEC_MAX,
    Math.max(GRID_MOVING_LINES_INTERVAL_SEC_MIN, stepped),
  );
}

export function gridMovingLinesIntervalMs(sec = GRID_MOVING_LINES_INTERVAL_SEC_DEFAULT): number {
  return clampGridMovingLinesIntervalSec(sec) * 1000;
}

/** Stable 0..1 from a string — random delays stay fixed for a given seed. */
function hashStringToUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/** Release type readout before the easing tail — sound stops while glyphs still finish silently. */
export function readoutDoneLength(
  length: number,
  ratio = DEFAULT_FORGE_UI_SETTINGS.typeReadoutStopRatio,
): number {
  const clamped = clampReadoutStopRatio(ratio);
  if (length <= 4) return length;
  if (clamped >= 1) return length;
  return Math.max(1, Math.ceil(length * clamped));
}

/** Resolve animation delay (seconds) from UI timing mode. */
export function resolveTextFillDelay(
  timing: TextFillTiming,
  opts: {
    staggerSeconds?: number;
    randomMaxMs?: number;
    randomSeed: string;
  },
): number | undefined {
  if (timing === 'none') return undefined;

  if (timing === 'stagger') {
    const seconds = opts.staggerSeconds ?? 0;
    return seconds > 0 ? seconds : undefined;
  }

  const maxMs = clampTextFillRandomMaxMs(opts.randomMaxMs ?? DEFAULT_FORGE_UI_SETTINGS.textFillRandomMaxMs);
  if (maxMs <= 0) return undefined;
  return (hashStringToUnit(opts.randomSeed) * maxMs) / 1000;
}

type LegacyForgeUiSettings = Partial<ForgeUiSettings> & {
  textStaggerEnabled?: boolean;
  soundsEnabled?: boolean;
};

export function normalizeForgeUiSettings(parsed: LegacyForgeUiSettings): ForgeUiSettings {
  let textFillTiming = parsed.textFillTiming;
  if (!textFillTiming && parsed.textStaggerEnabled != null) {
    textFillTiming = parsed.textStaggerEnabled ? 'stagger' : 'none';
  }

  let textFillSoundsEnabled = parsed.textFillSoundsEnabled;
  let buttonSoundsEnabled = parsed.buttonSoundsEnabled;
  if (parsed.soundsEnabled != null && textFillSoundsEnabled == null && buttonSoundsEnabled == null) {
    textFillSoundsEnabled = parsed.soundsEnabled;
    buttonSoundsEnabled = parsed.soundsEnabled;
  }

  return {
    textFillSoundsEnabled:
      typeof textFillSoundsEnabled === 'boolean'
        ? textFillSoundsEnabled
        : DEFAULT_FORGE_UI_SETTINGS.textFillSoundsEnabled,
    buttonSoundsEnabled:
      typeof buttonSoundsEnabled === 'boolean'
        ? buttonSoundsEnabled
        : DEFAULT_FORGE_UI_SETTINGS.buttonSoundsEnabled,
    textFillTiming: isTextFillTiming(textFillTiming)
      ? textFillTiming
      : DEFAULT_FORGE_UI_SETTINGS.textFillTiming,
    textFillRandomMaxMs: clampTextFillRandomMaxMs(
      parsed.textFillRandomMaxMs ?? DEFAULT_FORGE_UI_SETTINGS.textFillRandomMaxMs,
    ),
    typeReadoutStopRatio: clampReadoutStopRatio(
      parsed.typeReadoutStopRatio ?? DEFAULT_FORGE_UI_SETTINGS.typeReadoutStopRatio,
    ),
    gridMovingLinesIntervalSec: clampGridMovingLinesIntervalSec(
      parsed.gridMovingLinesIntervalSec ?? DEFAULT_FORGE_UI_SETTINGS.gridMovingLinesIntervalSec,
    ),
  };
}
