import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const read = (file) => readFileSync(path.resolve(file), "utf8");

describe("platform settings contracts", () => {
  test("admin settings persist feature toggles and backup status through APIs", () => {
    const page = read("src/app/admin/settings/page.jsx");
    expect(page).toContain('fetch("/api/admin/settings")');
    expect(page).toContain('fetch("/api/admin/backups/status")');
    expect(page).toContain("maintenanceMode");
    expect(page).toContain("allowNewSignups");
    expect(page).toContain("backupIntervalHours");
    expect(page).not.toContain("resendApiKey");
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
