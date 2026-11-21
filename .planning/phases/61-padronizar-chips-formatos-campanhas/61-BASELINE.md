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
