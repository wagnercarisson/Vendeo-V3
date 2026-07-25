## Why

A Fase 31.1 preparou o terreno definindo `CampaignIntent` ("offer", "spotlight", "exclusive") nos tipos, schemas e formulário, mas deixou **três bloqueios explícitos** (UI, form submit, pipeline guard HTTP 400) e **dois bloqueios contratuais** (`discountedPriceCents` obrigatório, `CampaignSpecSchema` promocional). O diretor de imagem e o copy director ainda usam o mesmo prompt único — sempre com framing promocional, sempre assumindo `DE / POR`, sempre com badge "Promoção" e urgência.

Esta fase **desbloqueia, roteia e adapta** as três intenções comerciais — desde o formulário até a entrega dos diretores de imagem e copy — para que spotlight e exclusive sejam funcionalmente utilizáveis, mantendo offer sem regressão.

## What Changes

- **Desbloqueio de intents**: remover "Em breve" do seletor, habilitar submit para spotlight/exclusive, remover guard HTTP 400 do pipeline
- **Contratos tolerantes por intent**: `discountedPriceCents` opcional nos schemas do pipeline, `CampaignSpecSchema` com `discounted_price_display` e `badge_text` nullable
- **Normalização de exclusive**: se exclusive chegar com `discountedPriceCents`, normalizar para ausente (com log) antes de qualquer processamento
- **Prompts separados por intent**: 6 novos arquivos de prompt (3 image-director + 3 copy-director), selecionados automaticamente por `campaignIntent`
- **Sem fallback silencioso de prompt**: intent válida sem prompt correspondente falha no preflight — evitar gerar exclusive com framing promocional
- **Copy Director adaptado**: `CopyDirectorInput` ganha `campaignIntent` e substitui `offer` por `commercialFrame` (string sempre presente, conteúdo varia por intent)
- **Conteúdo adaptado por intent**: `buildCommercialRepertoire` e `buildCreativeContextGuidance` calibrados para offer (urgência), spotlight (descoberta) e exclusive (exclusividade)
- **preserveImageDirective**: injetada no prompt de imagem quando `preserveImageContext === true` (exclusivo para spotlight/exclusive)
- **Fallback determinístico de copy**: `buildDeterministicCopy(campaignIntent, ...)` gera texto diferente por intent, em vez de `buildOfferText` incondicional

## Capabilities

### New Capabilities
- `prompt-templates-by-intent`: Define os 6 templates de prompt (offer/spotlight/exclusive × image-director/copy-director), suas variáveis, e as regras de seleção por `campaignIntent` em `assemblePrompt`, `validatePrompts` e `CopyDirectorService`

- `schema-intent-contracts`: Define `discountedPriceCents` opcional nos schemas do pipeline, `CampaignSpecSchema` com `discounted_price_display` e `badge_text` nullable, `InputSnapshot` adaptado, e normalização de exclusive com preço indevido

### Modified Capabilities
- `campaign-intent-types`: Adicionar requisitos de desbloqueio — spotlight/exclusive deixam de ser bloqueados, exclusive normaliza preço para ausente, comportamento esperado de cada intent documentado

- `copy-director`: Adicionar `campaignIntent` no input schema, substituir campo `offer` por `commercialFrame` (string sempre presente, conteúdo condicional por intent), selecionar prompt `campaign-copy-director-${intent}`, sem fallback silencioso

- `ai-image-generation`: Selecionar prompt `campaign-image-director-${intent}` em `assemblePrompt` e `validatePrompts`, sem fallback silencioso; adicionar `preserveImageDirective` às variáveis; adaptar `buildCommercialRepertoire` e `buildCreativeContextGuidance` por intent

- `campaign-form-intent`: Remover bloqueio de submit para spotlight/exclusive no `handleSubmit`; manter validação condicional de preço/badge (offer exige preço, spotlight/exclusive são tolerantes)

- `campaign-input-ui`: Remover badge "Em breve" do `IntentSelector`; remover condição `campaignIntent !== "offer"` do botão submit disabled; botão mostra "Criar Campanha" para todas as intents

## Impact

- **Schemas**: `src/lib/image-generation/schema.ts`, `src/lib/campaign-intelligence/schema.ts`, `src/lib/campaign/types.ts`
- **Prompts**: 6 novos arquivos em `prompts/` (3 image + 3 copy)
- **Serviços**: `ImageGenerationService` (prompt routing, repertoire, guidance), `CopyDirectorService` (prompt routing), `CopyDirectorInput`
- **Mapper**: `mapBriefToCopyDirectorInput` → `buildCommercialFrame` no lugar de `buildOfferText`
- **Pipeline route**: guard HTTP 400 removido, normalização de exclusive adicionada, fallback determinístico adaptado
- **UI**: IntentSelector sem "Em breve", submit habilitado para todas as intents
- **Form state**: guard early-return removido, `discountedPriceCents` fluido por intent
- **Provedores**: `MockProvider` e `OpenAIProvider` ajustados para schema nullable
- **Sem migrations**: zero alterações em banco de dados
