---
phase: 38-1-ai-cost-accounting
plan: 06
subsystem: ai-cost, visual-signature
tags: [onCall, AiCallInfo, responses-api, chat-completions, telemetria, best-effort, D7, D11]

requires:
  - phase: 38-1-02
    provides: AiCallInfo/TokenUsage em src/lib/ai-cost/types.ts
  - phase: 38-1-05
    provides: padrão onCall best-effort (NO ANALOG #3) nos serviços de campanha
provides:
  - AiImageGenerator.generate com onCall (usage do Responses API) — visual_signature_image
  - BrandProfilerWithoutLogoService com onCall em callVision/callVisionFull — brand_profile_vision
  - BrandProfilerInput.onCall opcional (best-effort, nunca lança — D7)
affects: [38-1-08 (rota VS), 38-1-09 (rotas brand-profile)]

tech-stack:
  added: []
  patterns:
    - "onCall opcional best-effort com invokeOnCall em try/catch silencioso (D7)"
    - "mapResponsesUsage (Responses API: input_tokens/output_tokens/total_tokens) e mapChatUsage (chat.completions + cached/image tokens) para TokenUsage"

key-files:
  created: []
  modified:
    - src/lib/visual-signature/ai-image-generator.ts
    - src/lib/visual-signature/brand-profiler.ts
    - src/lib/visual-signature/types.ts
    - src/lib/visual-signature/__tests__/brand-profiler.test.ts

key-decisions:
  - "onCall no AiImageGenerator invocado somente no caminho de sucesso (chamada concluída); erro da chamada não emite evento (evento failed é gravado pela rota)"
  - "brand-profiler.ts só contém chamadas de visão (callVision/callVisionFull); brand_profile_text é emitido pelo text-only-inference-service.ts na rota 38-1-09 — sem chamada de texto neste arquivo (D11)"
  - "onCall adicionado ao BrandProfilerInput (types.ts) — contrato opcional, retrocompatível"

patterns-established:
  - "Serviço de IA com onCall: mede durationMs em volta da chamada de provider, captura usage, invoca onCall em try/catch silencioso"

requirements-completed: [F38.1-25, F38.1-26, F38.1-27, F38.1-28, F38.1-29, F38.1-34, F38.1-35, F38.1-36, F38.1-37, F38.1-38]

duration: 8min
completed: 2026-08-08
---

# Phase 38.1 Plan 06: onCall no VS generator + BrandProfiler (visão) — Summary

**AiImageGenerator.generate e BrandProfilerWithoutLogoService passam a emitir AiCallInfo (provider/model/usage/durationMs) via callback onCall opcional best-effort, preparando visual_signature_image e brand_profile_vision para as rotas 38-1-08/09**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-08T20:23:57Z
- **Completed:** 2026-08-08T20:31:05Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `AiImageGenerator.generate` aceita `onCall` opcional e emite `{ provider: "openai", model, usage, durationMs }` após `openai.responses.create` — usage mapeado do Responses API (`input_tokens`/`output_tokens`/`total_tokens` → `TokenUsage`) via `mapResponsesUsage`; invocação best-effort via `invokeOnCall` (D7, nunca lança)
- `BrandProfilerInput.onCall` opcional adicionado ao contrato (types.ts); `generate` propaga `input.onCall` aos paths de geração; `callVision`/`callVisionFull` emitem AiCallInfo com usage do `chat.completions` (`mapChatUsage` inclui cached/image tokens — D9/D12)
- Caminhos sem chamada IA **não emitem evento**: `mockGenerate` (sem OPENAI_API_KEY em dev), cache reuse (perfil existente), fallback tipográfico (D5/6.4/6.5)
- Compat F37 preservada: `BrandProfilerWithoutLogoError` (provider/model/elapsedMs/errorType) intacto, retornos públicos inalterados, onCall nunca bloqueia (T-38.1-25 → F38.1-25)
- 4 testes novos (Testes 7–10) na suíte `brand-profiler.test.ts`: 10/10 verdes (6 existentes + 4 novos)

## Task Commits

1. **Task 1: AiImageGenerator.generate — onCall com usage do Responses API** - `13553ef` (feat)
2. **Task 2: BrandProfiler — onCall para visão (from-zero, NO ANALOG #4)** - `bf31e5d` (feat)
3. **Task 3: Testes de onCall no brand-profiler (visão/sem-evento/best-effort)** - `25563e2` (test)

## Files Created/Modified

- `src/lib/visual-signature/ai-image-generator.ts` - `params.onCall` opcional; `invokeOnCall` best-effort; `mapResponsesUsage` (Responses API)
- `src/lib/visual-signature/brand-profiler.ts` - `callVision`/`callVisionFull` emitem AiCallInfo; `invokeOnCall`; `mapChatUsage` (chat.completions)
- `src/lib/visual-signature/types.ts` - `BrandProfilerInput.onCall?: (info: AiCallInfo) => void | Promise<void>` (opcional)
- `src/lib/visual-signature/__tests__/brand-profiler.test.ts` - mock OpenAI compartilhado (`mockChatCompletionsCreate`) + describe "onCall (F38.1, D7/D11)" com 4 testes

## Decisions Made

- **onCall só no caminho de sucesso:** o AiImageGenerator invoca `onCall` após `responses.create` concluído; se a chamada falhar, o catch existente relança sem onCall — o evento `failed` com `error_type` é gravado pela rota (38-1-08), evitando dupla contagem (T-38.1-28 → F38.1-25)
- **brand-profiler só emite visão:** o arquivo `brand-profiler.ts` contém apenas chamadas de visão (`callVision`/`callVisionFull` via chat.completions com image_url). O tipo `brand_profile_text` pertence ao `text-only-inference-service.ts` (serviço separado, D5/D11), instrumentado na rota 38-1-09. Nenhuma chamada de texto foi inventada neste arquivo
- **Contrato em `BrandProfilerInput`:** o campo `onCall` vive na interface de entrada do serviço (types.ts), seguindo o padrão D7 do CopyDirectorService (parâmetro opcional na assinatura)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug no plano] Path 2 não emite 2 onCalls (visão + texto) — só 1 (visão)**
- **Found during:** Task 2/3 (Teste 3/8 do plano)
- **Issue:** O plano assumia que o path 2 (sem paleta, `generateWithFallback`) emite 2 onCalls (visão E texto). Verificado no código real: `brand-profiler.ts` só possui chamadas de visão (`callVision`/`callVisionFull`); a chamada de texto (`brand_profile_text`) pertence ao `text-only-inference-service.ts`, serviço separado instrumentado na rota 38-1-09 (D5/D11). Inventar uma chamada de texto violaria D5 (não inventar chamada).
- **Fix:** Instrumentado `callVision`/`callVisionFull` (o que D11 especifica para este arquivo); Teste 8 passou a assertar **1 onCall** (visão) no path 2, com comentário documentando o motivo.
- **Files modified:** src/lib/visual-signature/brand-profiler.ts, src/lib/visual-signature/__tests__/brand-profiler.test.ts
- **Verification:** 10/10 testes verdes; typecheck limpo
- **Committed in:** `bf31e5d` (Task 2), `25563e2` (Task 3)

---

**Total deviations:** 1 auto-fixed (1 ajuste de realidade plano × código)
**Impact on plan:** Sem impacto funcional — a instrumentação cobre exatamente as chamadas reais de IA do serviço. Os tipos `brand_profile_vision` e `brand_profile_text` continuam sendo mapeados na rota (38-1-09), conforme D11.

## Issues Encountered

- **Nenhum teste unitário para ai-image-generator:** conforme o plano (Task 1/3), não foi criado teste unitário para o `AiImageGenerator` — não existe harness de mock para o dynamic import de `responses`; a verificação funcional do onCall acontece na rota VS (38-1-08, teste 6.4). O Teste 1 foi validado por compile-time (typecheck + greps).
- **Ruído de stderr no vitest:** "Not implemented: navigation to another Document" é ruído jsdom de um teste existente (não relacionado a este plano); suíte completa 1661/1661 verde.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Serviços VS e brand prontos para as rotas: 38-1-08 consumirá `AiImageGenerator.generate` onCall (visual_signature_image + validação) e 38-1-09 consumirá `BrandProfilerWithoutLogoService` onCall (brand_profile_vision) + text-only (brand_profile_text)
- Compat F37 confirmada: erros (`BrandProfilerWithoutLogoError` com elapsedMs), cache reuse e retornos públicos inalterados

---
*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-08*
