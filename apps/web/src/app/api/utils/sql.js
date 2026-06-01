import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

function buildQuery(strings, values) {
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
    query = query.replace(/\$\d+/g, '?');
  }

  // Handle RETURNING * emulation for INSERT/UPDATE
  const isInsertOrUpdate = /^\s*(INSERT|UPDATE|DELETE)/i.test(query);
  const returningMatch = query.match(/RETURNING[\s\S]*$/i);
  let returningFields = null;

  if (isInsertOrUpdate && returningMatch) {
    returningFields = returningMatch[0].replace(/RETURNING\s+/i, '').trim();
    // Remove the RETURNING clause from the query for MySQL
    query = query.substring(0, returningMatch.index);
  }

  return { query, params, isInsertOrUpdate, returningMatch };
}

async function executeQuery(executor, strings, values) {
  const { query, params, isInsertOrUpdate, returningMatch } = buildQuery(strings, values);

  try {
    const [rows] = await executor.execute(query, params);
    
    // If it was an INSERT/UPDATE with RETURNING, try to fetch the row
    if (isInsertOrUpdate && returningMatch) {
      if (rows.insertId) {
        return [{ insertId: rows.insertId, _insertId: rows.insertId }];
      } else {
         return []; 
      }
    }
    
    // For SELECT queries, rows is an array of objects
    return Array.isArray(rows) ? rows : [rows];
  } catch (error) {
    if (error.code !== 'ER_DUP_KEYNAME') {
      console.error("MySQL Query Error:", error, query);
    }
    throw error;
  }
}

/**
 * A tagged template literal and function wrapper for mysql2
 */
export default async function sql(strings, ...values) {
  return executeQuery(pool, strings, values);
}

/**
 * Execute a sequence of queries in a database transaction.
 * The callback receives a bound `txSql` function.
 */
export async function withTransaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  const txSql = async (strings, ...values) => {
    return executeQuery(connection, strings, values);
  };

  try {
    const result = await callback(txSql);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { pool };