import { createAnimation, easeAmong, type Animation, type Easing } from '@arwes/animated';
import { enterForgeTextAnim, exitForgeTextAnim, pulseForgeTypeReadout } from '@/lib/forgeBleeps';

const CIPHERED_CHARACTERS =
  '    ----____abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function walkTextNodes(node: Node, callback: (n: Node) => void): void {
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      callback(child);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      walkTextNodes(child, callback);
    }
  });
}

function setTextNodesContent(
  textNodes: Node[],
  texts: string[],
  contentLength: number,
  onCurrentNode?: (textNode: Node) => void,
): void {
  let markerLength = 0;
  for (let index = 0; index < textNodes.length; index++) {
    const textNode = textNodes[index];
    const text = texts[index];
    const newMarkerLength = markerLength + text.length;
    if (newMarkerLength <= contentLength) {
      if (textNode.textContent !== text) {
        textNode.textContent = text;
      }
      if (newMarkerLength === contentLength) {
        onCurrentNode?.(textNode);
      }
    } else if (markerLength < contentLength) {
      const portion = contentLength - markerLength;
      const slice = text.substring(0, portion);
      if (textNode.textContent !== slice) {
        textNode.textContent = slice;
      }
      onCurrentNode?.(textNode);
    } else {
      if (textNode.textContent !== '') {
        textNode.textContent = '';
      }
      if (contentLength === 0 && index === 0) {
        onCurrentNode?.(textNode);
      }
    }
    markerLength = newMarkerLength;
  }
}

function restoreTextNodes(textNodes: Node[], texts: string[]): void {
  setTextNodesContent(textNodes, texts, texts.join('').length);
}

type InPlaceBase = {
  contentElement: HTMLElement;
  duration: number;
  easing?: Easing;
  readoutSound?: boolean;
};

/** Remember block height before in-place sequence clears text nodes (avoids card growth). */
export function lockElementLayout(el: HTMLElement): () => void {
  const height = el.offsetHeight;
  if (height > 0) {
    el.style.minHeight = `${height}px`;
  }
  return () => {
    el.style.minHeight = '';
  };
}

/** Scale duration by character count (mirrors @arwes/text getAnimationTextDuration). */
export function getForgeTextDuration(
  length: number,
  opts?: { max?: number; min?: number; charactersPerSecond?: number },
): number {
  const { max = 0.9, min = 0.1, charactersPerSecond = 120 } = opts ?? {};
  const raw = ((1000 / charactersPerSecond) * length) / 1000;
  return Math.max(min, Math.min(raw, max));
}

export const FORGE_DECODE_DURATION_OPTS = {
  max: 3.4,
  min: 0.95,
  charactersPerSecond: 48,
} as const;

export const FORGE_DECODE_HUD_OPTS = {
  max: 1.35,
  min: 0.35,
  charactersPerSecond: 95,
} as const;

type InPlaceSequence = InPlaceBase & {
  blink?: boolean;
  blinkDuration?: number;
};

/** Release type readout a hair before the final glyphs — trims tail without a visible gap. */
function readoutDoneLength(length: number): number {
  if (length <= 6) return length;
  return Math.max(1, length - 2);
}

function wrapReadoutLifecycle(
  finish: () => void,
  readoutSound: boolean,
): { finish: () => void; releaseReadout: () => void } {
  if (!readoutSound) {
    return { finish, releaseReadout: () => {} };
  }
  let released = false;
  const releaseReadout = () => {
    if (released) return;
    released = true;
    exitForgeTextAnim();
  };
  enterForgeTextAnim();
  return {
    finish: () => {
      finish();
      releaseReadout();
    },
    releaseReadout,
  };
}

/** Typewriter on the real DOM node — no absolute clone overlay (avoids end-of-anim jump). */
export function animateTextSequenceInPlace({
  contentElement,
  duration,
  easing = 'linear',
  blink = true,
  blinkDuration = 0.1,
  readoutSound = true,
}: InPlaceSequence): Animation {
  const textNodes: Node[] = [];
  const texts: string[] = [];

  walkTextNodes(contentElement, (child) => {
    textNodes.push(child);
    texts.push(child.textContent || '');
    child.textContent = '';
  });

  const length = texts.join('').length;
  let blinkElement: HTMLSpanElement | undefined;
  let blinkAnimation: Animation | undefined;

  if (blink) {
    blinkElement = document.createElement('span');
    blinkElement.className = 'forge-arwes-blink';
    blinkElement.innerHTML = '&#9614;';
    Object.assign(blinkElement.style, {
      position: 'relative',
      display: 'inline-block',
      width: '0',
      height: '0',
      lineHeight: '0',
      color: 'inherit',
    });
    const blinkEase = easeAmong([0, 1, 2]);
    const blinkColors = ['transparent', 'inherit', 'transparent'];
    blinkAnimation = createAnimation({
      duration: blinkDuration,
      easing: 'linear',
      repeat: Infinity,
      onUpdate(progress) {
        const index = Math.round(blinkEase(progress));
        blinkElement!.style.color = blinkColors[index];
      },
    });
  }

  const { finish, releaseReadout } = wrapReadoutLifecycle(() => {
    restoreTextNodes(textNodes, texts);
    blinkElement?.remove();
    blinkAnimation?.cancel();
  }, readoutSound);

  return createAnimation({
    duration,
    easing,
    direction: 'normal',
    onUpdate: (progress) => {
      const newLength = Math.round(progress * length);
      if (readoutSound && newLength > 0) {
        pulseForgeTypeReadout();
      }
      if (readoutSound && length > 0 && newLength >= readoutDoneLength(length)) {
        releaseReadout();
      }
      setTextNodesContent(textNodes, texts, newLength, (textNode) => {
        if (blinkElement && textNode.parentNode && textNode.parentNode !== blinkElement.parentNode) {
          textNode.parentNode.appendChild(blinkElement);
        }
      });
    },
    onFinish: finish,
    onCancel: finish,
  });
}

type InPlaceDecipher = InPlaceBase & {
  characters?: string;
};

/** Decipher scramble on the real DOM node — no absolute clone overlay. */
export function animateTextDecipherInPlace({
  contentElement,
  duration,
  easing = 'linear',
  characters = CIPHERED_CHARACTERS,
  readoutSound = true,
}: InPlaceDecipher): Animation {
  const textNodes: Node[] = [];
  const textsReal: string[] = [];

  walkTextNodes(contentElement, (child) => {
    textNodes.push(child);
    textsReal.push(child.textContent || '');
  });

  const length = textsReal.join('').length;
  const indexes = Array.from({ length }, (_, i) => i).sort(() => Math.random() - 0.5);
  const deciphered: Record<number, boolean> = {};

  const { finish, releaseReadout } = wrapReadoutLifecycle(() => {
    restoreTextNodes(textNodes, textsReal);
  }, readoutSound);

  return createAnimation({
    duration,
    easing,
    direction: 'normal',
    onUpdate: (progress) => {
      const revealed = Math.round(length * progress);
      if (readoutSound && revealed > 0) {
        pulseForgeTypeReadout();
      }
      if (readoutSound && length > 0 && revealed >= readoutDoneLength(length)) {
        releaseReadout();
      }
      for (let index = 0; index < length; index++) {
        deciphered[indexes[index]] = index < revealed;
      }
      const textsCurrent = textsReal.map((text) =>
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (deciphered[index]) return char;
            return characters[Math.round(Math.random() * (characters.length - 1))];
          })
          .join(''),
      );
      setTextNodesContent(textNodes, textsCurrent, length);
    },
    onFinish: finish,
    onCancel: finish,
  });
}
