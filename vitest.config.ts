import { defineConfig } from 'vitest/config';
import { baseVitestConfig, localExcludePatterns } from './vitest.shared';

const base = baseVitestConfig();

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    exclude: localExcludePatterns(),
  },
});
