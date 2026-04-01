/**
 * Audio/Music Generation Service
 * @description Service for generating audio and music using external AI providers (FAL AI, Replicate, etc.)
 * Supports long-running tasks with progress tracking, retry logic, and R2 upload
 */

import type { IR2Service } from '../../r2/types/service.interface';
import type { IKVService } from '../../kv/types/service.interface';

// ============================================================
// Types
// ============================================================

export interface AudioGenerationRequest {
  prompt: string;
  genre?: string;
  mood?: string;
  duration?: number;
  instrumental?: boolean;
  lyrics?: string;
  model?: string;
}

export interface AudioGenerationResult {
  audioUrl: string;
  r2Key: string;
  duration: number;
  format: string;
  size: number;
  cost?: number;
  latency: number;
}

export interface AudioGenerationOptions {
  provider?: 'fal-ai' | 'replicate' | 'custom';
  model?: string;
  timeout?: number;
  retries?: number;
  uploadToR2?: boolean;
  r2Bucket?: string;
  progressCallback?: (progress: number, status: string) => void;
}

export interface AudioProvider {
  id: string;
  name: string;
  baseURL: string;
  apiKey: string;
  models: string[];
  type: 'fal-ai' | 'replicate' | 'custom';
}

// ============================================================
// Audio Generation Service
// ============================================================

export class AudioGenerationService {
  private providers: Map<string, AudioProvider> = new Map();
  private r2?: IR2Service;
  private kv?: IKVService;
  private r2BucketName?: string;

  constructor(
    providers: AudioProvider[],
    r2?: IR2Service,
    kv?: IKVService,
    r2BucketName?: string
  ) {
    this.r2 = r2;
    this.kv = kv;
    this.r2BucketName = r2BucketName;

    // Register providers
    for (const provider of providers) {
      this.providers.set(provider.id, provider);
    }
  }

  /**
   * Generate audio with retry logic and progress tracking
   */
  async generateAudio(
    request: AudioGenerationRequest,
    options: AudioGenerationOptions = {}
  ): Promise<AudioGenerationResult> {
    const providerId = options.provider || 'fal-ai';
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const maxRetries = options.retries || 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        options.progressCallback?.(0, `Starting generation (attempt ${attempt + 1}/${maxRetries})`);

        const result = await this.generateAudioInternal(provider, request, options);

        options.progressCallback?.(100, 'Completed');

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          options.progressCallback?.(0, `Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Audio generation failed');
  }

  /**
   * Internal audio generation with timeout
   */
  private async generateAudioInternal(
    provider: AudioProvider,
    request: AudioGenerationRequest,
    options: AudioGenerationOptions
  ): Promise<AudioGenerationResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 300000; // 5 minutes default

    // Build request payload
    const model = options.model || provider.models[0];
    const payload = this.buildPayload(request, model, provider);

    // Call provider with timeout
    const response = await Promise.race([
      this.callProvider(provider, model, payload),
      this.createTimeout(timeout)
    ]);

    // Extract audio URL from response
    const audioUrl = this.extractAudioUrl(response);

    // Download audio
    options.progressCallback?.(50, 'Downloading audio...');
    const audioBuffer = await this.downloadAudio(audioUrl);

    // Upload to R2 if requested
    if (options.uploadToR2 && this.r2) {
      options.progressCallback?.(70, 'Uploading to R2...');
      const r2Key = await this.uploadToR2(audioBuffer, request);
      const publicUrl = this.getPublicUrl(r2Key);

      options.progressCallback?.(90, 'Finalizing...');

      return {
        audioUrl: publicUrl,
        r2Key,
        duration: request.duration || 30,
        format: 'mp3',
        size: audioBuffer.byteLength,
        latency: Date.now() - startTime,
      };
    }

    return {
      audioUrl,
      r2Key: '',
      duration: request.duration || 30,
      format: 'mp3',
      size: audioBuffer.byteLength,
      latency: Date.now() - startTime,
    };
  }

  /**
   * Build provider-specific payload
   */
  private buildPayload(request: AudioGenerationRequest, model: string, provider: AudioProvider): Record<string, unknown> {
    const basePayload = {
      prompt: request.prompt,
      model,
    };

    if (provider.type === 'fal-ai') {
      return {
        ...basePayload,
        genre: request.genre,
        mood: request.mood,
        duration: request.duration || 30,
        instrumental: request.instrumental ?? false,
        lyrics: request.lyrics,
      };
    }

    return basePayload;
  }

  /**
   * Call provider API
   */
  private async callProvider(
    provider: AudioProvider,
    model: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    const url = `${provider.baseURL}/${model}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${provider.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Provider error: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Extract audio URL from provider response
   */
  private extractAudioUrl(response: unknown): string {
    if (typeof response === 'object' && response !== null) {
      const r = response as Record<string, unknown>;

      // FAL AI format: { audio_url: { url: "..." } }
      if (r.audio_url) {
        const audioUrl = r.audio_url as Record<string, unknown>;
        if (audioUrl.url) {
          return String(audioUrl.url);
        }
        return String(audioUrl);
      }

      // Direct URL format: { audio_url: "..." }
      if (r.audio_url && typeof r.audio_url === 'string') {
        return r.audio_url;
      }

      // Other formats
      if (r.url && typeof r.url === 'string') {
        return r.url;
      }

      if (r.output && typeof r.output === 'string') {
        return r.output;
      }
    }

    throw new Error('Could not extract audio URL from response');
  }

  /**
   * Download audio from URL
   */
  private async downloadAudio(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    return await response.arrayBuffer();
  }

  /**
   * Upload audio to R2
   */
  private async uploadToR2(buffer: ArrayBuffer, request: AudioGenerationRequest): Promise<string> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const timestamp = Date.now();
    const key = `audio/generated/${timestamp}-${this.generateId()}.mp3`;

    // Upload to R2 (implementation depends on R2Service)
    await this.r2.put(key, buffer, {
      customMetadata: {
        prompt: request.prompt,
        genre: request.genre || 'unknown',
        mood: request.mood || 'unknown',
        duration: String(request.duration || 30),
        uploadedAt: new Date().toISOString(),
      },
    });

    return key;
  }

  /**
   * Get public URL for R2 object
   */
  private getPublicUrl(key: string): string {
    // Assumes custom domain or public bucket
    // Users should configure their own domain
    return `https://${this.r2BucketName || 'r2'}.r2.dev/${key}`;
  }

  /**
   * Create timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Audio generation timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AudioProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): AudioProvider | undefined {
    return this.providers.get(providerId);
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Create audio generation service
 */
export function createAudioGenerationService(
  providers: AudioProvider[],
  r2?: IR2Service,
  kv?: IKVService,
  r2BucketName?: string
): AudioGenerationService {
  return new AudioGenerationService(providers, r2, kv, r2BucketName);
}

/**
 * Default instance (without providers)
 */
export const audioGenerationService = new AudioGenerationService([]);
