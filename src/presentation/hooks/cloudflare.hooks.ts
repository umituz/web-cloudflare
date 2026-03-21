/**
 * Cloudflare React Hooks
 * @description React hooks for Cloudflare services (client-side)
 */

import { useCallback, useState, useEffect } from "react";
import { kvService } from "../../infrastructure/services/kv";
import { r2Service } from "../../infrastructure/services/r2";
import { imagesService } from "../../infrastructure/services/images";
import { analyticsService } from "../../infrastructure/services/analytics";

/**
 * Cloudflare Worker Hook
 * @description Fetch data from Cloudflare Workers
 */
export interface UseCloudflareWorkerOptions {
  readonly enabled?: boolean;
  readonly refetchInterval?: number;
}

export function useCloudflareWorker<T = unknown>(
  url: string,
  options?: UseCloudflareWorkerOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcher = useCallback(async () => {
    if (!options?.enabled ?? true) {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
  }, [url, options?.enabled]);

  useEffect(() => {
    fetcher();

    if (options?.refetchInterval) {
      const interval = setInterval(fetcher, options.refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetcher, options?.refetchInterval]);

  return { data, loading, error, refetch: fetcher };
}

/**
 * Cloudflare KV Hook
 * @description Read from Cloudflare KV (client-side, via Worker API)
 */
export interface UseCloudflareKVOptions {
  readonly apiURL: string;
  readonly enabled?: boolean;
}

export function useCloudflareKV<T = unknown>(
  key: string,
  options: UseCloudflareKVOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!options.enabled ?? true) {
      setLoading(true);
      setError(null);

      fetch(`${options.apiURL}/kv/${key}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then((json) => setData(json.value))
        .catch((err) => setError(err))
        .finally(() => setLoading(false));
    }
  }, [key, options.apiURL, options.enabled]);

  return { data, loading, error };
}

/**
 * Cloudflare R2 Hook
 * @description Upload files to R2 (client-side, via Worker API)
 */
export interface UseCloudflareR2Options {
  readonly uploadURL: string;
}

export function useCloudflareR2(options: UseCloudflareR2Options) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(
    async (file: File, key?: string) => {
      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (key) formData.append("key", key);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress((e.loaded / e.total) * 100);
          }
        });

        const promise = new Promise<{ key: string; url: string }>((resolve, reject) => {
          xhr.addEventListener("load", () => {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Upload failed"));
          });

          xhr.open("POST", options.uploadURL);
          xhr.send(formData);
        });

        return await promise;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [options.uploadURL]
  );

  return { upload, uploading, progress, error };
}

/**
 * Cloudflare D1 Hook
 * @description Query D1 database (client-side, via Worker API)
 */
export interface UseCloudflareD1Options {
  readonly apiURL: string;
  readonly enabled?: boolean;
}

export function useCloudflareD1<T = unknown>(
  query: string,
  params?: readonly unknown[],
  options?: UseCloudflareD1Options
) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!options?.enabled ?? true) {
      setLoading(true);
      setError(null);

      fetch(`${options?.apiURL}/d1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, params }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then((json) => setData(json.results))
        .catch((err) => setError(err))
        .finally(() => setLoading(false));
    }
  }, [query, params, options?.apiURL, options?.enabled]);

  return { data, loading, error };
}

/**
 * Cloudflare Images Hook
 * @description Upload and manage images
 */
export interface UseCloudflareImagesOptions {
  readonly accountId?: string;
  readonly apiToken?: string;
  readonly uploadURL?: string;
}

export function useCloudflareImages(options?: UseCloudflareImagesOptions) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (options?.accountId && options?.apiToken) {
      imagesService.initialize({
        accountId: options.accountId,
        apiToken: options.apiToken,
      });
    }
  }, [options?.accountId, options?.apiToken]);

  const upload = useCallback(
    async (file: File, metadata?: Record<string, string>) => {
      setUploading(true);
      setError(null);

      try {
        if (options?.uploadURL) {
          // Upload via Worker proxy
          const formData = new FormData();
          formData.append("file", file);
          if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
              formData.append(`metadata[${key}]`, value);
            }
          }

          const response = await fetch(options.uploadURL, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          return await response.json();
        } else {
          // Direct upload to Cloudflare Images
          return await imagesService.upload(file, { metadata });
        }
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [options?.uploadURL]
  );

  const getTransformedURL = useCallback(
    (imageId: string, transform: {
      width?: number;
      height?: number;
      fit?: string;
      format?: string;
      quality?: number;
    }) => {
      return imagesService.getTransformedURL(imageId, transform);
    },
    []
  );

  return { upload, uploading, error, getTransformedURL };
}

/**
 * Cloudflare Analytics Hook
 * @description Track analytics events
 */
export interface UseCloudflareAnalyticsOptions {
  readonly siteId: string;
  readonly scriptUrl?: string;
}

export function useCloudflareAnalytics(options: UseCloudflareAnalyticsOptions) {
  useEffect(() => {
    analyticsService.initialize({
      siteId: options.siteId,
      scriptUrl: options.scriptUrl,
    });
  }, [options.siteId, options.scriptUrl]);

  const trackPageview = useCallback((title: string, referrer?: string) => {
    if (typeof window !== "undefined") {
      analyticsService.trackPageview(window.location.href, title, referrer);
    }
  }, []);

  const trackEvent = useCallback((eventName: string, data?: Record<string, unknown>) => {
    analyticsService.trackCustom(eventName, data);
  }, []);

  const getScriptTag = useCallback(() => {
    return analyticsService.getScriptTag();
  }, []);

  return { trackPageview, trackEvent, getScriptTag };
}
