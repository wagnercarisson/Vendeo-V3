# Campaign Image Processor

> Synced from `fase-14-integracao-fluxo-geracao` (ADDED).

## Purpose

Serviço de transcodificação de imagem (dataUrl → JPEG sRGB q90 1080×1080 via sharp) e builder de publication copy snapshot no shape da milestone v1.3 (caption, hashtags, cta_post). Conecta `dataUrlToCampaignImage` a `uploadCampaignImage`, garantindo que o formato canônico JPEG seja respeitado.

## Requirements

### Requirement: transcodeToJpeg converte PNG para JPEG

O sistema SHALL exportar `transcodeToJpeg(buffer: Buffer, mimeType: string)` que:
- Aceita buffers com MIME `image/png`, `image/jpeg`, `image/webp`
- Converte para JPEG sRGB, qualidade 90, dimensões 1080×1080 (resize com `fit=contain` e background branco `#FFFFFF` para garantir canvas final 1080×1080 sem distorção)
- Retorna `{ buffer: Buffer; mimeType: "image/jpeg" }`
- Rejeita formato não suportado com erro descritivo

#### Scenario: transcodeToJpeg aceita PNG

- **WHEN** buffer PNG é fornecido
- **THEN** retorna buffer com MIME `image/jpeg`, dimensões 1080×1080

#### Scenario: transcodeToJpeg aceita WEBP

- **WHEN** buffer WEBP é fornecido
- **THEN** retorna buffer com MIME `image/jpeg`, dimensões 1080×1080

#### Scenario: transcodeToJpeg aceita JPEG (idempotente)

- **WHEN** buffer JPEG é fornecido
- **THEN** retorna buffer com MIME `image/jpeg`, dimensões 1080×1080 (recompressão segura)

#### Scenario: transcodeToJpeg rejeita formato inválido

- **WHEN** MIME diferente de PNG/JPEG/WEBP é fornecido
- **THEN** rejeita com erro descritivo

### Requirement: buildPublicationCopySnapshot constrói snapshot

O sistema SHALL exportar `buildPublicationCopySnapshot(data: { caption: string; hashtags: string[]; cta_post: string }): PublicationCopySnapshot` que:
- Retorna objeto no shape da milestone: `{ caption, hashtags, cta_post }`
- Aceita dados mínimos (campos obrigatórios preenchidos)
- Preserva `snake_case` nas chaves (consistente com JSONB no banco)

Os dados de entrada são montados no `generate-image/route.ts` de forma determinística a partir do `campaignInput` + correções da IA, sem exigir novos campos do provider. O builder recebe:
- `caption`: texto montado a partir de `productName` + `hook`/`description` do input, com as correções da IA aplicadas sobre hook/cta/descrição
- `hashtags`: derivado do segmento da loja e termos do input (ex.: `["#" + segmento, "#oferta", "#" + produto]`)
- `cta_post`: extraído do campo cta do input, com correções da IA se houver

O shape de saída é sempre o mesmo — o builder é uma função de transformação/garantia de tipo, não de geração de conteúdo. A origem determinística evita depender de mudança no contrato do `ImageGenerationService`.

#### Scenario: buildPublicationCopySnapshot retorna shape correto

- **WHEN** chamado com `{ caption: "texto", hashtags: ["#promo"], cta_post: "Compre agora" }`
- **THEN** retorna `{ caption: "texto", hashtags: ["#promo"], cta_post: "Compre agora" }`

#### Scenario: buildPublicationCopySnapshot com dados mínimos

- **WHEN** chamado com `{ caption: "", hashtags: [], cta_post: "" }`
- **THEN** retorna `{ caption: "", hashtags: [], cta_post: "" }` sem erro
