/**
 * Worker Entity
 * @description Cloudflare Worker configuration and types
 */

export interface WorkerRequest {
  url: string;
  method: string;
  headers: Headers;
  body?: ReadableStream | null;
  cf?: IncomingRequestCfProperties;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  integrity?: string;
  mode?: RequestMode;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  formData(): Promise<FormData>;
}

export interface WorkerResponse extends Response {
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface CloudflareWorkerConfig {
  readonly name: string;
  readonly routes?: string[];
  readonly schedule?: string;
  readonly bindings?: WorkerBindings;
}

export interface WorkerBindings {
  readonly kv?: Record<string, KVNamespace>;
  readonly r2?: Record<string, R2Bucket>;
  readonly d1?: Record<string, D1Database>;
  readonly env?: Record<string, string>;
}

export interface IncomingRequestCfProperties {
  readonly colo?: string;
  readonly country?: string;
  readonly httpProtocol?: string;
  readonly requestPriority?: string;
  readonly tlsVersion?: string;
  readonly tlsCipher?: string;
}
