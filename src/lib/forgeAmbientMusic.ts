import { FORGE_AMBIENT_TRACK } from '@/lib/forgeMusic';

let ambientEnabled = false;
let ambientAudio: HTMLAudioElement | null = null;
let ambientPlaying = false;

function getAmbientAudio(): HTMLAudioElement {
  if (!ambientAudio) {
    ambientAudio = new Audio(FORGE_AMBIENT_TRACK.src);
    ambientAudio.loop = true;
    ambientAudio.preload = 'auto';
    ambientAudio.volume = FORGE_AMBIENT_TRACK.volume;
  }
  return ambientAudio;
}

export function setForgeAmbientMusicEnabled(enabled: boolean): void {
  ambientEnabled = enabled;
  if (!enabled) {
    stopForgeAmbientMusic();
  }
}

export function isForgeAmbientMusicEnabled(): boolean {
  return ambientEnabled;
}

export function stopForgeAmbientMusic(): void {
  ambientPlaying = false;
  if (!ambientAudio) return;
  ambientAudio.pause();
  ambientAudio.currentTime = 0;
}

/** Start looping ambient music when enabled. Requires a prior user gesture. */
export async function startForgeAmbientMusic(): Promise<boolean> {
  if (!ambientEnabled || typeof window === 'undefined') return false;
  if (ambientPlaying) return true;

  const audio = getAmbientAudio();
  try {
    await audio.play();
    ambientPlaying = true;
    return true;
  } catch {
    ambientPlaying = false;
    return false;
  }
}
