# Campaign Media Upload

> Synced from `fase-41-midia-de-campanha-mobile` (ADDED).

## Purpose

Upload de mídia multi-imagem no formulário de campanha (F41 D3/D4/D10 — cliente): 1 imagem **primary** obrigatória + até `MAX_CAMPAIGN_IMAGES - 1` auxiliares opcionais, via **galeria e câmera** (`capture="environment"`), preview grid com remoção por item, atribuição de `source: "upload" | "camera"`, decode HEIC via canvas, orientação EXIF respeitada e limites por item/teto no cliente. As auxiliares entram como `role: "reference"` — roles avançadas não são expostas ao lojista na v1.

## Requirements

### Requirement: Imagem principal obrigatória + auxiliares opcionais

O sistema SHALL prover um upload de mídia no formulário de campanha com **1 imagem do produto obrigatória** (primary, comportamento atual) e **imagens adicionais opcionais** (até `MAX_CAMPAIGN_IMAGES - 1`, ou seja, 3 com o teto de 4) — D3/D10.

- A primeira imagem é sempre `role: "primary"`; as auxiliares são tratadas internamente como `role: "reference"` (semântica neutra de imagem de apoio/referência visual para o diretor de arte).
- Roles avançadas (`variation`/`combo_item`) **não** são expostas ao lojista na v1 — permanecem no domínio/zod para extensão futura (F37/catálogo).
- O total de imagens no form SHALL respeitar `MAX_CAMPAIGN_IMAGES` — a UI não permite adicionar além do teto.

#### Scenario: Primary obrigatória renderizada

- **WHEN** o formulário de campanha é renderizado
- **THEN** há um campo "Imagem do Produto *" (obrigatório) para a imagem principal
- **AND** uma seção "Imagens adicionais" (opcionais, até 3) para as auxiliares

#### Scenario: Primeira imagem é primary e auxiliares são reference

- **WHEN** o usuário adiciona a imagem principal e 2 auxiliares
- **THEN** o estado do form marca a primeira como `role: "primary"`
- **AND** as auxiliares são marcadas como `role: "reference"`

#### Scenario: Limite de imagens respeitado no cliente

- **WHEN** o usuário já adicionou `MAX_CAMPAIGN_IMAGES` imagens
- **THEN** a UI não oferece mais a opção de adicionar imagem
- **AND** mostra mensagem indicando o teto de imagens

### Requirement: Origem galeria + câmera com source atribuído

O sistema SHALL permitir adicionar imagens por **galeria** (seleção de arquivo) e por **câmera** (atributo `capture="environment"` abre a câmera traseira no mobile) — D4.

- Cada item carrega `source: "upload"` quando vindo da galeria e `source: "camera"` quando vindo da câmera.
- O botão/área de nova imagem pode expor as duas origens (câmera no mobile; galeria no desktop).

#### Scenario: Origem câmera atribui source camera

- **WHEN** o usuário captura uma imagem pela câmera do celular
- **THEN** o item criado tem `source: "camera"`

#### Scenario: Origem galeria atribui source upload

- **WHEN** o usuário seleciona uma imagem da galeria
- **THEN** o item criado tem `source: "upload"`

#### Scenario: capture=environment presente no input de câmera

- **WHEN** o input de nova imagem por câmera é inspecionado
- **THEN** o atributo `capture` é `"environment"` (câmera traseira no mobile)

### Requirement: Preview grid com seleção/remoção por item

O sistema SHALL exibir um **preview grid** com todas as imagens adicionadas, cada uma com ação de **remoção por item** — D3.

- A imagem principal é destacada/identificada no grid.
- Remover a imagem principal aciona a validação (imagem obrigatória) se nenhuma outra for promovida a primary.
- Adicionar/remover atualiza o preview imediatamente e mantém os object URLs revogados corretamente quando o item é removido/substituído.

#### Scenario: Preview grid exibe todas as imagens

- **WHEN** o usuário adiciona 1 primary + 2 auxiliares
- **THEN** o grid de preview exibe 3 itens com a primary identificada
- **AND** cada item tem um controle de remoção

#### Scenario: Remover primary aciona validação de obrigatoriedade

- **WHEN** o usuário remove a única imagem primary
- **THEN** o campo de imagem do produto fica sem valor
- **AND** a validação de "Imagem do produto é obrigatória" volta a ser acionada no submit/blur

#### Scenario: Object URL revogado na remoção

- **WHEN** o usuário remove uma imagem do grid
- **THEN** `URL.revokeObjectURL()` é chamado para o preview removido

### Requirement: HEIC/HEIF aceito no input com decode via canvas

O sistema SHALL aceitar `image/heic` / `image/heif` no input de arquivo (fotos de iPhone) e tentar **decodificar via canvas** — os browsers que decodificam HEIC para `drawImage` convertem para JPEG no `toBlob` — **sem nova dependência de lib HEIC na v1** (D4).

- Se a decodificação falhar → mensagem **PT-BR clara** orientando o usuário a usar JPG/PNG.
- A decisão de não adicionar dependência (`heic2any`/`libheif`) fica registrada — alternativa futura se o UAT com celular real mostrar necessidade.

#### Scenario: HEIC aceito no input

- **WHEN** o usuário seleciona um arquivo `image/heic` ou `image/heif`
- **THEN** o input **não** rejeita o formato de imediato (validação de formato aceita HEIC/HEIF)

#### Scenario: Decode HEIC via canvas converte para JPEG

- **WHEN** o arquivo HEIC decodifica com sucesso para `drawImage`
- **THEN** o `compressImage` produz um JPEG comprimido (≤1MB, downscale 1200px) via `toBlob`

#### Scenario: Falha de decode HEIC mostra mensagem clara

- **WHEN** o arquivo HEIC não decodifica via canvas
- **THEN** o form exibe mensagem PT-BR clara orientando a usar JPG/PNG
- **AND** nenhuma imagem é adicionada

### Requirement: Orientação EXIF respeitada na compressão

O sistema SHALL respeitar a **rotação EXIF** das fotos de câmera no `compressImage` — usar `createImageBitmap(file, { imageOrientation: "from-image" })` (ou equivalente) antes de desenhar no canvas, garantindo que fotos verticais/horizontais não saiam rotacionadas (D4).

#### Scenario: Foto vertical de câmera não sai rotacionada

- **WHEN** o usuário captura uma foto com orientação EXIF (ex.: 90°) pela câmera
- **THEN** o `compressImage` aplica `imageOrientation: "from-image"` antes do desenho
- **AND** o JPEG resultante mantém a orientação visual correta

### Requirement: Limites por item no cliente

O sistema SHALL aplicar no cliente, por imagem adicionada: formatos PNG/JPG/WEBP (mais HEIC/HEIF com decode via canvas, D4), limite de arquivo ≤ 5MB e a compressão existente (JPEG ≤1MB, downscale 1200px) — D10.

- Erros de formato/tamanho são exibidos por item, em PT-BR, indicando o limite excedido.
- O arquivo inválido não entra no grid.

#### Scenario: Arquivo muito grande mostra erro por item

- **WHEN** o usuário seleciona um arquivo > 5MB
- **THEN** o form exibe erro em PT-BR ("Arquivo muito grande. Máximo 5MB")
- **AND** o item não é adicionado ao grid

#### Scenario: Formato inválido mostra erro

- **WHEN** o usuário seleciona um arquivo fora dos formatos aceitos (ex.: GIF, SVG)
- **THEN** o form exibe erro em PT-BR ("Formato não suportado. Use PNG, JPG, WEBP ou HEIC")
- **AND** o item não é adicionado ao grid
