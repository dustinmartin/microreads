import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(process.env.DATABASE_PATH || path.join(dbDir, "microread.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Auto-apply migrations if tables are missing
const tableCheck = sqlite.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
).get();
if (!tableCheck) {
  const migrationsDir = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsDir)) {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith(".sql"))
      .sort();
    for (const file of sqlFiles) {
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      const statements = sqlContent.split("--> statement-breakpoint");
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (trimmed) sqlite.exec(trimmed);
      }
    }
  }
}

export const db = drizzle(sqlite, { schema });

// Seed default settings on startup
import { seedDefaults } from "./seed";
seedDefaults();
