import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Use import.meta.glob to load all API routes at compile time.
// This works perfectly in both dev and production (Vite bundles them).
const routeModules = import.meta.glob('../src/app/api/**/route.js', { eager: true });

// Helper function to transform file path to Hono route path
function getHonoPath(routeFile: string): { name: string; pattern: string }[] {
  // routeFile looks like '../src/app/api/shop/route.js'
  // Remove prefix up to /api/
  const relativePath = routeFile.replace(/^.*\/src\/app\/api\//, '');
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1); // Remove 'route.js'
  
  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }
  
  const transformedParts = routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
  return transformedParts;
}

// Register all routes
function registerRoutes() {
  // Clear existing routes
  api.routes = [];

  // Sort paths so longer/specific routes match before shorter ones
  const sortedPaths = Object.keys(routeModules).sort((a, b) => b.length - a.length);

  for (const routeFile of sortedPaths) {
    try {
      const route: any = routeModules[routeFile];

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        if (route[method]) {
          const parts = getHonoPath(routeFile);
          const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
          
          const handler: Handler = async (c) => {
            const params = c.req.param();
            return await route[method](c.req.raw, { params });
          };
          
          const methodLowercase = method.toLowerCase();
          switch (methodLowercase) {
            case 'get':
              api.get(honoPath, handler);
              break;
            case 'post':
              api.post(honoPath, handler);
              break;
            case 'put':
              api.put(honoPath, handler);
              break;
            case 'delete':
              api.delete(honoPath, handler);
              break;
            case 'patch':
              api.patch(honoPath, handler);
              break;
            default:
              console.warn(`Unsupported method: ${method}`);
              break;
          }
        }
      }
    } catch (error) {
      console.error(`Error registering route ${routeFile}:`, error);
    }
  }
}

// Initial route registration
registerRoutes();

export { api, API_BASENAME };
