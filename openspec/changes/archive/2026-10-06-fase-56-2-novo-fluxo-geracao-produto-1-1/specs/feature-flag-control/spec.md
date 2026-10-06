# Feature Flag Control

## ADDED Requirements

### Requirement: Chaves de ativação do novo fluxo Produto 1:1 com default fail-closed

O sistema SHALL registrar duas chaves de ativação do novo fluxo Produto 1:1 — uma para lojas com `is_test_store = true` e outra para todas as lojas — com default **desligado** e leitura server-side. Falha de leitura, chave ausente ou desligada SHALL manter o fluxo legado, nunca ativar o novo fluxo.

#### Scenario: Default desligado mantém o legado

- **WHEN** as chaves nunca foram configuradas
- **THEN** o novo fluxo permanece desligado
- **AND** o fluxo legado é usado

#### Scenario: Falha de leitura mantém o legado

- **WHEN** a leitura da chave falha
- **THEN** o fluxo legado é mantido
- **AND** o novo fluxo não é ativado por omissão

### Requirement: Alteração auditável das chaves de ativação

A alteração das chaves SHALL ser auditável (autor, motivo e `operation_id`), no padrão administrativo existente, e SHALL ser lida em tempo de execução pelo backend.

#### Scenario: Alteração registrada em auditoria

- **WHEN** um admin altera uma chave de ativação com motivo
- **THEN** a alteração é registrada em auditoria com autor e timestamp
- **AND** a execução seguinte observa o novo estado sem deploy
