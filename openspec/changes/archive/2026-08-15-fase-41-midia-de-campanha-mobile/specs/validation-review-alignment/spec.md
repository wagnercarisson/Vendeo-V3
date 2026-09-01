# Validation & Review Alignment

> Delta spec for `fase-41-midia-de-campanha-mobile` (D8/D9).

## ADDED Requirements

### Requirement: Validação produto×imagem primary-only (D8)

O sistema SHALL manter `InputValidationService.validate(nome, productImageDataUrl)` (`input-validation-service.ts:40-71`) validando **apenas a imagem principal** (primary) contra o nome digitado — uma chamada vision antes da geração (comportamento atual preservado).

- **Auxiliares NÃO participam** da checagem de conflito/confiança (primary-only na v1).
- O fluxo de 409 (conflict / low-confidence / strong_conflict / override `user_confirmed_continue`) permanece **inalterado**.
- **Extensão futura registrada:** validação multi-imagem (ex.: confirmar variações/combos) quando roles avançadas forem expostas.

#### Scenario: validação usa apenas a primary

- **WHEN** o brief tem primary + 2 auxiliares e o `InputValidationService` valida o nome do produto
- **THEN** apenas a dataUrl da **primary** é enviada à chamada vision
- **AND** as auxiliares não participam da checagem

#### Scenario: fluxo de 409 inalterado

- **WHEN** a primary gera conflito/low-confidence com o nome digitado
- **THEN** a rota responde 409 com `needs_user_action` (comportamento atual preservado — D8)

### Requirement: Review com a imagem principal como referência (D9)

O sistema SHALL fazer `ImageReviewService.review(generatedImage, input)` (`image-review-service.ts:54-63`) receber, **opcionalmente**, a **dataUrl da imagem principal** e enviá-la junto ao prompt `campaign-image-reviewer` (bloco de imagem + texto).

- O revisor SHALL verificar a **fidelidade do produto na arte gerada** — o produto da imagem de referência é o produto da peça.
- **Sem nova variável de prompt do revisor** — a imagem entra como input multimodal; o texto do prompt pode ganhar uma linha fixa "Compare o produto da arte com a imagem de referência".
- **Retrocompatível:** sem primary/sem `productImagesDataUrls` → o revisor se comporta como hoje (nenhuma mudança para o caminho legado).
- Receber **TODAS** as imagens no review fica **deferido** (custo × benefício avaliado quando roles avançadas forem expostas).

#### Scenario: revisor recebe a primary como referência

- **WHEN** o brief tem uma imagem primary (dataUrl)
- **THEN** o `ImageReviewService.review` recebe a dataUrl da primary
- **AND** o prompt `campaign-image-reviewer` recebe o bloco de imagem + a linha "Compare o produto da arte com a imagem de referência"

#### Scenario: sem primary o revisor mantém comportamento atual

- **WHEN** não há imagem primary disponível (caminho legado sem referência)
- **THEN** o revisor não recebe imagem de referência
- **AND** o comportamento é idêntico ao atual (retrocompatível — D9)
