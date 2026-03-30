/**
 * useAI Hook
 * @description AI operations hook for text generation and streaming
 */

import { useState, useCallback, useRef } from 'react';
import { APIClient } from '../utils/api-client';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface AIRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
  history?: AIMessage[];
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    neurons: number;
    cost: number;
  };
}

export interface AIState {
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  response: AIResponse | null;
  streamContent: string;
}

export interface UseAIOptions {
  baseURL?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface UseAIReturn {
  aiState: AIState;
  generateText: (prompt: string, options?: AIRequestOptions) => Promise<AIResponse>;
  streamText: (prompt: string, onChunk: (chunk: string) => void, options?: AIRequestOptions) => Promise<void>;
  chat: (messages: AIMessage[], options?: AIRequestOptions) => Promise<AIResponse>;
  resetState: () => void;
  clearError: () => void;
}

/**
 * AI hook for React apps
 */
export function useAI(options: UseAIOptions = {}): UseAIReturn {
  const {
    baseURL = '',
    defaultModel = '@cf/meta/llama-3.1-8b-instruct',
    defaultTemperature = 0.7,
    defaultMaxTokens = 2048,
  } = options;

  const client = useRef<APIClient>(new APIClient({ baseURL }));

  const [aiState, setAIState] = useState<AIState>({
    isLoading: false,
    isStreaming: false,
    error: null,
    response: null,
    streamContent: '',
  });

  /**
   * Generate text
   */
  const generateText = useCallback(async (
    prompt: string,
    requestOptions: AIRequestOptions = {}
  ): Promise<AIResponse> => {
    setAIState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      streamContent: '',
    }));

    try {
      const response = await client.current.post<{ response: AIResponse }>('/api/ai/generate', {
        prompt,
        model: requestOptions.model || defaultModel,
        temperature: requestOptions.temperature ?? defaultTemperature,
        maxTokens: requestOptions.maxTokens || defaultMaxTokens,
        system: requestOptions.system,
      });

      setAIState({
        isLoading: false,
        isStreaming: false,
        error: null,
        response: response.data.response,
        streamContent: response.data.response.content,
      });

      return response.data.response;
    } catch (error) {
      setAIState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      }));
      throw error;
    }
  }, [defaultModel, defaultTemperature, defaultMaxTokens]);

  /**
   * Stream text
   */
  const streamText = useCallback(async (
    prompt: string,
    onChunk: (chunk: string) => void,
    requestOptions: AIRequestOptions = {}
  ): Promise<void> => {
    setAIState((prev) => ({
      ...prev,
      isStreaming: true,
      error: null,
      streamContent: '',
    }));

    try {
      let fullContent = '';

      await client.current.stream(
        '/api/ai/stream',
        {
          prompt,
          model: requestOptions.model || defaultModel,
          temperature: requestOptions.temperature ?? defaultTemperature,
          maxTokens: requestOptions.maxTokens || defaultMaxTokens,
          system: requestOptions.system,
        },
        (chunk) => {
          fullContent += chunk;
          onChunk(chunk);
          setAIState((prev) => ({
            ...prev,
            streamContent: fullContent,
          }));
        }
      );

      setAIState((prev) => ({
        ...prev,
        isStreaming: false,
        response: {
          content: fullContent,
          model: requestOptions.model || defaultModel,
        },
      }));
    } catch (error) {
      setAIState((prev) => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : 'Stream failed',
      }));
      throw error;
    }
  }, [defaultModel, defaultTemperature, defaultMaxTokens]);

  /**
   * Chat with history
   */
  const chat = useCallback(async (
    messages: AIMessage[],
    requestOptions: AIRequestOptions = {}
  ): Promise<AIResponse> => {
    setAIState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      streamContent: '',
    }));

    try {
      const response = await client.current.post<{ response: AIResponse }>('/api/ai/chat', {
        messages,
        model: requestOptions.model || defaultModel,
        temperature: requestOptions.temperature ?? defaultTemperature,
        maxTokens: requestOptions.maxTokens || defaultMaxTokens,
        system: requestOptions.system,
      });

      setAIState({
        isLoading: false,
        isStreaming: false,
        error: null,
        response: response.data.response,
        streamContent: response.data.response.content,
      });

      return response.data.response;
    } catch (error) {
      setAIState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Chat failed',
      }));
      throw error;
    }
  }, [defaultModel, defaultTemperature, defaultMaxTokens]);

  /**
   * Reset state
   */
  const resetState = useCallback((): void => {
    setAIState({
      isLoading: false,
      isStreaming: false,
      error: null,
      response: null,
      streamContent: '',
    });
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback((): void => {
    setAIState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    aiState,
    generateText,
    streamText,
    chat,
    resetState,
    clearError,
  };
}

/**
 * Chat hook with conversation history
 */
export function useAIChat(options: UseAIOptions = {}) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const { aiState, generateText, streamText, resetState, clearError } = useAI(options);

  /**
   * Send message
   */
  const sendMessage = useCallback(async (
    content: string,
    options?: { stream?: boolean } & AIRequestOptions
  ): Promise<void> => {
    const userMessage: AIMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      if (options?.stream) {
        await streamText(content, (chunk) => {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: lastMessage.content + chunk },
              ];
            }
            return [
              ...prev,
              {
                role: 'assistant',
                content: chunk,
                timestamp: Date.now(),
              },
            ];
          });
        }, options);
      } else {
        const response = await generateText(content, options);
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      // Remove user message on error
      setMessages((prev) => prev.slice(0, -1));
      throw error;
    }
  }, [generateText, streamText]);

  /**
   * Clear conversation
   */
  const clearConversation = useCallback((): void => {
    setMessages([]);
    resetState();
  }, [resetState]);

  return {
    messages,
    aiState,
    sendMessage,
    clearConversation,
  };
}

/**
 * RAG hook for retrieval-augmented generation
 */
export function useAIRAG(options: UseAIOptions & { ragPath?: string }) {
  const { ragPath = '/api/ai/rag', ...aiOptions } = options;
  const client = new APIClient({ baseURL: aiOptions.baseURL || '' });
  const { aiState, resetState } = useAI(aiOptions);

  /**
   * Query with RAG
   */
  const query = useCallback(async (
    query: string,
    requestOptions?: AIRequestOptions & { topK?: number; threshold?: number }
  ): Promise<{ response: string; sources: Array<{ id: string; text: string; score: number }> }> => {
    setAIState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await client.post<{
        response: string;
        sources: Array<{ id: string; text: string; score: number }>;
      }>(ragPath, {
        query,
        ...requestOptions,
      });

      setAIState((prev) => ({
        ...prev,
        isLoading: false,
      }));

      return response.data;
    } catch (error) {
      setAIState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'RAG query failed',
      }));
      throw error;
    }
  }, [ragPath, setAIState]);

  return {
    aiState,
    query,
    resetState,
  };
}
