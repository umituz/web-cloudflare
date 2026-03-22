/**
 * Images Service Interface
 * @description Abstract interface for Images operations
 */

import type { ImageUploadResult, ImageUploadOptions, SignedURL, ImageTransformation } from '../entities';

export interface IImageService {
  upload(file: File | Blob, options?: ImageUploadOptions): Promise<ImageUploadResult>;
  getSignedURL(imageId: string, expiresIn?: number): Promise<SignedURL>;
  getTransformedURL(imageId: string, transform: ImageTransformation): Promise<string>;
  delete(imageId: string): Promise<boolean>;
}
