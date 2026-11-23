---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 02
subsystem: campaign-format-addition
tags: [migration, rls, rpc, credit-operation, feature-flag, persistence, local-only]

requires:
  - phase: 62-adicionar-vertical-campanha-quadrada
    provides: contratos puros de elegibilidade/apresentação do 62-01
  - phase: 60.7-entrega-conjunta-formatos-1-1-9-16
    provides: controle 9:16 em duas etapas e fence de publicação
  - phase: 60.1-artefatos-de-composicao
    provides: campaign_composition_artifacts e ponte square_original

provides:
  - migration forward-only da tabela campaign_format_additions (NÃO aplicada)
  - RPCs de abertura/replay, entrega e estorno restritas à adição
  - filtro da operação primária que exclui adições
  - flag dedicada campaign_format_addition_enabled (default false) no painel existente

affects: [62-03, 62-04, 62-05, 62-08]

tech-stack:
  added: []
  patterns:
    - migration autorada local-only com REVERT e descoberta por sufixo
    - RPCs SECURITY DEFINER com search_path vazio e service_role somente
    - locks em ordem campanha → vínculo → crédito → artefato
    - identidade financeira própria da adição, sem reabrir a operação primária

key-files:
  created:
    - supabase/migrations/20261123130252_campaign_format_addition.sql
    - src/lib/campaign/format-addition/__tests__/migration.contract.test.ts
    - src/lib/campaign/format-addition/__tests__/rpc-contracts.test.ts
    - src/lib/campaign/format-addition/__tests__/primary-operation-filter.contract.test.ts
  modified:
    - src/lib/feature-flags/feature-flag-service.ts
    - src/lib/feature-flags/__tests__/feature-flag-service.test.ts
    - src/app/(app)/admin/feature-flags/page.tsx
    - src/app/(app)/admin/feature-flags/__tests__/page.test.tsx

key-decisions:
  - "A migration é forward-only, autorada com timestamp UTC real e NÃO aplicada; nenhum banco foi acessado."
  - "A abertura chama product_9_16_open_operation_v2 e reserva 1 crédito na mesma transação; a base é marcada done por reuso da ponte."
  - "A entrega reconcilia crédito já delivered antes de revalidar o arte vertical; nunca projeta a campanha nem altera campaigns.storage_path."
  - "O estorno usa somente product_1_1_close_failed_operation e exige arte ausente, epoch, outcome failed e ausência de claim ativo."
  - "A leitura histórica da operação primária exclui operações presentes em campaign_format_additions."
  - "A flag dedicada é fail-closed, entra no serviço/painel existente e não desliga 1:1, 9:16 individual, conjunto, consulta ou download."

patterns-established:
  - "Descoberta da migration por sufixo, sem depender de inventário manual."
  - "Guarda de imutabilidade da identidade do vínculo e dos estados terminais."

requirements-completed: [ADD-OP-02, ADD-LINK-03, ADD-GATE-09, CREDIT-ADD-18, CTRL916-ADD-20, FLAG-ADD-21]

duration: ~38 min
completed: 2026-11-23
---

# Phase 62 Plan 02: Persistência durável, RPCs e flag dedicada

**Migration autorada e não aplicada para vínculo/1 crédito/entrega/estorno da adição 9:16, com filtro da operação primária e flag dedicada fail-closed no painel existente**

> **Status: ACEITO TECNICAMENTE EM 2026-11-23 — LOCAL/OFFLINE.**
> **Histórico:** executado localmente/offline, recebeu correções dirigidas
> (fonte corrente/proveniência, caminho canônico na entrega e REVERT não
> destrutivo) e foi aprovado na revisão seguinte, sem bloqueadores.
> **A migration permanece autorada e NÃO aplicada em nenhum banco, inclusive
> local.** Nenhum Storage, provider, geração, alteração de flag em ambiente,
> merge, push, deploy, sync ou archive.

## Performance

- **Duration:** ~38 min
- **Started:** 2026-11-23T12:40:00Z (aprox.)
- **Completed:** 2026-11-23T13:20:00Z (aprox.)
- **Tasks:** 4/4
- **Files modified:** 8 (1 migration + 3 suítes + 4 arquivos de flag/painel)

## Baseline e timestamp

| Item | Valor |
|---|---|
| Branch | `feat/campaign-add-vertical` |
| HEAD da base | `e5bc0053` (aceite documental do `62-01`) |
| Worktree inicial | limpo |
| Migration | `20261123130252_campaign_format_addition.sql` |
| Unicidade | sem colisão na worktree, `main`, `origin/main`, `feature/fase-44...` e `origin/feature/fase-44...` |
| OpenSpec strict | `1 passed, 0 failed` |

## Task Commits

1. **Tasks 1–3: migration, constraints, RPCs e suítes estáticas** — `958bbe6a` (feat).
2. **Task 4: flag dedicada no serviço/painel existente** — `3944c77a` (feat).
3. **Correção dirigida: entrega idempotente** — `202b22f4` (fix).
4. **Correção dirigida da revisão: fonte corrente e caminho canônico** — `213e9df6` (fix).
5. **Reconciliação documental: seleção configurada em campanha legada** — `2a882476` (docs).

> **Desvio de processo:** a migration é um único arquivo e concentra tabela,
> constraints, RPCs e filtro; por isso Tasks 1–3 foram commitadas juntas. Os
> testes de contrato foram incluídos no mesmo commit. A separação em commits
> artificiais por hunk criaria estados intermediários sem typecheck/teste
> coerentes. Não houve alteração de escopo.

## Files Created/Modified

### Criados

- `supabase/migrations/20261123130252_campaign_format_addition.sql` — tabela, constraints/FKs/índices, guarda, RLS/grants, ponte `delivered_campaign_reuse`, três RPCs, filtro primário e seed da flag. **Não aplicada.**
- `src/lib/campaign/format-addition/__tests__/migration.contract.test.ts` — 18 testes estáticos de schema/grants/limites.
- `src/lib/campaign/format-addition/__tests__/rpc-contracts.test.ts` — 24 testes estáticos de assinatura, locks, origens, envelope e escopo.
- `src/lib/campaign/format-addition/__tests__/primary-operation-filter.contract.test.ts` — 5 testes do filtro da operação primária.

### Alterados

- `src/lib/feature-flags/feature-flag-service.ts` — chave `campaign_format_addition_enabled`, `readFlag(..., false)`, `ALL_FEATURE_FLAG_KEYS` e wrapper exportado.
- `src/lib/feature-flags/__tests__/feature-flag-service.test.ts` — chave canônica, true/false, ausente/erro/inválido e ausência de env override.
- `src/app/(app)/admin/feature-flags/page.tsx` — label humanizado da flag no painel existente.
- `src/app/(app)/admin/feature-flags/__tests__/page.test.tsx` — a sexta flag renderizada/avisada.

## Contrato implementado

- **Tabela `campaign_format_additions`:** identidade `(campaign_id, operation_id)`, `request_id` único por campanha, origem fechada, `source_operation_id` só no fluxo novo, ponte/checksum/artefato, formatos `1:1 → 9:16`, status `open|delivered|refunded`, seleção e economia congeladas, FKs compostas.
- **Unicidade ativa:** índice parcial único `(campaign_id, target_format)` para `open|delivered`; refundadas permanecem como histórico.
- **Guarda:** identidade/seleção/economia imutáveis; terminal não regride.
- **Ponte:** `ck_cca_origin` aceita `delivered_campaign_reuse`; novo CHECK restringe a origem a `square_original`.
- **Abertura:** trava campanha, valida campanha `ready` e formato `1:1`, ponte 1024 JPEG/checksum/identidade, operação primária entregue no fluxo novo (legado sem operação original), replay por `request_id`, adição ativa, chama `product_9_16_open_operation_v2`, marca `base` como `done` por reuso e insere o vínculo na mesma transação.
- **Entrega:** trava campanha/vínculo/crédito, reconcilia crédito já `delivered`, valida vertical 1080×1920 JPEG, exige token de publicação e chama mark+deliver existentes; não projeta campanha nem altera `campaigns.storage_path`.
- **Estorno:** recusa entregue, exige epoch, arte ausente, outcome `failed` e ausência de claim ativo; usa somente `product_1_1_close_failed_operation` e marca `refunded`.
- **Filtro primário:** `product_1_1_get_campaign_operation_by_campaign` ignora operações de adição e preserva o envelope histórico.
- **Flag:** default `false`, fail-closed, no serviço/painel existente, sem novo painel/RPC/pricing.

## Correções dirigidas da revisão (2026-11-23)

1. **Abertura comprova a fonte corrente.** Sob a trava da campanha, a RPC lê `campaigns.storage_path` e compara a procedência gravada na ponte (`sourceOrigin`, `sourceStoragePath`, `sourceChecksumSha256`, dimensão/MIME) com essa fonte. No fluxo novo, exige path canônico `{store}/{campaign}/product-1-1/{source_operation}/art-1024.jpg` — a operação informada precisa sustentar o arte atual. No legado, exige path histórico `{store}/{campaign}.jpg` ou `v2/v3.jpg`. Motivos fechados: `source_path_missing`, `source_operation_artifact_mismatch`, `source_path_mismatch`, `source_provenance_mismatch`. Replay/adição ativa continuam retornando antes dessa validação.
2. **Entrega valida caminho/bucket/procedência.** O vertical precisa de `campaign-internal-artifacts`, path `{store}/{campaign}/{operation}/vertical.jpg`, `origin = ai_expansion`, 1080×1920 JPEG; precisa derivar do `square_prepared` da mesma operação (path canônico, `deterministic_preparation`, 1152×1152) e ter proveniência `composition_artifact` com `derivedFromArtifactId`/path/checksum do prepared. Falhas retornam `vertical_artifact_invalid`/`vertical_provenance_invalid` **antes** de mark/deliver, sem consumir crédito. A reconciliação de crédito já `delivered` continua antes da revalidação.
3. **REVERT não é destrutivo.** O bloco agora separa **rollback operacional** (flag off; bloquear somente novas adições; preservar vínculos, créditos, operações, artefatos e auditoria) de **reversão estrutural** (procedimento separado, com pré-condições e sem `DROP TABLE` nesta migration). Não há remoção de histórico nem restauração prematura do CHECK antigo.

**Seleção em campanha legada (reconciliado):** `legacy_campaign` é origem da fonte/campanha, não da seleção. A abertura nova usa `selectionOrigin = "configured"` com versão válida; `legacy`/`legacy_sunburst_low` não é aceito e o CHECK do F60.6 não foi ampliado. Contrato atualizado em `62-CONTEXT.md`, `design.md` e na delta spec; teste estático adicionado. R8 registrado em `62-REVIEW-RESIDUALS.md`.

## Gates reais — evidência do executor

| Gate | Resultado |
|---|---|
| Contratos (migration/RPC/filtro) | **3 arquivos / 52 testes PASS** (18 + 29 + 5) |
| Flag + painel | **2 arquivos / 37 testes PASS** |
| Cinco arquivos da revisão | **5 arquivos / 89 testes PASS** |
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** (não cobre TS — limitação preexistente) |
| `npm.cmd run build` | exit **0**; **102/102** páginas; shared **102 kB** |
| Suíte global local | exit **0**; **848 arquivos PASS + 2 skipped (850)**; **10.585 testes PASS + 10 skipped (10.595)** |
| OpenSpec `--changes --strict` | **1 passed, 0 failed** |
| `git diff --check` | limpo |

Gates de PostgreSQL, Storage, provider e app-env **não executados** por exigirem autorização/ambiente. A migration **não foi aplicada**.

### Aceite e reexecução do revisor (2026-11-23)

- **Veredito:** `62-02` **aprovado tecnicamente, local/offline**, sem bloqueadores.
- **Reexecução do revisor:** **5 arquivos / 89 testes PASS**, OpenSpec strict **1/0** e diff-check do range **limpo**.
- **Separação de evidências:** a tabela acima permanece como **evidência do executor** (typecheck, lint, build, suíte global, OpenSpec e diff-check executados no HEAD de código). A reexecução do revisor é atribuída separadamente e não substitui os números originais.
- **Migration:** autorada e **NÃO aplicada**; nenhum banco, Storage, provider, flag em ambiente, merge, push, deploy, sync ou archive.
- **Escopo do aceite:** somente `62-02`. `62-03` depende de reconciliação do plano (R4/R8/motivos fechados) antes da execução; `62-04`+ permanecem não autorizados.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reconciliação de entrega antes da revalidação do arte**
- **Found during:** revisão da Task 3.
- **Issue:** a entrega validava o arte vertical antes de reconciliar um crédito já `delivered`; um replay idempotente poderia falhar por arte ausente em vez de retornar o estado terminal.
- **Fix:** o crédito é travado e reconciliado antes da validação do arte; o token só é exigido quando há efeito novo.
- **Files modified:** migration.
- **Verification:** 24/24 testes de RPC; locks permanecem na ordem campanha → vínculo → crédito → artefato.
- **Committed in:** `202b22f4`.

---

**Total deviations:** 1 auto-fixed (1 bug) + 1 desvio de processo (commits 1–3 agrupados).
**Impact on plan:** sem expansão de escopo; a correção reforça a idempotência exigida pelo plano.

## Issues Encountered

- **Primeira suíte global:** 3 falhas em 2 suítes de fronteira porque a migration e o painel autorizados estavam **não commitados** (`git status`). Nenhum guard foi enfraquecido; após os commits obrigatórios, as 2 suítes passaram (13/13) e a suíte global passou integralmente.
- **Seleção `legacy` reconciliada (não é origem da campanha):** o controle F60.6 exige `expansion_selection_origin = 'configured'` e `config_version_id` não nulo. A RPC rejeita `selectionOrigin != 'configured'` com `invalid_selection_origin`; campanha legada usa a configuração atual `configured`. Contrato atualizado em CONTEXT/OpenSpec e R8 registrado; o CHECK consolidado **não** foi ampliado.
- **Flag fora da RPC:** a RPC de abertura não lê `campaign_format_addition_enabled`; o gate está previsto para a rota/serviço do `62-05`. O RPC é `service_role`-only, mas a defesa em profundidade depende da rota. **Limitação de escopo do plano, registrada.**
- **Sem inventário manual:** a migration é descoberta pelo sufixo `_campaign_format_addition.sql`; não há lista central de migrations a atualizar. O teste falha se houver zero/duas migrations com o sufixo.

## Limitações explícitas (não provadas)

- **Nenhum SQL foi executado.** Sintaxe, constraints, FKs, índices, RLS/grants, triggers, regex de path e comparação de proveniência não foram provados em PostgreSQL real.
- **Atomicidade, locks, deadlocks, isolamento e concorrência** não foram provados; testes estáticos não substituem o Gate de banco.
- **A migration não foi aplicada**, inclusive localmente. O ledger/hash não mudou.
- **Nenhuma flag foi alterada em ambiente**; apenas serviço/painel e seed autorado.
- **Nenhum Storage/provider/campanha** foi acessado ou gerado.
- A unicidade do timestamp foi conferida nos refs locais listados; deve ser reconferida no conjunto integrado antes do release (R3 de `62-REVIEW-RESIDUALS.md`).
- A reversão estrutural não está incluída nesta migration; o rollback operacional é a flag desligada, preservando histórico/créditos/artefatos.

## Ajustes residuais ainda pendentes

Continuam válidos em `62-REVIEW-RESIDUALS.md`: R1/R2 (autorização estruturada e arquivo único da prova paga), R3 (migration → código), R4 (`ArtifactOrigin` no `62-03`), R5/R6 (`62-07`) e R7 (`62-05`).

## User Setup Required

None — nenhum serviço externo, banco, migration aplicada ou configuração de ambiente foi necessária.

## Next Phase Readiness

- Persistência/RPCs/flag **autoradas, estáticas e aceitas tecnicamente**.
- `62-03` autorizado após reconciliar o plano com R4, R8 e os motivos fechados das RPCs corrigidas; `62-04`+ não autorizados.
- Nenhum merge, push, deploy, sync ou archive.

## Self-Check: PASSED

- [x] Migration existe, é única por sufixo e tem prefixo UTC de 14 dígitos único nos refs conferidos.
- [x] Migration declara `LOCAL-ONLY`, `NÃO APLICADA` e `-- REVERT`.
- [x] Commits de código existem (`958bbe6a`, `3944c77a`, `202b22f4`, `213e9df6`, `2a882476`).
- [x] Correções dirigidas da revisão aplicadas: fonte corrente/proveniência na abertura, path/bucket/procedência na entrega e REVERT não destrutivo.
- [x] Contrato de seleção legada reconciliado em CONTEXT/OpenSpec e R8 registrado.
- [x] Testes dirigidos, typecheck, lint, build e suíte global reexecutados com resultados reais.
- [x] Nenhum banco/Storage/provider/migration aplicada/flag em ambiente/merge/push/deploy/sync/archive.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Completed: 2026-11-23 (execução local/offline; aceite técnico local/offline em 2026-11-23)*
