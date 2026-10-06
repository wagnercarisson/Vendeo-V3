---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 07
subsystem: [api, database, ai]
tags: [supabase, postgres, rls, uuid, immutable, admin-route, durability, fail-closed]

# Dependency graph
requires:
  - phase: 56-1-01
    provides: contrato do par modelo+qualidade (image-model-pair) e escolha inicial humana
  - phase: 56-1-03
    provides: snapshot imutável por campanha e dimensão de qualidade no pricing
provides:
  - "Tabela durável image_generation_failure_diagnoses (referência UUID PK, imutável, service_role)"
  - "Componente público IMG-001 + referência opaca UUID v4 + mensagem PT-BR não reveladora"
  - "Repositório server-only durável recordDiagnosis/findByReference com client injetável"
  - "Rota admin GET de correlação referência→diagnóstico (read-only, sem estado em memória)"
  - "Prova de durabilidade cross-instance contra a instância Supabase isolada"
affects: [56-1-11, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS service_role SELECT/INSERT + trigger BEFORE UPDATE OR DELETE imutável"
    - "Seam de client injetável (SupabaseClient no construtor) para prova de durabilidade"
    - "Prova por DUAS instâncias/clientes independentes (nunca fake em memória)"

key-files:
  created:
    - supabase/migrations/20261005000003_f56_1_failure_diagnosis.sql
    - src/lib/ai/image-generation-support-reference.ts
    - src/lib/ai/image-generation-diagnosis-repository.ts
    - src/app/api/admin/image-generation-diagnosis/route.ts
    - src/lib/ai/__tests__/image-generation-support-reference.test.ts
    - src/lib/ai/__tests__/image-generation-diagnosis-repository.test.ts
    - src/app/api/admin/__tests__/image-generation-diagnosis.test.ts
  modified: []

key-decisions:
  - "Código público único IMG-001; quota/faturamento/auth/rate limit compartilham a mesma categoria pública (D-18)."
  - "Referência de atendimento opaca em UUID v4 (crypto.randomUUID), única por ocorrência e reutilizável quando informada (D-18)."
  - "Mensagem pública PT-BR genérica sanitizada (sanitizeAiErrorMessage), sem quota/saldo/faturamento/chave/URL/stack/texto cru (D-19)."
  - "Tabela local-only service_role SELECT/INSERT (sem UPDATE/DELETE) com trigger imutável BEFORE UPDATE OR DELETE (D-26/T-56.1-39)."
  - "Repositório sanitiza normalized_error/message_public ANTES de persistir; client Supabase injetável (seam)."
  - "Rota admin constrói um repositório novo a cada requisição — nenhuma correlação sustentada por estado em memória (D-26)."
  - "Durabilidade provada por nova instância do repositório (novo cliente/requisição) contra a tabela na instância isolada; skip é contingência BLOQUEANTE (nunca fake em memória)."

patterns-established:
  - "Diagnóstico imutável append-only: RLS service_role SELECT/INSERT + trigger que lança image_generation_failure_diagnosis_immutable em UPDATE/DELETE"
  - "Correlação durável referência→diagnóstico sempre via tabela, nunca cache local"
  - "Teste de durabilidade opt-in por env (F561_ISOLATED_*) com skip marcado como bloqueante"

requirements-completed: [REQ-56.1-17, REQ-56.1-18, REQ-56.1-19, REQ-56.1-20]

# Metrics
duration: 4 min
completed: 2026-10-06
---

# Phase 56.1 Plan 07: Contrato produtivo, modelos e fallback — resposta pública e correlação durável Summary

**Resposta pública não reveladora (IMG-001 + referência UUID v4) e correlação durável referência→diagnóstico em tabela imutável, com prova cross-instance na instância Supabase isolada**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-06T16:52:59Z
- **Completed:** 2026-10-06T16:56:52Z
- **Tasks:** 4
- **Files modified/criados:** 7 (7 criados)

## Accomplishments
- Migration local-only `20261005000003_f56_1_failure_diagnosis.sql`: tabela `public.image_generation_failure_diagnoses` (colunas tipadas, nunca JSONB; `reference UUID PK DEFAULT gen_random_uuid()`; `code` default `IMG-001`), RLS service_role SELECT/INSERT e trigger `BEFORE UPDATE OR DELETE` que lança `image_generation_failure_diagnosis_immutable`.
- Componente puro `image-generation-support-reference.ts`: `PUBLIC_GENERATION_FAILURE_CODE = "IMG-001"`, `buildPublicGenerationFailure` com referência UUID v4 opaca e mensagem PT-BR genérica sanitizada; causa interna não distinguível pelo código público.
- Repositório server-only durável `image-generation-diagnosis-repository.ts` (`recordDiagnosis`/`findByReference`) com client injetável e sanitização antes de persistir.
- Rota admin GET `image-generation-diagnosis` (guard `requireAdmin`, 400/404, read-only, sem estado em memória).
- Prova de durabilidade cross-instance executada de fato contra a instância isolada (4 testes, não skip) + 2 linhas persistidas na tabela.

## Task Commits

Cada task foi commitada atomicamente (Task 2 seguiu TDD: test → feat):

1. **Task 1: Migration da tabela durável de diagnósticos** - `7aa409f0` (feat)
2. **Task 2: Componente público IMG-001 + repositório durável** - `41b1df33` (test, RED) → `0dc87448` (feat, GREEN)
3. **Task 3: Rota admin de correlação sobre o repositório durável** - `d4383876` (feat)
4. **Task 4: Não revelação, correlação e durabilidade cross-instance** - `194878c3` (test)

**Plan metadata:** ver commit de encerramento (docs) abaixo.

## Instance Identity Proof (ISOLATED_DB_CONTRACT)

Confirmado ANTES de aplicar a migration (e registrado):

- **Workdir:** `C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f561-isolated`
- **project_id / containers / volume:** sufixo `vendeo-f561-isolated`
- **Project URL / REST:** `http://127.0.0.1:55321` (REST base `http://127.0.0.1:55321/rest/v1`)
- **DB:** `127.0.0.1:55322` (container `supabase_db_vendeo-f561-isolated`)
- **`supabase status`:** Project URL `http://127.0.0.1:55321`, DB `127.0.0.1:55322`; serviços `vendeo-f561-isolated`
- **`docker ps`:** apenas containers `supabase_*_vendeo-f561-isolated` em 553xx (`kong` 55321, `db` 55322, `rest`, `auth`); **nenhum** container `Vendeo_V3`
- **Chave de serviço:** JWT `role":"service_role"` lido em runtime de `supabase status -o env` (SERVICE_ROLE_KEY); **não** hardcoded no repositório

## Durability Evidence (DURABILITY_TEST_CONTRACT)

- `supabase db reset --workdir "<isolado>" --local --no-seed` → **EXIT 0** (migration `20261005000003_f56_1_failure_diagnosis.sql` aplicada).
- `supabase db lint --workdir "<isolado>" --local --fail-on error` → **EXIT 0** (somente warnings pré-existentes, sem erro).
- Suítes com env `F561_ISOLATED_SUPABASE_URL=http://127.0.0.1:55321` e `F561_ISOLATED_SERVICE_ROLE_KEY=<service_role JWT>`:
  - `npm test -- <3 suítes>` → **3 arquivos / 26 testes passed** (EXIT 0).
  - Suíte de durabilidade isolada (`--reporter=verbose`) → **4 passed, 0 skipped** (executou de fato).
- Prova de durabilidade: instância **A** (`createClient` novo) grava o diagnóstico; instância **B** (`createClient` novo + `new SupabaseImageGenerationDiagnosisRepository`) recupera o diagnóstico pela referência UUID, com par modelo–qualidade, alvo, tentativa e run/trace corretos.
- Verificação na tabela isolada: `select count(*), count(distinct reference)` = **2 / 2** (linhas de teste não removidas — trigger de imutabilidade bloqueia UPDATE/DELETE, esperado).
- `npm run typecheck` → **EXIT 0**.

## Files Created/Modified
- `supabase/migrations/20261005000003_f56_1_failure_diagnosis.sql` — tabela durável imutável de diagnóstico (creada)
- `src/lib/ai/image-generation-support-reference.ts` — código IMG-001, referência UUID v4 e mensagem pública (creado)
- `src/lib/ai/image-generation-diagnosis-repository.ts` — repositório durável server-only (creado)
- `src/app/api/admin/image-generation-diagnosis/route.ts` — rota admin GET de correlação (creada)
- `src/lib/ai/__tests__/image-generation-support-reference.test.ts` — não revelação + mapeamento (creado)
- `src/lib/ai/__tests__/image-generation-diagnosis-repository.test.ts` — durabilidade cross-instance (creado)
- `src/app/api/admin/__tests__/image-generation-diagnosis.test.ts` — contrato do handler (creado)

## Decisions Made
- **Categoria pública única (D-18):** quota/faturamento/auth/rate limit produzem o mesmo `IMG-001` e a mesma mensagem — indistinguíveis publicamente.
- **Referência opaca UUID v4 (D-18/D-26):** `crypto.randomUUID()`, única por ocorrência, sem dados de conta; reutilizada quando já informada.
- **Imutabilidade (D-26/T-56.1-39):** RLS service_role com apenas SELECT/INSERT + trigger BEFORE UPDATE OR DELETE; a linha inserida não é editável/removível.
- **Client injetável (D-26):** a rota sempre constrói um repositório novo a partir de `supabaseAdmin`; a durabilidade é provada por dois clientes separados contra a tabela.
- **Sanitização antes de persistir (D-19):** `normalized_error` e `message_public` passam por `sanitizeAiErrorMessage`.

## Deviations from Plan

Nenhum desvio de escopo. Uma **clareza de ordenação interna ao plano** foi resolvida sem alterar escopo:

- **Task 3 incluía em `<files>` apenas `route.ts`, mas seu `<verify>` exige `src/app/api/admin/__tests__/image-generation-diagnosis.test.ts`** (arquivo já listado em `files_modified` do plano e formalmente atribuído à Task 4). Para satisfazer o gate de verificação da própria Task 3, o teste de contrato do handler foi criado na Task 3 e a Task 4 o manteve (nenhuma mudança de escopo — o arquivo já pertencia ao conjunto do plano).

**Total deviations:** 0 auto-fixed. **Impact:** nenhum — escopo, arquivos e critérios de aceite preservados exatamente.

## Issues Encountered
- Nome de policy RLS com mais de 63 caracteres gerava `NOTICE (42622)` de truncamento de identificador no Postgres durante o reset; ajustado para `"Service role can read/insert failure diagnoses"` (<63) e reset reexecutado (EXIT 0). Mudança cosmética, sem impacto no comportamento (policy segue em `image_generation_failure_diagnoses` para `service_role`).

## User Setup Required
None - no external service configuration required.

## Threat Surface Scan
Nenhuma superfície nova fora do `<threat_model>` do plano. Arquivos/endpoint criados (tabela `image_generation_failure_diagnoses`, rota admin `image_generation-diagnosis`) já estavam previstos em T-56.1-21/22/23/39/40. Nenhuma chamada de provider, nenhum `db push` e a stack compartilhada `Vendeo_V3` não foi tocada.

## Next Phase Readiness
- Resposta pública IMG-001 + correlação durável (tabela + repositório + rota) entregues e testadas; migração local-only validada na instância isolada.
- A **produção dos eventos reais de falha** e o **enforcement transacional** permanecem para a **F56.2** (D-25/D-26).
- Pronto para o plano 08/10/11; a correlação durável está provada (não skip) para o CHECKPOINT do plano 11.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*

## Self-Check: PASSED

- Arquivos criados: 7/7 encontrados em disco.
- Commits: `7aa409f0`, `41b1df33`, `0dc87448`, `d4383876`, `194878c3` — todos presentes.
- `supabase db lint --fail-on error` (instância isolada) → EXIT 0.
- Suítes (3 arquivos) → 26 passed; durabilidade (4 testes) executada (não skip).
