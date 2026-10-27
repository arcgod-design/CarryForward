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
  `CREATE TABLE review_runs(
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     diff_source TEXT NOT NULL,
     created_at TEXT NOT NULL,
     files_reviewed TEXT NOT NULL,
     checks_run TEXT NOT NULL,
     summary TEXT NOT NULL,
     redactions TEXT NOT NULL DEFAULT '[]'
   );
   CREATE TABLE findings(
     id TEXT PRIMARY KEY,
     review_run_id TEXT NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     rule_node_id TEXT,
     rule_title TEXT,
     changed_path TEXT NOT NULL,
     changed_lines TEXT,
     kind TEXT NOT NULL,
     severity TEXT NOT NULL,
     certainty TEXT NOT NULL,
     explanation TEXT NOT NULL,
     rule_evidence TEXT,
     changed_evidence TEXT NOT NULL,
     recommendation TEXT NOT NULL,
     blocking INTEGER NOT NULL DEFAULT 0,
     disposition TEXT NOT NULL DEFAULT 'open'
   );
   CREATE INDEX idx_runs_project ON review_runs(project_id);
   CREATE INDEX idx_findings_run ON findings(review_run_id);`,
  `CREATE TABLE maintenance_flags(
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     node_id TEXT NOT NULL,
     node_title TEXT NOT NULL,
     node_status TEXT NOT NULL,
     reason TEXT NOT NULL,
     side_a TEXT,
     side_b TEXT,
     signature TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'open',
     resolution_note TEXT,
     created_at TEXT NOT NULL
   );
   CREATE INDEX idx_flags_project ON maintenance_flags(project_id);
   ALTER TABLE evidence ADD COLUMN content_hash TEXT;`,
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
