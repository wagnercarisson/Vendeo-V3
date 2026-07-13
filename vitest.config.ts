import { defineConfig } from 'vitest/config';
import path from 'path';

function resolveServerOnly(): string {
  const nextCompiled = path.resolve(__dirname, 'node_modules/next/dist/compiled/server-only/empty.js');
  const mockFile = path.resolve(__dirname, 'src/__tests__/__mocks__/server-only.ts');
  try {
    require.resolve(nextCompiled);
    return nextCompiled;
  } catch {
    return mockFile;
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': resolveServerOnly(),
    },
  },
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
});
