/**
 * Audio Format Utilities
 * @description Utilities for audio format conversion, quality optimization,
 * and metadata extraction. Supports both browser and Workers runtime.
 */

// ============================================================
// Types
// ============================================================

export interface AudioFormatInfo {
  format: AudioFormat;
  mimeType: string;
  extension: string;
  codecs: string[];
  quality: 'low' | 'medium' | 'high';
  maxBitrate: number;
  maxSampleRate: number;
}

export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'aac' | 'm4a' | 'webm';

export interface AudioMetadata {
  format: AudioFormat;
  duration?: number; // seconds
  bitrate?: number; // kbps
  sampleRate?: number; // Hz
  channels?: number;
  codec?: string;
  size: number; // bytes
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
}

export interface AudioConversionOptions {
  targetFormat: AudioFormat;
  quality?: 'low' | 'medium' | 'high';
  bitrate?: number; // kbps
  sampleRate?: number; // Hz
  channels?: number; // 1 for mono, 2 for stereo
  normalize?: boolean;
  trimStart?: number; // seconds
  trimEnd?: number; // seconds
}

export interface AudioConversionResult {
  data: ArrayBuffer;
  format: AudioFormat;
  metadata: AudioMetadata;
  size: number;
  duration?: number;
}

// ============================================================
// Audio Format Constants
// ============================================================

export const AUDIO_FORMATS: Record<AudioFormat, AudioFormatInfo> = {
  mp3: {
    format: 'mp3',
    mimeType: 'audio/mpeg',
    extension: 'mp3',
    codecs: ['mp3', 'mpeg'],
    quality: 'medium',
    maxBitrate: 320,
    maxSampleRate: 48000,
  },
  wav: {
    format: 'wav',
    mimeType: 'audio/wav',
    extension: 'wav',
    codecs: ['pcm', 'adpcm'],
    quality: 'high',
    maxBitrate: 1411,
    maxSampleRate: 192000,
  },
  ogg: {
    format: 'ogg',
    mimeType: 'audio/ogg',
    extension: 'ogg',
    codecs: ['vorbis', 'opus'],
    quality: 'medium',
    maxBitrate: 256,
    maxSampleRate: 48000,
  },
  flac: {
    format: 'flac',
    mimeType: 'audio/flac',
    extension: 'flac',
    codecs: ['flac'],
    quality: 'high',
    maxBitrate: 1000,
    maxSampleRate: 192000,
  },
  aac: {
    format: 'aac',
    mimeType: 'audio/aac',
    extension: 'aac',
    codecs: ['aac'],
    quality: 'medium',
    maxBitrate: 256,
    maxSampleRate: 48000,
  },
  m4a: {
    format: 'm4a',
    mimeType: 'audio/mp4',
    extension: 'm4a',
    codecs: ['aac'],
    quality: 'medium',
    maxBitrate: 256,
    maxSampleRate: 48000,
  },
  webm: {
    format: 'webm',
    mimeType: 'audio/webm',
    extension: 'webm',
    codecs: ['opus', 'vorbis'],
    quality: 'medium',
    maxBitrate: 256,
    maxSampleRate: 48000,
  },
};

// ============================================================
// Audio Format Utilities Class
// ============================================================

export class AudioFormatUtils {
  /**
   * Detect audio format from ArrayBuffer
   */
  static detectFormat(buffer: ArrayBuffer): AudioFormat | null {
    const header = new Uint8Array(buffer, 0, 12);

    // MP3: ID3 tag or sync bytes
    if (this.isMP3(header)) return 'mp3';

    // WAV: RIFF header
    if (this.isWAV(header)) return 'wav';

    // OGG: OggS header
    if (this.isOGG(header)) return 'ogg';

    // FLAC: fLaC marker
    if (this.isFLAC(header)) return 'flac';

    // AAC: ADTS header
    if (this.isAAC(header)) return 'aac';

    // M4A: ftyp header
    if (this.isM4A(header)) return 'm4a';

    // WebM: EBML header
    if (this.isWebM(header)) return 'webm';

    return null;
  }

  /**
   * Extract metadata from audio buffer
   */
  static extractMetadata(buffer: ArrayBuffer): AudioMetadata {
    const format = this.detectFormat(buffer);
    const metadata: AudioMetadata = {
      format: format || 'mp3',
      size: buffer.byteLength,
    };

    // Try to extract more metadata based on format
    if (format === 'mp3') {
      Object.assign(metadata, this.extractMP3Metadata(buffer));
    } else if (format === 'wav') {
      Object.assign(metadata, this.extractWAVMetadata(buffer));
    } else if (format === 'flac') {
      Object.assign(metadata, this.extractFLACMetadata(buffer));
    }

    return metadata;
  }

  /**
   * Convert audio format (simplified - actual conversion requires external library)
   * @note In Workers runtime, use external services like FAL AI or Replicate
   */
  static async convertFormat(
    buffer: ArrayBuffer,
    options: AudioConversionOptions
  ): Promise<AudioConversionResult> {
    const currentFormat = this.detectFormat(buffer);

    if (!currentFormat) {
      throw new Error('Unable to detect audio format');
    }

    if (currentFormat === options.targetFormat) {
      // No conversion needed, just apply transformations
      const metadata = this.extractMetadata(buffer);
      return {
        data: buffer,
        format: options.targetFormat,
        metadata,
        size: buffer.byteLength,
        duration: metadata.duration,
      };
    }

    // In a real implementation, this would use audio processing libraries
    // For Workers, we recommend using external services
    throw new Error(
      `Audio conversion from ${currentFormat} to ${options.targetFormat} requires external service. ` +
      'Use AudioGenerationService with FAL AI or Replicate for conversion.'
    );
  }

  /**
   * Optimize audio for web streaming
   */
  static async optimizeForWeb(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const format = this.detectFormat(buffer);

    if (format === 'mp3') {
      // MP3 is already web-optimized, check bitrate
      const metadata = this.extractMetadata(buffer);
      if (metadata.bitrate && metadata.bitrate > 128) {
        // Recommend re-encoding at lower bitrate
        throw new Error('Bitrate too high for web streaming. Use external service to re-encode.');
      }
      return buffer;
    }

    // Convert to MP3 for web optimization
    const result = await this.convertFormat(buffer, {
      targetFormat: 'mp3',
      quality: 'medium',
      bitrate: 128,
    });

    return result.data;
  }

  /**
   * Normalize audio volume
   */
  static async normalizeVolume(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    // Requires audio processing library
    throw new Error(
      'Audio normalization requires external service. ' +
      'Use AudioGenerationService with audio processing provider.'
    );
  }

  /**
   * Trim audio file
   */
  static async trimAudio(
    buffer: ArrayBuffer,
    startSeconds: number,
    endSeconds?: number
  ): Promise<ArrayBuffer> {
    // Requires audio processing library
    throw new Error(
      'Audio trimming requires external service. ' +
      'Use AudioGenerationService with audio processing provider.'
    );
  }

  /**
   * Get audio duration from buffer
   */
  static getDuration(buffer: ArrayBuffer): number | null {
    const format = this.detectFormat(buffer);

    if (format === 'mp3') {
      return this.getMP3Duration(buffer);
    } else if (format === 'wav') {
      return this.getWAVDuration(buffer);
    } else if (format === 'flac') {
      return this.getFLACDuration(buffer);
    }

    return null;
  }

  /**
   * Generate waveform data for visualization
   */
  static generateWaveform(buffer: ArrayBuffer, samples: number = 1000): number[] {
    // Simplified waveform generation
    const data = new Int16Array(buffer);
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
   * Validate audio file
   */
  static validateAudio(buffer: ArrayBuffer): { valid: boolean; error?: string } {
    const format = this.detectFormat(buffer);

    if (!format) {
      return { valid: false, error: 'Unknown audio format' };
    }

    const metadata = this.extractMetadata(buffer);

    if (metadata.size < 1024) {
      return { valid: false, error: 'Audio file too small' };
    }

    if (metadata.duration && metadata.duration > 3600) {
      return { valid: false, error: 'Audio file too long (max 1 hour)' };
    }

    return { valid: true };
  }

  // ============================================================
  // Format Detection Helpers
  // ============================================================

  private static isMP3(header: Uint8Array): boolean {
    // Check for ID3 tag
    if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
      return true;
    }
    // Check for MPEG sync bytes
    if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
      return true;
    }
    return false;
  }

  private static isWAV(header: Uint8Array): boolean {
    return (
      header[0] === 0x52 && // R
      header[1] === 0x49 && // I
      header[2] === 0x46 && // F
      header[3] === 0x46 && // F
      header[8] === 0x57 && // W
      header[9] === 0x41 && // A
      header[10] === 0x56 && // V
      header[11] === 0x45 // E
    );
  }

  private static isOGG(header: Uint8Array): boolean {
    return (
      header[0] === 0x4F && // O
      header[1] === 0x67 && // g
      header[2] === 0x67 && // g
      header[3] === 0x53 // S
    );
  }

  private static isFLAC(header: Uint8Array): boolean {
    return (
      header[0] === 0x66 && // f
      header[1] === 0x4C && // L
      header[2] === 0x61 && // a
      header[3] === 0x43 // C
    );
  }

  private static isAAC(header: Uint8Array): boolean {
    // ADTS sync word
    return (header[0] === 0xFF && (header[1] & 0xF0) === 0xF0);
  }

  private static isM4A(header: Uint8Array): boolean {
    return (
      header[4] === 0x66 && // f
      header[5] === 0x74 && // t
      header[6] === 0x79 && // y
      header[7] === 0x70 // p
    );
  }

  private static isWebM(header: Uint8Array): boolean {
    return (
      header[0] === 0x1A &&
      header[1] === 0x45 &&
      header[2] === 0xDF &&
      header[3] === 0xA3
    );
  }

  // ============================================================
  // Metadata Extraction
  // ============================================================

  private static extractMP3Metadata(buffer: ArrayBuffer): Partial<AudioMetadata> {
    const metadata: Partial<AudioMetadata> = {};
    const view = new DataView(buffer);

    // Try to find ID3 tag
    if (this.isMP3(new Uint8Array(buffer, 0, 3))) {
      // ID3v2 header
      const size = (view.getUint32(6) >>> 0) + 10;
      // Parse ID3 tags here if needed
    }

    // Get duration from MP3 frame headers (simplified)
    metadata.duration = this.getMP3Duration(buffer) ?? undefined;

    return metadata;
  }

  private static extractWAVMetadata(buffer: ArrayBuffer): Partial<AudioMetadata> {
    const metadata: Partial<AudioMetadata> = {};
    const view = new DataView(buffer);

    // Skip RIFF header
    let offset = 12;

    // Find fmt chunk
    while (offset < buffer.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );

      if (chunkId === 'fmt ') {
        metadata.channels = view.getUint16(offset + 10, true);
        metadata.sampleRate = view.getUint32(offset + 12, true);
        const byteRate = view.getUint32(offset + 16, true);
        const bitsPerSample = view.getUint16(offset + 22, true);
        metadata.bitrate = Math.round(byteRate * 8 / 1000);
        metadata.codec = bitsPerSample === 16 ? 'PCM16' : `PCM${bitsPerSample}`;
        break;
      }

      const chunkSize = view.getUint32(offset + 4, true);
      offset += 8 + chunkSize;
    }

    // Calculate duration
    if (metadata.bitrate && metadata.bitrate > 0) {
      metadata.duration = (buffer.byteLength * 8) / (metadata.bitrate * 1000);
    }

    return metadata;
  }

  private static extractFLACMetadata(buffer: ArrayBuffer): Partial<AudioMetadata> {
    const metadata: Partial<AudioMetadata> = {};

    // FLAC metadata parsing (simplified)
    metadata.duration = this.getFLACDuration(buffer) ?? undefined;

    return metadata;
  }

  // ============================================================
  // Duration Calculation
  // ============================================================

  private static getMP3Duration(buffer: ArrayBuffer): number | null {
    // Simplified MP3 duration calculation
    // In production, use a proper MP3 parser
    const view = new DataView(buffer);
    let offset = 0;
    let frameCount = 0;
    let bitrateSum = 0;

    while (offset < buffer.byteLength - 4) {
      if ((view.getUint8(offset) & 0xFF) === 0xFF &&
          ((view.getUint8(offset + 1) & 0xE0) >> 5) === 0x07) {
        // Found MPEG frame
        const bitrateIndex = (view.getUint8(offset + 2) & 0xF0) >> 4;
        const sampleRateIndex = (view.getUint8(offset + 2) & 0x0C) >> 2;

        // Layer III bitrate table
        const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
        const sampleRates = [44100, 48000, 32000];

        if (bitrateIndex > 0 && bitrateIndex < 16 && sampleRateIndex < 3) {
          bitrateSum += bitrates[bitrateIndex];
          frameCount++;
        }

        // Skip to next frame (rough estimate)
        offset += 1000;
      } else {
        offset++;
      }

      if (frameCount >= 100) break; // Sample 100 frames
    }

    if (frameCount > 0) {
      const avgBitrate = bitrateSum / frameCount;
      return (buffer.byteLength * 8) / (avgBitrate * 1000);
    }

    return null;
  }

  private static getWAVDuration(buffer: ArrayBuffer): number | null {
    const metadata = this.extractWAVMetadata(buffer);
    if (metadata.bitrate && metadata.bitrate > 0) {
      return (buffer.byteLength * 8) / (metadata.bitrate * 1000);
    }
    return null;
  }

  private static getFLACDuration(buffer: ArrayBuffer): number | null {
    // FLAC duration calculation requires parsing metadata blocks
    // This is a simplified version
    return null;
  }

  // ============================================================
  // Utility Functions
  // ============================================================

  /**
   * Convert audio buffer to base64
   */
  static toBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 to audio buffer
   */
  static fromBase64(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get MIME type for format
   */
  static getMimeType(format: AudioFormat): string {
    return AUDIO_FORMATS[format]?.mimeType || 'audio/mpeg';
  }

  /**
   * Get file extension for format
   */
  static getExtension(format: AudioFormat): string {
    return AUDIO_FORMATS[format]?.extension || 'mp3';
  }

  /**
   * Get recommended bitrate for quality
   */
  static getRecommendedBitrate(format: AudioFormat, quality: 'low' | 'medium' | 'high'): number {
    const formatInfo = AUDIO_FORMATS[format];

    if (quality === 'low') {
      return Math.min(64, formatInfo.maxBitrate);
    } else if (quality === 'medium') {
      return Math.min(128, formatInfo.maxBitrate);
    } else {
      return Math.min(256, formatInfo.maxBitrate);
    }
  }
}

// ============================================================
// Export Helper Functions
// ============================================================

export const detectAudioFormat = AudioFormatUtils.detectFormat.bind(AudioFormatUtils);
export const extractAudioMetadata = AudioFormatUtils.extractMetadata.bind(AudioFormatUtils);
export const convertAudioFormat = AudioFormatUtils.convertFormat.bind(AudioFormatUtils);
export const optimizeAudioForWeb = AudioFormatUtils.optimizeForWeb.bind(AudioFormatUtils);
export const getAudioDuration = AudioFormatUtils.getDuration.bind(AudioFormatUtils);
export const generateAudioWaveform = AudioFormatUtils.generateWaveform.bind(AudioFormatUtils);
export const validateAudio = AudioFormatUtils.validateAudio.bind(AudioFormatUtils);
export const audioToBase64 = AudioFormatUtils.toBase64.bind(AudioFormatUtils);
export const base64ToAudio = AudioFormatUtils.fromBase64.bind(AudioFormatUtils);
