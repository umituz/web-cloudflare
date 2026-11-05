
import { ValueObject } from '../../shared/value-objects/base.value-object';

export const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/markdown': 'md',
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

  static create(props: GeneratedAssetMetadataProps): GeneratedAssetMetadata {
    GeneratedAssetMetadata.validate(props);
    return new GeneratedAssetMetadata(props);
  }

  private static validate(props: GeneratedAssetMetadataProps): void {
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

  get model(): string {
    return this.props.model;
  }

  get provider(): string | undefined {
    return this.props.provider;
  }

  get prompt(): string | undefined {
    return this.props.prompt;
  }

  get contentType(): string {
    return this.props.contentType;
  }

  isAudio(): boolean {
    return this.props.contentType.startsWith('audio/');
  }

  isImage(): boolean {
    return this.props.contentType.startsWith('image/');
  }

  isVideo(): boolean {
    return this.props.contentType.startsWith('video/');
  }

  getFileExtension(): string {
    return CONTENT_TYPE_EXTENSIONS[this.props.contentType] ?? 'bin';
  }

  get tags(): string[] | undefined {
    return this.props.tags;
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  toObject(): GeneratedAssetMetadataProps {
    return { ...this.props };
  }
}
