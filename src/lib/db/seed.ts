import { db } from "./index";
import { settings } from "./schema";
import { sql } from "drizzle-orm";

const defaults: Record<string, string> = {
  send_time: "30 6 * * *",
  email_to: "",
  ollama_endpoint: "http://localhost:11434",
  ollama_model: "qwen2.5:7b",
};

export function seedDefaults() {
  for (const [key, value] of Object.entries(defaults)) {
    db.run(
      sql`INSERT OR IGNORE INTO ${settings} (${sql.raw("key")}, value) VALUES (${key}, ${JSON.stringify(value)})`
    );
  }
}
