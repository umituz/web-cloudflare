/**
 * Audio Streaming Service
 * @description Progressive download, chunked transfer, and range request support
 * for large audio files in Workers runtime.
 */

import type { IR2Service, R2GetOptions } from '../../r2/types/service.interface';

// ============================================================
// Types
// ============================================================

export interface AudioStreamOptions {
  enableRangeRequests: boolean;
  enableCaching: boolean;
  cacheTTL?: number;
  chunkSize?: number; // bytes
  maxChunkSize?: number; // bytes (default 10MB)
}

export interface AudioStreamChunk {
  data: ArrayBuffer;
  offset: number;
  size: number;
  isFinal: boolean;
}

export interface RangeRequest {
  start: number;
  end: number;
  size: number;
}

export interface StreamInfo {
  totalSize: number;
  mimeType: string;
  duration?: number;
  bitrate?: number;
  supportsRanges: boolean;
}

const DEFAULT_CHUNK_SIZE = 256 * 1024; // 256 KB
const DEFAULT_CACHE_TTL = 3600;

// ============================================================
// Audio Streaming Service
// ============================================================

export class AudioStreamingService {
  private r2?: IR2Service;
  private options: AudioStreamOptions;

  constructor(r2?: IR2Service, options?: Partial<AudioStreamOptions>) {
    this.r2 = r2;
    this.options = {
      enableRangeRequests: options?.enableRangeRequests ?? true,
      enableCaching: options?.enableCaching ?? true,
      cacheTTL: options?.cacheTTL,
      chunkSize: options?.chunkSize,
      maxChunkSize: options?.maxChunkSize,
    };
  }

  /**
   * Handle range request for audio streaming.
   * Returns 206 with the requested byte range, or 200 with the full body
   * when the client did not request a range.
   */
  async handleRangeRequest(
    key: string,
    rangeHeader: string | null,
    bucket?: string
  ): Promise<Response> {
    

    const metadata = await this.requireR2().head(key, this.bucketOptions(bucket));
    if (!metadata) {
      return new Response('Not Found', { status: 404 });
    }

    const totalSize = metadata.size;
    const mimeType = metadata.httpMetadata?.contentType ?? 'audio/mpeg';
    const range = this.parseRangeHeader(rangeHeader, totalSize);

    if (range) {
      return this.streamRange(key, range, totalSize, mimeType, bucket);
    }
    return this.streamFull(key, totalSize, mimeType, bucket);
  }

  /**
   * Stream audio in chunks via a ReadableStream.
   * Yields chunks until the full body has been consumed.
   */
  streamAudio(
    key: string,
    bucket?: string,
    onChunk?: (chunk: AudioStreamChunk) => void
  ): ReadableStream<Uint8Array> {
    

    const r2 = this.requireR2();
    const chunkSize = this.options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const options = this.bucketOptions(bucket);

    let offset = 0;
    let totalSize: number | null = null;

    return new ReadableStream<Uint8Array>({
      async pull(controller): Promise<void> {
        try {
          if (totalSize === null) {
            const metadata = await r2.head(key, options);
            if (!metadata) {
              controller.close();
              return;
            }
            totalSize = metadata.size;
          }

          if (offset >= totalSize) {
            controller.close();
            return;
          }

          const length = Math.min(chunkSize, totalSize - offset);
          const buffer = await r2.getBody(key, {
            ...options,
            range: { start: offset, end: offset + length - 1 },
          });

          if (!buffer) {
            controller.close();
            return;
          }

          const data = new Uint8Array(buffer);
          controller.enqueue(data);
          onChunk?.({ data: buffer, offset, size: data.byteLength, isFinal: offset + length >= totalSize });
          offset += length;
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  /**
   * Generate an HLS (HTTP Live Streaming) playlist for the audio file.
   * The caller is responsible for translating this string into a Response.
   */
  async generateHLSPlaylist(
    key: string,
    segmentDuration: number = 10,
    bucket?: string
  ): Promise<string> {
    

    const object = await this.requireR2().head(key, this.bucketOptions(bucket));
    if (!object) {
      throw new Error('Object not found');
    }

    const totalSize = object.size;
    const duration = this.parseNumberMetadata(object.customMetadata, 'duration');

    if (!duration) {
      // Without duration we cannot segment, so return a single-item playlist
      // that streams the whole file. Callers can short-circuit if they need
      // exact HLS semantics.
      return [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:1',
        '#EXT-X-MEDIA-SEQUENCE:0',
        `#EXTINF:0.0,`,
        `${key}?segment=0&start=0&end=${totalSize}`,
        '#EXT-X-ENDLIST',
      ].join('\n');
    }

    const segmentCount = Math.max(1, Math.ceil(duration / segmentDuration));
    const segmentSize = Math.ceil(totalSize / segmentCount);

    const playlist: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${Math.ceil(segmentDuration)}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
    ];

    for (let i = 0; i < segmentCount; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, totalSize);
      const segDuration = Math.min(segmentDuration, duration - i * segmentDuration);

      playlist.push(`#EXTINF:${segDuration.toFixed(2)},`);
      playlist.push(`${key}?segment=${i}&start=${start}&end=${end}`);
    }

    playlist.push('#EXT-X-ENDLIST');
    return playlist.join('\n');
  }

  /**
   * Handle an HLS segment request.
   */
  async handleHLSSegment(
    key: string,
    _segmentIndex: number,
    start: number,
    end: number,
    bucket?: string
  ): Promise<Response> {
    

    const buffer = await this.requireR2().getBody(key, {
      ...this.bucketOptions(bucket),
      range: { start, end },
    });

    if (!buffer) {
      return new Response('Segment Not Found', { status: 404 });
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': `public, max-age=${this.options.cacheTTL ?? DEFAULT_CACHE_TTL}`,
      },
    });
  }

  /**
   * Get stream info for an audio file. Returns null when the object is missing.
   */
  async getStreamInfo(key: string, bucket?: string): Promise<StreamInfo | null> {
    

    const object = await this.requireR2().head(key, this.bucketOptions(bucket));
    if (!object) {
      return null;
    }

    return {
      totalSize: object.size,
      mimeType: object.httpMetadata?.contentType ?? 'audio/mpeg',
      duration: this.parseNumberMetadata(object.customMetadata, 'duration'),
      bitrate: this.parseNumberMetadata(object.customMetadata, 'bitrate'),
      supportsRanges: this.options.enableRangeRequests,
    };
  }

  /**
   * Generate waveform data for visualization.
   * Reads the entire object into memory and computes peak amplitude per bucket.
   */
  async generateWaveform(
    key: string,
    samples: number = 1000,
    bucket?: string
  ): Promise<number[]> {
    

    const buffer = await this.requireR2().getBody(key, this.bucketOptions(bucket));
    if (!buffer) {
      throw new Error('Object not found');
    }

    const data = new Int16Array(buffer);
    const waveform: number[] = [];
    const step = Math.max(1, Math.floor(data.length / samples));

    for (let i = 0; i < samples; i++) {
      const start = i * step;
      const end = start + step;
      let max = 0;

      for (let j = start; j < end && j < data.length; j++) {
        max = Math.max(max, Math.abs(data[j]));
      }

      waveform.push(max / 32768);
    }

    return waveform;
  }

  /**
   * Progressive download with progress callback.
   */
  async progressiveDownload(
    key: string,
    onProgress: (progress: number, downloaded: number, total: number) => void,
    bucket?: string
  ): Promise<ArrayBuffer> {
    

    const metadata = await this.requireR2().head(key, this.bucketOptions(bucket));
    if (!metadata) {
      throw new Error('Object not found');
    }

    const totalSize = metadata.size;
    let downloaded = 0;
    const stream = this.streamAudio(key, bucket, (chunk) => {
      downloaded += chunk.size;
      const progress = (downloaded / totalSize) * 100;
      onProgress(progress, downloaded, totalSize);
    });

    const reader = stream.getReader();
    const collected: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(value);
    }

    const totalLength = collected.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of collected) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return result.buffer;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Returns the bound R2 service or throws. Throws first so callers can
   * safely use `!` after — TypeScript cannot narrow the class's `r2?`
   * field through an assertion signature in all targets.
   */
  private requireR2(): IR2Service {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }
    return this.r2;
  }

  private bucketOptions(bucket?: string): R2GetOptions {
    return bucket ? { binding: bucket } : {};
  }

  private parseNumberMetadata(
    metadata: Record<string, unknown> | undefined,
    key: string
  ): number | undefined {
    if (!metadata) return undefined;
    const raw = metadata[key];
    if (raw === undefined || raw === null) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /**
   * Parse a Range header into a concrete byte range.
   * Returns null if the header is missing, malformed, or unsatisfiable.
   */
  private parseRangeHeader(rangeHeader: string | null, totalSize: number): RangeRequest | null {
    if (!rangeHeader) return null;

    const matches = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (!matches) return null;

    const start = parseInt(matches[1], 10);
    if (!Number.isFinite(start) || start < 0) return null;

    const end = matches[2] ? parseInt(matches[2], 10) : totalSize - 1;
    if (!Number.isFinite(end)) return null;

    const safeEnd = Math.min(end, totalSize - 1);
    if (safeEnd < start) return null;

    return { start, end: safeEnd, size: safeEnd - start + 1 };
  }

  /**
   * Stream a specific byte range of an audio file as a 206 response.
   */
  private async streamRange(
    key: string,
    range: RangeRequest,
    totalSize: number,
    mimeType: string,
    bucket?: string
  ): Promise<Response> {
    

    const buffer = await this.requireR2().getBody(key, {
      ...this.bucketOptions(bucket),
      range: { start: range.start, end: range.end },
    });

    if (!buffer) {
      return new Response('Range Not Satisfiable', { status: 416 });
    }

    return new Response(buffer, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
        'Content-Length': String(buffer.byteLength),
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': `public, max-age=${this.options.cacheTTL ?? DEFAULT_CACHE_TTL}`,
      },
    });
  }

  /**
   * Stream the full audio file as a 200 response.
   */
  private async streamFull(
    key: string,
    totalSize: number,
    mimeType: string,
    bucket?: string
  ): Promise<Response> {
    

    const buffer = await this.requireR2().getBody(key, this.bucketOptions(bucket));
    if (!buffer) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Length': String(buffer.byteLength),
        'Content-Type': mimeType,
        'Accept-Ranges': this.options.enableRangeRequests ? 'bytes' : 'none',
        'Cache-Control': `public, max-age=${this.options.cacheTTL ?? DEFAULT_CACHE_TTL}`,
      },
    });
  }
}

// ============================================================
// Factory Function
// ============================================================

export function createAudioStreamingService(
  r2?: IR2Service,
  options?: Partial<AudioStreamOptions>
): AudioStreamingService {
  return new AudioStreamingService(r2, options);
}

// Default singleton — useful for stateless Workers, but consumers should
// prefer `createAudioStreamingService(r2Service)` so the R2 binding is wired
// in rather than relying on a later `bind*` call.
export const audioStreamingService = createAudioStreamingService();
