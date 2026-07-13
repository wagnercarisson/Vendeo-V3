## MODIFIED Requirements

### Requirement: Server Component com auth e ownership

O Server Component em `src/app/(app)/campanhas/page.tsx` SHALL:
- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, renderizar empty state "Configure sua loja" com CTA → `/loja` (NÃO redirecionar)
- Chamar `listCampaigns(storeId)` para carregar as campanhas da loja via RLS
- Passar os dados serializáveis para o Client Component: `campaigns: CampaignListItem[]`

#### Scenario: Usuário autenticado acessa /campanhas

- **WHEN** um usuário autenticado com loja acessa `/campanhas`
- **THEN** o Server Component carrega a lista de campanhas e renderiza o Client Component

#### Scenario: Usuário autenticado sem loja vê empty state

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas`
- **THEN** o sistema SHALL renderizar um empty state com título "Configure sua loja" e descrição "Suas campanhas aparecerão aqui depois que você configurar sua loja."
- **AND** um CTA "Configurar loja" SHALL linkar para `/loja`
- **AND** o sistema SHALL NÃO redirecionar para `/loja`

#### Scenario: Usuário não autenticado

- **WHEN** um usuário não autenticado acessa `/campanhas`
- **THEN** o middleware redireciona para `/login`

### Requirement: Estado vazio

Quando `campaigns` é array vazio, o Client Component SHALL exibir:
- Mensagem "Nenhuma campanha ainda"
- Texto explicativo "Crie sua primeira campanha e ela aparecerá aqui."
- CTA "Criar primeira campanha" que navega para `/campanhas/nova`
- Toda microcopy SHALL ser referenciada de `src/lib/onboarding/microcopy.ts` (`CAMPAIGNS_NO_CAMPAIGNS`)

#### Scenario: Estado vazio com CTA e microcopy centralizada

- **WHEN** `listCampaigns` retorna `[]`
- **THEN** a página exibe mensagem de estado vazio "Nenhuma campanha ainda" + CTA "Criar primeira campanha" com link para `/campanhas/nova`
- **AND** os textos SHALL vir da constante `CAMPAIGNS_NO_CAMPAIGNS` em `microcopy.ts`

## REMOVED Requirements

### Requirement: Redirect para /loja quando sem loja

**Reason**: Substituído por empty state contextual com CTA. A milestone v1.4 definiu que "sem loja não é bloqueio" — o usuário deve receber orientação visual, não redirect seco.

**Migration**: Remover `if (!store) { redirect("/loja"); }` e substituir por `if (!store) { return <CampaignsNoStoreEmptyState />; }` usando `CAMPAIGNS_NO_STORE` de `microcopy.ts`.
