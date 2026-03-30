/**
 * Image Entity
 * @description Basic Image entity placeholder
 */

export interface ImageEntity {
  id: string;
  url: string;
  variant?: string;
}

export interface ImageConfig {
  formats?: Array<'webp' | 'avif' | 'jpeg' | 'png'>;
  quality?: number;
}

export interface ImageVariant {
  width: number;
  height: number;
  format: string;
  url: string;
}

export interface ImageUploadResult {
  id: string;
  url: string;
  variants: ImageVariant[];
}

export interface ImageUploadOptions {
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  quality?: number;
  width?: number;
  height?: number;
}

export interface ImageTransformation {
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover' | 'fill';
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  quality?: number;
}

export interface SignedURL {
  url: string;
  expires: number;
}
