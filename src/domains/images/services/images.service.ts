/**
 * Images Service
 * @description Cloudflare Images operations
 */

import type { ImageUploadResult, ImageUploadOptions, ImageTransformation, SignedURL } from "../../../domain/entities/image.entity";
import type { IImageService } from "../../../domain/interfaces/services.interface";
import { validationUtils, transformUtils } from "../../../infrastructure/utils";
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from "../../../infrastructure/constants";

export interface ImagesClientOptions {
  readonly accountId: string;
  readonly apiToken: string;
  readonly customDomain?: string;
}

class ImagesService implements IImageService {
  private accountId: string | null = null;
  private apiToken: string | null = null;
  private customDomain: string | null = null;

  initialize(options: ImagesClientOptions): void {
    this.accountId = options.accountId;
    this.apiToken = options.apiToken;
    this.customDomain = options.customDomain ?? null;
  }

  private getAPIBaseURL(): string {
    if (!this.accountId) {
      throw new Error("ImagesService not initialized");
    }

    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
  }

  private getAuthHeaders(): HeadersInit {
    if (!this.apiToken) {
      throw new Error("ImagesService not initialized");
    }

    return {
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  async upload(file: File | Blob, options?: ImageUploadOptions): Promise<ImageUploadResult> {
    // Validate file
    if (file instanceof File) {
      if (!validationUtils.isValidImageType(file.type)) {
        throw new Error(`Invalid image type: ${file.type}`);
      }

      if (!validationUtils.isValidImageSize(file.size, MAX_IMAGE_SIZE)) {
        throw new Error(`Image size exceeds maximum: ${MAX_IMAGE_SIZE}`);
      }
    }

    // Prepare form data
    const formData = new FormData();
    formData.append("file", file);

    // Apply transformations if specified in options
    if (options?.width || options?.height || options?.format || options?.quality) {
      const variants: Array<{ width?: number; height?: number; format?: string; quality?: number }> = [];
      if (options.width) variants.push({ width: options.width });
      if (options.height) variants.push({ height: options.height });
      if (options.format) variants.push({ format: options.format });
      if (options.quality) variants.push({ quality: options.quality });
    }

    // Upload
    const response = await fetch(`${this.getAPIBaseURL()}/direct_upload`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }

    const data = await response.json() as {
      result: {
        id: string;
        filename: string;
        uploaded: string;
        variants: string[];
        requireSignedURLs: boolean;
      };
    };

    // Map API response to old entity type
    return {
      id: data.result.id,
      url: data.result.variants[0] || '',
      variants: data.result.variants.map((v) => ({
        width: 0,
        height: 0,
        format: (options?.format || 'jpeg') as 'jpeg' | 'png' | 'webp' | 'avif',
        url: v,
      })),
    };
  }

  async getSignedURL(imageId: string, expiresIn = 3600): Promise<SignedURL> {
    const expires = Date.now() + expiresIn * 1000;

    const response = await fetch(`${this.getAPIBaseURL()}/${imageId}`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiry: new Date(expires).toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get signed URL: ${error}`);
    }

    const data = await response.json() as {
      result: {
        signedURLs?: string[];
        variants?: string[];
      };
    };

    return {
      url: data.result.signedURLs?.[0] || data.result.variants?.[0] || '',
      expires,
    };
  }

  async getTransformedURL(imageId: string, transform: ImageTransformation): Promise<string> {
    if (this.customDomain) {
      const baseURL = `https://${this.customDomain}/${imageId}`;
      return transformUtils.generateTransformURL(baseURL, transform);
    }

    // Fallback to Cloudflare CDN URL
    const baseURL = `https://imagedelivery.net/${this.accountId}/${imageId}/public`;
    return transformUtils.generateTransformURL(baseURL, transform);
  }

  async delete(imageId: string): Promise<boolean> {
    const response = await fetch(`${this.getAPIBaseURL()}/${imageId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Delete failed: ${error}`);
    }

    return true;
  }

  /**
   * List helpers
   */
  async listImages(options?: { page?: number; perPage?: number }): Promise<{
    images: readonly ImageUploadResult[];
    totalCount: number;
  }> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", options.page.toString());
    if (options?.perPage) params.set("per_page", options.perPage.toString());

    const response = await fetch(`${this.getAPIBaseURL()}?${params}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`List failed: ${error}`);
    }

    const data = await response.json() as {
      result: {
        images: Array<{
          id: string;
          filename: string;
          uploaded: string;
          variants: string[];
        }>;
        totalCount: number;
      };
    };

    return {
      images: data.result.images.map((img) => ({
        id: img.id,
        url: img.variants[0] || '',
        variants: img.variants.map((v) => ({
          width: 0,
          height: 0,
          format: 'jpeg' as const,
          url: v,
        })),
      })),
      totalCount: data.result.totalCount,
    };
  }

  /**
   * Bulk operations
   */
  async uploadMultiple(files: readonly (File | Blob)[], options?: ImageUploadOptions): Promise<ImageUploadResult[]> {
    const uploads = files.map((file) => this.upload(file, options));

    return Promise.all(uploads);
  }

  async deleteMultiple(imageIds: readonly string[]): Promise<boolean> {
    const deletions = imageIds.map((id) => this.delete(id));

    await Promise.all(deletions);

    return true;
  }

  /**
   * Variant helpers
   */
  generateVariantURL(imageId: string, variant: string): string {
    if (this.customDomain) {
      return `https://${this.customDomain}/${imageId}/${variant}`;
    }

    return `https://imagedelivery.net/${this.accountId}/${imageId}/${variant}`;
  }

  /**
   * Upload from URL
   */
  async uploadFromURL(
    url: string,
    filename: string,
    options?: ImageUploadOptions
  ): Promise<ImageUploadResult> {
    // Fetch the image
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Upload the blob
    return this.upload(
      new File([blob], filename, { type: blob.type || "image/jpeg" }),
      options
    );
  }
}

// Export class and singleton instance
export { ImagesService };
export const imagesService = new ImagesService();
