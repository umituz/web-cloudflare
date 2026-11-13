export interface ImageGenerationBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export interface ImageGenerationEnv {
  AI?: ImageGenerationBinding;
  bindings?: {
    AI?: ImageGenerationBinding;
  };
}

export interface ImageModelInfo {
  id: string;
  name: string;
  inputMode: 'json' | 'multipart';
  supportsSize: boolean;
  supportsSteps: boolean;
  supportsSeed: boolean;
  maxSteps: number;
  defaultSteps: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  timeoutMs?: number;
}

export interface ImageGenerationResult {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  model: string;
  latency: number;
}

const MAX_PROMPT_LENGTH = 2048;
const MIN_DIMENSION = 256;
const MAX_DIMENSION = 1536;
const DIMENSION_STEP = 8;
const DEFAULT_TIMEOUT_MS = 30_000;

const IMAGE_MODELS: Record<string, ImageModelInfo> = {
  '@cf/black-forest-labs/flux-1-schnell': {
    id: '@cf/black-forest-labs/flux-1-schnell',
    name: 'FLUX.1 [schnell]',
    inputMode: 'json',
    supportsSize: false,
    supportsSteps: true,
    supportsSeed: true,
    maxSteps: 8,
    defaultSteps: 4,
  },
  '@cf/black-forest-labs/flux-2-klein-4b': {
    id: '@cf/black-forest-labs/flux-2-klein-4b',
    name: 'FLUX.2 [klein] 4B',
    inputMode: 'multipart',
    supportsSize: true,
    supportsSteps: true,
    supportsSeed: false,
    maxSteps: 50,
    defaultSteps: 25,
  },
  '@cf/black-forest-labs/flux-2-klein-9b': {
    id: '@cf/black-forest-labs/flux-2-klein-9b',
    name: 'FLUX.2 [klein] 9B',
    inputMode: 'multipart',
    supportsSize: true,
    supportsSteps: true,
    supportsSeed: false,
    maxSteps: 50,
    defaultSteps: 25,
  },
  '@cf/stabilityai/stable-diffusion-xl-base-1.0': {
    id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    name: 'Stable Diffusion XL Base 1.0',
    inputMode: 'json',
    supportsSize: true,
    supportsSteps: true,
    supportsSeed: true,
    maxSteps: 50,
    defaultSteps: 20,
  },
  '@cf/bytedance/stable-diffusion-xl-lightning': {
    id: '@cf/bytedance/stable-diffusion-xl-lightning',
    name: 'SDXL Lightning',
    inputMode: 'json',
    supportsSize: true,
    supportsSteps: true,
    supportsSeed: false,
    maxSteps: 50,
    defaultSteps: 4,
  },
  '@cf/lykon/dreamshaper-8-lcm': {
    id: '@cf/lykon/dreamshaper-8-lcm',
    name: 'DreamShaper 8 LCM',
    inputMode: 'json',
    supportsSize: true,
    supportsSteps: true,
    supportsSeed: true,
    maxSteps: 50,
    defaultSteps: 4,
  },
};

export const DEFAULT_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export class ImageGenerationService {
  private env: ImageGenerationEnv;

  constructor(env: ImageGenerationEnv) {
    this.env = env;
  }

  private getAI(): ImageGenerationBinding | null {
    return this.env.bindings?.AI || this.env.AI || null;
  }

  getImageModels(): ImageModelInfo[] {
    return Object.values(IMAGE_MODELS);
  }

  getImageModelInfo(model: string): ImageModelInfo | null {
    return IMAGE_MODELS[model] ?? null;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const ai = this.getAI();

    if (!ai) {
      throw new Error('Workers AI binding not configured');
    }

    const prompt = request.prompt?.trim() ?? '';

    if (prompt.length === 0) {
      throw new Error('Prompt is required');
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new Error(`Prompt too long (max ${MAX_PROMPT_LENGTH} characters)`);
    }

    const model = request.model ?? DEFAULT_IMAGE_MODEL;
    const info = IMAGE_MODELS[model];

    if (!info) {
      throw new Error(`Unknown image model: ${model}`);
    }

    if (!info.supportsSize && (request.width !== undefined || request.height !== undefined)) {
      throw new Error(`Model ${model} does not accept width/height`);
    }

    if (!info.supportsSeed && request.seed !== undefined) {
      throw new Error(`Model ${model} does not accept a seed`);
    }

    const width = this.clampDimension(request.width ?? 1024);
    const height = this.clampDimension(request.height ?? 1024);
    const steps = this.clampSteps(request.steps ?? info.defaultSteps, info);
    const inputs = info.inputMode === 'multipart'
      ? this.buildMultipartInput(prompt, width, height, steps)
      : this.buildJsonInput(prompt, info, width, height, steps, request.seed);

    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      });

      const response = await Promise.race([ai.run(model, inputs), timeout]);
      const bytes = await this.responseToBytes(response);
      const mimeType = this.sniffMimeType(bytes);

      return {
        bytes,
        mimeType,
        width,
        height,
        model,
        latency: Date.now() - started,
      };
    } catch (error) {
      throw new Error(
        `Image generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private buildJsonInput(
    prompt: string,
    info: ImageModelInfo,
    width: number,
    height: number,
    steps: number,
    seed?: number
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = { prompt };

    if (info.supportsSize) {
      inputs.width = width;
      inputs.height = height;
    }

    if (info.supportsSteps) {
      inputs.steps = steps;
    }

    if (info.supportsSeed && seed !== undefined) {
      inputs.seed = seed;
    }

    return inputs;
  }

  private buildMultipartInput(
    prompt: string,
    width: number,
    height: number,
    steps: number
  ): Record<string, unknown> {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', String(width));
    form.append('height', String(height));
    form.append('steps', String(steps));

    const serialized = new Response(form);
    const contentType = serialized.headers.get('content-type') ?? 'multipart/form-data';

    return {
      multipart: {
        body: serialized.body,
        contentType,
      },
    };
  }

  private async responseToBytes(response: unknown): Promise<Uint8Array> {
    if (response instanceof ReadableStream) {
      const reader = response.getReader();
      const chunks: Uint8Array[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
      } catch (error) {
        try { await reader.cancel(); } catch {}
        throw error;
      }

      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return combined;
    }

    if (response instanceof ArrayBuffer) {
      return new Uint8Array(response);
    }

    if (ArrayBuffer.isView(response)) {
      const view = response as ArrayBufferView;
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }

    if (typeof response === 'object' && response !== null) {
      const r = response as Record<string, unknown>;
      if (typeof r.image === 'string' && r.image.length > 0) {
        return this.base64ToBytes(r.image);
      }
    }

    throw new Error('unexpected response format from image model');
  }

  private sniffMimeType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' {
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4e && bytes[3] === 0x47
    ) {
      return 'image/png';
    }

    if (
      bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    ) {
      return 'image/jpeg';
    }

    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 &&
      bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 &&
      bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return 'image/webp';
    }

    throw new Error('unrecognized image format (expected PNG, JPEG or WebP)');
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  private clampDimension(value: number): number {
    const clamped = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, value));
    return Math.round(clamped / DIMENSION_STEP) * DIMENSION_STEP;
  }

  private clampSteps(value: number, info: ImageModelInfo): number {
    return Math.max(1, Math.min(info.maxSteps, Math.round(value)));
  }
}

export const imageGenerationService = new ImageGenerationService({});

export function createImageGenerationService(env: ImageGenerationEnv): ImageGenerationService {
  return new ImageGenerationService(env);
}
