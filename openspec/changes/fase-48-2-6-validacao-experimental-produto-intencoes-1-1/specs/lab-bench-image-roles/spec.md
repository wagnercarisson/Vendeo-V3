## MODIFIED Requirements

### Requirement: Papel semântico das imagens do produto

O contrato de imagem SHALL pertencer a Produto, sem dependência exclusiva da intenção Oferta. A primeira imagem enviada SHALL definir a variante protagonista; orientação ao modelo: “A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.” Auxiliares opcionais podem representar ângulos, múltiplas representações e variantes do mesmo produto anunciado, sem garantir aparição. Não se declara suporte a produtos independentes/combos. A regra separada de exibição única de textos obrigatórios não limita múltiplas representações em imagens. Presença/fidelidade visual são critérios humanos, não garantias técnicas. Limites, ordem principal → auxiliares → identidade e transporte SHALL seguir os contratos técnicos existentes.

#### Scenario: Primeira imagem enviada define a variante protagonista
- **WHEN** tipo de conteúdo é Produto e há imagem principal
- **THEN** a primeira imagem enviada define a variante protagonista e é orientada a aparecer maior e em primeiro plano
- **AND** as imagens auxiliares são orientadas como apoio visual secundário
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
- **THEN** exibe: “A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.”

#### Scenario: Direção de fundo única está disponível nas três intenções
- **WHEN** o usuário configura Oferta, Destaque ou Exclusivo
- **THEN** a bancada oferece seleção única entre `Fundo de estúdio`, `Cenário ambientado` e `Manter cenário original`
- **AND** nenhuma opção é aplicada por padrão
- **AND** o valor escolhido é incluído no prompt e no snapshot

#### Scenario: Manter cenário original exige exatamente uma imagem de produto
- **WHEN** `Manter cenário original` está selecionado
- **THEN** há exatamente uma imagem de produto em `references`
- **AND** a imagem de identidade da loja não entra na contagem de imagens de produto
- **WHEN** a quantidade de imagens de produto deixa de ser exatamente uma
- **THEN** a UI invalida a escolha e exige nova seleção explícita
- **AND** API rejeita composição/execução com essa escolha inválida antes de persistência/provider

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
