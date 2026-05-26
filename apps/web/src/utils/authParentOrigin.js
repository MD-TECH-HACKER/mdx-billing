function toOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function resolveAuthParentOrigin(requestUrl, configuredOrigins = []) {
  const request = new URL(requestUrl);
  const requestedOrigin = toOrigin(request.searchParams.get("parentOrigin"));

  if (!requestedOrigin) {
    return null;
  }

  const allowedOrigins = new Set([
    request.origin,
    ...configuredOrigins.map(toOrigin).filter(Boolean),
  ]);

  return allowedOrigins.has(requestedOrigin) ? requestedOrigin : null;
}
