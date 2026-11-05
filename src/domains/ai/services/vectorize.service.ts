
import type { IVectorizeService } from '../types';
import type {
  Vector,
  VectorizeQueryResult,
  VectorizeFilter,
  RAGResult,
} from '../entities';


export class VectorizeService implements IVectorizeService {
  private indexes: Map<string, VectorizeIndex> = new Map();
  private kv?: KVNamespace;

  constructor(kv?: KVNamespace) {
    this.kv = kv;
  }

  bindIndex(name: string, index: VectorizeIndex): void {
    this.indexes.set(name, index);
  }

  getIndex(name: string): VectorizeIndex | undefined {
    return this.indexes.get(name);
  }

  private resolveIndex(binding?: string): VectorizeIndex {
    if (binding) {
      const index = this.indexes.get(binding);
      if (!index) {
        throw new Error(`Vectorize index '${binding}' not bound`);
      }
      return index;
    }

    const firstIndex = this.indexes.values().next().value;
    if (!firstIndex) {
      throw new Error('No Vectorize indexes bound');
    }

    return firstIndex;
  }

  async upsert(
    vectors: Vector[],
    binding?: string
  ): Promise<void> {
    const index = this.resolveIndex(binding);

    try {
      await index.upsert(vectors as VectorizeVector[]);

    } catch (error) {
      throw new Error(
        `Vectorize upsert error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
      const queryOptions: VectorizeQueryOptions = {
        topK,
        returnValues: false,
        returnMetadata: true,
      };

      if (options?.filter) {
        queryOptions.filter = options.filter as VectorizeVectorMetadataFilter;
      }

      const matches = await index.query(vector, queryOptions);

      if (!Array.isArray(matches)) {
        return [];
      }

      type RawMatch = { id: string; score: number; metadata?: unknown };
      return (matches as RawMatch[]).map((match) => ({
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

  async delete(ids: string[], binding?: string): Promise<void> {
    this.resolveIndex(binding);

    try {
      console.warn(`Vectorize delete not yet supported for IDs: ${ids.join(', ')}`);

    } catch (error) {
      throw new Error(
        `Vectorize delete error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async get(id: string, binding?: string): Promise<Vector | null> {
    if (this.kv) {
      try {
        const cached = await this.kv.get(`vectorize:${binding || 'default'}:${id}`, 'json');
        if (cached) {
          return cached as Vector;
        }
      } catch {
      }
    }

    return null;
  }

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
    const vectors: Vector[] = contextDocuments.map(doc => ({
      id: doc.id,
      values: queryVector,
      metadata: {
        ...doc.metadata,
        text: doc.text,
      },
    }));

    await this.upsert(vectors, options?.binding);

    const matches = await this.query(queryVector, {
      topK: options?.topK || 5,
      binding: options?.binding,
    });

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

    const context = contextTexts.join('\n\n');

    return {
      matches: enrichedMatches,
      context,
      totalMatches: matches.length,
    };
  }

  async getStats(binding?: string): Promise<{
    count: number;
    dimension: number;
  }> {
    this.resolveIndex(binding);

    try {

      return {
        count: 0,
        dimension: 512,
      };

    } catch (error) {
      throw new Error(
        `Vectorize stats error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}


export const vectorizeService = new VectorizeService();
