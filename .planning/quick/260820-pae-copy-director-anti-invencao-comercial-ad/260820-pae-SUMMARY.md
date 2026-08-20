---
phase: quick-pae
plan: 01
subsystem: copy-generation
tags: [prompts, copy-director, anti-invencao, precisao-comercial, vitest]

# Dependency graph
requires:
  - phase: 31-2-diretores-por-intencao
    provides: "4 prompt templates de copy (base, offer, spotlight, exclusive) e CopyDirectorService"
provides:
  - "Bloco '### Precisão comercial' (fatos protegidos, categorias de condições proibidas, não-inferência, CTAs neutros de loja física, criatividade permitida) nos 4 prompts de copy"
  - "CTA neutro em base/offer ('Garanta já o seu!', 'Aproveite na loja!', 'Fale com a equipe!') — remoção total de 'Clique e compre'"
  - "Teste de conteúdo por âncoras conceituais (copy-director-prompt.test.ts) cobrindo os 4 prompts sem modelo real"
affects: [F43, revisao-brief-pre-geracao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Âncoras conceituais para testar conteúdo de prompts (sem lista longa de tokens) — mesma família de prompt-reframe.test.ts"
    - "Leitura direta do prompt via readFileSync(path.join(process.cwd(), 'prompts', name))"

key-files:
  created:
    - src/lib/copy/__tests__/copy-director-prompt.test.ts
  modified:
    - prompts/campaign-copy-director.md
    - prompts/campaign-copy-director-offer.md
    - prompts/campaign-copy-director-spotlight.md
    - prompts/campaign-copy-director-exclusive.md

key-decisions:
  - "D3: bloco curto '### Precisão comercial' em tom de direção criativa (não compliance jurídico), sem bullets de proibições"
  - "D4: CTA de offer/base trocado para 'Garanta já o seu!', 'Aproveite na loja!', 'Fale com a equipe!' — sem 'Clique e compre' em lugar nenhum"
  - "D5: spotlight e exclusive mantêm seus CTAs já neutros"
  - "D6: testes por âncoras conceituais (6 testes, 4 prompts) seguindo padrão prompt-reframe.test.ts"

patterns-established:
  - "Conteúdo de prompt de copy testado por âncoras conceituais, não por token-list longa"
  - "Regra anti-invenção comercial expressa em direção criativa ('fatos protegidos') em vez de proibições em lista"

requirements-completed: [Q-CDA-01, Q-CDA-02, Q-CDA-03]

# Metrics
duration: ~15min
completed: 2026-08-20
---

# Quick 260820-pae — Copy Director Precisão Comercial Summary

**Bloco '### Precisão comercial' (fatos protegidos, categorias de condições proibidas, não-inferência, CTAs neutros de loja física, criatividade permitida) inserido nos 4 prompts de copy + CTA neutro em base/offer com remoção total de 'Clique e compre', coberto por teste de conteúdo por âncoras conceituais (6 testes) sem modelo real**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-20T21:11:00Z (aprox.)
- **Completed:** 2026-08-20T21:26:42Z
- **Tasks:** 2
- **Files modified:** 5 (4 prompts + 1 teste novo)

## Accomplishments
- 4 prompts de copy (base, offer, spotlight, exclusive) ganharam a seção `### Precisão comercial` exata (texto do usuário, idêntico nos 4), posicionada entre o fim de `### Campos obrigatórios:` e o início de `### Regras de tom de voz:` — sem variável nova, sem tocar nas demais seções.
- Offer e base trocaram o exemplo de CTA `"Garanta já a sua!", "Corra e aproveite!", "Clique e compre!"` por `"Garanta já o seu!", "Aproveite na loja!", "Fale com a equipe!"`; spotlight e exclusive mantiveram seus exemplos já neutros.
- Novo `src/lib/copy/__tests__/copy-director-prompt.test.ts` cobre os 4 prompts por âncoras conceituais: seção presente, fatos protegidos + não-inferência, categorias de condições proibidas, criatividade permitida, CTAs neutros e ausência total de `Clique e compre` — 6 testes, sem chamada de modelo real.
- Zero mudanças em schema (`CopyDirectorInputSchema`/`CopyDirectorResultSchema`), `mapper.ts`, `copy-director-service.ts`, backend/rota, form, image reviewer e image director.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Bloco 'Precisão comercial' + CTA neutro nos 4 prompts** - `7dbb9124` (feat)
2. **Task 2: Testes de conteúdo por âncoras conceituais** - `bc9b4cec` (test)

**Plan metadata:** Não commitado — artefatos docs do quick (PLAN/SUMMARY/STATE) ficam fora do git por instrução.

## Files Created/Modified
- `prompts/campaign-copy-director.md` - Bloco `### Precisão comercial` inserido + CTA neutro (`"Garanta já o seu!", "Aproveite na loja!", "Fale com a equipe!"`)
- `prompts/campaign-copy-director-offer.md` - Bloco `### Precisão comercial` inserido + CTA neutro (mesmos exemplos novos)
- `prompts/campaign-copy-director-spotlight.md` - Bloco `### Precisão comercial` inserido apenas; CTAs atuais mantidos ("Confira já!", "Venha conhecer!", "Descubra agora!")
- `prompts/campaign-copy-director-exclusive.md` - Bloco `### Precisão comercial` inserido apenas; CTAs atuais mantidos ("Saiba mais!", "Consulte-nos!", "Garanta o seu!")
- `src/lib/copy/__tests__/copy-director-prompt.test.ts` - 6 testes de conteúdo por âncoras conceituais (padrão `prompt-reframe.test.ts`)

## Decisions Made
- Segui o plano exatamente (D1–D6 já revisados): bloco verbatim do usuário nos 4 prompts, CTA neutro apenas em base/offer, testes por âncoras conceituais. Nenhuma decisão nova de execução.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- PowerShell 5.1 rejeita pipe direto em `npm` (`npm run ... | Select-Object`); resolvido usando `& npm.cmd run ... | Select-Object`. Sem impacto no código.

## Verification Gates

| Gate | Result |
|------|--------|
| `npx vitest run src/lib/copy/__tests__/copy-director-prompt.test.ts` | ✅ 1 file / 6 tests passed |
| `npx vitest run src/lib/copy/__tests__/copy-director-service.test.ts` | ✅ 1 file / 24 tests passed (regressão serviço) |
| `npx vitest run src/lib/campaign/__tests__/prompt-reframe.test.ts` | ✅ 1 file / 5 tests passed (regressão padrão) |
| `npm run typecheck` | ✅ Clean |
| `npm run lint` | ✅ Clean |
| Grep: `Clique e compre` nos 4 prompts | ✅ 0 ocorrências |
| Grep: `Precisão comercial` nos 4 prompts | ✅ 1 ocorrência por arquivo |

## Next Phase Readiness
- Copy Director agora não inventa condições comerciais, canais de venda ou promessas operacionais não informadas — resolve o bug de "tele-entrega" sem transformar o copywriter em auditor de compliance.
- Fora do escopo confirmado: validação de data (Quick 260820-siq) e reviewer multi-imagens (pendência F41) permanecem intocados.

---
*Phase: quick-pae*
*Completed: 2026-08-20*

## Self-Check: PASSED

- Arquivos verificados no disco: 4 prompts + 1 teste + este SUMMARY — todos FOUND.
- Commits verificados no git log: `7dbb9124` (feat) e `bc9b4cec` (test) — ambos FOUND.
- Gates: 35/35 testes (6 novo + 24 serviço + 5 reframe), typecheck clean, lint clean, grep 0× 'Clique e compre' / 1× 'Precisão comercial' por arquivo.