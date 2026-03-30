/**
 * Embedding Service
 * @description Text and image embedding generation with similarity calculation
 */

import type { IEmbeddingService } from '../types';
import type { WorkersAIBinding } from '../../../config/types';

// ============================================================
// Embedding Service Implementation
// ============================================================

export class EmbeddingService implements IEmbeddingService {
  private env: {
    AI?: WorkersAIBinding;
    bindings?: {
      AI?: WorkersAIBinding;
    };
  };

  constructor(env: { AI?: WorkersAIBinding; bindings?: { AI?: WorkersAIBinding } }) {
    this.env = env;
  }

  /**
   * Get Workers AI binding
   */
  private getAI(): WorkersAIBinding | null {
    return this.env.bindings?.AI || this.env.AI || null;
  }

  /**
   * Generate text embedding
   */
  async generateTextEmbedding(
    text: string | string[],
    model: string = '@cf/openai/clip-vit-base-patch32'
  ): Promise<number[] | number[][]> {
    const ai = this.getAI();

    if (!ai) {
      throw new Error('Workers AI binding not configured');
    }

    // Handle batch of texts
    if (Array.isArray(text)) {
      const embeddings = await Promise.all(
        text.map(t => this.generateSingleTextEmbedding(t, model, ai))
      );
      return embeddings;
    }

    // Single text
    return this.generateSingleTextEmbedding(text, model, ai);
  }

  /**
   * Generate single text embedding
   */
  private async generateSingleTextEmbedding(
    text: string,
    model: string,
    ai: WorkersAIBinding
  ): Promise<number[]> {
    try {
      const response = await ai.run(model, { text });

      if (!response) {
        throw new Error('No response from Workers AI');
      }

      const r = response as Record<string, unknown>;

      // Extract embedding array
      const embedding = r.embedding as number[] | undefined ||
                       r.data as number[] | undefined ||
                       (r.output as { embedding?: number[] })?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response format');
      }

      return embedding;

    } catch (error) {
      throw new Error(
        `Embedding generation error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate image embedding
   */
  async generateImageEmbedding(
    image: ArrayBuffer | string,
    model: string = '@cf/openai/clip-vit-base-patch32'
  ): Promise<number[]> {
    const ai = this.getAI();

    if (!ai) {
      throw new Error('Workers AI binding not configured');
    }

    try {
      let input: unknown;

      if (typeof image === 'string') {
        // Image URL or base64
        input = { image };
      } else {
        // ArrayBuffer (will be converted to base64)
        const base64 = this.arrayBufferToBase64(image);
        input = { image: base64 };
      }

      const response = await ai.run(model, input as Record<string, unknown>);

      if (!response) {
        throw new Error('No response from Workers AI');
      }

      const r = response as Record<string, unknown>;

      // Extract embedding array
      const embedding = r.embedding as number[] | undefined ||
                       r.data as number[] | undefined ||
                       (r.output as { embedding?: number[] })?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response format');
      }

      return embedding;

    } catch (error) {
      throw new Error(
        `Image embedding error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate embeddings in batch
   */
  async batchEmbeddings(
    inputs: string[],
    options: {
      batchSize?: number;
      model?: string;
    } = {}
  ): Promise<number[][]> {
    const { batchSize = 100, model = '@cf/openai/clip-vit-base-patch32' } = options;

    if (inputs.length === 0) {
      return [];
    }

    // Process in batches
    const results: number[][] = [];

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateTextEmbedding(text, model))
      );
      results.push(...(batchEmbeddings as number[][]));
    }

    return results;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  calculateSimilarity(
    embedding1: number[],
    embedding2: number[]
  ): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Find most similar embedding from candidates
   */
  findMostSimilar(
    query: number[],
    candidates: number[][]
  ): { index: number; score: number } {
    if (candidates.length === 0) {
      return { index: -1, score: 0 };
    }

    let maxScore = -1;
    let maxIndex = 0;

    for (let i = 0; i < candidates.length; i++) {
      const score = this.calculateSimilarity(query, candidates[i]);
      if (score > maxScore) {
        maxScore = score;
        maxIndex = i;
      }
    }

    return { index: maxIndex, score: maxScore };
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// ============================================================
// Singleton Instance
// ============================================================

export const embeddingService = new EmbeddingService({});
