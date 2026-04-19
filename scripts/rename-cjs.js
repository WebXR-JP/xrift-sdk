import fs from 'node:fs';
import path from 'node:path';

const cjsDir = path.resolve('dist/cjs');

function renameFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      renameFiles(fullPath);
    } else if (entry.name.endsWith('.js')) {
      fs.renameSync(fullPath, fullPath.replace(/\.js$/, '.cjs'));
    } else if (entry.name.endsWith('.d.ts')) {
      fs.renameSync(fullPath, fullPath.replace(/\.d\.ts$/, '.d.cts'));
    } else if (entry.name.endsWith('.js.map')) {
      fs.renameSync(fullPath, fullPath.replace(/\.js\.map$/, '.cjs.map'));
    } else if (entry.name.endsWith('.d.ts.map')) {
      fs.renameSync(fullPath, fullPath.replace(/\.d\.ts\.map$/, '.d.cts.map'));
    }
  }
}

renameFiles(cjsDir);
