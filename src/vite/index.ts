import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { parseWorldConfig } from '../config.js';
import { DEFAULT_BASE_URL } from '../constants.js';

/**
 * xrift CLI がログイン時に保存するトークン（`xrift login`）
 * CLI の CONFIG_DIR / AUTH_CONFIG_FILE と同じ場所
 */
const CLI_AUTH_CONFIG_FILE = join(homedir(), '.xrift', 'config.json');

/** ブラウザ側（@xrift/world-components の DevEnvironment）が叩く中継のパス */
export const XRIFT_DEV_PROXY_PREFIX = '/__xrift';

/**
 * 中継を許す API のパス（完全一致）。DevEnvironment が叩く `/items/:id/resolve` だけ。
 *
 * 先頭一致にしない。`/items/../users/me` や `%2e%2e` は先頭一致を通ったあと fetch が URL を
 * 正規化して `/users/me` へ届き、CLI トークン（全スコープ）付きで何でも読めてしまう。
 * ローカル開発のページでは他人のアイテムのコードが動くので、ここが唯一の壁になる
 */
const ALLOWED_API_PATH_PATTERNS = [
  /^\/items\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/resolve$/i,
];
/** 中継パスから itemId を取り出す（許可リストを通ったあとに使う） */
const RESOLVE_ITEM_ID = /^\/items\/([^/]+)\/resolve$/i;

export interface XriftDevOptions {
  /** 中継先の API（既定は XRIFT_API_URL か https://api.xrift.net） */
  apiBaseUrl?: string;
  /** CLI トークンの代わりに使うトークン（CI などで `xrift login` できないとき） */
  token?: string;
  /**
   * xrift.json の場所（既定はプロジェクトルート直下）。
   * world.items に宣言の無い itemId は、本番と同じく「宣言されていない」で断る。
   * ファイルが無い・ワールドの設定でないときは宣言を見ない
   */
  configPath?: string;
}

type NextHandler = (error?: unknown) => void;
export type DevMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextHandler,
) => void;

/** Vite の ViteDevServer のうち使う部分だけ（vite に依存しないため構造で表す） */
export interface DevServerLike {
  middlewares: { use: (handler: DevMiddleware) => void };
  config: { root: string };
}

/** Vite の Plugin のうち使う部分だけ */
export interface XriftDevPlugin {
  name: string;
  configureServer: (server: DevServerLike) => void;
}

async function readCliToken(): Promise<string | null> {
  try {
    const raw = await readFile(CLI_AUTH_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === 'string' && parsed.token !== '' ? parsed.token : null;
  } catch {
    return null;
  }
}

/**
 * xrift.json の world.items を読む（要求のたびに読むので、追記してリロードすれば効く）
 * @returns 宣言の一覧。ファイルが無い・ワールドの設定でない・壊れているときは null（宣言を見ない）
 */
async function readDeclaredItems(configPath: string): Promise<string[] | null> {
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    return null;
  }
  try {
    return parseWorldConfig(raw).items ?? [];
  } catch {
    return null;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/** 中継してよい API パスか（`/items/<uuid>/resolve` だけ。トークンを付けて何でも転送しない） */
export function isProxiedApiPath(apiPath: string): boolean {
  return ALLOWED_API_PATH_PATTERNS.some((pattern) => pattern.test(apiPath));
}

/**
 * ローカル開発で `<Item itemId>` を本番と同じバンドルで動かすための Vite プラグイン
 *
 * ブラウザから `/__xrift/items/:id/resolve` への要求を受け、`xrift login` で保存した
 * CLI トークンを Authorization に付けて `${apiBaseUrl}/api/public/v1/items/:id/resolve` へ中継する。
 * トークンはブラウザ側のコードに一切出さない（開発サーバーの中だけで使う）
 *
 * xrift.json の world.items に無い itemId は中継せず、本番と同じ「宣言されていない」で断る。
 * 手元では動いたのにアップロードしたら箱になる、を書いたその場で気づけるようにするため
 *
 * ```ts
 * // vite.config.ts
 * import { xriftDev } from '@xrift/sdk/vite'
 * export default defineConfig({ plugins: [react(), xriftDev()] })
 * ```
 */
export function xriftDev(options: XriftDevOptions = {}): XriftDevPlugin {
  const apiBaseUrl = (
    options.apiBaseUrl ??
    process.env.XRIFT_API_URL ??
    DEFAULT_BASE_URL
  ).replace(/\/$/, '');

  const handleProxy = async (
    req: IncomingMessage,
    res: ServerResponse,
    apiPath: string,
    configPath: string,
  ): Promise<void> => {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'GET のみ中継します' });
      return;
    }
    if (!isProxiedApiPath(apiPath)) {
      sendJson(res, 404, { error: `中継しないパスです: ${apiPath}` });
      return;
    }

    // 宣言の確認はトークンより先（ログインしていなくても、宣言し忘れには気づける）
    const itemId = RESOLVE_ITEM_ID.exec(apiPath)?.[1] ?? '';
    const declared = await readDeclaredItems(configPath);
    if (declared !== null && !declared.some((id) => id.toLowerCase() === itemId.toLowerCase())) {
      sendJson(res, 404, {
        error: `アイテム ${itemId} は xrift.json の world.items に宣言されていません。本番では読まれないので、world.items に追加してください`,
        code: 'NOT_DECLARED',
      });
      return;
    }

    const token = options.token ?? (await readCliToken());
    if (!token) {
      sendJson(res, 401, {
        error: 'ログインしていません。xrift login を実行してください',
        code: 'LOGIN_REQUIRED',
      });
      return;
    }

    try {
      const upstream = await fetch(`${apiBaseUrl}/api/public/v1${apiPath}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const body = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
      );
      res.end(body);
    } catch (error) {
      sendJson(res, 502, {
        error: `XRift API に接続できません（${apiBaseUrl}）: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  };

  return {
    name: 'xrift-dev',
    configureServer(server) {
      const configPath =
        options.configPath === undefined
          ? join(server.config.root, 'xrift.json')
          : isAbsolute(options.configPath)
            ? options.configPath
            : join(server.config.root, options.configPath);
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(`${XRIFT_DEV_PROXY_PREFIX}/`)) return next();
        // クエリは中継しない（/resolve はパスだけで足りる）
        const apiPath = url.slice(XRIFT_DEV_PROXY_PREFIX.length).split('?')[0];
        void handleProxy(req, res, apiPath, configPath);
      });
    },
  };
}
