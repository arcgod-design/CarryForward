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
  `CREATE TABLE nodes(
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     type TEXT NOT NULL,
     title TEXT NOT NULL,
     content TEXT NOT NULL,
     status TEXT NOT NULL,
     origin TEXT NOT NULL,
     approved_by TEXT,
     approved_at TEXT,
     supersedes TEXT,
     user_touched INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE evidence(
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
     source_path TEXT NOT NULL,
     start_line INTEGER NOT NULL,
     end_line INTEGER NOT NULL,
     excerpt TEXT NOT NULL,
     classification TEXT NOT NULL,
     observed_at TEXT NOT NULL,
     confidence TEXT NOT NULL
   );
   CREATE TABLE edges(
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     source_node TEXT NOT NULL,
     target_node TEXT NOT NULL,
     relation TEXT NOT NULL,
     status TEXT NOT NULL,
     evidence_id TEXT,
     origin TEXT NOT NULL
   );
   CREATE INDEX idx_nodes_project ON nodes(project_id);
   CREATE INDEX idx_evidence_node ON evidence(node_id);
   CREATE INDEX idx_edges_project ON edges(project_id);`,
  `CREATE TABLE history(
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     entity_type TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     action TEXT NOT NULL,
     actor TEXT NOT NULL,
     detail TEXT NOT NULL,
     at TEXT NOT NULL
   );
   CREATE INDEX idx_history_project ON history(project_id);`,
  `CREATE TABLE packs(
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     generated_at TEXT NOT NULL,
     content TEXT NOT NULL,
     source_fingerprint TEXT NOT NULL,
     format TEXT NOT NULL
   );
   CREATE INDEX idx_packs_project ON packs(project_id);`,
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

export function migrationCount(): number {
  return MIGRATIONS.length;
}
