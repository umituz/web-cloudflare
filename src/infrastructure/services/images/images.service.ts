/**
 * Images Service
 * @description Cloudflare Images operations
 */

import type { ImageUploadResult, ImageUploadOptions, ImageTransformation, SignedURL } from "../../../domain/entities/image.entity";
import type { IImageService } from "../../../domain/interfaces/services.interface";
import { validationUtils, transformUtils } from "../../utils";
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from "../../constants";

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

    if (options?.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        formData.append(`metadata[${key}]`, value);
      }
    }

    if (options?.requireSignedURLs !== undefined) {
      formData.append("requireSignedURLs", options.requireSignedURLs.toString());
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

    const data = await response.json();

    return {
      id: data.result.id,
      filename: data.result.filename,
      uploaded: new Date(data.result.uploaded),
      variants: data.result.variants,
      requireSignedURLs: data.result.requireSignedURLs,
    };
  }

  async getSignedURL(imageId: string, expiresIn = 3600): Promise<SignedURL> {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const response = await fetch(`${this.getAPIBaseURL()}/${imageId}`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiry: expiresAt.toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get signed URL: ${error}`);
    }

    const data = await response.json();

    return {
      url: data.result.signedURLs?.[0] || data.result.variants?.[0],
      expiresAt,
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

    const data = await response.json();

    return {
      images: data.result.images,
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

export const imagesService = new ImagesService();
