/**
 * ARWES-style bleeps — click, error, and looping type readout during text fill-in.
 * @see .vendor/arwes/apps/docs/src/config/bleeps.ts
 */

export type ForgeBleep = 'click' | 'error' | 'type';

type BleepSource = { src: string; type: string };

type BleepDef = {
  sources: BleepSource[];
  volume: number;
};

export const FORGE_BLEEPS: Record<ForgeBleep, BleepDef> = {
  type: {
    sources: [
      { src: '/assets/sounds/type.webm', type: 'audio/webm' },
      { src: '/assets/sounds/type.mp3', type: 'audio/mpeg' },
    ],
    volume: 0.5,
  },
  click: {
    sources: [
      { src: '/assets/sounds/click.mp3', type: 'audio/mpeg' },
      { src: '/assets/sounds/click.webm', type: 'audio/webm' },
    ],
    volume: 0.75,
  },
  error: {
    sources: [
      { src: '/assets/sounds/error.mp3', type: 'audio/mpeg' },
      { src: '/assets/sounds/error.webm', type: 'audio/webm' },
    ],
    volume: 0.55,
  },
};

/** Brief gap after a click bleep before the type loop (ARWES interaction → transition). */
const INTERACTION_TYPE_GAP_MS = 220;

/** Brief tail after the last block finishes — avoids killing the loop on React remounts. */
const TYPE_LOOP_STOP_GRACE_MS = 50;

type TypeLoopEngine = {
  ctx: AudioContext;
  gain: GainNode;
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
};

let typeLoopEngine: TypeLoopEngine | null = null;
let typeLoopLoading: Promise<TypeLoopEngine | null> | null = null;
let typeLoopAudioFallback: HTMLAudioElement | null = null;
let activeTextAnims = 0;
let lastInteractionMs = 0;
let audioUnlocked = false;
let forgeTextFillSoundsEnabled = true;
let forgeButtonSoundsEnabled = true;
let typeLoopStopTimer: ReturnType<typeof setTimeout> | null = null;

function anyForgeSoundsEnabled(): boolean {
  return forgeTextFillSoundsEnabled || forgeButtonSoundsEnabled;
}

function pickSources(sources: BleepSource[]): BleepSource[] {
  if (typeof document === 'undefined') return sources;
  const supported = sources.filter((source) => {
    const probe = document.createElement('audio');
    const hint = probe.canPlayType(source.type);
    return hint === 'probably' || hint === 'maybe';
  });
  return supported.length > 0 ? supported : sources;
}

function playFreshOneShot(def: BleepDef): void {
  const sources = pickSources(def.sources);
  const tryPlay = (index: number) => {
    if (index >= sources.length) return;
    const audio = new Audio(sources[index].src);
    audio.volume = def.volume;
    audio.preload = 'auto';
    void audio.play().catch(() => tryPlay(index + 1));
  };
  tryPlay(0);
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return ctor ?? null;
}

async function loadTypeLoopEngine(): Promise<TypeLoopEngine | null> {
  if (typeLoopEngine) return typeLoopEngine;
  if (typeLoopLoading) return typeLoopLoading;

  const AudioCtx = getAudioContextCtor();
  if (!AudioCtx) return null;

  typeLoopLoading = (async () => {
    try {
      const ctx = new AudioCtx();
      const sources = pickSources(FORGE_BLEEPS.type.sources);
      let buffer: AudioBuffer | null = null;

      for (const source of sources) {
        try {
          const response = await fetch(source.src);
          if (!response.ok) continue;
          const bytes = await response.arrayBuffer();
          buffer = await ctx.decodeAudioData(bytes);
          break;
        } catch {
          continue;
        }
      }

      if (!buffer) return null;

      const gain = ctx.createGain();
      gain.gain.value = FORGE_BLEEPS.type.volume;
      gain.connect(ctx.destination);

      typeLoopEngine = { ctx, gain, buffer, source: null };
      return typeLoopEngine;
    } catch {
      return null;
    } finally {
      typeLoopLoading = null;
    }
  })();

  return typeLoopLoading;
}

function ensureTypeLoopAudioFallback(): HTMLAudioElement {
  if (!typeLoopAudioFallback) {
    const sources = pickSources(FORGE_BLEEPS.type.sources);
    typeLoopAudioFallback = new Audio(sources[0]?.src ?? '/assets/sounds/type.webm');
    typeLoopAudioFallback.loop = true;
    typeLoopAudioFallback.preload = 'auto';
    typeLoopAudioFallback.volume = FORGE_BLEEPS.type.volume;
  }
  return typeLoopAudioFallback;
}

function isTypeLoopPlaying(): boolean {
  if (typeLoopEngine?.source) return true;
  const fallback = typeLoopAudioFallback;
  return !!fallback && !fallback.paused;
}

function cancelTypeLoopStopTimer(): void {
  if (typeLoopStopTimer) {
    clearTimeout(typeLoopStopTimer);
    typeLoopStopTimer = null;
  }
}

function scheduleTypeLoopStop(): void {
  cancelTypeLoopStopTimer();
  typeLoopStopTimer = setTimeout(() => {
    typeLoopStopTimer = null;
    if (activeTextAnims === 0) {
      hardStopTypeLoop();
    }
  }, TYPE_LOOP_STOP_GRACE_MS);
}

function stopWebAudioTypeLoop(): void {
  if (!typeLoopEngine?.source) return;
  try {
    typeLoopEngine.source.stop();
  } catch {
    // already stopped
  }
  typeLoopEngine.source.disconnect();
  typeLoopEngine.source = null;
}

/** Full stop — reset for the next page visit. */
function hardStopTypeLoop(): void {
  stopWebAudioTypeLoop();
  if (!typeLoopAudioFallback) return;
  typeLoopAudioFallback.pause();
  typeLoopAudioFallback.currentTime = 0;
}

/** Sync runtime bleep gates from Interface settings (client only). */
export function setForgeSoundGates(gates: {
  textFillSoundsEnabled?: boolean;
  buttonSoundsEnabled?: boolean;
}): void {
  if (gates.textFillSoundsEnabled != null) {
    const next = gates.textFillSoundsEnabled;
    if (forgeTextFillSoundsEnabled !== next) {
      forgeTextFillSoundsEnabled = next;
      if (!next) {
        cancelTypeLoopStopTimer();
        activeTextAnims = 0;
        hardStopTypeLoop();
      }
    }
  }

  if (gates.buttonSoundsEnabled != null) {
    forgeButtonSoundsEnabled = gates.buttonSoundsEnabled;
  }
}

/** Synchronous play attempt — used only as HTML Audio fallback after Web Audio fails. */
function startHtmlTypeLoopSync(): boolean {
  const audio = ensureTypeLoopAudioFallback();
  audio.volume = FORGE_BLEEPS.type.volume;
  if (!audio.paused) return true;
  try {
    const result = audio.play();
    if (result !== undefined) {
      void result.catch(() => {});
    }
    return !audio.paused;
  } catch {
    return false;
  }
}

async function startWebAudioTypeLoop(): Promise<boolean> {
  const engine = await loadTypeLoopEngine();
  if (!engine) return false;

  if (engine.ctx.state === 'suspended') {
    await engine.ctx.resume().catch(() => {});
  }

  if (engine.ctx.state === 'suspended') return false;

  if (engine.source) return true;

  const source = engine.ctx.createBufferSource();
  source.buffer = engine.buffer;
  source.loop = true;
  source.connect(engine.gain);
  source.start(0);
  engine.source = source;

  if (typeLoopAudioFallback && !typeLoopAudioFallback.paused) {
    typeLoopAudioFallback.pause();
  }

  return true;
}

function startHtmlTypeLoopFallback(): void {
  if (startHtmlTypeLoopSync()) return;
  const sources = pickSources(FORGE_BLEEPS.type.sources);
  if (sources.length < 2) return;
  typeLoopAudioFallback = new Audio(sources[1].src);
  typeLoopAudioFallback.loop = true;
  typeLoopAudioFallback.preload = 'auto';
  typeLoopAudioFallback.volume = FORGE_BLEEPS.type.volume;
  void typeLoopAudioFallback.play().catch(() => {});
}

function startTypeLoopNow(): void {
  if (!forgeTextFillSoundsEnabled || !audioUnlocked) return;
  cancelTypeLoopStopTimer();
  if (isTypeLoopPlaying()) return;

  void startWebAudioTypeLoop().then((started) => {
    if (activeTextAnims > 0) {
      if (!started && !isTypeLoopPlaying()) {
        startHtmlTypeLoopFallback();
      }
      return;
    }
    if (started) {
      hardStopTypeLoop();
    }
  });
}

/** Mark audio allowed — call from a user gesture handler. */
export function unlockForgeAudio(): void {
  if (typeof window === 'undefined' || !anyForgeSoundsEnabled()) return;
  audioUnlocked = true;
  if (forgeTextFillSoundsEnabled) {
    void loadTypeLoopEngine();
  }
}

export function playForgeClick(): void {
  lastInteractionMs = performance.now();
  if (!forgeButtonSoundsEnabled) return;
  unlockForgeAudio();
  playFreshOneShot(FORGE_BLEEPS.click);
}

export function playForgeError(): void {
  if (!forgeButtonSoundsEnabled) return;
  unlockForgeAudio();
  playFreshOneShot(FORGE_BLEEPS.error);
}

export function enterForgeTextAnim(): void {
  if (!forgeTextFillSoundsEnabled) return;
  cancelTypeLoopStopTimer();
  activeTextAnims += 1;
  pulseForgeTypeReadout();
}

export function exitForgeTextAnim(): void {
  activeTextAnims = Math.max(0, activeTextAnims - 1);
  if (activeTextAnims === 0) {
    scheduleTypeLoopStop();
  }
}

export function pulseForgeTypeReadout(): void {
  if (!forgeTextFillSoundsEnabled) return;
  if (activeTextAnims <= 0) return;
  if (!audioUnlocked) return;
  if (performance.now() - lastInteractionMs < INTERACTION_TYPE_GAP_MS) return;
  startTypeLoopNow();
}

/** @deprecated Managed in forgeArwesAnimate. */
export function armForgeTypeReadout(): () => void {
  return () => {};
}

export const beginForgeTypeReadout = armForgeTypeReadout;
