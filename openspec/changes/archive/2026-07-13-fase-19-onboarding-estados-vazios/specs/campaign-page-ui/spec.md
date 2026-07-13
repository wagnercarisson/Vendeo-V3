## MODIFIED Requirements

### Requirement: Server Component com auth e ownership

O Server Component em `src/app/(app)/campanhas/[id]/page.tsx` SHALL:
- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, chamar `notFound()` em vez de `redirect("/loja")`
- Chamar `getCampaignForDisplay(id)` para carregar a campanha via RLS
- Se `getCampaignForDisplay` retornar `null`, chamar `notFound()`
- Calcular `displayStatus` server-side: `"ready"` | `"generating"` | `"stale"` | `"error"` usando `campaign.status` e `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000` para detectar stale
- Pré-computar `downloadUrl = "/api/campaign/${id}/download"` para o Client Component não precisar montar URLs
- Passar os dados da campanha para o Client Component como props serializáveis, incluindo `displayStatus`, `downloadUrl` e `updatedAt`

#### Scenario: Usuário autenticado sem loja recebe 404

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas/{id}`
- **THEN** `notFound()` é chamado → página 404
- **AND** o sistema NÃO redireciona para `/loja`

#### Scenario: Usuário autenticado acessa campanha própria

- **WHEN** um usuário autenticado acessa `/campanhas/{id}` onde `id` é uma campanha da sua loja
- **THEN** o Server Component carrega a campanha e renderiza o Client Component com os dados

#### Scenario: Campanha não encontrada ou de outro tenant

- **WHEN** um usuário autenticado acessa `/campanhas/{id}` onde `id` não existe ou pertence a outra loja
- **THEN** `notFound()` é chamado → página 404

#### Scenario: Usuário não autenticado

- **WHEN** um usuário não autenticado acessa `/campanhas/{id}`
- **THEN** o middleware redireciona para `/login` (ou o `requirePageUser` retorna 401)

## REMOVED Requirements

### Requirement: Redirect para /loja quando sem loja

**Reason**: Substituído por `notFound()`. Página de detalhe de recurso específico — sem loja, não é possível verificar ownership. 404 é semanticamente correto.

**Migration**: Substituir `if (!store) { redirect("/loja"); }` por `if (!store) { notFound(); }`.


