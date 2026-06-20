import { randomizeList } from '@arwes/tools';
import { gridMovingLinesIntervalMs } from '@/lib/forgeUiSettings';

export type ForgeGridCanvasPreset = {
  lineColor: string;
  movingLineColor: string;
  distance: number;
  sets: number;
};

type MovingLine = {
  x: number;
  yStart: number;
  length: number;
};

type MovingLineSet = MovingLine[];

const randomRange = (min: number, max: number) => min + (max - min) * Math.random();

const wrapProgress = (value: number) => Math.min(1, Math.max(0, value === 1 ? 1 : value % 1));

function gridAxis(size: number, distance: number) {
  const count = 1 + Math.floor(size / distance);
  const margin = size % distance;
  return { count, margin };
}

function createMovingLineSet(cssW: number, cssH: number, distance: number): MovingLineSet {
  const { count, margin } = gridAxis(cssW, distance);
  const lineCount = Math.floor(randomRange(0.1, 0.5) * count);
  const positions = randomizeList(Array.from({ length: count }, (_, index) => index));
  return positions.slice(0, lineCount).map((index) => ({
    x: margin / 2 + index * distance,
    yStart: Math.random() * (cssH / 2),
    length: Math.floor(randomRange(0.1, 0.5) * cssH),
  }));
}

function createMovingLineSets(cssW: number, cssH: number, preset: ForgeGridCanvasPreset): MovingLineSet[] {
  return Array.from({ length: preset.sets }, () =>
    createMovingLineSet(cssW, cssH, preset.distance),
  );
}

function resizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 2, 2);
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width;
  const cssH = rect.height;
  const pxW = Math.max(1, Math.round(cssW * dpr));
  const pxH = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH };
}

function drawStaticGrid(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  preset: ForgeGridCanvasPreset,
) {
  const { distance, lineColor } = preset;
  const { count: xCount, margin: xMargin } = gridAxis(cssW, distance);
  const { count: yCount, margin: yMargin } = gridAxis(cssH, distance);

  ctx.lineWidth = 1;
  ctx.strokeStyle = lineColor;
  ctx.shadowBlur = 0;

  ctx.setLineDash([4]);
  for (let yIndex = 0; yIndex < yCount; yIndex++) {
    const y = yMargin / 2 + yIndex * distance;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cssW, y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  for (let xIndex = 0; xIndex < xCount; xIndex++) {
    const x = xMargin / 2 + xIndex * distance;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cssH);
    ctx.stroke();
  }

  ctx.fillStyle = lineColor;
  for (let xIndex = 0; xIndex < xCount; xIndex++) {
    const x = xMargin / 2 + xIndex * distance;
    for (let yIndex = 0; yIndex < yCount; yIndex++) {
      const y = yMargin / 2 + yIndex * distance;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
}

function drawMovingLines(
  ctx: CanvasRenderingContext2D,
  cssH: number,
  preset: ForgeGridCanvasPreset,
  lineSets: MovingLineSet[],
  intervalProgress: number,
) {
  const { movingLineColor, sets } = preset;
  ctx.lineWidth = 1;
  ctx.strokeStyle = movingLineColor;
  ctx.shadowBlur = 1;
  ctx.shadowColor = movingLineColor;

  lineSets.forEach((lineSet, setIndex) => {
    const setOffset = (1 / sets) * setIndex;
    const progress = wrapProgress(intervalProgress + setOffset);
    const progressEase = progress;
    const yMove = cssH * 2 * progressEase - cssH;

    lineSet.forEach((line) => {
      const yTop = cssH - (line.yStart + yMove);
      const yBottom = cssH - (line.yStart + line.length + yMove);
      ctx.beginPath();
      ctx.moveTo(line.x, yTop);
      ctx.lineTo(line.x, yBottom);
      ctx.stroke();
    });
  });

  ctx.shadowBlur = 0;
}

export type ForgeGridCanvasController = {
  cancel: () => void;
};

/** Single-canvas grid + dots + moving lines — shared CSS-pixel layout avoids ARWES multi-canvas drift. */
export function mountForgeGridCanvas(
  canvas: HTMLCanvasElement,
  preset: ForgeGridCanvasPreset,
  options: { animate: boolean; intervalMs?: number },
): ForgeGridCanvasController {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { cancel: () => {} };
  }

  const intervalMs = options.intervalMs ?? gridMovingLinesIntervalMs();
  let lineSets: MovingLineSet[] = [];
  let layout = resizeCanvas(canvas, ctx);
  let rafId = 0;
  let intervalStart = performance.now();
  let resizeObserver: ResizeObserver | undefined;

  const paint = (time: number) => {
    layout = resizeCanvas(canvas, ctx);
    const { cssW, cssH } = layout;
    ctx.clearRect(0, 0, cssW, cssH);
    drawStaticGrid(ctx, cssW, cssH, preset);
    if (options.animate) {
      const intervalProgress = (time - intervalStart) / intervalMs;
      drawMovingLines(ctx, cssH, preset, lineSets, intervalProgress);
    }
  };

  const resetMovingLines = () => {
    layout = resizeCanvas(canvas, ctx);
    lineSets = createMovingLineSets(layout.cssW, layout.cssH, preset);
  };

  const tick = (time: number) => {
    paint(time);
    if (options.animate) {
      rafId = window.requestAnimationFrame(tick);
    }
  };

  resetMovingLines();
  paint(performance.now());

  if (options.animate) {
    intervalStart = performance.now();
    rafId = window.requestAnimationFrame(tick);
  }

  if (typeof window !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      resetMovingLines();
      if (!options.animate) {
        paint(performance.now());
      }
    });
    resizeObserver.observe(canvas);
  }

  return {
    cancel: () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
    },
  };
}
