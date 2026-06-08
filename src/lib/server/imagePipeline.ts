/**
 * Visual asset generation for Agent Forge.
 *
 * Mirrors the PaperIQ operations asset scripts:
 *   1. Compose a prompt (icon / emblem / portrait) from agent details
 *   2. Generate via Gemini "Nano Banana" image model (@google/genai)
 *   3. Decode Gemini JPEG → PNG, then rembg (icons only) → ImageMagick fuzz white→alpha → normalize
 *
 * Everything degrades gracefully:
 *   - no GEMINI_API_KEY        → ImageMagick-drawn placeholder glyph
 *   - no rembg venv            → skip AI bg removal (Docker ships /app/.venv-rembg)
 *   - no ImageMagick / Python  → write the raw/placeholder PNG as-is
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
const WHITE_FUZZ = process.env.ICON_WHITE_FUZZ || '14%';
const EMBLEM_WHITE_FUZZ = process.env.EMBLEM_WHITE_FUZZ || '10%';

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
    [src, '-alpha', 'set', '-channel', 'RGBA', '-fuzz', WHITE_FUZZ, '-fill', 'none', '-opaque', 'white', `PNG32:${dst}`],
    { encoding: 'utf8' },
  );
  return result.status === 0;
}

function magickNormalizeSquare(magick: string, src: string, dst: string, outPx = 512): boolean {
  return (
    spawnSync(
      magick,
      [src, '-trim', '+repage', '-background', 'none', '-gravity', 'center', '-extent', `${outPx}x${outPx}`, `PNG32:${dst}`],
      { encoding: 'utf8' },
    ).status === 0
  );
}

function magickResizePortrait(magick: string, src: string, dst: string, w = 480, h = 600): boolean {
  return spawnSync(magick, [src, '-resize', `${w}x${h}!`, `PNG32:${dst}`], { encoding: 'utf8' }).status === 0;
}

function pilNormalizeSquare(python: string, src: string, dst: string, outPx = 512): boolean {
  const script = `
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

  // icon / emblem → transparency pipeline
  let source = rawPath;
  // rembg isolates the salient foreground object — fine for flat icons, but it crops
  // winged emblem plaques down to the center sculpture only. Emblems use white→alpha.
  if (rembgPy && input.kind === 'icon') {
    const rembgPath = path.join(TMP, `${input.slug}-${input.kind}-rembg.png`);
    if (rembgRemove(rembgPy, source, rembgPath)) source = rembgPath;
    else notes.push('rembg pass failed; continuing.');
  } else if (input.kind === 'emblem') {
    notes.push('emblem: skipped rembg (preserves winged plaque).');
  } else {
    notes.push('rembg venv not found; skipped AI bg removal.');
  }
  if (magick) {
    const alphaPath = path.join(TMP, `${input.slug}-${input.kind}-alpha.png`);
    const fuzz = input.kind === 'emblem' ? EMBLEM_WHITE_FUZZ : WHITE_FUZZ;
    if (magickWhiteToAlpha(magick, source, alphaPath, fuzz)) {
      source = alphaPath;
    } else {
      notes.push('ImageMagick white→alpha failed (check imagemagick-jpeg).');
    }
  } else {
    notes.push('ImageMagick not found; skipped white→alpha.');
  }
  if (magick && magickNormalizeSquare(magick, source, finalPath)) {
    return { webPath, generated: true, notes };
  }
  if (python && pilNormalizeSquare(python, source, finalPath)) {
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
