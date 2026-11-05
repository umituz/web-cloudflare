
import type { ILLMStreamingService } from '../types';
import type {
  LLMRequest,
  LLMStreamChunk,
} from '../entities';
import { generateId } from '../../../infrastructure/utils/helpers';


export class LLMStreamingService implements ILLMStreamingService {
  streamRequest(
    provider: 'workers-ai' | 'openai' | 'anthropic',
    model: string,
    request: LLMRequest
  ): ReadableStream<LLMStreamChunk> {
    const requestId = this.generateId();

    switch (provider) {
      case 'workers-ai':
        return this.streamWorkersAI(model, request, requestId);
      case 'openai':
        return this.streamOpenAI(model, request, requestId);
      case 'anthropic':
        return this.streamAnthropic(model, request, requestId);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private streamWorkersAI(
    model: string,
    request: LLMRequest,
    requestId: string
  ): ReadableStream<LLMStreamChunk> {

    return new ReadableStream<LLMStreamChunk>({
      async start(controller) {
        try {
          controller.enqueue({
            content: '[Workers AI streaming not yet implemented]',
            done: false,
            id: requestId,
          });

          controller.enqueue({
            content: '',
            done: true,
            id: requestId,
          });

          controller.close();

        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  private streamOpenAI(
    model: string,
    request: LLMRequest,
    requestId: string
  ): ReadableStream<LLMStreamChunk> {
    const apiKey = request.metadata?.openaiApiKey as string | undefined;

    if (!apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    return new ReadableStream<LLMStreamChunk>({
      async start(controller) {
        let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: request.messages || [{ role: 'user', content: request.prompt }],
              stream: true,
              ...request.parameters,
            }),
          });

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
          }

          const reader = response.body?.getReader() ?? null;
          activeReader = reader;
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  controller.enqueue({
                    content: '',
                    done: true,
                    id: requestId,
                  });
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || '';

                  if (content) {
                    controller.enqueue({
                      content,
                      done: false,
                      id: requestId,
                    });
                  }
                } catch {
                }
              }
            }
          }

          controller.close();

        } catch (error) {
          try { await activeReader?.cancel(); } catch {}
          controller.error(error);
        }
      },
    });
  }

  private streamAnthropic(
    model: string,
    request: LLMRequest,
    requestId: string
  ): ReadableStream<LLMStreamChunk> {
    const apiKey = request.metadata?.anthropicApiKey as string | undefined;

    if (!apiKey) {
      throw new Error('Anthropic API key not provided');
    }

    return new ReadableStream<LLMStreamChunk>({
      async start(controller) {
        let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              messages: request.messages || [{ role: 'user', content: request.prompt }],
              stream: true,
              max_tokens: request.parameters?.maxTokens || 4096,
              temperature: request.parameters?.temperature || 0.7,
            }),
          });

          if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.statusText}`);
          }

          const reader = response.body?.getReader() ?? null;
          activeReader = reader;
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.type === 'content_block_delta') {
                    const content = parsed.delta?.text || '';

                    if (content) {
                      controller.enqueue({
                        content,
                        done: false,
                        id: requestId,
                      });
                    }
                  }

                  if (parsed.type === 'message_stop') {
                    controller.enqueue({
                      content: '',
                      done: true,
                      id: requestId,
                    });
                  }
                } catch {
                }
              }
            }
          }

          controller.close();

        } catch (error) {
          try { await activeReader?.cancel(); } catch {}
          controller.error(error);
        }
      },
    });
  }

  async *streamToGenerator(
    stream: ReadableStream
  ): AsyncGenerator<LLMStreamChunk> {
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        if (value) {
          yield value;
        }
      }
    } finally {
      try { await reader.cancel(); } catch {}
    }
  }

  async accumulateStream(
    stream: ReadableStream,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const reader = stream.getReader();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        if (value) {
          fullContent += value.content;

          if (onChunk) {
            onChunk(value.content);
          }
        }
      }
    } finally {
      try { await reader.cancel(); } catch {}
    }

    return fullContent;
  }


  private generateId(): string {
    return generateId();
  }
}


export const llmStreamingService = new LLMStreamingService();
