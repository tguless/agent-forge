/**
 * Visual asset generation for Agent Forge.
 *
 * Mirrors the PaperIQ operations asset scripts:
 *   1. Compose a prompt (icon / emblem / portrait) from agent details
 *   2. Generate via Gemini "Nano Banana" image model (@google/genai)
 *   3. Decode Gemini JPEG → PNG, then ImageMagick fuzz white→alpha → normalize
 *
 * rembg is available in Docker.
 *   Icons:     rembg → ImageMagick 14% white→alpha → trim/normalize
 *   Emblems:   rembg (wing guard) → ImageMagick 14% white→alpha → PIL/magick normalize
 *   Plaques:   rembg → ImageMagick 12% magenta (#FF00FF) chroma→alpha → normalize
 *              (same rembg+magick trick as icons; white key eats silver gunmetal on plaques)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';

export type ImageKind = 'icon' | 'emblem' | 'portrait';

/** Post-process square assets — plaque uses trim like icon; emblem never trims. */
type NormalizeKind = ImageKind | 'plaque';

export type GenerateImageInput = {
  slug: string;
  kind: ImageKind;
  /** What the symbol/portrait should depict (LLM-authored). */
  subject: string;
  /** Hex accent, e.g. #38bdf8 */
  accent: string;
  /** 3–5 rank tier (emblem wings / portrait uniform). */
  authority?: number;
};

export type GenerateImageResult = {
  /** Web path under /public, e.g. /agents/<slug>/emblem.png */
  webPath: string;
  /** Whether the image came from Gemini (true) or a placeholder (false). */
  generated: boolean;
  notes: string[];
};

const CWD = process.cwd();
const TMP = path.join(CWD, '.forge_tmp');
const DATA_AGENTS = path.join(CWD, 'data', 'agents');
const DATA_BUSINESSES = path.join(CWD, 'data', 'businesses');

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const IMAGE_SIZE = process.env.GEMINI_IMAGE_SIZE || '2K';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_IMAGE_TIMEOUT_MS || 600_000);
const WHITE_FUZZ = process.env.ICON_WHITE_FUZZ || '14%';
/** classic = rembg + 14% fuzz + PIL trim (May 2026). sharp = magick defringe only. */
const EMBLEM_PIPELINE = (process.env.EMBLEM_PIPELINE || 'classic').toLowerCase();
const EMBLEM_USE_REMBG = process.env.EMBLEM_USE_REMBG !== '0';
/** White key fuzz for classic emblem path (default matches May 31 forge). */
const EMBLEM_WHITE_FUZZ = process.env.EMBLEM_WHITE_FUZZ || '14%';
/** Min rembg/raw trim-bbox ratio — reject rembg when wings were cropped to center only. */
const EMBLEM_REMBG_MIN_RATIO = Number(process.env.EMBLEM_REMBG_MIN_RATIO || 0.72);
/** Extra inset around emblem alpha bbox before crop — preserves wing tips after white key. */
const EMBLEM_BBOX_PAD_PCT = Number(process.env.EMBLEM_BBOX_PAD_PCT || 8);
const EMBLEM_MARGIN_PCT = Number(process.env.EMBLEM_MARGIN_PCT || 8);
/** Sharp pipeline only — see EMBLEM_PIPELINE=sharp */
const EMBLEM_SHARP_WHITE_FUZZ = process.env.EMBLEM_SHARP_WHITE_FUZZ || '2%';
const EMBLEM_POST_WHITE_FUZZ = process.env.EMBLEM_POST_WHITE_FUZZ || '3%';
const EMBLEM_ALPHA_THRESHOLD = process.env.EMBLEM_ALPHA_THRESHOLD || '65%';
/** Business plaques: chroma key (not white — silver highlights get eaten). */
const PLAQUE_CHROMA_COLOR = process.env.PLAQUE_CHROMA_COLOR || '#FF00FF';
const PLAQUE_CHROMA_FUZZ = process.env.PLAQUE_CHROMA_FUZZ || '12%';

// ── prompt fragments (configurable via Forge Configuration) ─────────────────

function rankWingsKey(authority: number): 'image.emblem.rank_wings_3' | 'image.emblem.rank_wings_4' | 'image.emblem.rank_wings_5' {
  if (authority >= 5) return 'image.emblem.rank_wings_5';
  if (authority >= 4) return 'image.emblem.rank_wings_4';
  return 'image.emblem.rank_wings_3';
}

function rankUniformKey(
  authority: number,
): 'image.portrait.rank_uniform_3' | 'image.portrait.rank_uniform_4' | 'image.portrait.rank_uniform_5' {
  if (authority >= 5) return 'image.portrait.rank_uniform_5';
  if (authority >= 4) return 'image.portrait.rank_uniform_4';
  return 'image.portrait.rank_uniform_3';
}

// ── Agent image prompts (icon / emblem / portrait) — never business plaque keys ─

function buildAgentImagePrompt(input: GenerateImageInput): { prompt: string; aspect: '1:1' | '3:4' } {
  const authority = input.authority ?? 3;
  const whiteBg = getPromptContent('image.shared.white_bg');
  const fillHint = getPromptContent('image.shared.fill_hint');

  if (input.kind === 'icon') {
    return {
      aspect: '1:1',
      prompt: applyPromptTemplate(getPromptContent('image.icon.template'), {
        white_bg: whiteBg,
        fill_hint: fillHint,
        accent: input.accent,
        subject: input.subject,
      }),
    };
  }
  if (input.kind === 'emblem') {
    return {
      aspect: '1:1',
      prompt: applyPromptTemplate(getPromptContent('image.emblem.template'), {
        emblem_white_bg: getPromptContent('image.emblem.white_bg'),
        winged_plaque: getPromptContent('image.emblem.winged_plaque'),
        rank_wings: getPromptContent(rankWingsKey(authority)),
        accent: input.accent,
        subject: input.subject,
        emblem_forbidden: getPromptContent('image.emblem.forbidden'),
      }),
    };
  }
  return {
    aspect: '3:4',
    prompt: applyPromptTemplate(getPromptContent('image.portrait.template'), {
      portrait_base: getPromptContent('image.portrait.base'),
      rank_uniform: getPromptContent(rankUniformKey(authority)),
      accent: input.accent,
      subject: input.subject,
    }),
  };
}

// ── tool detection ──────────────────────────────────────────────────────────

function resolveRembgPython(): string | null {
  const fromEnv = process.env.REMBG_PYTHON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const dockerVenv = path.join(CWD, '.venv-rembg/bin/python3');
  if (fs.existsSync(dockerVenv)) return dockerVenv;
  const shared = path.resolve(CWD, '../.cursor/mcp-servers/rembg/.venv/bin/python3');
  if (fs.existsSync(shared)) return shared;
  return null;
}

function findPython(): string | null {
  const rembg = resolveRembgPython();
  if (rembg) return rembg;
  for (const cmd of ['python3', 'python']) {
    if (spawnSync(cmd, ['--version'], { encoding: 'utf8' }).status === 0) return cmd;
  }
  return null;
}

function findMagick(): string | null {
  for (const cmd of ['magick', 'convert', '/usr/bin/magick', '/usr/bin/convert', '/opt/homebrew/bin/magick', '/usr/local/bin/magick']) {
    if (spawnSync(cmd, ['-version'], { encoding: 'utf8' }).status === 0) return cmd;
  }
  return null;
}

// ── pipeline steps ────────────────────────────────────────────────────────────

type RawFormat = 'jpeg' | 'png' | 'webp' | 'unknown';

function detectRawFormat(buf: Buffer): RawFormat {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'png';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  return 'unknown';
}

/** Gemini often returns JPEG bytes; Alpine ImageMagick needs imagemagick-jpeg + real PNG for alpha ops. */
function ensurePngRaw(magick: string | null, buf: Buffer, dstPng: string): boolean {
  const fmt = detectRawFormat(buf);
  if (fmt === 'png') {
    fs.writeFileSync(dstPng, buf);
    return true;
  }
  if (!magick) {
    fs.writeFileSync(dstPng, buf);
    return false;
  }
  const ext = fmt === 'jpeg' ? 'jpg' : fmt === 'webp' ? 'webp' : 'bin';
  const tmpIn = `${dstPng}.incoming.${ext}`;
  fs.writeFileSync(tmpIn, buf);
  const input = fmt === 'jpeg' ? `JPEG:${tmpIn}` : fmt === 'webp' ? `WEBP:${tmpIn}` : tmpIn;
  const ok = spawnSync(magick, [input, '-strip', `PNG32:${dstPng}`], { encoding: 'utf8' }).status === 0;
  try {
    fs.unlinkSync(tmpIn);
  } catch {
    /* ignore */
  }
  if (!ok) fs.writeFileSync(dstPng, buf);
  return ok;
}

function rembgRemove(python: string | null, src: string, dst: string): boolean {
  const py = resolveRembgPython();
  if (!py || python !== py) return false;
  const script = path.join(CWD, 'docker/rembg-remove.py');
  if (!fs.existsSync(script)) return false;
  const result = spawnSync(py, [script, src, dst], {
    encoding: 'utf8',
    env: {
      ...process.env,
      U2NET_HOME: process.env.U2NET_HOME || path.join(CWD, '.u2net'),
      NUMBA_CACHE_DIR: process.env.NUMBA_CACHE_DIR || path.join(TMP, 'numba'),
    },
  });
  if (result.status !== 0) {
    console.error('[imagePipeline] rembg:', (result.stderr || result.stdout || '').trim().slice(0, 300));
    return false;
  }
  return true;
}

function magickWhiteToAlpha(magick: string, src: string, dst: string, fuzz = WHITE_FUZZ): boolean {
  const result = spawnSync(
    magick,
    [src, '-alpha', 'set', '-channel', 'RGBA', '-fuzz', fuzz, '-fill', 'none', '-opaque', 'white', `PNG32:${dst}`],
    { encoding: 'utf8' },
  );
  return result.status === 0;
}

/** Business plaques only — agent emblems/icons use magickWhiteToAlpha instead. */
function magickChromaToAlpha(
  magick: string,
  src: string,
  dst: string,
  color = PLAQUE_CHROMA_COLOR,
  fuzz = PLAQUE_CHROMA_FUZZ,
): boolean {
  const result = spawnSync(
    magick,
    [src, '-alpha', 'set', '-channel', 'RGBA', '-fuzz', fuzz, '-fill', 'none', '-opaque', color, `PNG32:${dst}`],
    { encoding: 'utf8' },
  );
  return result.status === 0;
}

/** Alpha bounding box after emblem white key — detects rembg wing/top crop. */
function measureEmblemAlphaBox(
  magick: string,
  src: string,
  fuzz = EMBLEM_WHITE_FUZZ,
): { w: number; h: number; x: number; y: number } | null {
  const result = spawnSync(
    magick,
    [
      src,
      '-alpha',
      'set',
      '-channel',
      'RGBA',
      '-fuzz',
      fuzz,
      '-fill',
      'none',
      '-opaque',
      'white',
      '-alpha',
      'extract',
      '-format',
      '%@',
      'info:',
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) return null;
  const m = (result.stdout || '').trim().match(/^(\d+)x(\d+)([+-]\d+)([+-]\d+)$/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  const x = Number(m[3]);
  const y = Number(m[4]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h, x, y };
}

/** True when rembg isolated the center sculpture and dropped wing span or clipped the top. */
function emblemRembgLooksCropped(magick: string, rawPath: string, rembgPath: string): boolean {
  const raw = measureEmblemAlphaBox(magick, rawPath);
  const rembg = measureEmblemAlphaBox(magick, rembgPath);
  if (!raw || !rembg) return true;
  const rawMax = Math.max(raw.w, raw.h);
  const rembgMax = Math.max(rembg.w, rembg.h);
  if (rawMax <= 0) return false;
  if (rembgMax / rawMax < EMBLEM_REMBG_MIN_RATIO) return true;
  if (rembg.h / raw.h < 0.88) return true;
  if (rembg.y < raw.y - 6) return true;
  return false;
}

/**
 * Sharp emblem pipeline (opt-in): pre white key → resize → post edge white key → alpha threshold.
 */
function magickEmblemPipelineSharp(
  magick: string,
  src: string,
  dst: string,
  outPx = 512,
  whiteFuzz = EMBLEM_SHARP_WHITE_FUZZ,
  postWhiteFuzz = EMBLEM_POST_WHITE_FUZZ,
  alphaThreshold = EMBLEM_ALPHA_THRESHOLD,
): boolean {
  const args: string[] = [
    src,
    '-alpha',
    'set',
    '-channel',
    'RGBA',
    '-fuzz',
    whiteFuzz,
    '-fill',
    'none',
    '-opaque',
    'white',
    '-background',
    'none',
    '-alpha',
    'background',
    '-gravity',
    'center',
    '-resize',
    `${outPx}x${outPx}`,
    '-extent',
    `${outPx}x${outPx}`,
  ];
  if (postWhiteFuzz && postWhiteFuzz !== '0%') {
    args.push('-channel', 'RGBA', '-fuzz', postWhiteFuzz, '-fill', 'none', '-opaque', 'white');
  }
  args.push(
    '(',
    '+clone',
    '-alpha',
    'extract',
    '-threshold',
    alphaThreshold,
    ')',
    '-alpha',
    'off',
    '-compose',
    'CopyOpacity',
    '-composite',
    `PNG32:${dst}`,
  );
  const result = spawnSync(magick, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error('[imagePipeline] emblem pipeline:', (result.stderr || result.stdout || '').trim().slice(0, 300));
  }
  return result.status === 0;
}

/** Icons: trim empty margins then scale down. Emblems: scale full frame — trim+extent alone center-crops wings off 2K renders. */
function magickNormalizeSquare(
  magick: string,
  src: string,
  dst: string,
  outPx = 512,
  kind: NormalizeKind = 'icon',
): boolean {
  const args =
    kind === 'emblem'
      ? [src, '-background', 'none', '-gravity', 'center', '-resize', `${outPx}x${outPx}`, '-extent', `${outPx}x${outPx}`, `PNG32:${dst}`]
      : [
          src,
          '-trim',
          '+repage',
          '-background',
          'none',
          '-gravity',
          'center',
          '-resize',
          `${outPx}x${outPx}`,
          '-extent',
          `${outPx}x${outPx}`,
          `PNG32:${dst}`,
        ];
  return spawnSync(magick, args, { encoding: 'utf8' }).status === 0;
}

function magickResizePortrait(magick: string, src: string, dst: string, w = 480, h = 600): boolean {
  return spawnSync(magick, [src, '-resize', `${w}x${h}!`, `PNG32:${dst}`], { encoding: 'utf8' }).status === 0;
}

function pilNormalizeSquare(
  python: string,
  src: string,
  dst: string,
  outPx = 512,
  kind: NormalizeKind = 'icon',
): boolean {
  const marginPct = kind === 'emblem' ? EMBLEM_MARGIN_PCT : 5;
  const bboxPadPct = kind === 'emblem' ? EMBLEM_BBOX_PAD_PCT : 0;
  const script = `
from PIL import Image
from pathlib import Path
s, d = Path(${JSON.stringify(src)}), Path(${JSON.stringify(dst)})
out_px = ${outPx}
margin_pct = ${marginPct}
bbox_pad_pct = ${bboxPadPct}
im = Image.open(s).convert("RGBA")
bbox = im.split()[-1].getbbox()
if not bbox:
    raise SystemExit("no opaque pixels")
x0, y0, x1, y1 = bbox
if bbox_pad_pct:
    pad = max(12, int(max(im.size) * bbox_pad_pct / 100))
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad)
    y1 = min(im.height, y1 + pad)
cropped = im.crop((x0, y0, x1, y1))
w, h = cropped.size
side = max(w, h)
margin = max(4, int(side * margin_pct / 100))
canvas = Image.new("RGBA", (side + margin * 2, side + margin * 2), (0, 0, 0, 0))
canvas.paste(cropped, (margin + (side - w) // 2, margin + (side - h) // 2), cropped)
canvas.resize((out_px, out_px), Image.Resampling.LANCZOS).save(d, format="PNG", optimize=True)
`;
  return spawnSync(python, ['-c', script], { encoding: 'utf8' }).status === 0;
}

function pilResize(python: string, src: string, dst: string, w = 480, h = 600): boolean {
  const script = `
from PIL import Image
from pathlib import Path
s, d = Path(${JSON.stringify(src)}), Path(${JSON.stringify(dst)})
Image.open(s).convert("RGB").resize((${w}, ${h}), Image.Resampling.LANCZOS).save(d, format="PNG", optimize=True)
`;
  return spawnSync(python, ['-c', script], { encoding: 'utf8' }).status === 0;
}

function writeTinyPlaceholderPng(dst: string): void {
  const px = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  fs.writeFileSync(dst, px);
}

/** Shape-only glyphs — Alpine ImageMagick often has no fonts, so -annotate fails silently. */
function drawPlaceholder(magick: string | null, kind: ImageKind, accent: string, _label: string, dst: string): boolean {
  if (!magick) {
    writeTinyPlaceholderPng(dst);
    return true;
  }
  const size = kind === 'portrait' ? '480x600' : '512x512';
  const args =
    kind === 'portrait'
      ? [
          '-size',
          size,
          'xc:#0a0f0c',
          '-fill',
          accent,
          '-stroke',
          accent,
          '-strokewidth',
          '8',
          '-draw',
          'circle 240,220 240,120',
          '-draw',
          'rectangle 160,320 320,520',
          dst,
        ]
      : [
          '-size',
          size,
          'xc:none',
          '-fill',
          `${accent}22`,
          '-stroke',
          accent,
          '-strokewidth',
          '10',
          '-draw',
          'roundrectangle 36,36 476,476 40,40',
          '-fill',
          accent,
          '-draw',
          'circle 256,256 256,140',
          dst,
        ];
  if (spawnSync(magick, args, { encoding: 'utf8' }).status === 0) return true;
  writeTinyPlaceholderPng(dst);
  return true;
}

async function geminiGenerate(
  prompt: string,
  aspect: '1:1' | '3:4',
): Promise<{ buf: Buffer | null; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { buf: null, error: 'No GEMINI_API_KEY' };
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    const imageConfig: Record<string, unknown> = { aspectRatio: aspect };
    if (MODEL.includes('gemini-3')) imageConfig.imageSize = IMAGE_SIZE;

    const run = async (): Promise<{ buf: Buffer | null; error?: string }> => {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { imageConfig },
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const data = (part as { inlineData?: { data?: string } }).inlineData?.data;
        if (data) return { buf: Buffer.from(data, 'base64') };
      }
      return { buf: null, error: 'Gemini returned no image bytes' };
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<{ buf: null; error: string }>((resolve) => {
      timer = setTimeout(
        () => resolve({ buf: null, error: `Gemini timed out after ${Math.round(GEMINI_TIMEOUT_MS / 1000)}s` }),
        GEMINI_TIMEOUT_MS,
      );
    });

    try {
      return await Promise.race([run(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[imagePipeline] Gemini error:', msg);
    return { buf: null, error: msg.slice(0, 200) };
  }
}

// ── Transparency pipelines (bifurcated: agent white-key vs business chroma-key) ─

type AlphaPipelineCtx = {
  slug: string;
  kind: ImageKind;
  magick: string | null;
  rembgPy: string | null;
  notes: string[];
};

/** Agent emblem classic path: rembg (wing crop guard) → white→alpha. Never uses plaque chroma. */
function runAgentEmblemAlphaPipeline(ctx: AlphaPipelineCtx, rawPath: string): string {
  let source = rawPath;
  if (EMBLEM_USE_REMBG && ctx.rembgPy) {
    const rembgPath = path.join(TMP, `${ctx.slug}-${ctx.kind}-rembg.png`);
    if (rembgRemove(ctx.rembgPy, rawPath, rembgPath)) {
      if (ctx.magick && emblemRembgLooksCropped(ctx.magick, rawPath, rembgPath)) {
        ctx.notes.push('rembg cropped wing span; using raw + magick.');
      } else {
        source = rembgPath;
      }
    } else {
      ctx.notes.push('rembg pass failed; continuing on raw.');
    }
  } else if (!ctx.rembgPy && EMBLEM_USE_REMBG) {
    ctx.notes.push('rembg venv not found; skipped AI bg removal.');
  }
  const alphaPath = path.join(TMP, `${ctx.slug}-${ctx.kind}-alpha.png`);
  if (ctx.magick && magickWhiteToAlpha(ctx.magick, source, alphaPath, EMBLEM_WHITE_FUZZ)) {
    return alphaPath;
  }
  if (ctx.magick) ctx.notes.push('ImageMagick white→alpha failed (check imagemagick-jpeg).');
  return source;
}

/** Agent icon: rembg → white→alpha. Never uses plaque chroma. */
function runAgentIconAlphaPipeline(ctx: AlphaPipelineCtx, rawPath: string): string {
  let source = rawPath;
  if (ctx.rembgPy) {
    const rembgPath = path.join(TMP, `${ctx.slug}-${ctx.kind}-rembg.png`);
    if (rembgRemove(ctx.rembgPy, source, rembgPath)) source = rembgPath;
    else ctx.notes.push('rembg pass failed; continuing.');
  }
  const alphaPath = path.join(TMP, `${ctx.slug}-${ctx.kind}-alpha.png`);
  if (ctx.magick && magickWhiteToAlpha(ctx.magick, source, alphaPath, WHITE_FUZZ)) {
    return alphaPath;
  }
  if (ctx.magick) ctx.notes.push('ImageMagick white→alpha failed (check imagemagick-jpeg).');
  else ctx.notes.push('ImageMagick not found; skipped white→alpha.');
  return source;
}

/** Business plaque: rembg → chroma→alpha (parallel to icon white→alpha, different key color). */
function runBusinessPlaqueAlphaPipeline(ctx: AlphaPipelineCtx, rawPath: string): string {
  let source = rawPath;
  if (ctx.rembgPy) {
    const rembgPath = path.join(TMP, `${ctx.slug}-plaque-rembg.png`);
    if (rembgRemove(ctx.rembgPy, source, rembgPath)) source = rembgPath;
    else ctx.notes.push('rembg pass failed; continuing.');
  }
  const alphaPath = path.join(TMP, `${ctx.slug}-plaque-alpha.png`);
  if (ctx.magick && magickChromaToAlpha(ctx.magick, source, alphaPath)) {
    ctx.notes.push(`plaque chroma key ${PLAQUE_CHROMA_COLOR} fuzz ${PLAQUE_CHROMA_FUZZ}`);
    return alphaPath;
  }
  if (ctx.magick) ctx.notes.push('ImageMagick chroma→alpha failed (check imagemagick-jpeg).');
  else ctx.notes.push('ImageMagick not found; skipped chroma→alpha.');
  return source;
}

export async function generateAgentImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  /** Agent assets only — prompts from image.emblem.* / image.icon.*; white-key pipelines above. */
  const notes: string[] = [];
  const outDir = path.join(DATA_AGENTS, input.slug);
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const finalPath = path.join(outDir, `${input.kind}.png`);
  const webPath = `/agents/${input.slug}/${input.kind}.png`;
  const rawPath = path.join(TMP, `${input.slug}-${input.kind}-raw.png`);

  const python = findPython();
  const rembgPy = resolveRembgPython();
  const magick = findMagick();

  const { prompt, aspect } = buildAgentImagePrompt(input);
  const { buf, error: geminiError } = await geminiGenerate(prompt, aspect);

  if (!buf) {
    notes.push(geminiError ? `${geminiError}; used placeholder.` : 'Used placeholder.');
    drawPlaceholder(magick, input.kind, input.accent, input.subject, finalPath);
    return { webPath, generated: false, notes };
  }

  if (!ensurePngRaw(magick, buf, rawPath)) {
    notes.push('Could not decode Gemini bytes to PNG; transparency pipeline may fail.');
  }

  if (input.kind === 'portrait') {
    if (magick && magickResizePortrait(magick, rawPath, finalPath)) {
      return { webPath, generated: true, notes };
    }
    if (python && pilResize(python, rawPath, finalPath)) {
      return { webPath, generated: true, notes };
    }
    fs.copyFileSync(rawPath, finalPath);
    notes.push('Portrait resize fallback (raw copy).');
    return { webPath, generated: true, notes };
  }

  // emblem → classic (May 2026) or sharp (magick defringe) — white key only
  if (input.kind === 'emblem') {
    const pipeCtx: AlphaPipelineCtx = { slug: input.slug, kind: 'emblem', magick, rembgPy, notes };
    if (EMBLEM_PIPELINE === 'sharp') {
      if (magick && magickEmblemPipelineSharp(magick, rawPath, finalPath)) {
        notes.push(
          `emblem sharp: white ${EMBLEM_SHARP_WHITE_FUZZ}, post ${EMBLEM_POST_WHITE_FUZZ}, alpha ${EMBLEM_ALPHA_THRESHOLD}`,
        );
        return { webPath, generated: true, notes };
      }
      if (magick) notes.push('ImageMagick sharp emblem pipeline failed.');
    } else {
      const source = runAgentEmblemAlphaPipeline(pipeCtx, rawPath);
      if (python && pilNormalizeSquare(python, source, finalPath, 512, 'emblem')) {
        notes.push(`emblem classic: rembg=${source.includes('-rembg')}, fuzz ${EMBLEM_WHITE_FUZZ}, PIL trim`);
        return { webPath, generated: true, notes };
      }
      if (magick && magickNormalizeSquare(magick, source, finalPath, 512, 'emblem')) {
        notes.push('emblem classic PIL unavailable; full-frame magick normalize.');
        return { webPath, generated: true, notes };
      }
    }
    if (python && pilNormalizeSquare(python, rawPath, finalPath, 512, 'emblem')) {
      notes.push('emblem PIL fallback (raw).');
      return { webPath, generated: true, notes };
    }
    fs.copyFileSync(rawPath, finalPath);
    notes.push('Emblem normalize skipped; saved raw PNG.');
    return { webPath, generated: true, notes };
  }

  const iconCtx: AlphaPipelineCtx = { slug: input.slug, kind: 'icon', magick, rembgPy, notes };
  const source = runAgentIconAlphaPipeline(iconCtx, rawPath);
  if (magick && magickNormalizeSquare(magick, source, finalPath, 512, input.kind)) {
    return { webPath, generated: true, notes };
  }
  if (python && pilNormalizeSquare(python, source, finalPath, 512, input.kind)) {
    return { webPath, generated: true, notes };
  }
  fs.copyFileSync(source, finalPath);
  if (!magick && !python) notes.push('Normalize skipped; saved intermediate PNG.');
  return { webPath, generated: true, notes };
}

// ── Business plaque (image.business.* prompts + chroma pipeline only) ─────────

export type GenerateBusinessPlaqueInput = {
  slug: string;
  subject: string;
  accent: string;
  businessName: string;
  businessContext: string;
};

function buildBusinessPlaquePrompt(input: GenerateBusinessPlaqueInput): string {
  return applyPromptTemplate(getPromptContent('image.business.plaque_template'), {
    plaque_chroma_bg: getPromptContent('image.business.plaque_chroma_bg'),
    business_plaque_base: applyPromptTemplate(getPromptContent('image.business.plaque_base'), {
      accent: input.accent,
    }),
    business_plaque_forbidden: getPromptContent('image.business.plaque_forbidden'),
    accent: input.accent,
    subject: input.subject,
    business_name: input.businessName,
    business_context: input.businessContext,
  });
}

/** Gemini sector plaque — image.business.* prompts + chroma pipeline only (not generateAgentImage). */
export async function generateBusinessPlaque(input: GenerateBusinessPlaqueInput): Promise<GenerateImageResult> {
  const notes: string[] = [];
  const outDir = path.join(DATA_BUSINESSES, input.slug);
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const finalPath = path.join(outDir, 'plaque.png');
  const webPath = `/businesses/${input.slug}/plaque.png`;
  const rawPath = path.join(TMP, `${input.slug}-plaque-raw.png`);

  const python = findPython();
  const rembgPy = resolveRembgPython();
  const magick = findMagick();

  const prompt = buildBusinessPlaquePrompt(input);
  console.log(`[imagePipeline] business plaque start slug=${input.slug}`);
  const { buf, error: geminiError } = await geminiGenerate(prompt, '1:1');

  if (!buf) {
    notes.push(geminiError ? `${geminiError}; used placeholder.` : 'Used placeholder.');
    console.warn(`[imagePipeline] business plaque placeholder slug=${input.slug}: ${notes.join(' ')}`);
    drawPlaceholder(magick, 'icon', input.accent, input.subject, finalPath);
    return { webPath, generated: false, notes };
  }

  if (!ensurePngRaw(magick, buf, rawPath)) {
    notes.push('Could not decode Gemini bytes to PNG; transparency pipeline may fail.');
  }

  const pipeCtx: AlphaPipelineCtx = { slug: input.slug, kind: 'icon', magick, rembgPy, notes };
  const source = runBusinessPlaqueAlphaPipeline(pipeCtx, rawPath);
  if (magick && magickNormalizeSquare(magick, source, finalPath, 512, 'plaque')) {
    console.log(`[imagePipeline] business plaque ok slug=${input.slug} path=${webPath}`);
    return { webPath, generated: true, notes };
  }
  if (python && pilNormalizeSquare(python, source, finalPath, 512, 'plaque')) {
    console.log(`[imagePipeline] business plaque ok slug=${input.slug} path=${webPath} (PIL)`);
    return { webPath, generated: true, notes };
  }
  fs.copyFileSync(source, finalPath);
  if (!magick && !python) notes.push('Normalize skipped; saved intermediate PNG.');
  return { webPath, generated: true, notes };
}

export function imageToolingStatus(): { gemini: boolean; rembg: boolean; magick: boolean; python: boolean } {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    rembg: !!resolveRembgPython(),
    magick: !!findMagick(),
    python: !!findPython(),
  };
}
