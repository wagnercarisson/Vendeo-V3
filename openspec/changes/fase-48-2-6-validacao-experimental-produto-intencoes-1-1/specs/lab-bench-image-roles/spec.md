## MODIFIED Requirements

### Requirement: Papel semântico das imagens do produto

O contrato de imagem SHALL pertencer a Produto, sem dependência exclusiva da intenção Oferta. A imagem principal SHALL ser obrigatória e referência canônica; orientação ao modelo: “Use a imagem principal como protagonista. As imagens auxiliares enriquecem a campanha; use-as sempre que possível, sem competir com a principal.” Auxiliares opcionais podem representar ângulos, múltiplas representações e variantes do mesmo produto anunciado, sem garantir aparição. Não se declara suporte a produtos independentes/combos. A regra separada de não redundância textual do prompt não limita múltiplas representações em imagens. Presença/fidelidade visual são critérios humanos, não garantias técnicas. Limites, ordem principal → auxiliares → identidade e transporte SHALL seguir os contratos técnicos existentes.

#### Scenario: Composição usa principal como protagonista
- **WHEN** tipo de conteúdo é Produto e há imagem principal
- **THEN** política usa a principal como protagonista
- **AND** presença/fidelidade é avaliada por humano sem garantia técnica

#### Scenario: Auxiliares enriquecem sem competir
- **WHEN** imagens auxiliares estão disponíveis
- **THEN** orientação usa exatamente a frase deste requisito
- **AND** auxiliares são opcionais e podem representar ângulos/variantes do produto anunciado
- **AND** não competem com a principal nem têm aparição garantida

#### Scenario: Transporte técnico é preservado
- **WHEN** imagens são transportadas
- **THEN** limites e ordem principal → auxiliares → identidade permanecem os já definidos
- **AND** o transporte existente não é alterado por esta política

#### Scenario: Não redundância textual não limita imagens
- **WHEN** prompt contém regras de não repetição textual
- **THEN** essas regras não limitam representações/ângulos/variantes em imagens auxiliares
- **AND** imagens continuam referentes ao mesmo produto anunciado

#### Scenario: UI apresenta a orientação concisa
- **WHEN** UI apresenta as imagens auxiliares
- **THEN** exibe: “Use a imagem principal como protagonista. As imagens auxiliares enriquecem a campanha; use-as sempre que possível, sem competir com a principal.”

### Requirement: Não expansão da composição por imagens

O contrato SHALL NOT tratar imagens auxiliares como produtos independentes, montar combos de múltiplos SKUs, garantir programaticamente sua aparição ou compor programaticamente um layout. Múltiplas representações, ângulos e variantes do produto anunciado são permitidos.

#### Scenario: Auxiliares referem-se ao produto anunciado
- **WHEN** imagens auxiliares são aceitas
- **THEN** podem representar ângulos ou variantes do mesmo produto anunciado
- **AND** não declaram suporte a produtos independentes ou combos

#### Scenario: Nenhuma garantia programática de layout
- **WHEN** imagens são usadas na composição
- **THEN** sistema não garante presença de todas as imagens
- **AND** não produz composição programática de layout
