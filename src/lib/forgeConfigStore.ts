import {
  FORGE_PROMPT_DEFS,
  FORGE_PROMPT_KEYS,
  type ForgePromptKey,
  getPromptDef,
} from '@/lib/forgePrompts';
import { getDefaultPromptContent } from '@/lib/forgePromptDefaults';
import {
  clampReadoutStopRatio,
  clampTextFillRandomMaxMs,
  DEFAULT_FORGE_UI_SETTINGS,
  FORGE_UI_SETTINGS_DB_KEY,
  normalizeForgeUiSettings,
  type ForgeUiSettings,
} from '@/lib/forgeUiSettings';
import { getDb } from '@/lib/db';

export type ForgePromptRecord = {
  key: ForgePromptKey;
  label: string;
  category: string;
  categoryLabel: string;
  description: string;
  placeholders: string[];
  format: 'markdown' | 'text';
  content: string;
  defaultContent: string;
  isCustomized: boolean;
  updatedAt: number | null;
};

function ensureConfigTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS forge_config (
      key         TEXT PRIMARY KEY,
      content     TEXT NOT NULL,
      updated_at  INTEGER NOT NULL
    );
  `);
}

export function getPromptContent(key: ForgePromptKey): string {
  ensureConfigTable();
  const row = getDb()
    .prepare('SELECT content FROM forge_config WHERE key = ?')
    .get(key) as { content: string } | undefined;
  return row?.content ?? getDefaultPromptContent(key);
}

export function setPromptContent(key: ForgePromptKey, content: string): void {
  if (!FORGE_PROMPT_KEYS.includes(key)) {
    throw new Error(`Unknown prompt key: ${key}`);
  }
  ensureConfigTable();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO forge_config (key, content, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    )
    .run(key, content, now);
}

export function resetPromptContent(key: ForgePromptKey): void {
  ensureConfigTable();
  getDb().prepare('DELETE FROM forge_config WHERE key = ?').run(key);
}

export function resetAllPromptContent(): void {
  ensureConfigTable();
  getDb().prepare('DELETE FROM forge_config').run();
}

export function listPromptRecords(): ForgePromptRecord[] {
  ensureConfigTable();
  const rows = getDb()
    .prepare('SELECT key, content, updated_at FROM forge_config')
    .all() as { key: string; content: string; updated_at: number }[];
  const overrideMap = new Map(rows.map((r) => [r.key, r]));

  return FORGE_PROMPT_DEFS.map((def) => {
    const override = overrideMap.get(def.key);
    const defaultContent = getDefaultPromptContent(def.key);
    return {
      key: def.key,
      label: def.label,
      category: def.category,
      categoryLabel: def.categoryLabel,
      description: def.description,
      placeholders: def.placeholders,
      format: def.format,
      content: override?.content ?? defaultContent,
      defaultContent,
      isCustomized: !!override,
      updatedAt: override?.updated_at ?? null,
    };
  });
}

export function getPromptRecord(key: ForgePromptKey): ForgePromptRecord | null {
  const def = getPromptDef(key);
  if (!def) return null;
  ensureConfigTable();
  const override = getDb()
    .prepare('SELECT content, updated_at FROM forge_config WHERE key = ?')
    .get(key) as { content: string; updated_at: number } | undefined;
  const defaultContent = getDefaultPromptContent(key);
  return {
    key: def.key,
    label: def.label,
    category: def.category,
    categoryLabel: def.categoryLabel,
    description: def.description,
    placeholders: def.placeholders,
    format: def.format,
    content: override?.content ?? defaultContent,
    defaultContent,
    isCustomized: !!override,
    updatedAt: override?.updated_at ?? null,
  };
}

export function getMetaSkillsBundle(): string {
  const parts = [
    { file: '01-agent-architect.skill.md', key: 'skills.agent_architect' as const },
    { file: '02-skill-file-author.skill.md', key: 'skills.skill_file_author' as const },
    { file: '03-visual-identity.skill.md', key: 'skills.visual_identity' as const },
  ];
  return parts
    .map(({ file, key }) => `\n\n===== ${file} =====\n${getPromptContent(key)}`)
    .join('');
}

export function getUiSettings(): ForgeUiSettings {
  ensureConfigTable();
  const row = getDb()
    .prepare('SELECT content FROM forge_config WHERE key = ?')
    .get(FORGE_UI_SETTINGS_DB_KEY) as { content: string } | undefined;
  if (!row) return { ...DEFAULT_FORGE_UI_SETTINGS };
  try {
    const parsed = JSON.parse(row.content) as Partial<ForgeUiSettings> & { textStaggerEnabled?: boolean };
    return normalizeForgeUiSettings(parsed);
  } catch {
    return { ...DEFAULT_FORGE_UI_SETTINGS };
  }
}

export function setUiSettings(partial: Partial<ForgeUiSettings>): ForgeUiSettings {
  const current = getUiSettings();
  const next: ForgeUiSettings = {
    ...current,
    ...partial,
    typeReadoutStopRatio:
      partial.typeReadoutStopRatio != null
        ? clampReadoutStopRatio(partial.typeReadoutStopRatio)
        : current.typeReadoutStopRatio,
    textFillRandomMaxMs:
      partial.textFillRandomMaxMs != null
        ? clampTextFillRandomMaxMs(partial.textFillRandomMaxMs)
        : current.textFillRandomMaxMs,
  };
  ensureConfigTable();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO forge_config (key, content, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    )
    .run(FORGE_UI_SETTINGS_DB_KEY, JSON.stringify(next), now);
  return next;
}
