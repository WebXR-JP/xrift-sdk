import type {
  PhysicsConfig,
  CameraConfig,
  OutputBufferType,
} from './types/common.js';
import type { WorldPermissions } from './types/worlds.js';
import type { ItemPermissions } from './types/items.js';
import { XriftSdkError } from './errors.js';

// --- Types ---

export interface XriftWorldConfig {
  type: 'world';
  distDir: string;
  name: string;
  description?: string;
  thumbnailPath?: string;
  ignore: string[];
  physics?: PhysicsConfig;
  camera?: CameraConfig;
  permissions?: WorldPermissions;
  outputBufferType?: OutputBufferType;
}

export interface XriftItemConfig {
  type: 'item';
  distDir: string;
  name: string;
  description?: string;
  thumbnailPath?: string;
  ignore: string[];
  permissions?: ItemPermissions;
}

export type XriftConfig = XriftWorldConfig | XriftItemConfig;

// --- Constants ---

export const DEFAULT_IGNORE_PATTERNS = ['__federation_shared_*.js'];

// --- Functions ---

function parseJson(json: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new XriftSdkError('Invalid JSON in xrift.json');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new XriftSdkError('xrift.json must be a JSON object');
  }

  return raw as Record<string, unknown>;
}

/**
 * xrift.json の JSON 文字列をパースしてワールド設定を返す。
 * "world" キーが存在しない場合はエラーをスローする。
 */
export function parseWorldConfig(json: string): XriftWorldConfig {
  const root = parseJson(json);

  if (!root.world) {
    throw new XriftSdkError(
      'xrift.json does not contain a "world" key',
    );
  }

  const raw = root.world;
  if (typeof raw !== 'object' || raw === null) {
    throw new XriftSdkError('"world" must be an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.distDir !== 'string' || !obj.distDir) {
    throw new XriftSdkError('"world.distDir" is required');
  }

  return {
    type: 'world',
    distDir: normalizePath(obj.distDir),
    name: typeof obj.title === 'string' && obj.title ? obj.title : 'Untitled',
    description:
      typeof obj.description === 'string' ? obj.description : undefined,
    thumbnailPath:
      typeof obj.thumbnailPath === 'string' ? obj.thumbnailPath : undefined,
    ignore: mergeIgnorePatterns(obj.ignore),
    physics: obj.physics as PhysicsConfig | undefined,
    camera: obj.camera as CameraConfig | undefined,
    permissions: obj.permissions as WorldPermissions | undefined,
    outputBufferType: obj.outputBufferType as OutputBufferType | undefined,
  };
}

/**
 * xrift.json の JSON 文字列をパースしてアイテム設定を返す。
 * "item" キーが存在しない場合はエラーをスローする。
 */
export function parseItemConfig(json: string): XriftItemConfig {
  const root = parseJson(json);

  if (!root.item) {
    throw new XriftSdkError(
      'xrift.json does not contain an "item" key',
    );
  }

  const raw = root.item;
  if (typeof raw !== 'object' || raw === null) {
    throw new XriftSdkError('"item" must be an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.distDir !== 'string' || !obj.distDir) {
    throw new XriftSdkError('"item.distDir" is required');
  }

  return {
    type: 'item',
    distDir: normalizePath(obj.distDir),
    name: typeof obj.title === 'string' && obj.title ? obj.title : 'Untitled',
    description:
      typeof obj.description === 'string' ? obj.description : undefined,
    thumbnailPath:
      typeof obj.thumbnailPath === 'string' ? obj.thumbnailPath : undefined,
    ignore: mergeIgnorePatterns(obj.ignore),
    permissions: obj.permissions as ItemPermissions | undefined,
  };
}

function mergeIgnorePatterns(raw: unknown): string[] {
  const userPatterns =
    Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string') : [];
  const merged = [...DEFAULT_IGNORE_PATTERNS];
  for (const p of userPatterns) {
    if (!merged.includes(p)) {
      merged.push(p);
    }
  }
  return merged;
}

/** "./dist" → "dist", "dist/" → "dist", "." → "" */
function normalizePath(p: string): string {
  return p
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
    .replace(/^\.?$/, '');
}

/**
 * ignore パターンでファイルパスをフィルタリングする。
 * マッチしたファイルを除外し、残ったファイルパスを返す。
 */
export function filterFiles(
  filePaths: string[],
  ignorePatterns: string[],
): string[] {
  return filePaths.filter(
    (filePath) => !matchesIgnorePattern(filePath, ignorePatterns),
  );
}

function matchesIgnorePattern(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(
      '^' +
        pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') +
        '$',
    );
    const fileName = filePath.split('/').pop() ?? filePath;
    return regex.test(filePath) || regex.test(fileName);
  });
}
