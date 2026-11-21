---
phase: 261121-k4g
plan: 01
status: complete
completed: 2026-11-21
branch: chore/lint-typescript-diagnostico
base_commit: c9d68fbe
commits:
  - 4881302d
  - a9cc0d1f
---

# Quick 261121-k4g — Diagnóstico real de lint para TypeScript/React

**Resultado:** ferramenta de diagnóstico preparada, medida e inventariada.
**Nada foi corrigido, integrado ao lint oficial, publicado, merjado ou ativado.**
Parada no Ponto B para revisão humana.

## Configuração entregue

| Item | Entrega |
|---|---|
| Configuração | `eslint.diagnostic.config.mjs` — separada de `eslint.config.mjs` (que permaneceu byte a byte igual) |
| Scripts | `lint:diagnostic`, `lint:diagnostic:inventory`, `test:lint-config` |
| Inventário | `scripts/lint/build-inventory.mjs` (API do ESLint, `allowInlineConfig: false`) |
| Guard produtivo | `scripts/lint/prod-deps-guard.mjs` (lockfile, sem instalar nada) |
| Provas | `tests/lint-config/lint-config.test.mjs` (11 testes) + `prod-deps-guard.test.mjs` (6 testes) + 8 fixtures |
| Doc | `docs/convencoes/lint-diagnostico.md` |

Composição explícita, sem presets: `@typescript-eslint/no-unused-vars` (warn),
`react-hooks/rules-of-hooks` (error), `react-hooks/exhaustive-deps` (warn) e
`no-unused-vars` (warn) preservado em JS/MJS/CJS. Parser e plugins ficam em
bloco comum a todo TS/TSX; regras React só na aplicação e nas fixtures.

### Versões

| Ferramenta | Versão | Compatibilidade declarada |
|---|---|---|
| Node | v24.13.1 | — |
| ESLint | 10.4.0 | mantido (sem downgrade) |
| TypeScript | 5.9.3 | — |
| `typescript-eslint` | 8.73.0 (dev) | peer `eslint ^8.57 \|\| ^9 \|\| ^10`; `typescript >=4.8.4 <6.1.0` |
| `eslint-plugin-react-hooks` | 7.1.1 (dev) | peer `eslint ^3…^10` |

`eslint-config-next` **não** foi instalado (declara suporte só até ESLint 9).
Nenhum `--force`/`--legacy-peer-deps`; nenhum downgrade ou upgrade de Next/React.

## Cobertura

| Família | Baseline oficial | Diagnóstico |
|---|---|---|
| `.js` / `.mjs` | 1 / 79 | 1 / 76 |
| `.ts` | — | 1.442 |
| `.tsx` | — | 442 |
| `.d.ts` / `.d.mts` | — | 2 / 1 |
| **Total** | **80** | **1.964** |

- Removidos: 8 scripts gerados e gitignored em `supabase/.temp/landing-lab/**`
  (motivo registrado por arquivo em `coverage.filesRemoved`).
- Adicionados: 1.892 arquivos, incluindo todos os `.ts`/`.tsx` recém-cobertos
  (`coverage.filesAdded` + `newlyCoveredByExtension`).
- `npm run lint` oficial: 80 → **85 arquivos**, 0 problemas, exit 0 — o delta é
  exatamente os 5 `.mjs` novos desta quick.

## Achados reais (sem correção)

| Regra | Severidade | Ocorrências | Arquivos |
|---|---|---|---|
| `@typescript-eslint/no-unused-vars` | warn | 350 | 198 |
| `react-hooks/exhaustive-deps` | warn | 23 | 7 |
| `react-hooks/rules-of-hooks` | error | 0 | 0 |

- `fatal`: 0 · `configNotices`: 0 · `configErrors`: 0.
- `npm run lint:diagnostic` → **exit 1 real** (373 warnings; `--max-warnings 0`).
- Distribuição por área: `src-tests` 220 · `components` 68 · `lib` 52 · `app` 27 ·
  `hooks` 3 · `tools` 3.
- Artefatos: `inventory/inventory.json` e `inventory/inventory.md`.

### Distinção obrigatória

As **221 declarações não usadas** apontadas anteriormente são observação do
**compilador TypeScript**. Não são resultado do ESLint, não são 221 bugs e não
são a contagem desta quick. O ESLint reporta 350 ocorrências (escopo maior:
inclui testes, ferramentas e tracking).

### Política de diretivas

Inline config desligada na engine (`--no-inline-config` / `allowInlineConfig: false`).
Diretivas existentes **não** foram removidas: 25 inventariadas. As relevantes
para este diagnóstico são **5** de `react-hooks/exhaustive-deps` — elas deixam de
suprimir, e por isso aparecem no total. `reportUnusedDisableDirectives: "off"`
sozinho não bastaria: diretiva para plugin ausente gera “Definition for rule … was
not found” com `fatalErrorCount: 0` (confirmado localmente e coberto por teste).

## Amostra classificada

28 achados em `.planning/quick/261121-k4g-.../261121-k4g-FINDINGS-SAMPLE.md`:

| Classe | Itens |
|---|---|
| (a) limpeza de baixo risco | 10 |
| (b) possível efeito colateral | 6 |
| (c) possível problema funcional | 2 |
| (d) falso positivo / exige contexto | 10 |

Os dois itens (c) estão em `src/components/flow/use-campaign-form.ts` (1502:
revogação de object URL com `imagePreviewUrl` obsoleto; 2172: callback de
submissão sem `consumeStream`/`persistSubmittedDraft`). Exigem investigação
antes de qualquer alteração.

## Dependências produtivas

- Universo comparado: **255** entradas produtivas do lockfile
  (`dev !== true && devOptional !== true`), incluindo **30** peers resolvidos
  (`peer: true`) e 41 opcionais.
- `prod-deps-guard compare` antes/depois: **zero diferenças** de presença,
  `version`, `resolved`, `integrity`, `optional` e `peer`; exit 0.
- `npm ls --omit=dev --depth=0 --json` antes/depois: byte a byte idêntico.
- Lockfile: 43 pacotes **adicionados** (todos dev), 0 removidos, 0 versões
  alteradas (verificado inclusive para entradas dev).
- Teste negativo prova a detecção: transitiva alterada, peer com `integrity`
  alterada, entrada adicionada e entrada removida → exit 1 nos quatro casos.

## Validação (resultados reais)

| Gate | Resultado |
|---|---|
| `npm run lint` | exit 0 · 0 problemas · 85 arquivos |
| `npm run lint:diagnostic` | exit **1** (373 warnings, 0 erros) — real, sem `\|\| true` |
| `npm run lint:diagnostic:inventory` | exit 0 · 1.964 arquivos · 0 fatal · 0 configErrors |
| `npm run test:lint-config` | 11/11 |
| `node --test tests/lint-config/prod-deps-guard.test.mjs` | 6/6 |
| `npm run test:scripts` | 119/119 |
| `npm run test:gates` | exit 0 · `scripts (node:test)` = 11 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 (Next usa `eslint.config.mjs`) |
| `npm test` | **834 arquivos / 10.315 testes PASS**, 2 arquivos e 10 testes skip |
| `prod-deps-guard compare` | exit 0 · árvore idêntica |
| `git diff --check` | limpo |
| Varredura de caminho absoluto/nome de usuário | vazia em baseline, inventário, amostra e docs |

**Nota de honestidade:** uma execução de `npm test` feita **em paralelo** com
`next build` teve 1 falha em `store-identity-form.direction-pending.test.tsx`
(`expected 1 to be greater than 1`, contagem de chamadas sob contenção). O
arquivo não foi tocado nesta quick; a execução isolada passou 16/16 e a suíte
completa reexecutada sozinha passou **834/10.315**, igual à baseline. Nenhuma
correção ou `skip` foi aplicada.

## Limitações

- Sem regras type-aware (`parserOptions.project` não usado).
- Sem presets: volume menor que um preset estrito.
- `next-env.d.ts` gerado é ignorado; `.d.ts` de `src/` são analisados.
- `eslint-plugin-react-hooks@7` traz `@babel/*`/`hermes-parser` como transitivas.
- Mede o código **sem** supressões, não o resultado do lint oficial com elas.
- Diagnóstico **não** é gate: fora de `lint`, `build`, `vercel.json` e CI.

## Próximos lotes propostos (não executados)

1. **L1** — investigar os 2 achados (c) de `use-campaign-form.ts`.
2. **L2** — revisar os 23 `exhaustive-deps`, separando suprimidos com motivo de
   nunca avaliados.
3. **L3** — limpeza mecânica (a) em `app`/`components`/`lib`, um commit por área.
4. **L4** — decisão de convenção `_param`/type-only (config vs renomeação).
5. **L5** — conferir variáveis de prova/mock possivelmente perdidas (b).
6. **L6** — só depois: avaliar promoção do diagnóstico a gate.

## Encerramento

- Quick executada na branch `chore/lint-typescript-diagnostico`, base `c9d68fbe`.
- Commits: `4881302d` (chore/ferramentas), `a9cc0d1f` (testes) e o commit
  documental desta entrega.
- Nenhuma alteração em `src/**`, `supabase/**`, `eslint.config.mjs` ou
  `vercel.json` (verificado por `git diff --name-only c9d68fbe..HEAD`).
- **Sem merge, push, deploy ou ativação. Ponto de Parada B respeitado.**
