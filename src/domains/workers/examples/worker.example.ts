/**
 * Cloudflare Worker Example
 * @description Example worker using @umituz/web-cloudflare package
 */

import { workersService, kvService, r2Service } from "@umituz/web-cloudflare";

// Configure routes
workersService.route("/", async () => {
  return workersService.json({ message: "Hello from edge!" });
});

workersService.route("/api/hello", async (request) => {
  const { name } = await request.json();

  return workersService.json({ message: `Hello, ${name}!` });
});

workersService.route("/api/cache/:key", async (request, env) => {
  const url = new URL(request.url);
  const key = url.pathname.split("/").pop();

  if (request.method === "GET") {
    const value = await kvService.get(key, env?.KV ? "KV" : undefined);
    return workersService.json({ key, value });
  }

  if (request.method === "POST") {
    const { value } = await request.json();
    await kvService.put(key, value, { ttl: 3600 });
    return workersService.json({ success: true });
  }

  return workersService.error("Method not allowed", 405);
});

// Export for Cloudflare Workers
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    workersService.fetch(request, env, ctx),
};
