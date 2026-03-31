/**
 * Generic Hugging Face Usage Examples via Cloudflare AI Gateway
 * @description Production-ready examples showing generic AI patterns
 * These examples work with ANY Hugging Face model - text, audio, image, etc.
 */

import { AIGatewayService, R2Service } from '../src/domains/ai';
import { ConfigBuilder } from '../src/config';
import type { WorkersAIBinding } from '../src/config/types';

// ============================================================
// Environment Types
// ============================================================

interface Env {
  // KV namespace for caching
  CACHE_KV: KVNamespace;
  // R2 bucket for generated assets
  ASSETS_BUCKET: R2Bucket;
  // Optional: D1 database for metadata
  ASSETS_DB?: D1Database;
  // Optional: Embedding service for semantic caching
}

// ============================================================
// Example 1: Generic Text Generation
// ============================================================

/**
 * Worker endpoint for generic text generation
 * Works with any text-generation model on Hugging Face
 */
export const textGenerationWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const { prompt, model } = await request.json();

        // Use ConfigBuilder for clean configuration
        const config = ConfigBuilder.create()
          .withHuggingFace({
            enabled: true,
            accountId: 'your-account-id',
            defaultGatewayId: 'your-gateway-id',
          })
          .withAIGateway({
            providers: [],
            cacheEnabled: true,
            cacheTTL: 7200,
          })
          .build();

        // Initialize AI Gateway service
        const gateway = new AIGatewayService(
          config.ai!.gateway!,
          env.CACHE_KV
        );

        // Call any Hugging Face text model generically
        const result = await gateway.callHuggingFace(
          model || 'meta-llama/Llama-3.1-8B',
          { inputs: prompt }
        );

        return Response.json({
          success: true,
          data: result.data,
          metadata: {
            model: result.model,
            tokens: result.tokens,
            cost: result.cost,
            latency: result.latency,
          },
        });

      } catch (error) {
        return Response.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

// ============================================================
// Example 2: Generic Audio Generation with R2 Upload
// ============================================================

/**
 * Worker endpoint for generic audio generation
 * Works with any audio-generation model (MusicGen, Bark, TTS, etc.)
 */
export const audioGenerationWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/audio/generate' && request.method === 'POST') {
      try {
        const { prompt, model, userId } = await request.json();

        // Initialize services
        const gateway = new AIGatewayService({
          gatewayId: 'default',
          providers: [],
          cacheEnabled: true,
          cacheTTL: 7200,
        }, env.CACHE_KV);

        const r2 = new R2Service();
        r2.bindBucket('assets', env.ASSETS_BUCKET);

        // Call any Hugging Face audio model generically
        const response = await gateway.callHuggingFace(
          model || 'facebook/musicgen-small',
          { inputs: prompt },
          { returnRawResponse: true }
        );

        // Get binary data from response
        const buffer = await (response.data as Response).arrayBuffer();

        // Upload to R2 with generic metadata
        const key = await r2.uploadGeneratedAsset(buffer, {
          model: model || 'facebook/musicgen-small',
          provider: 'huggingface',
          prompt,
          contentType: 'audio/wav',
          userId,
          tags: ['audio', 'generated', 'huggingface'],
        });

        return Response.json({
          success: true,
          url: r2.getPublicURL(key),
          key,
          metadata: {
            model,
            prompt,
            size: buffer.byteLength,
          },
        });

      } catch (error) {
        return Response.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

// ============================================================
// Example 3: Generic Image Generation
// ============================================================

/**
 * Worker endpoint for generic image generation
 * Works with any image-generation model (Stable Diffusion, etc.)
 */
export const imageGenerationWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/image/generate' && request.method === 'POST') {
      try {
        const { prompt, model, negativePrompt } = await request.json();

        const gateway = new AIGatewayService({
          gatewayId: 'default',
          providers: [],
          cacheEnabled: true,
          cacheTTL: 7200,
        }, env.CACHE_KV);

        const r2 = new R2Service();
        r2.bindBucket('assets', env.ASSETS_BUCKET);

        // Call any Hugging Face image model generically
        const response = await gateway.callHuggingFace(
          model || 'stabilityai/stable-diffusion-xl-base-1.0',
          {
            inputs: prompt,
            parameters: negativePrompt ? { negative_prompt: negativePrompt } : undefined,
          },
          { returnRawResponse: true }
        );

        // Get binary data from response
        const buffer = await (response.data as Response).arrayBuffer();

        // Upload to R2 with generic metadata
        const key = await r2.uploadGeneratedAsset(buffer, {
          model: model || 'stabilityai/stable-diffusion-xl-base-1.0',
          provider: 'huggingface',
          prompt,
          contentType: 'image/png',
          tags: ['image', 'generated', 'huggingface'],
        });

        return Response.json({
          success: true,
          url: r2.getPublicURL(key),
          key,
        });

      } catch (error) {
        return Response.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

// ============================================================
// Example 4: Generic Embedding Generation
// ============================================================

/**
 * Worker endpoint for generic embedding generation
 * Works with any embedding model
 */
export const embeddingWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/embeddings' && request.method === 'POST') {
      try {
        const { text, model } = await request.json();

        const gateway = new AIGatewayService({
          gatewayId: 'default',
          providers: [],
          cacheEnabled: true,
          cacheTTL: 86400, // Longer cache for embeddings
        }, env.CACHE_KV);

        // Call any Hugging Face embedding model generically
        const result = await gateway.callHuggingFace(
          model || 'sentence-transformers/all-MiniLM-L6-v2',
          { inputs: text }
        );

        return Response.json({
          success: true,
          embedding: result.data,
          model: result.model,
          dimensions: Array.isArray(result.data) ? result.data.length : 0,
        });

      } catch (error) {
        return Response.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

// ============================================================
// Example 5: Multi-Model Router (Generic Pattern)
// ============================================================

/**
 * Generic multi-model router
 * Dynamically routes to appropriate Hugging Face model based on task
 */
export const multiModelRouter = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Extract model name from path: /api/{task}/{model}
    const match = path.match(/^\/api\/([^/]+)\/(.+)$/);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const [, task, model] = match;

    try {
      const body = await request.json();

      const gateway = new AIGatewayService({
        gatewayId: 'default',
        providers: [],
        cacheEnabled: true,
        cacheTTL: 7200,
      }, env.CACHE_KV);

      // Generic handler for all model types
      const result = await gateway.callProvider(
        'huggingface',
        model,
        body,
        { returnRawResponse: true }
      );

      // Handle different response types
      const contentType = (result.data as Response).headers.get('content-type');
      const isBinary = contentType && !contentType.includes('json');

      if (isBinary) {
        // Binary response (audio, image, video) - stream to client
        return new Response((result.data as Response).body, {
          headers: { 'content-type': contentType },
        });
      } else {
        // JSON response
        const data = await (result.data as Response).json();
        return Response.json({
          success: true,
          data,
          model,
          task,
        });
      }

    } catch (error) {
      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, { status: 500 });
    }
  },
};

// ============================================================
// Example 6: Building Higher-Level Functionality
// ============================================================

/**
 * Example: Building a custom TTS service on top of generic blocks
 * Projects can extend these patterns for domain-specific features
 */
class CustomTSService {
  constructor(
    private gateway: AIGatewayService,
    private r2: R2Service
  ) {}

  /**
   * Higher-level TTS method built on generic AI call
   * @param text Text to convert to speech
   * @param voice Voice model to use
   * @returns URL of generated audio file
   */
  async textToSpeech(
    text: string,
    voice: string = 'facebook/mms-tts-eng',
    userId?: string
  ): Promise<string> {
    // Use generic Hugging Face call
    const response = await this.gateway.callHuggingFace(
      voice,
      { inputs: text },
      { returnRawResponse: true }
    );

    const buffer = await (response.data as Response).arrayBuffer();

    // Upload with TTS-specific metadata
    const key = await this.r2.uploadGeneratedAsset(buffer, {
      model: voice,
      provider: 'huggingface',
      prompt: text,
      contentType: 'audio/wav',
      userId,
      tags: ['tts', 'speech', 'audio'],
      additionalData: {
        task: 'text-to-speech',
        textLength: text.length,
      },
    });

    return this.r2.getPublicURL(key);
  }

  /**
   * Batch TTS conversion
   */
  async batchTextToSpeech(
    items: Array<{ text: string; voice?: string }>,
    userId?: string
  ): Promise<string[]> {
    const results = await Promise.all(
      items.map(item =>
        this.textToSpeech(item.text, item.voice, userId)
      )
    );
    return results;
  }
}

// Usage example in a Worker
export const ttsWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/tts' && request.method === 'POST') {
      const gateway = new AIGatewayService({
        gatewayId: 'default',
        providers: [],
        cacheEnabled: true,
        cacheTTL: 7200,
      }, env.CACHE_KV);

      const r2 = new R2Service();
      r2.bindBucket('assets', env.ASSETS_BUCKET);

      // Use custom service built on generic blocks
      const tts = new CustomTSService(gateway, r2);

      const { text, voice, userId } = await request.json();
      const audioUrl = await tts.textToSpeech(text, voice, userId);

      return Response.json({
        success: true,
        audioUrl,
      });
    }

    return new Response('Not found', { status: 404 });
  },
};

// ============================================================
// Example 7: Cost Tracking and Analytics
// ============================================================

/**
 * Worker with cost tracking for Hugging Face calls
 */
export const analyticsWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate' && request.method === 'POST') {
      const gateway = new AIGatewayService({
        gatewayId: 'default',
        providers: [],
        cacheEnabled: true,
        cacheTTL: 7200,
        analytics: true,
      }, env.CACHE_KV);

      const { prompt, model } = await request.json();

      // Make the call
      const result = await gateway.callHuggingFace(
        model || 'meta-llama/Llama-3.1-8B',
        { inputs: prompt }
      );

      // Get cost summary
      const costSummary = await gateway.getCostSummary();

      return Response.json({
        success: true,
        data: result.data,
        requestCost: result.cost,
        totalCost: costSummary.totalCost,
        costByModel: costSummary.byModel,
        analytics: await gateway.getAnalytics(),
      });
    }

    if (url.pathname === '/api/analytics' && request.method === 'GET') {
      const gateway = new AIGatewayService({
        gatewayId: 'default',
        providers: [],
        cacheEnabled: true,
        analytics: true,
      }, env.CACHE_KV);

      const [costSummary, analytics] = await Promise.all([
        gateway.getCostSummary(),
        gateway.getAnalytics(),
      ]);

      return Response.json({
        cost: costSummary,
        analytics,
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
