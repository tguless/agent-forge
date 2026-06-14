import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { CAPACITIES, APP_TYPES } from './catalogSeed';

/**
 * Single shared SQLite connection. Stored under agent-forge/data/forge.db.
 * Schema is created on first import (idempotent).
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.FORGE_DB_PATH || path.join(DATA_DIR, 'forge.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      slug             TEXT PRIMARY KEY,
      title            TEXT NOT NULL DEFAULT '',
      status           TEXT NOT NULL DEFAULT 'queued',
      data             TEXT NOT NULL DEFAULT '{}',
      skill_markdown   TEXT NOT NULL DEFAULT '',
      business_context TEXT NOT NULL DEFAULT '',
      job_description  TEXT NOT NULL DEFAULT '',
      error            TEXT,
      created_at       INTEGER NOT NULL,
      updated_at       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_events (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      slug    TEXT NOT NULL,
      ts      INTEGER NOT NULL,
      type    TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (slug) REFERENCES agents(slug) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_slug ON generation_events(slug, id);

    -- Multi-turn timeline for ToolLoopAgent runs (consulting + forge).
    -- scope_type/scope_slug let one table serve both businesses and agents.
    CREATE TABLE IF NOT EXISTS agent_turns (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      scope_type  TEXT NOT NULL,            -- 'business' | 'agent'
      scope_slug  TEXT NOT NULL,
      turn_index  INTEGER NOT NULL,
      role        TEXT NOT NULL,            -- 'AGENT' | 'TOOL' | 'SYSTEM'
      turn_type   TEXT NOT NULL,            -- THINKING|TOOL_CALL|TOOL_RESULT|MESSAGE|COMPLETE|ERROR
      content     TEXT,
      tool_name   TEXT,
      tool_input  TEXT,                     -- JSON
      tool_output TEXT,                     -- JSON
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_turns_scope ON agent_turns(scope_type, scope_slug, id);

    -- ── Business blueprint layer ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS businesses (
      slug           TEXT PRIMARY KEY,
      name           TEXT NOT NULL DEFAULT '',
      description    TEXT NOT NULL DEFAULT '',
      profile        TEXT NOT NULL DEFAULT '{}',
      status         TEXT NOT NULL DEFAULT 'queued',
      is_placeholder INTEGER NOT NULL DEFAULT 0,
      error          TEXT,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );

    -- Controlled vocabulary: master capacity superset.
    CREATE TABLE IF NOT EXISTS capacities (
      key         TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_types (
      key         TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );

    -- Per-type allowed capacities; master list = SELECT DISTINCT capacity_key.
    CREATE TABLE IF NOT EXISTS app_type_capacities (
      app_type_key TEXT NOT NULL REFERENCES app_types(key) ON DELETE CASCADE,
      capacity_key TEXT NOT NULL REFERENCES capacities(key) ON DELETE CASCADE,
      PRIMARY KEY (app_type_key, capacity_key)
    );

    CREATE TABLE IF NOT EXISTS apps (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      app_type_key TEXT NOT NULL REFERENCES app_types(key),
      kind         TEXT NOT NULL,            -- 'saas' | 'oss'
      website      TEXT,
      description  TEXT NOT NULL DEFAULT '',
      is_seed      INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS business_apps (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      business_slug   TEXT NOT NULL REFERENCES businesses(slug) ON DELETE CASCADE,
      app_type_key    TEXT NOT NULL REFERENCES app_types(key),
      app_id          INTEGER NOT NULL REFERENCES apps(id),
      is_agent_default INTEGER NOT NULL DEFAULT 0,
      is_selected     INTEGER NOT NULL DEFAULT 0,
      rationale       TEXT NOT NULL DEFAULT '',
      UNIQUE (business_slug, app_id)
    );

    CREATE INDEX IF NOT EXISTS idx_business_apps ON business_apps(business_slug, app_type_key);

    CREATE TABLE IF NOT EXISTS business_roles (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      business_slug    TEXT NOT NULL REFERENCES businesses(slug) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      business_context TEXT NOT NULL DEFAULT '',
      job_description  TEXT NOT NULL DEFAULT '',
      authority_hint   INTEGER NOT NULL DEFAULT 3,
      rationale        TEXT NOT NULL DEFAULT '',
      status           TEXT NOT NULL DEFAULT 'suggested',
      agent_slug       TEXT,
      created_at       INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_business_roles ON business_roles(business_slug, id);

    -- The access grid: agent × app × capacity.
    CREATE TABLE IF NOT EXISTS agent_app_access (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_slug   TEXT NOT NULL REFERENCES agents(slug) ON DELETE CASCADE,
      app_id       INTEGER NOT NULL REFERENCES apps(id),
      capacity_key TEXT NOT NULL REFERENCES capacities(key),
      rationale    TEXT NOT NULL DEFAULT '',
      UNIQUE (agent_slug, app_id, capacity_key)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_access ON agent_app_access(agent_slug);
  `);

  migrateAgentsBusinessSlug(db);
  seedCatalog(db);

  _db = db;
  return db;
}

/** Guarded migration: add agents.business_slug to pre-existing forge.db files. */
function migrateAgentsBusinessSlug(db: Database.Database): void {
  const cols = db.prepare(`PRAGMA table_info(agents)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === 'business_slug')) {
    db.exec(`ALTER TABLE agents ADD COLUMN business_slug TEXT;`);
  }
}

/** Idempotent catalog seed: only inserts rows that are missing (by key/slug). */
function seedCatalog(db: Database.Database): void {
  const now = Date.now();

  const insCapacity = db.prepare(
    `INSERT OR IGNORE INTO capacities (key, label, description, sort_order) VALUES (?, ?, ?, ?)`,
  );
  CAPACITIES.forEach((c, i) => insCapacity.run(c.key, c.label, c.description, i));

  const insType = db.prepare(
    `INSERT OR IGNORE INTO app_types (key, label, description) VALUES (?, ?, ?)`,
  );
  const insTypeCap = db.prepare(
    `INSERT OR IGNORE INTO app_type_capacities (app_type_key, capacity_key) VALUES (?, ?)`,
  );
  const insApp = db.prepare(
    `INSERT OR IGNORE INTO apps (slug, name, app_type_key, kind, website, description, is_seed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
  );

  const seed = db.transaction(() => {
    for (const type of APP_TYPES) {
      insType.run(type.key, type.label, type.description);
      for (const cap of type.capacities) insTypeCap.run(type.key, cap);
      for (const app of type.apps) {
        insApp.run(app.slug, app.name, type.key, app.kind, app.website ?? null, app.description, now);
      }
    }
  });
  seed();
}
