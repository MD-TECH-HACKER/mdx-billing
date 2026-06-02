function envValue(name) {
  return String(process.env[name] || "").trim();
}

function serializeErrorValue(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: "Error",
    message: String(error),
  };
}

async function sendLogsToRemote(logs) {
  const endpoint = envValue("EXPO_PUBLIC_LOGS_ENDPOINT");
  const projectGroupId = envValue("EXPO_PUBLIC_PROJECT_GROUP_ID");
  const apiKey = envValue("EXPO_PUBLIC_CREATE_TEMP_API_KEY");

  if (!endpoint || !projectGroupId || !apiKey) {
    return { success: false };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ projectGroupId, logs }),
    });

    return { success: !!response.ok };
  } catch (error) {
    return { success: false, error };
  }
}

async function reportErrorToRemote({ error }) {
  const serialized = serializeErrorValue(error);
  const message = serialized.message || String(error);
  const log = {
    level: "error",
    source: "BUILDER",
    devServerId: envValue("EXPO_PUBLIC_DEV_SERVER_ID") || undefined,
    timestamp: new Date().toISOString(),
    message,
    error: serialized,
  };

  return sendLogsToRemote([log]);
}

module.exports = {
  sendLogsToRemote,
  reportErrorToRemote,
};

