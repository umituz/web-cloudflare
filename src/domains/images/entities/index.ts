/**
 * Image Entity
 * @description Cloudflare Images configuration and types
 */

export interface ImageConfig {
  readonly account: string;
  readonly customDomain?: string;
}

export interface ImageVariant {
  readonly variant: string;
  readonly width?: number;
  readonly height?: number;
  readonly fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  readonly format?: "jpeg" | "png" | "gif" | "webp" | "avif";
  readonly quality?: number;
}

export interface ImageUploadResult {
  readonly id: string;
  readonly filename: string;
  readonly uploaded: Date;
  readonly variants: readonly string[];
  readonly requireSignedURLs: boolean;
}

export interface ImageUploadOptions {
  readonly metadata?: Record<string, string>;
  readonly requireSignedURLs?: boolean;
  readonly variants?: readonly ImageVariant[];
}

export interface ImageTransformation {
  readonly width?: number;
  readonly height?: number;
  readonly fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  readonly format?: "jpeg" | "png" | "gif" | "webp" | "avif";
  readonly quality?: number;
  readonly rotate?: number;
  readonly flip?: boolean;
  readonly flop?: boolean;
}

export interface SignedURL {
  readonly url: string;
  readonly expiresAt: Date;
}
