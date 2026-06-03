import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import path from "node:path";
import sql, { pool } from "@/app/api/utils/sql";

const TABLE_GROUPS = {
  users: ["auth_users"],
  shops: ["shops"],
  products: ["products"],
  sales: ["sales"],
};

const IMPORT_ORDER = [
  "auth_users",
  "shops",
  "shop_memberships",
  "customers",
  "suppliers",
  "categories",
  "products",
  "sales",
  "purchases",
  "expenses",
  "estimates",
  "payments",
  "audit_events",
  "platform_settings",
];

function appDir() {
  return process.cwd();
}

function rootDir() {
  return appDir();
}

function escapeIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, "``")}\``;
}

async function tableExists(tableName, executor = sql) {
  try {
    await executor(`SELECT 1 FROM ${escapeIdentifier(tableName)} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function allTables() {
  const rows = await sql("SHOW TABLES");
  const key = rows[0] ? Object.keys(rows[0])[0] : null;
  return key ? rows.map((row) => row[key]).filter(Boolean) : [];
}

function exportKeyForTable(table) {
  return table === "auth_users" ? "users" : table;
}

function tableForExportKey(key) {
  return key === "users" ? "auth_users" : key;
}

export async function exportDatabaseData(type = "full") {
  const tableNames = type === "full" ? await allTables() : TABLE_GROUPS[type] || TABLE_GROUPS.users;
  const data = {};

  for (const table of tableNames) {
    if (!(await tableExists(table))) continue;
    data[exportKeyForTable(table)] = await sql(`SELECT * FROM ${escapeIdentifier(table)}`);
  }

  return {
    exportedAt: new Date().toISOString(),
    type,
    format: "mdx-system-backup-v2",
    data,
  };
}

const FILE_CANDIDATES = [
  "public/uploads",
  "public/upload",
  "public/user",
  "public/user/upload",
  "uploads",
  "public/logo.png",
  "public/logo-orange.png",
  "public/favicon.ico",
  "public/apple-touch-icon.png",
];

async function pathExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function addPathToZip(zip, absolutePath, relativePath) {
  const stat = await fs.stat(absolutePath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(absolutePath);
    for (const entry of entries) {
      await addPathToZip(
        zip,
        path.join(absolutePath, entry),
        path.join(relativePath, entry),
      );
    }
    return;
  }

  const zipPath = `files/${relativePath.replace(/\\/g, "/")}`;
  zip.addFile(zipPath, await fs.readFile(absolutePath));
}

export async function createFullBackupZip() {
  const zip = new AdmZip();
  const database = await exportDatabaseData("full");
  zip.addFile("database.json", Buffer.from(JSON.stringify(database, null, 2), "utf8"));

  const base = rootDir();
  for (const candidate of FILE_CANDIDATES) {
    const absolutePath = path.resolve(base, candidate);
    if (!(await pathExists(absolutePath))) continue;
    await addPathToZip(zip, absolutePath, candidate);
  }

  return zip.toBuffer();
}

function normalizeImportPayload(payload) {
  if (payload?.format === "mdx-system-backup-v2" && payload.data) return payload.data;
  if (payload?.tables) return payload.tables;
  if (payload?.data) return payload.data;
  return payload;
}

function valueForInsert(value) {
  if (value === undefined) return null;
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function importDatabase(payload) {
  const data = normalizeImportPayload(payload);
  if (!data || typeof data !== "object") {
    throw new Error("Backup database payload is invalid.");
  }

  const connection = await pool.getConnection();
  const results = {};
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.beginTransaction();
    const entries = Object.entries(data);
    const sorted = [
      ...IMPORT_ORDER.map((table) => [exportKeyForTable(table), data[exportKeyForTable(table)]]),
      ...entries.filter(([key]) => !IMPORT_ORDER.includes(tableForExportKey(key))),
    ];

    for (const [exportKey, rows] of sorted) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const table = tableForExportKey(exportKey);
      const exists = await tableExists(table, (query) => connection.query(query));
      if (!exists) continue;
      let imported = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          const clean = Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined),
          );
          const keys = Object.keys(clean);
          if (keys.length === 0) continue;
          const columns = keys.map(escapeIdentifier).join(", ");
          const placeholders = keys.map(() => "?").join(", ");
          const update = keys.map((key) => `${escapeIdentifier(key)} = VALUES(${escapeIdentifier(key)})`).join(", ");
          const values = keys.map((key) => valueForInsert(clean[key]));
          await connection.execute(
            `INSERT INTO ${escapeIdentifier(table)} (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${update}`,
            values,
          );
          imported += 1;
        } catch (error) {
          failed += 1;
          console.error(`Import error on ${table}:`, error.message);
        }
      }

      results[exportKey] = { imported, failed };
    }

    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch {}
    connection.release();
  }
}

async function restoreZipFiles(zip) {
  const base = rootDir();
  let restored = 0;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.startsWith("files/")) continue;
    const relative = entry.entryName.slice("files/".length);
    const target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) continue;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, entry.getData());
    restored += 1;
  }

  return restored;
}

export async function importSystemBackup({ buffer, json }) {
  if (buffer) {
    const zip = new AdmZip(Buffer.from(buffer));
    const databaseEntry = zip.getEntry("database.json");
    if (!databaseEntry) throw new Error("ZIP backup is missing database.json.");
    const databasePayload = JSON.parse(databaseEntry.getData().toString("utf8"));
    const results = await importDatabase(databasePayload);
    const restoredFiles = await restoreZipFiles(zip);
    return { results, restoredFiles };
  }

  return { results: await importDatabase(json), restoredFiles: 0 };
}
