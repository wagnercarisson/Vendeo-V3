# F56.2a — Verificação local (fechamento aceito; anomalia de infraestrutura registrada)

> Registro do Plano 06. O checkpoint humano foi aprovado e o responsável aceitou o fechamento local da F56.2a com base nas pós-condições confirmadas somente por leitura. A change OpenSpec foi depois verificada, sincronizada e arquivada. O reset final retornou exit 1/HTTP 502 de causa desconhecida; este resultado não é sucesso. A anomalia de infraestrutura permanece pendente de investigação antes de depender do procedimento na F56.2b1.

## Identidade e preparação de migrations

- BASE_SHA literal: `335bfb70`; commit existe e é ancestor de HEAD.
- Workdir isolado: `C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated`; `project_id` confirmado exatamente como `vendeo-f562a-isolated`.
- A pasta destino `supabase/migrations` estava ausente; o diretório pai `supabase` existia. O destino foi criado após confirmar ausência; não era junction/reparse point e nenhum arquivo foi sobrescrito.
- Copiadas somente migrations `*.sql` de `C:\Projetos\Vendeo V3\supabase\migrations`: **106** arquivos. Revision da origem: `599521634f6af0100d47a685f74b9276660e5642`. Lista de nomes e SHA-256 comparados origem↔destino: todos iguais; nenhum arquivo não-SQL foi copiado; `supabase/config.toml` foi preservado.

## Gates e validação de schema

- Preflight completo imediatamente antes do reset: **PASS**. API `http://127.0.0.1:56321`; portas F56.2a `[56320, 56321, 56322, 56323, 56324, 56327, 56329]` únicas/exclusivas; DB/Auth/Kong F56.2a saudáveis; PostgREST ativo; F56.1 DB/Auth/Kong saudáveis, PostgREST ativo, volume/rede presentes; sem Vendeo_V3/Mailpit ativos.
- Comando: `supabase db reset --workdir "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated" --local --no-seed`; exit `0`. A saída confirmou aplicação de ambas as migrations `20261006000001_f56_2a_feature_flags_keys.sql` e `20261006000002_f56_2a_operations_append_only.sql`.
- Após o reset, preflight repetido imediatamente antes da consulta de contrato: **PASS**. Consulta somente leitura confirmou: ambas as migrations na `supabase_migrations.schema_migrations`; as duas flags existem e estão `false`; `public.image_generation_operations` existe; RLS habilitado; triggers campanha/snapshot e immutable presentes; `service_role` SELECT/INSERT=true e UPDATE/DELETE=false.
- Preflight completo repetido imediatamente antes do lint: **PASS**; serviços exigidos e recursos F56.1 continuavam aprovados.
- Comando: `supabase db lint --workdir "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated" --local --fail-on error`; exit `0`. Sem erros; relatório incluiu apenas warnings existentes em `begin_campaign_correction_submission`, `materialize_demo_expiration` e `create_store_with_initial_grant`.
- Status CLI foi capturado em memória e filtrado; nenhum valor de credencial foi emitido ou persistido.

## Vector e limites ainda pendentes

- Vector foi `running`/count `219` no preflight final, depois observado `restarting`/unhealthy (count `236`) e count `247` no preflight da consulta pós-reset. Nenhum comando direto de restart/stop/remoção/rename do Vector foi executado.
- A sondagem após o primeiro reset (quando o workdir não continha migrations) encontrou `public.feature_flags` ausente e a execução foi interrompida. Essa tentativa não é contada como validação do schema. Após a cópia autorizada, reset/lint e consulta de schema acima passaram.
- Nenhum `db push`, provider/chamada paga ou ativação ocorreu. Não houve `DELETE` individual de evidências. O reset final retornou erro, e a pós-condição foi examinada por SELECT somente-leitura após novo preflight.
- Estado local: fechamento aceito pelo responsável; integração concluída; checkpoint humano aprovado; pós-condições confirmadas por SELECT. O reset exit 1/HTTP 502 permanece registrado como anomalia de infraestrutura de causa desconhecida, a investigar antes da F56.2b1.

## Task 2 — integração real e UAT local

- Preflight completo imediatamente anterior ao runner: **PASS**. Identidade, API loopback, portas, DB/PostgREST/Auth/Kong F56.2a, F56.1, volumes/redes, ausência de Vendeo_V3/Mailpit e ownership de portas passaram. Status capturado silenciosamente; somente URL e disponibilidade booleana de credenciais foram relatadas.
- Runner: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-f56-2a-isolated-integration.ps1`; exit `0`; integração Vitest **6/6 passou**.
- Casos reais aprovados:
  1. Insert e leitura de tentativa válida ligada à campaign A e snapshot A.
  2. `campaign_id` inexistente rejeitado pela FK `image_generation_operations_campaign_id_fkey`.
  3. `snapshot_original_id` inexistente rejeitado pela FK `image_generation_operations_snapshot_original_id_fkey`.
  4. Campaign A e snapshot B existentes, ambos pertencentes a campaigns existentes distintas, rejeitados com `image_generation_operations_snapshot_campaign_mismatch`; nenhum registro criado para o operation_id rejeitado.
  5. Catálogo PostgreSQL confirmou `service_role` SELECT/INSERT=true e UPDATE/DELETE=false; tentativas REST de mutation foram rejeitadas; tentativas SQL diretas como owner atingiram `image_generation_operations_immutable`, foram revertidas por savepoint e a linha permaneceu igual.
  6. As duas flags começaram `false`, foram temporariamente ligadas apenas na instância isolada para confirmar a decisão `new_flow` (sem chamar rota/geração/provider) e restauradas para `false` em `finally`; leitura posterior confirmou ambas false.
- IDs sintéticos pré-reset registrados: store `6297665d-4095-4e24-867d-dda4a90c1f97`; campaign A `755b2872-9610-4bb3-98ca-1e777c9c80b5`; campaign B `6d1512ce-72d6-4bdc-b561-ce59bd90adf6`; snapshot A `872d03cb-0d54-4929-8b33-ef647fba8e4f`; snapshot B `95ed3e8c-ef0a-405d-a005-7a82b74d58f8`; operação válida row `4f847f46-19ee-461b-9ad9-488283b4ae91`, operation_id `2a5a76fe-74fd-46c2-9fa5-2808ec830419`. Consulta pós-reset confirmou que todos esses IDs estão ausentes.
- As alterações UPDATE/DELETE de teste foram revertidas; nenhuma linha de evidência foi removida. Flags verificadas false ao final. Sem `db push`, provider, chamada paga, encaminhamento real ou ativação.
- `human_checkpoint: approved` por decisão explícita do responsável em 2026-10-07. O reset final retornou exit 1; a consulta pós-reset foi executada somente-leitura após novo preflight e confirmou as pós-condições esperadas.

## Task 4 — reset final após checkpoint humano

- Preflight completo imediatamente antes do reset final: **PASS**; workdir/project_id/API/portas/mappings, serviços exigidos F56.2a e F56.1, volumes/redes e ausência de Vendeo_V3/Mailpit aprovados.
- Vector no preflight: `running`, restart count `219`. Depois foi observado `restarting`/unhealthy count `236`, e `247` no preflight da consulta. Nenhum comando direto de restart/remoção/rename do Vector foi executado.
- Comando: `supabase db reset --workdir "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated" --local --no-seed` — **exit 1** com `Error status 502: An invalid response was received from the upstream server`, depois de listar ambas as migrations F56.2a como aplicadas.
- Logs sanitizados no intervalo `2026-10-07T20:46:00Z`–`21:00:14Z`: DB 6 linhas sem erro relevante; Kong/Storage/PostgREST 0 linhas; Auth 13 linhas sem erro relevante. Vector repetiu `docker_logs: Listing currently running containers failed ... Network unreachable (os error 101)` e ciclos de shutdown; nenhum log associa o HTTP 502 a Kong/Storage. Serviço upstream que originou o 502 permanece **não identificado**; hipótese CLI #4535 não foi tratada como causa.
- F56.1 pós-diagnóstico: DB/Auth/Kong saudáveis, PostgREST running, DB volume/rede presentes; Storage F56.1 não estava listado como container. F56.2a pós-diagnóstico: DB/Kong/Storage/Auth saudáveis, PostgREST running, DB volume/rede presentes. `supabase status` exit 0 com API loopback.
- Após gate completo PASS, uma consulta PostgreSQL **somente leitura** retornou `2|2|t|0|0|0|0|0|0|0|t|t|t|t|f|f|t|t`: migrations F56.2a presentes; duas flags false; auth user/store/campaign/snapshot/operation fixtures ausentes; relation existe e está vazia; RLS/triggers presentes; grants service_role SELECT/INSERT somente.
- Fail-stop: nenhum reset/restart/remoção adicional nem outra consulta DB após essa leitura. O responsável aceitou essas pós-condições para fechamento LOCAL da F56.2a. Isso não altera o resultado do comando: reset exit 1/HTTP 502, causa desconhecida, não é sucesso; a anomalia de infraestrutura deve ser investigada antes de depender do procedimento em F56.2b1. Sem novo comando DB.

## OpenSpec tasks — reconciliação de evidências (31/31; gates documentais passados)

| Task | Estado | Evidência |
|---|---|---|
| 1.1 | Done | Recorte F56.2a/b1/b2 em `56.2-CONTEXT.md`, proposal e reconciliação arquivada |
| 1.2 | Done | Decisões D-01..D-20 em `56.2-CONTEXT.md` |
| 1.3 | Done | Identidade/preflight/recovery e migration-copy evidence em `56-2-ISOLATED-INSTANCE.md` |
| 1.4 | Done | Baseline/equivalência F48.2.6 em Plan 03 e `56-2-03-SUMMARY.md` |
| 2.1 | Done | Seed disabled em `20261006000001`; reset final listou migration e schema pre-reset confirmou flags false |
| 2.2 | Done | `feature-flow-decision.ts` e `feature-flow-decision-service.ts` |
| 2.3 | Done | `feature-flow-decision.test.ts` mixed-read/fail-closed cases |
| 2.4 | Done | Resolver recebe apenas estado server-derived; client override test em `feature-flow-decision.test.ts` |
| 2.5 | Done | `non-activation.contract.test.ts` e UAT local sem rota/provider effect |
| 3.1 | Done | `intent-selection.ts` e intent tests |
| 3.2 | Done | `background-direction.ts`, selector e tests |
| 3.3 | Done | Original exact-one-product-image rule in `selection-validation.ts`; identity excluded by tests |
| 3.4 | Done | Typed field validation rejects invalid selection without IMG-001 |
| 3.5 | Done | Intent/selection/component test files in `src/lib/product-1-1` |
| 3.6 | Done | `non-activation.contract.test.ts` scans shopper app imports |
| 4.1 | Done | Product-owned versioned composer/policies in Plan 03 files |
| 4.2 | Done | Prompt contract/equivalence tests cover required content and policy rules |
| 4.3 | Done | Composer source and contract tests prove frozen policies/no mutable bench runtime imports |
| 4.4 | Done | Composer output exposes composer/base/policy versions; contract tests assert them |
| 4.5 | Done | F48.2.6 exact equivalence across 9 intent/background combinations |
| 4.6 | Done | Plan 03 runtime-import guard and bench frontier unchanged |
| 5.1 | Done | Append-only migration plus real valid/cross-campaign integration; pairing is campaign-consistent |
| 5.2 | Done | `image-generation-config-snapshot.reuse.test.ts` verifies original snapshot resolution |
| 5.3 | Done | Reuse test verifies original `run_id`/`trace_id` remain unchanged after another attempt |
| 5.4 | Done | Unit tests + 6 real isolated integration tests cover append-only, FKs, pairing, grants/triggers, and attempt reconstruction |
| 6.1 | Done | `legacy-frontier.guard.test.ts` passes using literal BASE_SHA `335bfb70` |
| 6.2 | Done | Typecheck/lint/build passed; relevant local suite 66/66 and isolated integration 6/6; no paid calls |
| 6.3 | Done | UAT flags-on decision test with no route/provider effect; flags restored false after integration |
| 6.4 | Done | Final `openspec validate fase-56-2a-preparacao-nao-operacional-produto-1-1 --strict` passed after task 6.6 reconciliation |
| 6.5 | Done | No `db push`/production action; BASE_SHA migration diff contains only F56.2a additions |
| 6.6 | **Done** | Tracking atualizado após conferência cruzada; gates finais passaram depois da reconciliação: `openspec validate fase-56-2a-preparacao-nao-operacional-produto-1-1 --strict` valid e `git diff --check` exit 0. Responsável aceitou fechamento LOCAL com pós-condições read-only; reset exit 1/HTTP 502 continua anomalia de infraestrutura desconhecida, a investigar antes da F56.2b1 |

**Stop before verify/sync/archive.** `tasks.md` reconcilia a 31/31; ambos os gates documentais passaram após a reconciliação final. O exit 1/HTTP 502 permanece explicitamente anomalia de infraestrutura com causa desconhecida, apesar das pós-condições confirmadas e aceitas para fechamento local. Investigar antes de depender deste procedimento na F56.2b1. Nenhum novo comando DB, push, ativação ou lifecycle OpenSpec.
