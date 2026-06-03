import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

// Ensure the platform_settings + banned_ips tables exist
let schemaReady;
async function ensureSecuritySchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const queries = [
        `CREATE TABLE IF NOT EXISTS platform_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS banned_ips (
          ip_id INT AUTO_INCREMENT PRIMARY KEY,
          ip_address VARCHAR(45) NOT NULL UNIQUE,
          reason TEXT,
          banned_by VARCHAR(36),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];
      for (const q of queries) {
        try { await sql(q); } catch (e) { if (e.code !== 'ER_DUP_KEYNAME') console.error(e); }
      }
    })();
  }
  return schemaReady;
}

const SETTING_KEYS = [
  'cloudflare_turnstile', 'rate_limiting', 'block_tor_exit_nodes',
  'max_login_attempts', 'session_timeout_mins', 'two_factor_enforcement'
];

const DEFAULTS = {
  cloudflare_turnstile: 'true',
  rate_limiting: 'true',
  block_tor_exit_nodes: 'false',
  max_login_attempts: '5',
  session_timeout_mins: '120',
  two_factor_enforcement: 'none',
};

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    await ensureSecuritySchema();

    // Fetch all settings
    const rows = await sql`SELECT setting_key, setting_value FROM platform_settings`;
    const settingsMap = {};
    for (const row of rows) {
      settingsMap[row.setting_key] = row.setting_value;
    }

    // Map to frontend format with defaults
    const settings = {
      cloudflareTurnstile: (settingsMap.cloudflare_turnstile ?? DEFAULTS.cloudflare_turnstile) === 'true',
      rateLimiting: (settingsMap.rate_limiting ?? DEFAULTS.rate_limiting) === 'true',
      blockTorExitNodes: (settingsMap.block_tor_exit_nodes ?? DEFAULTS.block_tor_exit_nodes) === 'true',
      maxLoginAttempts: parseInt(settingsMap.max_login_attempts ?? DEFAULTS.max_login_attempts, 10),
      sessionTimeoutMins: parseInt(settingsMap.session_timeout_mins ?? DEFAULTS.session_timeout_mins, 10),
      twoFactorEnforcement: settingsMap.two_factor_enforcement ?? DEFAULTS.two_factor_enforcement,
    };

    // Fetch banned IPs
    const ips = await sql`SELECT ip_address, reason, created_at FROM banned_ips ORDER BY created_at DESC`;

    return Response.json({ settings, bannedIps: ips.map(r => r.ip_address) });
  } catch (err) {
    console.error("GET /api/admin/security error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    await ensureSecuritySchema();

    const body = await request.json();
    const { action } = body;

    // --- Save All Settings ---
    if (action === 'save_settings') {
      const { settings } = body;
      if (!settings) return Response.json({ error: "Missing settings" }, { status: 400 });

      const pairs = [
        ['cloudflare_turnstile', String(!!settings.cloudflareTurnstile)],
        ['rate_limiting', String(!!settings.rateLimiting)],
        ['block_tor_exit_nodes', String(!!settings.blockTorExitNodes)],
        ['max_login_attempts', String(parseInt(settings.maxLoginAttempts, 10) || 5)],
        ['session_timeout_mins', String(parseInt(settings.sessionTimeoutMins, 10) || 120)],
        ['two_factor_enforcement', ['none', 'admins_only', 'all'].includes(settings.twoFactorEnforcement) ? settings.twoFactorEnforcement : 'none'],
      ];

      for (const [key, value] of pairs) {
        await sql`
          INSERT INTO platform_settings (setting_key, setting_value)
          VALUES (${key}, ${value})
          ON DUPLICATE KEY UPDATE setting_value = ${value}, updated_at = NOW()
        `;
      }

      return Response.json({ message: "Security settings saved successfully." });
    }

    // --- Ban IP ---
    if (action === 'ban_ip') {
      const ip = String(body.ip || '').trim();
      // Basic IP validation (IPv4/IPv6)
      if (!ip || (!ip.match(/^\d{1,3}(\.\d{1,3}){3}$/) && !ip.match(/^[0-9a-fA-F:]+$/))) {
        return Response.json({ error: "Invalid IP address format" }, { status: 400 });
      }
      try {
        await sql`INSERT INTO banned_ips (ip_address, banned_by) VALUES (${ip}, ${session?.user?.id || null})`;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          return Response.json({ error: "IP is already banned" }, { status: 409 });
        }
        throw e;
      }
      return Response.json({ message: `IP ${ip} has been banned.` });
    }

    // --- Unban IP ---
    if (action === 'unban_ip') {
      const ip = String(body.ip || '').trim();
      if (!ip) return Response.json({ error: "Missing IP" }, { status: 400 });
      await sql`DELETE FROM banned_ips WHERE ip_address = ${ip}`;
      return Response.json({ message: `IP ${ip} has been unbanned.` });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/admin/security error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
