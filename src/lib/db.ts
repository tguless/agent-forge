import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

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
  `);
  _db = db;
  return db;
}
