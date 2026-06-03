import mysql from 'mysql2/promise';

async function fix() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    const connection = await pool.getConnection();
    
    const queries = [
      'ALTER TABLE shops MODIFY shop_logo LONGTEXT;',
      'ALTER TABLE products MODIFY image_url LONGTEXT;',
      'ALTER TABLE suppliers MODIFY qr_image_url LONGTEXT;',
      'ALTER TABLE expenses MODIFY receipt_url LONGTEXT;',
      'ALTER TABLE auth_users MODIFY image LONGTEXT;'
    ];
    
    for (const q of queries) {
      try {
        await connection.query(q);
        console.log('Success:', q);
      } catch (e) {
        console.log('Skipped:', q, e.message);
      }
    }

    console.log('Finished altering columns');
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
fix();
