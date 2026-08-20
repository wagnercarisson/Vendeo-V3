---
phase: 260820-r4r
plan: 01
subsystem: ui
tags: [landing, oauth-verification, marketing-copy, nextjs, server-components]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: publicSignupEnabled flag + CTA branches flag on/off na landing
provides:
  - "Homepage pública com H1 'Vendeo' + slogan 'Postou, vendeo!' + frase de funcionalidade"
  - "Seções server components 'O Vendeo pode criar' (4 capacidades) e 'Como funciona' (4 passos)"
  - "Rodapé com links visíveis: Política de Privacidade, Termos de Uso, Contato (mailto)"
  - "Testes de landing travando marca, slogan secundário, funcionalidade, seções e links legais"
affects: [fase-43-google-oauth-verification, revisao-app-oauth-google]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server components estáticos de conteúdo público (sem 'use client', sem estado)"
    - "mailto: com process.env.SUPPORT_EMAIL ?? fallback (padrão conta/page.tsx)"
    - "Slogan como <p> secundário fora do <h1> (nunca nome principal)"

key-files:
  created:
    - src/components/landing/how-it-works-section.tsx
    - src/components/landing/what-vendeo-creates-section.tsx
  modified:
    - src/components/landing/access-request-section.tsx
    - src/app/page.tsx
    - src/__tests__/app/landing-page.test.tsx

key-decisions:
  - "H1 'Vendeo' mantém classes font-heading existentes; slogan 'Postou, vendeo!' como <p> italic accent-green, nunca dentro do h1"
  - "Frase de funcionalidade explícita com categoria (marketing), público (lojistas) e tecnologia (inteligência artificial comercial)"
  - "Seções 'O Vendeo pode criar' e 'Como funciona' como server components estáticos sem estado"
  - "Contato via mailto:${SUPPORT_EMAIL ?? 'suporte@vendeo.tech'} (sem rota /contato nova — decisão registrada no plano)"
  - "CTA: 'chamada para ação para orientar o próximo passo do cliente' — SEM 'link de venda'"

patterns-established:
  - "Pattern: conteúdo público estático da landing como server components nomeados *-section.tsx em src/components/landing/"

requirements-completed: [R4R-LANDING]

# Metrics
duration: 5min
completed: 2026-08-20
---

# Quick 260820-r4r: Alinhar homepage pública do Vendeo aos requisitos de verificação OAuth do Google

**Homepage pública rebranded: H1 "Vendeo" + slogan "Postou, vendeo!" (secundário) + frase de funcionalidade com IA comercial, duas novas seções server components ("O Vendeo pode criar" e "Como funciona"), rodapé com links legais e Contato mailto — 4 gates verdes (2272 testes)**

## Performance

- **Duration:** ~5 min (Tarefas 1-2)
- **Started:** 2026-08-20T19:44:37Z
- **Completed:** 2026-08-20T19:49:13Z
- **Tasks:** 2/3 executadas (Task 3 = UAT humano, pendente)
- **Files modified:** 5

## Accomplishments
- Hero da landing rebranded: H1 exatamente "Vendeo" (level 1) + slogan "Postou, vendeo!" como linha secundária italic accent-green abaixo do H1 (nunca dentro do h1, nunca como heading) + frase de funcionalidade "O Vendeo é uma plataforma de marketing para pequenos e médios lojistas..." com "inteligência artificial comercial" destacada
- Seção "O Vendeo pode criar" (server component, aria-labelledby) com as 4 capacidades: Arte promocional, Texto e chamada, Legenda para redes sociais, CTA ("chamada para ação para orientar o próximo passo do cliente")
- Seção "Como funciona" (server component, aria-labelledby) com os 4 passos: Cadastre sua loja → Informe sua oferta → O Vendeo cria a campanha → Revise e publique
- Rodapé: "Termos" → "Termos de Uso", "Privacidade" → "Política de Privacidade", novo link "Contato" com `mailto:${process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech"}` (padrão conta/page.tsx); Uso Aceitável, Novidades e Entrar mantidos
- Branches CTA flag on/off (GoogleButton/Continuar com email/Leva 2 minutos vs badge beta/Solicitar acesso free/Entrar) preservados byte a byte + atributo `data-public-signup-enabled` mantido
- Testes atualizados + 9 novos testes de landing (H1 exato sem slogan, slogan não-heading, funcionalidade, "O Vendeo pode criar", "Como funciona", links legais, Contato mailto) — 19 testes no arquivo, todos passando

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Rebrand da landing (H1 + slogan + funcionalidade + seções + rodapé)** - `4aa7807f` (feat)
2. **Task 2: Testes de landing + 4 gates** - `c93f9aa0` (test)

**Task 3 (UAT humano): PENDENTE** — executada pelo humano fora deste executor.

## Files Created/Modified
- `src/components/landing/access-request-section.tsx` - Hero rebranded (H1 "Vendeo", slogan, frase de funcionalidade); CTA branches flag on/off e `data-public-signup-enabled` intactos
- `src/components/landing/how-it-works-section.tsx` - NOVO: seção "Como funciona" com 4 passos (server component)
- `src/components/landing/what-vendeo-creates-section.tsx` - NOVO: seção "O Vendeo pode criar" com 4 capacidades (server component)
- `src/app/page.tsx` - Renderiza WhatVendeoCreatesSection + HowItWorksSection entre AccessRequestSection e footer; rodapé com Termos de Uso, Política de Privacidade e Contato mailto
- `src/__tests__/app/landing-page.test.tsx` - Teste do H1 atualizado + 9 novos testes (marca, slogan secundário, funcionalidade, seções, links legais, Contato)

## Gate Results (4 gates — Task 2)

| Gate | Result |
|------|--------|
| `npm test` | ✅ 2272 passed (245 files) |
| `npm run typecheck` | ✅ Clean |
| `npm run lint` | ✅ Clean |
| `npm run build` | ✅ Clean (rota `/` statically prerendered, `/privacidade`, `/termos`, `/uso-aceitavel` ○) |

Grep gate de higiene (após Task 1): `Postou` presente apenas na linha do slogan (fora do `<h1>`); `<h1` contém somente "Vendeo"; seções "O Vendeo pode criar" e "Como funciona" localizadas em `src/components/landing/`. ✅

## Decisions Made
- Slogan "Postou, vendeo!" como linha secundária (italic, accent-green, menor que o H1), **nunca dentro do `<h1>` nem como heading** — decisão registrada no plano seguida literalmente
- Frase de funcionalidade inequívoca: categoria "marketing", público "pequenos e médios lojistas", tecnologia "inteligência artificial comercial"
- CTA descrito como "chamada para ação para orientar o próximo passo do cliente" — **sem "link de venda"** (decisão do plano)
- Contato via mailto com SUPPORT_EMAIL + fallback `suporte@vendeo.tech` (sem criar rota /contato — fora do escopo)
- Metadata da página NÃO alterada (title já lidera com "Vendeo")

## Deviations from Plan

None - plan executed exactly as written (Tasks 1-2; Task 3 é UAT humano pendente).

## Issues Encountered
- PowerShell 5.1 não suporta `rg`/`&&`/bash-syntax: hygiene gates executados via ferramenta Grep e `npm.cmd` (equivalente funcional, sem impacto)
- Nenhum problema de código; nenhum auto-fix necessário (Regras 1-3 não disparadas)

## Pending: Task 3 — UAT Manual (checkpoint:human-verify)

**Status: PENDENTE — execução humana requerida.** Checklist completo em `.planning/quick/260820-r4r-alinhar-homepage-p-blica-do-vendeo-aos-r/260820-r4r-PLAN.md` (Task 3). Evidências devem ser registradas em `260820-r4r-UAT.md`. Resumo do checklist:

1. Abrir `/` em aba anônima/deslogada — abre SEM login
2. Primeiro viewport: "Vendeo" como título principal inequívoco (não parece login/beta fechado/genérico)
3. "Postou, vendeo!" como slogan secundário, nunca nome principal
4. Seções "O Vendeo pode criar" (4 capacidades) e "Como funciona" (4 passos)
5. "Política de Privacidade" → `/privacidade` abre sem login
6. Conferir URL de privacidade linkada vs Google Cloud Console (OAuth consent screen) — preferencialmente `https://vendeo.tech/privacidade` (não alterar config Google)
7. "Termos de Uso" → `/termos` abre sem login; "Contato" → abre cliente de email (mailto)
8. CTA principal compatível com flag `publicSignupEnabled` no ambiente (local: off → Solicitar acesso free; produção: conforme env)

**Resume signal:** Type "approved" ou descreva issues encontrados.

## User Setup Required

None - sem configuração externa. (A conferência da URL de privacidade no Google Cloud Console é parte do UAT humano, item 6 — apenas conferência, sem alteração.)

## Next Phase Readiness
- Homepage pública pronta para reavaliação do Google OAuth (após UAT humano aprovado)
- Branches CTA flag on/off intactos e cobertos por teste — F42 (Signup Controlado) pode avançar sem conflito
- `access-request-section.test.tsx` inalterado (contrato flag on/off preservado)

---
*Phase: 260820-r4r*
*Completed: 2026-08-20 (Tasks 1-2; Task 3 UAT pendente)*

## Self-Check: PASSED

- FOUND: src/components/landing/how-it-works-section.tsx
- FOUND: src/components/landing/what-vendeo-creates-section.tsx
- FOUND: src/app/page.tsx
- FOUND: src/components/landing/access-request-section.tsx
- FOUND: src/__tests__/app/landing-page.test.tsx
- FOUND: .planning/quick/260820-r4r-alinhar-homepage-p-blica-do-vendeo-aos-r/260820-r4r-SUMMARY.md
- FOUND: commit 4aa7807f (Task 1)
- FOUND: commit c93f9aa0 (Task 2)