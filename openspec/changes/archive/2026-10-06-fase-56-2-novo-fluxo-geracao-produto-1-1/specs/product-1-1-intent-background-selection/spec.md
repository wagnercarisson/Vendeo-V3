# Product 1:1 Intent and Background Selection

## ADDED Requirements

### Requirement: Seleção explícita de intenção

O formulário de campanha Produto SHALL oferecer seleção explícita de intenção entre **Oferta**, **Destaque** e **Exclusivo**. A intenção selecionada SHALL ser a usada na composição, sem inferência silenciosa que a altere.

#### Scenario: Intenção escolhida é respeitada

- **WHEN** o lojista seleciona uma intenção válida
- **THEN** a composição usa exatamente essa intenção
- **AND** a intenção não é substituída por inferência automática

### Requirement: Seleção explícita de direção de fundo

O formulário SHALL oferecer seleção explícita de direção de fundo entre **Fundo de estúdio**, **Cenário ambientado** e **Manter cenário original**. Nenhuma direção SHALL ser aplicada sem seleção explícita.

#### Scenario: Fundo selecionado é aplicado

- **WHEN** o lojista seleciona uma direção de fundo válida
- **THEN** a composição incorpora a instrução correspondente
- **AND** a direção é registrada no snapshot da campanha

### Requirement: "Manter cenário original" exige exatamente uma imagem de produto

A direção **Manter cenário original** SHALL ser elegível somente quando houver **exatamente uma** imagem de produto (papel principal + auxiliares). Imagens de identidade da loja SHALL NOT entrar nessa contagem. Com zero ou mais de uma imagem de produto, a opção SHALL ser rejeitada no servidor.

#### Scenario: Original aceito com uma imagem de produto

- **WHEN** há exatamente uma imagem de produto e a direção original é selecionada
- **THEN** a direção é aceita
- **AND** a composição preserva o cenário original

#### Scenario: Original rejeitado com zero ou várias imagens

- **WHEN** há zero ou mais de uma imagem de produto e a direção original é solicitada
- **THEN** a operação é rejeitada no servidor
- **AND** uma mensagem de validação de campo é retornada

#### Scenario: Imagem de identidade não conta como imagem de produto

- **WHEN** existe uma única imagem de produto e também uma imagem de identidade da loja
- **THEN** a contagem de imagens de produto permanece igual a um
- **AND** a direção original continua elegível

### Requirement: Validação de seleção como erro de campo

Seleções inválidas de intenção ou de fundo SHALL ser tratadas como **validação de campo** com mensagem clara, e SHALL NOT ser mascaradas como falha técnica `IMG-001`.

#### Scenario: Seleção inválida não vira IMG-001

- **WHEN** a direção original é solicitada com número inválido de imagens de produto
- **THEN** o erro é apresentado como validação de campo
- **AND** nenhum código `IMG-001` é usado para esse erro de preenchimento
