
import type { IR2Service } from '../../r2/types/service.interface';
import type { IKVService } from '../../kv/types/service.interface';
import { generateId } from '../../../infrastructure/utils/helpers';


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

export type PublicAudioProvider = Omit<AudioProvider, 'apiKey'>;


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

    for (const provider of providers) {
      this.providers.set(provider.id, provider);
    }
  }

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

        if (!this.isRetryable(error)) {
          throw lastError;
        }

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
          options.progressCallback?.(0, `Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Audio generation failed');
  }

  private isRetryable(error: unknown): boolean {
    const status = (error as { status?: number }).status;
    if (status === undefined) return true;
    return status === 408 || status === 429 || status >= 500;
  }

  private async generateAudioInternal(
    provider: AudioProvider,
    request: AudioGenerationRequest,
    options: AudioGenerationOptions
  ): Promise<AudioGenerationResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 300000;

    const model = options.model || provider.models[0] || '';
    const payload = this.buildPayload(request, model, provider);

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeout);

    try {
      const response = await this.callProvider(provider, model, payload, timeoutController.signal);

      const audioUrl = this.extractAudioUrl(response);

      options.progressCallback?.(50, 'Downloading audio...');
      const audioBuffer = await this.downloadAudio(audioUrl, timeoutController.signal);

      return await this.finalizeResult(audioBuffer, audioUrl, request, options, startTime);
    } catch (error) {
      if (timeoutController.signal.aborted) {
        throw new Error(`Audio generation timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async finalizeResult(
    audioBuffer: ArrayBuffer,
    audioUrl: string,
    request: AudioGenerationRequest,
    options: AudioGenerationOptions,
    startTime: number
  ): Promise<AudioGenerationResult> {
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

  private async callProvider(
    provider: AudioProvider,
    model: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown> {
    const url = `${provider.baseURL}/${model}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${provider.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(
        `Provider error: ${response.status} ${errorText}`
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    return await response.json();
  }

  private extractAudioUrl(response: unknown): string {
    if (typeof response === 'object' && response !== null) {
      const r = response as Record<string, unknown>;

      if (r.audio_url) {
        const audioUrl = r.audio_url as Record<string, unknown>;
        if (audioUrl.url) {
          return String(audioUrl.url);
        }
        return String(audioUrl);
      }

      if (r.audio_url && typeof r.audio_url === 'string') {
        return r.audio_url;
      }

      if (r.url && typeof r.url === 'string') {
        return r.url;
      }

      if (r.output && typeof r.output === 'string') {
        return r.output;
      }
    }

    throw new Error('Could not extract audio URL from response');
  }

  private async downloadAudio(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    return await response.arrayBuffer();
  }

  private async uploadToR2(buffer: ArrayBuffer, request: AudioGenerationRequest): Promise<string> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const timestamp = Date.now();
    const key = `audio/generated/${timestamp}-${this.generateId()}.mp3`;

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

  private getPublicUrl(key: string): string {
    return `https://${this.r2BucketName || 'r2'}.r2.dev/${key}`;
  }

  private generateId(): string {
    return generateId();
  }

  isProviderAvailable(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  getAvailableProviders(): PublicAudioProvider[] {
    return Array.from(this.providers.values()).map(
      ({ apiKey: _apiKey, ...safe }) => safe
    );
  }

  getProvider(providerId: string): PublicAudioProvider | undefined {
    const provider = this.providers.get(providerId);
    if (!provider) return undefined;
    const { apiKey: _apiKey, ...safe } = provider;
    return safe;
  }
}


export function createAudioGenerationService(
  providers: AudioProvider[],
  r2?: IR2Service,
  kv?: IKVService,
  r2BucketName?: string
): AudioGenerationService {
  return new AudioGenerationService(providers, r2, kv, r2BucketName);
}

export const audioGenerationService = new AudioGenerationService([]);
