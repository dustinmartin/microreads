import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export default function globalSetup() {
  const projectRoot = path.join(__dirname, "..");
  const dbPath = path.join(projectRoot, "data", "test-microread.db");
  const migrationsDir = path.join(projectRoot, "drizzle");

  // Ensure data directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Delete existing test database for a clean slate
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const f = dbPath + suffix;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Apply all migration SQL files in order
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of sqlFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    const statements = sql.split("--> statement-breakpoint");
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        db.exec(trimmed);
      }
    }
  }

  console.log(`Test database ready at ${dbPath} (${sqlFiles.length} migration(s)).`);
  db.close();
}
