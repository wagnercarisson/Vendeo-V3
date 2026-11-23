---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 01
subsystem: campaign-format-addition
tags: [campaign, format-addition, eligibility, presentation, i18n, pure-model]

requires:
  - phase: 61-padronizar-chips-formatos-campanhas
    provides: modelo de apresentação individual e catálogos de detalhe
  - phase: 60.7-entrega-conjunta-formatos-1-1-9-16
    provides: validação de fonte entregue e contratos de artefatos de composição

provides:
  - derivação pura de elegibilidade da adição 9:16 (novo fluxo e legado 1024)
  - entrada opcional de adição no modelo de apresentação individual
  - textos pt-BR/es-419 da adição vertical

affects: [62-03, 62-05, 62-06]

tech-stack:
  added: []
  patterns:
    - modelo puro com união discriminada e resultados congelados
    - falha de leitura separada de incompatibilidade definitiva
    - vínculo durável como autoridade de estado

key-files:
  created:
    - src/lib/campaign/format-addition/types.ts
    - src/lib/campaign/format-addition/eligibility.ts
    - src/lib/campaign/format-addition/index.ts
    - src/lib/campaign/__tests__/format-addition-eligibility.test.ts
  modified:
    - src/lib/campaign/format-presentation.ts
    - src/lib/campaign/__tests__/format-presentation.test.ts
    - src/lib/i18n/campaign-detail/messages.ts
    - src/lib/i18n/campaign-detail/catalogs/pt-BR.ts
    - src/lib/i18n/campaign-detail/catalogs/es-419.ts
    - src/lib/i18n/campaign-detail/__tests__/catalogs.test.ts

key-decisions:
  - "Elegibilidade pura recebe apenas dados já classificados; nunca snapshot, path, URL, credencial ou bytes."
  - "Vínculo durável (delivered/processing/unknown/refunded) tem precedência sobre a fonte; falha de leitura nunca vira incompatibilidade."
  - "Adição é entrada opcional na apresentação: sem adição, o outro formato continua absent/not_requested; flow permanece single_format e partial=false."
  - "Origem não suportada usa o motivo fechado source_origin_invalid, alinhado à razão já existente na autoridade de composição."

patterns-established:
  - "Modelo puro total: nunca lança e devolve objetos congelados."
  - "Leitura indisponível distinta de incompatibilidade comprovada."

requirements-completed: [ADD-ELIG-01, FMT-ADD-12]

duration: ~12 min
completed: 2026-11-23
---

# Phase 62 Plan 01: Fundação pura da adição vertical 9:16

**Derivação pura de elegibilidade 1024/1080 com separação entre indisponibilidade e incompatibilidade, extensão aditiva da apresentação individual e catálogos pt-BR/es-419 completos**

> **Status: EXECUTADO LOCALMENTE/OFFLINE; AGUARDANDO REVISÃO; NÃO ACEITO.**
> O plano parou no Review Stop. `62-02` **não foi iniciado**. Nenhum banco,
> Storage, provider, geração, migration aplicada, flag, merge, push, deploy,
> sync ou archive foi executado.

## Performance

- **Duration:** ~12 min
- **Started:** 2026-11-23T12:40:00Z (aprox.)
- **Completed:** 2026-11-23T12:52:00Z (aprox.)
- **Tasks:** 4/4
- **Files modified:** 10 (4 criados, 6 alterados)

## Baseline de execução

| Item | Valor observado |
|---|---|
| Branch | `feat/campaign-add-vertical` |
| HEAD | `241815fa831ceb6db85fbc8747a9599c83fb66bc` |
| Worktree | somente `.planning/ROADMAP.md`/`STATE.md` modificados e fase/change não rastreadas; **nenhuma alteração de código** |
| `git diff --check` | limpo |
| OpenSpec strict | `1 passed, 0 failed` |

Baseline documental aprovada e versionada em `c76f3b2e` **antes** de alterar `src/`, incluindo os ajustes residuais em `62-REVIEW-RESIDUALS.md`.

## Task Commits

1. **Task 1: Baseline e inventário de contratos** — sem código; evidência em `evidence/62-01-gates.md`.
2. **Task 2: Tipos e derivação pura de elegibilidade** — `fe1a4ba7` (feat).
3. **Task 3: Extensão da apresentação individual** — `786661f6` (feat).
4. **Task 4: Textos pt-BR/es-419 e paridade** — `4074ee77` (feat).

**Plan metadata:** commit documental de aprovação `c76f3b2e`; SUMMARY e tracking em commits próprios.

## Files Created/Modified

### Criados

- `src/lib/campaign/format-addition/types.ts` — estados, motivos fechados, leitura segura da fonte, estado durável e resultado.
- `src/lib/campaign/format-addition/eligibility.ts` — `deriveFormatAdditionEligibility` pura, total e determinística.
- `src/lib/campaign/format-addition/index.ts` — superfície pública do módulo.
- `src/lib/campaign/__tests__/format-addition-eligibility.test.ts` — 27 testes.

### Alterados

- `src/lib/campaign/format-presentation.ts` — campo opcional `addition` e mapeamento da adição sem alterar o contrato histórico.
- `src/lib/campaign/__tests__/format-presentation.test.ts` — 17 testes novos de adição (30 no total do arquivo).
- `src/lib/i18n/campaign-detail/messages.ts` — namespace tipado `formatAddition`.
- `src/lib/i18n/campaign-detail/catalogs/pt-BR.ts` — textos da adição.
- `src/lib/i18n/campaign-detail/catalogs/es-419.ts` — paridade estrutural.
- `src/lib/i18n/campaign-detail/__tests__/catalogs.test.ts` — chaves contratadas, congelamento, proibições (1080/adaptar/converter/emoji).

## Decisões e contrato

- **Elegibilidade:** `new_flow_1_1` e `legacy_campaign` com JPEG 1024×1024, integridade válida, checksum verificado e path canônico ⇒ `eligible` com `credits: 1`.
- **Incompatibilidade comprovada:** dimensão, MIME, bytes/checksum, path, formato persistido não `1:1`, campanha não `ready` e origem não suportada.
- **Indisponibilidade:** fonte ausente, indeterminada, falha de leitura ou conflito de identidade ⇒ `unavailable`; nunca vira motivo definitivo.
- **Autoridade durável:** `delivered`, `processing`, `unknown` e `refunded` têm precedência sobre a fonte; `unknown` fica em `kind: "processing", state: "unknown"`; `refunded` em `absent/refunded: true`.
- **Apresentação:** sem adição, `absent/not_requested` byte-equivalente ao comportamento anterior; com adição, `delivered`/`processing`/`unknown`/`absent` com `reason: "not_delivered"`; `flow=single_format`; `partial=false`; `active` só no formato selecionado e entregue.
- **Defaults preservados:** `addition` é opcional; nenhum consumidor existente foi alterado; os testes históricos de apresentação continuam passando.

## Gates reais

| Gate | Resultado |
|---|---|
| Testes dirigidos | **3 arquivos / 68 testes PASS** (27 + 30 + 11) |
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** (não cobre TS — limitação preexistente) |
| `npm.cmd run build` | exit **0**; **102/102** páginas; shared **102 kB** |
| Suíte global local | **845 arquivos PASS + 2 skipped (847)**; **10.529 testes PASS + 10 skipped (10.539)**; 106,22 s |
| OpenSpec `--changes --strict` | **1 passed, 0 failed** |
| `git diff --check` | limpo |

Gates de PostgreSQL/homolog, Storage, provider e app-env **não executados** por exigirem autorização e ambiente separados.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Motivo fechado `source_origin_invalid`**
- **Found during:** Task 2 (elegibilidade).
- **Issue:** o bloco `<interfaces>` do plano listava apenas seis motivos de incompatibilidade e não representava a origem não suportada exigida pelo cenário “Origem não suportada ou path não canônico” de `ADD-ELIG-01`.
- **Fix:** incluído `source_origin_invalid` na união fechada, reutilizando a razão já existente em `SourceValidationFailureReason`/`ResolveSquareSourceReason`; teste dedicado com `composition_artifact`, string vazia e `legacy`.
- **Files modified:** `src/lib/campaign/format-addition/types.ts`, `eligibility.ts`, teste.
- **Verification:** 27/27 testes de elegibilidade; typecheck exit 0.
- **Committed in:** `fe1a4ba7`.

---

**Total deviations:** 1 auto-fixed (1 missing critical).
**Impact on plan:** extensão mínima e compatível; nenhuma mudança de escopo ou de comportamento dos consumidores existentes.

## Issues Encountered

- **Encoding do ROADMAP:** o arquivo já modificado pela etapa de planejamento apresenta reencodificação/mojibake em trechos não-ASCII (inclusive parte pré-existente no HEAD). O baseline documental foi versionado **como recebido**, sem reparo de encoding não autorizado. Ponto para decisão do responsável; não afeta código.
- Nenhuma falha de teste, typecheck, lint ou build.

## Ajustes residuais registrados

`62-REVIEW-RESIDUALS.md` registra, para correção **antes dos planos correspondentes**:

- **R1 — 62-08:** autorização estruturada (campos obrigatórios, não sentinelas de texto livre).
- **R2 — 62-08:** arquivo único da autorização paga, alinhando `<files>` e `<verify>`.
- **R3 — 62-07/62-08:** ordem explícita migration → código no release.
- **R4 — 62-03:** nomear a extensão de `ArtifactOrigin` (L-A).
- **R5 — 62-07:** verify do checkpoint humano com falha não-zero (L-E).
- **R6 — 62-07/62-08:** notas de decomposição (L-D).
- **R7 — 62-05:** incluir o teste do chip na task que altera o componente (INFO-2).

## User Setup Required

None — nenhum serviço externo, migration ou configuração de ambiente foi necessária.

## Next Phase Readiness

- Fundação pura pronta para `62-02` (persistência/RPCs/flag), **não iniciado**.
- **Review Stop do `62-01`:** aguardando revisão/aprovação explícita.
- `62-02`+ permanecem não autorizados. Nenhum merge, push, deploy, sync ou archive.

## Self-Check: PASSED

- [x] Todos os arquivos criados existem em disco.
- [x] Commits de código existem (`fe1a4ba7`, `786661f6`, `4074ee77`).
- [x] Critérios de sucesso do plano revalidados.
- [x] `<verification>` do plano executado com resultados reais.
- [x] Nenhum banco, Storage, provider, migration aplicada, flag, merge, push, deploy, sync ou archive.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Completed: 2026-11-23 (execução local; aceite pendente)*
