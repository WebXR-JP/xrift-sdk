/**
 * 公開されるパッケージが実際に読み込めるかを確認する。
 *
 * tsc の出力を .cjs へ改名する都合上、ファイル名と中の指定子がズレると
 * require が解決できず実行時に落ちる。型チェックでもユニットテストでも
 * 検出できないため、実際に読み込んで確かめる。
 *
 * dist を直接読むのではなく npm pack した tarball を install して
 * パッケージ名で読み込む。こうすると exports の誘導と files の指定まで
 * まとめて検証できる（entry point が壊れていれば publish 前に落ちる）。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { name } = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xrift-sdk-smoke-'));

try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', workDir], packageRoot));
  const tarball = path.join(workDir, packed[0].filename);

  fs.writeFileSync(
    path.join(workDir, 'package.json'),
    JSON.stringify({ name: 'smoke-consumer', version: '1.0.0', private: true }),
  );
  run('npm', ['install', tarball, '--no-audit', '--no-fund'], workDir);

  // パッケージ名で読む＝利用者と同じ経路（exports）を通す
  const consumers = {
    'consumer.cjs': `
      const entries = { '.': require('${name}'), './node': require('${name}/node') };
      console.log(JSON.stringify(Object.fromEntries(
        Object.entries(entries).map(([k, m]) => [k, Object.keys(m).filter((n) => n !== 'default')])
      )));
    `,
    'consumer.mjs': `
      import * as root from '${name}';
      import * as node from '${name}/node';
      const entries = { '.': root, './node': node };
      console.log(JSON.stringify(Object.fromEntries(
        Object.entries(entries).map(([k, m]) => [k, Object.keys(m).filter((n) => n !== 'default')])
      )));
    `,
  };

  let failed = 0;
  for (const [file, source] of Object.entries(consumers)) {
    const kind = file.endsWith('.cjs') ? 'CJS' : 'ESM';
    fs.writeFileSync(path.join(workDir, file), source);
    try {
      const result = JSON.parse(run('node', [file], workDir));
      for (const [subpath, names] of Object.entries(result)) {
        if (names.length === 0) throw new Error(`${subpath} のエクスポートが空`);
        console.log(`ok   ${kind} ${name}${subpath === '.' ? '' : subpath.slice(1)} (${names.length} exports)`);
      }
    } catch (error) {
      failed++;
      console.error(`FAIL ${kind}: ${error.message}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} 件の読み込みに失敗しました`);
    process.exit(1);
  }
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
