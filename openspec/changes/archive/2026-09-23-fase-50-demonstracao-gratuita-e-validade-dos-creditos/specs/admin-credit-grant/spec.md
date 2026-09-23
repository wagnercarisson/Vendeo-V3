# Admin Credit Grant

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D8/D3). O grant admin passa a ser bônus manual não-expirável, sem prazo informativo em metadata.

## MODIFIED Requirements

### Requirement: admin_grant_credits RPC function (MODIFIED F29.3)

O sistema SHALL manter `admin_grant_credits` concedendo **bônus não-expirável** (`p_type='admin_grant'` → `bonus_balance`). A metadata/auditoria NÃO SHALL armazenar prazo meramente informativo (prazo excepcional de bônus é follow-up).

#### Scenario: Admin grant é bônus não-expirável

- **WHEN** admin concede créditos via `admin_grant_credits`
- **THEN** incrementa `bonus_balance` e não define expiração
- **AND** audit log registra `grant_type='admin_grant'`

#### Scenario: Sem prazo informativo

- **WHEN** admin concede bônus
- **THEN** nenhum prazo expirável é aceito/armazenado

### Requirement: Admin monthly credit grant button (ADDED F29.3)

O sistema SHALL **remover/desativar** o botão "Executar concessão mensal" (D9).

#### Scenario: Botão mensal removido

- **WHEN** a F50 está ativa
- **THEN** a superfície de concessão mensal não está disponível na UI admin
