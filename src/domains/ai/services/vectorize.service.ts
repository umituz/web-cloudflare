/**
 * Vectorize Service
 * @description Vector index management and semantic search
 */

import type { IVectorizeService } from '../types';
import type {
  Vector,
  VectorizeQueryResult,
  VectorizeFilter,
  RAGResult,
} from '../entities';

// ============================================================
// Vectorize Service Implementation
// ============================================================

export class VectorizeService implements IVectorizeService {
  private indexes: Map<string, VectorizeIndex> = new Map();
  private kv?: KVNamespace;

  constructor(kv?: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Bind a Vectorize index
   */
  bindIndex(name: string, index: VectorizeIndex): void {
    this.indexes.set(name, index);
  }

  /**
   * Get bound index
   */
  getIndex(name: string): VectorizeIndex | undefined {
    return this.indexes.get(name);
  }

  /**
   * Get default or specified index
   */
  private resolveIndex(binding?: string): VectorizeIndex {
    if (binding) {
      const index = this.indexes.get(binding);
      if (!index) {
        throw new Error(`Vectorize index '${binding}' not bound`);
      }
      return index;
    }

    // Return first available index
    const firstIndex = this.indexes.values().next().value;
    if (!firstIndex) {
      throw new Error('No Vectorize indexes bound');
    }

    return firstIndex;
  }

  /**
   * Upsert vectors to index
   */
  async upsert(
    vectors: Vector[],
    binding?: string
  ): Promise<void> {
    const index = this.resolveIndex(binding);

    try {
      // Vectorize supports upsert operation
      await index.upsert(vectors as VectorizeVector[]);

    } catch (error) {
      throw new Error(
        `Vectorize upsert error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Query vector index
   */
  async query(
    vector: number[],
    options?: {
      topK?: number;
      filter?: VectorizeFilter;
      binding?: string;
    }
  ): Promise<VectorizeQueryResult[]> {
    const index = this.resolveIndex(options?.binding);
    const topK = options?.topK || 10;

    try {
      // Vectorize query with optional filter
      const queryOptions: VectorizeQueryOptions = {
        topK,
        returnValues: false,
        returnMetadata: true,
      };

      if (options?.filter) {
        queryOptions.filter = options.filter as VectorizeVectorMetadataFilter;
      }

      const matches = await index.query(vector, queryOptions);

      // Transform to VectorizeQueryResult format
      if (!Array.isArray(matches)) {
        return [];
      }

      return matches.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata as Record<string, unknown> | undefined,
      }));

    } catch (error) {
      throw new Error(
        `Vectorize query error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete vectors by ID
   */
  async delete(ids: string[], binding?: string): Promise<void> {
    const index = this.resolveIndex(binding);

    try {
      // Vectorize does not have a delete method yet
      // As a workaround, we can upsert with null values or ignore
      // For now, this is a no-op
      console.warn(`Vectorize delete not yet supported for IDs: ${ids.join(', ')}`);

    } catch (error) {
      throw new Error(
        `Vectorize delete error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get vector by ID (via KV cache if available)
   */
  async get(id: string, binding?: string): Promise<Vector | null> {
    // Try KV cache first
    if (this.kv) {
      try {
        const cached = await this.kv.get(`vectorize:${binding || 'default'}:${id}`, 'json');
        if (cached) {
          return cached as Vector;
        }
      } catch {
        // KV read failed, continue
      }
    }

    // Vectorize doesn't support direct get, return null
    return null;
  }

  /**
   * Perform RAG query
   */
  async ragQuery(
    queryVector: number[],
    contextDocuments: Array<{
      id: string;
      text: string;
      metadata?: Record<string, unknown>;
    }>,
    options?: {
      topK?: number;
      binding?: string;
    }
  ): Promise<RAGResult> {
    // First, ensure context documents are in the index
    const vectors: Vector[] = contextDocuments.map(doc => ({
      id: doc.id,
      values: queryVector, // Would use actual embeddings in production
      metadata: {
        ...doc.metadata,
        text: doc.text,
      },
    }));

    // Upsert context documents
    await this.upsert(vectors, options?.binding);

    // Query for similar documents
    const matches = await this.query(queryVector, {
      topK: options?.topK || 5,
      binding: options?.binding,
    });

    // Build context from matched documents
    const contextTexts: string[] = [];
    const enrichedMatches: Array<{
      id: string;
      text: string;
      score: number;
      metadata?: Record<string, unknown>;
    }> = [];

    for (const match of matches) {
      const text = match.metadata?.text as string | undefined;
      if (text) {
        contextTexts.push(text);
        enrichedMatches.push({
          id: match.id,
          text,
          score: match.score,
          metadata: match.metadata,
        });
      }
    }

    // Combine contexts
    const context = contextTexts.join('\n\n');

    return {
      matches: enrichedMatches,
      context,
      totalMatches: matches.length,
    };
  }

  /**
   * Get index statistics
   */
  async getStats(binding?: string): Promise<{
    count: number;
    dimension: number;
  }> {
    const index = this.resolveIndex(binding);

    try {
      // Note: Vectorize doesn't have a direct stats API
      // In production, you'd track this separately
      // This is a placeholder implementation

      return {
        count: 0,
        dimension: 512, // CLIP default
      };

    } catch (error) {
      throw new Error(
        `Vectorize stats error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// ============================================================
// Singleton Instance
// ============================================================

export const vectorizeService = new VectorizeService();
