import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const read = (file) => readFileSync(path.resolve(file), "utf8");

describe("auth logging contracts", () => {
  test("adapter SQL errors redact auth token and password parameters", () => {
    const authSource = read("src/auth.js");
    const serverAdapterSource = read("__create/adapter.ts");

    expect(authSource).toContain("function redactSqlParams");
    expect(authSource).toContain("redactSqlParams(params)");
    expect(authSource).not.toContain("console.error('ADAPTER SQL ERROR:', e, sql, params)");
    expect(serverAdapterSource).toContain("function redactSqlParams");
    expect(serverAdapterSource).toContain("redactSqlParams(params)");
    expect(serverAdapterSource).not.toContain("console.error('ADAPTER SQL ERROR:', e, sql, params)");
  });
});
