import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function POST(request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const data = body.data;
    
    if (!data) {
      return Response.json({ error: "No data provided" }, { status: 400 });
    }

    console.log(`[ADMIN IMPORT] User ${session.user.email} initiated data import.`);

    // The order of tables is critical for foreign keys
    const tablesToImport = [
      'auth_users',
      'shops',
      'customers',
      'suppliers',
      'categories',
      'products',
      'sales',
      'purchases',
      'expenses',
      'estimates',
      'payments'
    ];
    
    let importResults = {};

    for (const table of tablesToImport) {
      // Map the export keys to table names
      let exportKey = table === 'auth_users' ? 'users' : table;
      
      if (data[exportKey] && Array.isArray(data[exportKey])) {
        const rows = data[exportKey];
        if (rows.length === 0) continue;
        
        let successCount = 0;
        let errorCount = 0;
        
        // As requested by user: clean the table before importing (except users, which is too dangerous)
        if (table !== 'auth_users') {
          try {
             // Disable foreign key checks temporarily so we can clean without blocking, 
             // but MySQL connection pool makes this tricky. We will just DELETE and rely on CASCADE.
             // If we import shops, deleting shops will cascade delete products and sales.
             await sql(`DELETE FROM \`${table}\``);
          } catch (e) {
             console.error(`Could not clean ${table} before import:`, e.message);
          }
        }

        // Basic generic insert logic
        for (const row of rows) {
          try {
            // Filter out JSON nulls or undefined
            const cleanRow = {};
            for (const [k, v] of Object.entries(row)) {
              if (v !== undefined) cleanRow[k] = v;
            }

            const keys = Object.keys(cleanRow);
            const values = Object.values(cleanRow);
            
            const queryKeys = keys.map(k => `\`${k}\``).join(', ');
            const queryPlaceholders = keys.map(() => '?').join(', ');
            
            const queryString = `INSERT IGNORE INTO \`${table}\` (${queryKeys}) VALUES (${queryPlaceholders})`;
            await sql(queryString, values);
            successCount++;
          } catch (e) {
            errorCount++;
            console.error(`Import error on ${table}:`, e.message);
          }
        }
        
        importResults[exportKey] = { imported: successCount, failed: errorCount };
      }
    }

    return Response.json({ 
      success: true, 
      message: "Data imported successfully.",
      results: importResults
    });
  } catch (err) {
    console.error("POST /api/admin/system/import error:", err);
    return Response.json({ error: "Import failed", details: err.message }, { status: 500 });
  }
}
