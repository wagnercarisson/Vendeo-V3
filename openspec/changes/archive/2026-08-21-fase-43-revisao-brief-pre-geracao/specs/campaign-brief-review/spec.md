# Campaign Brief Review

## Purpose

Gate client-side obrigatório de revisão do brief pré-geração (F43 D2/D3/D4/D6/D7): o formulário de campanha passa por uma **tela intermediária de resumo** (não modal) entre o preenchimento e o `POST /api/campaign/generate-image`. A revisão mostra **exatamente o que será enviado** (imagens já comprimidas/HEIC/EXIF), com seções Produto/Oferta/Imagens/Avisos/Custo, loja/marca ativa, rótulos Principal/Referência, "Vai consumir X crédito(s)" + saldo, e slot "Tema" reservado (preparação F44). Nenhum POST, chamada de IA, `createCampaign`, upload de inputs ou `reserveCredit` acontece antes da confirmação humana explícita.

## ADDED Requirements

### Requirement: Gate de revisão obrigatório em tela intermediária (reviewMode)

O sistema SHALL inserir um gate de revisão humana obrigatório entre o formulário de campanha e o `POST /api/campaign/generate-image`, via novo estado no hook `useCampaignForm` (`step: "form" | "review"` ou `reviewMode: boolean`) — **tela intermediária no mesmo fluxo, NÃO modal** (modal aperta no mobile e piora acessibilidade — D2/D7).

- O botão principal do formulário deixa de disparar o POST e vira **"Revisar e gerar"**.
- O formulário só entra em revisão quando a validação client-side passa (gate `isValid`/`validateAll` existentes).
- Nenhum POST é feito antes da confirmação → sem IA, sem `createCampaign`, sem upload de inputs e sem `reserveCredit` prematuros.
- Campanha "generating"/"error" por clique acidental deixa de existir.
- Refresh na revisão mantém o comportamento atual (limpeza de draft no mount) — retenção em `sessionStorage` é decisão de planejamento, não exigência.

#### Scenario: Botão do form vira "Revisar e gerar" e não dispara POST

- **WHEN** o formulário de campanha é renderizado com o formulário válido
- **THEN** o botão principal exibe "Revisar e gerar"
- **AND** clicar nele **não** dispara o `POST /api/campaign/generate-image`
- **AND** a tela de revisão do brief é exibida

#### Scenario: Form inválido não entra em revisão

- **WHEN** o usuário clica "Revisar e gerar" com o formulário inválido (campo obrigatório ausente)
- **THEN** a revisão **não** abre
- **AND** os erros de validação existentes são exibidos no formulário (comportamento atual preservado)

#### Scenario: Nenhum POST antes da confirmação

- **WHEN** o usuário chega à tela de revisão
- **THEN** nenhum `POST /api/campaign/generate-image` foi disparado até a confirmação
- **AND** nenhuma campanha foi criada, nenhum input foi enviado e nenhum crédito foi reservado

### Requirement: Transições Voltar e editar / Confirmar e gerar campanha

O sistema SHALL prover duas ações na tela de revisão:

- **"Voltar e editar"** — retorna ao formulário preservando `fields`/`touched`/`fieldErrors` em memória (nada é perdido).
- **"Confirmar e gerar campanha"** — **trava o snapshot revisado** (congela os valores/`preparedImages` que serão enviados; desabilita interação) e dispara o fluxo real: monta o body via `buildCampaignGenerationBody` (D4) com `inputValidationOverride.productImageCheck: "brief_review_confirmed"` e chama `consumeStream`. A partir daqui o fluxo existente é inalterado (`isSubmitting` → `GenerationProgress`, 409 de conflito, navegação para `/campanhas/[id]`).

#### Scenario: Voltar e editar preserva tudo

- **WHEN** o usuário preenche o formulário, vai à revisão e clica "Voltar e editar"
- **THEN** o formulário é exibido com `fields`/`touched`/`fieldErrors` preservados (nada perdido)

#### Scenario: Confirmar trava o snapshot e dispara o submit real

- **WHEN** o usuário clica "Confirmar e gerar campanha"
- **THEN** o snapshot revisado é travado (body imutável a partir da confirmação)
- **AND** a interação na tela de revisão é desabilitada durante a geração
- **AND** o body montado carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"`
- **AND** o fluxo real de geração é disparado (`GenerationProgress`, 409, navegação — inalterados)

### Requirement: Compressão das imagens antes da revisão (prepareCampaignImages)

O sistema SHALL prover o helper puro `prepareCampaignImages(fields: CampaignFormFields): Promise<PreparedCampaignImage[]>` que prepara as imagens do produto **antes** de exibir a revisão (D3):

- Reutiliza `compressImage` (`use-campaign-form.ts:13-94`, HEIC/EXIF via `createImageBitmap from-image`).
- Normaliza `mimeType` para `image/jpeg`.
- Preserva `role` (`primary`/`reference`) e `source` (`upload`/`camera`).
- Cobre itens restaurados de draft que já têm `dataUrl` (sem re-comprimir — só normaliza mimeType).
- Roda ao entrar em `reviewMode`; UI curta "Preparando imagens..." enquanto comprime.
- Falha de compressão → volta ao form com erro claro (mensagem PT-BR, mesmo padrão do `submitError`).
- O submit deixa de re-comprimir (o trabalho já foi feito na entrada da revisão) — a revisão mostra **o payload final**.

#### Scenario: Revisão mostra o payload final comprimido

- **WHEN** o usuário adiciona uma imagem HEIC (camera) e entra na revisão
- **THEN** `prepareCampaignImages` roda e o thumbnail da revisão usa o JPEG comprimido (`mimeType: image/jpeg`, dataUrl do `compressImage`, orientação EXIF respeitada)
- **AND** o que o usuário vê é o que será enviado no payload

#### Scenario: Preparando imagens durante a compressão

- **WHEN** o usuário entra em revisão e as imagens ainda estão sendo comprimidas
- **THEN** a UI exibe o estado curto "Preparando imagens..."

#### Scenario: Falha de compressão volta ao form com erro

- **WHEN** `prepareCampaignImages` falha durante a entrada na revisão
- **THEN** o formulário é exibido de volta
- **AND** um erro claro PT-BR é exibido (mesmo padrão do `submitError`)

#### Scenario: Item de draft com dataUrl é normalizado sem re-comprimir

- **WHEN** um item restaurado de draft já tem `dataUrl`
- **THEN** `prepareCampaignImages` o normaliza para `mimeType: image/jpeg` sem recomprimir
- **AND** preserva `role`/`source`

### Requirement: Helper único de body (buildCampaignGenerationBody)

O sistema SHALL prover o helper puro `buildCampaignGenerationBody(fields, preparedImages, storeId, options?)` que monta o body do `POST /api/campaign/generate-image` (D4), reutilizado pela revisão e pelo submit (single source of truth dos derivados):

```ts
buildCampaignGenerationBody(
  fields: CampaignFormFields,
  preparedImages: PreparedCampaignImage[],
  storeId: string,
  options?: { inputValidationOverride?: { productImageCheck: "brief_review_confirmed" } }
): Record<string, unknown>
```

O body SHALL usar os **MESMOS derivados que a revisão exibe**:
- `validity` via `buildValidityDisplayText(fields)` (apenas quando `campaignIntent === "offer"`).
- `mandatoryArtworkText` via `buildMandatoryArtworkText(showIllustrativeNotice, mandatoryArtworkTextFree)`.
- `campaignIntent`, `badgeText`, preços, `description`, `preserveImageContext` (condicional, intent ≠ offer).
- **Imagens:** com auxiliares → `productImages = preparedImages.map(({ role, source, mimeType, dataUrl }) => ({ role, source, mimeType, dataUrl }))` (sem `id` de cliente); sem auxiliares → `productImageDataUrl` (legado).
- `inputValidationOverride` via `options` (presente no caminho confirmado).

#### Scenario: Body derivados idênticos ao exibido

- **WHEN** a revisão mostra validade "até 30/09", aviso ilustrativo + texto obrigatório, intent oferta, badge, preços e imagens normalizadas
- **THEN** `buildCampaignGenerationBody` produz um body com `validity: "até 30/09"`, `mandatoryArtworkText` concatenado, `campaignIntent`, `badgeText`, preços e as imagens normalizadas — **idênticos** ao que a tela mostra

#### Scenario: Body com productImages quando há auxiliares

- **WHEN** `preparedImages` tem 1 primary + 2 reference
- **THEN** o body contém `productImages` com 3 itens `{ role, source, mimeType, dataUrl }`
- **AND** nenhum item contém `id` de cliente
- **AND** o body NÃO contém `productImageDataUrl`

#### Scenario: Body legado sem auxiliares

- **WHEN** `preparedImages` tem apenas a primary
- **THEN** o body contém `productImageDataUrl` (caminho legado)
- **AND** o body NÃO contém `productImages`

#### Scenario: Body carrega brief_review_confirmed no caminho confirmado

- **WHEN** o usuário confirma a geração
- **THEN** o body montado carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"`

### Requirement: Conteúdo do resumo do brief (seções + rótulos + custo + Tema)

A tela de revisão SHALL exibir um resumo completo e honesto do brief (D6):

- **Topo:** loja/marca ativa (`StoreIdentityBlock` — o lojista confirma que é a loja certa).
- **Seção Produto:** nome, descrição (se houver).
- **Seção Oferta:** tipo de campanha (Oferta/Destaque/Exclusivo), selo (badge), preço original (se houver), preço com desconto, validade formatada.
- **Seção Imagens:** **imagem principal** (obrigatória, rótulo **"Principal"**) + **referências autorizadas** (rótulo **"Referência"**) — apoio visual / variação / combo / ângulo; as adicionais **não substituem a principal**, mas **autorizam elementos visuais de suporte** na arte; thumbnails do payload final (D3) exibidas **sem recorte** (`object-contain`, célula `aspect-square`).
- **Seção Avisos:** aviso "imagem meramente ilustrativa" (checkbox) + texto obrigatório.
- **Seção Custo:** **"Vai consumir X crédito(s)"** + saldo atual; "Confirmar" bloqueado quando custo indisponível/desativado/saldo insuficiente (mesma lógica `submitDisabled`).
- **Seção Tema:** **slot opcional reservado** — NÃO renderiza enquanto `creativeContext.themeId` for null (hoje sempre); preparação para a F44 (Temas de Campanha).

#### Scenario: Seções renderizam com os valores do brief

- **WHEN** a revisão abre com um form válido (produto, oferta, imagens, avisos)
- **THEN** as seções Produto/Oferta/Imagens/Avisos/Custo renderizam com os valores do brief
- **AND** a loja/marca ativa aparece no topo

#### Scenario: Rótulos Principal e Referência nas thumbnails

- **WHEN** a revisão exibe as imagens
- **THEN** a imagem principal é rotulada "Principal"
- **AND** as referências autorizadas são rotuladas "Referência"

#### Scenario: Custo e saldo exibidos; Confirmar bloqueado sem condição

- **WHEN** a revisão exibe a seção Custo
- **THEN** mostra "Vai consumir X crédito(s)" + saldo atual
- **AND** com custo indisponível/desativado/saldo insuficiente, o botão "Confirmar e gerar campanha" fica bloqueado

#### Scenario: Tema não renderiza (slot reservado para F44)

- **WHEN** `creativeContext.themeId` é null (hoje sempre)
- **THEN** a seção Tema **não** renderiza
- **AND** o slot permanece reservado no contrato para a F44 (Temas de Campanha)

### Requirement: A11y, mobile e microcopy da revisão

A tela de revisão SHALL preservar os padrões de acessibilidade, mobile e microcopy do formulário (D7):

- Touch targets ≥ 44px; foco visível; PT-BR; leitura com `label`/`aria` nos botões.
- Microcopy: aviso "Revise textos, preços e imagens antes de publicar: a IA pode cometer erros." na tela de revisão.
- Estados de loading: "Preparando imagens..." (D3), loading no botão de confirmar (padrão do form), desabilitação durante a confirmação (snapshot travado).
- Preview das imagens **sem recorte** (`object-contain`, célula `aspect-square`) — nunca cortar a imagem visualmente, especialmente no mobile.
- Revisão em telas estreitas: seções empilham; thumbnails com grid; sem scroll horizontal.

#### Scenario: Botões com touch ≥ 44px e a11y

- **WHEN** a tela de revisão renderiza "Voltar e editar" e "Confirmar e gerar campanha"
- **THEN** os botões têm touch target ≥ 44px
- **AND** têm `label`/`aria` legíveis (PT-BR)

#### Scenario: Preview sem recorte em telas estreitas

- **WHEN** a revisão é exibida em tela estreita (320px/375px)
- **THEN** as thumbnails usam `object-contain` em célula `aspect-square` (imagem nunca é cortada visualmente)
- **AND** as seções empilham sem scroll horizontal

#### Scenario: Microcopy de revisão presente

- **WHEN** a tela de revisão é exibida
- **THEN** o aviso "Revise textos, preços e imagens antes de publicar: a IA pode cometer erros." está presente

#### Scenario: Sem imagens utilizáveis a revisão bloqueia

- **WHEN** o usuário tenta entrar em revisão sem imagem primária utilizável (nem `file`, nem `dataUrl`, nem restaurada)
- **THEN** a revisão é bloqueada
- **AND** a mensagem de imagem obrigatória é exibida