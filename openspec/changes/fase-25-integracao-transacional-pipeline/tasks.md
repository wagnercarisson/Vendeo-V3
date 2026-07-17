## 1. Config + Migration

- [ ] 1.1 Adicionar `COST_PER_GENERATION = 1` em `src/lib/image-generation/config.ts`
- [ ] 1.2 Criar migration `supabase/migrations/20260717000001_create_generation_rate_events.sql` com DDL, índice composto `(store_id, event_type, created_at DESC)`, RLS com policy `owner_select_generation_rate_events`, GRANT SELECT TO authenticated
- [ ] 1.3 Adicionar `@google/generative-ai` ao `package.json` (dependência oficial do SDK Google Gemini) e atualizar lockfile
- [ ] 1.4 Criar env vars de configuração Gemini: `TEXT_FALLBACK_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL` em `.env.example`
- [ ] 1.5 Migrar `GEMINI_MODEL` (legado) para `GEMINI_TEXT_MODEL` — se `.env.local` tem `GEMINI_MODEL`, o valor deve ser lido como fallback de `GEMINI_TEXT_MODEL`, ou renomeado na migração

## 2. Rate Limit Service

- [ ] 2.1 Criar `src/lib/rate-limit/types.ts` com `RateLimitConfig`, `RateLimitResult`, `GenerationRateEvent`
- [ ] 2.2 Criar `src/lib/rate-limit/rate-limit.ts` com `checkRateLimit(storeId)` — consulta janelas de 1h e 24h via SQL, retorna `{ allowed, remaining, resetTime }`
- [ ] 2.3 Implementar `recordGenerationAttempt(storeId, userId, campaignId?)` — INSERT em `generation_rate_events` com `event_type = 'generation_attempt'`, `campaign_id = null` quando a campanha ainda não existe

## 3. GeminiTextProvider (fallback de retry)

- [ ] 3.1 Criar `src/lib/text-provider/gemini.ts` com `GeminiTextProvider` implementando `TextProvider`, usando SDK Google Gemini, modelo `gemini-3.1-flash-lite` (configurável via `GEMINI_TEXT_MODEL`)
- [ ] 3.2 Atualizar `src/lib/text-provider/factory.ts` para suportar `createTextProvider('gemini')` ativado via `TEXT_FALLBACK_PROVIDER=gemini`

## 4. Copy Director — AbortSignal + isRetryableError

- [ ] 4.1 Criar classes de erro em `src/lib/copy/errors.ts`: `MalformedResponseError`, `ProviderRateLimitError`, `Provider5xxError`, `NetworkError`, `SafetyBlockError`, `AuthConfigError`, `PayloadTooLargeError`
- [ ] 4.2 Criar `isRetryableError(err)` em `src/lib/copy/errors.ts` — classifica erro como retryable (timeout, rate limit provider, 5xx, MalformedResponseError, network) ou não retryable (Zod, SafetyBlockError, AuthConfigError, PayloadTooLargeError)
- [ ] 4.3 Modificar `CopyDirectorService.generateCopy()` para aceitar e propagar `AbortSignal` para `TextProvider.generateText()`, preservando compatibilidade retroativa (signal opcional)
- [ ] 4.4 Modificar `CopyDirectorService.parseResult()`: reduzir de 3 para 2 tiers (JSON → regex). Remover o fallback determinístico (`DETERMINISTIC_FALLBACK`) da cadeia de parse. Lançar `MalformedResponseError` se ambos JSON e regex falharem — permite que o retry seletivo do pipeline capture e retente com Gemini

## 5. mandatoryArtworkText

- [ ] 5.1 Adicionar `mandatoryArtworkText?: string` opcional no `GenerateImageRequestSchema` (Zod)
- [ ] 5.2 Criar componente `src/components/campaign/mandatory-artwork-field.tsx` — campo opcional no formulário de campanha, abaixo do CTA
- [ ] 5.3 Propagar `mandatoryArtworkText` no `inputSnapshot` e no brief do Image Director (`briefComMandatoryArtwork`)
- [ ] 5.4 Atualizar `buildPromptVariables()` em `src/lib/image-generation/services/image-generation-service.ts` para incluir `mandatoryArtworkText` nas variáveis retornadas
- [ ] 5.5 Atualizar `prompts/campaign-image-director.md` — adicionar linha `| **Texto obrigatório na arte** | {{mandatoryArtworkText}} |` na tabela de informações da campanha e instrução de renderização obrigatória
- [ ] 5.6 Garantir que `mandatoryArtworkText` NÃO entra no `CopyDirectorInput` nem no `publication_copy_snapshot`

## 6. Mapper CampaignBrief → CopyDirectorInput

- [ ] 6.1 Implementar `mapBriefToCopyDirectorInput(brief, input)` — monta `CopyDirectorInput` a partir do `CampaignBrief` + `CampaignInput`
- [ ] 6.2 Implementar `buildOfferText(input)` — monta texto da oferta a partir de `badgeText`, `originalPriceCents`, `discountedPriceCents`

## 7. Pipeline Transactional (POST /api/campaign/generate-image)

- [ ] 7.1 Reestruturar handler em 3 zonas: PRÉ-STREAM (síncrono), PARALELO (ReadableStream), PÓS-PARALELO (ReadableStream)
- [ ] 7.2 Implementar rate limit guard (zona PRÉ-STREAM): chamar `checkRateLimit(storeId)` → se excedido, retornar 429 antes de qualquer operação paga
- [ ] 7.3 Implementar registro de tentativa: INSERT em `generation_rate_events` imediatamente após rate limit guard passar, com `campaign_id = null`
- [ ] 7.4 Implementar saldo check (zona PRÉ-STREAM): `creditService.getBalance(storeId)` < `COST_PER_GENERATION` → 402 Payment Required
- [ ] 7.5 Implementar reserva de crédito (após criar campanha, antes do stream): `creditService.reserveCredit(storeId, 1, { campaignId, idempotencyKey: \`reserve_${campaignId}\` })`
- [ ] 7.6 Implementar ramo paralelo com `Promise.all([ copyDirectorTask(), imageGenerationTask() ])` dentro do ReadableStream
- [ ] 7.7 Implementar `copyDirectorTask()` com retry seletivo: 1ª tentativa primary, 2ª tentativa Gemini (se `isRetryableError`), `AbortSignal` para aborto, emissão de NDJSON `phase` events
- [ ] 7.8 Implementar `imageGenerationTask()` com `briefComMandatoryArtwork`, sem retry externo, emissão de NDJSON `phase` events
- [ ] 7.9 Implementar merge pós-paralelo: `publicationCopySnapshot = copyDirectorResult`, transcode JPEG, upload storage, `updateCampaignReady`, crédito confirmado (no-op)
- [ ] 7.10 Implementar estorno em falha: se qualquer ramo falha ou persistência falha após merge → `creditService.refundCredit(txId, reason, { idempotencyKey: \`refund_${txId}\` })` + `updateCampaignError`
- [ ] 7.11 Implementar `AbortController` no ramo remanescente quando o outro ramo falha definitivamente

## 8. Onboarding Grant (POST /api/store)

- [ ] 8.1 Criar SQL function `create_store_with_initial_grant()` — INSERT store + `grant_credits(storeId, 5, 'onboarding', onboarding_${storeId})` na mesma transação
- [ ] 8.2 Modificar `POST /api/store/route.ts` para chamar a RPC transacional no lugar do INSERT direto
- [ ] 8.3 Se RPC inviável, implementar fallback: INSERT store → grant → se grant falhar, DELETE store + erro 500

## 9. Compatibilidade Retroativa (title?)

- [ ] 9.1 Atualizar `src/lib/campaign/display.ts` — `getEffectivePublicationCopy()` inclui `title?` do snapshot/current, tratando ausência sem quebra
- [ ] 9.2 Atualizar `src/lib/campaign/publication-copy.ts` — `validatePublicationCopy()` aceita `title?` (opcional, não exigido)
- [ ] 9.3 Atualizar schema da rota `PATCH /api/campaign/[id]/publication-copy` para aceitar `title?`

## 10. Testes

- [ ] 10.1 Criar `src/lib/rate-limit/__tests__/rate-limit.test.ts` com 5+ testes: checkRateLimit abaixo do limite, excedido 1h, excedido 24h, INSERT após guard, evento permanece em falha
- [ ] 10.2 Adicionar testes no arquivo existente `src/app/api/campaign/generate-image/__tests__/route.test.ts` (ou criar se não existir): fluxo completo saldo suficiente → ready (#1)
- [ ] 10.3 Teste: 402 saldo insuficiente (#2)
- [ ] 10.4 Teste: 429 rate limit hora (#3) e 429 rate limit dia (#4)
- [ ] 10.5 Teste: Copy result vira publication_copy_snapshot (#5) e paralelismo (#6)
- [ ] 10.6 Teste: mandatoryArtworkText no snapshot visual mas não no copy (#7, #28) e ausente não quebra (#8)
- [ ] 10.7 Teste: Image falha → estorno (#9), Copy falha → estorno (#10), ambos falham → estorno único (#11)
- [ ] 10.8 Teste: Persistência falha → estorno + limpa imagem (#12)
- [ ] 10.9 Teste: Reserva idempotente (#13) e refund idempotente (#14)
- [ ] 10.10 Teste: Timeout global → estorno (#15) e erro não retryable → falha imediata (#16)
- [ ] 10.11 Teste: Retry copy — falha retryable → retry Gemini OK → ready (#17)
- [ ] 10.12 Teste: Retry copy — falha retryable → retry Gemini falha → estorno (#18)
- [ ] 10.13 Teste: Retry copy — Gemini não configurado → estorno sem fallback (#19)
- [ ] 10.14 Teste: Image falha (retry interno esgotado) → estorno (#20) e Image recupera via retry interno → ready (#21)
- [ ] 10.15 Teste: Copy falha definitiva (não retryable) → estorno imediato (#22)
- [ ] 10.16 Teste: Onboarding — loja + grant (#23), grant idempotente (#24), grant falha → loja não criada (#25)
- [ ] 10.17 Teste: mandatoryArtworkText no inputSnapshot (#26), no Image Director (#27), AUSENTE no Copy Director (#28)
- [ ] 10.18 Teste: Campanha antiga sem title → UI não quebra (#29), campanha F25 com title → snapshot correto (#30)
- [ ] 10.19 Teste: Edição manual aceita title? opcional (#31), edição manual preserva title em campanha F25 (#32)
- [ ] 10.20 Teste: Rate limit — INSERT imediatamente após guard (#33), evento permanece mesmo em falha (#34)

## 11. Verificação final

- [ ] 11.1 Executar `npx vitest run src/app/api/campaign/generate-image/__tests__/route.test.ts` — 34+ testes passando
- [ ] 11.2 Executar `npm run typecheck` — zero erros
- [ ] 11.3 Executar `npm run lint` — zero erros
- [ ] 11.4 Executar `npx vitest run` — novos + existentes passando, zero regressão
- [ ] 11.5 Executar `npm run build` — build bem-sucedido
