/**
 * Configuração de lint DIAGNÓSTICA — separada da configuração oficial.
 *
 * Por que um arquivo com nome diferente?
 * `eslint.config.mjs` é o arquivo autodetectado por ESLint e Next. Este arquivo
 * usa um nome que nenhum dos dois autodetecta de propósito: o diagnóstico NÃO
 * entra em `npm run lint`, no build, no deploy nem em CI. Ele só roda quando
 * chamado explicitamente (`npm run lint:diagnostic` / inventário / testes).
 *
 * Composição explícita e pequena — sem presets:
 * - nada de `tseslint.configs.*`, `@eslint/js`, plugin `next` ou regras de estilo;
 * - uma regra de correção para declarações não usadas em TypeScript
 *   (`@typescript-eslint/no-unused-vars`), uma para hooks
 *   (`react-hooks/rules-of-hooks`) e uma para dependências de efeito
 *   (`react-hooks/exhaustive-deps`);
 * - em JS/MJS/CJS, a cobertura atual do lint oficial é preservada
 *   (`no-unused-vars: warn`).
 *
 * Plugins em bloco comum:
 * o bloco T registra parser e plugins para TODO arquivo TS/TSX. Os blocos de
 * regras (aplicação, testes, ferramentas e fixtures) só declaram `rules`, então
 * nenhuma regra de plugin fica "sem definição" em nenhuma área.
 *
 * Política de diretivas inline:
 * o diagnóstico desliga inline config na engine (`--no-inline-config` na CLI,
 * `allowInlineConfig: false` na API e nos testes). Assim:
 * - diretivas existentes NÃO são aplicadas nem removidas — são inventariadas;
 * - ocorrências antes suprimidas passam a ser reportadas (documentado);
 * - diretivas que referenciam plugins não registrados (ex.:
 *   `@next/next/no-img-element`) não geram "Definition for rule ... was not
 *   found", erro de severidade 2 que NÃO aparece em `fatalErrorCount`.
 * `reportUnusedDisableDirectives: "off"` fica como defesa secundária; sozinho
 * ele não resolveria a referência a plugin ausente.
 *
 * Sem `--fix`, sem supressões em massa, sem regras de formatação.
 */

import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const tsParserOptions = {
  ecmaVersion: "latest",
  sourceType: "module",
  // JSX explícito para .tsx; inofensivo para .ts.
  ecmaFeatures: { jsx: true },
};

// Mesmos globals do eslint.config.mjs oficial (cobertura JS preservada).
const jsGlobals = {
  window: "readonly",
  document: "readonly",
  localStorage: "readonly",
  fetch: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  React: "readonly",
};

const noInlineDirectives = { reportUnusedDisableDirectives: "off" };

export default [
  {
    // Apenas gerado, dependência e build. Cada padrão tem motivo explícito.
    ignores: [
      "node_modules/**", // dependências instaladas
      ".next/**", // build do Next
      "out/**", // export estático
      "dist/**", // artefatos de build
      ".vercel/**", // metadados de deploy
      ".backup-work/**", // cópias de trabalho locais
      "logs/**", // logs de execução
      "metrics/**", // métricas geradas (jsonl gitignored)
      "graphify-out/**", // grafo gerado por ferramenta externa
      "supabase/.temp/**", // laboratório local gerado em runtime (inclui .next-web)
      "supabase/supabase/.temp/**", // mesmo laboratório, caminho alternativo
      "next-env.d.ts", // gerado pelo Next a cada build
      "tests/fixtures/lint-diagnostic/**", // fixtures com problemas plantados: só os testes as leem
    ],
  },
  {
    // Bloco A — JS/MJS/CJS: preserva exatamente a cobertura do lint oficial.
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: jsGlobals,
    },
    linterOptions: noInlineDirectives,
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off",
    },
  },
  {
    // Bloco T — comum a TODO TS/TSX: parser e plugins, sem regras.
    // É o que permite aos blocos B, C, D e E usarem regras de plugin sem
    // registrar plugins de novo (e sem "Definition for rule ... was not found").
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: tsParserOptions,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    linterOptions: noInlineDirectives,
  },
  {
    // Bloco B — aplicação. Regras React só aqui (e nas fixtures).
    // Exclui testes em `__tests__` E testes colocados fora dele
    // (ex.: src/app/**/foo.test.tsx), que de outra forma herdariam Hooks.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/__tests__/**", "**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Bloco C — testes. Sem regras React: teste não define componente.
    files: [
      "tests/**/*.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
      "**/*.{test,spec}.{ts,tsx}",
    ],
    ignores: ["tests/fixtures/lint-diagnostic/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  {
    // Bloco D — ferramentas: scripts, configs da raiz e proofs do Supabase.
    files: [
      "scripts/**/*.{ts,mts,cts}",
      "*.{ts,mts,cts}",
      "supabase/**/*.{ts,mts,cts}",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  {
    // Bloco E — fixtures sintéticas. Existe para que os testes comprovem o
    // disparo das três regras com `ignore: false`/`--no-ignore`. No CLI normal
    // este bloco é inalcançável: o diretório está no bloco de ignores acima.
    files: ["tests/fixtures/lint-diagnostic/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
