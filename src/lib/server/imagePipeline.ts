/**
 * Visual asset generation for Agent Forge.
 *
 * Mirrors the PaperIQ operations asset scripts:
 *   1. Compose a prompt (icon / emblem / portrait) from agent details
 *   2. Generate via Gemini "Nano Banana" image model (@google/genai)
 *   3. Decode Gemini JPEG → PNG, then ImageMagick fuzz white→alpha → normalize
 *
 * rembg is available in Docker but skipped for icon/emblem: Gemini uses pure #FFFFFF
 * backgrounds and rembg isolates a single salient object (destroys winged plaques and
 * multi-part flat HUD glyphs). Icons use global fuzz white→alpha; emblems use 2% pre +
 * post-resize 3% white key, alpha-background resize, and 65% alpha threshold defringe.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';

export type ImageKind = 'icon' | 'emblem' | 'portrait';

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
const PUBLIC_AGENTS = path.join(CWD, 'public', 'agents');

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const IMAGE_SIZE = process.env.GEMINI_IMAGE_SIZE || '2K';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_IMAGE_TIMEOUT_MS || 600_000);
const WHITE_FUZZ = process.env.ICON_WHITE_FUZZ || '14%';
/** Pre-resize white key (2% clears Gemini bg without eating wing metal). */
const EMBLEM_WHITE_FUZZ = process.env.EMBLEM_WHITE_FUZZ || '2%';
/** Post-resize edge cleanup — catches halos introduced by downscale. */
const EMBLEM_POST_WHITE_FUZZ = process.env.EMBLEM_POST_WHITE_FUZZ || '3%';
/** Binarize alpha after resize to drop semi-transparent fringe (ghost noise on dark UI). */
const EMBLEM_ALPHA_THRESHOLD = process.env.EMBLEM_ALPHA_THRESHOLD || '65%';

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

function buildPrompt(input: GenerateImageInput): { prompt: string; aspect: '1:1' | '3:4' } {
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

/**
 * Emblem pipeline: pre white key → resize → post edge white key → alpha threshold defringe.
 */
function magickEmblemPipeline(
  magick: string,
  src: string,
  dst: string,
  outPx = 512,
  whiteFuzz = EMBLEM_WHITE_FUZZ,
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
  kind: ImageKind = 'icon',
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
  kind: ImageKind = 'icon',
): boolean {
  const script =
    kind === 'emblem'
      ? `
from PIL import Image
from pathlib import Path
s, d = Path(${JSON.stringify(src)}), Path(${JSON.stringify(dst)})
out_px = ${outPx}
white_min = 250  # ~2% fuzz vs #FFFFFF
post_white_min = 247  # ~3% post-resize edge pass
alpha_cut = 166  # 65% threshold
im = Image.open(s).convert("RGBA")
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        if r >= white_min and g >= white_min and b >= white_min:
            px[x, y] = (0, 0, 0, 0)
w, h = im.size
scale = min(out_px / w, out_px / h)
nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
im = im.resize((nw, nh), Image.Resampling.LANCZOS)
canvas = Image.new("RGBA", (out_px, out_px), (0, 0, 0, 0))
canvas.paste(im, ((out_px - nw) // 2, (out_px - nh) // 2), im)
px = canvas.load()
for y in range(out_px):
    for x in range(out_px):
        r, g, b, a = px[x, y]
        if r >= post_white_min and g >= post_white_min and b >= post_white_min:
            px[x, y] = (0, 0, 0, 0)
        elif a < alpha_cut:
            px[x, y] = (r, g, b, 0)
canvas.save(d, format="PNG", optimize=True)
`
      : `
from PIL import Image
from pathlib import Path
s, d = Path(${JSON.stringify(src)}), Path(${JSON.stringify(dst)})
im = Image.open(s).convert("RGBA")
bbox = im.split()[-1].getbbox()
if bbox: im = im.crop(bbox)
w, h = im.size
side = max(w, h); margin = max(4, int(side * 0.05))
canvas = Image.new("RGBA", (side + margin*2, side + margin*2), (0,0,0,0))
canvas.paste(im, (margin + (side - w)//2, margin + (side - h)//2), im)
canvas.resize((${outPx}, ${outPx}), Image.Resampling.LANCZOS).save(d, format="PNG", optimize=True)
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

export async function generateAgentImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const notes: string[] = [];
  const outDir = path.join(PUBLIC_AGENTS, input.slug);
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const finalPath = path.join(outDir, `${input.kind}.png`);
  const webPath = `/agents/${input.slug}/${input.kind}.png`;
  const rawPath = path.join(TMP, `${input.slug}-${input.kind}-raw.png`);

  const python = findPython();
  const rembgPy = resolveRembgPython();
  const magick = findMagick();

  const { prompt, aspect } = buildPrompt(input);
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

  // icon → white key + trim/normalize; emblem → single v2 pipeline (no rembg)
  if (input.kind === 'emblem') {
    if (magick && magickEmblemPipeline(magick, rawPath, finalPath)) {
      notes.push(
        `emblem: white ${EMBLEM_WHITE_FUZZ}, post ${EMBLEM_POST_WHITE_FUZZ}, alpha ${EMBLEM_ALPHA_THRESHOLD}`,
      );
      return { webPath, generated: true, notes };
    }
    if (magick) notes.push('ImageMagick emblem pipeline failed.');
    if (python && pilNormalizeSquare(python, rawPath, finalPath, 512, 'emblem')) {
      notes.push('emblem PIL fallback.');
      return { webPath, generated: true, notes };
    }
    fs.copyFileSync(rawPath, finalPath);
    notes.push('Emblem normalize skipped; saved raw PNG.');
    return { webPath, generated: true, notes };
  }

  let source = rawPath;
  if (magick) {
    const alphaPath = path.join(TMP, `${input.slug}-${input.kind}-alpha.png`);
    if (magickWhiteToAlpha(magick, source, alphaPath, WHITE_FUZZ)) {
      source = alphaPath;
    } else {
      notes.push('ImageMagick white→alpha failed (check imagemagick-jpeg).');
    }
  } else {
    notes.push('ImageMagick not found; skipped white→alpha.');
  }
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

export function imageToolingStatus(): { gemini: boolean; rembg: boolean; magick: boolean; python: boolean } {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    rembg: !!resolveRembgPython(),
    magick: !!findMagick(),
    python: !!findPython(),
  };
}
