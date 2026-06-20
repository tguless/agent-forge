'use client';

import React from 'react';
import { Animator } from '@arwes/react-animator';
import { mountForgeGridCanvas, type ForgeGridCanvasPreset } from '@/lib/forgeArwesGridCanvas';
import { gridMovingLinesIntervalMs } from '@/lib/forgeUiSettings';
import { useForgeUiSettings } from '@/components/ForgeUiSettingsProvider';

export type ForgeArwesGridVariant = 'dashboard' | 'detail';
export type ForgeArwesGridPlacement = 'viewport' | 'local';

const PRESETS: Record<
  ForgeArwesGridVariant,
  ForgeGridCanvasPreset & {
    backgroundColor: string;
    backgroundImage: string;
  }
> = {
  dashboard: {
    backgroundColor: '#000906',
    backgroundImage:
      'radial-gradient(85% 85% at 50% 50%, hsla(185, 100%, 25%, 0.25) 0%, hsla(185, 100%, 25%, 0.12) 50%, hsla(185, 100%, 25%, 0) 100%)',
    lineColor: 'hsla(180, 100%, 75%, 0.11)',
    movingLineColor: 'hsla(180, 100%, 75%, 0.14)',
    distance: 30,
    sets: 8,
  },
  detail: {
    backgroundColor: '#080f06',
    backgroundImage:
      'radial-gradient(85% 85% at 50% 50%, hsla(120, 60%, 22%, 0.22) 0%, hsla(120, 60%, 22%, 0.1) 50%, hsla(120, 60%, 22%, 0) 100%)',
    lineColor: 'hsla(120, 70%, 65%, 0.1)',
    movingLineColor: 'hsla(120, 70%, 65%, 0.13)',
    distance: 28,
    sets: 16,
  },
};

export type ForgeArwesGridBackgroundProps = {
  variant?: ForgeArwesGridVariant;
  /** viewport = fixed page backdrop; local = absolute fill inside a glass shell */
  placement?: ForgeArwesGridPlacement;
};

function ForgeGridCanvas({
  preset,
  animate,
  intervalMs,
}: {
  preset: ForgeGridCanvasPreset;
  animate: boolean;
  intervalMs: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const controller = mountForgeGridCanvas(canvas, preset, {
      animate,
      intervalMs,
    });
    return () => controller.cancel();
  }, [animate, intervalMs, preset]);

  return (
    <canvas
      ref={canvasRef}
      className="forge-arwes-grid-bg__canvas"
      aria-hidden
      role="presentation"
    />
  );
}

/** ARWES-style animated grid backdrop — one canvas so moving lines track the static grid. */
export function ForgeArwesGridBackground({
  variant = 'dashboard',
  placement = 'viewport',
}: ForgeArwesGridBackgroundProps) {
  const preset = PRESETS[variant];
  const { gridMovingLinesIntervalSec } = useForgeUiSettings();
  const intervalMs = gridMovingLinesIntervalMs(gridMovingLinesIntervalSec);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const canvasPreset = React.useMemo(
    () => ({
      lineColor: preset.lineColor,
      movingLineColor: preset.movingLineColor,
      distance: preset.distance,
      sets: preset.sets,
    }),
    [preset.distance, preset.lineColor, preset.movingLineColor, preset.sets],
  );

  return (
    <div
      className={`forge-arwes-grid-bg forge-arwes-grid-bg--${placement}`}
      aria-hidden
    >
      <Animator root active initialState="entered" duration={{ interval: 10, enter: 0, exit: 0 }}>
        <div
          className="forge-arwes-grid-bg__surface"
          style={{
            backgroundColor: preset.backgroundColor,
            backgroundImage: preset.backgroundImage,
          }}
        >
          <ForgeGridCanvas
            preset={canvasPreset}
            animate={!reducedMotion}
            intervalMs={intervalMs}
          />
        </div>
      </Animator>
    </div>
  );
}

export type ForgeGlassSurfaceProps = {
  variant?: ForgeArwesGridVariant;
  children: React.ReactNode;
  className?: string;
};

/** Clear-glass scrim + content over the fixed viewport grid — low-opacity tint, grid stays sharp. */
export function ForgeGlassSurface({ children, className }: ForgeGlassSurfaceProps) {
  return (
    <div className={['forge-glass-surface', className].filter(Boolean).join(' ')}>
      <div className="forge-glass-scrim" aria-hidden />
      <div className="forge-glass-content">{children}</div>
    </div>
  );
}

export default ForgeArwesGridBackground;
