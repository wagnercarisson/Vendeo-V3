import { defineConfig } from 'vitest/config';
import { baseVitestConfig, loadTestCategories } from './vitest.shared';

const base = baseVitestConfig();

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: loadTestCategories()['integration.product-1-1'],
    testTimeout: 120000,
    hookTimeout: 60000,
  },
});
