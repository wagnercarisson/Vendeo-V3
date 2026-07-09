## Why

A Fase 13 criou o serviço de persistência (`persistence.ts`, `types.ts`, rota de download), mas o fluxo de geração (`POST /api/campaign/generate-image`) ainda armazena a campanha apenas em `sessionStorage` e redireciona para `/campaign/preview`. Sem essa integração, toda campanha gerada é efêmera — o lojista não pode revisitá-la, baixá-la depois, ou construir um histórico. A milestone v1.3 exige que toda campanha nasça persistida; esta fase (Fase 14) conecta o fluxo de geração aos serviços de persistência da F13, fazendo com que cada campanha seja registrada no banco e no Storage imediatamente durante a geração.

## What Changes

- **generate-image/route.ts**: INSERT `generating` antes da IA, transcode PNG/WEBP → JPEG sRGB q90 1080×1080 com sharp, upload ao Storage, UPDATE `ready`/`error` após geração, NDJSON estendido com `campaignId` + `campaignUrl`
- **Novo `image-processor.ts`**: `transcodeToJpeg` (sharp) e `buildPublicationCopySnapshot` (shape da milestone)
- **`types.ts`**: `PublicationCopySnapshot` realinhado para `caption`, `hashtags[]`, `cta_post` (kit de publicação da milestone)
- **`use-campaign-form.ts`**: navega para `/campanha/[id]` em vez de `/campaign/preview`; mantém rascunho do formulário em `sessionStorage`
- **`export const runtime = "nodejs"`** explícito na rota generate-image

## Capabilities

### New Capabilities
- `campaign-image-processor`: Transcodificação de imagem (dataUrl → JPEG sRGB q90 1080×1080 via sharp) e builder de publication copy snapshot no shape da milestone
- `campaign-generation-navigation`: Consumer no cliente que navega para `/campanha/[id]` no sucesso da geração, mantendo rascunho do formulário

### Modified Capabilities
- `campaign-persistence-service`: Adicionar `transcodeToJpeg` e `buildPublicationCopySnapshot` como novas operações; modificar o pipeline do `generate-image/route.ts` para orquestrar o fluxo completo (INSERT → IA → transcode → upload → updateReady)
- `campaign-types`: `PublicationCopySnapshot` realinhado para `caption: string`, `hashtags: string[]`, `cta_post: string` (snake_case no JSONB, conforme milestone v1.3)

## Impact

- **Novos arquivos:** `src/lib/campaign/image-processor.ts`, `src/__tests__/lib/campaign/processor.test.ts`, `src/__tests__/api/campaign-generate.test.ts`
- **Arquivos modificados:** `src/app/api/campaign/generate-image/route.ts`, `src/lib/campaign/types.ts`, `src/components/flow/use-campaign-form.ts`
- **Dependência:** `sharp` instalado como runtime dependency
- **Runtime:** `generate-image/route.ts` declara `export const runtime = "nodejs"` (sharp é incompatível com Edge)