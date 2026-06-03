import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.dirname(fileURLToPath(import.meta.url));

function routeFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(fullPath);
    return entry.isFile() && entry.name === "route.js" ? [fullPath] : [];
  });
}

const forbiddenPatterns = [
  ["RETURNING clause", /\bRETURNING\s+(?:\*|[a-z_][a-z0-9_]*)\b/i],
  ["ON CONFLICT clause", /\bON\s+CONFLICT\b/i],
  ["ILIKE operator", /\bILIKE\b/i],
  ["jsonb_agg", /\bjsonb_agg\b/i],
  ["jsonb_build_object", /\bjsonb_build_object\b/i],
  ["array transaction helper", /\bsql\.transaction\s*\(\s*\[/],
  ["PostgreSQL shorthand cast", /::(?:text|int|integer|uuid|date|timestamp|boolean|numeric|jsonb)\b/i],
  ["PostgreSQL parameter marker", /\$[1-9]\d*/],
  ["PostgreSQL excluded alias", /\bEXCLUDED\./i],
  ["PostgreSQL JSON extraction", /->>\s*'[^$][^']*'/],
];

describe("API routes use MySQL-compatible SQL syntax", () => {
  test("route files do not contain PostgreSQL-only SQL constructs", () => {
    const violations = [];

    for (const file of routeFiles(apiDir)) {
      const source = fs.readFileSync(file, "utf8");
      for (const [label, pattern] of forbiddenPatterns) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(apiDir, file)}: ${label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
