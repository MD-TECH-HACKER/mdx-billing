import mysql from 'mysql2/promise';

/* ── BigInt JSON serialization patch ──────────────────────────────── */
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () { return Number(this); };
}

/* ── Pool ─────────────────────────────────────────────────────────── */
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  // Automatically parse JSON columns returned by the server
  typeCast(field, next) {
    if (field.type === 'JSON') {
      const val = field.string("utf8");
      if (val === null) return null;
      try { return JSON.parse(val); } catch { return val; }
    }
    return next();
  },
});

/* ── Query builder ────────────────────────────────────────────────── */
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

  if (isInsertOrUpdate && returningMatch) {
    // Remove the RETURNING clause from the query for MySQL
    query = query.substring(0, returningMatch.index);
  }

  return { query, params, isInsertOrUpdate, returningMatch };
}

/* ── Execute helper ───────────────────────────────────────────────── */
async function executeQuery(executor, strings, values) {
  const { query, params, isInsertOrUpdate, returningMatch } = buildQuery(strings, values);

  try {
    const [rows] = await executor.execute(query, params);

    // If it was an INSERT/UPDATE with RETURNING, return insertId wrapper
    if (isInsertOrUpdate && returningMatch) {
      // rows.insertId can be BigInt(0) which is falsy — check explicitly
      if (rows.insertId !== undefined && rows.insertId !== null) {
        const id = typeof rows.insertId === 'bigint' ? Number(rows.insertId) : rows.insertId;
        return [{ insertId: id, _insertId: id }];
      }
      return [];
    }

    // For non-SELECT write operations without RETURNING
    if (isInsertOrUpdate && !returningMatch) {
      // Return the result info (affectedRows, insertId, etc.)
      if (!Array.isArray(rows)) {
        const id = typeof rows.insertId === 'bigint' ? Number(rows.insertId) : rows.insertId;
        return [{ insertId: id, _insertId: id, affectedRows: rows.affectedRows }];
      }
    }

    // For SELECT queries, rows is an array of objects
    if (!Array.isArray(rows)) return [rows];

    // Auto-parse any JSON string columns that the typeCast might have missed
    // (happens with prepared statements / execute)
    return rows.map(row => {
      if (!row || typeof row !== 'object') return row;
      const parsed = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.length > 1) {
          const first = value[0];
          if (first === '{' || first === '[') {
            try { parsed[key] = JSON.parse(value); continue; } catch {}
          }
        }
        // Convert BigInt values to Number for safe downstream use
        if (typeof value === 'bigint') {
          parsed[key] = Number(value);
          continue;
        }
        parsed[key] = value;
      }
      return parsed;
    });
  } catch (error) {
    if (error.code !== 'ER_DUP_KEYNAME' && error.code !== 'ER_DUP_FIELDNAME') {
      console.error("MySQL Query Error:", error.message, query);
    }
    throw error;
  }
}

/* ── Default export: tagged template + function call ──────────────── */
export default async function sql(strings, ...values) {
  return executeQuery(pool, strings, values);
}

/* ── Transaction support ──────────────────────────────────────────── */
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

sql.withTransaction = withTransaction;
sql.transaction = async (queries) => {
  // Fallback for array-based transactions. Note: since our `sql` function executes immediately,
  // these queries will execute concurrently outside a real ACID transaction lock. 
  // For true transactions, use `sql.withTransaction`.
  return Promise.all(queries);
};

export { pool };