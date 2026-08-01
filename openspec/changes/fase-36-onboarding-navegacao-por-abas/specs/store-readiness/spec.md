## MODIFIED Requirements

### Requirement: Store Readiness — função server-side getStoreReadiness()

> **Delta F36:** A função SHALL tratar explicitamente lojas em **modo draft** (criadas sem CNPJ pela F36). Para essas lojas, `getStoreReadiness()` SHALL retornar `ready: false` com `cadastro_fiscal` na lista de `missing` (o dado ausente já produz a pendência na RPC da F34 — nenhuma mudança na lógica, apenas o caso é explicitado). A loja draft passa a existir como estado legítimo: pode completar onboarding/posicionamento/direção visual, mas **não gera campanha nem recebe crédito** até o fiscal ser anexado.

O sistema SHALL prover uma função `getStoreReadiness(storeId: string)` em `src/lib/store-readiness.ts` que retorna o estado de prontidão da loja para gerar campanhas. A função SHALL chamar o RPC `check_store_readiness(p_store_id)` no banco de dados.

(Os demais `SHALL` da F34 permanecem inalterados — ver spec principal.)

#### Scenario: Loja draft sem CNPJ é reportada como não pronta

- **WHEN** `getStoreReadiness(storeId)` é chamado para uma loja criada em modo draft (sem `cnpj_normalized`)
- **THEN** retorna `{ ready: false, missing: [{ item: "cadastro_fiscal", reason: "..." }] }`
- **AND** a loja pode continuar o onboarding (abas), mas não gera campanha nem recebe crédito

#### Scenario: Loja draft com brand profile synced ainda não gera

- **WHEN** `getStoreReadiness(storeId)` é chamado para uma loja draft com brand profile synced mas sem CNPJ
- **THEN** retorna `{ ready: false, missing: [{ item: "cadastro_fiscal", reason: "..." }] }`
- **AND** `brand_profile` NÃO aparece como pendente (o profile existe)

### Requirement: RPC check_store_readiness — critério de readiness

> **Delta F36:** O sistema SHALL manter o RPC da F34 inalterado. O critério atual (`cnpj_normalized`, `razao_social`, `nome_fantasia` não-nulos E brand profile `synced`) SHALL tratar lojas draft corretamente — loja draft tem os campos fiscais nulos e SHALL cair em `cadastro_fiscal` pendente.

#### Scenario: RPC trata loja draft como fiscal pendente

- **WHEN** `check_store_readiness` é chamado para uma loja criada em modo draft (campos fiscais nulos)
- **THEN** retorna `{ ready: false, missing: [{ item: "cadastro_fiscal", reason: "..." }] }`

(Nenhuma outra alteração de requisito — RPC da F34 inalterada.)

### Requirement: Prioridade de resolução — cadastro fiscal primeiro

> **Delta F36 (D12):** Os **alvos de redirect** SHALL migrar de `?required=` para `?tab=` mantendo a ordem de prioridade. O guard de `/campanhas/nova` e o redirect pós-cadastro de `/cadastro/cnpj` SHALL apontar para `/loja?tab=dados&fiscal=pending` (fiscal) e `/loja?tab=direcao-visual&message=needs-visual-direction` (brand profile). O `ReadinessBanner` (dashboard) SHALL emitir `/loja?tab=<aba da pendência>&message=<pendência>`. A ordem cadastro fiscal → brand profile permanece.

O sistema SHALL seguir a ordem de prioridade: cadastro fiscal (deve ser resolvido primeiro) → brand profile. Esta ordem guia o redirect, a exibição no dashboard e as mensagens ao usuário.

#### Scenario: Ambos faltam — redirect para fiscal primeiro via ?tab=

- **WHEN** `getStoreReadiness()` retorna `missing: ["cadastro_fiscal", "brand_profile"]` no guard de `/campanhas/nova`
- **THEN** o guard redireciona para `/loja?tab=dados&fiscal=pending&returnTo=/campanhas/nova`
- **AND** após resolver o fiscal, se brand profile ainda ausente, redireciona para `/loja?tab=direcao-visual&message=needs-visual-direction`

#### Scenario: Guard de brand profile usa ?tab=direcao-visual

- **WHEN** `getStoreReadiness()` retorna `missing: ["brand_profile"]`
- **THEN** o guard redireciona para `/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova`
- **AND** se a aba Direção Visual estiver bloqueada, cai na regra ② com aviso (ver D6)

#### Scenario: ReadinessBanner usa ?tab= da pendência

- **WHEN** o `ReadinessBanner` renderiza um link para pendência no dashboard
- **THEN** fiscal → `/loja?tab=dados&fiscal=pending&returnTo=/dashboard`
- **AND** brand profile → `/loja?tab=direcao-visual&message=needs-visual-direction`
- **AND** a mensagem contextual da F34 é mantida

### Requirement: Store Readiness — critérios explícitos NÃO verificados

> **Delta F36:** O `identity_state`/estado de onboarding SHALL NÃO se tornar critério de readiness — loja draft (sem fiscal) permanece "não pronta para gerar", mas completa para o onboarding em abas. Os demais critérios da F34 permanecem inalterados.

#### Scenario: Loja draft completa para onboarding mas não para gerar

- **WHEN** uma loja draft (sem fiscal) tem posicionamento/direção visual configurados
- **THEN** ela pode completar o onboarding em abas
- **AND** `getStoreReadiness()` permanece `ready: false` até o fiscal ser anexado
