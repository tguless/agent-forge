/**
 * Version history for any editable blueprint text section.
 */
import fs from 'node:fs';
import path from 'node:path';

const BUSINESSES_DIR = path.join(process.cwd(), 'data', 'businesses');

export type TextSectionVersionSource = 'agent_generated' | 'user_edit' | 'ai_rewrite';

export type TextSectionVersion = {
  version: number;
  at: string;
  content: string;
  source: TextSectionVersionSource;
  userInstructions?: string;
  llmModel?: string;
  changeSummary?: string;
};

export type TextSectionHistory = {
  storageKey: string;
  createdAt: string;
  updatedAt: string;
  versions: TextSectionVersion[];
};

/** Stable filesystem key from URL path segments, e.g. plan/executiveSummary → plan--executiveSummary */
export function textSectionStorageKey(pathSegments: string[]): string {
  return pathSegments.join('--');
}

function historyPath(slug: string, storageKey: string): string {
  return path.join(BUSINESSES_DIR, slug, 'text-versions', `${storageKey}.json`);
}

/** Legacy plan-only path for backward compatibility. */
function legacyPlanHistoryPath(slug: string, planSectionKey: string): string {
  return path.join(BUSINESSES_DIR, slug, 'plan-versions', `${planSectionKey}.json`);
}

function readHistoryFile(abs: string, storageKey: string): TextSectionHistory | null {
  if (!fs.existsSync(abs)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as TextSectionHistory & { sectionKey?: string };
    return {
      storageKey: raw.storageKey ?? raw.sectionKey ?? storageKey,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      versions: raw.versions ?? [],
    };
  } catch {
    return null;
  }
}

export function readTextSectionHistory(slug: string, pathSegments: string[]): TextSectionHistory | null {
  const storageKey = textSectionStorageKey(pathSegments);
  const current = readHistoryFile(historyPath(slug, storageKey), storageKey);
  if (current) return current;

  if (pathSegments[0] === 'plan' && pathSegments.length === 2) {
    return readHistoryFile(legacyPlanHistoryPath(slug, pathSegments[1]), storageKey);
  }
  return null;
}

function writeTextSectionHistory(slug: string, history: TextSectionHistory): void {
  const abs = historyPath(slug, history.storageKey);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

export function appendTextSectionVersion(
  slug: string,
  pathSegments: string[],
  entry: Omit<TextSectionVersion, 'version' | 'at'>,
): TextSectionVersion {
  const storageKey = textSectionStorageKey(pathSegments);
  const now = new Date().toISOString();
  const existing = readTextSectionHistory(slug, pathSegments);
  const version = (existing?.versions.length ?? 0) + 1;

  const record: TextSectionVersion = {
    version,
    at: now,
    ...entry,
  };

  const history: TextSectionHistory = existing ?? {
    storageKey,
    createdAt: now,
    updatedAt: now,
    versions: [],
  };

  history.versions.push(record);
  history.updatedAt = now;
  writeTextSectionHistory(slug, history);
  return record;
}

export function listTextSectionVersions(slug: string, pathSegments: string[]): TextSectionVersion[] {
  const history = readTextSectionHistory(slug, pathSegments);
  if (!history) return [];
  return [...history.versions].reverse();
}
