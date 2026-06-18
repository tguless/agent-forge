import type { CSSProperties } from 'react';

/** Port of @arwes/effects createEffectIlluminator — cursor spotlight on interactive surfaces. */
type ForgeIlluminatorProps = {
  container: HTMLElement;
  color?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

type ForgeIlluminator = {
  cancel: () => void;
};

export function createForgeIlluminator(props: ForgeIlluminatorProps): ForgeIlluminator {
  const { container, color = 'hsl(0 0% 50% / 5%)', size = 300, className, style } = props;

  const element = document.createElement('div');
  element.role = 'presentation';
  element.dataset.name = 'illuminator';
  if (className) {
    element.className = className;
  }

  Object.assign(element.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${size}px`,
    height: `${size}px`,
    background: `radial-gradient(closest-side, ${color}, transparent)`,
    opacity: '0',
    transition: 'opacity 200ms ease-out',
    pointerEvents: 'none',
    zIndex: '1',
    ...style,
  });

  let bounds: DOMRect;
  let x: number;
  let y: number;
  let isVisible: boolean;
  let opacity: string;

  const onMove = (event: MouseEvent): void => {
    bounds = container.getBoundingClientRect();
    x = event.clientX - bounds.left;
    y = event.clientY - bounds.top;

    isVisible =
      x >= -(size / 2) &&
      x <= bounds.width + size / 2 &&
      y >= -(size / 2) &&
      y <= bounds.height + size / 2;

    opacity = isVisible ? '1' : '0';

    if (element.style.opacity !== opacity) {
      element.style.opacity = opacity;
    }

    if (isVisible) {
      element.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
    }
  };

  const onHide = (): void => {
    if (element.style.opacity !== '0') {
      element.style.opacity = '0';
    }
  };

  container.appendChild(element);
  document.addEventListener('mousemove', onMove);
  container.addEventListener('mouseleave', onHide);

  const cancel = (): void => {
    element.remove();
    document.removeEventListener('mousemove', onMove);
    container.removeEventListener('mouseleave', onHide);
  };

  return Object.freeze({ cancel });
}

export function resolveForgeIlluminatorColor(container: HTMLElement, fallback = '#38bdf8'): string {
  const accent = getComputedStyle(container).getPropertyValue('--card-accent').trim();
  const base = accent || fallback;
  return `color-mix(in srgb, ${base} 30%, transparent)`;
}
