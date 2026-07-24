## MODIFIED Requirements

### Requirement: Campaign form fields

O sistema SHALL renderizar os seguintes campos do formulário:

- **Nome do Produto**: required text input, max 60 characters
- **Descrição Breve**: optional text input, max 120 characters
- **Preço Original**: optional currency input com BRL mask (`R$` prefix, formatted as `R$ 49,90`)
- **Preço com Desconto**: required currency input com BRL mask (obrigatório apenas quando intent=offer)
- **Badge Promocional**: required dropdown select usando badges da intent atual (obrigatório apenas para offer)
- **Intenção Comercial**: radio group posicionado entre badge e botão "Criar Campanha", com opções filtradas por inferência. Spotlight e Exclusive exibem "Em breve"
- **Preservar Imagem Original**: checkbox visível apenas em spotlight/exclusive
- **Imagem do Produto**: required file upload dropzone, aceita PNG/JPG/WEBP, max 5MB

#### Scenario: Intent selector renderizado entre badge e botão Criar

- **WHEN** o formulário é exibido com campos de preço preenchidos
- **THEN** o seletor de intent está presente entre o badge select e o botão "Criar Campanha"

#### Scenario: Badge options variam por intent

- **WHEN** a intent selecionada muda
- **THEN** as opções do badge select atualizam conforme `BADGE_OPTIONS_BY_INTENT[intent]`

#### Scenario: Badge options são filtrados por intent

- **WHEN** o badge dropdown está aberto com intent `"offer"`
- **THEN** as opções são: Promoção, Oferta, Queima de Estoque, Últimas Unidades, Imperdível

- **WHEN** o badge dropdown está aberto com intent `"spotlight"`
- **THEN** as opções são: Novidade, Lançamento, Mais Vendido, Top de Linha, Destaque da Semana

- **WHEN** o badge dropdown está aberto com intent `"exclusive"`
- **THEN** as opções são: Exclusivo, Premium, Sob Encomenda, Edição Limitada

### Requirement: Client-side validation

O sistema SHALL validar as seguintes regras:

- **Nome do Produto**: required, max 60 caracteres, trimmed
- **Descrição Breve**: optional, max 120 caracteres
- **Preço Original**: optional, MUST ser > 0 se fornecido, MUST ser > Preço com Desconto
- **Preço com Desconto**: obrigatório se intent=offer, MUST ser > 0
- **Badge Promocional**: obrigatório se intent=offer, MUST ser uma das `BADGE_OPTIONS_BY_INTENT[intent]`
- **Intenção Comercial**: seleção obrigatória; apenas `offer` permite submissão
- **Imagem do Produto**: required, MUST ser PNG/JPG/WEBP e ≤ 5MB

Validação SHALL disparar onBlur para cada campo. Estado de bloqueio SHALL impedir submit quando qualquer validação falhar.

#### Scenario: Discounted price validation condicional por intent

- **WHEN** intent=`"offer"` e Preço com Desconto é 0
- **THEN** erro inline: "Preço com desconto é obrigatório para ofertas"

- **WHEN** intent=`"spotlight"` e Preço com Desconto é 0
- **THEN** nenhum erro de preço com desconto

### Requirement: Submit triggers API generation

O comportamento de submit SHALL incluir:

1. Validar todos os campos obrigatórios
2. Verificar se a intent selecionada é `"offer"` — se não, bloquear com "Indisponível para esta intenção comercial"
3. Criar ou reusar object URL da imagem
4. Incluir `campaignIntent` e `preserveImageContext` no body
5. Chamar `POST /api/campaign/generate-image` com form data incluindo `storeId`
6. On success: navegar para `/campanhas/${campaignId}`
7. On error: exibir estado de erro com retry

#### Scenario: Submit bloqueado para spotlight

- **WHEN** intent selecionada é `"spotlight"` e o usuário clica "Criar Campanha"
- **THEN** o submit NÃO é executado
- **AND** exibe tooltip "Disponível em breve"

#### Scenario: Submit bloqueado para exclusive

- **WHEN** intent selecionada é `"exclusive"` e o usuário clica "Criar Campanha"
- **THEN** o submit NÃO é executado
- **AND** exibe tooltip "Disponível em breve"

#### Scenario: Submit com offer inclui campaignIntent no body

- **WHEN** o usuário submete com intent `"offer"` e todos os campos válidos
- **THEN** o body enviado inclui `campaignIntent: "offer"`
- **AND** `preserveImageContext` não está presente no body (ou é `false`)
