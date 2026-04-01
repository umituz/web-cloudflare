/**
 * Audio Streaming Service
 * @description Progressive download, chunked transfer, and range request support
 * for large audio files in Workers runtime.
 */

import type { IR2Service } from '../../r2/types/service.interface';

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

// ============================================================
// Audio Streaming Service
// ============================================================

export class AudioStreamingService {
  private r2?: IR2Service;
  private options: AudioStreamOptions;

  constructor(r2?: IR2Service, options?: Partial<AudioStreamOptions>) {
    this.r2 = r2;
    this.options = {
      enableRangeRequests: true,
      enableCaching: true,
      cacheTTL: 3600,
      chunkSize: 256 * 1024, // 256KB default
      maxChunkSize: 10 * 1024 * 1024, // 10MB max
      ...options,
    };
  }

  /**
   * Handle range request for audio streaming
   */
  async handleRangeRequest(
    key: string,
    rangeHeader: string | null,
    bucket?: string
  ): Promise<Response> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    // Get object metadata
    const object = await this.r2.head(key, bucket ? { binding: bucket } : undefined);
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const totalSize = object.size;
    const mimeType = object.httpMetadata?.contentType || 'audio/mpeg';

    // Parse range header
    const range = this.parseRangeHeader(rangeHeader, totalSize);

    // Handle range request
    if (range && this.options.enableRangeRequests) {
      return this.streamRange(key, range, totalSize, mimeType, bucket);
    }

    // Handle full request
    return this.streamFull(key, totalSize, mimeType, bucket);
  }

  /**
   * Stream audio with chunked transfer
   */
  async streamAudio(
    key: string,
    bucket?: string,
    onChunk?: (chunk: AudioStreamChunk) => void
  ): Promise<ReadableStream<Uint8Array>> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const object = await this.r2.head(key, bucket ? { binding: bucket } : undefined);
    if (!object) {
      throw new Error('Object not found');
    }

    const totalSize = object.size;
    let offset = 0;

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const chunkSize = Math.min(
          this.options.chunkSize || 256 * 1024,
          totalSize - offset
        );

        if (chunkSize === 0) {
          controller.close();
          return;
        }

        try {
          const chunk = await this.r2!.get(
            key,
            bucket ? { binding: bucket, range: { offset, length: chunkSize } } : { range: { offset, length: chunkSize } }
          );

          if (!chunk) {
            controller.close();
            return;
          }

          const arrayBuffer = await chunk.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);

          controller.enqueue(data);

          // Notify callback
          onChunk?.({
            data: arrayBuffer,
            offset,
            size: chunkSize,
            isFinal: offset + chunkSize >= totalSize,
          });

          offset += chunkSize;
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        // Cleanup if needed
      },
    });
  }

  /**
   * Generate streaming response with proper headers
   */
  generateStreamingResponse(
    stream: ReadableStream<Uint8Array>,
    info: StreamInfo,
    range?: RangeRequest
  ): Response {
    const headers = new Headers();

    // Content-Type
    headers.set('Content-Type', info.mimeType);

    // Accept-Ranges
    if (info.supportsRanges) {
      headers.set('Accept-Ranges', 'bytes');
    }

    // Content-Length
    if (range) {
      headers.set('Content-Length', String(range.size));
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${info.totalSize}`);
    } else {
      headers.set('Content-Length', String(info.totalSize));
    }

    // Cache headers
    if (this.options.enableCaching) {
      headers.set('Cache-Control', `public, max-age=${this.options.cacheTTL || 3600}`);
    }

    // CORS headers
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range');

    // Streaming headers
    headers.set('Transfer-Encoding', 'chunked');
    headers.set('X-Content-Duration', String(info.duration || 0));

    return new Response(stream, {
      status: range ? 206 : 200,
      headers,
    });
  }

  /**
   * Generate HLS (HTTP Live Streaming) playlist
   */
  async generateHLSPlaylist(
    key: string,
    segmentDuration: number = 10,
    bucket?: string
  ): Promise<string> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const object = await this.r2.head(key, bucket ? { binding: bucket } : undefined);
    if (!object) {
      throw new Error('Object not found');
    }

    const totalSize = object.size;
    const duration = object.customMetadata?.duration ?
      Number(object.customMetadata.duration) :
      0;

    // Estimate segments
    const segmentCount = Math.ceil(duration / segmentDuration);
    const segmentSize = Math.ceil(totalSize / segmentCount);

    // Generate M3U8 playlist
    const playlist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:' + Math.ceil(segmentDuration),
      '#EXT-X-MEDIA-SEQUENCE:0',
    ];

    for (let i = 0; i < segmentCount; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, totalSize);
      const segDuration = Math.min(segmentDuration, duration - (i * segmentDuration));

      playlist.push(`#EXTINF:${segDuration.toFixed(2)},`);
      playlist.push(`${key}?segment=${i}&start=${start}&end=${end}`);
    }

    playlist.push('#EXT-X-ENDLIST');

    return playlist.join('\n');
  }

  /**
   * Handle HLS segment request
   */
  async handleHLSSegment(
    key: string,
    segmentIndex: number,
    start: number,
    end: number,
    bucket?: string
  ): Promise<Response> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const range = { start, end };

    const object = await this.r2.get(
      key,
      bucket ? { binding: bucket, range } : { range }
    );

    if (!object) {
      return new Response('Segment Not Found', { status: 404 });
    }

    const arrayBuffer = await object.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(arrayBuffer.byteLength),
        'Cache-Control': `public, max-age=${this.options.cacheTTL || 3600}`,
      },
    });
  }

  /**
   * Get stream info for audio file
   */
  async getStreamInfo(key: string, bucket?: string): Promise<StreamInfo | null> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const object = await this.r2.head(key, bucket ? { binding: bucket } : undefined);
    if (!object) {
      return null;
    }

    return {
      totalSize: object.size,
      mimeType: object.httpMetadata?.contentType || 'audio/mpeg',
      duration: object.customMetadata?.duration ?
        Number(object.customMetadata.duration) :
        undefined,
      bitrate: object.customMetadata?.bitrate ?
        Number(object.customMetadata.bitrate) :
        undefined,
      supportsRanges: this.options.enableRangeRequests,
    };
  }

  /**
   * Generate waveform data for visualization
   */
  async generateWaveform(
    key: string,
    samples: number = 1000,
    bucket?: string
  ): Promise<number[]> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const object = await this.r2.get(key, bucket ? { binding: bucket } : undefined);
    if (!object) {
      throw new Error('Object not found');
    }

    const arrayBuffer = await object.arrayBuffer();
    const data = new Int16Array(arrayBuffer);
    const waveform: number[] = [];
    const step = Math.floor(data.length / samples);

    for (let i = 0; i < samples; i++) {
      const start = i * step;
      const end = start + step;
      let max = 0;

      for (let j = start; j < end && j < data.length; j++) {
        max = Math.max(max, Math.abs(data[j]));
      }

      waveform.push(max / 32768); // Normalize to 0-1
    }

    return waveform;
  }

  /**
   * Progressive download with progress callback
   */
  async progressiveDownload(
    key: string,
    onProgress: (progress: number, downloaded: number, total: number) => void,
    bucket?: string
  ): Promise<ArrayBuffer> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const object = await this.r2.head(key, bucket ? { binding: bucket } : undefined);
    if (!object) {
      throw new Error('Object not found');
    }

    const totalSize = object.size;
    const chunks: ArrayBuffer[] = [];
    let downloaded = 0;

    const stream = await this.streamAudio(key, bucket, (chunk) => {
      downloaded += chunk.size;
      const progress = (downloaded / totalSize) * 100;
      onProgress(progress, downloaded, totalSize);
    });

    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value.buffer);
    }

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return result.buffer;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Parse Range header
   */
  private parseRangeHeader(rangeHeader: string | null, totalSize: number): RangeRequest | null {
    if (!rangeHeader) return null;

    const matches = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (!matches) return null;

    const start = parseInt(matches[1], 10);
    const end = matches[2] ? parseInt(matches[2], 10) : totalSize - 1;

    return {
      start: Math.max(0, start),
      end: Math.min(end, totalSize - 1),
      size: end - start + 1,
    };
  }

  /**
   * Stream range of audio file
   */
  private async streamRange(
    key: string,
    range: RangeRequest,
    totalSize: number,
    mimeType: string,
    bucket?: string
  ): Promise<Response> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const object = await this.r2.get(
      key,
      bucket ? { binding: bucket, range: { offset: range.start, length: range.size } } : undefined
    );

    if (!object) {
      return new Response('Range Not Satisfiable', { status: 416 });
    }

    const arrayBuffer = await object.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
        'Content-Length': String(range.size),
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': `public, max-age=${this.options.cacheTTL || 3600}`,
      },
    });
  }

  /**
   * Stream full audio file
   */
  private async streamFull(
    key: string,
    totalSize: number,
    mimeType: string,
    bucket?: string
  ): Promise<Response> {
    if (!this.r2) {
      throw new Error('R2 service not configured');
    }

    const object = await this.r2.get(key, bucket ? { binding: bucket } : undefined);
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const arrayBuffer = await object.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Length': String(arrayBuffer.byteLength),
        'Content-Type': mimeType,
        'Accept-Ranges': this.options.enableRangeRequests ? 'bytes' : 'none',
        'Cache-Control': `public, max-age=${this.options.cacheTTL || 3600}`,
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

/**
 * Default instance
 */
export const audioStreamingService = new AudioStreamingService();
