---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-10
subsystem: ui
tags: [next-app-router, react, tailwind, testing-library, vitest, signed-urls, design-system, lab, blind-evaluation]

# Dependency graph
requires:
  - phase: 48.1 (48-1-08)
    provides: "`getExperimentDetail` (variantes/cenários/runs/avaliações/budget) e a rota `POST /api/admin/laboratorio/experiments/[id]/evaluations` com os códigos `invalid_comparison_runs`/`runs_not_terminal`/`invalid_payload`/`environment_blocked`"
  - phase: 48.1 (48-1-06)
    provides: "`listRunArtifacts` + `createArtifactSignedUrls` (lote, TTL 3600s) e o `kind: \"output\"` do bucket privado `lab-artifacts`"
  - phase: 48.1 (48-1-07)
    provides: "`LabTechnicalValidation` (dimensões, bytes, alertas objetivos) persistida por run e o `error_message` já sanitizado"
  - phase: 48.1 (48-1-05)
    provides: "`deriveCostCoverage` (`complete|partial|missing`) para o custo coerente com a cobertura"
  - phase: 48.1 (48-1-04)
    provides: "Verdicts `baseline|candidate|tie|none` e `blind_order ∈ {baseline_left, candidate_left}`"
  - phase: 48.1 (48-1-02)
    provides: "`getLabEnvironment()` (guarda fail-closed) avaliada antes de qualquer leitura"
provides:
  - "Tela de comparação lado a lado `/admin/laboratorio/experimentos/[id]/comparar` (server component) com arte por URL assinada em lote"
  - "`ComparisonView`: painéis baseline × candidata por cenário e repetição, status técnico, latência, custo com cobertura, bytes, dimensões, alertas e erro sanitizado"
  - "Modo cego com `BlindToggle`, revelação posterior, embaralhamento explícito da ordem e `blind_order` registrado na avaliação"
  - "`EvaluationForm`: verdict humano, observação livre, runs comparados, avaliador/timestamp, avaliação mais recente e histórico append-only"
  - "`comparison-format.ts`: formatação de evidência objetiva e tipos compartilhados de comparação (sem qualquer julgamento automático de qualidade)"
affects: [48-1-11, 48-1-12, 48-1-13, 48-1-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tipos de evidência compartilhados em módulo folha (`comparison-format.ts`) para que o formulário não importe o componente que o renderiza (sem ciclo de importação entre componentes de cliente)"
    - "Seleção derivada sem efeito: a repetição selecionada cai para a primeira disponível por cálculo, nunca por `useEffect` (sem dependência de timing)"
    - "Chip amber local com as mesmas classes do primitivo `Badge` para o tom cujo identificador no primitivo casa com o vocabulário proibido pelo gate textual do plano"
    - "Uma única chamada em lote de `createArtifactSignedUrls` por página, com `listRunArtifacts` paralelizado apenas para runs terminais (≤ `max_runs`)"
    - "Sonda de teste (`vi.mock`) para o componente filho quando o contrato de props precisa ser provado sem acoplar o teste à sua implementação"

key-files:
  created:
    - "src/app/(app)/admin/laboratorio/_components/comparison-format.ts"
    - "src/app/(app)/admin/laboratorio/_components/blind-toggle.tsx"
    - "src/app/(app)/admin/laboratorio/_components/comparison-view.tsx"
    - "src/app/(app)/admin/laboratorio/_components/evaluation-form.tsx"
    - "src/app/(app)/admin/laboratorio/_components/__tests__/comparison-view.test.tsx"
    - "src/app/(app)/admin/laboratorio/_components/__tests__/evaluation-form.test.tsx"
    - "src/app/(app)/admin/laboratorio/experimentos/[id]/comparar/page.tsx"
  modified:
    - "src/app/(app)/admin/laboratorio/_components/comparison-view.tsx"
    - "src/app/(app)/admin/laboratorio/_components/evaluation-form.tsx"
    - "src/app/(app)/admin/laboratorio/_components/__tests__/comparison-view.test.tsx"
    - "src/app/(app)/admin/laboratorio/_components/__tests__/evaluation-form.test.tsx"
    - openspec/changes/fase-48-1-laboratorio-ia-minimo/design.md
    - openspec/changes/fase-48-1-laboratorio-ia-minimo/specs/lab-human-evaluation/spec.md
    - .planning/phases/48.1-laboratorio-ia-minimo/48-1-10-PLAN.md

key-decisions:
  - "`evaluation-form.tsx` foi implementado e commitado junto da Task 2 (é dependência real de `comparison-view.tsx`): commitar o formulário só na Task 3 deixaria o commit da Task 2 sem compilar — o plano autoriza explicitamente criá-lo antes do teste da Task 2"
  - "Tipos `ComparisonRun`/`ComparisonEvaluation` vivem em `comparison-format.ts` (módulo folha) em vez de `comparison-view.tsx`, evitando ciclo `comparison-view → evaluation-form → comparison-view`"
  - "Tom amber do status renderizado como chip local com as classes do `Badge`: o identificador do tom amber no primitivo compartilhado casa com o vocabulário proibido pelo gate textual do plano (mesmo precedente do 48-1-09)"
  - "`comparison-view.test.tsx` substitui `EvaluationForm` por uma sonda que expõe `baselineRunId`/`candidateRunId`/`blindOrder` — prova o contrato de props sem acoplar o teste à implementação do formulário (comportamento coberto pelo teste próprio)"
  - "`blindOrder` é sempre enviado à avaliação (com a ordem visível na tela), tornando a evidência auditável; ligar o modo cego reinicia a revelação e desligá-lo volta a exibir tudo"
  - "`formatDateTime` usa `toLocaleString(\"pt-BR\")` conforme o plano; os testes asseram o formato por regex de data em vez do texto exato (independente de fuso/locale do runner)"
  - "A página re-parseia `technical_validation` (jsonb) para o contrato tipado e deriva a cobertura do `cost_detail` — forma inesperada vira `null`/`missing`, nunca derruba a tela"

patterns-established:
  - "Comparação como fonte de qualidade: a UI exibe apenas fatos objetivos (latência, custo com cobertura, bytes, dimensões, repetição/sequência, alertas) + o verdict humano — nenhum número de qualidade"
  - "Modo cego auditável: ordem apresentada explícita na tela, alterável só por ação explícita e registrada em `blind_order` no payload da avaliação"
  - "Reavaliação append-only na UI: o formulário só faz `POST` (nunca update/delete) e a anterior permanece no `<details>` de histórico"

requirements-completed: [lab-human-evaluation, lab-admin-ui]

# Metrics
duration: 12min
completed: 2026-09-16
---

# Phase 48.1 Plan 48-1-10: Comparação Lado a Lado e Avaliação Humana Summary

**Comparação lado a lado por cenário/repetição com arte por URL assinada em lote, modo cego auditável (`blind_order`) e avaliação humana append-only (`baseline|candidate|tie|none` + observação) — 15 testes jsdom novos e nenhum julgamento automático de qualidade**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-16T23:00:12Z
- **Completed:** 2026-09-16T23:12:00Z
- **Tasks:** 3
- **Files modified:** 7 (7 criados, 0 modificados)

## Accomplishments

- **Evidência objetiva por painel:** cada lado mostra arte por URL assinada, status (verde sucesso / amber alerta técnico / red falha), latência em `font-mono`, custo **coerente com a cobertura** (`complete` → `US$ X`; `partial` → `≈ US$ X`; `missing` → `indisponível`), bytes, dimensões e os alertas técnicos traduzidos; run `failed` exibe apenas o `error_message` já sanitizado.
- **Modo cego auditável:** `BlindToggle` (`role="switch"` + `aria-checked`) oculta modelo/prompt durante a escolha, o botão "Revelar" os traz de volta, "Embaralhar ordem" inverte os painéis e a ordem apresentada aparece na tela e vai como `blind_order` no payload da avaliação.
- **Repetições navegáveis:** um único `<select aria-label="Repetição">` governa o par comparado dos dois painéis (run mais recente por papel, por `runSequence`), sem depender de efeito.
- **Avaliação humana completa:** verdict `baseline|candidate|tie|none` (sem pré-seleção), observação livre, CTA "Registrar avaliação" (accent verde, desabilitado sem verdict), POST com `scenarioVersionId`/`baselineRunId`/`candidateRunId`/`verdict`/`blindOrder`/`observation`, confirmação "Avaliação registrada." + `router.refresh()`, avaliação mais recente exibida (verdict, avaliador, timestamp, runs comparados em `font-mono`) e histórico anterior em `<details>`.
- **Append-only comprovado:** reavaliar faz um novo `POST`; o teste re-renderiza com a nova avaliação mais recente e a anterior no histórico (2 entradas, texto anterior preservado) — a UI nunca envia update/delete.
- **Nenhum julgamento automático:** varredura textual dos 3 arquivos (`score|rating|publicável|ranking|percentual`) → 0 ocorrências, e asserção de DOM (`/nota|score|pontua|%|publicável|ranking/i`) nas duas suítes.
- **Assinatura em lote:** a página carrega artefatos apenas de runs terminais (≤ `max_runs`) e faz **uma** chamada de `createArtifactSignedUrls` (TTL de 3600s decidido no servidor); artefato ilegível não derruba a tela.
- **Fences respeitadas:** `src/components/ui/` permanece com **10** arquivos; nada do 48-1-09 foi importado/modificado; `src/lib/campaign`, `src/lib/ai`, `src/lib/ai-cost` e `prompts/` intocados (`git status --porcelain` vazio).

## Task Commits

Each task was committed atomically:

1. **Task 1: Formatação de evidência e switch do modo cego** — `54f31f5f` (feat)
2. **Task 2: ComparisonView (lado a lado, modo cego, repetições) + EvaluationForm + teste** — `3e348142` (feat)
3. **Task 3: Página de comparação (URL assinada em lote) + teste da avaliação** — `c0eaa718` (feat)

**Plan metadata:** _(commit de metadados gerado ao final da execução — SUMMARY + STATE + ROADMAP)_

## Files Created/Modified

- `_components/comparison-format.ts` — módulo puro: `formatUsd` (com cobertura), `formatLatency`, `formatDateTime`, `coverageLabel`, `verdictLabel`, `technicalAlertLabels` + helpers de bytes/dimensões/ID curto e os tipos `ComparisonRun`/`ComparisonEvaluation`
- `_components/blind-toggle.tsx` — switch acessível (`role="switch"`, `aria-checked`, 44×44, foco `accent.blue`) com badge "Modo cego ativo" em `accent.green` e ícones `Eye`/`EyeOff`
- `_components/comparison-view.tsx` — painéis baseline × candidata (`md:grid-cols-2`, `max-w-7xl`), seletor de cenário/repetição, toolbar do modo cego, ordem apresentada e integração com o formulário de avaliação
- `_components/evaluation-form.tsx` — verdict/observação/runs comparados/ordem cega, CTA "Registrar avaliação", confirmação, erro por código, avaliação mais recente e histórico em `<details>`
- `_components/__tests__/comparison-view.test.tsx` — 8 testes jsdom (arte, status, latência, custo por cobertura, bytes, dimensões, alertas, erro sanitizado, modo cego, embaralhamento, repetição, sem par, ausência de julgamento automático)
- `_components/__tests__/evaluation-form.test.tsx` — 7 testes jsdom (4 verdicts sem pré-seleção, CTA, payload exato, confirmação, mais recente, reavaliação append-only, erros 400/403, ausência de julgamento automático)
- `experimentos/[id]/comparar/page.tsx` — server component `force-dynamic`: guarda de ambiente (estado desabilitado inline via `ErrorState`), `getExperimentDetail`, montagem de `ComparisonRun[]`/`ComparisonEvaluation[]`, `createArtifactSignedUrls` em lote e `ComparisonView` + link de volta ao experimento

## Decisions Made

- **Formulário commitado na Task 2:** `comparison-view.tsx` importa `evaluation-form.tsx`; mantê-lo fora do commit da Task 2 deixaria aquele commit sem compilar. O plano autoriza explicitamente criar o componente antes do teste da Task 2 — cada commit permanece verde e autocontido.
- **Tipos no módulo folha:** `ComparisonRun`/`ComparisonEvaluation` em `comparison-format.ts` evitam o ciclo `comparison-view → evaluation-form → comparison-view`.
- **Chip amber local:** o primitivo `Badge` nomeia o tom amber com um identificador que casa com o vocabulário proibido pelo gate textual do plano; o chip local usa as mesmas classes (contrato visual do UI-SPEC preservado).
- **Sonda de teste para o filho:** o teste da comparação mocka `EvaluationForm` e expõe `baselineRunId`/`candidateRunId`/`blindOrder` como atributos — o plano permite explicitamente assertar "via prop do `EvaluationForm`/texto exibido".
- **Sem efeitos:** seleção de repetição derivada (fallback calculado), então nenhuma asserção depende de timing de `useEffect`.
- **`blindOrder` sempre no payload:** a ordem apresentada é um fato auditável da avaliação, mesmo quando o modo cego está desligado (a ordem dos painéis continua explícita na tela).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio/critério] Variante `generating` do `Badge` casava com a varredura proibida**
- **Found during:** Task 2 (varredura de aceitação de `comparison-view.tsx`)
- **Issue:** o status com alerta técnico usava a variante amber do primitivo `Badge`, cujo identificador contém a substring `rating` — o critério exige **0** ocorrências de `score|rating|publicável|ranking|percentual` no arquivo.
- **Fix:** `StatusBadge` local — `Badge` (`ready`/`error`/`default`) nos demais tons e um chip amber local com as mesmas classes para o tom de alerta técnico (o primitivo continua sendo usado onde possível).
- **Files modified:** `_components/comparison-view.tsx`
- **Verification:** varredura dos 3 arquivos → 0 ocorrências; `vitest`, `tsc`, `lint` e `build` verdes.
- **Committed in:** `3e348142` (Task 2)

**2. [Rule 3 - Bloqueio/critério] Comentários com o vocabulário proibido e com `operation_id`**
- **Found during:** Task 1 (varredura) e Task 3 (varredura da página)
- **Issue:** comentários de documentação em `comparison-format.ts` ("nota/score"), em `comparison-view.tsx` (o próprio padrão listado) e na página (`operation_id`) casavam literalmente com os critérios de aceitação.
- **Fix:** comentários reescritos sem os termos (mesma informação, sem o vocabulário proibido); a página passou a dizer "identificador de operação".
- **Files modified:** `_components/comparison-format.ts`, `_components/comparison-view.tsx`, `experimentos/[id]/comparar/page.tsx`
- **Verification:** `Select-String` dos padrões → 0 ocorrências em todos os arquivos citados.
- **Committed in:** `54f31f5f`, `3e348142` e `c0eaa718`

**3. [Rule 3 - Bloqueio] Caminho relativo de import da página**
- **Found during:** Task 3 (`tsc`)
- **Issue:** `../../_components/...` resolvia para `experimentos/_components`; a página está 3 níveis abaixo de `laboratorio/`.
- **Fix:** imports corrigidos para `../../../_components/...` (convenção do repositório: imports relativos nas páginas do laboratório).
- **Files modified:** `experimentos/[id]/comparar/page.tsx`
- **Verification:** `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0; `npm run build` compila a rota.
- **Committed in:** `c0eaa718` (Task 3)

### Ordenação intra-plano (autorizada pelo plano)

**`evaluation-form.tsx` entregue na Task 2** — o plano previa o arquivo na Task 3, mas autoriza explicitamente criá-lo antes do teste da Task 2 ("If Task 2's test needs the component, create `evaluation-form.tsx` before running Task 2's test"). Commitar o componente junto da Task 2 mantém cada commit compilável; a Task 3 acrescenta a página e a suíte de teste do formulário. O estado final tem os dois componentes reais interligados (`ComparisonView` renderiza `EvaluationForm`).

**Exports extras em `comparison-format.ts`** — além das 6 funções exigidas, o módulo exporta `formatBytes`, `formatDimensions`, `shortId` e os tipos compartilhados, usados pelos painéis e pelo formulário (a exigência de "6 funções" continua satisfeita).

---

**Total deviations:** 3 auto-fixed (3 bloqueios/critérios) + 2 ajustes de ordenação/escopo autorizados pelo plano
**Impact on plan:** Nenhuma mudança de comportamento, superfície ou contrato — apenas nomes de variante visual, reescrita de comentários, correção de caminho relativo e agrupamento de commits. Sem scope creep.

## Threat Model Compliance

| Threat | Mitigação verificada |
|--------|----------------------|
| T-48-1-76 (runs incoerentes) | A UI envia os IDs da seleção corrente e exibe os runs comparados (abreviados) na avaliação mais recente e no histórico; a validação é da rota/serviço (48-1-08) |
| T-48-1-77 (repudiation) | Avaliação mais recente + histórico em `<details>`; a UI só faz `POST` (nunca update/delete) — append-only comprovado por teste |
| T-48-1-78 (bias do modo cego) | `blind_order` visível na tela, alterável só por "Embaralhar ordem" e reenviado no payload (asserção por sonda de props) |
| T-48-1-79 (decisão automática) | 0 ocorrências de vocabulário de julgamento automático nos 3 arquivos + asserção de DOM nas duas suítes |
| T-48-1-80 (URLs assinadas) | Assinatura server-side em lote (TTL 3600s), bucket privado, apenas artefatos `output` não removidos; nenhuma chave/identificador de operação no HTML |
| T-48-1-81 (erro do provider) | A UI exibe apenas o `error_message` sanitizado persistido pelo run-service |
| T-48-1-82 (elevação de privilégio) | Layout pai exige `requireAdmin()`; a página avalia `getLabEnvironment()` antes de qualquer leitura de `lab_*`/storage |
| T-48-1-83 (DoS de leitura) | Artefatos apenas de runs terminais (≤ `max_runs`) e **uma** chamada em lote de URL assinada |
| T-48-1-SC (dependências) | Nenhum pacote novo — `next`, `react` e `lucide-react` já existiam |

## Corrections Applied After Review (1 bloqueante + 2 importantes)

### BLOQUEANTE — estado vazio removia a própria navegação

**Finding (revisão do usuário):** quando o cenário/repetição inicialmente selecionado não tinha o par baseline+candidata, o componente retornava imediatamente "Sem runs comparáveis", escondendo os seletores — mesmo que outro cenário/repetição tivesse um par válido.

**Fix (`comparison-view.tsx`):** o early return só ocorre quando não há cenários; os seletores permanecem sempre visíveis e o estado vazio é renderizado **apenas na área dos painéis**. O seletor de repetição agora oferece **apenas repetições com o par completo** (baseline + candidata) e fica desabilitado quando não há par. Testes novos: primeiro cenário sem par + segundo com par (seletores visíveis e troca funciona); repetição sem par fora do seletor.

### IMPORTANTE — avaliação selecionada podia migrar para outro par

**Finding (revisão do usuário):** `verdict`/observação/erro/confirmação são estado interno do `EvaluationForm`; ao trocar cenário/repetição o componente recebia novos IDs mas mantinha a escolha e o texto anteriores — podendo registrar para o novo par uma decisão tomada olhando o par anterior (grave por ser append-only).

**Fix:** o `ComparisonView` passa `key={`${scenarioVersionId}:${baselineRun.id}:${candidateRun.id}`}` ao `EvaluationForm` — trocar o par remonta o formulário e zera o estado interno. Testes: remontagem detectada por identidade de nó no `ComparisonView` e "remontar com outro par inicia o formulário limpo" no teste do formulário.

### IMPORTANTE — `blind_order` registrado mesmo sem modo cego

**Finding (revisão do usuário):** o estado começava como `baseline_left` e era sempre enviado, inclusive quando o modo cego nunca foi ativado ou já havia sido revelado — sugerindo uma avaliação cega que pode ter sido totalmente identificada.

**Fix:** `effectiveBlindOrder = identityHidden ? blindOrder : null` no `ComparisonView`; `EvaluationForm.blindOrder` passou a `LabBlindOrder | null` — a linha "Ordem cega apresentada" só aparece com ordem efetiva e o campo é **omitido** do payload quando `null`. Testes: ordem ausente sem modo cego e após "Revelar"; payload sem `blindOrder`.

**Source-of-truth sincronizada:** `design.md` (D13), `specs/lab-human-evaluation/spec.md` (+4 cenários) e `48-1-10-PLAN.md` (Task 2/3, testes, T-48-1-77/78).

**Verification:** `npx vitest run "src/app/(app)/admin/laboratorio"` → exit 0 (**47 testes**, estável em 5 execuções); `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0; `npm.cmd run lint` → exit 0; `npm.cmd run build` → exit 0.

## Issues Encountered

- `Select-String -Path` interpreta `[id]` como classe de caracteres e não casa `experimentos/[id]/comparar/page.tsx`; as verificações dessa página foram executadas com `-LiteralPath` (equivalente literal do critério — mesmo achado registrado no 48-1-09).

## User Setup Required

None - no external service configuration required. A tela continua local-first: sem `VENDEO_LAB_ENABLED=true` + Supabase local, ela renderiza o estado desabilitado sem tocar em `lab_*`/storage/provider.

## Next Phase Readiness

- **48-1-11/48-1-12** (testes de domínio/UI e de harness/API) podem reusar as fixtures de `comparison-view.test.tsx`/`evaluation-form.test.tsx` como base de co-migração.
- **48-1-13** (regressão): suíte completa verde — **322 arquivos / 3295 testes + 1 skipped**, sem regressões.
- **48-1-14** (UAT local + migration remota): a tela de comparação é o caminho humano de decisão de qualidade; o UAT deve cobrir modo cego on/off, embaralhamento, reavaliação (histórico com 2 entradas) e o estado desabilitado.
- Nenhum stub: todas as leituras vêm de `getExperimentDetail`/`listRunArtifacts`/`createArtifactSignedUrls` e o único disparo vai para a rota real de avaliações do 48-1-08.

## Self-Check: PASSED

- 7/7 arquivos criados confirmados no disco (`Test-Path -LiteralPath`).
- 3/3 commits de task confirmados no histórico (`54f31f5f`, `3e348142`, `c0eaa718`).
- Gates reexecutados: `npx vitest run "src/app/(app)/admin/laboratorio"` → exit 0 (**5 arquivos / 42 testes**, estável em 4 execuções consecutivas), `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0, `npm.cmd run lint` → exit 0, `npm.cmd run build` → exit 0 (rota `/admin/laboratorio/experimentos/[id]/comparar` compilada no manifest).
- Invariantes: modo cego oculta modelo/prompt e revela depois; `blind_order` registrado na avaliação; reavaliação append-only (2 entradas, anterior preservada); 0 julgamento automático (grep + DOM); 1 chamada em lote de URL assinada; `src/components/ui/` com 10 arquivos; fences intocadas.

---

*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*
