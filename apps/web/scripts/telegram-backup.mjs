import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(appDir, "../..");
const backupRoot = path.join(rootDir, "scratch", "backups");
const statusPath = path.join(rootDir, "scratch", "telegram-backup-status.json");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (process.env[key]) continue;
    process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(path.join(rootDir, ".env"));
loadEnvFile(path.join(appDir, ".env"));

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeStatus(status) {
  await fs.mkdir(path.dirname(statusPath), { recursive: true });
  await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
}

function databaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database backup.");
  }
  return process.env.DATABASE_URL;
}

async function dumpDatabaseJson(outFile) {
  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection(databaseUrl());
  try {
    const [tables] = await connection.query("SHOW TABLES");
    const database = {};
    const tableKey = tables[0] ? Object.keys(tables[0])[0] : null;
    for (const row of tables) {
      const tableName = row[tableKey];
      const escapedTable = `\`${String(tableName).replace(/`/g, "``")}\``;
      const [records] = await connection.query(`SELECT * FROM ${escapedTable}`);
      database[tableName] = records;
    }
    await fs.writeFile(outFile, JSON.stringify({
      exportedAt: new Date().toISOString(),
      type: "mysql-json-dump",
      tables: database,
    }, null, 2));
    return "json";
  } finally {
    await connection.end();
  }
}

async function dumpDatabase(stageDir) {
  const sqlDump = path.join(stageDir, "database.sql");
  try {
    const url = new URL(databaseUrl());
    const args = [
      "--single-transaction",
      "--quick",
      "--skip-lock-tables",
      "-h",
      url.hostname,
      "-P",
      url.port || "3306",
      "-u",
      decodeURIComponent(url.username),
    ];
    if (url.password) args.push(`-p${decodeURIComponent(url.password)}`);
    args.push(decodeURIComponent(url.pathname.replace(/^\//, "")));
    const result = await run("mysqldump", args);
    await fs.writeFile(sqlDump, result.stdout);
    return { path: sqlDump, mode: "sql" };
  } catch (error) {
    const jsonDump = path.join(stageDir, "database.json");
    const mode = await dumpDatabaseJson(jsonDump);
    await fs.writeFile(path.join(stageDir, "database-dump-note.txt"), `mysqldump was unavailable, so a JSON dump was created instead.\n${error.message}\n`);
    return { path: jsonDump, mode };
  }
}

async function copyRecursive(source, destination) {
  const stat = await fs.stat(source);
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source);
    for (const entry of entries) {
      await copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function collectFiles(stageDir) {
  const included = [];
  const candidates = [
    path.join(appDir, "public", "uploads"),
    path.join(appDir, "public", "upload"),
    path.join(appDir, "public", "user"),
    path.join(appDir, "public", "user", "upload"),
    path.join(appDir, "uploads"),
    path.join(rootDir, "uploads"),
    path.join(appDir, "public", "logo.png"),
    path.join(appDir, "public", "favicon.ico"),
    path.join(appDir, "public", "apple-touch-icon.png"),
    path.join(rootDir, "apps", "mobile", "assets", "images", "icon.png"),
    path.join(rootDir, "apps", "mobile", "assets", "images", "adaptive-icon.png"),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const relative = path.relative(rootDir, candidate);
    await copyRecursive(candidate, path.join(stageDir, "files", relative));
    included.push(relative);
  }
  return included;
}

async function createArchive(stageDir, archivePath) {
  await fs.mkdir(path.dirname(archivePath), { recursive: true });
  if (process.platform === "win32") {
    await run("powershell", [
      "-NoProfile",
      "-Command",
      "Compress-Archive -Path * -DestinationPath $env:MDX_BACKUP_ZIP -Force",
    ], { cwd: stageDir, env: { ...process.env, MDX_BACKUP_ZIP: archivePath } });
    return archivePath;
  }
  try {
    await run("zip", ["-qr", archivePath, "."], { cwd: stageDir });
    return archivePath;
  } catch {
    const fallback = archivePath.replace(/\.zip$/i, ".tar.gz");
    await run("tar", ["-czf", fallback, "."], { cwd: stageDir });
    return fallback;
  }
}

async function sendTelegram(archivePath, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.");
  }

  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption);
  const bytes = await fs.readFile(archivePath);
  form.set("document", new Blob([bytes]), path.basename(archivePath));

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || "Telegram backup upload failed.");
  }
  return data.result;
}

async function readBackupConfig() {
  const fallbackInterval = Number(process.env.BACKUP_INTERVAL_HOURS || 5) || 5;
  try {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection(databaseUrl());
    try {
      const [rows] = await connection.query(
        "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('auto_backup', 'backup_interval_hours')",
      );
      const map = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
      return {
        autoBackup: map.auto_backup !== "false",
        intervalHours: Math.max(1, Math.min(168, Number(map.backup_interval_hours || fallbackInterval) || fallbackInterval)),
      };
    } finally {
      await connection.end();
    }
  } catch {
    return { autoBackup: true, intervalHours: fallbackInterval };
  }
}

export async function runBackup() {
  const startedAt = new Date().toISOString();
  const id = timestamp();
  const stageDir = path.join(backupRoot, `stage-${id}`);
  const archiveTarget = path.join(backupRoot, `mdx-billing-backup-${id}.zip`);
  const status = {
    startedAt,
    ok: false,
    archiveName: path.basename(archiveTarget),
    includedPaths: [],
  };
  await writeStatus(status);

  try {
    await fs.mkdir(stageDir, { recursive: true });
    const dbDump = await dumpDatabase(stageDir);
    const includedPaths = await collectFiles(stageDir);
    const archivePath = await createArchive(stageDir, archiveTarget);
    const stat = await fs.stat(archivePath);
    const caption = `MDX Billing backup ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;
    await sendTelegram(archivePath, caption);
    await fs.rm(stageDir, { recursive: true, force: true });

    const finalStatus = {
      ...status,
      ok: true,
      finishedAt: new Date().toISOString(),
      archiveName: path.basename(archivePath),
      archiveBytes: stat.size,
      databaseDumpMode: dbDump.mode,
      includedPaths,
    };
    await writeStatus(finalStatus);
    return finalStatus;
  } catch (error) {
    const finalStatus = {
      ...status,
      ok: false,
      finishedAt: new Date().toISOString(),
      error: error.message,
    };
    await writeStatus(finalStatus);
    throw error;
  }
}

async function main() {
  const watch = process.argv.includes("--watch");
  if (!watch) {
    await runBackup();
    return;
  }

  while (true) {
    const config = await readBackupConfig();
    if (config.autoBackup) {
      try {
        await runBackup();
      } catch (error) {
        console.error(error.message);
      }
    } else {
      await writeStatus({
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        ok: true,
        skipped: true,
        error: null,
        archiveName: null,
        includedPaths: [],
      });
    }
    await new Promise((resolve) => setTimeout(resolve, config.intervalHours * 60 * 60 * 1000));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
