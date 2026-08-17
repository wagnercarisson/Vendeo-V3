---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 12
subsystem: database
tags: [legal, migration, d12, d13, supabase, db-push, blocking]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: Conteúdos Terms v1.4/Privacy v1.3 + catálogo (42-11)
provides:
  - Migration idempotente `20260817000001_publish_legal_signup_versions.sql` que publica Terms v1.4 + Privacy v1.3 em legal_document_versions (effective_at now()) — ON CONFLICT idempotente, sem DDL, REVERT presente
  - Paridade config.toml verificada (senha 8, confirmação on, turnstile, Google, manual_linking off) sem alteração destrutiva
  - Push [BLOCKING] DEFERIDO (aguardando SUPABASE_ACCESS_TOKEN)
affects: [42-18 (testes legal), 42-20 (UAT + push pendente)]

# Tech tracking
tech-stack:
  added: []
  patterns: [migration de publicação idempotente (ON CONFLICT document_type,version DO UPDATE) padrão 20260731000004; sem DDL em legal_acceptance (singular não existe)]

key-files:
  created: [supabase/migrations/20260817000001_publish_legal_signup_versions.sql]

key-decisions:
  - "Publicar Terms v1.4 (acesso público, cláusula 3.1 sem convidados, OAuth) e Privacy v1.3 (sem beta fechada, captcha/confirmação/OAuth) com effective_at now()"
  - "AUP v1.1 NÃO republicada; legal_acceptances/acceptance-service.ts intocados"
  - "Push [BLOCKING] DEFERIDO — token ausente; fica para UAT 42-20/fechamento"

patterns-established:
  - "Reaceite via fluxo F30 (getAcceptanceStatus → outdated → login_reacceptance) com tolerância técnica (nenhuma loja perde acesso na publicação)"

requirements-completed: ["legal-acceptance-service", "privacy-acknowledgement", "launch-config (Nova flag publicSignupEnabled)"]

# Metrics
duration: 15min
completed: 2026-08-17
---

# Phase 42 Plan 12: Migration — Publicação Terms v1.4 / Privacy v1.3

**Migration idempotente publica Terms v1.4 + Privacy v1.3 em legal_document_versions (effective_at now()) sem DDL; paridade config.toml verificada; push [BLOCKING] DEFERIDO por ausência de SUPABASE_ACCESS_TOKEN**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-17T23:45:00Z
- **Completed:** 2026-08-17T00:00:00Z
- **Tasks:** 3 (Task 3 deferida)
- **Files modified:** 1

## Accomplishments
- **Task 1:** Migration `20260817000001_publish_legal_signup_versions.sql` criada — INSERT INTO `public.legal_document_versions` para `terms_of_service` v1.4 e `privacy_policy` v1.3 com summaries dos ajustes D12; `ON CONFLICT (document_type, version) DO UPDATE` (idempotente); `effective_at = now()` com NOTA para reaceite pré-go-live; bloco `-- REVERT` com DELETE condicional; ZERO DDL/DROP/ALTER (verificado por grep). `legal_acceptances`/`acceptance-service.ts` intocados.
- **Task 2:** Paridade `supabase/config.toml` verificada: `enable_signup = true` (email L176), `enable_manual_linking = false` (L180), `minimum_password_length = 8` (L182), turnstile (L216), `enable_confirmations = true` (L227 email), `[auth.external.google]` (L343) com env-substitution. Sem alteração destrutiva.
- **Task 3 [DEFERIDA]:** `supabase db push` não executado — `SUPABASE_ACCESS_TOKEN` ausente (nem env, nem .env.local, nem credencial). Projeto linkado (`gvbzwihwgzujwsviufgy`). **Deferido por decisão do usuário** — pendente para UAT 42-20/fechamento.

## Task Commits

1. **Task 1: Migration de publicação v1.4/v1.3** - `36d9ccc` (feat)

## Files Created/Modified
- `supabase/migrations/20260817000001_publish_legal_signup_versions.sql` - Migration idempotente de publicação

## Decisions Made
- Deferir o push [BLOCKING] por decisão do usuário (token ausente); documentar como ação pendente crítica para o fechamento.

## Deviations from Plan

**Task 3 DEFERIDA** (não executada): push do Supabase requer `SUPABASE_ACCESS_TOKEN` que não está disponível no ambiente. Ação pendente registrada — não é falha de implementação, mas requer intervenção manual antes do fechamento.

## Issues Encountered
- `SUPABASE_ACCESS_TOKEN` não encontrado (env, .env.local, credencial). Verificado via `supabase projects list` → "Access token not provided".

## User Setup Required
- **CRÍTICO — push pendente [BLOCKING]:** fornecer `SUPABASE_ACCESS_TOKEN` (Supabase Dashboard → Account → Access Tokens) e rodar `npx supabase db push` para aplicar a migration `20260817000001_publish_legal_signup_versions` no remoto. Validar com `supabase migration list` e `supabase db push --dry-run` → "No new migrations".
- Configurar env vars do Google/Turnstile (Dashboard) para UAT.

## Next Phase Readiness
- Migration pronta para push; 42-18 testa legal/transição (Testes 54-58) — verificar se dependem do push; 42-20 UAT (coordenação PrivacyGate, Turnstile, identity linking) + push pendente.

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*