---
phase: quick-260808-rqw
plan: 01
subsystem: landing, auth, admin, database, api
tags: [landing-page, supabase, rls, plpgsql, rpc, zod, anti-enumeration, beta-gate]

# Dependency graph
requires:
  - phase: 30-legal-foundation
    provides: admin_audit_log, requireAdmin, labels.ts, public pages /termos /privacidade /uso-aceitavel
  - phase: 38-credit-operation-costs
    provides: padrão de RPC atômico SECURITY DEFINER + GRANT service_role, testes de rota/página admin
provides:
  - Landing pública em / com formulário de solicitação de acesso (access_requests)
  - POST /api/access-requests (zod + anti-duplicidade + anti-enumeração)
  - /signup neutralizado (tela beta fechado, sem cadastro aberto)
  - Fix pós-login: router.replace(redirect || "/dashboard")
  - Admin /admin/access-requests com aprovação/recusa via RPC atômico + trilha em admin_audit_log
  - Doc SUPABASE-CLOSED-BETA.md (operação manual: desabilitar signup / allowlist hook)
affects: [f39-stripe, beta launch, domain migration vendeo.tech]

# Tech tracking
tech-stack:
  added: [RPC plpgsql admin_review_access_request, índice único parcial lower(email)]
  patterns: [anti-enumeração por resposta idêntica, RPC atômico status+audit em 1 transação, escrita service_role-only via RLS]

key-files:
  created:
    - supabase/migrations/20260808010000_create_access_requests.sql
    - src/app/api/access-requests/route.ts
    - src/components/landing/access-request-form.tsx
    - src/app/(app)/admin/access-requests/page.tsx
    - src/app/api/admin/access-requests/[id]/route.ts
    - src/components/admin/access-request-actions.tsx
    - src/__tests__/app/landing-page.test.tsx
    - src/__tests__/auth/signup-page.test.tsx
    - .planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md
  modified:
    - src/app/page.tsx
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/login/login-form.tsx
    - next.config.ts
    - src/lib/admin/labels.ts
    - src/app/(app)/admin/layout.tsx
    - src/__tests__/next.config.test.ts
    - src/__tests__/auth/login-form.test.tsx

key-decisions:
  - "POST /api/access-requests retorna { ok: true } 200 idêntico para novo e duplicado (anti-enumeração); 400 genérico sem detalhar campo"
  - "Mudança de status admin via RPC admin_review_access_request (status + admin_audit_log na MESMA transação); a rota não faz insert direto em admin_audit_log"
  - "Testes de rota usam apiHandler real (não mockado) para mapeamento ForbiddenError → 403, consistente com operation-costs"
  - "Migration 20260808010000 não colide com a última mergeada (20260807000001_f38)"
  - "Indice único parcial lower(email) WHERE status IN (pending, approved) permite re-solicitação após rejected"

patterns-established:
  - "Anti-enumeração: mesma resposta para sucesso/duplicado + 400 genérico em validação pública"
  - "RPC SECURITY DEFINER com SET search_path = '' e GRANT service_role-only (padrão F38)"
  - "Escrita em access_requests apenas via supabaseAdmin; RLS policy exclusiva para service_role"

requirements-completed: [ACC-01, ACC-02, ACC-03, ACC-04, ACC-05, ACC-06, ACC-07, ACC-08]

# Metrics
duration: 30min
completed: 2026-08-08
---

# Quick 260808-rqw: Landing pública + acesso fechado beta Summary

**Landing pública `/` com solicitação de acesso free persistida em `access_requests` (RLS service_role-only + índice anti-duplicidade lower(email)), `/signup` neutralizado como tela de beta fechado, fix pós-login para `/dashboard`, e admin `/admin/access-requests` com aprovação/recusa via RPC atômico que registra trilha em `admin_audit_log` na mesma transação**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-08T20:53:00Z
- **Completed:** 2026-08-08T21:22:00Z
- **Tasks:** 3/3 (sem checkpoints — plano autônomo)
- **Files modified:** 22 code files (3 deletes) + 1 doc artifact (SUPABASE-CLOSED-BETA.md)

## Accomplishments

- Migration `20260808010000_create_access_requests.sql`: tabela `access_requests` (status pending|approved|rejected, source, review fields), RLS policy service_role-only + GRANTs, índice único parcial `lower(email)` anti-duplicidade, RPC atômico `admin_review_access_request` (UPDATE status + INSERT `admin_audit_log` na mesma transação), CHECKs do `admin_audit_log` estendidos (`access_request_approve`/`access_request_reject` em action; `access_request` em target_type), bloco REVERT completo.
- `POST /api/access-requests` público: ordem `requireSameOrigin → zod parse → dedupe → insert`; resposta anti-enumeração idêntica `{ ok: true }` 200 para novo e duplicado; 400 genérico `{ error: "Dados inválidos" }`; 500 genérico em falha de DB.
- Landing `/` (server component estático, `metadata` própria): header wordmark + "Entrar", hero "Campanhas profissionais para lojas físicas", selo de beta fechado, CTA "Solicitar acesso free" (âncora `#acesso`) + "Entrar", formulário com `AccessRequestForm` (client, `Input`/`Button` de `@/components/ui`, 13 segmentos de `STORE_SEGMENTS`), footer com `/termos`, `/privacidade`, `/uso-aceitavel`, `/login`.
- `/signup` → tela estática "Beta fechado" (sem client form, sem `supabase.auth.signUp`); `signup-form.tsx` + `signup-form.test.tsx` deletados.
- Fix crítico pós-login: `router.replace(redirect || "/dashboard")` (era `"/"`); bloco final do login trocado para "Ainda não tem acesso? **Solicitar acesso free**" → `/`.
- `next.config.ts`: redirect 301 `/` → `/dashboard` removido (4 restantes); `/` e `/signup` compilam como **estáticos** no build.
- Admin: `POST /api/admin/access-requests/[id]` chama o RPC atômico via `supabaseAdmin.rpc` (zod valida `approve|reject` antes; `request_not_found`/`already_reviewed` → 404; sem insert direto em `admin_audit_log`); página `/admin/access-requests` (tabs pending/approved/rejected, paginação 20/página, Badge de status, `EmptyState`, `AccessRequestActions` client); labels (`access_request_approve`/`access_request_reject`/`access_request`) e nav do layout admin; doc `SUPABASE-CLOSED-BETA.md` com opção A (desabilitar "Allow new users to sign up") e opção B (Before User Created Hook allowlist).

## Task Commits

1. **Task 1: Backend — migration + POST /api/access-requests** - `b6f7cb8` (feat)
2. **Task 2: Frontend — landing, signup fechado, login, redirect removido** - `4e80c12` (feat)
3. **Task 3: Admin — /admin/access-requests + RPC + labels + nav + doc** - `8aa31e4` (feat)

## Files Created/Modified

- `supabase/migrations/20260808010000_create_access_requests.sql` - Tabela + RLS/GRANTs + índice único parcial + RPC atômico + CHECKs estendidos + REVERT
- `src/app/api/access-requests/route.ts` - POST público com zod, anti-duplicidade e anti-enumeração
- `src/app/api/access-requests/__tests__/route.test.ts` - 7 testes (novo, duplicado, inválido, DB error, 403 origin, lowercase)
- `src/app/page.tsx` - Landing pública estática (era redirect)
- `src/components/landing/access-request-form.tsx` - Form client (email, loja, segmento, whatsapp)
- `src/app/(auth)/signup/page.tsx` - Tela beta fechado
- `src/app/(auth)/login/login-form.tsx` - Fix `/dashboard` default + link "Solicitar acesso free"
- `next.config.ts` - Redirect 301 `/` removido
- `src/app/api/admin/access-requests/[id]/route.ts` - POST admin via RPC atômico
- `src/components/admin/access-request-actions.tsx` - Aprovar/Recusar (client)
- `src/app/(app)/admin/access-requests/page.tsx` - Listagem admin com tabs/paginação
- `src/lib/admin/labels.ts` - Labels de auditoria novos
- `src/app/(app)/admin/layout.tsx` - Nav "Solicitações de acesso"
- Testes: `landing-page.test.tsx`, `signup-page.test.tsx` (novos), `login-form.test.tsx`, `next.config.test.ts` (atualizados), `signup-form.test.tsx` (deletado)
- `.planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md` - Doc de fechamento real do Supabase Auth

## Decisions Made

- Seguido o plano integralmente (filenames, GRANTs, índice parcial, respostas anti-enumeração, RPC atômico, fix `/dashboard`).
- Testes de rota com `apiHandler` real (não mockado) para exercitar o mapeamento `ForbiddenError → 403` — consistente com `operation-costs/__tests__/route.test.ts`.
- Segmentos do form vindos de `STORE_SEGMENTS` (`@/lib/constants` — mesmos 13 valores da migration `20260611000001`) com opção vazia "Prefiro não informar".
- Badge de status na página admin via mapa `STATUS_BADGE_CLASSES` (amber/green/red) + `getLabel`.
- Migration renumerada para `20260808010000` — posterior à última mergeada (`20260807000001_f38`); sem colisão.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dependências do projeto ausentes no checkout**
- **Found during:** Task 1 (verificação do teste)
- **Issue:** `node_modules` não existia (gitignored, checkout fresco); `npx vitest` usava cache externo e falhava em `vitest/config`; `npm run lint`/`build` impossíveis.
- **Fix:** `npm ci --no-audit --no-fund` (dependências do próprio `package-lock.json` do projeto — não é instalação de pacote novo por nome).
- **Verification:** teste da task 1 verde após `npm ci`.
- **Committed in:** n/a (nenhum arquivo do repo alterado — `package-lock.json` inalterado).

**2. [Rule 1 - Bug] Mock de `apiHandler` quebrava mapeamento 403**
- **Found during:** Task 1 (teste 403 da rota pública)
- **Issue:** Teste mockava `apiHandler` como pass-through, então o `ForbiddenError` lançado pelo `requireSameOrigin` não era convertido em 403.
- **Fix:** Removido o mock de `apiHandler` (usa o real, que mapeia `ForbiddenError → 403`), como em `operation-costs/__tests__/route.test.ts`.
- **Files modified:** `src/app/api/access-requests/__tests__/route.test.ts`
- **Committed in:** `b6f7cb8` (parte do commit da task 1)

**3. [Rule 1 - Bug] Import do route em `[id]` com caminho errado no teste admin**
- **Found during:** Task 3 (8 testes falhando com "Cannot find module")
- **Issue:** Teste importava `../route` mas a rota vive em `../[id]/route`.
- **Fix:** `import("../[id]/route")`.
- **Files modified:** `src/app/api/admin/access-requests/__tests__/route.test.ts`
- **Committed in:** `8aa31e4` (parte do commit da task 3)

**4. [Rule 3 - Blocking] Build gate exigia env vars do Supabase (ausentes no checkout)**
- **Found during:** Verificação final (`npm run build`)
- **Issue:** `src/lib/supabase/server.ts` lança em import-time sem `NEXT_PUBLIC_SUPABASE_URL`; o checkout não tem `.env.local` (gitignored). O mesmo afeta o teste de integração real-DB do F38.
- **Fix:** Criado `.env.local` local temporário com placeholders para rodar o build gate (valida eval de módulo de TODAS as rotas/páginas, incl. as novas: `/` estática, `/api/access-requests`, `/admin/access-requests`), e **removido após o build** para restaurar o estado do checkout. Nenhuma credencial fabricada permaneceu.
- **Verification:** build passou (52 rotas, `/` e `/signup` estáticos); `.env.local` removido (Test-Path → False).
- **Committed in:** n/a (nada commitado)

---

**Total deviations:** 4 auto-fixed (3 Rule 1/3 em testes/ambiente + 1 bloqueio de ambiente)
**Impact on plan:** Todas necessárias para concluir as verificações. Nenhuma mudança de escopo; nenhum código adicional além do plano.

## Issues Encountered

- **Integração real-DB do F38 falha sem `.env.local`** (`src/lib/credit/__tests__/operation-cost-service.integration.test.ts`): pré-existente e ambiental — importa `operation-cost-service.ts` → `server.ts` que lança sem `NEXT_PUBLIC_SUPABASE_URL`. Fora de escopo (arquivo não tocado pela task); logado em `deferred-items.md`. Suite completa: **1622 passed, 2 skipped** (191/192 arquivos verdes; o 1 falho é esse pré-existente).
- `.env.example` do projeto não documenta as 3 vars do Supabase — sugerido adicionar como follow-up (registrado em `deferred-items.md`).

## User Setup Required

- Aplicar a migration `20260808010000_create_access_requests.sql` no Supabase (migrations locais).
- Operação manual de fechamento real do Auth: ver `.planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md` (desabilitar "Allow new users to sign up" OU Before User Created Hook allowlist) + fluxo manual de convite (criar usuário via admin quando aprovado).
- `.env.local` real (Supabase URL/keys) necessário localmente para `next build` e testes de integração.

## Next Phase Readiness

- Beta fechado operacional: landing coleta interessados, admin aprova/recusa com trilha de auditoria, login direciona para `/dashboard`, signup visualmente fechado.
- Pronto para: F39 (Stripe/monetização), migração de domínio beta.vendeo.tech → vendeo.tech, e envio real de convites (fora do escopo desta quick).
- **Blocker operacional (não de código):** fechamento real do Supabase Auth é manual (documentado em SUPABASE-CLOSED-BETA.md).

---
*Phase: quick-260808-rqw*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FILES: 19/19 created files present (incl. SUMMARY + SUPABASE-CLOSED-BETA.md); 2 planned deletions absent.
- COMMITS: `b6f7cb8` (T1), `4e80c12` (T2), `8aa31e4` (T3) all found in `git log`.
- VALIDATION: typecheck clean, lint clean, vitest 1622 passed / 2 skipped (1 suite pré-existente real-DB sem `.env.local` — deferred), `next build` OK (52 rotas; `/` e `/signup` estáticos).

