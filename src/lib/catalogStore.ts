/**
 * Read/write access to the app catalog + controlled capacity vocabulary.
 * The consulting agent may extend the catalog (new apps, guarded new capacities).
 */
import { getDb } from './db';
import { slugify } from './slug';
import type { App, AppKind, AppType, Capacity } from './businessTypes';

type AppRow = {
  id: number;
  slug: string;
  name: string;
  app_type_key: string;
  kind: AppKind;
  website: string | null;
  description: string;
  is_seed: number;
};

function rowToApp(row: AppRow): App {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    appTypeKey: row.app_type_key,
    kind: row.kind,
    website: row.website ?? undefined,
    description: row.description,
    isSeed: !!row.is_seed,
  };
}

export function listCapacities(): Capacity[] {
  const rows = getDb()
    .prepare('SELECT key, label, description, sort_order FROM capacities ORDER BY sort_order ASC')
    .all() as { key: string; label: string; description: string; sort_order: number }[];
  return rows.map((r) => ({ key: r.key, label: r.label, description: r.description, sortOrder: r.sort_order }));
}

/** Capacity keys allowed for a given app type (the per-type subset). */
export function capacityKeysForAppType(appTypeKey: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT atc.capacity_key AS k
       FROM app_type_capacities atc
       JOIN capacities c ON c.key = atc.capacity_key
       WHERE atc.app_type_key = ?
       ORDER BY c.sort_order ASC`,
    )
    .all(appTypeKey) as { k: string }[];
  return rows.map((r) => r.k);
}

export function listAppTypes(): AppType[] {
  const rows = getDb()
    .prepare('SELECT key, label, description FROM app_types ORDER BY label ASC')
    .all() as { key: string; label: string; description: string }[];
  return rows.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    capacities: capacityKeysForAppType(t.key),
  }));
}

export function listApps(appTypeKey?: string): App[] {
  const db = getDb();
  const rows = appTypeKey
    ? (db.prepare('SELECT * FROM apps WHERE app_type_key = ? ORDER BY kind, name').all(appTypeKey) as AppRow[])
    : (db.prepare('SELECT * FROM apps ORDER BY app_type_key, kind, name').all() as AppRow[]);
  return rows.map(rowToApp);
}

export function getApp(id: number): App | null {
  const row = getDb().prepare('SELECT * FROM apps WHERE id = ?').get(id) as AppRow | undefined;
  return row ? rowToApp(row) : null;
}

export function getAppBySlug(slug: string): App | null {
  const row = getDb().prepare('SELECT * FROM apps WHERE slug = ?').get(slug) as AppRow | undefined;
  return row ? rowToApp(row) : null;
}

export function appTypeExists(key: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM app_types WHERE key = ?').get(key);
}

/** Ensure an app type exists (used when the agent references a new category). */
export function ensureAppType(key: string, label?: string, description = ''): string {
  const normalized = slugify(key);
  const db = getDb();
  if (!appTypeExists(normalized)) {
    db.prepare('INSERT INTO app_types (key, label, description) VALUES (?, ?, ?)').run(
      normalized,
      label || key,
      description,
    );
    // New types get the full master vocabulary as their allowed subset by default.
    const caps = listCapacities();
    const ins = db.prepare('INSERT OR IGNORE INTO app_type_capacities (app_type_key, capacity_key) VALUES (?, ?)');
    for (const c of caps) ins.run(normalized, c.key);
  }
  return normalized;
}

/** Find-or-create an app by name within a type (consulting agent extension point). */
export function upsertApp(input: {
  name: string;
  appTypeKey: string;
  kind: AppKind;
  website?: string;
  description?: string;
}): App {
  const db = getDb();
  const appTypeKey = ensureAppType(input.appTypeKey);
  const existingByName = db
    .prepare('SELECT * FROM apps WHERE app_type_key = ? AND lower(name) = lower(?)')
    .get(appTypeKey, input.name) as AppRow | undefined;
  if (existingByName) return rowToApp(existingByName);

  let slug = slugify(input.name);
  let n = 2;
  while (db.prepare('SELECT 1 FROM apps WHERE slug = ?').get(slug)) {
    slug = `${slugify(input.name)}-${n++}`;
  }
  const info = db
    .prepare(
      `INSERT INTO apps (slug, name, app_type_key, kind, website, description, is_seed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(slug, input.name, appTypeKey, input.kind, input.website ?? null, input.description ?? '', Date.now());
  return getApp(Number(info.lastInsertRowid))!;
}

/** Guarded capacity extension: add to the master superset + map to app types. */
export function ensureCapacity(input: {
  key: string;
  label: string;
  description?: string;
  appTypeKeys?: string[];
}): Capacity {
  const db = getDb();
  const key = slugify(input.key).replace(/-/g, '_');
  const exists = db.prepare('SELECT 1 FROM capacities WHERE key = ?').get(key);
  if (!exists) {
    const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM capacities').get() as { m: number };
    db.prepare('INSERT INTO capacities (key, label, description, sort_order) VALUES (?, ?, ?, ?)').run(
      key,
      input.label,
      input.description ?? '',
      max.m + 1,
    );
  }
  const ins = db.prepare('INSERT OR IGNORE INTO app_type_capacities (app_type_key, capacity_key) VALUES (?, ?)');
  for (const t of input.appTypeKeys ?? []) {
    if (appTypeExists(t)) ins.run(t, key);
  }
  return listCapacities().find((c) => c.key === key)!;
}
