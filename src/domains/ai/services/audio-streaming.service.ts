
import type { IR2Service, R2GetOptions } from '../../r2/types/service.interface';


export interface AudioStreamOptions {
  enableRangeRequests: boolean;
  enableCaching: boolean;
  cacheTTL?: number;
  chunkSize?: number;
  maxChunkSize?: number;
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

const DEFAULT_CHUNK_SIZE = 256 * 1024;
const DEFAULT_CACHE_TTL = 3600;


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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) collected.push(value);
      }
    } catch (error) {
      try { await reader.cancel(); } catch {}
      throw error;
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


export function createAudioStreamingService(
  r2?: IR2Service,
  options?: Partial<AudioStreamOptions>
): AudioStreamingService {
  return new AudioStreamingService(r2, options);
}

export const audioStreamingService = createAudioStreamingService();
