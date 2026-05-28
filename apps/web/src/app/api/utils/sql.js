import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

/**
 * A tagged template literal and function wrapper for mysql2
 */
export default async function sql(strings, ...values) {
  let query = '';
  let params = [];

  if (Array.isArray(strings)) {
    // Tagged template mode: sql`SELECT * FROM users WHERE id = ${id}`
    query = strings[0];
    for (let i = 1; i < strings.length; i++) {
      query += '?' + strings[i];
      params.push(values[i - 1]);
    }
  } else {
    // Function mode: sql("SELECT * FROM users WHERE id = $1", [id])
    query = strings;
    params = values[0] || [];
    // Replace $1, $2 etc with ?
    query = query.replace(/\\$\\d+/g, '?');
  }

  // Handle RETURNING * emulation for INSERT/UPDATE
  const isInsertOrUpdate = /^\\s*(INSERT|UPDATE)/i.test(query);
  const returningMatch = query.match(/RETURNING\\s+(.*)$/i);
  let returningFields = null;

  if (isInsertOrUpdate && returningMatch) {
    returningFields = returningMatch[1].trim();
    // Remove the RETURNING clause from the query for MySQL
    query = query.substring(0, returningMatch.index);
  }

  try {
    const [rows] = await pool.execute(query, params);
    
    // If it was an INSERT/UPDATE with RETURNING, try to fetch the row
    if (isInsertOrUpdate && returningMatch) {
      if (rows.insertId) {
        // We know the insertId (auto-increment)
        // This is a naive fetch; we don't know the table name easily, so we just return the insertId in an array format to mimic pg
        // However, many routes expect full objects.
        // Let's at least return what we know.
        return [{ insertId: rows.insertId, _insertId: rows.insertId }];
      } else {
         // It might have been an UPDATE or an INSERT with a UUID. 
         // Without a complex parser, returning a mocked object or empty array is all we can do safely in a generic wrapper.
         return []; 
      }
    }
    
    // For SELECT queries, rows is an array of objects
    return Array.isArray(rows) ? rows : [rows];
  } catch (error) {
    console.error("MySQL Query Error:", error);
    throw error;
  }
}

export { pool };