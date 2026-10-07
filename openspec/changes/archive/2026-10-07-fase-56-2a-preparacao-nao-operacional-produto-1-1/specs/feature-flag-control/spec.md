# Feature Flag Control

> F56.2a — registro das chaves. A ativação efetiva pertence à F56.2b1.

## ADDED Requirements

### Requirement: Registro das duas chaves de ativação com default fail-closed

O sistema SHALL registrar em `feature_flags` as duas chaves de ativação do novo fluxo Produto 1:1 — lojas com `is_test_store = true` e todas as lojas — com default **desligado** e leitura server-side.

#### Scenario: Default desligado mantém o legado

- **WHEN** as chaves nunca foram configuradas
- **THEN** o novo fluxo permanece desligado
- **AND** o fluxo legado é usado

#### Scenario: Falha de leitura mantém o legado

- **WHEN** a leitura da chave falha
- **THEN** o fluxo legado é mantido
- **AND** o novo fluxo não é ativado por omissão

### Requirement: Alteração auditável das chaves pela RPC existente

A alteração das chaves SHALL ser auditável pela RPC administrativa existente (`admin_update_feature_flag`), com autor, motivo e `operation_id`, sem criar infraestrutura paralela.

#### Scenario: Alteração registrada em auditoria

- **WHEN** um admin altera uma chave de ativação com motivo
- **THEN** a alteração é registrada em auditoria com autor e timestamp
- **AND** a leitura seguinte observa o novo estado sem deploy
