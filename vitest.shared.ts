import path from 'path';
import type { ViteUserConfig } from 'vitest/config';
import inventory from './scripts/testing/test-categories.json';

/**
 * Fonte única da partição executável da suíte global.
 * Ver `scripts/testing/test-categories.json` e `docs/testes/execucao-da-suite.md`.
 */
export interface TestCategories {
  nodeTest: string[];
  'integration.postgres': string[];
  'integration.product-1-1': string[];
}

const CATEGORIES = inventory as TestCategories;

export function loadTestCategories(): TestCategories {
  return CATEGORIES;
}

function resolveServerOnly(): string {
  const nextCompiled = path.resolve(
    __dirname,
    'node_modules/next/dist/compiled/server-only/empty.js',
  );
  const mockFile = path.resolve(__dirname, 'src/__tests__/__mocks__/server-only.ts');
  try {
    require.resolve(nextCompiled);
    return nextCompiled;
  } catch {
    return mockFile;
  }
}

const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
];

/**
 * Exclusões da suíte local: defaults do Vitest + todos os arquivos do
 * inventário de scripts/integração (31 caminhos). Não usa glob amplo.
 */
export function localExcludePatterns(): string[] {
  return [
    ...DEFAULT_EXCLUDE_PATTERNS,
    'scripts/gsd/**',
    'scripts/f56-2b2a/**',
    ...CATEGORIES.nodeTest,
    ...CATEGORIES['integration.postgres'],
    ...CATEGORIES['integration.product-1-1'],
  ];
}

export function baseVitestConfig(): ViteUserConfig {
  return {
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
  };
}
