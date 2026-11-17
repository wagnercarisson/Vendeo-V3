## ADDED Requirements

### Requirement: Seleção de expansão congelada por operação e versão de contrato

A operação `9_16_two_stage` SHALL registrar, de forma persistida e imutável, a seleção de expansão efetiva com modelo, qualidade, `configVersionId` e origem, no mesmo ato atômico que cria a operação e reserva o crédito. A imutabilidade SHALL ser garantida no banco: `service_role` SHALL permanecer apenas com `SELECT` na tabela de operações e um trigger `BEFORE UPDATE` SHALL rejeitar qualquer alteração dos campos de seleção/`contract_version`, inclusive por funções futuras. A seleção SHALL ser obrigatória para operações abertas a partir da F60.6 (`contract_version = 2`) e SHALL NOT ser alterada por reabertura, retry, continuação ou mudança administrativa posterior. Operações anteriores (`contract_version = 1`) SHALL permanecer sem seleção persistida e SHALL ser interpretadas explicitamente como o comportamento original Sunburst `low`, sem backfill e sem reescrita de histórico. Uma operação `contract_version = 2` com seleção ausente, incompleta ou inválida SHALL falhar fechado, não podendo ser confundida com o legado. A concorrência de abertura SHALL convergir para uma única reserva, uma única operação e uma única seleção; seleção divergente SHALL NOT sobrescrever a vencedora.

#### Scenario: Nova operação grava a seleção junto da reserva

- **WHEN** uma operação 9:16 é aberta com uma seleção validada
- **THEN** a operação SHALL ser persistida com modelo, qualidade, versão da configuração e origem
- **AND** a reserva de 1 crédito SHALL ocorrer na mesma transação
- **AND** a seleção SHALL estar disponível para a etapa de expansão sem nova consulta administrativa

#### Scenario: Seleção congelada não pode ser alterada no banco

- **WHEN** qualquer caminho tenta atualizar modelo, qualidade, versão, origem ou `contract_version` de uma operação existente
- **THEN** o trigger de imutabilidade SHALL rejeitar a alteração
- **AND** `service_role` SHALL NOT ter `UPDATE` direto na tabela
- **AND** a seleção original SHALL permanecer intacta

#### Scenario: Aberturas concorrentes convergem para uma seleção

- **WHEN** duas aberturas concorrentes da mesma `(campaign_id, operation_id)` usam seleções diferentes
- **THEN** SHALL existir uma única reserva, uma única operação e uma única seleção
- **AND** a seleção divergente SHALL ser recusada como conflito
- **AND** SHALL NOT sobrescrever a seleção vencedora nem criar segunda reserva

#### Scenario: Reabertura e retry preservam a seleção congelada

- **WHEN** a mesma operação é reaberta ou retentada
- **THEN** o sistema SHALL devolver a seleção já congelada
- **AND** SHALL NOT sobrescrevê-la com a configuração administrativa vigente

#### Scenario: Operação legada é explicitamente Sunburst low

- **WHEN** a operação possui `contract_version = 1` e não possui seleção persistida
- **THEN** o sistema SHALL classificá-la como `legacy_sunburst_low`
- **AND** SHALL usar `gpt-image-2.5-sunburst` em `low`
- **AND** SHALL NOT gravar seleção retroativa nem reescrever o histórico

#### Scenario: Seleção ausente em operação nova falha fechado

- **WHEN** uma operação `contract_version = 2` não possui seleção completa e válida
- **THEN** o sistema SHALL recusar a expansão como configuração indisponível
- **AND** SHALL NOT usar o comportamento legado, fallback ou outro modelo

#### Scenario: Seleção não pode ser trocada após a abertura

- **WHEN** uma operação já aberta recebe uma tentativa de reabertura com outra seleção
- **THEN** o sistema SHALL recusar o conflito de configuração
- **AND** SHALL manter a seleção original e a reserva existente
