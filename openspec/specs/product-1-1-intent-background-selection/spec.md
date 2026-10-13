# Product 1:1 Intent and Background Selection

## Purpose

Define explicit campaign-intent and background-direction contracts for the Product 1:1 flow, including eligibility validation.

## Requirements

### Requirement: Contratos de seleção explícita de intenção

O sistema SHALL prover contratos de domínio para seleção explícita de intenção entre **Oferta**, **Destaque** e **Exclusivo**. A intenção selecionada SHALL ser preservada sem inferência silenciosa que a altere.

#### Scenario: Intenção escolhida é respeitada no contrato

- **WHEN** uma intenção válida é selecionada no contrato
- **THEN** a representação preserva essa intenção
- **AND** a intenção não é substituída por inferência automática

### Requirement: Contratos e componentes de direção de fundo

O sistema SHALL prover contratos e componentes para seleção explícita de direção de fundo entre **Fundo de estúdio**, **Cenário ambientado** e **Manter cenário original**. Nenhuma direção SHALL ser assumida sem seleção explícita.

#### Scenario: Fundo selecionado é representável

- **WHEN** uma direção de fundo válida é selecionada
- **THEN** a representação carrega a direção correspondente
- **AND** a direção fica disponível para registro no snapshot

### Requirement: "Manter cenário original" exige exatamente uma imagem de produto

A direção **Manter cenário original** SHALL ser elegível somente com **exatamente uma** imagem de produto (principal + auxiliares). Imagens de identidade da loja SHALL NOT entrar nessa contagem. Com zero ou mais de uma imagem de produto, SHALL ser rejeitada com erro de campo.

#### Scenario: Original aceito com uma imagem de produto

- **WHEN** há exatamente uma imagem de produto e a direção original é selecionada
- **THEN** a seleção é aceita
- **AND** a representação preserva a direção original

#### Scenario: Original rejeitado com zero ou várias imagens

- **WHEN** há zero ou mais de uma imagem de produto e a direção original é solicitada
- **THEN** a seleção é rejeitada com erro de campo
- **AND** nenhuma composição é produzida

#### Scenario: Imagem de identidade não conta como imagem de produto

- **WHEN** existe uma única imagem de produto e também uma imagem de identidade da loja
- **THEN** a contagem de imagens de produto permanece um
- **AND** a direção original continua elegível

### Requirement: Validação de seleção como erro de campo

Seleções inválidas de intenção ou de fundo SHALL ser tratadas como **validação de campo**, e SHALL NOT ser mascaradas como falha técnica `IMG-001`.

#### Scenario: Seleção inválida não vira IMG-001

- **WHEN** uma seleção inválida é validada
- **THEN** o resultado é um erro de campo identificável
- **AND** nenhum código `IMG-001` é usado para erro de preenchimento

### Requirement: Componentes inativos não expostos ao lojista

Os contratos e componentes desta fatia SHALL ser montados no fluxo produtivo **somente** sob elegibilidade server-side (flag aplicável + autorização válida). Com decisão negativa (`off`), os seletores do novo fluxo SHALL NOT ser exibidos e o comportamento legado permanece inalterado.

#### Scenario: Seleção não exposta no fluxo legado

- **WHEN** o formulário produtivo legado é renderizado
- **THEN** os seletores do novo fluxo não são exibidos
- **AND** o comportamento legado permanece inalterado

#### Scenario: Seleção exposta sob elegibilidade

- **WHEN** a decisão server-side indica elegibilidade
- **THEN** os seletores são montados
- **AND** as seleções são registradas no snapshot congelado

### Requirement: Formulário de produção elegível

O formulário SHALL montar seletores e enviar intenção/fundo somente quando a decisão server-side indicar elegibilidade por flag aplicável e autorização válida. Em `off` não monta controles nem envia campos exclusivos. O POST revalida a elegibilidade e não encaminha payload novo incompatível ao legado.

#### Scenario: Elegibilidade confirmada

- **WHEN** usuário elegível seleciona intenção e fundo
- **THEN** o payload contém seleções explícitas e composição/snapshot preservam os valores

#### Scenario: Off oculta os seletores

- **WHEN** a decisão server-side nega o novo fluxo
- **THEN** seletores não são montados e o payload segue formato legado

#### Scenario: Revogação entre renderização e POST

- **WHEN** a autorização é revogada após renderização e antes do envio
- **THEN** a API recusa com erro seguro antes de reserva, sem descartar campos no legado

### Requirement: Validação server-side efetiva

O servidor SHALL exigir exatamente uma imagem de produto para Original (imagem de identidade não conta); valor inválido SHALL retornar erro de campo e nunca `IMG-001`.

#### Scenario: Original aceito/rejeitado

- **WHEN** há exatamente uma imagem de produto / há zero ou mais de uma
- **THEN** Original é aceito / rejeitado como erro de campo

#### Scenario: Imagem de identidade não conta

- **WHEN** existe uma imagem de produto e uma imagem de identidade
- **THEN** a seleção Original continua elegível
