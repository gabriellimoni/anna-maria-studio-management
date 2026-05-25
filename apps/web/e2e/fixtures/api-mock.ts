import { Page, Route, Request } from '@playwright/test';

export type MockResponse =
  | { status?: number; body?: unknown; contentType?: string }
  | ((req: Request) => { status?: number; body?: unknown; contentType?: string } | Promise<{ status?: number; body?: unknown; contentType?: string }>);

export type RouteMap = Record<string, MockResponse>;

function matchKey(method: string, pathname: string, routes: RouteMap): string | null {
  const exact = `${method} ${pathname}`;
  if (routes[exact]) return exact;
  for (const key of Object.keys(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const regex = new RegExp(
      '^' + pattern.replace(/\//g, '\\/').replace(/:[^/]+/g, '[^/]+') + '$',
    );
    if (regex.test(pathname)) return key;
  }
  return null;
}

export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
}

export async function mockApi(page: Page, routes: RouteMap) {
  const calls: ApiCall[] = [];

  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname.replace(/^\/api\/v1/, '');
    const method = req.method();

    let body: unknown = undefined;
    const postData = req.postData();
    if (postData) {
      try { body = JSON.parse(postData); } catch { body = postData; }
    }
    calls.push({ method, path: pathname + url.search, body });

    const key = matchKey(method, pathname, routes);
    if (!key) {
      console.warn(`[api-mock] unhandled ${method} ${pathname}`);
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"unmocked"}' });
      return;
    }

    const handler = routes[key];
    const resolved = typeof handler === 'function' ? await handler(req) : handler;
    const status = resolved.status ?? 200;
    const contentType = resolved.contentType ?? 'application/json';
    const responseBody =
      resolved.body === undefined
        ? ''
        : typeof resolved.body === 'string'
          ? resolved.body
          : JSON.stringify(resolved.body);

    await route.fulfill({ status, contentType, body: responseBody });
  });

  return {
    calls,
    findCall(method: string, pathPattern: string | RegExp) {
      return calls.find(
        (c) =>
          c.method === method &&
          (typeof pathPattern === 'string' ? c.path.startsWith(pathPattern) : pathPattern.test(c.path)),
      );
    },
  };
}
