---
phase: 47-catalogo-e-selecao-de-modelos-admin
plan: 08
subsystem: release-and-verification
tags: [uat, remote-migration, deploy, env-cleanup, verification, phase-close]

requires:
  - phase: 47-catalogo-e-selecao-de-modelos-admin
    provides: 47-01..47-07 (migration local, serviços bulk, resolver, API, tela, pricing, labels) — gates locais verdes
provides:
  - ".planning/phases/47-catalogo-e-selecao-de-modelos-admin/47-UAT.md — UAT local executado e aprovado (sinal approved)"
  - ".planning/phases/47-catalogo-e-selecao-de-modelos-admin/47-VERIFICATION.md — verificação goal-backward (passed)"
  - "Migration remota aplicada e verificada; deploy de produção concluído; env-vars obsoletas removidas"
  - "Trackers atualizados (AGENTS/STATE/ROADMAP raiz/.planning/ROADMAP/PROJECT) + arquivamento OpenSpec preparado"
affects: []

tech-stack:
  added: []
  patterns:
    - "UAT local seguro: switch-env.ps1 local alinha flag do app + captcha do Auth; fixtures com snapshot/cleanup; cleanup completo por actor"
    - "Ordem bloqueante migration remota → deploy, em checkpoints separados (approved → authorize remote migration → authorize deploy → authorize env cleanup)"

key-files:
  created:
    - .planning/phases/47-catalogo-e-selecao-de-modelos-admin/47-UAT.md
    - .planning/phases/47-catalogo-e-selecao-de-modelos-admin/47-VERIFICATION.md
    - .planning/phases/47-catalogo-e-selecao-de-modelos-admin/47-08-SUMMARY.md
    - supabase/migrations/20260915000001_f47_fix_campaigns_authenticated_select.sql
    - scripts/uat/47-local-bootstrap.mjs
    - scripts/uat/47-local-fixtures.mjs
    - scripts/uat/47-local-dev.ps1
  modified:
    - switch-env.ps1
    - scripts/verify/47-01-f47-migration-verification.mjs
    - AGENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - ROADMAP.md
    - .planning/PROJECT.md

key-decisions:
  - "Ordem bloqueante honrada: UAT local aprovado → migration remota aplicada/verificada → deploy → cleanup de envs, cada um com autorização explícita."
  - "Deploy pelo runbook do repositório: merge fast-forward para main + push (Vercel Git integration)."
  - "Migration forward idempotente para restaurar SELECT de authenticated em campaigns (causa histórica 20260710000001)."
  - "Cleanup local completo (storage + loja/campanha/eventos + auditoria + admin + auth user) com asserções de resíduo; sem db reset como cleanup."
  - "Arquivamento OpenSpec preparado, não executado."

requirements: [ai-model-catalog, ai-model-selection, ai-model-registry, ai-model-pricing, admin-ai-model-selection]
requirements-completed: [ai-model-catalog, ai-model-selection, ai-model-registry, ai-model-pricing, admin-ai-model-selection]

completed: 2026-09-15
---

# Phase 47 Plan 08: UAT, Migration Remota, Deploy e Verificação Final — Summary

**F47 (Catálogo e Seleção de Modelos Admin, Change B) concluída — 8/8 plans, UAT local aprovado, migration remota aplicada/verificada, deploy de produção concluído e env-vars obsoletas removidas.**

## Performance

- **Tasks:** 5/5 (prep, UAT local, migration remota, deploy, tracking final)
- **Gates:** vitest 287 arquivos / 2782 testes; typecheck; lint; build; verifier 34/34; db reset; db lint 0 erros; OpenSpec strict; git diff --check

## Accomplishments

- **UAT local (Task 2):** executado no Supabase local com schema local. UAT-01..07 PASS, UAT-08 AUTOMATED PASS, UAT-09..12 PASS. Campanha local concluída (`brand_profile_text`/`campaign_copy` → openai/gpt-4o; `campaign_image` → openai/gpt-5.5; `campaign_image_review` → openai/gpt-4o). Aprovação humana registrada (sinal `approved`).
- **Migration remota (Task 3):** `npx supabase db push` aplicou `20260914000001/2/3` e `20260915000001`. Verificação remota somente-leitura: 12 seeds, 11 capacidades, RLS em catálogo/seleção/campaigns, RPCs presentes e validando motivo, `anon` negado, `authenticated` com SELECT em `campaigns`, CHECKs de fallback/distinção e auditoria.
- **Deploy (Task 4):** merge fast-forward `main` → `origin/main` (`2860115b..b892acb2`) pelo runbook; Vercel Production **Ready**; `https://vendeo-v3.vercel.app` HTTP 200; `/login` 200; `/admin/ai-model-selection` 302 → `/login` (deployada e protegida); `/api/admin/ai-model-selection` sem auth 401; logs sem falhas de configuração.
- **Env cleanup:** 11 env-vars obsoletas de modelo/provider removidas da Vercel (Production/Preview), após o deploy; chaves (`OPENAI_API_KEY`/`GEMINI_API_KEY`) e operacionais preservadas; nenhum redeploy disparado.
- **Tracking (Task 5):** `47-VERIFICATION.md` `passed`; AGENTS/STATE/ROADMAP raiz/.planning/ROADMAP/PROJECT atualizados; arquivamento OpenSpec preparado (não executado).

## Correções operacionais locais (descobertas no UAT)

1. **Alinhamento do captcha local** (`switch-env.ps1 local`): garante `feature_flags.captcha_enabled=true` no banco local (a flag tem precedência sobre `VENDEO_CAPTCHA_ENABLED`) além do captcha Turnstile de teste no Auth.
2. **Migration forward `campaigns`**: `GRANT SELECT ON TABLE public.campaigns TO authenticated` (a migration histórica `20260710000001` revogou sem reconceder), com verificação de RLS/policy/owner/non-owner/service_role integrada ao verificador.
3. **Cleanup completo do UAT local** (`47-local-bootstrap.mjs --cleanup`): storage + loja/campanha/eventos/correções + auditoria + admin + auth user, com triggers append-only suspensos localmente e asserções de ausência de resíduos.

## Gate Results

| Gate | Resultado |
|---|---|
| Vitest completo | PASS — 287 arquivos / 2782 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Verificador F47 local | PASS — 34/34 (inclui RLS/ownership de campaigns) |
| `npx supabase db reset` | PASS (migrations do zero, incl. `20260915000001`) |
| `npx supabase db lint --local` | PASS — 0 erros (1 warning pré-existente) |
| Frozen contract verifier | PASS — 51 paths / 0 violações |
| `openspec validate ... --strict` | PASS |
| UAT local humano | APPROVED |
| Migration remota | aplicada + verificada |
| Deploy produção | Ready; HTTP 200 |
| Env-vars obsoletas | 0 restantes |

## Task Commits (ciclo 47-08)

- `8fe0e453` — prepara UAT local seguro
- `3afdd8ec` — torna o UAT local seguro e reproduzível
- `977a0953` — alinha o ambiente local de UAT
- `cf9207d8` — hardening dos utilitários UAT
- `a62f26de` — preserva state quando o rollback falha
- `94663e8e` — migration forward SELECT campaigns + verificação RLS
- `ab64ed19` — alinhamento da flag de captcha local
- `5ba9c1f1` — cleanup completo do UAT local
- `f1b4de36` — evidências do UAT local
- `8f70686b` — status documental do UAT
- `03d9e53d` — aprovação do UAT local
- `502142e1` — verificação da migration remota
- `b892acb2` — pré-requisito de deploy satisfeito
- `b4cccace` — resultado do deploy de produção
- `ef0024db` — cleanup das env-vars da Vercel

## Files Created/Modified

- `47-UAT.md`, `47-VERIFICATION.md`, `47-08-SUMMARY.md`
- `switch-env.ps1`, `scripts/uat/47-local-bootstrap.mjs`, `scripts/uat/47-local-fixtures.mjs`, `scripts/uat/47-local-dev.ps1`
- `scripts/verify/47-01-f47-migration-verification.mjs`
- `supabase/migrations/20260915000001_f47_fix_campaigns_authenticated_select.sql`
- `AGENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `ROADMAP.md`, `.planning/PROJECT.md`

## User Setup Required / Next Actions

- Nenhuma migration pendente; schema remoto alinhado ao local.
- Envs remotas: 0 overrides de modelo/provider; chaves e operacionais presentes.
- Arquivamento OpenSpec preparado (executar somente com instrução explícita):
  `openspec archive fase-47-catalogo-e-selecao-de-modelos-admin --yes`
- Nenhuma ação remota adicional pendente.

## Self-Check

- [x] UAT local aprovado com evidência real
- [x] Migration remota aplicada e verificada antes do deploy
- [x] Deploy concluído após a migration, produção saudável
- [x] Env-vars obsoletas removidas sem reintroduzir overrides
- [x] 4 gates verdes + verifier 34/34 + OpenSpec strict
- [x] Trackers atualizados preservando o histórico F46
- [x] Arquivamento preparado (não executado)
