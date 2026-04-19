import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { calculateContentHash } from '../src/hash.js';

describe('calculateContentHash', () => {
  it('ファイルのみのハッシュを計算する', async () => {
    const files = [
      { remotePath: 'index.html', data: new TextEncoder().encode('<html></html>') },
      { remotePath: 'app.js', data: new TextEncoder().encode('console.log("hello")') },
    ];

    const hash = await calculateContentHash(files);
    expect(hash).toHaveLength(12);
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('ファイルをパスでソートしてからハッシュする', async () => {
    const filesA = [
      { remotePath: 'b.js', data: new TextEncoder().encode('b') },
      { remotePath: 'a.js', data: new TextEncoder().encode('a') },
    ];
    const filesB = [
      { remotePath: 'a.js', data: new TextEncoder().encode('a') },
      { remotePath: 'b.js', data: new TextEncoder().encode('b') },
    ];

    const hashA = await calculateContentHash(filesA);
    const hashB = await calculateContentHash(filesB);
    expect(hashA).toBe(hashB);
  });

  it('configValues を含めたハッシュを計算する', async () => {
    const files = [
      { remotePath: 'index.html', data: new TextEncoder().encode('<html></html>') },
    ];

    const hashWithout = await calculateContentHash(files);
    const hashWith = await calculateContentHash(files, { gravity: 9.8 });
    expect(hashWithout).not.toBe(hashWith);
  });

  it('configValues のキー順序に依存しない', async () => {
    const files = [
      { remotePath: 'index.html', data: new TextEncoder().encode('<html></html>') },
    ];

    const hashA = await calculateContentHash(files, { a: 1, b: 2 });
    const hashB = await calculateContentHash(files, { b: 2, a: 1 });
    expect(hashA).toBe(hashB);
  });

  it('CLI の hash.ts と同じ結果を返す (互換性テスト)', async () => {
    // CLI と同じロジックを再現: ファイルバッファ + configValues を SHA-256
    const fileData = new TextEncoder().encode('hello world');
    const configValues = { physics: { gravity: 9.8 } };

    // SDK の計算
    const sdkHash = await calculateContentHash(
      [{ remotePath: 'test.txt', data: fileData }],
      configValues,
    );

    // CLI と同等の node:crypto 計算
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(fileData));
    const configString = JSON.stringify(configValues, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(value).sort()) {
          sorted[k] = value[k];
        }
        return sorted;
      }
      return value;
    });
    hash.update(configString);
    const expected = hash.digest('hex').substring(0, 12);

    expect(sdkHash).toBe(expected);
  });
});
