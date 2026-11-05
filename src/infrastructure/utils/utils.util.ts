
export const dateUtils = {
  getExpirationTime(ttl: number): number {
    return Math.floor(Date.now() / 1000) + ttl;
  },

  fromTimestamp(timestamp: number): Date {
    return new Date(timestamp * 1000);
  },

  getRemainingTTL(expiration: number): number {
    return Math.max(0, expiration - Math.floor(Date.now() / 1000));
  },
};

export const cacheUtils = {
  generateKey(...parts: readonly string[]): string {
    return parts.join(":");
  },

  parseKey(key: string): readonly string[] {
    return key.split(":");
  },

  getCacheControl(maxAge: number, immutable = false): string {
    const directives = [`public`, `max-age=${maxAge}`];
    if (immutable) {
      directives.push("immutable");
    }
    return directives.join(", ");
  },
};

export const validationUtils = {
  isValidKVKey(key: string): boolean {
    return /^[\w\-.:]+$/.test(key) && key.length <= 512;
  },

  isValidR2Key(key: string): boolean {
    return key.length > 0 && key.length <= 1024 && !key.includes("//");
  },

  isValidImageType(type: string): boolean {
    return ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(type);
  },

  isValidImageSize(size: number, maxSize = 10 * 1024 * 1024): boolean {
    return size > 0 && size <= maxSize;
  },
};

export const transformUtils = {
  async fileToBlob(file: File): Promise<Blob> {
    return file;
  },

  async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return await blob.arrayBuffer();
  },

  async streamToBlob(stream: ReadableStream): Promise<Blob> {
    const reader = stream.getReader();
    const chunks: BlobPart[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as BlobPart);
    }

    return new Blob(chunks);
  },

  generateTransformURL(baseUrl: string, transform: {
    width?: number;
    height?: number;
    fit?: string;
    format?: string;
    quality?: number;
  }): string {
    const url = new URL(baseUrl);
    const params = url.searchParams;

    if (transform.width) params.set("width", transform.width.toString());
    if (transform.height) params.set("height", transform.height.toString());
    if (transform.fit) params.set("fit", transform.fit);
    if (transform.format) params.set("format", transform.format);
    if (transform.quality) params.set("quality", transform.quality.toString());

    return url.toString();
  },
};
