import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { XriftClient } from '../client.js';
import { parseWorldConfig, parseItemConfig, filterFiles } from '../config.js';
import { XriftSdkError } from '../errors.js';
import {
  findItemIdsInBundle,
  findUndeclaredItemIds,
  formatUndeclaredItemsMessage,
} from '../itemScan.js';
import { getMimeType } from '../utils/mime.js';
import type {
  UploadFile,
  UploadProgress,
} from '../types/common.js';
import type { WorldUploadResult } from '../types/worlds.js';
import type { ItemUploadResult } from '../types/items.js';

// --- Types ---

export interface UploadFromDirectoryBaseOptions {
  token: string;
  baseUrl?: string;
  timeout?: number;
  onProgress?: (progress: UploadProgress) => void;
}

export interface WorldUploadFromDirectoryOptions
  extends UploadFromDirectoryBaseOptions {
  worldId?: string;
  /**
   * ビルド成果物の `<Item itemId>` と xrift.json の world.items の突き合わせを飛ばす。
   * 誤検知（<Item> で使っていない id が拾われた）のときだけ使う
   */
  skipItemScan?: boolean;
}

export interface ItemUploadFromDirectoryOptions
  extends UploadFromDirectoryBaseOptions {
  itemId?: string;
}

// --- Helpers ---

async function listFilesRecursively(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursively(fullPath)));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

async function buildUploadFiles(
  dirPath: string,
  distDir: string,
  ignorePatterns: string[],
): Promise<UploadFile[]> {
  const distPath = distDir ? join(dirPath, distDir) : dirPath;

  let distStat;
  try {
    distStat = await stat(distPath);
  } catch {
    throw new XriftSdkError(`distDir not found: ${distPath}`);
  }
  if (!distStat.isDirectory()) {
    throw new XriftSdkError(`distDir is not a directory: ${distPath}`);
  }

  const absolutePaths = await listFilesRecursively(distPath);
  const relativePaths = absolutePaths.map((p) => relative(distPath, p));
  const filtered = filterFiles(relativePaths, ignorePatterns);

  const uploadFiles: UploadFile[] = await Promise.all(
    filtered.map(async (remotePath) => {
      const fullPath = join(distPath, remotePath);
      const data = await readFile(fullPath);
      return {
        remotePath,
        size: data.byteLength,
        contentType: getMimeType(remotePath),
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer,
      };
    }),
  );

  return uploadFiles;
}

async function readConfigJson(dirPath: string): Promise<string> {
  const configPath = join(dirPath, 'xrift.json');
  try {
    return await readFile(configPath, 'utf-8');
  } catch {
    throw new XriftSdkError(`xrift.json not found: ${configPath}`);
  }
}

// --- Public API ---

export async function uploadWorldFromDirectory(
  dirPath: string,
  options: WorldUploadFromDirectoryOptions,
): Promise<WorldUploadResult> {
  const raw = await readConfigJson(dirPath);
  const wc = parseWorldConfig(raw);

  const uploadFiles = await buildUploadFiles(
    dirPath,
    wc.distDir,
    wc.ignore,
  );

  // 宣言し忘れはここで止める。本番では world.items に無いアイテムは読まれず、
  // 入室して初めて「宣言されていない」の箱で気づくことになる
  if (!options.skipItemScan) {
    const undeclared = findUndeclaredItemIds(findItemIdsInBundle(uploadFiles), wc.items ?? []);
    if (undeclared.length > 0) {
      throw new XriftSdkError(formatUndeclaredItemsMessage(undeclared));
    }
  }

  const client = new XriftClient({
    token: options.token,
    baseUrl: options.baseUrl,
    timeout: options.timeout,
  });

  return client.worlds.upload(uploadFiles, {
    worldId: options.worldId,
    name: wc.name,
    description: wc.description,
    thumbnailPath: wc.thumbnailPath,
    physics: wc.physics,
    camera: wc.camera,
    permissions: wc.permissions,
    outputBufferType: wc.outputBufferType,
    items: wc.items,
    onProgress: options.onProgress,
  });
}

export async function uploadItemFromDirectory(
  dirPath: string,
  options: ItemUploadFromDirectoryOptions,
): Promise<ItemUploadResult> {
  const raw = await readConfigJson(dirPath);
  const ic = parseItemConfig(raw);

  const uploadFiles = await buildUploadFiles(
    dirPath,
    ic.distDir,
    ic.ignore,
  );

  const client = new XriftClient({
    token: options.token,
    baseUrl: options.baseUrl,
    timeout: options.timeout,
  });

  return client.items.upload(uploadFiles, {
    itemId: options.itemId,
    name: ic.name,
    description: ic.description,
    thumbnailPath: ic.thumbnailPath,
    permissions: ic.permissions,
    onProgress: options.onProgress,
  });
}
