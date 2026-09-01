---
phase: quick-appshell-viewport-scroll
plan: 01
subsystem: ui
tags: [tailwind, nextjs, viewport, app-shell, mobile, dvh, sticky, overflow]

# Dependency graph
requires: []
provides:
  - "AppShell com scroll no documento (main sem overflow-auto) + wrapper min-h-dvh (viewport dinâmica mobile)"
  - "Sidebar desktop sticky top-0 h-dvh com scroll próprio + topbar sticky top-0 z-30"
  - "Guards flex min-w-0/min-h-0 (anti overflow horizontal) + viewport export explícito (width/initialScale/themeColor)"
affects: [mobile-hardening, uat-mobile, routes-campanhas-nova, rota-loja]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scroll no documento: wrapper min-h-dvh + main sem overflow-auto (nunca scroll aninhado)"
    - "Elementos persistentes via sticky top-0 + z-layering (topbar z-30 < drawer z-40 < modais z-50)"

key-files:
  created:
    - src/__tests__/app/layout-viewport.test.ts
  modified:
    - src/components/shell/app-shell.tsx
    - src/components/shell/topbar.tsx
    - src/components/flow/store-identity-form.tsx
    - src/app/layout.tsx
    - src/__tests__/components/shell/app-shell.test.tsx

key-decisions:
  - "D-A: wrapper h-screen -> min-h-dvh (dvh segue a viewport dinâmica do mobile, sem corte com a barra do browser)"
  - "D-B/D-C: main sem overflow-auto + min-w-0 (documento rola; coluna central mantém min-h-0 e ganha min-w-0)"
  - "D-D: aside sticky top-0 h-dvh com overflow-y-auto (sidebar fixa com rolagem própria)"
  - "D-E: topbar sticky top-0 z-30 (ações sempre acessíveis; layering abaixo do drawer z-40 e modais z-50)"
  - "D-F: viewport export explícito width=device-width + initialScale 1 (hardening defensivo, sem maximumScale)"
  - "D-I: co-migração lg:sticky lg:top-8 -> lg:top-20 no painel legal do onboarding (evita esconder sob a topbar sticky)"
  - "D-G/D-H: globals.css e sidebar-drawer.tsx sem mudança (fora de escopo)"

patterns-established:
  - "Scroll global no AppShell: wrapper min-h-dvh + main flex-1 sem overflow próprio"
  - "Persistência de chrome via sticky top-0 (sidebar/topbar) com h-dvh + overflow-y-auto para scroll interno"
  - "Teste localizado de classe: slice do html ao redor do marcador antes do assert not.toContain"

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-08-20
---

# Quick 260820-qpk: AppShell Viewport, Scroll e Overflow Mobile — Summary

**Scroll do documento no lugar do scroll aninhado do `<main>`: wrapper `min-h-dvh`, sidebar `sticky top-0 h-dvh`, topbar `sticky top-0 z-30`, guards `min-w-0`/`min-h-0` e viewport export explícito (`width=device-width`, `initialScale 1`, `themeColor`) — 6 arquivos, 2 commits, 4 gates verdes**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-20T21:50:00Z (aprox.)
- **Completed:** 2026-08-20T22:08:00Z (aprox.)
- **Tasks:** 2 de 3 (Task 3 = checkpoint humano PENDENTE)
- **Files modified:** 6 (4 produção + 2 testes)

## Accomplishments

- **Causa raiz A corrigida** — o `<main>` não rola mais internamente (`overflow-auto` removido); a barra de rolagem do navegador cobre a página inteira. Wrapper `h-screen` → `min-h-dvh` (Causa raiz B): viewport dinâmica no mobile, sem corte inferior nem "zoom out".
- **Chrome persistente** — sidebar desktop `sticky top-0 h-dvh` (fixa, scroll próprio via `overflow-y-auto` mantido) e topbar `sticky top-0 z-30` (visível ao rolar; `z-30` fica abaixo do drawer `z-40` e modais `z-50`).
- **Anti overflow horizontal** — coluna central `min-h-0 min-w-0 flex-1` (min-h-0 mantido por decisão do usuário) e `<main>` com `min-w-0`; defensas flex contra conteúdo largo (tabelas/textos longos) em 320/375px.
- **Co-migração D-I** — painel legal do onboarding (`store-identity-form.tsx` linha 2443): `lg:sticky lg:top-8` → `lg:top-20`, preservando a posição visual atual (~88px da viewport) sob a nova topbar sticky (regressão evitada na rota `/loja`).
- **Viewport hardening D-F** — export explícito `width: "device-width"`, `initialScale: 1`, `themeColor: "#0F172A"` (Next 15.3.1 já mescla defaults; export auto-documenta o contrato). Sem `maximumScale`/bloqueio de zoom (acessibilidade).
- **RED→GREEN demonstrado** — teste D (contrato viewport) criado antes da Task 1 e rodado em RED (`expected undefined to be 'device-width'`), depois GREEN após a Task 1.
- **Regressão completa verde** — 245 arquivos / 2264 testes passando; typecheck, lint e build (opcional/não-bloqueador) limpos.

## Task Commits

Cada task foi commitada atomicamente (apenas código de produção / apenas testes):

1. **Task 1: Mudanças de layout do AppShell (produção)** — `e331e0ca` (feat)
2. **Task 2: Testes do layout + contrato viewport + regressão** — `537610e6` (test)

**Plan metadata:** commit de docs feito pelo orquestrador (fora do escopo deste executor).

## Files Created/Modified

- `src/components/shell/app-shell.tsx` — wrapper `flex min-h-dvh`; aside `sticky top-0 hidden h-dvh w-56 flex-shrink-0 overflow-y-auto ...`; coluna `flex min-h-0 min-w-0 flex-1 flex-col`; main `min-w-0 flex-1 px-4 py-6 sm:px-6` (overflow-auto removido)
- `src/components/shell/topbar.tsx` — header `sticky top-0 z-30 flex h-14 ...`
- `src/components/flow/store-identity-form.tsx` — linha 2443 `lg:sticky lg:top-8` → `lg:sticky lg:top-20` (co-migração D-I; única alteração neste arquivo)
- `src/app/layout.tsx` — viewport export: `width: "device-width"`, `initialScale: 1`, `themeColor: "#0F172A"`
- `src/__tests__/components/shell/app-shell.test.tsx` — 3 testes existentes intactos + 3 novos (Teste A wrapper min-h-dvh / sem h-screen; Teste B localizado: snippet do `<main>` ao redor de `px-4 py-6 sm:px-6` sem `overflow-auto`; Teste C: aside sticky + h-dvh + overflow-y-auto, topbar sticky top-0 z-30, min-w-0 e min-h-0 min-w-0)
- `src/__tests__/app/layout-viewport.test.ts` (NOVO, `@vitest-environment node`) — contrato do export viewport (width/initialScale/themeColor)

## Decisions Made

- Execução na ordem recomendada: teste D criado primeiro → RED → Task 1 → GREEN (RED→GREEN demonstrado, sem necessidade de git stash).
- Build rodado (gate 4 não-bloqueador) — compilou com sucesso em 14.8s.
- Nenhum arquivo fora do escopo do plano tocado (globals.css e sidebar-drawer.tsx intactos — D-G/D-H; sem `maximumScale`).

## Deviations from Plan

None — plan executed exactly as written. As 6 revisões do usuário (min-h-0 mantido, teste main localizado, build não-bloqueador, verificação manual obrigatória em /loja, topbar sticky, viewport hardening) já estavam incorporadas ao plano aprovado e foram seguidas.

**Total deviations:** 0
**Impact on plan:** N/A

## Issues Encountered

- PowerShell 5.1 não executa `npm` em pipeline (shim `.ps1`) — resolvido usando `npm.cmd` para typecheck/lint/build. Nenhum impacto no código.

## ⚠️ Task 3 PENDENTE — Checkpoint humano (BLOCKING)

**A Task 3 (verificação manual desktop + mobile) NÃO foi executada** — checkpoint humano bloqueante, conforme instrução do executor. Pendente de aprovação humana:

1. Desktop (≥1024px): `/dashboard` e `/campanhas/nova` — barra de rolagem do navegador cobre a página INTEIRA; sidebar fixa com scroll próprio; topbar visível ao rolar.
2. Mobile 375px e 320px: sem corte inferior e sem "tirar o zoom"; topbar visível; drawer (hamburger) congela o fundo e restaura o scroll ao fechar.
3. Rotas `/campanhas/nova` e `/loja` em 320/375px: SEM scroll horizontal; **painel legal do onboarding (`/loja`) visível ao rolar, não escondido sob a topbar** (verificação OBRIGATÓRIA para a co-migração `top-20`).
4. Comparação visual pré/pós: nada além do esperado mudou.

**Resume signal:** "approved" (ou descrever o que quebrou para correção).

## ✅ Task 3 — Checkpoint humano APROVADO (2026-08-20)

O usuário aprovou a verificação manual: desktop (`/dashboard`, `/campanhas/nova`) com barra de rolagem da página inteira + sidebar/topbar sticky; mobile 375/320px sem corte inferior nem "tirar o zoom", drawer congela o fundo; `/loja` com painel legal visível (não escondido sob a topbar — co-migração `top-20` validada); ausência de scroll horizontal. Quick **fechado**.

## Verification (gates)

| Gate | Comando | Resultado |
|------|---------|-----------|
| 1. Testes focados | `npx vitest run src/__tests__/components/shell/app-shell.test.tsx src/__tests__/app/layout-viewport.test.ts` | ✅ 7/7 (2 files) |
| 1b. Regressão completa | `npm test` | ✅ 245 files / 2264 tests |
| 2. Typecheck | `npm run typecheck` | ✅ limpo |
| 3. Lint | `npm run lint` | ✅ limpo |
| 4. Build (não-bloqueador) | `npm run build` | ✅ Compiled successfully in 14.8s |

**RED→GREEN:** Teste D (viewport) falhou antes da Task 1 (`AssertionError: expected undefined to be 'device-width'`) e passou após. Testes A/B/C passam após a Task 1 (código aplicado antes dos testes, ordem natural); o RED do contrato de layout foi demonstrado pelo teste D.

## Known Stubs

Nenhum — mudanças puramente de classes Tailwind + export viewport; nenhum dado/placeholder novo.

## Threat Flags

Nenhuma superfície nova: quick altera apenas CSS/layout client-side (classes Tailwind + export viewport). Nenhuma rota, handler, store ou dado atravessa fronteira de confiança. Threat register T-QPK-01 (Tampering, accept) e T-QPK-SC (npm installs, accept — nenhum pacote instalado) conforme plano.

## Next Phase Readiness

- AppShell pronto para verificação manual (Task 3 pendente). Após aprovação: fechar o quick.
- Se overflow horizontal residual confirmado em 320px → quick separado: topbar right cluster (`min-w-0`/`shrink`), sem `overflow-x: hidden` global (P4).
- Se o usuário quiser atacar o mesmo sintoma fora do shell (landing `/`, auth) → quick futuro `min-h-screen` → `min-h-dvh` (D-K).

---
*Phase: quick-appshell-viewport-scroll*
*Completed: 2026-08-20 (Tasks 1-3 — UAT manual aprovado)*

## Self-Check: PASSED

- FOUND: `src/components/shell/app-shell.tsx`
- FOUND: `src/__tests__/app/layout-viewport.test.ts`
- FOUND: `.planning/quick/260820-qpk-planeje-o-quick-appshell-viewport-scroll/260820-qpk-SUMMARY.md`
- FOUND: commit `e331e0ca` (Task 1 — feat)
- FOUND: commit `537610e6` (Task 2 — test)