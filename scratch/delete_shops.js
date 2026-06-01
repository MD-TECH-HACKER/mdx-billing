import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: 'apps/web/.env' });

async function deleteShops() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    console.log("Deleting sales...");
    await pool.execute('DELETE FROM sales');
    console.log("Deleting products...");
    await pool.execute('DELETE FROM products');
    console.log("Deleting shops...");
    await pool.execute('DELETE FROM shops');
    console.log("All shops and related data successfully deleted.");
  } catch (err) {
    console.error("Error deleting shops:", err);
  } finally {
    await pool.end();
  }
}

deleteShops();
