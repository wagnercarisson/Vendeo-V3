## MODIFIED Requirements

### Requirement: AdminUserSummary — campo de CNPJ e status freemium

O sistema SHALL estender `AdminUserSummary` com:
- `cnpjMasked: string | null` — CNPJ mascarado da loja
- `freemiumStatus: "active" | "used" | "exhausted" | "no_cnpj"`

#### Scenario: AdminUserSummary contém CNPJ e freemium

- **WHEN** admin consulta lista de usuários
- **THEN** cada entry contém `cnpjMasked` e `freemiumStatus`

### Requirement: User detail page — CNPJ e status freemium

O sistema SHALL exibir na página de detalhe `/admin/users/[id]`:

- **CNPJ mascarado**: `**.***.***/0001-**`
- **Badge de status freemium**: ativo/usado/esgotado/sem CNPJ
- **Histórico de entitlements**: tabela `freemium_entitlements` ordenada por `created_at DESC`
- **Botão "Conceder exceção"**: grant manual que bypassa verificação de raiz, com reason obrigatório + audit log

#### Scenario: Admin vê CNPJ e freemium status

- **WHEN** admin acessa `/admin/users/[id]`
- **THEN** CNPJ mascarado é exibido
- **AND** badge de status freemium é exibido
- **AND** histórico de entitlements é exibido

#### Scenario: Admin concede exceção

- **WHEN** admin clica "Conceder exceção"
- **AND** preenche reason
- **THEN** grant é concedido
- **AND** registrado em `freemium_entitlements` como `admin_exception`
- **AND** registrado em `admin_audit_log`

### Requirement: /admin/users listagem com filtro freemium

A página de listagem SHALL ter coluna de CNPJ mascarado e filtro dropdown por status freemium.

#### Scenario: Listagem com filtro freemium

- **WHEN** admin acessa `/admin/users`
- **THEN** coluna CNPJ mascarado está presente
- **AND** filtro "Sem freemium" / "Freemium usado" / "Freemium ativo" está disponível