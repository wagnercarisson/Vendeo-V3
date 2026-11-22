# Phase 61 — Baseline antes das alterações

**Capturada em:** 2026-11-21
**Fonte técnica:** `openspec/changes/padronizar-chips-formatos-campanhas/`
**Escopo:** apresentação dos chips de formato (modelo, catálogo, componente, lista/dashboard/detalhe).
**Fora de escopo:** expansão, entrega quadrada adicional, efeitos financeiros, geração, migration, banco/Storage/provider, deploy, merge, push, sync, archive.

## Repositório

- Branch: `feat/campaign-format-chips`
- HEAD: `c971d631a190d426be21341f4616f6e4c7cb5135`
- Worktree baseline autorizada: `openspec/changes/padronizar-chips-formatos-campanhas/` e `.planning/phases/61-padronizar-chips-formatos-campanhas/` não rastreados; `.planning/STATE.md` e `.planning/ROADMAP.md` modificados pelo planejamento. Essas alterações documentais são esperadas e NÃO devem ser revertidas/limpas.
- Nenhum código de aplicação alterado nesta captura

## Baseline documental

- `openspec validate padronizar-chips-formatos-campanhas --strict`: válido
- `openspec status --change padronizar-chips-formatos-campanhas`: 4/4 artefatos completos
- Change aprovada para planejamento GSD pelo responsável

## Baseline técnico a executar antes da primeira alteração

Registrar os resultados reais, sem mascarar falhas preexistentes:

1. `npm.cmd run typecheck` (ou script equivalente do projeto)
2. `npm.cmd run lint`
3. Suítes dirigidas atuais de listagem, dashboard, detalhe, i18n e produto-dois-formatos
4. Suíte global atual, com baseline de falhas preexistentes
5. `npm.cmd run build`
6. `git diff --check`
7. Contagem de consultas/assinaturas de miniaturas da mesma página **antes** dos chips, para comparar depois
8. Contagem de chamadas do detalhe por fixture fixa (conjunta, novo fluxo individual e legado): `resolveTwoFormatControlOperation`, `readTwoFormatDelivery`, `readTwoFormatDurableOutcomes`, `ProductOneToOneAttemptStartClient`, `generateSignedPreviewUrl`, `readCopyDelivery`, `readCopyCancellation`, `readCopyRecoverySummary`, sondas de arte (quando aplicável) e `createSignedUrl`

## Regra de comparação

- O baseline deve ser capturado no mesmo HEAD e antes de qualquer commit de implementação.
- A prova de desempenho compara a **mesma página/fixture e o mesmo conjunto de campanhas** antes/depois; não exige contagem absoluta constante entre 1 e N.
- A assinatura de miniaturas legadas pode variar com a quantidade de campanhas e permanece como está.
- Os chips devem causar **zero chamadas adicionais** de banco, Storage, RPC, recuperação ou provider.
- A prova do detalhe é separada da lista/dashboard: mesmas contagens de RPC/leitura/assinatura antes/depois, com polling/recuperação existentes intactos.
- Falhas globais preexistentes devem ser listadas separadamente das falhas introduzidas pela change.

---

# Baseline técnico MEDIDO (Task 1 do 61-01)

**Capturado em:** 2026-11-21, ANTES de qualquer edição em `src/`.
**Branch:** `feat/campaign-format-chips`
**HEAD:** `c971d631a190d426be21341f4616f6e4c7cb5135`

## Worktree real (autorizada)

`git status --porcelain`:

```text
 M .planning/ROADMAP.md
 M .planning/STATE.md
?? .planning/phases/61-padronizar-chips-formatos-campanhas/
?? openspec/changes/padronizar-chips-formatos-campanhas/
```

Essas alterações documentais são a baseline autorizada (planejamento). Não foram revertidas/limpas.

`git diff --check` antes da edição: **exit 2**, com UMA ocorrência preexistente de trailing whitespace:

```text
.planning/ROADMAP.md:996: trailing whitespace.
+**Directory:** `.planning/phases/61-padronizar-chips-formatos-campanhas/`.
```

A ocorrência está em artefato de planejamento (`.planning/ROADMAP.md`), não em código, e foi registrada como **preexistente** (fora do escopo do 61-01).

## Gates executados (exit codes reais)

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | **exit 0** — sem erros |
| Lint | `npm.cmd run lint` | **exit 0** — sem erros/avisos |
| Suítes dirigidas | `npx vitest run <9 arquivos + 3 diretórios i18n>` | **exit 0** — 15 arquivos, 105 testes passaram |
| Suíte global | `npm.cmd run test` | **exit 0** — 835 arquivos passaram, 2 skipped (837); 10324 testes passaram, 10 skipped (10334) |
| Build | `npm.cmd run build` | **exit 0** — `check:cnae OK`, 102 páginas estáticas geradas |
| Diff-check | `git diff --check` | **exit 2** — apenas o trailing whitespace preexistente acima |

Logs brutos em `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/`:
`baseline-typecheck.log`, `baseline-lint.log`, `baseline-directed.log`, `baseline-global-suite.log`, `baseline-build.log`, `baseline-capture.log`, `baseline-read.log`.

**Falhas preexistentes:** nenhuma falha de teste/typecheck/lint/build. Avisos não fatais do build: plugin ESLint do Next não detectado e `metadataBase` sem origem de produção (comportamento já existente). Gates de integração (Postgres/homolog/local/app-env/Product 1:1/F60/F60.1) permanecem **NÃO EXECUTADOS** por falta de ambiente; não foram acessados banco/Storage/homolog/produção.

## Contagens MEDIDAS (baseline-calls.test.ts / baseline-calls.json)

Fixtures/mocks fixos; nenhum I/O real. Modos executados e provados:

1. `BASELINE_CAPTURE=1 npx vitest run .../baseline-calls.test.ts` → **exit 0** (grava JSON).
2. `npx vitest run .../baseline-calls.test.ts` (modo leitura) → **exit 0** (`toEqual` contra o JSON imutável).

### Lista (`listCampaigns`)

| Cenário | `from` | `readTwoFormatListSummaries` | `createSignedUrl` | `createSignedUrls` |
|---|---:|---:|---:|---:|
| `list.joint` (2 conjuntas, miniatura preferida) | 1 | 1 | 0 | 1 |
| `list.legacy_only` (2 legadas com path assinável) | 1 | 1 | 2 | 0 |
| `list.no_signable_thumbnail` (paths inelegíveis) | 1 | 1 | 0 | 0 |
| `list.batch_1` (1 conjunta) | 1 | 1 | 0 | 1 |
| `list.batch_3` (3 conjuntas) | 1 | 1 | 0 | 1 |

Prova de lote: 1 vs 3 conjuntas mantém **1** chamada de `createSignedUrls`.

### Dashboard (`queryEligibleCampaigns`)

| Cenário | `from` | `readTwoFormatListSummaries` | `generateBatchPreferredThumbnailUrls` | `generateBatchThumbnailUrls` |
|---|---:|---:|---:|---:|
| `dashboard.joint` | 1 | 1 | 1 | 1 |
| `dashboard.legacy_only` | 1 | 1 | 1 | 1 |
| `dashboard.no_signable_thumbnail` | 1 | 1 | 1 | 1 |

### Detalhe (página real, fixtures fixas)

| Cenário | `resolveTwoFormatControlOperation` | `readTwoFormatDelivery` | `readTwoFormatDurableOutcomes` | `ProductOneToOneAttemptStartClient` | `generateSignedPreviewUrl` | `readCopyDelivery` | `readCopyCancellation` | `readCopyRecoverySummary` | probes de arte | `createSignedUrl` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `detail.joint` | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| `detail.new_flow` (individual 1:1 entregue) | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| `detail.legacy` (ready com path assinável) | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 1 |

**Regra de comparação futura:** mesmos cenários, mesma fixture → contagens idênticas antes/depois; os chips devem causar **zero** chamadas adicionais. A assinatura de miniaturas legadas permanece como está.

## Limites

- Execução local apenas; nenhum acesso a banco, Storage, homolog, produção, provider ou chamada paga.
- Nenhum arquivo de `src/` foi criado/alterado/modificado nesta Task.

---

# VALIDACAO FINAL F61

**Capturada em:** 2026-11-21 (execução do plano `61-03`)
**Branch:** `feat/campaign-format-chips`
**HEAD da implementação:** `aed5db7e` (Task 1+2 combinadas; ver desvio no SUMMARY do 61-03)
**Escopo:** detalhe `/campanhas/[id]` com os chips compartilhados no nível da página.

## Gates reais (exit codes / contagens)

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| Baseline em leitura (antes de editar) | `npx vitest run .planning/.../evidence/baseline-calls.test.ts` | **0** | `toEqual` contra o JSON imutável |
| Typecheck | `npm.cmd run typecheck` | **0** | Sem erros |
| Lint | `npm.cmd run lint` | **0** | Sem erros/avisos |
| Task 1 (página + matriz) | `npx vitest run .../format-presentation.test.tsx campaign-detail-joint.test.tsx` | **0** | 2 arquivos / **43 testes** (36 novos na matriz) |
| Task 2 (cliente + fixtures) | `npx vitest run <9 arquivos dirigidos>` | **0** | 9 arquivos / **142 testes** |
| Suítes dirigidas do plano | `npx vitest run <modelo, i18n, componente, lista, dashboard, detalhe, baseline>` | **0** | **63 arquivos / 637 testes PASS** |
| Baseline em leitura (depois) | `npx vitest run .../evidence/baseline-calls.test.ts` | **0** | `toEqual`; JSON inalterado |
| suíte global | `npm.cmd run test` | **0** | **843 arquivos PASS**, 2 skipped (845); **10467 testes PASS**, 10 skipped (10477) |
| Build | `npm.cmd run build` | **0** | `check:cnae OK`; 102 páginas estáticas |
| `git diff --check` | `git diff --check` | **0** | Limpo |
| `git status --porcelain` | — | — | Apenas logs `61-03-*.log` untracked antes do commit documental |

**Falhas preexistentes:** nenhuma no baseline do 61-01 (typecheck/lint/build/global verdes).
**Falhas introduzidas:** nenhuma no estado final. Durante a primeira execução global **antes** do commit, o contrato F60.4 (`square-base/boundaries.contract.test.ts`) falhou listando 3 arquivos de teste sob `src/app/.../__tests__/` no working tree — é um guard de árvore limpa, não regressão de comportamento. Reexecutado após o commit: **7/7 PASS**; a suíte global pós-commit passou integralmente.

## Prova de ZERO chamadas adicionais (detalhe)

`format-presentation.test.tsx` reexecuta a página real com fixtures fixas e afirma as contagens **idênticas** ao baseline do 61-01:

| Fixture | control | delivery | durable | attemptStart | signedPreview | copyDelivery | copyCancel | copyRecovery | probes | createSignedUrl |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `detail.joint` | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| `detail.new_flow` | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| `detail.legacy` | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 1 |

A baseline de lista/dashboard (`baseline-calls.test.ts`) continuou passando em leitura: **zero drift**.

## Matriz de regressão documentada (detalhe, outras superfícies cobertas pelos testes dirigidos)

| Caso | Detalhe |
|---|---|
| Legado quadrado | `1:1` delivered; `9:16` absent/not_requested; ativo com arte |
| Individual 1:1 (novo fluxo) | delivered/running/refunded/unknown conforme operação; ativo só com arte |
| Vertical F59 / por expansão | `9:16` conforme ciclo; `1:1` not_requested; sem seleção inventada |
| Conjunta completa | dois delivered; ativo pelo `?format=` e só com `previewUrl`; hrefs nos dois |
| Conjunta parcial | `absent` + `refunded` (crédito devolvido), `partial=true`, sem href no ausente |
| `delivered` sem preview | entregue porém sem ativo |
| `?format=` inválido/vazio/duplicado/não entregue | falha fechado; sem preview/download; sem ativo |
| Aprovação `pending` com candidata | delivered sem ativo; gate existente preservado |
| `regenerating` | processing sem ativo; sem download novo |
| `error` / `stale` | `unknown`; nunca ausência nem “Não gerado” |
| Snapshot nulo | resolver `malformed_format` ⇒ ambos unavailable |
| Snapshot não-objeto/array | fluxo indeterminado ⇒ ambos unknown |
| Snapshot objeto malformado/incoerente | ambos unavailable; sem fallback 1:1 |
| Resolução `unavailable` | vence aprovação/regeneração ⇒ ambos unavailable |

## Acessibilidade, localização e responsividade

Coberto por testes: chips sempre em `<ul aria-label>` único por página; botão de informação com `aria-expanded`/`aria-controls`, alvo `min-h-11 min-w-11` (44 px), foco visível `focus-visible:ring-2`; estados distinguidos por texto + ícone (nunca só cor); hover/foco/clique (toggle) e explicação `role="note"`; ausência de “Não gerado” e de `+`; `flex min-w-0 flex-wrap` (sem overflow estrutural); `pt-BR`/`es-419` pelos catálogos compartilhados; região dos chips com `lang="es-419"` mesmo quando o restante do estado permanece em português; conteúdo persistido segue `lang=""`.

**Confirmação visual final é HUMANA** e continua pendente antes do fechamento.

## Limites explícitos

- Execução local/offline apenas; nenhum acesso a banco, Storage, homolog, produção, provider ou chamada paga.
- Gates de integração (Postgres/homolog/local/app-env/Product 1:1/F60/F60.1) permanecem **NÃO EXECUTADOS** por ausência de ambiente.
- Nenhuma migration/RPC/flag/pricing/provider/copy/miniatura/aprovação/recuperação foi criada ou alterada.
- Nenhum merge, push, deploy, sync ou archive executado.
- `61-03` **NÃO ACEITO**: aguardando revisão no Review Stop; a fase 61 não está concluída.
