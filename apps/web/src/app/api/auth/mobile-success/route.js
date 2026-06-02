import { getToken } from '@auth/core/jwt';

const MOBILE_AUTH_SCHEME = process.env.MOBILE_AUTH_SCHEME || 'mdxbilling';

function safeReturnTo(value, requestUrl) {
  if (!value) return '/';
  try {
    if (value.startsWith('/')) return value.startsWith('//') ? '/' : value;
    const parsed = new URL(value);
    const origin = new URL(requestUrl).origin;
    return parsed.origin === origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : '/';
  } catch {
    return '/';
  }
}

function htmlMessage(title, message) {
  return new Response(
    `<!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; color: #111827; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
          main { max-width: 360px; text-align: center; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { color: #4b5563; line-height: 1.5; margin: 0; }
        </style>
      </head>
      <body><main><h1>${title}</h1><p>${message}</p></main></body>
    </html>`,
    {
      status: 401,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      },
    },
  );
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo'), request.url);
  const isSecure = process.env.AUTH_URL?.startsWith('https') ?? request.url?.startsWith('https') ?? false;
  const [token, jwt] = await Promise.all([
    getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: isSecure,
      raw: true,
    }),
    getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: isSecure,
    }),
  ]);

  if (!jwt || !token) {
    return htmlMessage('Google sign-in failed', 'Please close this tab and try again from the MDX Billing app.');
  }

  const redirectUrl = new URL(`${MOBILE_AUTH_SCHEME}://auth`);
  redirectUrl.searchParams.set('token', token);
  redirectUrl.searchParams.set('returnTo', returnTo);
  if (jwt.sub) redirectUrl.searchParams.set('userId', jwt.sub);
  if (jwt.email) redirectUrl.searchParams.set('email', jwt.email);
  if (jwt.name) redirectUrl.searchParams.set('name', jwt.name);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
      'Cache-Control': 'no-store',
    },
  });
}
