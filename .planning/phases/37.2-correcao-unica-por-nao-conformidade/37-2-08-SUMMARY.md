---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 08
subsystem: image-generation
tags: [image-generation, correction, v2, prompt-assembly, supabase, rpc, hook]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade (plans 03/05)
    provides: RPCs consume/complete_v2/fail (migrations M2/M3) + persistência do caso/tentativas (correction-reports.ts) + tipos (superseded)
  - phase: 37.2-correcao-unica-por-nao-conformidade (plan 06)
    provides: CorrectionIntentService (normalizedInstruction elegível)
  - phase: 43
    provides: override inputValidationOverride.productImageCheck = "brief_review_confirmed"
  - phase: 45
    provides: sanitizePromptText (art-director-briefing) + diretores por intent (.md intocados)
provides:
  - Hook aditivo onBeforeImageProviderCall (fire-once, attempt===0) no ImageGenerationService
  - Bloco único de não conformidade composto em tempo de montagem (sem editar os .md)
  - Orquestrador generateCorrectionV2 (consume via hook -> upload v2.jpg -> complete; fail pós-provider)
  - Helper storagePathToDataUrl (imagens F41 do bucket campaign-images -> data URL JPEG)
affects: [37.2-07 (rota problem-report), 37.2-16 (testes de geração), 37.2-19 (verificação final)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook opcional/aditivo com closure flag fire-once por execução de generateImage"
    - "Bloco contextual concatenado em assemblePrompt (padrão dos blocos condicionais)"
    - "Orquestrador de correção: snapshot imutável -> brief/contexto -> hook de consumo -> upload -> RPC atômica"

key-files:
  created: []
  modified:
    - src/lib/image-generation/services/image-generation-service.ts
    - src/lib/campaign/correction-reports.ts

key-decisions:
  - "Hook fire-once via closure flag hookCalled em generateImage + wrapper passado a generateWithRetry; chamado só em attempt===0 (fora do try/catch, erros propagam como falha pré-provider)"
  - "Bloco único de não conformidade (preâmbulo anti-invenção + normalizedInstruction saneada/delimitada) concatenado ao base prompt em TODOS os estados; .md do diretor intocados"
  - "Upload da v2 direto no bucket em {storeId}/{campaignId}/v2.jpg (uploadCampaignImage fixa o path {storeId}/{campaignId}.jpg e não pode ser reutilizado sem alterar persistence.ts)"
  - "Consumo discriminado por consumptionStarted: falha pré-provider não consome (relato open); falha pós-provider chama fail_campaign_correction_v2 + cleanup best-effort"
  - "Eventos call-level sob campaign.operation_run_id (campaign_delivery), attemptNumber = attempt_number da submissão; sem reserva de crédito"

patterns-established:
  - "Hook onBeforeImageProviderCall: ponto único de consumo imediatamente antes da 1ª chamada real ao provider"
  - "generateCorrectionV2: reconstrução do brief a partir do snapshot campaign_brief_v1 (sem re-montar) e sem candidateArtDataUrl"

requirements-completed: [F37.2-08]

# Metrics
duration: 25min
completed: 2026-09-11
---

# Phase 37.2 Plan 08: Geração da v2 (hook + bloco único + orquestrador) Summary

**Geração da v2 por não conformidade: hook aditivo fire-once antes do provider, bloco único de correção montado sem editar os .md, e orquestrador consume→upload v2.jpg→complete com falha pós-provider atômica — sem nova reserva de crédito e sem a v1 como referência.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-11T00:00:00Z (approx.)
- **Completed:** 2026-09-11T00:08:51Z
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments
- `ImageGenerationService.generateImage` aceita 6º parâmetro opcional `GenerateImageOptions` (`onBeforeImageProviderCall` + `normalizedInstruction`); o hook roda **fire-once** (closure `hookCalled`) imediatamente antes da 1ª chamada real ao provider (`attempt === 0`), **fora** do try/catch (erros propagam como falha pré-provider); ausência = comportamento atual inalterado.
- `assemblePrompt(state, variables, previousIssues, normalizedInstruction?)` compõe um **bloco único de não conformidade** (preâmbulo fixo anti-invenção/fidelidade ao briefing + instrução saneada com `sanitizePromptText` e delimitada por `<<<INSTRUÇÃO_DE_CORREÇÃO>>>`) em **todos** os estados (INITIAL/CORRECT/REGENERATE). Os 4 `.md` do diretor permanecem com **diff vazio**.
- `generateCorrectionV2` + `storagePathToDataUrl` em `correction-reports.ts`: reconstrói brief/contexto do snapshot `campaign_brief_v1` + identidade vigente, `input_validation` `skipped` via `brief_review_confirmed`, consome a oportunidade via hook, faz upload da v2 em `{storeId}/{campaignId}/v2.jpg` e conclui via `complete_campaign_correction_v2` (sem `p_mime_type`); falha pós-provider chama `fail_campaign_correction_v2` + remoção best-effort do órfão. Sem `reserveCredit`/`credit_transactions`/`operation_key`, sem `candidateArtDataUrl`.

## Task Commits

1. **Task 1 + Task 2: Hook onBeforeImageProviderCall + bloco único de não conformidade** - `940e0ca0` (feat) — *combinados (ver Deviations)*
2. **Task 3: Orquestrador da v2 (consume via hook → upload → complete; fail)** - `779c789b` (feat)

**Plan metadata:** `_pending_` (docs: complete plan — committed after this SUMMARY)

## Files Created/Modified
- `src/lib/image-generation/services/image-generation-service.ts` - `GenerateImageOptions` + hook fire-once + bloco único de não conformidade em `assemblePrompt`
- `src/lib/campaign/correction-reports.ts` - `storagePathToDataUrl` + `generateCorrectionV2` (consume/upload/complete/fail)
- `src/lib/image-generation/services/art-director-briefing.ts` - **não modificado** (apenas import de `sanitizePromptText` no serviço)

## Decisions Made
- Hook chamado dentro de `generateWithRetry` no início do loop em `attempt === 0`, **antes** do `try` (garante que erros do hook não sejam capturados como erro/retry do provider).
- Bloco concatenado ao base prompt (não substitui) e reutilizado por CORRECT/REGENERATE — mantém as instruções de correção já existentes.
- Consumo rastreado por flag local `consumptionStarted` (setada só após o RPC de consumo ter sucesso), discriminando falha pré × pós-provider.

## Deviations from Plan

### Auto-fixed / adjustments

**1. [Rule 3 - Blocking] Upload direto ao storage em vez de `uploadCampaignImage`**
- **Found during:** Task 3
- **Issue:** `uploadCampaignImage(storeId, campaignId, image)` (persistence.ts) grava sempre em `{storeId}/{campaignId}.jpg` — não é possível produzir o path fixo da v2 (`{storeId}/{campaignId}/v2.jpg`) sem alterar `persistence.ts` (um 4º arquivo, fora do escopo declarado) nem sem colidir com o objeto da v1 (`upsert:false`).
- **Fix:** Upload direto via `supabaseAdmin.storage.from("campaign-images").upload(storagePath, jpeg.buffer, { contentType: "image/jpeg", upsert: false })` no path canônico `{storeId}/{campaignId}/v2.jpg` (decisão travada D6).
- **Files modified:** `src/lib/campaign/correction-reports.ts`
- **Verification:** Gate da Task 3 (`v2.jpg` presente) + typecheck limpo.
- **Committed in:** `779c789b` (Task 3)

**2. [Process] Tasks 1 e 2 combinadas em um único commit**
- **Found during:** Commit de Task 1
- **Issue:** As duas tarefas editam o MESMO arquivo e compartilham um hunk (o call site altera simultaneamente `options?.normalizedInstruction` — Task 2 — e `runBeforeImageProviderCall` — Task 1), impedindo split atômico limpo por task sem cirurgia de patch em nível de linha (e um split ingênuo deixaria `runBeforeImageProviderCall` não utilizado no commit intermediário, quebrando o typecheck).
- **Fix:** Commit atômico único `940e0ca0` cobrindo Tasks 1+2; Task 3 em commit próprio.
- **Files modified:** `src/lib/image-generation/services/image-generation-service.ts`
- **Verification:** Gates T1/T2 verdes; `git diff --stat` dos 4 `.md` vazio.
- **Committed in:** `940e0ca0`

**3. [Rule 1 - Bug] Comentário reescrito para satisfazer o gate literal**
- **Found during:** Gate da Task 3
- **Issue:** O gate proíbe as substrings `reserveCredit|credit_transactions|operation_key`; um comentário explicativo continha os termos literais `credit_transactions`/`operation_key`.
- **Fix:** Comentário reescrito sem as substrings proibidas.
- **Files modified:** `src/lib/campaign/correction-reports.ts`
- **Verification:** Gate T3 verde.
- **Committed in:** `779c789b` (Task 3)

---

**Total deviations:** 3 (1 blocking, 1 process, 1 bug)
**Impact on plan:** Sem scope creep. A mudança de upload é obrigatória para respeitar o path canônico da v2 sem tocar `persistence.ts`. A combinação de Tasks 1+2 é consequência de edições interleaved no mesmo arquivo.

## Issues Encountered
- Nenhum teste unitário de `ImageGenerationService` existe no repositório (o diretório `src/__tests__/lib/image-generation` não existe); os testes mais próximos (mock da service) rodaram verdes.

## Verification (output real)

- **Gate Task 1:** `OK hook`
- **Gate Task 2:** `OK bloco v2; .md: campaign-image-director-exclusive.md,campaign-image-director-offer.md,campaign-image-director-spotlight.md,campaign-image-director.md`
- **Gate Task 3:** `OK orquestrador v2`
- **`npm run typecheck`:** limpo (sem erros).
- **`git diff --stat` dos 4 `prompts/campaign-image-director*`:** vazio.
- **`npx vitest run src/__tests__/api/campaign-generate.test.ts src/__tests__/lib/campaign`:** 8 arquivos / **100 testes passed**.

## Known Stubs
None.

## Threat Flags
None — nenhuma superfície nova além do `<threat_model>` do plano (o bloco de prompt é saneado/delimitado; consumo precedendo o provider; v1 não enviada como referência).

## Next Phase Readiness
- Pronto para a rota `POST /api/campaign/[id]/problem-report` (plano 07) consumir `generateCorrectionV2`.
- Pendências: sem testes dedicados desta fatia (grupos §15 do tasks.md, planos 16+).

---
*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-11*

## Self-Check: PASSED

- FOUND: `.planning/phases/37.2-correcao-unica-por-nao-conformidade/37-2-08-SUMMARY.md`
- FOUND: `940e0ca0` (Task 1+2)
- FOUND: `779c789b` (Task 3)
