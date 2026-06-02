import sql from "@/app/api/utils/sql";

const CURRENCY_CODES = new Set([
  "INR",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "AED",
  "SAR",
  "SGD",
  "MYR",
  "ZAR",
  "BRL",
  "MXN",
]);

const TIMEZONE_IDS = new Set([
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
]);

const SETTINGS = {
  platformName: { key: "platform_name", type: "string", defaultValue: "MDX Billing App" },
  supportEmail: { key: "support_email", type: "string", defaultValue: "support@mdx-billing.app" },
  senderEmail: { key: "sender_email", type: "string", defaultValue: "receipts@mdxbilling.app" },
  enableEmailReceipts: { key: "enable_email_receipts", type: "boolean", defaultValue: true },
  enableSmsNotifications: { key: "enable_sms_notifications", type: "boolean", defaultValue: false },
  enableGstFeatures: { key: "enable_gst_features", type: "boolean", defaultValue: true },
  allowNewSignups: { key: "allow_new_signups", type: "boolean", defaultValue: true },
  maintenanceMode: { key: "maintenance_mode", type: "boolean", defaultValue: false },
  currencyDefault: { key: "currency_default", type: "currency", defaultValue: "INR" },
  timezoneDefault: { key: "timezone_default", type: "timezone", defaultValue: "Asia/Kolkata" },
  enforce2FA: { key: "enforce_2fa", type: "boolean", defaultValue: false },
  autoBackup: { key: "auto_backup", type: "boolean", defaultValue: true },
  backupIntervalHours: { key: "backup_interval_hours", type: "number", defaultValue: 5 },
  telegramBotToken: { key: "telegram_bot_token", type: "secret", defaultValue: "" },
  telegramChatId: { key: "telegram_chat_id", type: "secret", defaultValue: "" },
};

const KEY_TO_SETTING = Object.fromEntries(
  Object.entries(SETTINGS).map(([settingName, config]) => [config.key, settingName]),
);

let schemaReady;

export function normalizeCurrency(value, fallback = "INR") {
  const next = String(value || "").trim().toUpperCase();
  return CURRENCY_CODES.has(next) ? next : fallback;
}

export function normalizeTimezone(value, fallback = "Asia/Kolkata") {
  const next = String(value || "").trim();
  return TIMEZONE_IDS.has(next) ? next : fallback;
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function parseSetting(value, config) {
  if (value === undefined || value === null) return config.defaultValue;
  if (config.type === "boolean") return parseBoolean(value, config.defaultValue);
  if (config.type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(168, Math.round(parsed))) : config.defaultValue;
  }
  if (config.type === "currency") return normalizeCurrency(value, config.defaultValue);
  if (config.type === "timezone") return normalizeTimezone(value, config.defaultValue);
  if (config.type === "secret") return String(value).trim();
  return String(value).trim().slice(0, 300) || config.defaultValue;
}

function serializeSetting(value, config) {
  const parsed = parseSetting(value, config);
  return config.type === "boolean" ? String(parsed) : String(parsed);
}

export async function ensurePlatformSettingsSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS platform_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
    })();
  }
  return schemaReady;
}

export async function readPlatformSettings() {
  await ensurePlatformSettingsSchema();
  const rows = await sql`SELECT setting_key, setting_value FROM platform_settings`;
  const settings = Object.fromEntries(
    Object.entries(SETTINGS).map(([name, config]) => [name, config.defaultValue]),
  );

  for (const row of rows) {
    const settingName = KEY_TO_SETTING[row.setting_key];
    if (!settingName) continue;
    settings[settingName] = parseSetting(row.setting_value, SETTINGS[settingName]);
  }

  return settings;
}

export async function savePlatformSettings(input = {}) {
  await ensurePlatformSettingsSchema();
  const saved = {};

  for (const [settingName, value] of Object.entries(input)) {
    const config = SETTINGS[settingName];
    if (!config) continue;
    if (config.type === "secret" && !String(value || "").trim()) continue;
    const settingValue = serializeSetting(value, config);
    await sql`
      INSERT INTO platform_settings (setting_key, setting_value)
      VALUES (${config.key}, ${settingValue})
      ON DUPLICATE KEY UPDATE setting_value = ${settingValue}, updated_at = NOW()
    `;
    saved[settingName] = parseSetting(settingValue, config);
  }

  return { ...(await readPlatformSettings()), ...saved };
}

export async function readTelegramBackupConfig() {
  const settings = await readPlatformSettings();
  return {
    botToken: settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: settings.telegramChatId || process.env.TELEGRAM_CHAT_ID || "",
    tokenSource: settings.telegramBotToken ? "database" : process.env.TELEGRAM_BOT_TOKEN ? "env" : null,
    chatSource: settings.telegramChatId ? "database" : process.env.TELEGRAM_CHAT_ID ? "env" : null,
    intervalHours: settings.backupIntervalHours || Number(process.env.BACKUP_INTERVAL_HOURS || 5) || 5,
    autoBackup: settings.autoBackup,
  };
}

export function adminPlatformSettings(settings) {
  const sanitized = { ...settings };
  delete sanitized.telegramBotToken;
  delete sanitized.telegramChatId;
  sanitized.telegramBotTokenConfigured = Boolean(settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN);
  sanitized.telegramChatIdConfigured = Boolean(settings.telegramChatId || process.env.TELEGRAM_CHAT_ID);
  return sanitized;
}

export function publicPlatformSettings(settings) {
  return {
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    allowNewSignups: settings.allowNewSignups,
    maintenanceMode: settings.maintenanceMode,
    currencyDefault: settings.currencyDefault,
    timezoneDefault: settings.timezoneDefault,
    enableGstFeatures: settings.enableGstFeatures,
  };
}
