import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../src/api/http-client.js';
import { XriftApiError, XriftAuthError, XriftNetworkError } from '../src/errors.js';

describe('HttpClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(status: number, body: unknown, ok?: boolean) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: ok ?? (status >= 200 && status < 300),
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  it('GET リクエストを送信する', async () => {
    mockFetch(200, { valid: true });
    const client = new HttpClient({ baseUrl: 'https://api.test.com', token: 'tok' });

    const result = await client.get<{ valid: boolean }>('/api/verify');

    expect(result.data).toEqual({ valid: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/api/verify',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer tok',
        },
      }),
    );
  });

  it('POST リクエストを送信する', async () => {
    mockFetch(200, { id: '123' });
    const client = new HttpClient({ baseUrl: 'https://api.test.com', token: 'tok' });

    const result = await client.post<{ id: string }>('/api/worlds', { name: 'test' });

    expect(result.data).toEqual({ id: '123' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/api/worlds',
      expect.objectContaining({
        method: 'POST',
        body: '{"name":"test"}',
      }),
    );
  });

  it('401 で XriftAuthError をスローする', async () => {
    mockFetch(401, { message: 'Invalid token' }, false);
    const client = new HttpClient({ baseUrl: 'https://api.test.com', token: 'bad' });

    await expect(client.get('/api/verify')).rejects.toThrow(XriftAuthError);
  });

  it('404 で XriftApiError をスローする', async () => {
    mockFetch(404, { error: 'Not found' }, false);
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });

    await expect(client.get('/api/missing')).rejects.toThrow(XriftApiError);
    try {
      await client.get('/api/missing');
    } catch (e) {
      expect((e as XriftApiError).statusCode).toBe(404);
    }
  });

  it('ネットワークエラーで XriftNetworkError をスローする', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });

    await expect(client.get('/api/test')).rejects.toThrow(XriftNetworkError);
  });

  it('トークンなしの場合 Authorization ヘッダーを含めない', async () => {
    mockFetch(200, {});
    const client = new HttpClient({ baseUrl: 'https://api.test.com' });

    await client.get('/api/test');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/api/test',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
  });
});
