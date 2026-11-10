import { defineConfig } from 'vitest/config';
import { baseVitestConfig, loadTestCategories } from './vitest.shared';

const base = baseVitestConfig();

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: loadTestCategories()['integration.f60-1'],
    testTimeout: 180000,
    hookTimeout: 120000,
  },
});
