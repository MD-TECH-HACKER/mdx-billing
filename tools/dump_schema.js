const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: 'apps/web/.env' });

async function dumpSchema() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [tables] = await connection.query('SHOW TABLES');
    let sqlContent = '-- MDX Billing App Database Schema Dump\n-- Generated after full MySQL refactoring\n\nSET FOREIGN_KEY_CHECKS=0;\n\n';
    
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [createTableResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createSyntax = Object.values(createTableResult[0])[1];
      
      sqlContent += `-- Table structure for table \`${tableName}\`\n`;
      sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sqlContent += createSyntax + ';\n\n';
    }
    
    sqlContent += 'SET FOREIGN_KEY_CHECKS=1;\n';
    
    fs.writeFileSync('db.sql', sqlContent);
    console.log('Successfully wrote db.sql');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

dumpSchema();
