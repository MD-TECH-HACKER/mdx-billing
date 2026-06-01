import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

function read(relativePath) {
  return readFileSync(path.resolve(relativePath), "utf8");
}

describe("admin action contracts", () => {
  test("shop suspension uses persisted shop status and a real admin action", () => {
    const dbSchema = read("../../db.sql");
    const shopsRoute = read("src/app/api/admin/shops/route.js");
    const shopsPage = read("src/app/admin/shops/page.jsx");

    expect(dbSchema).toContain("status VARCHAR(50) NOT NULL DEFAULT 'active'");
    expect(shopsRoute).toContain("export async function POST");
    expect(shopsRoute).toContain("UPDATE shops");
    expect(shopsRoute).toContain("s.status");
    expect(shopsPage).toContain("handleShopStatus");
    expect(shopsPage).toContain("Reactivate Shop");
    expect(shopsPage).not.toContain("Mock status logic");
    expect(shopsPage).not.toContain('includes("suspended")');
  });

  test("user admin actions are explicit and cannot ban a platform admin", () => {
    const usersListRoute = read("src/app/api/admin/users/route.js");
    const usersRoute = read("src/app/api/admin/users/[id]/route.js");
    const usersPage = read("src/app/admin/users/page.jsx");

    expect(usersListRoute).toContain("isPlatformAdmin");
    expect(usersRoute).toContain("Cannot ban a platform admin");
    expect(usersRoute).toContain("isAdmin(targetUser");
    expect(usersPage).toContain("user.isPlatformAdmin");
    expect(usersPage).not.toContain("MoreHorizontal");
    expect(usersPage).not.toContain("openActionId");
    expect(usersPage).toContain("View Details");
    expect(usersPage).toContain("Ban User");
    expect(usersPage).toContain("Unban User");
  });
});
