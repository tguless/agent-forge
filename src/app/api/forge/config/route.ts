import { NextResponse } from 'next/server';
import {
  FORGE_PROMPT_KEYS,
  type ForgePromptKey,
} from '@/lib/forgePrompts';
import {
  getPromptRecord,
  listPromptRecords,
  resetAllPromptContent,
  resetPromptContent,
  setPromptContent,
} from '@/lib/forgeConfigStore';

export const dynamic = 'force-dynamic';

function isPromptKey(value: unknown): value is ForgePromptKey {
  return typeof value === 'string' && FORGE_PROMPT_KEYS.includes(value as ForgePromptKey);
}

export async function GET() {
  try {
    const prompts = listPromptRecords();
    return NextResponse.json({ prompts });
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
      return NextResponse.json({ ok: true, prompts: listPromptRecords() });
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
