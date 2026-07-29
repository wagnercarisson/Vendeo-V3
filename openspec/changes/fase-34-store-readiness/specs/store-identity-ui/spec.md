## MODIFIED Requirements

### Requirement: Step 1 success message after saving store

> **Delta F34:** A mensagem após salvar o Step 1 SHALL ser alterada para direcionar o usuário ao Step 2. O texto anterior "Loja criada com sucesso!" SHALL ser substituído.

The system SHALL change the post-Step-1 success message from "Loja criada com sucesso!" to "Loja salva. Agora configure a direção visual." (when approved). For other verification statuses, the message SHALL replace "criada" with "salva" to reflect that the store can be edited, not just created.

#### Scenario: Submit APPROVE mostra mensagem com direção ao Step 2

- **WHEN** submit retorna `verificationStatus: 'approved'`
- **THEN** exibe toast/mensagem: "Loja salva. Agora configure a direção visual."

#### Scenario: Submit com outros status mantém mensagens existentes

- **WHEN** submit retorna `verificationStatus: 'review'`
- **THEN** exibe toast/mensagem: "Loja salva. Seus créditos de boas-vindas serão liberados após verificação cadastral."

(NOTA: Demais cenários de submit status mantêm o texto da F33, apenas substituindo "criada" por "salva" para refletir que loja pode ser editada, não apenas criada.)

### Requirement: Navigation between `/loja` and `/campanhas/nova`

> **Delta F34:** A página `StorePageClient` SHALL aceitar query param `?required=visual-direction` para abrir direto no Step 2. O guard de store exists em `/campanhas/nova` SHALL preceder o guard de readiness (adicionado em outro spec).

The system SHALL support the `?required=visual-direction` query parameter on `/loja`. When present, `StorePageClient` SHALL pass it to `StoreIdentityForm`, which SHALL open directly on Step 2 (Direção Visual).

#### Scenario: Query param ?required=visual-direction abre Step 2

- **WHEN** usuário acessa `/loja?required=visual-direction`
- **THEN** `StorePageClient` passa o query param para `StoreIdentityForm`
- **AND** o formulário abre diretamente no Step 2 (Direção Visual)

## ADDED Requirements

### Requirement: Step 2 renomeado para "Direção Visual" com badge "Necessário"

O sistema SHALL renomear o Step 2 do formulário de identidade da loja de "Logo e Cores" para **"Direção Visual"**. No stepper, ao lado do label do Step 2, SHALL ser exibido um badge "Necessário".

#### Scenario: Step 2 exibe "Direção Visual" com badge

- **WHEN** o formulário de identidade da loja é exibido
- **THEN** o Step 2 no stepper mostra "Direção Visual"
- **AND** um badge "Necessário" é exibido ao lado do label do Step 2

### Requirement: Card colapsável "Dados para faturamento (opcional)" no Step 1

O sistema SHALL adicionar um card colapsável no Step 1 do formulário com os campos de billing/NFSe. O card SHALL:

- Título: "Dados para faturamento (opcional)"
- Iniciar expandido se dados da BrasilAPI/CNPJá estiverem disponíveis (pré-preenchidos)
- Iniciar colapsado se não houver dados disponíveis, com mensagem "Complete os dados da loja primeiro para pré-preencher o endereço fiscal"
- Ser expansível/colapsável a qualquer momento sem perda de dados
- Campos: email, telefone, endereço (rua, número, complemento, bairro, cidade, estado, CEP, código IBGE)
- Botão "Confirmar dados de faturamento" dentro do card, separado do "Salvar e continuar"
- Botão desabilitado se card colapsado, ou se nenhum dado obrigatório mínimo foi preenchido: pelo menos `billing_email` OU (`billing_address_street` + `billing_address_number` + `billing_address_city` + `billing_address_state`)
- `billing_data_source`: inicia como `'brasilapi'` ou `'cnpja'` conforme origem; muda para `'manual'` se usuário editar qualquer campo
- `billing_data_confirmed_at`: setado apenas quando usuário clica em "Confirmar dados de faturamento"
- Resetar `billing_data_confirmed_at` para null se usuário editar campos após confirmar

#### Scenario: Card de billing aparece no Step 1

- **WHEN** usuário está no Step 1 do formulário
- **THEN** o card "Dados para faturamento (opcional)" está visível

#### Scenario: Card expandido com dados pré-preenchidos

- **WHEN** dados de CNPJ foram consultados via BrasilAPI/CNPJá
- **AND** há dados de endereço disponíveis
- **THEN** o card inicia expandido
- **AND** campos de endereço estão pré-preenchidos

#### Scenario: Card colapsado quando sem dados

- **WHEN** não há dados de CNPJ disponíveis (loja legacy, sem CNPJ)
- **THEN** o card inicia colapsado
- **AND** exibe mensagem "Complete os dados da loja primeiro para pré-preencher o endereço fiscal"

#### Scenario: Confirmação de billing é ação separada

- **WHEN** usuário clica "Confirmar dados de faturamento"
- **THEN** `billing_data_confirmed_at` é setado com timestamp atual
- **AND** dados são persistidos via `upsertStoreBillingInfo()`

#### Scenario: Edição após confirmação reseta confirmed_at

- **WHEN** usuário edita qualquer campo de billing após ter confirmado
- **THEN** `billing_data_confirmed_at` é resetado para null
- **AND** `billing_data_source` muda para `'manual'`

#### Scenario: Salvar Step 1 sem confirmar billing preserva dados

- **WHEN** usuário salva Step 1 sem clicar em "Confirmar dados de faturamento"
- **THEN** os dados preenchidos no card são persistidos
- **AND** `billing_data_confirmed_at` permanece null

### Requirement: Botão no dashboard "Configurar direção visual"

Para lojas sem brand profile synced, o dashboard SHALL exibir um botão "Configurar direção visual" que linka para `/loja?required=visual-direction`.

#### Scenario: Dashboard mostra CTA para direção visual

- **WHEN** loja não tem brand profile synced
- **THEN** o dashboard exibe botão "Configurar direção visual"
- **AND** o botão linka para `/loja?required=visual-direction`
