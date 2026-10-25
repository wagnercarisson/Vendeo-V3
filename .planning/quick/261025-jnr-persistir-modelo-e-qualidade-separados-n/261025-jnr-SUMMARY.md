---
status: complete
date: 2026-10-25
plan: 261025-jnr
slug: persistir-modelo-e-qualidade-separados-n
phase: quick
type: execute
commit: c1ebbd7e
files_modified:
  - supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql
  - scripts/verify/47-03-f47-3-model-quality-split-verification.mjs
requirements: []
---

# Quick 261025-jnr — Persistir modelo e qualidade separados na Assinatura Visual

## One-liner

Migration corretiva F47.3 introduz a RPC v3 que recebe `p_image_model` e
`p_image_quality` separados e deriva `image_preset` no servidor, removendo o
bloqueio de avaliação e dropando a v2 — validada por verificador offline de 37
asserts, sem tocar banco, tabelas ou código de aplicação.

## What changed

### 1. `supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql` (novo)

Migration forward-only, comentários em português no padrão F47.1/F47.2. Nenhuma
migration existente foi editada.

- **RPC `public.admin_set_visual_signature_model_config_v3`** — 9 parâmetros
  `(p_actor_id UUID, p_orchestrator_model TEXT, p_image_model TEXT,
  p_image_quality TEXT, p_reasoning_effort TEXT, p_reason TEXT,
  p_operation_id UUID, p_environment_scope TEXT, p_instance_identity TEXT)`,
  `RETURNS JSONB`, `LANGUAGE plpgsql`, `SECURITY DEFINER`,
  `SET search_path = ''`.
- **Validações** na ordem herdada da v2 (`missing_actor_id`, `missing_reason`,
  `missing_operation_id`, `missing_instance_identity`,
  `invalid_environment_scope`, `invalid_reasoning`, `invalid_orchestrator`) e
  duas novas: `invalid_image_model` (lista fechada
  `gpt-image-2.5-flare|gpt-image-2.5-sunburst`) e `invalid_image_quality`
  (`low|medium`).
- **Derivação do preset só no servidor**, via `CASE WHEN` sobre o par, com
  `ELSE RAISE EXCEPTION 'invalid_preset_tuple'` (sem `ELSE` silencioso, sem
  `NULL`).
- **Remoção do bloqueio de avaliação humana** — a string proibida não aparece em
  nenhum ponto do arquivo (inclusive comentários).
- **Preservação operacional** idêntica à v2: `pg_advisory_xact_lock(
  hashtext('f47_2_visual_signature_model_config_release'))` antes da consulta de
  idempotência; replay/conflito por `operation_id`; validação de catálogo
  (`visual_signature_image/openai/<orchestrator>/responses/active`); captura de
  `previous_config_version_id` e `previous_pilot_stores`; UPSERT singleton
  renovando `config_version_id`; invalidação da liberação
  (`published/activated = NULL`, `activation_mode='none'`,
  `reason='configuration_replaced_requires_reapproval'`); `DELETE` da allowlist;
  `INSERT INTO public.admin_audit_log` na mesma transação.
- **Grants**: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` e
  `GRANT EXECUTE ... TO service_role` na assinatura de 9 args.
- **`DROP FUNCTION IF EXISTS public.admin_set_visual_signature_model_config_v2(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);`** — elimina o overload.
- **Bloco REVERT manual** comentado (forward-only), referenciando a v2 original
  em `20261024141452_f47_2_visual_signature_release_state.sql` (seção 4, linhas
  98-287). A v2 não foi reescrita em SQL executável.
- **Fora de escopo confirmado ausente**: nenhum `CREATE OR REPLACE` de
  `admin_reset_*`, `admin_publish_*`, `admin_activate_*`; nenhum DDL em
  `visual_signature_model_config`, `..._release`, `..._pilot_stores`,
  `admin_audit_log`; sem `BEGIN;`/`COMMIT;` explícitos.

### 2. `scripts/verify/47-03-f47-3-model-quality-split-verification.mjs` (novo)

Node ESM, 100% offline. Importa apenas `node:fs`, `node:path`, `node:url`;
resolve a raiz do repositório via `import.meta.url` (`new URL("../..", ...)`).
Descobre a migration por `readdirSync` + `/_f47_3_.*\.sql$/` (falha se houver
zero ou mais de uma). Saída `✓`/`✗` por assert, resumo
`Results: N passed / M failed / T total`, `process.exitCode = 1` em falha, e
mensagem clara (sem stack trace cru) para arquivo ausente.

Blocos verificados: **A** quatro pares→preset; **B** rejeições explícitas
(`invalid_image_model`, `invalid_image_quality`, `invalid_preset_tuple`, `ELSE`
presente, ausência de `ELSE NULL`); **C** ausência do bloqueio na F47.3,
presença na F47.2 (sanidade do alvo) e `DROP` da v2; **D** reset/publish/activate
não redefinidos; **E** `chk_vs_preset_tuple` da F47.1 cobre as quatro tuplas;
**F** preservação operacional (lock, auditoria, `operation_id_conflict`,
`configuration_replaced_requires_reapproval`, allowlist,
`previous_config_version_id`, flags `config_published`/`config_activated`,
chaves `image_preset`/`image_model`/`image_quality`); **G** assinatura v3
(`p_image_model` antes de `p_image_quality`, sem `p_image_preset`,
`SECURITY DEFINER`, `search_path = ''`).

## Exact RPC contract

```sql
public.admin_set_visual_signature_model_config_v3(
  p_actor_id           UUID,
  p_orchestrator_model TEXT,   -- 'gpt-5.5' | 'gpt-6-luna'
  p_image_model        TEXT,   -- 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst'
  p_image_quality      TEXT,   -- 'low' | 'medium'
  p_reasoning_effort   TEXT,   -- 'low'
  p_reason             TEXT,
  p_operation_id       UUID,
  p_environment_scope  TEXT,   -- 'local_validation' | 'production'
  p_instance_identity  TEXT
) RETURNS JSONB
```

Derivação (servidor):

| p_image_model | p_image_quality | image_preset derivado |
|---|---|---|
| `gpt-image-2.5-flare` | `low` | `flare_low` |
| `gpt-image-2.5-flare` | `medium` | `flare_medium` |
| `gpt-image-2.5-sunburst` | `low` | `sunburst_low` |
| `gpt-image-2.5-sunburst` | `medium` | `sunburst_medium` |

Qualquer outro par → `RAISE EXCEPTION 'invalid_preset_tuple'`.

Erros tipados: `missing_actor_id`, `missing_reason`, `missing_operation_id`,
`missing_instance_identity`, `invalid_environment_scope`, `invalid_reasoning`,
`invalid_orchestrator`, `invalid_image_model`, `invalid_image_quality`,
`invalid_preset_tuple`, `operation_id_conflict`, `orchestrator_not_in_catalog`.

Retorno (`jsonb_build_object`): `success`, `idempotent`, `operation='set'`,
`scope='visual_signature'`, `environment_scope`, `actor_id`,
`instance_identity`, `orchestrator_model`, `image_preset`, `image_model`,
`image_quality`, `reasoning_effort='low'`, `config_version_id`,
`previous_config_version_id`, `previous_pilot_stores`, `config_published=false`,
`config_activated=false`, `activation_mode='none'`, `reason`.

## Validation commands + results

| Command | Result |
|---|---|
| `node --check scripts/verify/47-03-f47-3-model-quality-split-verification.mjs` | exit 0 |
| `node scripts/verify/47-03-f47-3-model-quality-split-verification.mjs` | **37 passed / 0 failed / 37 total**, exit 0 |
| Verificação inline da Task 1 (presença/ausência de strings) | `migration ok`, exit 0 |
| `git diff --check` | exit 0 |
| Teste negativo (DROP da v2 removido temporariamente) | 36 passed / 1 failed, exit 1 → restaurado, exit 0 |
| `git status --porcelain` antes do commit | apenas os 2 arquivos esperados staged |

## Migration pending application

`20261025171102_f47_3_visual_signature_model_quality_split.sql` está **criada e
commitada, mas NÃO aplicada**. Nenhuma migration foi executada, nenhum
`supabase migration up`, `db push`, `migration repair`, Docker, `psql` ou ledger
foi tocado. A aplicação local futura exige autorização humana explícita.

**Nada foi aplicado a nenhum banco de dados** — nem local, nem remoto.

## Deviations from Plan

- **Ajuste cosmético no `DROP FUNCTION` da v2**: escrito em uma única linha para
  satisfazer o comando de verificação inline da Task 1 exatamente como
  especificado. Sem mudança de semântica.
- **Ajuste no texto de comentários**: a string proibida era citada nos
  comentários de cabeçalho e do bloco REVERT. Foi reescrita para manter o
  arquivo 100% livre dela (exigência explícita de `<done>` e do Bloco C do
  verificador), sem perder a explicação do contexto.

Nenhuma alteração arquitetural, nenhuma dependência nova, nenhum arquivo fora
dos dois previstos.

## Out of scope — confirmed untouched

Código de aplicação, card, formulário, endpoints, fluxo de geração, adapter,
prompts, flags, F50.4, pricing, RPCs de reset/publicação/ativação e migrations
já existentes.

## Self-Check: PASSED

- `supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql` — FOUND
- `scripts/verify/47-03-f47-3-model-quality-split-verification.mjs` — FOUND
- Commit `c1ebbd7e` — FOUND (2 files changed, 575 insertions, 0 deletions)
