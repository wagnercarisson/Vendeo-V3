import { defineConfig } from 'vitest/config';
import { baseVitestConfig, loadTestCategories } from './vitest.shared';

const base = baseVitestConfig();

/**
 * Perfil F63 — catálogo versionado de ofertas.
 *
 * Serial por desenho: a suíte abre conexões reais e observa locks no homolog
 * existente; os três arquivos compartilham a mesma tabela pequena e a mesma
 * linha singleton de `trial_offer_settings`. Nunca cria outro banco e nunca
 * aponta para produção.
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: loadTestCategories()['integration.f63'],
    testTimeout: 180000,
    hookTimeout: 60000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
