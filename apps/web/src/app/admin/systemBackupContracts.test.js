import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const read = (file) => readFileSync(path.resolve(file), "utf8");

describe("admin system backup contracts", () => {
  test("full export downloads a ZIP while smaller exports remain JSON", () => {
    const page = read("src/app/admin/system/page.jsx");
    const exportRoute = read("src/app/api/admin/system/export/route.js");
    const backupUtil = read("src/app/api/utils/systemBackup.js");
    const telegramBackupScript = read("scripts/telegram-backup.mjs");

    expect(page).toContain("Full ZIP Backup");
    expect(page).toContain("Export ZIP");
    expect(page).toContain("application/zip");
    expect(page).toContain('isZip ? "zip" : "json"');
    expect(exportRoute).toContain("createFullBackupZip");
    expect(exportRoute).toContain('"Content-Type": "application/zip"');
    expect(backupUtil).toContain('zip.addFile("database.json"');
    expect(backupUtil).toContain("files/");
    expect(backupUtil).toContain("apps/web/public/uploads");
    expect(backupUtil).toContain("apps/mobile/assets/images/icon.png");
    expect(telegramBackupScript).toContain('"public", "uploads"');
    expect(telegramBackupScript).toContain('"public", "logo-orange.png"');
    expect(telegramBackupScript).toContain('"images", "splash-icon.png"');
  });

  test("import accepts full ZIP backups and restores uploaded files", () => {
    const page = read("src/app/admin/system/page.jsx");
    const importRoute = read("src/app/api/admin/system/import/route.js");
    const backupUtil = read("src/app/api/utils/systemBackup.js");

    expect(page).toContain('accept=".zip,.json,application/zip,application/json"');
    expect(page).toContain("new FormData()");
    expect(page).toContain('formData.set("file", importFile)');
    expect(page).toContain("Restored ${data.restoredFiles} files.");
    expect(importRoute).toContain('contentType.includes("multipart/form-data")');
    expect(importRoute).toContain("importSystemBackup({ buffer })");
    expect(backupUtil).toContain('zip.getEntry("database.json")');
    expect(backupUtil).toContain("restoreZipFiles");
    expect(backupUtil).toContain("ON DUPLICATE KEY UPDATE");
  });

  test("production start launches the scheduled Telegram backup watcher", () => {
    const packageJson = read("package.json");
    const startScript = read("scripts/start-production.mjs");

    expect(packageJson).toContain("scripts/start-production.mjs");
    expect(startScript).toContain("scripts/telegram-backup.mjs");
    expect(startScript).toContain('"--watch"');
    expect(startScript).toContain("build/server/index.js");
  });
});
