# F56.2a — Verificação local (em andamento)

> Registro parcial do Plano 06. O checkpoint humano permanece pendente; não registrar `human_checkpoint: approved` até a decisão explícita do responsável.

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

- Vector permaneceu `restarting`; contadores observados neste trecho: `173` antes do reset, `177` antes do lint anterior à cópia, `179` na sondagem que detectou o workdir vazio, `186` antes do reset com migrations, `188` antes do schema-check/lint, `198` no preflight da integração e `199` na consulta de IDs pós-teste. Nenhum comando explícito de restart/stop/start/remoção/rename do Vector foi emitido; o `db reset` mostrou somente a mensagem genérica `Restarting containers...`.
- A sondagem após o primeiro reset (quando o workdir não continha migrations) encontrou `public.feature_flags` ausente e a execução foi interrompida. Essa tentativa não é contada como validação do schema. Após a cópia autorizada, reset/lint e consulta de schema acima passaram.
- Nenhum `db push`, provider/chamada paga, ativação, remoção de linha ou reset final foi executado.
- Estado: `in_progress`; integração local concluída; checkpoint humano ainda não executado/aprovado.

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
- IDs sintéticos retidos na instância descartável até o reset final autorizado após checkpoint: store `6297665d-4095-4e24-867d-dda4a90c1f97`; campaign A `755b2872-9610-4bb3-98ca-1e777c9c80b5`; campaign B `6d1512ce-72d6-4bdc-b561-ce59bd90adf6`; snapshot A `872d03cb-0d54-4929-8b33-ef647fba8e4f`; snapshot B `95ed3e8c-ef0a-405d-a005-a7a82b74d58f`; operação válida row `4f847f46-19ee-461b-9ad9-488283b4ae91`, operation_id `2a5a76fe-74fd-46c2-9fa5-2808ec830419`.
- As alterações UPDATE/DELETE de teste foram revertidas; nenhuma linha de evidência foi removida. Flags verificadas false ao final. Sem `db push`, provider, chamada paga, encaminhamento real ou ativação.
- `human_checkpoint: pending`; não executar Task 4/reset final nem registrar aprovação até decisão explícita do responsável.
