import { UUID_PATTERN_SOURCE } from './utils/uuid.js';

/**
 * ワールドのビルド成果物から `<Item itemId="...">` の id を拾う
 *
 * JSX は `jsx(Item, { itemId: "…" })` に、minify 後は `itemId:"…"` にコンパイルされ、UUID の文字列が
 * そのまま残る。これを xrift.json の world.items と突き合わせ、宣言し忘れをアップロード前に止める。
 * id を変数で組み立てているものは拾えない（そのぶんはローカル開発の中継が本番と同じ理由で断る）
 */

/**
 * `itemId:"<uuid>"`・`itemId: '<uuid>'`・`"itemId":"<uuid>"`（キーが引用符付きで出力されたとき）・
 * `itemId="<uuid>"`（JSX のまま残った場合）
 */
const ITEM_ID_LITERAL = new RegExp(
  `(["']?)\\bitemId\\b\\1\\s*[:=]\\s*(["'])(${UUID_PATTERN_SOURCE})\\2`,
  'gi',
);

/** JS として扱う拡張子（この中だけを走査する。画像や wasm は読まない） */
const SCRIPT_EXTENSIONS = ['.js', '.mjs', '.cjs'];

/** ソース文字列から itemId の UUID を重複なしで拾う（小文字に揃える） */
export function findItemIdsInSource(source: string): string[] {
  const ids: string[] = [];
  for (const match of source.matchAll(ITEM_ID_LITERAL)) {
    const id = match[3].toLowerCase();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function isScriptPath(remotePath: string): boolean {
  const lower = remotePath.toLowerCase();
  return SCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** アップロードするファイル群（JS だけ）から itemId を拾う */
export function findItemIdsInBundle(
  files: ReadonlyArray<{ remotePath: string; data: ArrayBuffer | Uint8Array }>,
): string[] {
  const decoder = new TextDecoder();
  const ids: string[] = [];
  for (const file of files) {
    if (!isScriptPath(file.remotePath)) continue;
    for (const id of findItemIdsInSource(decoder.decode(file.data))) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** 宣言に含まれているか（大文字小文字は区別しない）。中継とアップロードで同じ規則を使う */
export function isDeclaredItemId(itemId: string, declared: Iterable<string>): boolean {
  return findUndeclaredItemIds([itemId], declared).length === 0;
}

/** コードにあるのに宣言に無い id（大文字小文字は区別しない） */
export function findUndeclaredItemIds(
  found: Iterable<string>,
  declared: Iterable<string>,
): string[] {
  const declaredSet = new Set(Array.from(declared, (id) => id.toLowerCase()));
  return Array.from(found).filter((id) => !declaredSet.has(id.toLowerCase()));
}

/** 宣言し忘れを伝えるメッセージ（CLI がそのまま表示する） */
export function formatUndeclaredItemsMessage(undeclared: ReadonlyArray<string>): string {
  return [
    'コードで <Item itemId> に使っているアイテムが xrift.json の world.items に宣言されていません。',
    '本番では宣言の無いアイテムは読まれないので、world.items に追加してください:',
    ...undeclared.map((id) => `  - ${id}`),
    '（<Item> で使っていない id が拾われた誤検知なら、skipItemScan でこの確認を飛ばせます）',
  ].join('\n');
}
