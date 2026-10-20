# Demo Status UI

## Purpose

Exibir de forma clara o estado e a validade da demonstração e orientar suporte sem linguagem de compra ou SLA indevido.

## Requirements

### Requirement: Estados da demonstração

O sistema SHALL derivar estados mutuamente exclusivos: `none` quando origem é NULL; `expired` quando houve origem e prazo é vencido ou NULL após materialização; `exhausted` quando prazo futuro e demo zero; `expiring_soon` quando restam até 24h e há saldo; `active` quando restam mais de 24h e há saldo. Também SHALL distinguir saldo total insuficiente de bônus/comprado pós-demo.

#### Scenario: Estados ativos e encerrados

- **WHEN** há mais de 24h e saldo demo positivo
- **THEN** status é `active`
- **WHEN** há até 24h e saldo positivo
- **THEN** status é `expiring_soon`
- **WHEN** prazo venceu ou foi materializado
- **THEN** status é `expired`

#### Scenario: Expirado após materialização não vira none

- **WHEN** `demo_expires_at IS NULL` após materialização e há origem
- **THEN** status é `expired`

#### Scenario: Sem demonstração

- **WHEN** `origin_demo_grant_tx_id IS NULL`
- **THEN** status é `none`

#### Scenario: Bônus pós-demo é distinguível

- **WHEN** demo expirou mas bônus ou comprado é positivo
- **THEN** UI indica saldo utilizável além da demonstração

#### Scenario: Demo esgotada

- **WHEN** prazo ainda é futuro e `demo_balance=0`
- **THEN** status é `exhausted`

### Requirement: Exibição local e relativa

O sistema SHALL exibir `demo_expires_at` em data/hora local do usuário e texto relativo usando `Intl.DateTimeFormat` e timezone do client.

#### Scenario: Data/hora local

- **WHEN** demo está ativa
- **THEN** a expiração é exibida no fuso local

#### Scenario: Texto relativo

- **WHEN** faltam menos de 24h
- **THEN** exibe texto como "expira em X horas"

### Requirement: Sem compra e sem SLA

Nenhuma superfície SHALL exibir comprar/adquirir créditos ou prometer resposta em 24 horas; CTA sem saldo orienta solicitar créditos ao suporte.

#### Scenario: Nenhuma promessa de compra

- **WHEN** qualquer superfície de crédito é renderizada
- **THEN** não exibe linguagem de compra

#### Scenario: Sem SLA

- **WHEN** CTA é renderizado
- **THEN** não promete resposta em 24 horas e orienta contato sem prazo

### Requirement: Estados do teste de 28 dias

O sistema SHALL derivar o estado do teste a partir do enrollment e do bucket demo: `not_started`, `active`, `expiring_soon`, `exhausted`, `expired` ou `legacy_demo`. A UI SHALL exibir o estado, o saldo disponível, o vencimento local/relativo e, quando houver, a próxima parcela. A UI SHALL distinguir o teste da demo legada e SHALL NOT exibir “ganhe 10 créditos” para contas novas.

#### Scenario: Teste ativo

- **WHEN** o enrollment existe e `now < expires_at`
- **THEN** a UI exibe “Teste gratuito ativo”
- **AND** mostra o vencimento local e o texto relativo

#### Scenario: Vencimento próximo

- **WHEN** restam 24h ou menos e há saldo
- **THEN** a UI exibe “Expira em breve”

#### Scenario: Esgotado

- **WHEN** o prazo é futuro e o saldo demo é zero
- **THEN** a UI exibe “Teste esgotado”
- **AND** não sugere renovação automática

#### Scenario: Expirado

- **WHEN** `now >= expires_at`
- **THEN** a UI exibe “Teste encerrado”
- **AND** distingue saldo de bônus/comprado, se houver

#### Scenario: Conta legada

- **WHEN** não há enrollment e a conta está sob a demo legada
- **THEN** a UI mantém os textos legados
- **AND** não exibe o cronograma de 28 dias

### Requirement: Próxima parcela e acumulação

Quando o teste estiver ativo e houver parcela pendente, a UI SHALL informar a próxima parcela e que os créditos acumulam mesmo sem uso ou login. A UI SHALL informar que a parcela fica elegível no dia 7/14/21 e pode ser creditada na execução diária seguinte, sem prometer liberação no segundo exato. A UI SHALL NOT prometer parcela além do dia 21 nem crédito após o vencimento.

#### Scenario: Próxima parcela

- **WHEN** a próxima parcela é a do dia 14
- **THEN** a UI informa “Próxima parcela: dia 14”
- **AND** informa que os créditos acumulam

#### Scenario: Execução diária

- **WHEN** a parcela fica elegível após o horário da execução diária
- **THEN** a UI informa que o crédito pode ocorrer na execução seguinte
- **AND** não promete o segundo exato

#### Scenario: Todas as parcelas concedidas

- **WHEN** `granted_total=20`
- **THEN** a UI não exibe nova parcela
- **AND** mantém o vencimento do teste

### Requirement: Falha de início repetível na UI

Quando a resposta da operação de onboarding retornar `trialOffer.status='retryable_failure'`, a UI SHALL exibir um aviso seguro e uma ação “Tentar novamente” que chama a **rota dedicada de retry** (`POST /api/store/trial-offer/retry`), autenticada e com ownership. O retry SHALL repetir somente conclusão/inscrição, sem reenviar onboarding e sem reexecutar logo, perfil, assinatura ou provider. A UI SHALL NOT apresentar o teste como iniciado nem o crédito como concedido enquanto a repetição não concluir. Quando o estado for `expired_window`, a UI SHALL informar que a janela de 28 dias foi encerrada e SHALL NOT oferecer retry de inscrição.

#### Scenario: Falha após salvar o onboarding

- **WHEN** o onboarding foi salvo e o teste não iniciou
- **THEN** a UI exibe o aviso de falha repetível
- **AND** oferece “Tentar novamente”

#### Scenario: Retry dedicado

- **WHEN** o usuário aciona “Tentar novamente”
- **THEN** a UI chama somente a rota de retry
- **AND** não reenvia o onboarding
- **AND** nenhum logo/perfil/assinatura/provider é executado

#### Scenario: Repetição bem-sucedida

- **WHEN** a rota de retry conclui
- **THEN** a UI atualiza para o estado do teste iniciado

#### Scenario: Janela encerrada

- **WHEN** o estado é `expired_window`
- **THEN** a UI informa que a janela de 28 dias foi encerrada
- **AND** não oferece retry de inscrição

#### Scenario: Sem falso sucesso

- **WHEN** a falha persiste
- **THEN** a UI não exibe “Teste ativo”
- **AND** não exibe crédito concedido

### Requirement: Pós-teste e acesso preservado

Após o vencimento, o sistema SHALL manter conta, login, campanhas geradas e downloads disponíveis. Novas gerações SHALL depender de saldo válido e dos controles existentes. A UI SHALL orientar o contato com o suporte para solicitar mais créditos, sem checkout, planos ou assinatura.

#### Scenario: Campanhas e downloads acessíveis

- **WHEN** o teste venceu
- **THEN** o usuário continua autenticado
- **AND** consegue abrir campanhas e baixar artes já entregues

#### Scenario: Nova geração sem saldo

- **WHEN** o teste venceu e não há saldo válido
- **THEN** a geração é bloqueada pelos controles existentes
- **AND** a UI orienta solicitar créditos ao suporte

#### Scenario: Sem linguagem de compra

- **WHEN** qualquer superfície do teste é renderizada
- **THEN** não exibe “comprar”, “assinar” ou “adquirir créditos”
- **AND** não promete prazo de resposta do suporte
