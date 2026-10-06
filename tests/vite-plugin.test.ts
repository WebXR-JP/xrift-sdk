import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { xriftDev, isProxiedApiPath, type DevMiddleware } from '../src/vite/index.js';

const ITEM_ID = '0f1e2d3c-4b5a-4978-8a9b-0c1d2e3f4a5b';

function createServer(root = '/nonexistent-root') {
  let handler: DevMiddleware | null = null;
  return {
    server: { middlewares: { use: (h: DevMiddleware) => (handler = h) }, config: { root } },
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

    const result = await handle(`/__xrift/items/${ITEM_ID}/resolve?x=1`);
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).sceneUrl).toBe('https://cdn/remoteEntry.js');
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example/api/public/v1/items/${ITEM_ID}/resolve`,
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
    expect(isProxiedApiPath(`/items/${ITEM_ID}/resolve`)).toBe(true);
    expect(isProxiedApiPath('/worlds/abc')).toBe(false);
  });

  it('`..` や別の形のパスで許可リストを抜けられない（fetch が正規化して /users/me へ届くのを防ぐ）', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { server, handle } = createServer();
    xriftDev({ token: 't' }).configureServer(server);
    for (const url of [
      '/__xrift/items/../users/me',
      '/__xrift/items/%2e%2e/users/me',
      `/__xrift/items/${ITEM_ID}/resolve/../../users/me`,
      '/__xrift/items/abc/resolve',
      `/__xrift/items/${ITEM_ID}`,
    ]) {
      expect((await handle(url)).status, url).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('xrift.json の world.items との突き合わせ', () => {
    let root: string;
    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'xrift-vite-'));
    });
    afterEach(async () => {
      await rm(root, { recursive: true });
    });

    // Response は本文を一度しか読めないので、呼ばれるたびに新しく作る
    const ok = () =>
      vi.fn().mockImplementation(async () =>
        new Response(JSON.stringify({ sceneUrl: 'https://cdn/remoteEntry.js' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    it('宣言に無い itemId は中継せず NOT_DECLARED で断る（本番と同じ理由）', async () => {
      await writeFile(
        join(root, 'xrift.json'),
        JSON.stringify({ world: { distDir: './dist', title: 'W', items: [] } }),
      );
      const fetchMock = ok();
      vi.stubGlobal('fetch', fetchMock);
      const { server, handle } = createServer(root);
      xriftDev({ token: 't' }).configureServer(server);

      const result = await handle(`/__xrift/items/${ITEM_ID}/resolve`);
      expect(result.status).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.code).toBe('NOT_DECLARED');
      expect(body.error).toContain('world.items');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('宣言にあれば中継する（大文字小文字は区別しない）。追記はリロードだけで効く', async () => {
      const fetchMock = ok();
      vi.stubGlobal('fetch', fetchMock);
      const { server, handle } = createServer(root);
      xriftDev({ token: 't' }).configureServer(server);

      await writeFile(join(root, 'xrift.json'), JSON.stringify({ world: { distDir: './dist', title: 'W' } }));
      expect((await handle(`/__xrift/items/${ITEM_ID}/resolve`)).status).toBe(404);

      await writeFile(
        join(root, 'xrift.json'),
        JSON.stringify({ world: { distDir: './dist', title: 'W', items: [ITEM_ID.toUpperCase()] } }),
      );
      expect((await handle(`/__xrift/items/${ITEM_ID}/resolve`)).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('xrift.json が無い・ワールドの設定でないときは宣言を見ずに中継する', async () => {
      const fetchMock = ok();
      vi.stubGlobal('fetch', fetchMock);
      const { server, handle } = createServer(root);
      xriftDev({ token: 't' }).configureServer(server);
      expect((await handle(`/__xrift/items/${ITEM_ID}/resolve`)).status).toBe(200);

      await writeFile(join(root, 'xrift.json'), JSON.stringify({ item: { distDir: './dist', title: 'I' } }));
      expect((await handle(`/__xrift/items/${ITEM_ID}/resolve`)).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('configPath で xrift.json の場所を変えられる', async () => {
      await writeFile(join(root, 'custom.json'), JSON.stringify({ world: { distDir: './dist', title: 'W', items: [] } }));
      vi.stubGlobal('fetch', ok());
      const { server, handle } = createServer(root);
      xriftDev({ token: 't', configPath: 'custom.json' }).configureServer(server);
      expect(JSON.parse((await handle(`/__xrift/items/${ITEM_ID}/resolve`)).body).code).toBe('NOT_DECLARED');
    });
  });

  it('GET 以外は 405', async () => {
    const { server, handle } = createServer();
    xriftDev({ token: 't' }).configureServer(server);
    expect((await handle(`/__xrift/items/${ITEM_ID}/resolve`, 'POST')).status).toBe(405);
  });
});
