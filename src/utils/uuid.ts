/** UUID の形（8-4-4-4-12 の16進数）。アイテム id の検証・走査・中継の許可リストで共用する */
export const UUID_PATTERN_SOURCE =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const UUID_PATTERN = new RegExp(`^${UUID_PATTERN_SOURCE}$`, 'i');

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
