> Synced from `fase-26-admin-operacional` (ADDED).

## Purpose

Permitir que administradores visualizem e diagnostiquem campanhas com erro. Lista paginada com dados da loja, usuário e mensagem de erro para suporte rápido.

## Requirements

### Requirement: GET /api/admin/campaigns/errors

O sistema SHALL expor `GET /api/admin/campaigns/errors` para listar campanhas com erro.

- Requer `requireAdmin()`
- Consulta `campaigns WHERE status = 'error'`
- JOIN com `stores` para dados da loja
- Dados do usuário (email) obtidos via RPC ou view SECURITY DEFINER que consulta `auth.users` com privilégios de service_role
- Parâmetros: `page`, `pageSize`
- Ordenação padrão: `updated_at DESC` (mais recentes primeiro)
- Retorna `{ data: AdminCampaignError[], total, page, pageSize }`

#### Scenario: Admin fetches error campaigns

- **WHEN** admin faz GET `/api/admin/campaigns/errors?page=1&pageSize=20`
- **THEN** retorna lista paginada de campanhas com status 'error'

#### Scenario: No error campaigns returns empty list

- **WHEN** admin faz GET `/api/admin/campaigns/errors` e não há campanhas com erro
- **THEN** retorna `{ data: [], total: 0, page: 1, pageSize: 20 }`

#### Scenario: Error campaign includes store context

- **WHEN** admin consulta campanhas com erro
- **THEN** cada entry inclui dados da loja (nome, segmento) e do usuário (email)

### Requirement: AdminCampaignError data contract

O sistema SHALL definir o tipo de retorno para campanhas com erro na view admin.

```typescript
export interface AdminCampaignError {
  campaignId: string;
  productName: string;
  storeId: string;
  storeName: string;
  userEmail: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
```

#### Scenario: Error campaign data includes diagnostic fields

- **WHEN** admin consulta campanhas com erro
- **THEN** cada entry contém campaignId, productName, storeId, storeName, userEmail, errorMessage, createdAt, updatedAt

### Requirement: /admin/campaigns/errors page

O sistema SHALL exibir `/admin/campaigns/errors` com a lista de campanhas com erro.

- Server Component com dados SSR
- Tabela com colunas: produto, loja, usuário, erro, criado em, atualizado em
- Erro exibido em destaque (badge/cor vermelha)
- Paginação
- Link para detalhe da campanha (se `campaign-page` existir)

#### Scenario: Admin views error campaigns page

- **WHEN** admin acessa `/admin/campaigns/errors`
- **THEN** exibe tabela paginada com campanhas em erro e detalhes para diagnóstico
