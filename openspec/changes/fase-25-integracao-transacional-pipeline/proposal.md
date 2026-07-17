## Why

A F23 entregou `TextProvider` + `CopyDirectorService` — IA de copy persuasiva funcional. A F24 entregou `CreditService` + ledger imutável — a camada financeira. Ambas são fundações prontas, mas não integradas ao pipeline real de geração. Hoje o copy ainda é determinístico, não há saldo check/reserva/estorno, não há rate limit, `mandatoryArtworkText` não existe no formulário, e o onboarding não concede créditos iniciais. A F25 é a **cola transacional** que conecta essas fundações no `POST /api/campaign/generate-image`.

## What Changes

- **Pipeline financeiro** — `COST_PER_GENERATION = 1`, saldo check (402), reserva, confirmação e estorno na rota `generate-image`
- **Copy Director integrado** — `CopyDirectorService.generateCopy()` substitui `buildCaption()`/`buildHashtags()` determinísticos; `publication_copy_snapshot` vem do resultado da IA
- **Pipeline paralelo** — Copy Director + Image Director executam em `Promise.all` (copy não influencia arte)
- **Rate limit** — 10 gerações/hora e 30/dia por loja, verificado antes de qualquer chamada de IA (429)
- **`mandatoryArtworkText`** — campo opcional no formulário que, quando preenchido, vira texto obrigatório na arte (exclusivo do Image Director)
- **Onboarding grant** — 5 créditos gratuitos na criação da loja (`POST /api/store`)
- **Retry seletivo com fallback Gemini** — Copy Director faz até 2 tentativas: 1ª com provider primário (OpenAI), 2ª com Gemini como fallback em erros retryable
- **Compatibilidade retroativa** — campanhas v1.3/v1.4 sem `title` continuam funcionando

## Capabilities

### New Capabilities
- `transactional-pipeline`: Pipeline transacional com 3 zonas (pré-stream, paralelo, pós). Rate limit guard → saldo check → reserva → Copy Director ∥ Image Director → merge → confirmação/estorno. Retry seletivo do Copy Director com fallback Gemini. Idempotência de reserva e estorno.
- `rate-limit`: Tabela `generation_rate_events` (DDL + índice + RLS). Consulta de janela deslizante (1h/24h). HTTP 429 antes de qualquer operação paga. Registro imediato da tentativa com `campaign_id = null`.
- `mandatory-artwork-text`: Campo opcional `mandatoryArtworkText` no `GenerateImageRequestSchema`. Propagado no `inputSnapshot` e no brief do Image Director. **Excluído** do `CopyDirectorInput`. Componente de campo no formulário de campanha.
- `onboarding-grant`: 5 créditos concedidos na criação da loja via RPC transacional `create_store_with_initial_grant()`. Idempotência com chave `onboarding_${storeId}`. Falha do grant → rollback da criação da loja.

### Modified Capabilities
- `copy-director`: `generateCopy()` passa a propagar `AbortSignal` para `TextProvider.generateText()`. Interface e contrato de retry seletivo documentados (até 2 tentativas, fallback Gemini).
- `campaign-display-contract`: `getEffectivePublicationCopy()` passa a incluir `title?` opcional do snapshot, tratando ausência sem quebra.
- `publication-copy-validation`: `validatePublicationCopy()` passa a aceitar `title?` sem exigir o campo.

## Impact

- **Rotas modificadas:** `POST /api/campaign/generate-image` (reestruturação pesada em 3 zonas), `POST /api/store` (grant de créditos)
- **Arquivos novos:** `src/lib/text-provider/gemini.ts` (GeminiTextProvider), `src/lib/rate-limit/types.ts`, `src/lib/rate-limit/rate-limit.ts`, `src/components/campaign/mandatory-artwork-field.tsx`, migration `20260717000001_create_generation_rate_events.sql`
- **Arquivos modificados:** `src/lib/image-generation/config.ts` (COST_PER_GENERATION), `src/lib/campaign/image-processor.ts`, `src/lib/campaign/display.ts`, `src/lib/campaign/publication-copy.ts`, `src/lib/copy/copy-director-service.ts`
- **Config:** Novas env vars `TEXT_FALLBACK_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`
- **Nenhuma UI nova além do campo `mandatoryArtworkText`** no formulário de campanha
- **34+ testes** novos em `src/app/api/campaign/generate-image/__tests__/route.test.ts`
