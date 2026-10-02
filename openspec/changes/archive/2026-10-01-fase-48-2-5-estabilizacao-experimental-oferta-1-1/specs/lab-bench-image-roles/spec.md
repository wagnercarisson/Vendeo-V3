## ADDED Requirements

### Requirement: Papel semântico das imagens do produto

O contrato de imagem SHALL pertencer ao tipo de conteúdo `produto`, sem dependência exclusiva da intenção Oferta. A imagem principal SHALL ser obrigatória e referência canônica do produto. A orientação ao modelo SHALL pedir que use a principal como protagonista visível e preserve aparência, embalagem e características; seu aparecimento na composição é critério de avaliação humana, não garantia técnica da bancada. Até três imagens adicionais SHALL ser opcionais, representar o mesmo produto e funcionar como referências auxiliares de ângulos, detalhes, embalagem ou contexto. Elas MAY contribuir para fidelidade/composição, mas SHALL NOT duplicar o produto, competir com a principal ou criar outro protagonista; não há garantia de que todas apareçam visualmente. A orientação textual SHALL ser simples e equivalente a: “Use a imagem principal como representação obrigatória e protagonista do produto. As imagens adicionais são referências auxiliares do mesmo produto; utilize-as quando contribuírem para fidelidade ou composição, sem duplicar o produto nem competir com a imagem principal.”

#### Scenario: Composição usa principal como protagonista
- **WHEN** o tipo de conteúdo é produto e existe imagem principal
- **THEN** a política instrui o modelo a usar a principal como representação protagonista e canônica
- **AND** preserva aparência, embalagem e características
- **AND** avaliação humana verifica se a principal aparece como protagonista
- **AND** a bancada não garante tecnicamente a composição visual

#### Scenario: Adicionais são auxiliares e opcionais
- **WHEN** existem de zero a três imagens adicionais
- **THEN** cada uma é tratada como referência auxiliar do mesmo produto
- **AND** nenhuma obrigação de aparição visual é prometida
- **AND** elas não criam duplicação ou protagonista concorrente

#### Scenario: Ordem de transporte é canônica
- **WHEN** as imagens são transportadas ao modelo
- **THEN** a ordem é principal, adicionais na ordem informada, identidade visual da loja por último
- **AND** os papéis e a ordem não são reordenados pelo sistema

#### Scenario: UI explica honestamente o papel das adicionais
- **WHEN** a UI apresenta a entrada de imagens adicionais
- **THEN** exibe: “Imagens adicionais de referência — opcionais. Podem ajudar a preservar detalhes e orientar a composição, mas nem todas necessariamente aparecerão na arte final.”

### Requirement: Não expansão da composição por imagens

O contrato SHALL NOT tratar imagens adicionais como produtos independentes, montar combos de múltiplos SKUs, garantir programaticamente sua aparição ou compor programaticamente um layout.

#### Scenario: Adicionais representam apenas o mesmo produto
- **WHEN** imagens adicionais são aceitas
- **THEN** o sistema as associa ao mesmo produto da imagem principal
- **AND** não declara suporte a produtos independentes ou combos

#### Scenario: Nenhuma garantia programática de layout
- **WHEN** imagens são usadas na composição
- **THEN** o sistema não garante programaticamente a presença de todas as imagens
- **AND** não produz composição programática de layout
