# F60 / 60-04 — Gates obrigatórios

**Status:** **CONCLUÍDO, VERIFICADO, SINCRONIZADO E ARQUIVADO.** `/gsd-verify-work` PASS_WITH_FINDINGS (11/11), `/opsx-verify` PASS (55/55), `/opsx-sync` aplicado (2 specs atualizadas + 3 criadas) e `/opsx-archive` concluído. Exceção explícita: as quatro falhas globais conhecidas seguem em acompanhamento separado.
**Executado em:** 2026-11-09 (UTC), pelo agente OpenCode.
**Escopo:** gates offline, revisão estática e relatórios do 60-04. **Nenhuma conexão Postgres.**
**Ambiente:** worktree local; sem deploy/push/merge/flag/IA.

## Evidência Postgres REUTILIZADA

| Prova | Resultado | Referência |
|---|---|---|
| 60-01 — prova transacional | **13/13 PASS; APPROVED** | `60-01-PROOF-MATRIX.md`, `60-01-PROOF-DECISION.md` |
| 60-02 — Postgres | **8/8 PASS; aceito** | `60-02-SUMMARY.md` |
| 60-03 — RUN 2 (perfil `f60`) | **26/26 PASS, exit 0; aceito** | `60-03-POSTGRES-RUN-2.md` |

`TEST_DATABASE_URL` **não** autorizou nenhuma conexão nesta execução. Nenhum SQL foi executado.

## Gates executados

| # | Gate | Comando | Resultado literal | Veredito |
|---|---|---|---|---|
| 1 | Testes offline focados 60-03 | `npx vitest run src/lib/product-9-16-two-stage/__tests__ --config vitest.config.ts` | `Test Files 4 passed (4); Tests 42 passed (42)`; exit 0 | **PASS** |
| 2 | Janela/preflight F60 | `node --test scripts/f60/__tests__/f60-window.test.mjs` | `tests 10; pass 10; fail 0`; exit 0 | **PASS** |
| 3 | Inventário da suíte | `node scripts/testing/test-status.mjs` | inventário válido; exit 0 | **PASS** |
| 4 | Suíte local global | `npm test` | histórico pré-quick: `Test Files 3 failed | 660 passed | 2 skipped (665)`; `Tests 5 failed | 8281 passed | 10 skipped (8296)`; exit 1. Pós-quick: `Tests 4 failed | 8282 passed | 10 skipped (8296)` | **KNOWN_FAIL** — 4 falhas conhecidas |
| 5 | Typecheck | `npx tsc -p tsconfig.typecheck.json --noEmit` | exit 0, sem saída de erro | **PASS** |
| 6 | Lint | `npm run lint` | exit 0, sem saída de erro | **PASS** |
| 7 | Build | `npm run build` | exit 0; build Next concluído | **PASS** |
| 8 | Diff check | `git diff --check` | exit 0; apenas avisos de LF/CRLF do Git | **PASS** |
| 9 | OpenSpec strict | `npx openspec validate --strict product-9-16-two-stage-operation-control` | `Change 'product-9-16-two-stage-operation-control' is valid`; exit 0 | **PASS** |
| 10 | Unicidade de migrations | inspeção de arquivos + `git ls-tree` das branches locais | worktree: 155 arquivos, 155 prefixos únicos; branches `main` (154), `feat/fase-59-1` (154), `feature/fase-44` (77), `backup/...` (145): 0 prefixos duplicados; `20261109174110` só no worktree | **PASS** |
| 11 | Postgres | reutilização da RUN 2 | **não executado**; evidência aceita 26/26 | **REUSED** |

## Histórico da divergência da suíte global (pré-quick)

A execução original encontrou **5 falhas em 3 arquivos**, não apenas as quatro conhecidas:

| Arquivo | Falhas | Classificação |
|---|---|---|
| `src/components/landing/__tests__/landing-page.test.tsx` | 1 | **KNOWN_FAIL** — “Found multiple elements with role navigation” |
| `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` | 3 | **KNOWN_FAIL** — caminhos/conteúdos de fronteira e reconciliação |
| `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx` | **1** | **NOVO / NÃO REPRODUZIDO ISOLADAMENTE — causa em investigação** |

Detalhe da nova falha:
- teste: `StoreIdentityForm — direção visual pendente (261025-svt) > realinhamento bem-sucedido limpa o banner e reexecuta readiness`;
- erro: `AssertionError: expected 1 to be greater than 1` em `store-identity-form.direction-pending.test.tsx:453`;
- reprodução isolada: `npx vitest run src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx --config vitest.config.ts` → **16/16 PASS**, exit 0.

Classificação histórica: **falha nova, não reproduzida isoladamente; causa em investigação**. A hipótese de corrida foi confirmada e corrigida na quick separada. O histórico das cinco falhas é preservado acima e em `evidence/f60-20261109-04/global-suite.log`; o veredito ATUAL é `KNOWN_FAIL` pelas quatro ocorrências conhecidas.

### Investigação da sincronização (escopo separado, sem alteração de código)

No teste, após aguardar o banner desaparecer, a contagem de chamadas de readiness é verificada imediatamente (`store-identity-form.direction-pending.test.tsx:446`). O componente agenda a atualização de readiness em um efeito separado, o que é compatível com uma corrida de sincronização no teste.

Correção candidata (a ser tratada em **quick separada**, sem sleeps e sem enfraquecer a asserção): aguardar também o **aumento da contagem** de chamadas de readiness antes de verificar. Nenhum arquivo de teste ou módulo foi alterado nesta execução do 60-04.

### Atualização pós-quick `261109-f60-readiness-sync`

A hipótese de corrida foi tratada em quick separada, somente no teste:

- `waitFor` passou a aguardar banner ausente **e** aumento de `readinessCalls()`; asserção original preservada; sem sleeps.
- Teste focado: **16/16 PASS**, exit 0.
- Suíte global após a quick: **8282 PASS / 4 FAIL / 10 skipped**, exit 1.
- As 4 falhas são exatamente as conhecidas (`landing-page`: 1; `legacy-frontier`: 3). A falha nova de `store-identity-form` **não se reproduziu**.
- O resultado anterior (5 falhas) permanece preservado neste relatório e em `evidence/f60-20261109-04/global-suite.log`.
- Evidências da quick: `.planning/quick/261109-f60-readiness-sync/`.

**Aceite técnico do 60-04 registrado.** A suíte global permanece `KNOWN_FAIL` pelas quatro falhas conhecidas, em acompanhamento separado. Verificações e fechamento documental concluídos; change arquivada em `openspec/changes/archive/2026-11-09-product-9-16-two-stage-operation-control/`.

## Logs dos gates

Diretório: `.planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence/f60-20261109-04/`

| Log | Conteúdo |
|---|---|
| `typecheck.log` | comando e resultado exit 0 |
| `lint.log` | saída do ESLint, exit 0 |
| `build.log` | build Next completo, exit 0 |
| `global-suite.log` | suíte global histórica pré-quick, 8281 PASS / 5 FAIL (a divergência nova foi corrigida na quick) |
| `focused-offline.log` | 42/42 PASS |
| `f60-window.log` | 10/10 PASS |
| `test-status.log` | inventário válido |
| `openspec-strict.log` | OpenSpec válido |
| `diff-check.log` | `git diff --check` limpo |
| `migration-uniqueness.txt` | unicidade estática de migrations |

## Diagnóstico das quatro falhas conhecidas

| Arquivo | Diagnóstico | Acompanhamento | Disposição |
|---|---|---|---|
| `landing-page.test.tsx` (1) | Consulta ambígua de `getByRole("navigation")` no rodapé; falha pré-existente, fora do escopo F60 | Registrada em `60-02-SUMMARY.md`/`60-03-SUMMARY.md` | Corrigir em escopo separado; aceita como dívida rastreada |
| `legacy-frontier.guard.test.ts` (3) | Divergências de caminhos/conteúdos de fronteira pré-existentes da árvore de trabalho; não introduzidas pelo 60-04 | Registrada em `60-02-SUMMARY.md`/`60-03-SUMMARY.md` | Corrigir/reconciliar em escopo separado; não mascarar |

## Veredito dos gates

- Gates 1, 2, 3, 5, 6, 7, 8, 9 e 10: **PASS**.
- Gate 4: **KNOWN_FAIL** — exatamente as quatro falhas globais conhecidas, em acompanhamento separado.
- Gate 11: **REUSED** (RUN 2), sem nova conexão.

**O 60-04 está concluído, verificado, sincronizado e arquivado.** Não autoriza merge, push, deploy ou ativação; as quatro falhas globais conhecidas permanecem em acompanhamento separado.

## Limitações

- Nenhuma conexão Postgres, nenhum SQL, nenhuma migration aplicada/renomeada.
- Nenhum código foi alterado para fazer gates passarem; a única alteração foi a quick test-only aprovada.
- As quatro falhas globais conhecidas permanecem em acompanhamento separado.
