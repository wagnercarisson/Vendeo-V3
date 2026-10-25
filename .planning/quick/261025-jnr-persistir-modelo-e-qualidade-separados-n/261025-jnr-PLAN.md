---
status: planned
date: 2026-10-25
slug: persistir-modelo-e-qualidade-separados-n
phase: quick
plan: 261025-jnr
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql
  - scripts/verify/47-03-f47-3-model-quality-split-verification.mjs
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "Existe um Ãºnico contrato de escrita da Assinatura Visual que recebe modelo e qualidade separados e deriva o preset no servidor"
    - "As quatro combinaÃ§Ãµes (flare|sunburst Ã— low|medium) sÃ£o aceitas e derivam o preset correspondente"
    - "Modelo ou qualidade invÃ¡lidos sÃ£o rejeitados com RAISE explÃ­cito, sem ELSE silencioso"
    - "O caminho antigo que recebia preset como fonte independente (v2) deixa de existir"
    - "Reset, publicaÃ§Ã£o e ativaÃ§Ã£o permanecem intocados pela migration corretiva"
    - "Um verificador offline prova tudo acima sem banco, Docker, rede ou provider"
  artifacts:
    - path: "supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql"
      provides: "RPC v3 com modelo/qualidade separados e preset derivado; DROP da v2"
      contains: "admin_set_visual_signature_model_config_v3"
    - path: "scripts/verify/47-03-f47-3-model-quality-split-verification.mjs"
      provides: "VerificaÃ§Ã£o offline estÃ¡tica da migration corretiva"
      min_lines: 80
  key_links:
    - from: "scripts/verify/47-03-f47-3-model-quality-split-verification.mjs"
      to: "supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql"
      via: "leitura de arquivo e asserts de regex/string"
      pattern: "readFileSync"
    - from: "supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql"
      to: "public.admin_audit_log"
      via: "INSERT na mesma transaÃ§Ã£o (auditoria)"
      pattern: "INSERT INTO public.admin_audit_log"
---

<objective>
Preparar exclusivamente a persistÃªncia da Assinatura Visual para receber `image_model` e `image_quality` separados, com `image_preset` derivado no servidor.

Purpose: eliminar o bloqueio `preset_not_evaluated` e o contrato contraditÃ³rio que tratava o preset como fonte independente, sem alterar tabela, reset, publicaÃ§Ã£o ou ativaÃ§Ã£o. A tabela `visual_signature_model_config` e seu CHECK `chk_vs_preset_tuple` jÃ¡ aceitam as quatro combinaÃ§Ãµes â€” o bloqueio real estÃ¡ na RPC v2.

Output:
- Uma migration corretiva forward-only (`20261025171102_f47_3_...`) com a RPC v3 e `DROP` da v2.
- Um verificador offline em `scripts/verify/` que falha com exit != 0 em divergÃªncia.

Fora de escopo (NÃƒO tocar): cÃ³digo de aplicaÃ§Ã£o, card, formulÃ¡rio, endpoints, geraÃ§Ã£o, adapter, prompts, flags, F50.4, pricing, reset/publish/activate, migrations jÃ¡ aplicadas.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./AGENTS.md
@supabase/migrations/20261024141422_f47_1_visual_signature_model_config.sql
@supabase/migrations/20261024141452_f47_2_visual_signature_release_state.sql
@scripts/verify/47-01-f47-migration-verification.mjs

<facts>
- `public.visual_signature_model_config` jÃ¡ tem `image_preset`, `image_model`, `image_quality`; `chk_vs_preset_tuple` (F47.1, linhas 51-56) jÃ¡ aceita as quatro combinaÃ§Ãµes. NÃƒO alterar a tabela.
- O bloqueio Ã© o bloco `IF NOT ((orchestrator='gpt-5.5' AND p_image_preset='sunburst_medium') OR (orchestrator='gpt-6-luna' AND p_image_preset='sunburst_medium')) THEN RAISE 'preset_not_evaluated'` na RPC v2 (F47.2, linhas 150-156).
- A RPC v2 tem assinatura `(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT)` â€” 8 args com `p_image_preset` na 3Âª posiÃ§Ã£o.
- Nenhum chamador de aplicaÃ§Ã£o usa essas RPCs (somente migrations). Remover o overload v2 Ã© seguro.
- F47.2 jÃ¡ revogou INSERT/UPDATE/DELETE direto da tabela para `service_role`; escrita sÃ³ via SECURITY DEFINER.
</facts>

<interfaces>
Contrato v2 a ser substituÃ­do (F47.2, linhas 98-107):

```sql
CREATE OR REPLACE FUNCTION public.admin_set_visual_signature_model_config_v2(
  p_actor_id UUID, p_orchestrator_model TEXT, p_image_preset TEXT,
  p_reasoning_effort TEXT, p_reason TEXT, p_operation_id UUID,
  p_environment_scope TEXT, p_instance_identity TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
```

Tuplas vÃ¡lidas (F47.1, linhas 51-56):
- `flare_low` = `gpt-image-2.5-flare` + `low`
- `flare_medium` = `gpt-image-2.5-flare` + `medium`
- `sunburst_low` = `gpt-image-2.5-sunburst` + `low`
- `sunburst_medium` = `gpt-image-2.5-sunburst` + `medium`

Tabelas tocadas pela v2 e que a v3 deve preservar no mesmo fluxo:
- `public.visual_signature_model_config` (upsert singleton, renova `config_version_id`)
- `public.visual_signature_model_config_release` (invalida `published/activated` â†’ NULL, `activation_mode='none'`)
- `public.visual_signature_model_config_pilot_stores` (DELETE total)
- `public.admin_audit_log` (INSERT com `operation_id` Ãºnico)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Criar migration corretiva F47.3 com RPC v3 (modelo/qualidade separados)</name>
  <files>supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql</files>
  <action>
Criar a migration `supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql` (timestamp `20261025171102` = 2026-10-25T17:11:02Z; antes de gravar, confirmar unicidade com `git log --all --name-only -- "supabase/migrations/20261025171102*"` e `ls supabase/migrations` â€” se houver colisÃ£o, obter novo timestamp UTC real e renomear o arquivo e as referÃªncias do plano). Migration forward-only, comentÃ¡rios em portuguÃªs no padrÃ£o F47.1/F47.2, sem aplicar nada e sem tocar migrations existentes.

CabeÃ§alho em bloco de comentÃ¡rio: tÃ­tulo "F47.3 â€” PersistÃªncia de modelo e qualidade separados na Assinatura Visual", nome do arquivo, explicaÃ§Ã£o de que a tabela e o CHECK jÃ¡ cobrem as quatro combinaÃ§Ãµes e que o Ãºnico bloqueio era `preset_not_evaluated` na v2; escopo 1) RPC v3 com `p_image_model`/`p_image_quality` separados e preset derivado no servidor; 2) remoÃ§Ã£o do bloqueio de avaliaÃ§Ã£o; 3) `DROP FUNCTION` da v2; 4) bloco REVERT manual. Declarar explicitamente que nÃ£o altera tabela, reset, publish, activation, catÃ¡logo, pricing nem cÃ³digo de aplicaÃ§Ã£o.

Corpo SQL, nesta ordem:

1. `CREATE OR REPLACE FUNCTION public.admin_set_visual_signature_model_config_v3(...)` com exatamente estes parÃ¢metros nesta ordem: `p_actor_id UUID`, `p_orchestrator_model TEXT`, `p_image_model TEXT`, `p_image_quality TEXT`, `p_reasoning_effort TEXT`, `p_reason TEXT`, `p_operation_id UUID`, `p_environment_scope TEXT`, `p_instance_identity TEXT`. `RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''`. Declarar variÃ¡veis: `v_image_preset TEXT`, `v_config_version_id UUID`, `v_previous_version_id UUID`, `v_previous_pilot JSONB`, `v_existing_metadata JSONB`, `v_existing_action TEXT`, `v_result JSONB`.

2. ValidaÃ§Ãµes na mesma ordem e com as MESMAS mensagens da v2: `missing_actor_id`, `missing_reason`, `missing_operation_id`, `missing_instance_identity`, `invalid_environment_scope` (aceitar `local_validation|production`), `invalid_reasoning` (exige `low`), `invalid_orchestrator` (aceita `gpt-5.5|gpt-6-luna`). Em seguida adicionar duas validaÃ§Ãµes novas e explÃ­citas: se `p_image_model` Ã© NULL ou nÃ£o estÃ¡ em `('gpt-image-2.5-flare','gpt-image-2.5-sunburst')` â†’ `RAISE EXCEPTION 'invalid_image_model'`; se `p_image_quality` Ã© NULL ou nÃ£o estÃ¡ em `('low','medium')` â†’ `RAISE EXCEPTION 'invalid_image_quality'`.

3. DerivaÃ§Ã£o do preset EXCLUSIVAMENTE no servidor via `CASE` sobre o par. Mapear: (`gpt-image-2.5-flare`, `low`) â†’ `flare_low`; (`gpt-image-2.5-flare`, `medium`) â†’ `flare_medium`; (`gpt-image-2.5-sunburst`, `low`) â†’ `sunburst_low`; (`gpt-image-2.5-sunburst`, `medium`) â†’ `sunburst_medium`; `ELSE RAISE EXCEPTION 'invalid_preset_tuple'`. NÃ£o pode existir `ELSE` silencioso nem preset recebido por parÃ¢metro.

4. NÃƒO incluir qualquer verificaÃ§Ã£o de avaliaÃ§Ã£o humana nem a string `preset_not_evaluated`.

5. `PERFORM pg_advisory_xact_lock(hashtext('f47_2_visual_signature_model_config_release'));` antes da consulta de idempotÃªncia (mesma trava da v2).

6. IdempotÃªncia: `SELECT metadata, action INTO ... WHERE operation_id = p_operation_id`. Se `FOUND`, comparar action `visual_signature_model_config_update`, `operation='set'`, `actor_id`, `environment_scope`, `orchestrator_model`, `image_preset` (o derivado `v_image_preset`), `image_model` (`p_image_model`), `image_quality` (`p_image_quality`), `reasoning_effort`, `instance_identity` (btrim), `reason` (btrim); divergÃªncia â†’ `RAISE EXCEPTION 'operation_id_conflict'`. Replay â†’ retornar metadata existente com `success=true, idempotent=true`.

7. ValidaÃ§Ã£o de catÃ¡logo idÃªntica Ã  v2: `capability='visual_signature_image' AND provider='openai' AND model=p_orchestrator_model AND protocol='responses' AND status='active'`, senÃ£o `RAISE EXCEPTION 'orchestrator_not_in_catalog'`.

8. Capturar `v_previous_version_id` da tabela singleton com `FOR UPDATE` e `v_previous_pilot` via `jsonb_agg(store_id ORDER BY store_id)`.

9. UPSERT em `public.visual_signature_model_config` exatamente como a v2, porÃ©m gravando `v_image_preset`, `p_image_model`, `p_image_quality` e renovando `config_version_id = gen_random_uuid()` no INSERT e no `DO UPDATE`.

10. Upsert em `public.visual_signature_model_config_release` invalidando a liberaÃ§Ã£o anterior: `published_config_version_id=NULL`, `activated_config_version_id=NULL`, `activation_mode='none'`, `environment_scope`, `instance_identity`, `updated_by`, `updated_at`, `reason='configuration_replaced_requires_reapproval'`, `last_operation_id=p_operation_id`. Depois `DELETE FROM public.visual_signature_model_config_pilot_stores`.

11. `v_result` via `jsonb_build_object` contendo no mÃ­nimo: `success`, `idempotent=false`, `operation='set'`, `scope='visual_signature'`, `environment_scope`, `actor_id`, `instance_identity`, `orchestrator_model`, `image_preset` (derivado), `image_model`, `image_quality`, `reasoning_effort='low'`, `config_version_id`, `previous_config_version_id`, `previous_pilot_stores`, `config_published=false`, `config_activated=false`, `activation_mode='none'`, `reason`. Inserir em `public.admin_audit_log` (`action='visual_signature_model_config_update'`, `target_type='visual_signature_model_config'`, `target_id=v_config_version_id`) na mesma transaÃ§Ã£o e retornar `v_result`.

12. `REVOKE EXECUTE ON FUNCTION public.admin_set_visual_signature_model_config_v3(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;` e `GRANT EXECUTE ... TO service_role;` com a assinatura de 9 argumentos.

13. `DROP FUNCTION IF EXISTS public.admin_set_visual_signature_model_config_v2(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);` â€” remover o caminho antigo que recebia preset como fonte independente. NÃ£o manter overload.

14. Bloco REVERT manual comentado no padrÃ£o F47.1/F47.2, com polÃ­tica forward-only e instruÃ§Ãµes: dropar a v3 e recriar a v2 original (referenciar `20261024141452_f47_2_visual_signature_release_state.sql`, linhas 98-287). NÃ£o escrever a v2 novamente em SQL executÃ¡vel.

Regras: NÃƒO incluir `CREATE OR REPLACE` de `admin_reset_visual_signature_model_config`, `admin_publish_visual_signature_model_config` ou `admin_activate_visual_signature_model_config`; NÃƒO alterar `visual_signature_model_config`, `visual_signature_model_config_release`, `visual_signature_model_config_pilot_stores`, `admin_audit_log` DDL; NÃƒO usar `BEGIN;`/`COMMIT;` explÃ­citos.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const p='supabase/migrations/20261025171102_f47_3_visual_signature_model_quality_split.sql';const s=fs.readFileSync(p,'utf8');const must=['admin_set_visual_signature_model_config_v3','p_image_model','p_image_quality','invalid_image_model','invalid_image_quality','invalid_preset_tuple','DROP FUNCTION IF EXISTS public.admin_set_visual_signature_model_config_v2(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT)','pg_advisory_xact_lock','INSERT INTO public.admin_audit_log','operation_id_conflict','configuration_replaced_requires_reapproval'];const miss=must.filter(x=>!s.includes(x));const forbidden=['preset_not_evaluated','CREATE OR REPLACE FUNCTION public.admin_reset_visual_signature_model_config','CREATE OR REPLACE FUNCTION public.admin_publish_visual_signature_model_config','CREATE OR REPLACE FUNCTION public.admin_activate_visual_signature_model_config'];const bad=forbidden.filter(x=>s.includes(x));if(miss.length||bad.length){console.error({miss,bad});process.exit(1)}console.log('migration ok')"</automated>
  </verify>
  <done>Migration existe, sem `preset_not_evaluated`, com RPC v3 de 9 args (modelo/qualidade separados, preset derivado por CASE com ELSE explÃ­cito), DROP da v2 e bloco REVERT; reset/publish/activate ausentes do arquivo.</done>
</task>

<task type="auto">
  <name>Task 2: Criar verificador offline da migration F47.3</name>
  <files>scripts/verify/47-03-f47-3-model-quality-split-verification.mjs</files>
  <action>
Criar `scripts/verify/47-03-f47-3-model-quality-split-verification.mjs` â€” Node ESM, 100% offline (sem `@supabase/supabase-js`, sem `pg`, sem `execFileSync`, sem `npx`, sem rede, sem Docker, sem banco). Usar apenas `node:fs`, `node:path` e `node:url`. ExecutÃ¡vel diretamente com `node scripts/verify/47-03-f47-3-model-quality-split-verification.mjs`. PadrÃ£o de saÃ­da igual ao 47-01: uma linha `âœ“`/`âœ—` por assert, resumo `Results: N passed / M failed / T total`, e `process.exitCode = 1` se qualquer assert falhar (suportar execuÃ§Ã£o direta sem imports externos).

Resolver a raiz do repositÃ³rio a partir de `import.meta.url` (`new URL("../..", import.meta.url)`), montar caminhos via `path.join`. Ler:
- migration nova: descobrir por `fs.readdirSync(migrationsDir)` filtrando `/_f47_3_.*\.sql$/` (sem hardcode frÃ¡gil; se houver mais de uma, falhar com mensagem clara).
- `supabase/migrations/20261024141422_f47_1_visual_signature_model_config.sql`
- `supabase/migrations/20261024141452_f47_2_visual_signature_release_state.sql`

Asserts (cada um com nome em portuguÃªs e `detail` em falha):

Bloco A â€” derivaÃ§Ã£o das quatro combinaÃ§Ãµes (na migration nova): para cada par, normalizar removendo espaÃ§os/quebras e verificar que a sequÃªncia modelo+qualidadeâ†’preset aparece no `CASE`. Aceitar variaÃ§Ãµes de espaÃ§amento com regex tolerante (ex.: `gpt-image-2\.5-flare[\s\S]{0,80}low[\s\S]{0,80}flare_low`), garantindo que o preset derivado aparece associado ao par correto. Quatro asserts separados: flare_low, flare_medium, sunburst_low, sunburst_medium.

Bloco B â€” rejeiÃ§Ã£o explÃ­cita de valores invÃ¡lidos: asserts de presenÃ§a de `RAISE EXCEPTION 'invalid_image_model'`, `RAISE EXCEPTION 'invalid_image_quality'` e `RAISE EXCEPTION 'invalid_preset_tuple'`; assert de que o bloco do `CASE` termina em `ELSE` (nÃ£o `END CASE` direto apÃ³s o Ãºltimo `THEN`), verificando `ELSE` presente entre o inÃ­cio do `CASE` de derivaÃ§Ã£o e `END CASE`; assert de que nÃ£o existe `ELSE NULL` nem `ELSE v_image_preset := NULL`.

Bloco C â€” eliminaÃ§Ã£o do bloqueio: assert de que a migration nova NÃƒO contÃ©m `preset_not_evaluated`; assert de que a v2 (arquivo F47.2) ainda contÃ©m `preset_not_evaluated` (sanidade de que estamos corrigindo o alvo certo); assert de que a migration nova contÃ©m `DROP FUNCTION IF EXISTS public.admin_set_visual_signature_model_config_v2(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT)`.

Bloco D â€” nÃ£o redefinir ciclo de vida: asserts de ausÃªncia de `CREATE OR REPLACE FUNCTION public.admin_reset_visual_signature_model_config`, `...admin_publish_visual_signature_model_config`, `...admin_activate_visual_signature_model_config` na migration nova.

Bloco E â€” CHECK da tabela cobre os quatro pares: na F47.1, assert de presenÃ§a de `chk_vs_preset_tuple` e dos quatro pares com modelo/qualidade corretos (quatro asserts tolerantes a espaÃ§amento).

Bloco F â€” preservaÃ§Ã£o operacional na v3: asserts de presenÃ§a de `pg_advisory_xact_lock`, `INSERT INTO public.admin_audit_log`, `operation_id_conflict`, `configuration_replaced_requires_reapproval`, `visual_signature_model_config_pilot_stores`, `previous_config_version_id`, `config_published`, `config_activated`; assert de presenÃ§a das flags `'config_published', false`/equivalente tolerante e de `'image_preset'`, `'image_model'`, `'image_quality'` no `jsonb_build_object`.

Bloco G â€” assinatura v3: assert de que a declaraÃ§Ã£o da v3 lista `p_image_model` antes de `p_image_quality` e de que NÃƒO existe parÃ¢metro `p_image_preset` na assinatura da v3 (regex sobre o bloco entre `FUNCTION public.admin_set_visual_signature_model_config_v3(` e `) RETURNS`). Assert extra de que a v3 Ã© `SECURITY DEFINER` e `SET search_path = ''`.

Erros de arquivo ausente devem produzir mensagem clara e exit != 0, nunca stack trace cru sem contexto.
  </action>
  <verify>
    <automated>node scripts/verify/47-03-f47-3-model-quality-split-verification.mjs</automated>
  </verify>
  <done>Script roda offline em menos de 5s, imprime todos os asserts com âœ“ e `0 failed`; ao remover temporariamente um trecho da migration (ex.: o DROP da v2) o script sai com exit 1 â€” comportamento verificÃ¡vel por execuÃ§Ã£o local, sem banco.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app/admin â†’ RPC | Entrada nÃ£o confiÃ¡vel (`p_image_model`, `p_image_quality`, ator, motivo, operation_id) cruza a fronteira; a RPC Ã© `SECURITY DEFINER` |
| migration â†’ banco | DDL/DML executado com privilÃ©gios elevados; precisa ser forward-only e nÃ£o abrir bypass |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261025-01 | Tampering | `admin_set_visual_signature_model_config_v3` | mitigate | Validar `p_image_model`/`p_image_quality` contra listas fechadas e derivar `image_preset` sÃ³ no servidor; `ELSE RAISE` explÃ­cito |
| T-261025-02 | Elevation of Privilege | overload v2 remanescente | mitigate | `DROP FUNCTION` da v2 na mesma migration, sem manter assinatura antiga |
| T-261025-03 | Repudiation | `admin_audit_log` | mitigate | Auditoria na mesma transaÃ§Ã£o com `operation_id` e replay/conflito tipado |
| T-261025-04 | Tampering | `visual_signature_model_config` (escrita direta) | mitigate | Manter grants da F47.2 (sem INSERT/UPDATE/DELETE para service_role); escrita sÃ³ via SECURITY DEFINER |
| T-261025-05 | Information Disclosure | publicaÃ§Ã£o/ativaÃ§Ã£o implÃ­citas | mitigate | Invalidar `published/activated` (`none`/NULL) e limpar allowlist no set |
| T-261025-06 | Denial of Service | concorrÃªncia de set | mitigate | `pg_advisory_xact_lock` antes da consulta de idempotÃªncia |
| T-261025-SC | Tampering | instalaÃ§Ã£o de pacotes | accept | Nenhuma dependÃªncia nova; script usa apenas mÃ³dulos nativos do Node |
</threat_model>

<verification>
- `node scripts/verify/47-03-f47-3-model-quality-split-verification.mjs` â†’ exit 0, `0 failed`.
- `node -c` equivalente: `node --check scripts/verify/47-03-f47-3-model-quality-split-verification.mjs`.
- Grep estÃ¡tico na migration: sem `preset_not_evaluated`; sem redefiniÃ§Ã£o de reset/publish/activate; com `DROP FUNCTION ... v2`.
- `git status --short` deve mostrar apenas a migration nova e o script novo (nenhum arquivo de aplicaÃ§Ã£o).
- NÃƒO executar banco, Docker, Supabase CLI, providers ou migrations.
</verification>

<success_criteria>
- Existe exatamente uma migration corretiva nova, forward-only, com timestamp UTC real e Ãºnico.
- A RPC v3 recebe `p_image_model` e `p_image_quality` separados, valida identificadores completos e deriva o preset no servidor.
- As quatro combinaÃ§Ãµes sÃ£o aceitas; modelo/qualidade invÃ¡lidos sÃ£o rejeitados explicitamente.
- `preset_not_evaluated` nÃ£o existe mais e a v2 foi removida; reset/publish/activate intocados.
- Auditoria, idempotÃªncia, advisory lock, `config_version_id`, invalidaÃ§Ã£o de liberaÃ§Ã£o e limpeza de allowlist preservados.
- Metadados de retorno continuam expondo preset, modelo, qualidade, versÃµes e flags false.
- Bloco REVERT manual comentado presente no padrÃ£o do projeto.
- Verificador offline existe, roda direto, falha com exit != 0 em divergÃªncia e nÃ£o usa rede/banco/Docker.
- Nenhum cÃ³digo de aplicaÃ§Ã£o, card, formulÃ¡rio, endpoint, geraÃ§Ã£o, adapter, prompt, flag, F50.4 ou pricing alterado.
</success_criteria>

<output>
Create `.planning/quick/261025-jnr-persistir-modelo-e-qualidade-separados-n/261025-jnr-SUMMARY.md` when done.
O executor commita apenas a migration e o script; artefatos `.planning` sÃ£o commitados pelo orquestrador.
</output>
