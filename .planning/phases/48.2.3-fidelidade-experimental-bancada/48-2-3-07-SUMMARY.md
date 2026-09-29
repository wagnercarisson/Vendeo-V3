---
phase: 48.2.3-fidelidade-experimental-bancada
plan: 48-2-3-07
subsystem: lab-admin-api + lab-admin-ui
tags: [nextjs, api-routes, react, prompt-preflight, bench, lab, zod, vitest, tailwind, lucide-react]

# Dependency graph
requires:
  - phase: 48.2.3-fidelidade-experimental-bancada
    provides: schemas fiéis com evidência do preflight (plano 02), form-rules/snapshot fiel (plano 04), experimental-briefing + resolveBenchBrandColor (plano 05), prompt-composer determinístico com blocos canônicos (plano 06)
  - phase: 48.2.2-fundacao-bancada-geracao
    provides: rotas da bancada, guards (requireAdmin/assertLabEnvironment/assertBenchTestStore), serviço de run/artefato, presets/pricing, adapter Images dedicado
provides:
  - "GET /api/admin/laboratorio/bancada/briefing — briefing estruturado (direção visual + tipografia + brandColor resolvido), sem secrets"
  - "POST /api/admin/laboratorio/bancada/compose — composição/preview do prompt compilado (pura, sem IA) + aprovação explícita"
  - "POST /runs exige preflight aprovado (422 confirmation_required) e persiste a evidência mínima; prompt_sent idêntico ao prompt final aprovado"
  - "GET /runs/[id] reflete a evidência do preflight (prompt-base, compilado, aprovado, blocos, versão do compositor)"
  - "UI: formulário fiel, indicador do brandColor resolvido e painel de preflight (compor/editar/aprovar) com invalidação centralizada"
affects: [48.2.3-fidelidade-experimental-bancada, 48.2.4-experimento-deterministico-oferta-1-1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordem obrigatória de guards em toda rota: requireAdmin → assertLabEnvironment → assertBenchTestStore antes de qualquer leitura com storeId"
    - "Preflight aprovado como barreira: POST /runs recusa geração sem prompt aprovado e envia prompt_sent idêntico ao prompt final aprovado"
    - "Invalidação centralizada do preflight via ponto único invalidatePreflight() + preflightRevision (contador em memória, sem hashes persistidos)"

key-files:
  created:
    - src/app/api/admin/laboratorio/bancada/briefing/route.ts
    - src/app/api/admin/laboratorio/bancada/compose/route.ts
    - "src/app/(app)/admin/laboratorio/bancada/_components/bench-preflight-panel.tsx"
    - "src/app/(app)/admin/laboratorio/bancada/_components/bench-brand-color-indicator.tsx"
  modified:
    - src/app/api/admin/laboratorio/bancada/runs/route.ts
    - src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts
    - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
    - "src/app/(app)/admin/laboratorio/bancada/_components/bench-campaign-form.tsx"
    - "src/app/(app)/admin/laboratorio/bancada/_components/bench-branding-panel.tsx"
    - "src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx"
    - "src/app/(app)/admin/laboratorio/bancada/_components/bench-prompt-editor.tsx"
    - "src/app/(app)/admin/laboratorio/bancada/_components/bench-execution-panel.tsx"
    - "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"

key-decisions:
  - "GET /briefing deriva o briefing estruturado do contrato de branding local (loadBenchBranding) — direção visual + tipografia + brandColor resolvido — sem product/offer (a composição completa ocorre em POST /compose)"
  - "POST /compose é puro e sem IA: reutiliza buildBenchExperimentalBriefing + composePromptBlocks; exige presetId para resolver a config travada; devolve compiledPrompt/blocks/composerVersion/approved"
  - "POST /runs exige preflight aprovado (422 confirmation_required quando ausente) e valida prompt === promptApproved; prompt_sent e o prompt enviado ao provider são exatamente o prompt final aprovado"
  - "Invalidação do preflight em ponto único (invalidatePreflight + preflightRevision) chamada por loja, produto/campanha, imagens, intenção/formato/config, prompt-base e edição pós-aprovação"

patterns-established:
  - "Preflight obrigatório: compor → revisar → editar → aprovar → estimar/confirmar, com confirmação financeira separada da aprovação do prompt"
  - "Evidência mínima do preflight persistida no run draft via setBenchRunInput (reusa prompt_sent/campaign_snapshot; sem tabela de versões nem hashes)"

requirements-completed: ["cap: lab-admin-api", "cap: lab-admin-ui", "cap: lab-bench-prompt-preflight", "cap: lab-generation-bench", "D17", "D20", "spec: lab-admin-api", "spec: lab-admin-ui", "spec: lab-bench-prompt-preflight", "tasks: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 6.4, 6.5, 6.6, 6.7"]

# Metrics
duration: 12min
completed: 2026-09-29
---

# Phase 48.2.3 Plan 07: API e UI do preflight da bancada fiel Summary

**Rotas GET /briefing e POST /compose com preflight aprovado obrigatório em POST /runs (prompt_sent = prompt final aprovado), e UI com formulário fiel, brandColor resolvido e painel compor/editar/aprovar com invalidação centralizada.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-29T19:00:00Z (aprox.)
- **Completed:** 2026-09-29T19:11:46Z
- **Tasks:** 4
- **Files modified:** 13

## Accomplishments
- `GET /briefing` expõe o briefing estruturado (direção visual + `typography_direction` + `brandColor` resolvido) sem secrets, com a ordem de guards admin → ambiente → manifesto antes de qualquer leitura.
- `POST /compose` expõe a composição/preview do prompt compilado pelo compositor puro (sem IA) e a aprovação explícita, sem secrets e com manifesto validado antes da leitura.
- `POST /runs` passa a exigir **preflight aprovado** (422 `confirmation_required` quando ausente), persiste a evidência mínima via `setBenchRunInput` e envia `prompt_sent` **idêntico** ao prompt final aprovado; `GET /runs/[id]` reflete a evidência do preflight.
- UI: formulário **fiel** (nome 60, descrição 120, preços de/por por dígitos→centavos, selo por intenção, intenção derivada/selecionada, "Preservar imagem original" só em Destaque/Exclusivo, validade, aviso ilustrativo, informações obrigatórias 200), indicador somente-leitura do `brandColor` resolvido e painel de preflight (compor/editar/aprovar) com **invalidação centralizada** por ponto único `invalidatePreflight()` + `preflightRevision`.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: GET /briefing — briefing estruturado com ordem de guards correta** - `675a8a10` (feat)
2. **Task 2: Composição/preview/aprovação + POST /runs com preflight aprovado + GET /runs/[id] com evidência** - `d6f5b56c` (feat)
3. **Task 3: UI — formulário fiel e exibição do brandColor resolvido** - `cf942949` (feat)
4. **Task 4: UI — painel de preflight (compor/editar/aprovar + invalidação) e integração com estimativa/confirmação** - `71c8bae7` (feat)

**Plan metadata:** commitado em sequência (este SUMMARY).

## Files Created/Modified
- `src/app/api/admin/laboratorio/bancada/briefing/route.ts` - `GET /briefing`: guards admin→ambiente→manifesto, briefing estruturado sem secrets.
- `src/app/api/admin/laboratorio/bancada/compose/route.ts` - `POST /compose`: composição/preview pura + aprovação explícita, manifesto antes da leitura.
- `src/app/api/admin/laboratorio/bancada/runs/route.ts` - exige preflight aprovado, persiste evidência e envia o prompt final aprovado.
- `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` - reflete a evidência do preflight no detalhe.
- `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` - cobre briefing, compose, preflight obrigatório e evidência.
- `src/app/(app)/admin/laboratorio/bancada/_components/bench-campaign-form.tsx` - formulário fiel produto/oferta.
- `src/app/(app)/admin/laboratorio/bancada/_components/bench-brand-color-indicator.tsx` - indicador somente-leitura do `brandColor` resolvido.
- `src/app/(app)/admin/laboratorio/bancada/_components/bench-branding-panel.tsx` - exibe o `brandColor` resolvido + direção tipográfica.
- `src/app/(app)/admin/laboratorio/bancada/_components/bench-preflight-panel.tsx` - painel compor/editar/aprovar.
- `src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx` - dono do estado do preflight + `invalidatePreflight`/`preflightRevision`.
- `src/app/(app)/admin/laboratorio/bancada/_components/bench-prompt-editor.tsx` - prompt-base preservado pelo compositor.
- `src/app/(app)/admin/laboratorio/bancada/_components/bench-execution-panel.tsx` - gate "Aprove o prompt compilado antes de estimar ou gerar." e confirmação financeira separada.
- `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx` - formulário fiel, brandColor, preflight e invalidação centralizada.

## Decisions Made
- O `GET /briefing` deriva o briefing estruturado diretamente do contrato de branding local (direção visual + tipografia + `brandColor` resolvido), pois `product`/`offer` não estão disponíveis em um GET; a composição completa (briefing + snapshot + config) ocorre em `POST /compose`.
- `POST /compose` exige `presetId` para resolver a configuração travada (as dimensões `modelo`/`qualidade` vêm do preset); o texto compilado não depende dessas duas dimensões.
- `POST /runs` valida `prompt === preflight.promptApproved` e usa o prompt aprovado tanto em `prompt_sent` quanto na requisição ao provider.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `resolveBenchConfig` exige `modelo`/`qualidade` (vindos do preset)**
- **Found during:** Task 2 (compose/route.ts)
- **Issue:** `DEFAULT_BENCH_CONFIG` não contém `modelo`/`qualidade`; chamar `resolveBenchConfig({ ...DEFAULT_BENCH_CONFIG })` falhava no typecheck.
- **Fix:** `POST /compose` passou a exigir `presetId`, resolver o preset habilitado (`preset_not_enabled` 400 quando inválido) e derivar `modelo`/`qualidade` do preset, espelhando `POST /runs`.
- **Files modified:** `src/app/api/admin/laboratorio/bancada/compose/route.ts`
- **Verification:** `npm run typecheck` exit 0; testes de compose verdes.
- **Committed in:** `d6f5b56c` (Task 2)

**2. [Rule 3 - Blocking] Fixtures de teste sem `brandColor` (contrato local de branding)**
- **Found during:** Task 3 (bench-branding-panel)
- **Issue:** `BenchBrandingView` passou a exigir `brandColor`; a fixture `BRANDING` do teste de UI não o possuía (falha de typecheck).
- **Fix:** Adicionado `brandColor: "#16A34A"` à fixture e novas asserções do indicador.
- **Files modified:** `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`
- **Verification:** `npm run typecheck` exit 0; testes de UI verdes.
- **Committed in:** `cf942949` (Task 3)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Ambos necessários para a correção/correção de contratos; sem ampliação de escopo.

## Issues Encountered
- O teste de "sem emojis" da UI passou a falhar porque separadores de comentário com caracteres box-drawing (`─`, faixa `\u{2300}-\u{27BF}`) foram introduzidos no workbench; os separadores foram removidos. O comentário do formulário que citava literalmente o termo proibido ("votação"/"lado a lado") foi reescrito para não acionar a asserção. Resolvido dentro do próprio Task 4.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API e UI do preflight fiéis concluídas; nenhuma escrita em tabelas produtivas, nenhum crédito, `campaign-images` intocado e nenhum secret exposto.
- Pronto para o plano `48-2-3-08` (testes transversais/UAT/verificação/encerramento da fase).
- Nenhum bloqueio identificado.

---
*Phase: 48.2.3-fidelidade-experimental-bancada*
*Completed: 2026-09-29*

## Self-Check: PASSED

- FOUND: src/app/api/admin/laboratorio/bancada/briefing/route.ts
- FOUND: src/app/api/admin/laboratorio/bancada/compose/route.ts
- FOUND: src/app/(app)/admin/laboratorio/bancada/_components/bench-preflight-panel.tsx
- FOUND: src/app/(app)/admin/laboratorio/bancada/_components/bench-brand-color-indicator.tsx
- FOUND: 675a8a10
- FOUND: d6f5b56c
- FOUND: cf942949
- FOUND: 71c8bae7
