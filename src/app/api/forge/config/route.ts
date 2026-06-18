import { NextResponse } from 'next/server';
import {
  FORGE_PROMPT_KEYS,
  type ForgePromptKey,
} from '@/lib/forgePrompts';
import {
  getPromptRecord,
  getUiSettings,
  listPromptRecords,
  resetAllPromptContent,
  resetPromptContent,
  setPromptContent,
  setUiSettings,
} from '@/lib/forgeConfigStore';
import {
  clampReadoutStopRatio,
  clampTextFillRandomMaxMs,
  isTextFillTiming,
  type ForgeUiSettings,
} from '@/lib/forgeUiSettings';

export const dynamic = 'force-dynamic';

function isPromptKey(value: unknown): value is ForgePromptKey {
  return typeof value === 'string' && FORGE_PROMPT_KEYS.includes(value as ForgePromptKey);
}

export async function GET() {
  try {
    const prompts = listPromptRecords();
    const ui = getUiSettings();
    return NextResponse.json({ prompts, ui });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { key?: unknown; content?: unknown };
    if (!isPromptKey(body.key)) {
      return NextResponse.json({ error: 'Invalid or missing prompt key.' }, { status: 400 });
    }
    if (typeof body.content !== 'string') {
      return NextResponse.json({ error: 'content must be a string.' }, { status: 400 });
    }
    setPromptContent(body.key, body.content);
    const record = getPromptRecord(body.key);
    return NextResponse.json({ prompt: record });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: unknown; key?: unknown };
    if (body.action === 'reset_all') {
      resetAllPromptContent();
      return NextResponse.json({ ok: true, prompts: listPromptRecords(), ui: getUiSettings() });
    }
    if (body.action === 'reset' && isPromptKey(body.key)) {
      resetPromptContent(body.key);
      const record = getPromptRecord(body.key);
      return NextResponse.json({ prompt: record });
    }
    return NextResponse.json({ error: 'Invalid reset request.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Partial<ForgeUiSettings> & {
      textStaggerEnabled?: unknown;
      soundsEnabled?: unknown;
    };
    const partial: Partial<ForgeUiSettings> = {};

    if (body.textStaggerEnabled !== undefined) {
      if (typeof body.textStaggerEnabled !== 'boolean') {
        return NextResponse.json({ error: 'textStaggerEnabled must be a boolean.' }, { status: 400 });
      }
      partial.textFillTiming = body.textStaggerEnabled ? 'stagger' : 'none';
    }

    if (body.textFillTiming !== undefined) {
      if (!isTextFillTiming(body.textFillTiming)) {
        return NextResponse.json({ error: 'textFillTiming must be none, stagger, or random.' }, { status: 400 });
      }
      partial.textFillTiming = body.textFillTiming;
    }

    if (body.textFillRandomMaxMs !== undefined) {
      if (typeof body.textFillRandomMaxMs !== 'number' || !Number.isFinite(body.textFillRandomMaxMs)) {
        return NextResponse.json({ error: 'textFillRandomMaxMs must be a number.' }, { status: 400 });
      }
      partial.textFillRandomMaxMs = clampTextFillRandomMaxMs(body.textFillRandomMaxMs);
    }

    if (body.typeReadoutStopRatio !== undefined) {
      if (typeof body.typeReadoutStopRatio !== 'number' || !Number.isFinite(body.typeReadoutStopRatio)) {
        return NextResponse.json({ error: 'typeReadoutStopRatio must be a number.' }, { status: 400 });
      }
      partial.typeReadoutStopRatio = clampReadoutStopRatio(body.typeReadoutStopRatio);
    }

    if (body.textFillSoundsEnabled !== undefined) {
      if (typeof body.textFillSoundsEnabled !== 'boolean') {
        return NextResponse.json({ error: 'textFillSoundsEnabled must be a boolean.' }, { status: 400 });
      }
      partial.textFillSoundsEnabled = body.textFillSoundsEnabled;
    }

    if (body.buttonSoundsEnabled !== undefined) {
      if (typeof body.buttonSoundsEnabled !== 'boolean') {
        return NextResponse.json({ error: 'buttonSoundsEnabled must be a boolean.' }, { status: 400 });
      }
      partial.buttonSoundsEnabled = body.buttonSoundsEnabled;
    }

    if (body.soundsEnabled !== undefined) {
      if (typeof body.soundsEnabled !== 'boolean') {
        return NextResponse.json({ error: 'soundsEnabled must be a boolean.' }, { status: 400 });
      }
      partial.textFillSoundsEnabled = body.soundsEnabled;
      partial.buttonSoundsEnabled = body.soundsEnabled;
    }

    if (Object.keys(partial).length === 0) {
      return NextResponse.json({ error: 'No valid UI settings provided.' }, { status: 400 });
    }

    const ui = setUiSettings(partial);
    return NextResponse.json({ ui });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
