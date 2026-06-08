/**
 * Generated Asset Metadata Value Object
 * @description Immutable metadata for AI-generated or programmatically generated assets
 */

import { ValueObject } from '../../shared/value-objects/base.value-object';

/**
 * Canonical MIME type → file extension table.
 * Single source of truth for the AI value object and the R2 service
 * to avoid two parallel extension maps drifting out of sync.
 */
export const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  // Audio
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
  // Image
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  // Video
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  // Text / JSON
  'application/json': 'json',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/markdown': 'md',
  // Binary
  'application/octet-stream': 'bin',
};

export interface GeneratedAssetMetadataProps {
  model: string;
  provider?: string;
  prompt?: string;
  contentType: string;
  additionalData?: Record<string, unknown>;
  userId?: string;
  tags?: string[];
}

export class GeneratedAssetMetadata extends ValueObject<GeneratedAssetMetadataProps> {
  private static readonly MAX_PROMPT_LENGTH = 2000;
  private static readonly MAX_TAG_COUNT = 20;
  private static readonly VALID_CONTENT_TYPES = [
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/webm',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    'application/json', 'text/plain', 'text/csv', 'text/html', 'text/markdown',
    'application/octet-stream',
  ];

  private constructor(props: GeneratedAssetMetadataProps) {
    super(props);
  }

  /**
   * Create validated generated asset metadata
   */
  static create(props: GeneratedAssetMetadataProps): GeneratedAssetMetadata {
    GeneratedAssetMetadata.validate(props);
    return new GeneratedAssetMetadata(props);
  }

  /**
   * Validate metadata properties
   */
  private static validate(props: GeneratedAssetMetadataProps): void {
    // Validate model name
    if (!props.model || props.model.trim().length === 0) {
      throw new Error('Model name is required');
    }

    if (!props.contentType || !GeneratedAssetMetadata.isValidContentType(props.contentType)) {
      throw new Error(`Invalid content type: ${props.contentType}`);
    }

    if (props.prompt && props.prompt.length > GeneratedAssetMetadata.MAX_PROMPT_LENGTH) {
      throw new Error(`Prompt too long (max ${GeneratedAssetMetadata.MAX_PROMPT_LENGTH} characters)`);
    }

    if (props.tags && props.tags.length > GeneratedAssetMetadata.MAX_TAG_COUNT) {
      throw new Error(`Too many tags (max ${GeneratedAssetMetadata.MAX_TAG_COUNT})`);
    }

    // Validate tags format
    if (props.tags) {
      for (const tag of props.tags) {
        if (!/^[a-z0-9-]+$/.test(tag)) {
          throw new Error(`Invalid tag format: ${tag}. Use lowercase letters, numbers, and hyphens only.`);
        }
      }
    }
  }

  private static isValidContentType(contentType: string): boolean {
    return GeneratedAssetMetadata.VALID_CONTENT_TYPES.includes(contentType) ||
           contentType.startsWith('audio/') ||
           contentType.startsWith('image/') ||
           contentType.startsWith('video/') ||
           contentType.startsWith('text/') ||
           contentType.startsWith('application/');
  }

  /**
   * Get model identifier
   */
  get model(): string {
    return this.props.model;
  }

  /**
   * Get provider
   */
  get provider(): string | undefined {
    return this.props.provider;
  }

  /**
   * Get prompt
   */
  get prompt(): string | undefined {
    return this.props.prompt;
  }

  /**
   * Get content type
   */
  get contentType(): string {
    return this.props.contentType;
  }

  /**
   * Check if this is an audio asset
   */
  isAudio(): boolean {
    return this.props.contentType.startsWith('audio/');
  }

  /**
   * Check if this is an image asset
   */
  isImage(): boolean {
    return this.props.contentType.startsWith('image/');
  }

  /**
   * Check if this is a video asset
   */
  isVideo(): boolean {
    return this.props.contentType.startsWith('video/');
  }

  /**
   * Get file extension from content type
   * Canonical map shared with R2Service so we don't drift between
   * two parallel extension tables.
   */
  getFileExtension(): string {
    return CONTENT_TYPE_EXTENSIONS[this.props.contentType] ?? 'bin';
  }

  /**
   * Get all tags
   */
  get tags(): string[] | undefined {
    return this.props.tags;
  }

  /**
   * Get user ID
   */
  get userId(): string | undefined {
    return this.props.userId;
  }

  /**
   * Convert to plain object for storage
   */
  toObject(): GeneratedAssetMetadataProps {
    return { ...this.props };
  }
}
