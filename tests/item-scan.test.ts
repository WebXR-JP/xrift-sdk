import { describe, it, expect } from 'vitest';
import {
  findItemIdsInBundle,
  findItemIdsInSource,
  findUndeclaredItemIds,
  formatUndeclaredItemsMessage,
  isDeclaredItemId,
} from '../src/itemScan.js';

const A = '0f1e2d3c-4b5a-4978-8a9b-0c1d2e3f4a5b';
const B = '1f1e2d3c-4b5a-4978-8a9b-0c1d2e3f4a5b';

describe('findItemIdsInSource', () => {
  it('minify 後の itemId:"…"・整形済みの itemId: "…"・JSX の itemId="…" を拾い、重複は1つに', () => {
    const source = [
      `jsx(Item,{placementId:"lamp-1",itemId:"${A}"})`,
      `jsx(Item, { placementId: 'lamp-2', itemId: '${A}' })`,
      `<Item placementId="x" itemId="${B.toUpperCase()}" />`,
    ].join('\n');
    expect(findItemIdsInSource(source)).toEqual([A, B]);
  });

  it('キーが引用符付きで出力されたとき（"itemId":"…"・\'itemId\': \'…\'）も拾う', () => {
    expect(findItemIdsInSource(`{"placementId":"a","itemId":"${A}"}`)).toEqual([A]);
    expect(findItemIdsInSource(`{ 'itemId': '${B}' }`)).toEqual([B]);
    // 開き引用符と閉じ引用符が揃わないものは拾わない
    expect(findItemIdsInSource(`{"itemId':"${A}"}`)).toEqual([]);
  });

  it('UUID でない値・別のキーは拾わない', () => {
    expect(findItemIdsInSource(`itemId:someVariable; itemId:"not-a-uuid"; otherId:"${A}"`)).toEqual([]);
  });
});

describe('findItemIdsInBundle / findUndeclaredItemIds', () => {
  it('JS だけを走査し、宣言との差分を返す（大文字小文字は区別しない）', () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    const files = [
      { remotePath: 'assets/index-abc.js', data: encode(`itemId:"${A}"`) },
      { remotePath: 'remoteEntry.js', data: encode(`itemId:"${B}"`) },
      { remotePath: 'assets/readme.txt', data: encode(`itemId:"2f1e2d3c-4b5a-4978-8a9b-0c1d2e3f4a5b"`) },
    ];
    const found = findItemIdsInBundle(files);
    expect(found).toEqual([A, B]);
    expect(findUndeclaredItemIds(found, [A.toUpperCase()])).toEqual([B]);
    expect(findUndeclaredItemIds(found, [A, B])).toEqual([]);
  });

  it('isDeclaredItemId は宣言との突き合わせと同じ規則（大文字小文字を区別しない）', () => {
    expect(isDeclaredItemId(A, [A.toUpperCase()])).toBe(true);
    expect(isDeclaredItemId(A, [B])).toBe(false);
    expect(isDeclaredItemId(A, [])).toBe(false);
  });

  it('メッセージに足りない id と直し方を載せる', () => {
    const message = formatUndeclaredItemsMessage([A]);
    expect(message).toContain('world.items');
    expect(message).toContain(`- ${A}`);
  });
});
