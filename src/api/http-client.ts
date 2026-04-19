import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT } from '../constants.js';
import { XriftApiError, XriftAuthError, XriftNetworkError } from '../errors.js';

export interface HttpClientConfig {
  baseUrl?: string;
  token?: string;
  timeout?: number;
}

export interface HttpResponse<T> {
  status: number;
  data: T;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeout: number;

  constructor(config: HttpClientConfig = {}) {
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.token = config.token;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  async get<T>(path: string): Promise<HttpResponse<T>> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<HttpResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  async put(path: string, body: BodyInit | ArrayBuffer | Uint8Array, headers?: Record<string, string>): Promise<HttpResponse<unknown>> {
    const url = `${this.baseUrl}${path}`;
    const mergedHeaders: Record<string, string> = { ...headers };

    if (this.token) {
      mergedHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: mergedHeaders,
        body: body as BodyInit,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return { status: response.status, data: null };
    } catch (error) {
      if (error instanceof XriftApiError) throw error;
      throw new XriftNetworkError(
        `PUT ${path} failed: ${(error as Error).message}`,
        error as Error,
      );
    }
  }

  /**
   * 外部 URL (署名付き URL 等) への PUT リクエスト
   */
  async putExternal(url: string, body: BodyInit | ArrayBuffer | Uint8Array, headers?: Record<string, string>): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: body as BodyInit,
        signal: AbortSignal.timeout(this.timeout * 10), // アップロードは長めに
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new XriftApiError(
          `Upload failed (${response.status}): ${text}`,
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof XriftApiError) throw error;
      throw new XriftNetworkError(
        `Upload failed: ${(error as Error).message}`,
        error as Error,
      );
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as T;
      return { status: response.status, data };
    } catch (error) {
      if (error instanceof XriftApiError) throw error;
      throw new XriftNetworkError(
        `${method} ${path} failed: ${(error as Error).message}`,
        error as Error,
      );
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }

    if (response.status === 401) {
      const message = typeof body === 'object' && body && 'message' in body
        ? String((body as { message: string }).message)
        : 'Authentication failed';
      throw new XriftAuthError(message, body);
    }

    const message = typeof body === 'object' && body && 'error' in body
      ? String((body as { error: string }).error)
      : typeof body === 'object' && body && 'message' in body
        ? String((body as { message: string }).message)
        : `Request failed with status ${response.status}`;

    throw new XriftApiError(message, response.status, body);
  }
}
