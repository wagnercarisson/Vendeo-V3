# Product 1:1 Intent and Background Selection — Wiring

## MODIFIED Requirements

### Requirement: Componentes inativos não expostos ao lojista

Os contratos e componentes desta fatia SHALL ser montados no fluxo produtivo **somente** sob elegibilidade server-side (flag aplicável + autorização válida). Com decisão negativa (`off`), os seletores do novo fluxo SHALL NOT ser exibidos e o comportamento legado permanece inalterado.

#### Scenario: Seleção não exposta no fluxo legado

- **WHEN** o formulário produtivo é renderizado sem elegibilidade
- **THEN** os seletores do novo fluxo não são exibidos
- **AND** o comportamento legado permanece inalterado

#### Scenario: Seleção exposta sob elegibilidade

- **WHEN** a decisão server-side indica elegibilidade
- **THEN** os seletores são montados
- **AND** as seleções são registradas no snapshot congelado

## ADDED Requirements

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
