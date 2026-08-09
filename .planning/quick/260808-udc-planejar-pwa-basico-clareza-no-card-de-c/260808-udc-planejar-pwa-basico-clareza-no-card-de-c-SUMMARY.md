---
phase: quick-udc
plan: 01
quick_id: 260808-udc-planejar-pwa-basico-clareza-no-card-de-c
subsystem: pwa, ui
tags: [pwa, manifest, sharp, nextjs, apple-web-app, icons, balance-card, credits, microcopy]
requires:
  - phase: 38
    provides: "useOperationCosts hook, GET /api/operation-costs, OperationCostsMap/UseOperationCostsStatus types (consumed read-only)"
  - phase: 24
    provides: "formatCredits helper (singular/plural) e tipos OperationKey/OPERATION_KEYS"
provides:
  - "Manifesto PWA instalável servido em /manifest.webmanifest (start_url /dashboard, display standalone, ícones 192/512/maskable)"
  - "4 PNGs gerados programaticamente via sharp em public/icons/ (192, 512, maskable 512, apple-touch 180)"
  - "Metadata PWA/iOS no root layout (manifest, viewport themeColor, appleWebApp, icons incl. apple-touch-icon)"
  - "Dica iOS discreta (InstallHint) na área da conta, somente Safari iOS fora de display-mode: standalone"
  - "Visão de custo por operação no BalanceCard (Campanha / Assinatura visual) sem texto ambíguo"
affects: [landing-page-quick, fase-39-stripe, mobile-hardening]
tech-stack:
  added: []
  patterns:
    - "Ícones PWA gerados por script determinístico (SVG builder → sharp rasterize → self-verify) — sem assets binários no repo"
    - "Instalabilidade PWA sem service worker nem cache offline (manifest + metadata apenas)"
    - "Custo por operação renderizado via useOperationCosts com fallback neutro sem número inventado"
key-files:
  created:
    - "src/app/manifest.ts"
    - "public/icons/icon-192x192.png"
    - "public/icons/icon-512x512.png"
    - "public/icons/icon-maskable-512x512.png"
    - "public/icons/apple-touch-icon.png"
    - "scripts/generate-pwa-icons.mjs"
    - "src/components/pwa/install-hint.tsx"
  modified:
    - "src/app/layout.tsx"
    - "src/app/(app)/conta/page.tsx"
    - "src/components/credit/balance-card.tsx"
    - "src/components/credit/__tests__/balance-card.test.tsx"
key-decisions:
  - "start_url '/dashboard' (não '/') — '/' será a landing pública após o merge da quick de landing; '/dashboard' abre direto no app para logado e redireciona visitante ao login via middleware"
  - "Ícones placeholder determinísticos via sharp (dependência já existente) — NENHUM pacote novo; glifo 'V' em polyline vetorial (sem dependência de fontes)"
  - "themeColor via export `viewport` (convenção Next 15) — NUNCA em `metadata` (deprecado); sem `favicon` top-level (interface Metadata não possui o campo)"
  - "Operação ausente no map de custos (anomalia de dados) renderiza 'indisponível' — nunca um número inventado (0 créditos)"
patterns-established:
  - "Manifest.ts + viewport export + appleWebApp + icons na metadata = bloco padrão de PWA básico sem SW"
  - "Componente cliente SSR-safe com estado visible iniciando false para detecção de display-mode/plataforma"
requirements-completed: [UDC-PWA, UDC-CREDITS]
duration: 22min
completed: 2026-08-08
---

# Quick 260808-udc: PWA básico instalável (sem service worker) + clareza de custo por operação no card de créditos

**Manifesto PWA válido em `/manifest.webmanifest` (start_url /dashboard, display standalone, ícones 192/512/maskable gerados via sharp), metadata PWA/iOS no root layout, dica iOS discreta na conta, e BalanceCard com custo por operação (Campanha / Assinatura visual) sem texto ambíguo**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-08T22:05:00Z
- **Completed:** 2026-08-08T22:27:00Z
- **Tasks:** 3 (auto, sem checkpoints)
- **Files modified:** 11 (7 criados, 4 modificados)

## Accomplishments

- Manifesto PWA instalável servido em `/manifest.webmanifest` (name/short_name "Vendeo", description, `start_url: "/dashboard"`, `scope: "/"`, `display: "standalone"`, theme/background `#0F172A`, 3 ícones: 192, 512, maskable 512)
- 4 PNGs gerados programaticamente por `scripts/generate-pwa-icons.mjs` (sharp — dependência já existente, sem novo pacote) com self-verify de formato/dimensões e glifo "V" vetorial determinístico
- Metadata PWA/iOS no root layout: `manifest`, `viewport` com `themeColor` (sem deprecation), `appleWebApp`, icons `icon` + `apple` (apple-touch-icon 180) — build Next passa sem warnings de metadata/manifest/favicon
- Dica iOS discreta (`InstallHint` client component) renderiza texto único sem botão, apenas em Safari iOS fora de `display-mode: standalone`, dentro do card "Informações da Conta"
- BalanceCard substitui a frase ambígua "Cada geração consome X." por linhas de custo por operação: "Campanha: N crédito(s)" / "Assinatura visual: N crédito(s)" via `formatCredits`, "indisponível" para operação desabilitada/ausente, e texto neutro sem número quando custos não carregaram
- Testes do balance-card atualizados + 5 novos cenários (plural, indisponível ×2, loading, sem-ambiguidade) — 9 testes passando

## Task Commits

1. **Task 1: Gerar ícones PNG programaticamente + criar manifest.ts** - `809162e` (feat)
2. **Task 2: Metadata PWA/iOS no layout + dica iOS discreta na conta** - `50bb5c6` (feat)
3. **Task 3: Visão de custo por operação no BalanceCard + testes** - `101739e` (feat)

**Plan metadata:** `95cd59e` (docs: pre-dispatch plan)

## Files Created/Modified

- `scripts/generate-pwa-icons.mjs` - Gerador determinístico: builder SVG (fundo #0F172A, glifo V #22C55E, rounded rx=96 p/ não-maskable) → rasterize sharp → self-verify png/dimensões; cria `public/icons/`
- `public/icons/icon-192x192.png` - 192x192 rounded
- `public/icons/icon-512x512.png` - 512x512 rounded
- `public/icons/icon-maskable-512x512.png` - 512x512 full-bleed (zona segura 80%)
- `public/icons/apple-touch-icon.png` - 180x180 rounded
- `src/app/manifest.ts` - `MetadataRoute.Manifest` com name/short_name/description/start_url /dashboard/scope //display standalone/theme+background #0F172A/3 icons
- `src/app/layout.tsx` - metadata estendida (manifest, appleWebApp, icons icon+apple) + export `viewport` com themeColor
- `src/components/pwa/install-hint.tsx` - Client SSR-safe; visível só em iOS fora de standalone; texto discreto sem botão
- `src/app/(app)/conta/page.tsx` - `InstallHint` renderizado no card "Informações da Conta"
- `src/components/credit/balance-card.tsx` - `OperationCostRows` (Campanha/Assinatura visual via useOperationCosts + formatCredits; indisponível p/ desabilitada/ausente; fallback neutro) no estado normal; low/zero inalterados
- `src/components/credit/__tests__/balance-card.test.tsx` - Teste 1 atualizado + 5 novos cenários; teste 4 (neutro) preservado

## Decisions Made

- `start_url: "/dashboard"` — `/` será a landing pública após o merge da quick de landing (worktree `Vendeo-Quick-Landing`), então não pode ser o entry do PWA; `/dashboard` abre direto para autenticado e redireciona visitante ao login via middleware (per requirement)
- Ícones placeholder determinísticos via `sharp@^0.34.5` (já em package.json) — zero pacotes novos (threat T-UDC-SC respeitado); glifo "V" em `<polyline>` puro (librsvg não garante `<text>`)
- `themeColor` no export `viewport` (convenção Next 15), nunca em `metadata` (deprecado); sem `favicon` top-level (interface Metadata não possui o campo — quebraria o typecheck); o tab favicon é coberto por `icons.icon` (rel="icon")
- Operação ausente no map de custos (anomalia de dados da API) renderiza "indisponível" em vez de um número inventado (ex.: "0 créditos")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dependências do projeto não instaladas (node_modules ausente)**
- **Found during:** Task 1 (execução do `scripts/generate-pwa-icons.mjs` falhou com `ERR_MODULE_NOT_FOUND: Cannot find package 'sharp'`)
- **Issue:** O checkout (worktree `Vendeo-Quick-PWA`) estava sem `node_modules` — nenhuma dependência instalada; todos os gates (script de ícones, typecheck, lint, vitest, build) ficariam impossibilitados
- **Fix:** `npm ci --no-audit --no-fund` a partir do `package-lock.json` do próprio repo (361 pacotes, versões exatas do lockfile). **Nenhum pacote novo adicionado** — a regra de exclusão de instalação de pacotes não se aplica porque não houve decisão de nome de pacote alguma (restauração determinística das dependências declaradas pelo projeto)
- **Files modified:** nenhum (node_modules gitignored)
- **Verification:** `node scripts/generate-pwa-icons.mjs` rodou OK; typecheck/lint/vitest/build verdes
- **Committed in:** N/A (pré-requisito de ambiente, nenhum arquivo rastreado alterado)

**2. [Rule 3 - Blocking] Build gate exigia env vars ausentes no checkout**
- **Found during:** Verificação final (`npm run build` falhou: `Missing NEXT_PUBLIC_SUPABASE_URL`, depois `Missing SUPABASE_SERVICE_ROLE_KEY`)
- **Issue:** O checkout não possui `.env.local` (gitignored) e `.env.example` não contém as variáveis Supabase exigidas no module-load pelos clients `src/lib/supabase/*.ts`
- **Fix:** Criado `.env.local` TEMPORÁRIO (gitignored) com valores placeholder (`https://placeholder.supabase.co`, `placeholder-anon-key`, etc.) exclusivamente para executar o build gate; **deletado ao final**. Nenhuma alteração de env/config commitada — escopo locked respeitado
- **Files modified:** nenhum (arquivo temporário removido)
- **Verification:** `npm run build` exit 0; `/manifest.webmanifest` prerenderizado; tree limpa após `Remove-Item`
- **Committed in:** N/A

**3. [Nota de implementação - não é desvio] Acesso a `description` de low/zero via indexação**
- **Found during:** Task 3
- **Issue:** Ao remover `description` do estado `normal` (conforme plano), `config.description` no branch `low`/`zero` não typechecka — TS não correlaciona o narrowing de `displayState` com o union `config = stateConfig[displayState]`
- **Fix:** Usado `stateConfig[displayState].description` inline no branch low/zero (TS indexa com o literal narrowado `"low" | "zero"`) — comportamento idêntico ao `<p>{config.description}</p>` do plano
- **Files modified:** src/components/credit/balance-card.tsx
- **Verification:** typecheck limpo; testes 2 (zero/CTA) passando
- **Committed in:** 101739e

---

**Total deviations:** 2 auto-fixados (ambos Rule 3 - blocking, de ambiente) + 1 nota de implementação
**Impact on plan:** Auto-fixes de ambiente necessários para executar os gates de verificação; nenhum escopo adicionado, nenhum arquivo fora de `files_modified` tocado, nenhum pacote novo.

## Issues Encountered

- Piping de `npm` dentro do PowerShell 5.1 ("Não é possível executar um documento no meio de um pipeline") — contornado com `cmd /c "npm ..."` em todos os comandos npm
- Console do PowerShell exibe acentos (ção) como "��" na saída de grep — apenas exibição; o conteúdo dos arquivos está UTF-8 correto (os matches de "Cada geração consome" e os testes confirmam)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PWA instalável pronto (Android/iOS via manifest + metadata; dica iOS discreta na conta) — sem service worker, sem cache offline, sem mudança de next.config (escopo locked)
- BalanceCard sem ambiguidade de custo — pronto para a landing page quick (que usará `/` como entry público) e para F39 (Stripe)
- Verifier deve confirmar visualmente: `/manifest.webmanifest` no browser, ícones em `public/icons/`, dica iOS apenas no Safari iOS fora de standalone

---

*Phase: quick-udc*
*Completed: 2026-08-08*

## Self-Check: PASSED

- Todos os 10 arquivos verificados (9 de código + SUMMARY) existem no disco
- Commits confirmados via `git log`: `809162e`, `50bb5c6`, `101739e`
- Gates: `node scripts/generate-pwa-icons.mjs` OK (4 PNGs com dimensões exatas), typecheck limpo, lint limpo, vitest balance-card 9/9, `npm run build` exit 0 com `/manifest.webmanifest` prerenderizado e sem warnings de metadata/manifest/favicon/themeColor
- Grep gates: zero ocorrências de `serviceWorker`; "Cada geração consome" apenas no fallback estático (linha 61); 4 PNGs em `public/icons/`
- `git status` limpo — somente arquivos de `files_modified` alterados
