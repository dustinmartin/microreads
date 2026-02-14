import cron, { type ScheduledTask } from "node-cron";
import { sendDailyDigest } from "@/lib/digest";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_CRON = "30 6 * * *";

let currentTask: ScheduledTask | null = null;

async function getSendTime(): Promise<string> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "send_time"))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row?.value) return DEFAULT_CRON;
  try {
    const parsed = JSON.parse(row.value);
    return typeof parsed === "string" ? parsed : DEFAULT_CRON;
  } catch {
    return row.value;
  }
}

export async function startCron(): Promise<ScheduledTask> {
  const expression = await getSendTime();

  const task = cron.schedule(expression, async () => {
    console.log(`[cron] Firing digest at ${new Date().toISOString()}`);
    try {
      const result = await sendDailyDigest();
      console.log("[cron] Digest result:", JSON.stringify(result));
    } catch (err) {
      console.error("[cron] Digest send failed:", err);
    }
  });

  currentTask = task;
  console.log(`Digest cron scheduled: ${expression}`);
  return task;
}

export async function rescheduleCron(): Promise<ScheduledTask> {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }
  return startCron();
}
