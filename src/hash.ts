import type { FileData } from './types/common.js';

/**
 * ユニバーサル SHA-256 ハッシュ計算 (先頭12文字)
 * - Node.js: node:crypto (動的 import)
 * - ブラウザ: Web Crypto API (crypto.subtle)
 */
export async function calculateContentHash(
  files: Array<{ remotePath: string; data: FileData }>,
  configValues?: Record<string, unknown>,
): Promise<string> {
  // ファイルをパスでソートして順序を確定
  const sortedFiles = [...files].sort((a, b) =>
    a.remotePath.localeCompare(b.remotePath),
  );

  // 全データを結合
  const chunks: Uint8Array[] = [];
  for (const file of sortedFiles) {
    chunks.push(toUint8Array(file.data));
  }

  // 設定値をハッシュに含める（キーをソートして順序を安定化）
  if (configValues) {
    const configString = JSON.stringify(configValues, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
          sorted[k] = (value as Record<string, unknown>)[k];
        }
        return sorted;
      }
      return value;
    });
    chunks.push(new TextEncoder().encode(configString));
  }

  const fullHash = await sha256Hex(chunks);
  return fullHash.substring(0, 12);
}

function toUint8Array(data: FileData): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

async function sha256Hex(chunks: Uint8Array[]): Promise<string> {
  // Node.js
  if (typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node) {
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256');
    for (const chunk of chunks) {
      hash.update(chunk);
    }
    return hash.digest('hex');
  }

  // ブラウザ (Web Crypto API)
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', merged);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
