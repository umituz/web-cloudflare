/**
 * API Client Utility
 * @description Fetch wrapper with auth, error handling, and streaming support
 */

export interface APIClientConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface APIError {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
}

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export class APIClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(config: APIClientConfig = {}) {
    this.baseURL = config.baseURL || '';
    this.defaultHeaders = config.headers || {};
    this.timeout = config.timeout || 30000;
  }

  /**
   * Set auth token
   */
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Remove auth token
   */
  clearAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }

  /**
   * Set user context
   */
  setUserContext(userId: string): void {
    this.defaultHeaders['X-User-ID'] = userId;
  }

  /**
   * Clear user context
   */
  clearUserContext(): void {
    delete this.defaultHeaders['X-User-ID'];
  }

  /**
   * Build URL
   */
  private buildURL(path: string): string {
    return `${this.baseURL}${path}`;
  }

  /**
   * Create AbortController with timeout
   */
  private createTimeoutController(): AbortController {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.timeout);
    return controller;
  }

  /**
   * Handle fetch response
   */
  private async handleResponse<T>(response: Response): Promise<APIResponse<T>> {
    const headers = response.headers;

    if (!response.ok) {
      let error: APIError = {
        message: response.statusText || 'An error occurred',
        status: response.status,
      };

      try {
        const errorData = await response.json();
        error = { ...error, ...errorData };
      } catch {
        // Use default error
      }

      throw error;
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return { data: undefined as T, status: response.status, headers };
    }

    const data = await response.json();
    return { data, status: response.status, headers };
  }

  /**
   * Generic request method
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<APIResponse<T>> {
    const controller = this.createTimeoutController();

    const response = await fetch(this.buildURL(path), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      ...options,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * GET request
   */
  async get<T>(path: string, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, body?: unknown, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Stream request (for AI responses)
   */
  async stream(
    path: string,
    body?: unknown,
    onChunk: (chunk: string) => void,
    options?: RequestInit
  ): Promise<void> {
    const controller = this.createTimeoutController();

    const response = await fetch(this.buildURL(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Stream failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Upload file (for R2)
   */
  async uploadFile(
    path: string,
    file: File,
    onProgress?: (progress: number) => void,
    options?: RequestInit
  ): Promise<APIResponse<{ key: string; url: string }>> {
    const controller = this.createTimeoutController();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
      }

      // Request completed
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve({
            data,
            status: xhr.status,
            headers: new Headers(),
          });
        } else {
          reject({
            message: xhr.statusText || 'Upload failed',
            status: xhr.status,
          });
        }
      });

      // Request error
      xhr.addEventListener('error', () => {
        reject({
          message: 'Network error during upload',
          status: 0,
        });
      });

      // Request timeout
      xhr.addEventListener('abort', () => {
        reject({
          message: 'Upload timeout',
          status: 0,
        });
      });

      // Open and send request
      xhr.open('POST', this.buildURL(path));
      xhr.timeout = this.timeout;

      // Set headers
      Object.entries(this.defaultHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      if (options?.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          if (typeof value === 'string') {
            xhr.setRequestHeader(key, value);
          }
        });
      }

      const formData = new FormData();
      formData.append('file', file);

      xhr.send(formData);
    });
  }
}

// Create singleton instance
export const apiClient = new APIClient();
