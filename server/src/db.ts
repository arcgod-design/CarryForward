import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let db: Database.Database | null = null;

export function dbPath(): string {
  return process.env.CF_DB_PATH || path.join(process.cwd(), "data", "carryforward.db");
}

export function getDb(): Database.Database {
  if (db) return db;
  const p = dbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  db = new Database(p);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

const MIGRATIONS: string[] = [
  `CREATE TABLE projects(
     id TEXT PRIMARY KEY,
     display_name TEXT NOT NULL,
     root_path TEXT NOT NULL UNIQUE,
     created_at TEXT NOT NULL,
     last_scan_at TEXT
   );
   CREATE TABLE source_files(
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     relative_path TEXT NOT NULL,
     size INTEGER NOT NULL DEFAULT 0,
     mtime TEXT,
     content_hash TEXT,
     parse_status TEXT NOT NULL,
     skip_reason TEXT,
     UNIQUE(project_id, relative_path)
   );`,
];

function migrate(database: Database.Database): void {
  const version = database.pragma("user_version", { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    database.exec(MIGRATIONS[i]);
  }
  if (version !== MIGRATIONS.length) {
    database.pragma(`user_version = ${MIGRATIONS.length}`);
  }
}
