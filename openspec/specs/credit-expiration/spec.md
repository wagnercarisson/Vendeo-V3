# Credit Expiration

## Purpose

Definir validade, expiração e consumo do bucket de créditos de demonstração, incluindo evidência contábil e episódios de graça em estornos.

## Requirements

### Requirement: Bucket de demonstração com validade

O sistema SHALL manter `demo_balance`, `demo_expires_at`, `demo_cycle_id`, `origin_demo_grant_tx_id` e `demo_contributing_tx_ids` em `credit_balances`, com defaults seguros, sem expiração retroativa e `balance = demo_balance + bonus_balance + purchased_balance`. `demo_expires_at` é a fonte autoritativa e `demo_balance > 0` exige os identificadores do episódio.

#### Scenario: Defaults não expiram saldo legado

- **WHEN** a migration é executada
- **THEN** lojas existentes recebem `demo_balance=0`, `demo_expires_at=NULL`, ciclo/origem NULL e lista vazia, sem expiração retroativa

#### Scenario: Balance bruto soma os buckets

- **WHEN** qualquer bucket é atualizado
- **THEN** `balance` é sincronizado para a soma dos três buckets

### Requirement: Tipo de transação expiration

O sistema SHALL aceitar `expiration` no ledger com amount negativo, `reference = demo_cycle_id` e metadata contendo valor expirado, ciclo, grant original e contribuintes.

#### Scenario: Sinais de expiration

- **WHEN** `expiration` tem amount negativo
- **THEN** é aceito
- **WHEN** tem amount não-negativo
- **THEN** é rejeitado

### Requirement: Saldo disponível autoritativo

O sistema SHALL calcular saldo disponível como demo ativo (`demo_expires_at > now()`) + bônus + comprado. NULL nunca é ativo, e esse valor governa cobrança e `saldo_insuficiente`; o `balance` bruto não é usado como disponível.

#### Scenario: Demo vencido excluído

- **WHEN** demo expirou e não há outros buckets
- **THEN** saldo disponível é zero

#### Scenario: Demo ativo incluído

- **WHEN** `demo_expires_at > now()` e há demo
- **THEN** saldo disponível inclui demo

#### Scenario: Expiration NULL não é ativa

- **WHEN** `demo_expires_at IS NULL` com demo positivo inconsistente
- **THEN** demo não entra no disponível e o CHECK impede o estado

### Requirement: Materialização atômica e idempotente

O sistema SHALL prover `materialize_demo_expiration(p_store_id)` com lock de linha, transação `expiration`, limpeza do episódio ativo sem zerar a origem, no-op após materialização e no máximo uma expiração por episódio. Leitura não materializa.

#### Scenario: Materializa uma vez

- **WHEN** demo vencido ainda não foi materializado
- **THEN** cria `expiration`, zera o bucket e uma segunda chamada é no-op

#### Scenario: Demo ativo não materializa

- **WHEN** o prazo ainda é futuro
- **THEN** não cria transação nem altera o bucket

#### Scenario: Concorrência serializada

- **WHEN** duas chamadas concorrentes ocorrem
- **THEN** o lock permite somente uma `expiration`

### Requirement: Evidência deriva telemetria e notificação

`demo_expired` e a notificação de encerramento SHALL derivar da transação `expiration`, com dedup por `expiration_tx_id`; reconciliador repara ausências.

#### Scenario: Reserve materializa antes do cron

- **WHEN** `reserve_credit` materializa a expiração
- **THEN** evento e notificação de encerramento ainda são produzidos, inclusive por reparo do reconciliador

### Requirement: Esgotamento nasce na transição

Quando uma deduction faz demo ativa passar de positivo para zero, SHALL registrar evidência e derivar `demo_exhausted` dela.

#### Scenario: Último crédito marca esgotamento

- **WHEN** reserva consome o último crédito demo ativo
- **THEN** deduction registra `demo_before > 0`, `demo_after = 0` e deriva `demo_exhausted`

### Requirement: reserve_credit exclui vencido

`reserve_credit` SHALL materializar vencimento antes de consumir e consumir demo ativa, bônus e comprado nessa ordem, registrando breakdown e snapshot de validade. Demo vencido nunca é consumido.

#### Scenario: Demo vencido não é consumido

- **WHEN** reserva ocorre com demo vencido
- **THEN** expiração é materializada, demo é zero para consumo e insuficiência retorna após confirmar a expiração

#### Scenario: Ordem demo, bônus, comprado

- **WHEN** há 3 demo, 5 bônus e 10 comprado e reserva de 8
- **THEN** consome 3 demo e 5 bônus, registrando o breakdown

### Requirement: Estorno na borda do prazo

`refund_credit` SHALL restaurar demo segundo regra temporal: episódio original válido sem extensão; episódio de graça ativo com extensão até 24h; sem episódio ativo materializa saldo vencido e abre novo episódio de graça de 24h, preservando a origem e rastreabilidade.

#### Scenario: Saldo vencido materializa antes da graça

- **WHEN** há demo positivo vencido não materializado e ocorre refund
- **THEN** cria `expiration` antes de abrir o novo episódio

#### Scenario: Episódio esgotado vencido abre graça sem expiration prévia

- **WHEN** demo foi esgotada, venceu e não possui `expiration`
- **THEN** refund abre episódio de graça de 24h preservando a origem

#### Scenario: Episódio de graça rastreia contribuintes

- **WHEN** um episódio de graça expira
- **THEN** há no máximo uma `expiration` e a cadeia de contribuintes remonta ao grant original

#### Scenario: Reserva válida não é cancelada retroativamente

- **WHEN** reserva ocorreu antes do vencimento
- **THEN** a geração pode concluir normalmente

#### Scenario: Episódio original válido

- **WHEN** ocorre refund dentro do episódio original
- **THEN** restaura sem estender

#### Scenario: Episódio de graça ativo

- **WHEN** ocorre refund em episódio de graça
- **THEN** restaura e estende para pelo menos 24h

#### Scenario: Prazo vencido abre graça

- **WHEN** ocorre refund após vencimento sem episódio ativo
- **THEN** abre episódio novo de 24h após materializar eventual saldo vencido

#### Scenario: Demo esgotada ainda válida

- **WHEN** refund ocorre com demo esgotada mas dentro do prazo original
- **THEN** restaura no episódio original sem graça antecipada
