import sql, { pool } from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Measure DB latency
    const start = Date.now();
    await sql`SELECT 1`;
    const latency = Date.now() - start;

    // Get connection info
    let activeConnections = 0;
    try {
      const connRows = await sql`SHOW STATUS LIKE 'Threads_connected'`;
      activeConnections = Number(connRows[0]?.Value || 0);
    } catch {}

    // Get database size
    let storageUsed = "—";
    try {
      const sizeRows = await sql`
        SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
      `;
      const mb = Number(sizeRows[0]?.size_mb || 0);
      storageUsed = mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
    } catch {}

    // Get MySQL uptime
    let uptime = "—";
    try {
      const uptimeRows = await sql`SHOW STATUS LIKE 'Uptime'`;
      const seconds = Number(uptimeRows[0]?.Value || 0);
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      uptime = `${days}d ${hours}h`;
    } catch {}

    return Response.json({
      stats: {
        dbConnection: "Healthy",
        dbLatency: `${latency}ms`,
        activeConnections,
        storageUsed,
        lastBackup: "Manual",
        errorRate: "0%",
        uptime,
        environment: process.env.NODE_ENV || "development"
      }
    });
  } catch (err) {
    console.error("GET /api/admin/system/health error:", err);
    return Response.json({
      stats: {
        dbConnection: "Error",
        dbLatency: "—",
        activeConnections: 0,
        storageUsed: "—",
        lastBackup: "—",
        errorRate: "—",
        uptime: "—",
        environment: process.env.NODE_ENV || "development"
      }
    });
  }
}
