## ADDED Requirements

### Requirement: AdminUserSummary data contract

O sistema SHALL definir o tipo `AdminUserSummary` para representar dados consolidados de um lojista na view admin.

```typescript
export interface AdminUserSummary {
  userId: string;
  email: string;
  storeId: string | null;
  storeName: string | null;
  segment: string | null;
  balance: number;
  totalCampaigns: number;
  errorCampaigns: number;
  lastCampaignAt: string | null;
  createdAt: string;
}
```

#### Scenario: AdminUserSummary contains all support fields

- **WHEN** admin consulta lista de usuários
- **THEN** cada entry contém userId, email, storeId, storeName, segment, balance, totalCampaigns, errorCampaigns, lastCampaignAt, createdAt

### Requirement: GET /api/admin/users

O sistema SHALL expor `GET /api/admin/users` para listar usuários com dados de suporte.

- Requer `requireAdmin()`
- Parâmetros: `page`, `pageSize`, `search?` (busca por nome, email, segmento)
- Retorna `{ data: AdminUserSummary[], total, page, pageSize }`
- Consulta consolidada: JOIN entre `stores`, `credit_balances`, `campaigns`
- Dados do usuário (email) obtidos via RPC ou view SECURITY DEFINER que consulta `auth.users` com privilégios de service_role (já que `auth.users` não é acessível via cliente Supabase anônimo)
- Ordenação padrão: `created_at DESC`

#### Scenario: Admin lists users paginated

- **WHEN** admin faz GET `/api/admin/users?page=1&pageSize=20`
- **THEN** retorna lista paginada de usuários com dados de suporte

#### Scenario: Admin searches users

- **WHEN** admin faz GET `/api/admin/users?search=joao`
- **THEN** retorna usuários cujo email ou storeName contém "joao"

#### Scenario: Unauthorized access returns 403

- **WHEN** usuário não admin faz GET `/api/admin/users`
- **THEN** retorna 403

### Requirement: GET /api/admin/users/[id]

O sistema SHALL expor `GET /api/admin/users/[id]` para detalhe completo de um lojista.

- Requer `requireAdmin()`
- Retorna dados do usuário, loja, saldo atual, extrato (transações), campanhas recentes
- Saldo via `creditService.getBalance(storeId)`
- Extrato via `creditService.getHistory(storeId)`

#### Scenario: Admin views user detail

- **WHEN** admin faz GET `/api/admin/users/abc-123`
- **THEN** retorna dados completos: usuário, loja, saldo, extrato, campanhas

#### Scenario: Admin views user with no store

- **WHEN** admin faz GET `/api/admin/users/abc-123` onde usuário não tem loja
- **THEN** retorna dados do usuário com `storeId: null`, `balance: 0`

### Requirement: /admin/users directory page

O sistema SHALL exibir `/admin/users` com diretório de usuários/lojas.

- Server Component com busca SSR via searchParams
- Tabela com colunas: email, loja, segmento, saldo, total de campanhas, erros, última campanha, criado em
- Busca por nome/email/segmento
- Paginação
- Link para detalhe `/admin/users/[id]`

#### Scenario: Admin views user directory

- **WHEN** admin acessa `/admin/users`
- **THEN** exibe tabela paginada com todos os usuários e dados de suporte

#### Scenario: Admin searches in directory

- **WHEN** admin digita "joão" no campo de busca
- **THEN** lista filtra para usuários cujo email ou storeName contém "joão"

### Requirement: /admin/users/[id] detail page

O sistema SHALL exibir `/admin/users/[id]` com detalhe completo do lojista.

- Server Component com dados consolidados
- Seção "Dados da Loja": nome, segmento, criado em
- Seção "Saldo": saldo atual
- Seção "Extrato": tabela de transações (tipo, valor, data, motivo)
- Seção "Conceder Créditos": formulário de grant inline (Client Component)
- Seção "Campanhas": tabela com campanhas recentes, destacando errors em vermelho

#### Scenario: Admin views user detail page

- **WHEN** admin acessa `/admin/users/abc-123`
- **THEN** exibe dados consolidados com saldo, extrato, formulário de grant e campanhas
