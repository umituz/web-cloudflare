
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

  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }

  setUserContext(userId: string): void {
    this.defaultHeaders['X-User-ID'] = userId;
  }

  clearUserContext(): void {
    delete this.defaultHeaders['X-User-ID'];
  }

  private buildURL(path: string): string {
    return `${this.baseURL}${path}`;
  }

  private createTimeoutController(): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    return { controller, cleanup: () => clearTimeout(timer) };
  }

  private async handleResponse<T>(response: Response): Promise<APIResponse<T>> {
    const headers = response.headers;

    if (!response.ok) {
      let error: APIError = {
        message: response.statusText || 'An error occurred',
        status: response.status,
      };

      try {
        const errorData: unknown = await response.json();
        if (typeof errorData === 'object' && errorData !== null) {
          error = { ...error, ...(errorData as Partial<APIError>) };
        }
      } catch {
      }

      throw error;
    }

    if (response.status === 204) {
      return { data: undefined as T, status: response.status, headers };
    }

    const content = await response.text();
    if (!content) {
      return { data: undefined as T, status: response.status, headers };
    }

    try {
      return { data: JSON.parse(content) as T, status: response.status, headers };
    } catch {
      throw {
        message: 'Response was not valid JSON',
        status: response.status,
      } satisfies APIError;
    }
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<APIResponse<T>> {
    const { headers: optionHeaders, signal: optionSignal, ...restOptions } = options ?? {};
    const { controller, cleanup } = this.createTimeoutController();

    try {
      const response = await fetch(this.buildURL(path), {
        ...restOptions,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.defaultHeaders,
          ...optionHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: optionSignal ?? controller.signal,
      });

      return await this.handleResponse<T>(response);
    } finally {
      cleanup();
    }
  }

  async get<T>(path: string, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  async patch<T>(path: string, body?: unknown, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T>(path: string, options?: RequestInit): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  async stream(
    path: string,
    body?: unknown,
    onChunk?: (chunk: string) => void,
    options?: RequestInit
  ): Promise<void> {
    const { headers: optionHeaders, signal: optionSignal, ...restOptions } = options ?? {};
    const { controller, cleanup } = this.createTimeoutController();

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      const response = await fetch(this.buildURL(path), {
        ...restOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.defaultHeaders,
          ...optionHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: optionSignal ?? controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        onChunk?.(chunk);
      }
    } finally {
      try {
        await reader?.cancel();
      } catch {
      }
      cleanup();
    }
  }

  async uploadFile(
    path: string,
    file: File,
    onProgress?: (progress: number) => void,
    options?: RequestInit
  ): Promise<APIResponse<{ key: string; url: string }>> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              data,
              status: xhr.status,
              headers: new Headers(),
            });
          } catch {
            reject({
              message: 'Upload returned invalid JSON',
              status: xhr.status,
            } satisfies APIError);
          }
        } else {
          reject({
            message: xhr.statusText || 'Upload failed',
            status: xhr.status,
          } satisfies APIError);
        }
      });

      xhr.addEventListener('error', () => {
        reject({
          message: 'Network error during upload',
          status: 0,
        } satisfies APIError);
      });

      xhr.addEventListener('timeout', () => {
        reject({
          message: 'Upload timeout',
          status: 0,
        } satisfies APIError);
      });

      xhr.addEventListener('abort', () => {
        reject({
          message: 'Upload aborted',
          status: 0,
        } satisfies APIError);
      });

      xhr.open('POST', this.buildURL(path));
      xhr.timeout = this.timeout;

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

export const apiClient = new APIClient();
