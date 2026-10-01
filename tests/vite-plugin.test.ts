import { describe, it, expect, vi, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { xriftDev, isProxiedApiPath, type DevMiddleware } from '../src/vite/index.js';

function createServer() {
  let handler: DevMiddleware | null = null;
  return {
    server: { middlewares: { use: (h: DevMiddleware) => (handler = h) } },
    handle: (url: string, method = 'GET') =>
      new Promise<{ status: number; body: string; passed: boolean }>((resolve) => {
        let passed = false;
        const res = {
          statusCode: 200,
          headers: {} as Record<string, string>,
          setHeader(name: string, value: string) {
            this.headers[name] = value;
          },
          end(body?: string) {
            resolve({ status: this.statusCode, body: body ?? '', passed });
          },
        };
        handler!({ url, method } as IncomingMessage, res as unknown as ServerResponse, () => {
          passed = true;
          resolve({ status: 0, body: '', passed });
        });
      }),
  };
}

describe('xriftDev', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('/__xrift 以外は素通りする', async () => {
    const { server, handle } = createServer();
    xriftDev({ token: 't' }).configureServer(server);
    expect((await handle('/index.html')).passed).toBe(true);
  });

  it('CLI トークンを Authorization に付けて API へ中継し、応答をそのまま返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sceneUrl: 'https://cdn/remoteEntry.js' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { server, handle } = createServer();
    xriftDev({ token: 'cli-token', apiBaseUrl: 'https://api.example/' }).configureServer(server);

    const result = await handle('/__xrift/items/abc/resolve?x=1');
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).sceneUrl).toBe('https://cdn/remoteEntry.js');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/public/v1/items/abc/resolve',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer cli-token' }),
      }),
    );
  });

  it('アイテム以外のパスは中継しない（トークンを付けて何でも転送しない）', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { server, handle } = createServer();
    xriftDev({ token: 't' }).configureServer(server);
    expect((await handle('/__xrift/users/me')).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isProxiedApiPath('/items/abc/resolve')).toBe(true);
    expect(isProxiedApiPath('/worlds/abc')).toBe(false);
  });

  it('GET 以外は 405', async () => {
    const { server, handle } = createServer();
    xriftDev({ token: 't' }).configureServer(server);
    expect((await handle('/__xrift/items/abc/resolve', 'POST')).status).toBe(405);
  });
});
