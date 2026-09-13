---
phase: 260913-qq6-remover-checkbox-obrigatoria-de-privacid
plan: "01"
subsystem: auth
tags: [signup, privacy, legal, modal, react, nextjs, openspec]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: signup form email/senha + PrivacyAcknowledgeModal + privacyPending/PrivacyRecovery flow
provides:
  - PrivacyAcknowledgeModal with discriminated-union props (mode?: "acknowledge" default | mode: "informative")
  - Signup form without mandatory privacy checkbox; microcopy with real anchors /termos and /privacidade opening an informative modal
  - signup/page.tsx resolving and passing both policyDocument and termsDocument
  - OpenSpec specs signup-page and privacy-acknowledgement synced to the new flow
affects: [signup-page, privacy-acknowledgement, privacy-gate, legal-status-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union component props for mutually exclusive modes (acknowledge vs informative)"
    - "Modifier-aware anchor interception: normal click opens modal, modifier-click/new-tab preserves href"

key-files:
  created:
    - src/components/legal/__tests__/privacy-acknowledge-modal.test.tsx
  modified:
    - src/components/legal/privacy-acknowledge-modal.tsx
    - src/components/auth/signup-form.tsx
    - src/components/auth/__tests__/signup-form.test.tsx
    - src/app/(auth)/signup/page.tsx
    - openspec/specs/signup-page/spec.md
    - openspec/specs/privacy-acknowledgement/spec.md

key-decisions:
  - "mode?: 'acknowledge' stays the default variant so PrivacyGate/legal-status-section need zero changes (backward-compatible)"
  - "Informative mode reuses the same modal for both documents; no separate 'read privacy policy' control"
  - "privacyPending still written on successful signUp with privacyAcknowledged: true + real communicationsOptIn (localStorage) — PrivacyRecovery contract untouched"
  - "Removed the now-unused local PrivacyPending interface (inlined inferred object) to satisfy the plan's privacyAcknowledged gate; stored JSON shape unchanged"

patterns-established:
  - "Informative legal modal: viewer + new-tab link + Fechar only, closing independent of document load success"
  - "Legal microcopy near submit: real href anchors whose normal click is intercepted to open the modal for that document"

requirements-completed: [QQ6-NO-MANDATORY-CHECKBOX, QQ6-INFORMATIVE-MODE, QQ6-BOTH-DOCS, QQ6-MANDATORY-DEFAULT-PRESERVED, QQ6-PRIVACY-PENDING-PRESERVED, QQ6-SPEC-SYNC]

# Metrics
duration: 7min
completed: 2026-09-13
---

# Quick Task 260913-qq6: Remover checkbox obrigatória de privacidade do signup — Summary

**Signup email/senha agora conclui sem checkbox de privacidade: microcopy ostensiva com links reais `/termos` e `/privacidade` abre um `PrivacyAcknowledgeModal mode="informative"` read-only, preservando o modo obrigatório default para `PrivacyGate`/`legal-status-section` e o fluxo `privacyPending` → `PrivacyRecovery`.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-09-13T22:33:24Z
- **Completed:** 2026-09-13T22:40:00Z
- **Tasks:** 3/3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- `PrivacyAcknowledgeModal` ganhou props em união discriminada: `mode?: "acknowledge"` (default, checkbox + "Confirmar ciência" gated pelo documento) × `mode: "informative"` (viewer + link nova aba + "Fechar", sem `onConfirm`). `privacy-gate.test.tsx` permaneceu verde sem edição.
- Checkbox obrigatório de ciência removido do `signup-form.tsx`; submit nunca é bloqueado por privacidade. Microcopy "Ao clicar em Criar conta, você concorda com os Termos de Uso e declara ciência da Política de Privacidade do Vendeo." com âncoras reais `/termos` e `/privacidade` interceptadas apenas no clique normal.
- `signup/page.tsx` resolve e repassa `policyDocument` (Privacidade) e `termsDocument` (Termos) de forma aditiva; `setPrivacyPending()` intacto (`{ privacyAcknowledged: true, communicationsOptIn }` em `localStorage`); opt-in de comunicações opcional e desmarcado.
- Specs OpenSpec `signup-page` e `privacy-acknowledgement` sincronizadas (zero cenários de bloqueio por checkbox; modal informativo + `localStorage["privacyPending"]`).

## Task Commits

1. **Task 1: Modo informativo/read-only no PrivacyAcknowledgeModal com default obrigatório preservado** — `ab965494` (feat)
2. **Task 2: Remover checkbox obrigatório do signup + microcopy com links interceptados + co-migração de testes** — `9d781e60` (feat)
3. **Task 3: Sincronizar as specs OpenSpec com o novo fluxo** — `b3c1fdd6` (docs)

**Plan metadata:** handled by the orchestrator (docs commit) — planning docs intentionally not committed by the executor.

## Files Created/Modified
- `src/components/legal/privacy-acknowledge-modal.tsx` — união discriminada de props; ramo informativo sem checkbox/confirmar.
- `src/components/legal/__tests__/privacy-acknowledge-modal.test.tsx` — novo: prova default obrigatório e modo informativo (incl. falha de documento).
- `src/components/auth/signup-form.tsx` — sem checkbox obrigatório; microcopy com links interceptados; modal informativo único; `termsDocument` prop; `setPrivacyPending()` inalterado.
- `src/components/auth/__tests__/signup-form.test.tsx` — co-migrado: sem `acknowledgePrivacy`, localStorage limpo, mock do modal capturando props, Teste 3a renomeado, testes a–g.
- `src/app/(auth)/signup/page.tsx` — resolve/passa `termsDocument` aditivamente.
- `openspec/specs/signup-page/spec.md` — cenários/requisitos alinhados (informative, localStorage).
- `openspec/specs/privacy-acknowledgement/spec.md` — requisito de signup alinhado ao modal informativo.

## Decisions Made
- Default variant preservada sem `mode` para manter `PrivacyGate`/`legal-status-section` type-safe e sem edição.
- Um único modal informativo reutilizado para Termos e Privacidade (documento ativo em estado), sem botão separado de leitura.
- `privacyPending` permanece a fonte de gatilho do `PrivacyRecovery` (localStorage), com `privacyAcknowledged: true` e opt-in real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removida a interface local `PrivacyPending` (objeto inline inferido)**
- **Found during:** Task 2 (verificação `privacyAcknowledged`)
- **Issue:** O gate de verificação do plano exige `privacyAcknowledged` = 0 excluindo apenas o literal `privacyAcknowledged: true`; a interface local `PrivacyPending { privacyAcknowledged: boolean; ... }` (documentada no plano) mantinha uma ocorrência não excluída.
- **Fix:** Interface não-exportada removida; `setPrivacyPending()` passou a construir o objeto com inferência (`{ privacyAcknowledged: true, communicationsOptIn }`). O JSON gravado em `localStorage["privacyPending"]` é idêntico.
- **Files modified:** `src/components/auth/signup-form.tsx`
- **Verification:** Gate PowerShell → 0; Testes b/c de `signup-form.test.tsx` provam o shape `{ privacyAcknowledged: true, communicationsOptIn }`.
- **Committed in:** `9d781e60` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Sem impacto funcional — contrato persistido e comportamento idênticos; ajuste necessário apenas para satisfazer o gate de verificação explícito do plano.

## Issues Encountered
- **Ambiente:** o shim `C:\Windows\System32\npm` está quebrado neste shell (produz saída vazia e não executa), fazendo `npm run lint`/`npm run build` parecerem "passar" sem rodar. Re-executados via `& "C:\Program Files\nodejs\npm.cmd" run ...` — lint exit 0 e build exit 0 (Next.js 15.5.18, 59 páginas, BUILD_ID atualizado). Nenhuma alteração de código decorrente.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fluxo de signup sem fricção de checkbox pronto para UAT humano (roteiro `<manual_uat>` do plano).
- `PrivacyGate` pós-OAuth continua obrigatório e intocado; `PrivacyRecovery` intocado.
- Nenhum blocker.

---
*Quick task: 260913-qq6-remover-checkbox-obrigatoria-de-privacid*
*Completed: 2026-09-13*

## Self-Check: PASSED

- All 7 files_modified exist (1 created + 6 modified).
- Task commits `ab965494`, `9d781e60`, `b3c1fdd6` present on `main`.
- Focused vitest: 34/34 passed (4 files). Typecheck: OK. Lint: OK (exit 0). Build: OK (exit 0).
