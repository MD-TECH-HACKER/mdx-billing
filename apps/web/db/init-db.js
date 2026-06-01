import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = mysql.createPool(process.env.DATABASE_URL);

async function init() {
  console.log("Creating tables...");
  
  try {
    const connection = await pool.getConnection();
    const dbSqlPath = path.resolve(__dirname, '../../db.sql');
    const sqlContent = fs.readFileSync(dbSqlPath, 'utf8');

    // Simple split by semicolons that are not inside quotes is complex,
    // but our db.sql is simple enough to split by ");" or just run as multiple statements.
    // However, mysql2/promise connection.query only supports multiple statements if enabled.
    // Instead, we can split by statement explicitly since we know the format.
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      if (stmt.startsWith('--')) continue; // skip comments
      await connection.query(stmt);
    }

    console.log("Tables created successfully from db.sql!");
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

init();
