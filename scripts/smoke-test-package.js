/**
 * ビルド成果物が ESM / CJS の両方から実際に読み込めるかを確認する。
 *
 * tsc の出力を .cjs へ改名する都合上、ファイル名と中の指定子がズレると
 * require が解決できず実行時に落ちる。型チェックでは検出できないため、
 * 実際に読み込んで確かめる。
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const checks = [
  ['CJS  .', () => require('../dist/cjs/index.cjs')],
  ['CJS  ./node', () => require('../dist/cjs/node/index.cjs')],
  ['ESM  .', () => import('../dist/esm/index.js')],
  ['ESM  ./node', () => import('../dist/esm/node/index.js')],
];

let failed = 0;
for (const [label, load] of checks) {
  try {
    const mod = await load();
    const names = Object.keys(mod).filter((k) => k !== 'default');
    if (names.length === 0) throw new Error('エクスポートが空');
    console.log(`ok   ${label} (${names.length} exports)`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} 件の読み込みに失敗しました`);
  process.exit(1);
}
