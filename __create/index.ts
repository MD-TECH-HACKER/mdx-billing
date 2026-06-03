import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import Credentials from '@auth/core/providers/credentials';
import Google from '@auth/core/providers/google';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import mysql from 'mysql2/promise';
import { hash, verify } from 'argon2';
import { Hono } from 'hono';
import { contextStorage, getContext } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { serializeError } from 'serialize-error';
import ws from 'ws';
import MySQLAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { isAuthAction } from './is-auth-action';
import { API_BASENAME, api } from './route-builder';

const als = new AsyncLocalStorage<{ requestId: string }>();

for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);

  console[method] = (...args: unknown[]) => {
    const requestId = als.getStore()?.requestId;
    if (requestId) {
      original(`[traceId:${requestId}]`, ...args);
    } else {
      original(...args);
    }
  };
}

const pool = mysql.createPool(process.env.DATABASE_URL as string);
const adapter = MySQLAdapter(pool as any);
const useSecureAuthCookies = process.env.AUTH_URL
  ? process.env.AUTH_URL.startsWith('https://')
  : process.env.NODE_ENV === 'production';

const app = new Hono();
const isProduction = process.env.NODE_ENV === 'production';

app.use('*', requestId());

app.use('*', (c, next) => {
  const requestId = c.get('requestId');
  return als.run({ requestId }, () => next());
});

app.use(contextStorage());

app.onError((err, c) => {
  if (c.req.method !== 'GET') {
    const payload: { error: string; details?: unknown } = {
      error: 'An error occurred in your app',
    };
    if (!isProduction) payload.details = serializeError(err);
    return c.json(
      payload,
      500
    );
  }
  return c.html(getHTMLForErrorPage(err, { showDetails: !isProduction }), 500);
});

if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    })
  );
}
for (const method of ['post', 'put', 'patch'] as const) {
  app[method](
    '*',
    bodyLimit({
      maxSize: 4.5 * 1024 * 1024, // 4.5mb to match vercel limit
      onError: (c) => {
        return c.json({ error: 'Body size limit exceeded' }, 413);
      },
    })
  );
}

if (process.env.AUTH_SECRET) {
  app.use(
    '*',
    initAuthConfig((_c) => ({
      adapter,
      secret: process.env.AUTH_SECRET,
      basePath: '/api/auth',
      trustHost: true,
      logger: {
        warn(code) {
          if (code === 'env-url-basepath-redundant') return;
          console.warn(`[auth][warn][${code}]`);
        },
      },
      pages: {
        signIn: '/account/signin',
        signOut: '/account/logout',
      },
      session: {
        strategy: 'jwt',
      },
      callbacks: {
        session({ session, token }) {
          if (token.sub) {
            session.user.id = token.sub;
          }
          return session;
        },
      },
      cookies: {
        pkceCodeVerifier: {
          name: '__Secure-authjs.pkce.code_verifier',
          options: { httpOnly: true, sameSite: 'none', path: '/', secure: true, maxAge: 900 }
        },
        state: {
          name: '__Secure-authjs.state',
          options: { httpOnly: true, sameSite: 'none', path: '/', secure: true, maxAge: 900 }
        },
        csrfToken: {
          name: '__Host-authjs.csrf-token',
          options: { httpOnly: true, sameSite: 'none', path: '/', secure: true }
        },
        sessionToken: {
          name: '__Secure-authjs.session-token',
          options: { httpOnly: true, sameSite: 'none', path: '/', secure: true }
        },
        callbackUrl: {
          name: '__Secure-authjs.callback-url',
          options: { httpOnly: true, sameSite: 'none', path: '/', secure: true }
        }
      },
      providers: [
        // Google OAuth
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
          ? [
              Google({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                checks: ['pkce'],
              }),
            ]
          : []),
        // Dev-only provider for simulated social sign-in
        ...(process.env.NEXT_PUBLIC_CREATE_ENV === 'DEVELOPMENT'
          ? [
              Credentials({
                id: 'dev-social',
                name: 'Development Social Sign-in',
                credentials: {
                  email: { label: 'Email', type: 'email' },
                  name: { label: 'Name', type: 'text' },
                  provider: { label: 'Provider', type: 'text' },
                },
                authorize: async (credentials) => {
                  const { email, name, provider } = credentials;
                  if (!email || typeof email !== 'string') return null;

                  const existing = await adapter.getUserByEmail(email);
                  if (existing) return existing;

                  const allowedProviders = new Set(['google', 'facebook', 'twitter', 'apple']);
                  const providerName =
                    typeof provider === 'string' && allowedProviders.has(provider.toLowerCase())
                      ? provider.toLowerCase()
                      : 'google';
                  const newUser = await adapter.createUser({
                    emailVerified: null,
                    email,
                    name:
                      typeof name === 'string' && name.length > 0
                        ? name
                        : undefined,
                  } as any);
                  await adapter.linkAccount({
                    type: 'oauth',
                    userId: newUser.id,
                    provider: providerName,
                    providerAccountId: `dev-${newUser.id}`,
                  });
                  return newUser;
                },
              }),
            ]
          : []),
        Credentials({
          id: 'credentials-signin',
          name: 'Credentials Sign in',
          credentials: {
            email: {
              label: 'Email',
              type: 'email',
            },
            password: {
              label: 'Password',
              type: 'password',
            },
          },
          authorize: async (credentials) => {
            const { email, password } = credentials;
            if (!email || !password) {
              return null;
            }
            if (typeof email !== 'string' || typeof password !== 'string') {
              return null;
            }

            // logic to verify if user exists
            const user = await adapter.getUserByEmail(email);
            if (!user) {
              return null;
            }
            const matchingAccount = user.accounts.find(
              (account) => account.provider === 'credentials'
            );
            const accountPassword = matchingAccount?.password;
            if (!accountPassword) {
              return null;
            }

            const isValid = await verify(accountPassword, password);
            if (!isValid) {
              return null;
            }

            // return user object with the their profile data
            return user;
          },
        }),
        Credentials({
          id: 'credentials-signup',
          name: 'Credentials Sign up',
          credentials: {
            email: {
              label: 'Email',
              type: 'email',
            },
            password: {
              label: 'Password',
              type: 'password',
            },
            name: { label: 'Name', type: 'text' },
            image: { label: 'Image', type: 'text', required: false },
          },
          authorize: async (credentials) => {
            const { email, password, name, image } = credentials;
            if (!email || !password) {
              return null;
            }
            if (typeof email !== 'string' || typeof password !== 'string') {
              return null;
            }

            // logic to verify if user exists
            const user = await adapter.getUserByEmail(email);
            if (!user) {
              const newUser = await adapter.createUser({
                emailVerified: null,
                email,
                name: typeof name === 'string' && name.length > 0 ? name : undefined,
                image: typeof image === 'string' && image.length > 0 ? image : undefined,
              } as any);
              await adapter.linkAccount({
                extraData: {
                  password: await hash(password),
                },
                type: 'credentials',
                userId: newUser.id,
                providerAccountId: newUser.id,
                provider: 'credentials',
              });
              return newUser;
            }
            return null;
          },
        }),
      ],
    }))
  );
}
// Middleware to intercept Auth.js responses and prevent Auth.js from overriding custom signin pages
app.use('/api/auth/callback/google', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.searchParams.has('iss')) {
    // Force the exact issuer Auth.js expects to bypass the "unexpected iss" bug
    url.searchParams.set('iss', 'https://accounts.google.com');
    const newReq = new Request(url.href, c.req.raw);
    Object.defineProperty(c.req, 'raw', { value: newReq, writable: true });
  }
  await next();
});

app.use('/api/auth/*', async (c, next) => {
  if (isAuthAction(c.req.path)) {
    // Auth.js throws UnknownAction on GET /api/auth/signin/<provider> when
    // custom pages.signIn is configured. Intercept these and redirect to our
    // custom sign-in page. POST requests (from the signIn() client) still
    // pass through to authHandler which handles the actual OAuth flow.
    if (c.req.method === 'GET') {
      const signinMatch = c.req.path.match(/^\/api\/auth\/signin\/(.+)/);
      if (signinMatch) {
        const url = new URL(c.req.url);
        const callbackUrl = url.searchParams.get('callbackUrl') || '/';
        return c.redirect(`/account/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }
    }
    return authHandler()(c, next);
  }
  return next();
});
app.route(API_BASENAME, api);

export default createHonoServer({
  app,
  defaultLogger: false,
});
