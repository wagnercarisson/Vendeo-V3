## MODIFIED Requirements

### Requirement: Lojas legadas sem CNPJ — bloqueio de geração

> **Delta F34:** O banner informativo é mantido. O comportamento SHALL mudar de apenas informativo para bloqueio de geração. Lojas legacy sem cadastro fiscal completo SHALL ser redirecionadas ao tentar acessar `/campanhas/nova` ou chamar a API de geração.

The system SHALL block generation for legacy stores missing cadastro fiscal. When a legacy store without `cnpj_normalized`, `razao_social` or `nome_fantasia` tries to access `/campanhas/nova` or call the generate API, the readiness guard SHALL redirect to `/cadastro/cnpj?returnTo=/campanhas/nova`. The dashboard banner SHALL continue to be displayed.

#### Scenario: Loja legacy bloqueada ao gerar campanha

- **WHEN** loja legacy (sem `cnpj_normalized`, `razao_social` ou `nome_fantasia`) acessa `/campanhas/nova`
- **THEN** o guard de readiness redireciona para `/cadastro/cnpj?returnTo=/campanhas/nova`
- **AND** banner no dashboard continua sendo exibido

### Requirement: Formulário de atualização cadastral com returnTo

> **Delta F34:** Após atualização bem-sucedida, o sistema SHALL ler `returnTo` dos query params e redirecionar conforme readiness. Se store também não tem brand profile, SHALL redirecionar para `/loja?required=visual-direction`.

The system SHALL read `returnTo` from query params after a successful CNPJ update. If the store also lacks a brand profile, it SHALL redirect to `/loja?required=visual-direction`. If the store is ready (has brand profile), it SHALL redirect to `returnTo` value, or to `/dashboard` if `returnTo` is absent.

#### Scenario: Atualização redireciona para brand profile se necessário

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store também não tem brand profile synced
- **THEN** redireciona para `/loja?required=visual-direction`

#### Scenario: Atualização redireciona para returnTo se pronta

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store já tem brand profile synced
- **AND** `returnTo` está presente nos query params
- **THEN** redireciona para o valor de `returnTo`

#### Scenario: Atualização sem returnTo vai para dashboard

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store já tem brand profile synced
- **AND** `returnTo` não está presente
- **THEN** redireciona para `/dashboard`

### Requirement: Mensagens do redirect de guarda

O sistema SHALL exibir mensagens específicas no contexto de redirect de guarda:

| Contexto | Mensagem |
|----------|----------|
| Redirect do guard (cadastro fiscal ausente) | "Sua loja precisa do CNPJ, razão social e nome fantasia para gerar campanhas. Atualize seus dados cadastrais para continuar." |
| Redirect do guard (brand profile ausente) | "Sua loja precisa de uma direção visual para gerar campanhas. Configure agora." |
| Após atualizar cadastro + sem brand profile | "Dados atualizados! Agora configure a direção visual da sua loja." |

#### Scenario: Mensagem de redirect para cadastro fiscal

- **WHEN** usuário é redirecionado para `/cadastro/cnpj?returnTo=/campanhas/nova`
- **THEN** a página de cadastro exibe a mensagem "Sua loja precisa do CNPJ, razão social e nome fantasia para gerar campanhas."

#### Scenario: Mensagem de redirect para direção visual

- **WHEN** usuário é redirecionado para `/loja?required=visual-direction`
- **THEN** a página exibe a mensagem "Sua loja precisa de uma direção visual para gerar campanhas. Configure agora."

#### Scenario: Mensagem após atualizar cadastro sem brand profile

- **WHEN** usuário completa cadastro fiscal e é redirecionado para direção visual
- **THEN** a página exibe a mensagem "Dados atualizados! Agora configure a direção visual da sua loja."

### Requirement: RPC update_store_cnpj() — comportamento mantido

> **Delta F34:** A RPC `update_store_cnpj()` SHALL permanecer inalterada. Nenhum crédito SHALL ser concedido. O entitlement `onboarding` sem grant SHALL ser inserido para marcar raiz consumida. O fluxo de redirect SHALL ser gerenciado pelo cliente (página de cadastro), não pela RPC.

The RPC `update_store_cnpj()` SHALL NOT be modified. No onboarding credits SHALL be granted. The `onboarding` entitlement without grant SHALL be inserted to mark the root as consumed. Redirect logic SHALL be handled by the client page, not by the RPC.

#### Scenario: Atualização não concede créditos (mantido)

- **WHEN** loja legacy informa CNPJ via formulário de atualização
- **THEN** `update_store_cnpj()` é chamado
- **AND** NENHUM crédito de onboarding é concedido
- **AND** saldo existente permanece intacto
