import fs from "node:fs/promises";
import path from "node:path";
import { readPlatformSettings } from "@/app/api/utils/platformSettings";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

async function readLastRun() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "../../scratch/telegram-backup-status.json"),
    path.resolve(cwd, "scratch/telegram-backup-status.json"),
    path.resolve(cwd, "../scratch/telegram-backup-status.json"),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(await fs.readFile(candidate, "utf8"));
    } catch {}
  }
  return null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await readPlatformSettings();
    return Response.json({
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      chatConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
      intervalHours: settings.backupIntervalHours || Number(process.env.BACKUP_INTERVAL_HOURS || 5) || 5,
      autoBackup: settings.autoBackup,
      lastRun: await readLastRun(),
    });
  } catch (error) {
    console.error("GET /api/admin/backups/status", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
