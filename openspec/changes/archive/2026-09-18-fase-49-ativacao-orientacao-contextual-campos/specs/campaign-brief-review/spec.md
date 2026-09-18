# Campaign Brief Review

> Delta spec for `fase-49-ativacao-orientacao-contextual-campos` (D11/D12). A tela de revisão mantém **categorias reconhecíveis e separáveis** — aviso ilustrativo, informações obrigatórias na arte, validade e preços/oferta — com rótulos alinhados à orientação de campo. Apenas apresentação: `fields`, `buildMandatoryArtworkText`, body, snapshot e contrato HTTP permanecem intactos.

## MODIFIED Requirements

### Requirement: Conteúdo do resumo do brief (seções + rótulos + custo + Tema)

A tela de revisão SHALL exibir um resumo completo e honesto do brief:

- **Topo:** loja/marca ativa (`StoreIdentityBlock` — o lojista confirma que é a loja certa).
- **Seção Produto:** nome, **descrição do produto** (se houver).
- **Seção Oferta:** tipo de campanha (Oferta/Destaque/Exclusivo), selo (badge), **preço anterior (original)** (se houver), **preço de venda (final)**, validade formatada.
- **Seção Imagens:** **imagem principal** (obrigatória, rótulo **"Principal"**) + **referências autorizadas** (rótulo **"Referência"**) — apoio visual / variação / combo / ângulo; as adicionais **não substituem a principal**, mas **autorizam elementos visuais de suporte** na arte; thumbnails do payload final exibidas **sem recorte** (`object-contain`, célula `aspect-square`).
- **Seção Avisos:** **categorias separáveis e reconhecíveis** — o **aviso ilustrativo** (checkbox) e as **informações obrigatórias na arte** (texto livre) SHALL ser apresentados como itens distintos (não concatenados em um único bloco ambíguo), com rótulos coerentes com a orientação de campo (ex.: "Imagem meramente ilustrativa" e "Informações obrigatórias na arte").
- **Seção Custo:** **"Vai consumir X crédito(s)"** + saldo atual; "Confirmar" bloqueado quando custo indisponível/desativado/saldo insuficiente.
- **Seção Tema:** **slot opcional reservado** — NÃO renderiza enquanto `creativeContext.themeId` for null; preparação para a F44 (Temas de Campanha).

A apresentação SHALL NOT alterar o body montado (`buildCampaignGenerationBody`), o snapshot `campaign_brief_v1` ou o contrato HTTP. A separação visual das categorias SHALL ser derivada dos mesmos valores já disponíveis em `fields` (ex.: `showIllustrativeNotice` e `mandatoryArtworkTextFree`), sem alterar `buildMandatoryArtworkText`.

> Modified by `fase-49-ativacao-orientacao-contextual-campos` (D11/D12): a seção Avisos passa a apresentar aviso ilustrativo e informações obrigatórias como itens separáveis, com rótulos alinhados; preços renomeados para "preço de venda/preço anterior"; nenhuma mudança de body/snapshot/HTTP.

#### Scenario: Seções renderizam com os valores do brief

- **WHEN** a revisão abre com um form válido (produto, oferta, imagens, avisos)
- **THEN** as seções Produto/Oferta/Imagens/Avisos/Custo renderizam com os valores do brief
- **AND** a loja/marca ativa aparece no topo

#### Scenario: Categorias de avisos separáveis na revisão

- **WHEN** o checkbox ilustrativo está marcado e há informações obrigatórias preenchidas
- **THEN** a revisão apresenta o aviso ilustrativo e as informações obrigatórias como **itens distintos e rotulados**
- **AND** não concatena as duas naturezas em um único bloco ambíguo
- **AND** quando só um dos dois existe, apenas ele é apresentado (com rótulo correspondente)

#### Scenario: Preços rotulados de forma coerente com a orientação

- **WHEN** a revisão exibe a seção Oferta com preços
- **THEN** os rótulos usam "Preço anterior" (original) e "Preço de venda" (final), coerentes com o formulário
- **AND** a validade permanece em item próprio

#### Scenario: Custo e saldo exibidos; Confirmar bloqueado sem condição

- **WHEN** a revisão exibe a seção Custo
- **THEN** mostra "Vai consumir X crédito(s)" + saldo atual
- **AND** com custo indisponível/desativado/saldo insuficiente, o botão "Confirmar e gerar campanha" fica bloqueado

#### Scenario: Tema não renderiza (slot reservado para F44)

- **WHEN** `creativeContext.themeId` é null (hoje sempre)
- **THEN** a seção Tema **não** renderiza
- **AND** o slot permanece reservado no contrato para a F44 (Temas de Campanha)

#### Scenario: Body, snapshot e contrato HTTP inalterados

- **WHEN** o usuário confirma a geração a partir da revisão
- **THEN** o body montado por `buildCampaignGenerationBody` é idêntico ao comportamento anterior para os mesmos valores
- **AND** o snapshot `campaign_brief_v1` e o contrato HTTP permanecem inalterados
