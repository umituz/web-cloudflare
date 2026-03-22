/**
 * Cloudflare Worker Example
 * @description Example worker using @umituz/web-cloudflare package
 */

import { workersService, kvService } from "@umituz/web-cloudflare";
import type { Env } from "../types/env.types";
import type { WorkerRequest } from "../entities";

// Configure routes
workersService.route("/", async () => {
  return workersService.json({ message: "Hello from edge!" });
});

workersService.route("/api/hello", async (request) => {
  const data = await request.json() as { name?: string };
  const name = data?.name || "World";

  return workersService.json({ message: `Hello, ${name}!` });
});

workersService.route("/api/cache/:key", async (request, env?: Env) => {
  const url = new URL(request.url);
  const key = url.pathname.split("/").pop() || "";

  if (request.method === "GET") {
    const value = await kvService.get(key, env?.KV ? "KV" : undefined);
    return workersService.json({ key, value });
  }

  if (request.method === "POST") {
    const data = await request.json() as { value?: unknown };
    await kvService.put(key, data.value || "", { ttl: 3600 });
    return workersService.json({ success: true });
  }

  return workersService.error("Method not allowed", 405);
});

// Export for Cloudflare Workers
export default {
  fetch: (request: Request, env?: Env, ctx?: ExecutionContext) =>
    workersService.fetch(request as unknown as WorkerRequest, env, ctx),
};
