/**
 * Visual asset generation for Agent Forge.
 *
 * Mirrors the PaperIQ operations asset scripts:
 *   1. Compose a prompt (icon / emblem / portrait) from agent details
 *   2. Generate via Gemini "Nano Banana" image model (@google/genai)
 *   3. Background removal: rembg (AI) → ImageMagick fuzz white→alpha → PIL normalize
 *
 * Everything degrades gracefully:
 *   - no GEMINI_API_KEY        → ImageMagick-drawn placeholder glyph
 *   - no rembg venv            → skip AI bg removal (magick + normalize still run)
 *   - no ImageMagick / Python  → write the raw/placeholder PNG as-is
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

// ── prompt fragments (lifted from PaperIQ asset scripts) ────────────────────

const WHITE_BG =
  'Pure flat white background #FFFFFF only, no gradients, no shadows on background, no border, no frame, no text, no watermark.';
const FILL_HINT =
  'The glyph must be VERY LARGE: fill 88-92% of the square canvas edge-to-edge, bold thick strokes, minimal empty margin, centered.';

const WINGED_PLAQUE =
  'Hyper-realistic 3D metal-organic military commander insignia plaque, IDENTICAL structural style to a Command and Conquer supreme winged commander badge: symmetrical large mechanical armored wings with layered gunmetal-teal metal plates, visible gears and pistons at wing roots, thick circular brushed gunmetal ring behind center sculpture, V-shaped metallic chevron base, dramatic cinematic rim lighting, polished metal with gold trim accents, micro-scratches, heavy dimensional depth.';
const EMBLEM_FORBIDDEN =
  'FORBIDDEN centerpiece: five-point star, generic star, eagle, sunburst, empty circle. FORBIDDEN: any text, words, letters, nameplate typography.';
const RANK_WINGS: Record<number, string> = {
  5: 'Wings: largest triple-layer wingspan (supreme commander rank).',
  4: 'Wings: large two-layer wings (executive commander rank), slightly smaller than supreme.',
  3: 'Wings: medium mechanical wings (field officer rank).',
};

const PORTRAIT_BASE =
  'Photorealistic cinematic portrait cosplay, Command and Conquer RTS commander character style like a Red Alert / Generals briefing screen. Upper body bust, facing camera, confident tactical expression. Dark olive-black background with faint green HUD grid. Dramatic rim lighting. No text, no logos, no watermark.';
const RANK_UNIFORM: Record<number, string> = {
  5: 'Supreme commander dress uniform: long coat, gold epaulettes, highest rank insignia, most ornate.',
  4: 'Executive officer jacket: structured shoulders, medium ornate rank bars, professional HQ commander.',
  3: 'Field officer tactical vest and fatigues: practical gear, compact rank patch, unit commander on deployment.',
};

function buildPrompt(input: GenerateImageInput): { prompt: string; aspect: '1:1' | '3:4' } {
  const authority = input.authority ?? 3;
  if (input.kind === 'icon') {
    return {
      aspect: '1:1',
      prompt: `${WHITE_BG} ${FILL_HINT} Single minimalist flat vector icon in color ${input.accent} only: ${input.subject}.`,
    };
  }
  if (input.kind === 'emblem') {
    return {
      aspect: '1:1',
      prompt: `${WHITE_BG.replace('no text, no watermark.', 'Single isolated 3D emblem object, centered, fills 90% of canvas.')} ${WINGED_PLAQUE} ${
        RANK_WINGS[authority] ?? RANK_WINGS[3]
      } Primary accent ${input.accent} on the center sculpture and wing highlights. CENTER SCULPTURE: ${input.subject} — this is the only center symbol, rendered in polished metal. ${EMBLEM_FORBIDDEN}`,
    };
  }
  return {
    aspect: '3:4',
    prompt: `${PORTRAIT_BASE} ${RANK_UNIFORM[authority] ?? RANK_UNIFORM[3]} Accent color ${input.accent} on uniform trim and holograms. ${input.subject} Unique individual — distinct face and styling.`,
  };
}

// ── tool detection ──────────────────────────────────────────────────────────

function resolveRembgPython(): string | null {
  const fromEnv = process.env.REMBG_PYTHON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
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
  for (const cmd of ['magick', '/opt/homebrew/bin/magick', '/usr/local/bin/magick']) {
    if (spawnSync(cmd, ['-version'], { encoding: 'utf8' }).status === 0) return cmd;
  }
  return null;
}

// ── pipeline steps ────────────────────────────────────────────────────────────

function rembgRemove(python: string | null, src: string, dst: string): boolean {
  const py = resolveRembgPython();
  if (!py || python !== py) return false; // only the rembg venv has the rembg package
  const script = `
from rembg import remove
from pathlib import Path
s, d = Path(${JSON.stringify(src)}), Path(${JSON.stringify(dst)})
d.write_bytes(remove(s.read_bytes()))
`;
  return spawnSync(py, ['-c', script], { encoding: 'utf8' }).status === 0;
}

function magickWhiteToAlpha(magick: string, src: string, dst: string): boolean {
  return (
    spawnSync(
      magick,
      [src, '-alpha', 'set', '-channel', 'RGBA', '-fuzz', WHITE_FUZZ, '-fill', 'none', '-opaque', 'white', dst],
      { encoding: 'utf8' },
    ).status === 0
  );
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

function drawPlaceholder(magick: string | null, kind: ImageKind, accent: string, label: string, dst: string): boolean {
  if (!magick) {
    // last-resort: 1x1 transparent pixel so the <img> doesn't 404
    const px = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    fs.writeFileSync(dst, px);
    return true;
  }
  const initial = (label.trim()[0] || 'A').toUpperCase();
  const size = kind === 'portrait' ? '480x600' : '512x512';
  const args =
    kind === 'portrait'
      ? ['-size', size, `xc:#0a0f0c`, '-fill', accent, '-gravity', 'center', '-pointsize', '240', '-annotate', '0', initial, dst]
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
          '-gravity',
          'center',
          '-fill',
          accent,
          '-pointsize',
          '230',
          '-annotate',
          '0',
          initial,
          dst,
        ];
  return spawnSync(magick, args, { encoding: 'utf8' }).status === 0;
}

async function geminiGenerate(prompt: string, aspect: '1:1' | '3:4'): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
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
      if (data) return Buffer.from(data, 'base64');
    }
    return null;
  } catch {
    return null;
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
  const buf = await geminiGenerate(prompt, aspect);

  if (!buf) {
    notes.push(process.env.GEMINI_API_KEY ? 'Gemini returned no image; used placeholder.' : 'No GEMINI_API_KEY; used placeholder.');
    drawPlaceholder(magick, input.kind, input.accent, input.subject, finalPath);
    return { webPath, generated: false, notes };
  }

  fs.writeFileSync(rawPath, buf);

  if (input.kind === 'portrait') {
    if (python && !pilResize(python, rawPath, finalPath)) fs.copyFileSync(rawPath, finalPath);
    else if (!python) fs.copyFileSync(rawPath, finalPath);
    return { webPath, generated: true, notes };
  }

  // icon / emblem → transparency pipeline
  let source = rawPath;
  if (rembgPy) {
    const rembgPath = path.join(TMP, `${input.slug}-${input.kind}-rembg.png`);
    if (rembgRemove(rembgPy, source, rembgPath)) source = rembgPath;
    else notes.push('rembg pass failed; continuing.');
  } else {
    notes.push('rembg venv not found; skipped AI bg removal.');
  }
  if (magick) {
    const alphaPath = path.join(TMP, `${input.slug}-${input.kind}-alpha.png`);
    if (magickWhiteToAlpha(magick, source, alphaPath)) source = alphaPath;
  } else {
    notes.push('ImageMagick not found; skipped white→alpha.');
  }
  if (python && pilNormalizeSquare(python, source, finalPath)) {
    return { webPath, generated: true, notes };
  }
  fs.copyFileSync(source, finalPath);
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
