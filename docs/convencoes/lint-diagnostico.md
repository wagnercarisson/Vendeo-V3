# Lint diagnóstico (TypeScript/React) — convenção

Ferramenta **separada** do lint oficial. Não está em `npm run lint`, no `build`,
no `vercel.json` nem em CI. Nesta quick ela é **diagnóstico**, não gate.

## Por que existe

`eslint.config.mjs` não tem parser TypeScript: `npm run lint` analisa apenas
`.js`/`.mjs`/`.cjs` (80 arquivos na baseline de 2026-11-21). Nenhum `.ts`/`.tsx`
de `src/` era lido — o que deixava passar declarações não usadas, violações de
regras de hooks e dependências de efeito em ~1.851 arquivos.

`eslint.diagnostic.config.mjs` cobre TypeScript/TSX com composição explícita e
pequena, sem presets, sem regras de estilo e sem `no-explicit-any`.

## Comandos

```powershell
npm.cmd run lint:diagnostic
npm.cmd run lint:diagnostic:inventory -- --out <dir> --baseline <arquivo>
npm.cmd run test:lint-config
node scripts/lint/prod-deps-guard.mjs snapshot --out <arquivo>
node scripts/lint/prod-deps-guard.mjs compare --before <a> --after <b>
```

- `lint:diagnostic` = `eslint --config eslint.diagnostic.config.mjs --no-inline-config --max-warnings 0 .`
  O exit code é **real**: 1 quando há qualquer achado (as severidades do
  diagnóstico são warnings por desenho, daí `--max-warnings 0`). Não há `|| true`
  e nenhum wrapper mascara o resultado.
- `lint:diagnostic:inventory` gera `inventory.json` + `inventory.md` via API do
  ESLint. Exit 0 significa “relatório produzido sem erro de configuração/fatal”;
  achados são dados. Exit 1 em erro fatal, erro de configuração ou falha de I/O.
- `test:lint-config` roda as provas da configuração (cobertura real,
  disparo das regras, paridade CLI/API e diretivas).
- `prod-deps-guard` compara a árvore produtiva do lockfile antes/depois de um
  install (ver abaixo).

## Cobertura

Medido em 2026-11-21 (inventário da quick `261121-k4g`):

| Família | Baseline oficial | Diagnóstico |
|---|---|---|
| `.js`/`.mjs`/`.cjs` | 79 `.mjs` + 1 `.js` | 76 `.mjs` + 1 `.js` |
| `.ts` | — | 1.442 |
| `.tsx` | — | 442 |
| `.d.ts` | — | 2 |
| `.d.mts` | — | 1 |
| **Total** | **80** | **1.964** |

Delta de cobertura, explicitamente:

- **Removidos (8):** `supabase/.temp/landing-lab/**` — scripts gerados em runtime
  e gitignored; não são código do produto.
- **Adicionados (1.892):** `.ts`/`.tsx` recém-cobertos, configs da raiz, testes e
  ferramentas. A lista completa está em `coverage.filesAdded` no inventário.

## Severidade

| Regra | Severidade | Motivo |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | warn | Volume alto e muitos falsos positivos por convenção (`_param`, type-only). Não é bug por si. |
| `react-hooks/rules-of-hooks` | error | Violação é corretude de React, não estilo. |
| `react-hooks/exhaustive-deps` | warn | Frequentemente intencional; exige contexto. |
| `no-unused-vars` (JS/MJS/CJS) | warn | Preserva a severidade do lint oficial. |

Não habilitados de propósito: presets strict, regras de formatação, `no-explicit-any`,
React Compiler.

## Política de diretivas inline

O diagnóstico desliga diretivas inline **na engine**: `--no-inline-config` na
CLI, `allowInlineConfig: false` na API e nos testes.

- Comentários `eslint-disable*` existentes **não são removidos** nem alterados;
  são inventariados (`suppressions` no `inventory.json`).
- Ocorrências antes suprimidas **passam a ser reportadas**. No repositório, as
  únicas diretivas relevantes para este diagnóstico são 5 de
  `react-hooks/exhaustive-deps`; as demais apontam para regras não habilitadas.
- `linterOptions.reportUnusedDisableDirectives: "off"` é apenas defesa
  secundária. Ele **não** resolve diretiva que referencia plugin ausente: uma
  diretiva para `@next/next/no-img-element` gera “Definition for rule … was not
  found” com severidade 2 e `fatalErrorCount: 0`. Por isso a garantia é
  engine-level, e o inventário trata essa classe como `configErrors`.

## Ignorados (e por quê)

`node_modules/` (dependências), `.next/` e `out/` (build), `dist/` (artefatos),
`.vercel/` (deploy), `.backup-work/` (cópias locais), `logs/` e `metrics/`
(gerados), `graphify-out/` (ferramenta externa), `supabase/.temp/**` e
`supabase/supabase/.temp/**` (laboratório runtime), `next-env.d.ts` (gerado pelo
Next), `tests/fixtures/lint-diagnostic/**` (fixtures com problemas plantados,
lidas apenas pelos testes).

Nada de aplicação é ignorado.

## Limitações

- Sem regras type-aware (`parserOptions.project` não é usado).
- Sem presets: o número de achados é menor que um preset estrito.
- `next-env.d.ts` é gerado e ignorado; `.d.ts` de `src/` são analisados.
- `eslint-plugin-react-hooks@7` traz `@babel/*`/`hermes-parser` como transitivas
  (custo de instalação, aceito para manter ESLint 10).
- `eslint-config-next@15.5.x` declara suporte só até ESLint 9 e **não** é usado.
- O diagnóstico mede o código **sem** supressões, não o que o lint oficial
  reportaria com elas.

## Dependências produtivas

`scripts/lint/prod-deps-guard.mjs` lê `package-lock.json` e compara **todas as
entradas produtivas** (`dev !== true && devOptional !== true`, hoje 255), o que
inclui peers resolvidos (`peer: true`, hoje 30) e opcionais. Campos comparados:
presença, `version`, `resolved`, `integrity`, `optional`, `peer`. Um fechamento
manual por `dependencies`/`optionalDependencies` alcançaria apenas 216 e
deixaria 39 de fora — por isso não é usado. Qualquer diferença = parada, sem
atualização automática. Nenhum peer é instalado para a conferência.

## Como ler o inventário

- `totals`: arquivos, erros, warnings, fatais, avisos e erros de configuração.
- `byRule` / `byArea` / `topFiles`: onde o volume está.
- `fatal` / `configNotices` / `configErrors`: problema de ferramenta, separado de
  achado de código.
- `suppressions`: diretivas encontradas (não aplicadas).
- `coverage`: baseline, diagnóstico, removidos com motivo, adicionados e
  extensões recém-cobertas.
- `strictExitCode` aparece no resumo: é o exit code que `lint:diagnostic`
  devolveria.

## Estado nesta quick

Diagnóstico **preparado e medido**: 1.964 arquivos, 373 warnings, 0 erros,
0 fatais, 0 erros de configuração. A integração ao lint oficial e qualquer
correção de achado exigem aprovação própria e ficam fora desta entrega.
