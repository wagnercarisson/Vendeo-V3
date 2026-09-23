# Admin User Directory

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D11). O resumo admin passa a expor a demonstração (saldo/validade/status).

## MODIFIED Requirements

### Requirement: admin_get_users_summary

O sistema SHALL incluir no resumo admin (`admin_get_users_summary` e a página `/admin/users/[id]`) os campos de demonstração: `demoBalance`, `demoExpiresAt` e o status derivado, além de `bonusBalance`/`purchasedBalance`.

#### Scenario: Resumo admin inclui demo

- **WHEN** o admin lista usuários
- **THEN** a linha/coluna expõe `demo_balance`, `demo_expires_at` e o status da demonstração
