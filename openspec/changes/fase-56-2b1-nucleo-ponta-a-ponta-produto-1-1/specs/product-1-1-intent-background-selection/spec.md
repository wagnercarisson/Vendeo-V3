# Product 1:1 Intent and Background Selection

> F56.2b1 — integração operacional sobre os contratos/componentes da F56.2a.

## ADDED Requirements

### Requirement: Formulário de produção exibe e transporta as seleções

O formulário de produção SHALL exibir os seletores de intenção (Oferta/Destaque/Exclusivo) e de fundo (Estúdio/Ambientado/Original) e SHALL transportá-los no corpo da requisição de geração.

#### Scenario: Lojista seleciona intenção e fundo

- **WHEN** o lojista seleciona uma intenção e uma direção de fundo no formulário de produção
- **THEN** o corpo da requisição inclui a intenção e a direção selecionadas
- **AND** a intenção não é substituída por inferência automática

#### Scenario: Fundo selecionado é aplicado

- **WHEN** o lojista seleciona uma direção de fundo válida
- **THEN** a composição incorpora a instrução correspondente
- **AND** a direção é registrada no snapshot da campanha

### Requirement: Validação server-side efetiva no caminho novo

O servidor SHALL validar as seleções no caminho novo, garantindo que **Manter cenário original** só seja aceito com exatamente uma imagem de produto (identidade não conta) e retornando erro de campo em caso inválido — nunca `IMG-001`.

#### Scenario: Original aceito com uma imagem de produto

- **WHEN** há exatamente uma imagem de produto e a direção original é solicitada
- **THEN** a operação prossegue com a direção original

#### Scenario: Original rejeitado com zero ou várias imagens

- **WHEN** há zero ou mais de uma imagem de produto e a direção original é solicitada
- **THEN** o servidor rejeita com erro de campo
- **AND** a operação não é executada

#### Scenario: Imagem de identidade não conta

- **WHEN** existe uma única imagem de produto e também uma imagem de identidade
- **THEN** a contagem de imagens de produto permanece um
- **AND** a direção original continua elegível

#### Scenario: Seleção inválida não vira IMG-001

- **WHEN** uma seleção inválida é rejeitada no servidor
- **THEN** o erro é de campo
- **AND** nenhum código `IMG-001` é usado
