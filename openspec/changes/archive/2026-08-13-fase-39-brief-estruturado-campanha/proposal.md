## Why

O Vendeo recebe o input da campanha como um payload flat de 21 campos (`GenerateImageRequestSchema`, zod `.strict()`), resolve a identidade da loja no backend e passa um wrapper de transporte (`CampaignBrief` atual, em `src/components/campaign/types.ts:37`) direto para o pipeline paralelo. O `input_snapshot` é um `Record<string, unknown>` **flat e sem versionamento**, e existem **três conceitos diferentes de "brief"** no código — colisão de nomeação que bloqueia as próximas fases (F37 revisão/aprovação, catálogo de produtos, múltiplas imagens, câmera). Sem um contrato de domínio estruturado, cada fase futura precisaria refatorar o mesmo flat frágil.

## What Changes

- **Novo `CampaignBrief` de domínio estruturado** (`src/lib/campaign/brief.ts` + `brief-schema.ts`): agrupado por domínio — `product` (dados estáveis do produto, separado da oferta — **D3**), `commercial` (preços, validade, aviso legal, disponibilidade), `media` (imagens), `creativeContext` (preserveImageContext, `themeId?` reservado), `metadata` (source + schemaVersion). Zod por domínio. **D4**
- **Rename do wrapper atual** para `ResolvedCampaignContext` (`src/components/campaign/types.ts`, `src/lib/store-identity-service.ts`) — elimina a colisão de nomeação com `brand_profile.campaign_brief` e com o novo contrato. **D4**
- **Mapper `flat → CampaignBrief` na fronteira da rota** (`POST /api/campaign/generate-image`): o form **continua enviando flat** nesta fase (Opção 1); a rota converte uma única vez e o pipeline passa a consumir o brief estruturado. Sem contrato duplo eterno — co-migração de testes na mesma fase. **D5**
- **Snapshot versionado `campaign_brief_v1`**: `input_snapshot` passa a ser estruturado com `schemaVersion` no root e seções por domínio; **nunca contém base64** (tipos separados runtime × snapshot por construção — **D6/D7**). Sem migration nesta fase (`jsonb` tolerante; validação no TS + testes). **D6**
- **Contrato de mídia `media.images[]`** com `id`/`role` (`primary|variation|combo_item|reference`)/`source` (`upload|camera`)/`mimeType`; nesta fase o transporte aceita **apenas 1 imagem `primary`** (invariante: sempre existe exatamente 1 `primary`; sem imagem → 400). **D7**
- **`commercial.validity { enabled, displayText?, endDate? }`**: substitui a heurística frágil de string (`/`, `até`, `válida`) no `buildCommercialRepertoire` por semântica determinística (`enabled` + `displayText`). **D8**
- **`commercial.legalNotice { enabled, text? }`**: substitui a string solta `mandatoryArtworkText`; `enabled=false` → nada entra na arte; campo canônico único em `commercial.legalNotice` (helper `getCampaignLegalNotice(brief)` para leitura direta — sem espelho no contrato). **D9**
- **`creativeContext.themeId?: string | null`** reservado — **nenhum sistema de temas** é criado nesta fase. **D10**
- **5 costuras de mappers + builder de snapshot** para o pipeline consumir o domínio sem reescrever a rota: ① flat→brief na rota; ② brief→prompts (`buildPromptVariables`/`buildCommercialRepertoire`); ③ **brief→provider/input-validation** (`media.primary.dataUrl`, base64 só em memória/transporte); ④ brief→copy (`mapBriefToCopyDirectorInput`); ⑤ brief→review (`ImageReviewInput`); ⑥ builder `buildCampaignBriefSnapshot`. **Comportamento de geração preservado** (variáveis de prompt idênticas, golden tests por intent). **D11**
- **Testes de contrato** (~34+): brief mínimo, oferta+validade, aviso on/off, imagem principal, rejeição sem imagem, snapshot sem base64, round-trip flat→brief→snapshot, ponte provider com `media.primary.dataUrl`, mappers preservam comportamento, compat com benchmark. **D12**
- **NENHUMA migration SQL** nesta fase. **D6**

## Capabilities

### New Capabilities

- `campaign-brief-contract`: Contrato de domínio `CampaignBrief` estruturado (zod + types) — `product`/`commercial`/`media`/`creativeContext`/`metadata`; produto separado da oferta (`source`/`catalogProductId?`, catálogo reservado — D3); tipos de imagem runtime × snapshot separados por construção (D7); `validity`/`legalNotice`/`themeId`; helper `getCampaignLegalNotice`.
- `campaign-brief-mapper`: Mapper `buildCampaignBriefFromFlat` (fronteira da rota, Opção 1 — D5) e rename do wrapper atual para `ResolvedCampaignContext` (D4); round-trip flat→brief preservando campos; regra de borda sem imagem → 400.
- `campaign-brief-snapshot`: Snapshot versionado `campaign_brief_v1` (`input_snapshot` estruturado, schemaVersion canônico no ROOT, sem base64 por tipo `CampaignBriefSnapshotImage`) + builder `buildCampaignBriefSnapshot` que deriva as imagens do próprio brief (D6/D7); imutável por construção.
- `campaign-brief-pipeline-adapters`: As 4 costuras de consumo (prompts, provider/input-validation, copy, review) lendo do domínio estruturado (D11) — `buildPromptVariables`/`buildCommercialRepertoire` decidem por `validity.enabled/displayText` (sem heurística), ponte `media.primary.dataUrl` → provider/`InputValidationService` (base64 só em memória), `mapBriefToCopyDirectorInput` e `ImageReviewInput` montados do domínio (com `legalNotice`/`validity`); comportamento de geração preservado (golden tests por intent).

### Modified Capabilities

- `identity-aware-campaign-briefing`: `CampaignBrief` (tipo interno) renomeado para `ResolvedCampaignContext`; `buildCampaignBrief` passa a retornar `ResolvedCampaignContext` mantendo o shape consumido pelo pipeline (D4).
- `campaign-types`: `InputSnapshot` → `CampaignBriefSnapshot` versionado (schemaVersion no root, seções por domínio, sem base64) — D6; shape do `input_snapshot` v1 flat substituído pelo snapshot estruturado.
- `mandatory-artwork-text`: `mandatoryArtworkText` (string livre) → `commercial.legalNotice { enabled, text? }` (D9); `enabled=false` → nada entra na arte; prompts/revisor continuam recebendo o texto como antes (compat preservada, fix `260804-s16` mantido).
- `ai-image-generation`: `buildPromptVariables`/`buildCommercialRepertoire` passam a ler `brief.product`/`brief.commercial`/`brief.media` (domínio) em vez de `body.*` flat — conjunto de variáveis de prompt **idêntico** para o mesmo input (D11); `validity` decidida por `enabled/displayText`.
- `transactional-pipeline`: `mapBriefToCopyDirectorInput` lê do domínio estruturado; saída `CopyDirectorInput` inalterada (D11).
- `image-quality-review`: `ImageReviewInput` montado a partir do domínio, incluindo `legalNotice` e `validity` (D11); `legalNotice.enabled=false` → revisor não recebe texto.

## Impact

- **Código novo**: `src/lib/campaign/brief.ts`, `src/lib/campaign/brief-schema.ts`; testes `src/lib/campaign/__tests__/brief.test.ts`, `brief-mapper.test.ts`, `brief-snapshot.test.ts` (D12).
- **Código modificado**: `src/lib/campaign/types.ts` (InputSnapshot → CampaignBriefSnapshot), `src/components/campaign/types.ts` (CampaignBrief → ResolvedCampaignContext), `src/lib/store-identity-service.ts` (buildCampaignBrief → ResolvedCampaignContext), `src/app/api/campaign/generate-image/route.ts` (mapper flat→brief + snapshot versionado), `src/lib/image-generation/services/image-generation-service.ts` (prompt vars/repertoire/review do domínio; ponte media.primary.dataUrl), `src/lib/copy/mapper.ts` (mapBriefToCopyDirectorInput), `src/lib/image-generation/services/image-review-service.ts` (ImageReviewInput do domínio).
- **DB/dependências**: **NENHUMA migration** (D6). `input_snapshot` continua `jsonb` tolerante; sem CHECK no banco (validação TS + testes). Sem API pública nova — único cliente é o form (+ `scripts/benchmark.ts` e testes).
- **Contratos**: schema HTTP `GenerateImageRequestSchema` (flat) **inalterado** nesta fase; domínio interno vira `CampaignBrief` estruturado. `snapshot schemaVersion` canônico no **root do snapshot**; `metadata.schemaVersion` existe **apenas no brief runtime** (`CampaignBrief`), nunca no snapshot — sem duplicação (D6).
- **Riscos notáveis**: regressão pesada em mocks/fixtures (co-migração na mesma fase, D5); colisão de 3 "briefs" (resolvida na D4); base64 vazar no snapshot (impossível por tipo — D6/D7); escopo crescer para catálogo (bloqueado pela D3); F37 (revisão/aprovação) quebrar por mudança de snapshot (F39 é pré-requisito — D2).
- **Verificação**: `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros; UAT local com geração offer/spotlight/exclusive idêntica ao atual.
