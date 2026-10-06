# Image Generation Failure Policy

## ADDED Requirements

### Requirement: Execução da política sobre geração real

A política de falhas SHALL ser aplicada a uma geração real do novo fluxo. A classificação elegível/não elegível SHALL decidir repetição no principal ou fallback durante a operação real, respeitando o teto de três chamadas.

#### Scenario: Classificação dirige a execução

- **WHEN** uma tentativa real do principal falha
- **THEN** a classificação determina retry no principal, fallback ou encerramento
- **AND** o teto de três chamadas é respeitado

#### Scenario: Falha não elegível encerra sem fallback

- **WHEN** uma falha não elegível ocorre na tentativa real
- **THEN** o fallback não é acionado
- **AND** a operação encerra de forma identificável

### Requirement: Enforcement transacional de não-cobrança de falha técnica

O novo fluxo SHALL garantir, de forma transacional, que falha técnica sem arte utilizável **não** debite o lojista; `charged`/`consumedCredit` SHALL refletir o estado real do ledger ao final.

#### Scenario: Falha não debita no ledger

- **WHEN** a operação termina por falha técnica sem arte utilizável
- **THEN** o crédito reservado é estornado
- **AND** nenhuma cobrança permanece associada à operação

#### Scenario: Entrega com fallback mantém um crédito

- **WHEN** a operação entrega a arte usando o fallback
- **THEN** a cobrança é de uma campanha entregue
- **AND** o fallback não cria cobrança adicional
