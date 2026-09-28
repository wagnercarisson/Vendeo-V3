---
phase: 48.2.2
plan: 48-2-2-08
subsystem: lab-bench
tags: [lab, bench, uat, isolation, closure]
requires:
  - 48-2-2-07
provides:
  - lab-bench-transversal-tests
  - lab-bench-uat-closure
affects:
  - 48.2.3
  - 48.2.4
tech-stack:
  added: []
  patterns:
    - contract-tests
    - base-sha-base-head-comparison
key-files:
  created:
    - src/lib/lab/bench/__tests__/bench-boundary.contract.test.ts
    - src/lib/lab/bench/__tests__/bench-concurrency.contract.test.ts
    - src/lib/lab/__tests__/recording-supabase-client.ts
    - .planning/phases/48.2.2-fundacao-bancada-geracao/48.2.2-UAT.md
  modified:
    - src/lib/lab/__tests__/lab-isolation.contract.test.ts
    - .planning/phases/48.2.2-fundacao-bancada-geracao/48-2-2-VERIFICATION.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - ROADMAP.md
    - .planning/HANDOFF.json
    - openspec/changes/fase-48-2-2-fundacao-bancada-geracao/tasks.md
key-decisions:
  - "UAT registrado apenas com o run relatado (gpt-image-2.5-flare, run f6148ea6-…); o segundo run (gpt-image-2/caneca) fica como observação de divergência, fora do quadro principal."
  - "URLs assinadas persistidas no branding_snapshot registradas como achado/limitação (sem alteração de código nesta fase)."
  - "Fase concluída tecnicamente; OpenSpec permanece ATIVO aguardando verificação/sincronização/arquivamento manuais."
  - "Próxima sequência redefinida: F48.2.3 = Fidelidade experimental da bancada; F48.2.4 = Experimento determinístico Oferta 1:1."
requirements-completed:
  - lab-generation-bench
  - lab-isolation
  - lab-bench-config
  - lab-bench-branding
  - lab-artifacts
  - lab-gateway-harness
  - lab-admin-api
  - lab-admin-ui
metrics:
  tasks: 3
  duration: "~2h (Task 1 + preparação do ambiente + UAT manual + encerramento)"
  completed: 2026-09-28
---

# Phase 48.2 Plan 08: Testes transversais, UAT local e encerramento Summary

Testes transversais de fronteira (incluindo o signer de branding) e de concorrência `draft → pending`, UAT local com **uma** geração real controlada aprovada sob autorização humana, confirmação de produção intocada por comparativo `base..HEAD` e geração dos artefatos de verificação/UAT com tracking atualizado.

## What was built

- **Task 1 — testes transversais + gates:** `bench-boundary.contract.test.ts` (fluxo completo da bancada toca apenas `lab_bench_*`, tabelas de loja/branding em leitura, buckets de branding em leitura e `lab-artifacts`; negativos de `campaigns`/`campaign_art_versions`/`generation_events`/`ai_model_selection`/`admin_audit_log`/`credit_*`/`campaign-images`; **positivo** do signer de branding em bucket da allowlist + negativos de bucket produtivo, traversal e loja fora do manifesto) e `bench-concurrency.contract.test.ts` (exatamente uma confirmação `draft → pending` vencedora — a outra recebe `bench_run_already_active`; exatamente uma geração ativa; reenvio idempotente; reconciliação de órfão e draft abandonado).
- **Task 2 — CHECKPOINT 3 (UAT local):** ambiente local preparado (Supabase local, gate `VENDEO_LAB_ENABLED=true`, bootstrap, loja de teste + branding completo, manifesto) e **uma** geração real controlada autorizada e executada pelo humano — run `f6148ea6-f59a-4732-bbbb-530856a5a4d5`, `gpt-image-2.5-flare`, `images`, `low`, `1024x1024`, `succeeded`, latência 9573 ms; resultado, download e painel de evidências inspecionados.
- **Task 3 — encerramento:** confirmação de produção intocada (`base..HEAD`), `48.2.2-UAT.md`, `48-2-2-VERIFICATION.md` completado, tracking atualizado e arquivamento OpenSpec **preparado** (não executado).

## Tasks

| Task | Name | Commit |
|---|---|---|
| 1 | Testes transversais (fronteira + concorrência) e gates | `66746cd0` |
| 2 | CHECKPOINT 3 — UAT local com geração real controlada | (encerramento) |
| 3 | Produção intocada + VERIFICATION/UAT + tracking | (encerramento) |

## Verification

- `npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm run build` → exit 0.
- `bench-boundary` + `bench-concurrency` → **2 arquivos / 20 testes verdes**.
- Suíte completa → `385 passed (386)` / `4200 passed | 1 skipped`; **1 falha externa** (F50 `legal-document-versions.test.ts`, `ENOENT`); `data-subject-requests.postgres.test.ts` flaky em full-run (passa isolada).
- `git diff --name-only $BASE..HEAD` dos caminhos produtivos → **vazio** (`BASE = 50ae6007…`).
- **Nenhuma chamada paga** em testes/CI; **uma** geração real controlada no UAT (autorizada).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extração do client gravador para helper compartilhado**
- **Found during:** Task 1
- **Issue:** `createRecordingClient`/`forbiddenProductionAccess` eram privados em `lab-isolation.contract.test.ts`; importar o arquivo de teste re-registraria seus `describe`.
- **Fix:** extraídos para `src/lib/lab/__tests__/recording-supabase-client.ts` e `lab-isolation.contract.test.ts` refatorado para importar (isolamento segue 17/17 verde).
- **Files modified:** `src/lib/lab/__tests__/recording-supabase-client.ts` (novo), `src/lib/lab/__tests__/lab-isolation.contract.test.ts`
- **Commit:** `66746cd0`

**2. [Rule 3 - Blocking] IDs do gravador em formato UUID**
- **Found during:** Task 1
- **Issue:** os builders de path da bancada exigem UUID no segmento `bench/{runId}/...`.
- **Fix:** ids gerados pelo gravador passaram a UUID; nenhum teste dependia do formato antigo.
- **Commit:** `66746cd0`

### Human-directed corrections (pós-checkpoint)

**3. Preparação do ambiente antes da autorização da geração**
- O humano exigiu preparar o ambiente local (Supabase, gate, bootstrap, loja+branding, manifesto, admin local, imagens de produto) **sem** invocar o provider antes de autorizar a geração. O login local exigiu corrigir colunas de token `NULL` (`confirmation_token`/`recovery_token`/`email_change_token_new`/`email_change`) em `auth.users` — o GoTrue exige `''` (causa do erro "usuário ou senha inválido"). Correção **apenas no Supabase local**; nenhuma alteração de código versionado.

## UAT (CHECKPOINT 3)

- **Run principal:** `f6148ea6-f59a-4732-bbbb-530856a5a4d5` — `succeeded`, `gpt-image-2.5-flare`, `images`, `low`, `1024x1024`, `1:1`, latência `9573 ms`.
- **Usage:** `totalTokens 1324` (`inputTextTokens 104`, `inputImageTokens 1024`, `outputImageTokens 196`).
- **Custo:** estimado US$ **0,00588** (pré-confirmação, `isEstimate: true`) e calculado US$ **0,014592** (`cost_source: bench_local_pricing`, rule `2026-09-bench-1`, `coverage: partial`); **reportado pelo provider `null`** (não é faturamento). A UI arredonda para 2 casas (US$ 0,01).
- **Classificação:** UAT **técnico APROVADO**; **qualidade criativa NÃO validada** (fixtures locais artificiais; resultado compatível com o prompt).
- Detalhes: `.planning/phases/48.2.2-fundacao-bancada-geracao/48.2.2-UAT.md`.

## Isolation

- `campaigns=0`, `campaign_art_versions=0`, `generation_events=0`, `ai_model_selection=0`; nenhum crédito consumido; nenhuma escrita em `admin_audit_log`.
- `base..HEAD` produtivo **vazio**; nenhum `supabase db push`; `supabase/migrations` sem alterações.
- **Achado não bloqueante:** `branding_snapshot` persiste URLs assinadas locais (tokens efêmeros, expirados) por desenho do schema — registrado como limitação; nenhuma URL assinada entrou em documentos/commits.

## Known Stubs

None — nenhum stub; a bancada opera de ponta a ponta.

## Self-Check: PASSED
