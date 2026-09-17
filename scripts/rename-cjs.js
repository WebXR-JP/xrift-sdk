import fs from 'node:fs';
import path from 'node:path';

const cjsDir = path.resolve('dist/cjs');

/**
 * tsc は CJS 向け出力でも拡張子 .js のまま出すため、.cjs / .d.cts へ改名する。
 * このとき **ファイル名だけ変えてもファイル内の参照は .js のまま**なので、
 * require('./client.js') が解決できず実行時に落ちる。指定子も併せて書き換える。
 */
function renameFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      renameFiles(fullPath);
    } else if (entry.name.endsWith('.d.ts.map')) {
      fs.renameSync(fullPath, fullPath.replace(/\.d\.ts\.map$/, '.d.cts.map'));
    } else if (entry.name.endsWith('.d.ts')) {
      fs.renameSync(fullPath, fullPath.replace(/\.d\.ts$/, '.d.cts'));
    } else if (entry.name.endsWith('.js.map')) {
      fs.renameSync(fullPath, fullPath.replace(/\.js\.map$/, '.cjs.map'));
    } else if (entry.name.endsWith('.js')) {
      fs.renameSync(fullPath, fullPath.replace(/\.js$/, '.cjs'));
    }
  }
}

/**
 * 相対パスの指定子だけを .cjs に書き換える。
 *
 * 一括置換にしないのは、`'__federation_shared_*.js'` のような
 * 「.js で終わるただの文字列」を壊さないため。
 */
function rewriteSpecifiers(source) {
  const relative = String.raw`\.{1,2}/[^'"]*?`;
  return source
    .replace(new RegExp(String.raw`require\((['"])(${relative})\.js\1\)`, 'g'), 'require($1$2.cjs$1)')
    .replace(new RegExp(String.raw`from (['"])(${relative})\.js\1`, 'g'), 'from $1$2.cjs$1')
    .replace(new RegExp(String.raw`import\((['"])(${relative})\.js\1\)`, 'g'), 'import($1$2.cjs$1)')
    .replace(/\/\/# sourceMappingURL=(\S+)\.d\.ts\.map/g, '//# sourceMappingURL=$1.d.cts.map')
    .replace(/\/\/# sourceMappingURL=(\S+)\.js\.map/g, '//# sourceMappingURL=$1.cjs.map');
}

function rewriteFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteFiles(fullPath);
      continue;
    }
    if (entry.name.endsWith('.cjs') || entry.name.endsWith('.d.cts')) {
      fs.writeFileSync(fullPath, rewriteSpecifiers(fs.readFileSync(fullPath, 'utf8')));
    } else if (entry.name.endsWith('.map')) {
      // ソースマップの file フィールドも改名後の名前に合わせる
      const map = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (typeof map.file === 'string') {
        map.file = map.file.replace(/\.d\.ts$/, '.d.cts').replace(/\.js$/, '.cjs');
        fs.writeFileSync(fullPath, JSON.stringify(map));
      }
    }
  }
}

renameFiles(cjsDir);
rewriteFiles(cjsDir);
