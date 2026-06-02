import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const read = (file) => readFileSync(path.resolve(file), "utf8");

describe("platform settings contracts", () => {
  test("admin settings persist feature toggles and backup status through APIs", () => {
    const page = read("src/app/admin/settings/page.jsx");
    const settingsRoute = read("src/app/api/admin/settings/route.js");
    const backupStatusRoute = read("src/app/api/admin/backups/status/route.js");
    const platformSettings = read("src/app/api/utils/platformSettings.js");

    expect(page).toContain('fetch("/api/admin/settings")');
    expect(page).toContain('fetch("/api/admin/backups/status")');
    expect(page).toContain("maintenanceMode");
    expect(page).toContain("allowNewSignups");
    expect(page).toContain("backupIntervalHours");
    expect(page).toContain("Telegram Bot Token");
    expect(page).toContain("Telegram Chat ID");
    expect(page).toContain("telegramBotTokenConfigured");
    expect(settingsRoute).toContain("adminPlatformSettings");
    expect(backupStatusRoute).toContain("readTelegramBackupConfig");
    expect(platformSettings).toContain("telegram_bot_token");
    expect(platformSettings).toContain("telegram_chat_id");
    expect(page).not.toContain("resendApiKey");
  });

  test("localization settings use the app custom select popup", () => {
    const page = read("src/app/admin/settings/page.jsx");
    expect(page).toContain('import { Select } from "@/components/ui"');
    expect(page).toContain("<Select value={value} onChange={onChange} options={options} />");
    expect(page).not.toContain("<select value={value}");
  });

  test("maintenance mode has a route and a root-level gate", () => {
    expect(read("src/app/routes.ts")).toContain("route('maintenance', './maintenance/page.jsx')");
    const root = read("src/app/root.tsx");
    expect(root).toContain("function PlatformGate");
    expect(root).toContain("navigate('/maintenance'");
    expect(root).toContain("settings?.maintenanceMode");
  });

  test("public signup is blocked when platform signups are disabled", () => {
    const signup = read("src/app/account/signup/page.jsx");
    expect(signup).toContain("signupBlocked");
    expect(signup).toContain("allowNewSignups");
    expect(signup).toContain("New signups are temporarily disabled.");
  });
});
