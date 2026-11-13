import { describe, it, expect, vi } from 'vitest';
import {
  ImageGenerationService,
  DEFAULT_IMAGE_MODEL,
  type ImageGenerationBinding,
} from '../src/domains/ai/services/image-generation.service';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function makeBinding(
  handler: (model: string, inputs: Record<string, unknown>) => unknown
): ImageGenerationBinding {
  return {
    run: vi.fn(async (model: string, inputs: Record<string, unknown>) =>
      handler(model, inputs)
    ) as ImageGenerationBinding['run'],
  };
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const copy = new Uint8Array(bytes);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(copy);
      controller.close();
    },
  });
}

describe('ImageGenerationService', () => {
  it('throws when the Workers AI binding is not configured', async () => {
    const service = new ImageGenerationService({});
    await expect(service.generateImage({ prompt: 'a sunset' })).rejects.toThrow(
      'Workers AI binding not configured'
    );
  });

  it('rejects empty and whitespace prompts', async () => {
    const service = new ImageGenerationService({ AI: makeBinding(() => ({})) });
    await expect(service.generateImage({ prompt: '   ' })).rejects.toThrow(
      'Prompt is required'
    );
  });

  it('rejects prompts longer than 2048 characters', async () => {
    const service = new ImageGenerationService({ AI: makeBinding(() => ({})) });
    await expect(
      service.generateImage({ prompt: 'a'.repeat(2049) })
    ).rejects.toThrow('Prompt too long');
  });

  it('throws on unknown models', async () => {
    const service = new ImageGenerationService({ AI: makeBinding(() => ({})) });
    await expect(
      service.generateImage({ prompt: 'a sunset', model: '@cf/nope/missing' })
    ).rejects.toThrow('Unknown image model');
  });

  it('decodes base64 {image} responses and sniffs the mime type (FLUX JSON lane)', async () => {
    const binding = makeBinding(() => ({ image: bytesToBase64(PNG_BYTES) }));
    const service = new ImageGenerationService({ AI: binding });

    const result = await service.generateImage({ prompt: 'a sunset', seed: 7 });

    expect(result.mimeType).toBe('image/png');
    expect(Array.from(result.bytes)).toEqual(Array.from(PNG_BYTES));
    expect(result.model).toBe(DEFAULT_IMAGE_MODEL);
    expect(result.latency).toBeGreaterThanOrEqual(0);

    expect(binding.run).toHaveBeenCalledWith(
      '@cf/black-forest-labs/flux-1-schnell',
      { prompt: 'a sunset', steps: 4, seed: 7 }
    );
  });

  it('sends width/height/steps but never a seed on FLUX.2 multipart models', async () => {
    let captured: Record<string, unknown> | undefined;
    const binding = makeBinding((_model, inputs) => {
      captured = inputs;
      return { image: bytesToBase64(JPEG_BYTES) };
    });
    const service = new ImageGenerationService({ AI: binding });

    const result = await service.generateImage({
      prompt: 'a sunset at the alps',
      model: '@cf/black-forest-labs/flux-2-klein-4b',
      width: 1280,
      height: 720,
    });

    expect(result.mimeType).toBe('image/jpeg');

    const multipart = (captured as { multipart?: { body?: ReadableStream; contentType?: string } })
      .multipart;
    expect(multipart).toBeDefined();
    expect(multipart?.contentType).toMatch(/^multipart\/form-data/);
    expect(multipart?.body).toBeInstanceOf(ReadableStream);

    const bodyText = await new Response(multipart?.body).text();
    expect(bodyText).toContain('name="prompt"');
    expect(bodyText).toContain('a sunset at the alps');
    expect(bodyText).toContain('name="width"');
    expect(bodyText).toContain('1280');
    expect(bodyText).toContain('name="height"');
    expect(bodyText).toContain('720');
    expect(bodyText).toContain('name="steps"');
  });

  it('refuses width/height for models without size support instead of dropping them silently', async () => {
    const service = new ImageGenerationService({ AI: makeBinding(() => ({})) });

    await expect(
      service.generateImage({
        prompt: 'a sunset',
        model: '@cf/black-forest-labs/flux-1-schnell',
        width: 1024,
      })
    ).rejects.toThrow('does not accept width/height');
  });

  it('refuses seeds for models without seed support instead of dropping them silently', async () => {
    const service = new ImageGenerationService({ AI: makeBinding(() => ({})) });

    await expect(
      service.generateImage({
        prompt: 'a sunset',
        model: '@cf/black-forest-labs/flux-2-klein-9b',
        seed: 1,
      })
    ).rejects.toThrow('does not accept a seed');
  });

  it('normalizes ReadableStream byte responses (SDXL lane)', async () => {
    const binding = makeBinding(() => streamOf(WEBP_BYTES));
    const service = new ImageGenerationService({ AI: binding });

    const result = await service.generateImage({
      prompt: 'a sunset',
      model: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      width: 5000,
      height: 100,
      steps: 99,
    });

    expect(result.mimeType).toBe('image/webp');
    expect(Array.from(result.bytes)).toEqual(Array.from(WEBP_BYTES));
    expect(result.width).toBe(1536);
    expect(result.height).toBe(256);

    expect(binding.run).toHaveBeenCalledWith(
      '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      { prompt: 'a sunset', width: 1536, height: 256, steps: 50 }
    );
  });

  it('normalizes raw Uint8Array responses', async () => {
    const binding = makeBinding(() => PNG_BYTES);
    const service = new ImageGenerationService({ AI: binding });

    const result = await service.generateImage({ prompt: 'a sunset' });

    expect(result.mimeType).toBe('image/png');
    expect(Array.from(result.bytes)).toEqual(Array.from(PNG_BYTES));
  });

  it('rejects payloads whose bytes are not a recognized image format', async () => {
    const binding = makeBinding(() => new Uint8Array([0x00, 0x01, 0x02, 0x03]));
    const service = new ImageGenerationService({ AI: binding });

    await expect(service.generateImage({ prompt: 'a sunset' })).rejects.toThrow(
      'unrecognized image format'
    );
  });

  it('rejects responses with an unexpected shape', async () => {
    const binding = makeBinding(() => ({ ok: true }));
    const service = new ImageGenerationService({ AI: binding });

    await expect(service.generateImage({ prompt: 'a sunset' })).rejects.toThrow(
      'unexpected response format'
    );
  });

  it('times out when the model never resolves', async () => {
    const binding = makeBinding(
      () => new Promise(() => {})
    );
    const service = new ImageGenerationService({ AI: binding });

    await expect(
      service.generateImage({ prompt: 'a sunset', timeoutMs: 10 })
    ).rejects.toThrow('timed out after 10ms');
  });

  it('surfaces model errors with context', async () => {
    const binding = makeBinding(() => {
      throw new Error('boom');
    });
    const service = new ImageGenerationService({ AI: binding });

    await expect(service.generateImage({ prompt: 'a sunset' })).rejects.toThrow(
      'Image generation failed: boom'
    );
  });

  it('lists the image catalog with verified capabilities', () => {
    const service = new ImageGenerationService({});

    const models = service.getImageModels();
    expect(models.map((m) => m.id)).toContain(DEFAULT_IMAGE_MODEL);
    expect(models.length).toBeGreaterThanOrEqual(6);

    const schnell = service.getImageModelInfo('@cf/black-forest-labs/flux-1-schnell');
    expect(schnell?.inputMode).toBe('json');
    expect(schnell?.supportsSize).toBe(false);
    expect(schnell?.maxSteps).toBe(8);

    const klein = service.getImageModelInfo('@cf/black-forest-labs/flux-2-klein-9b');
    expect(klein?.inputMode).toBe('multipart');
    expect(klein?.supportsSize).toBe(true);
    expect(klein?.supportsSeed).toBe(false);

    expect(service.getImageModelInfo('@cf/nope/missing')).toBeNull();
  });
});
