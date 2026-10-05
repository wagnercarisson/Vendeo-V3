# Lab Bench Image Roles

> Synced from `fase-48-2-5-estabilizacao-experimental-oferta-1-1` (ADDED) and `fase-48-2-6-validacao-experimental-produto-intencoes-1-1` (MODIFIED).

## Purpose

Define os papéis semânticos e o transporte das imagens principal e adicionais do produto na bancada.

## Requirements

### Requirement: Papel semântico das imagens do produto

O contrato de imagem SHALL pertencer a Produto, sem dependência exclusiva da intenção Oferta. Com uma imagem, usar somente “Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.” Com duas ou mais, a primeira imagem define a variante protagonista e aparece como orientação maior/em primeiro plano; auxiliares ficam como apoio visual secundário, e a instrução de fidelidade aparece apenas uma vez. Com zero imagens, orientar somente que o produto seja o elemento principal, sem alegar fidelidade a imagem ausente. Auxiliares opcionais podem representar ângulos, múltiplas representações e variantes do mesmo produto anunciado, sem garantir aparição. Não se declara suporte a produtos independentes/combos. A regra separada de exibição única de textos obrigatórios não limita múltiplas representações em imagens. Presença/fidelidade visual são critérios humanos, não garantias técnicas. Limites, ordem principal → auxiliares → identidade e transporte SHALL seguir os contratos técnicos existentes.

A seleção `backgroundDirection` SHALL ser o único controle bench de direção de fundo. O checkbox legado `preserveImageContext` SHALL NOT permanecer como escolha independente; se a flag booleana for necessária internamente para compatibilidade do snapshot, SHALL ser derivada exclusivamente de `backgroundDirection === original` e não gerar uma segunda instrução no prompt. `Manter cenário original` SHALL ser exibida somente quando há exatamente uma referência de imagem de produto; para 0 ou 2+ referências, a opção não deve estar presente no seletor. Os rótulos curtos continuam na UI, enquanto o prompt recebe somente a instrução da opção selecionada: estúdio `Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.`; ambientado `Crie um cenário ambientado coerente com o produto e a marca, sem prejudicar a leitura.`; original `Mantenha o cenário da imagem enviada como base; não o substitua por outro.`. Nenhum rótulo curto é serializado como instrução do prompt. A composição versionada do nome e do fundo usa `COMPOSER_VERSION=48.2.4-prompt-composer-v5`.

#### Scenario: Uma imagem usa uma única instrução de produto

- **WHEN** há exatamente uma referência de imagem de produto
- **THEN** usa exatamente “Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.”
- **AND** não menciona primeira imagem, variante ou imagens auxiliares
- **AND** não adiciona outra instrução de fidelidade

#### Scenario: Múltiplas imagens mantêm protagonismo e fidelidade uma vez

- **WHEN** há duas ou mais referências de imagem de produto
- **THEN** a primeira imagem é orientada como variante protagonista maior/em primeiro plano e as auxiliares como apoio visual secundário
- **AND** a instrução “Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.” aparece exatamente uma vez

#### Scenario: Zero imagens não alega fidelidade à referência

- **WHEN** não há referência de imagem de produto
- **THEN** orienta somente “Produto como elemento principal da peça.”
- **AND** não alega fidelidade a uma imagem ausente

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

#### Scenario: UI apresenta a orientação de múltiplas imagens

- **WHEN** UI apresenta duas ou mais imagens do produto
- **THEN** exibe a orientação de protagonismo da primeira imagem e apoio secundário das auxiliares

#### Scenario: Direção de fundo única está disponível nas três intenções

- **WHEN** o usuário configura Oferta, Destaque ou Exclusivo
- **THEN** a bancada oferece seleção única entre `Fundo de estúdio`, `Cenário ambientado` e `Manter cenário original`
- **AND** nenhuma opção é aplicada por padrão
- **AND** o valor escolhido é incluído no prompt e no snapshot

#### Scenario: Manter cenário original só aparece com exatamente uma imagem de produto

- **WHEN** `Manter cenário original` está selecionado
- **THEN** há exatamente uma imagem de produto em `references`
- **AND** a imagem de identidade da loja não entra na contagem de imagens de produto
- **WHEN** a quantidade de imagens de produto deixa de ser exatamente uma
- **THEN** a UI invalida a escolha e exige nova seleção explícita
- **AND** a opção não é renderizada no seletor para contagens 0 ou 2+
- **AND** API rejeita composição/execução com essa escolha inválida antes de persistência/provider

#### Scenario: Só a frase da direção escolhida entra no prompt

- **WHEN** uma das três opções de fundo é selecionada
- **THEN** o prompt inclui sua frase específica definida no requisito
- **AND** não inclui o rótulo curto como instrução nem as frases das opções não selecionadas

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
