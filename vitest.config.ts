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
    // `scripts/gsd/**` contém o validador de gate e seu teste em `node:test`
    // (executado via `node --test`), incompatível com o runner do Vitest.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      'scripts/gsd/**',
    ],
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
