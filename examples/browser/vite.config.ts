import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@xrift/sdk': path.resolve(__dirname, '../../src/index.ts'),
    },
  },
});
