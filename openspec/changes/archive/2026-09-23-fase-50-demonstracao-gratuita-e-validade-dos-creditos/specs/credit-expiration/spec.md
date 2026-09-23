# Credit Expiration

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos`. Define o bucket de demonstração (`demo_balance`/`demo_expires_at` autoritativo, `demo_cycle_id`, `origin_demo_grant_tx_id`, `demo_contributing_tx_ids`), o tipo de transação `expiration` (evidência durável), a materialização atômica/idempotente da expiração (reserve + reconcilador), a regra autoritativa de saldo disponível e os **episódios de graça** no estorno.

## ADDED Requirements

### Requirement: Bucket de demonstração com validade

O sistema SHALL adicionar a `credit_balances` as colunas `demo_balance INTEGER NOT NULL DEFAULT 0 CHECK (demo_balance >= 0)`, `demo_expires_at TIMESTAMPTZ NULL`, `demo_cycle_id UUID NULL`, `origin_demo_grant_tx_id UUID NULL` e `demo_contributing_tx_ids UUID[] NOT NULL DEFAULT '{}'`. `demo_expires_at` é a **fonte de verdade autoritativa** de validade (NULL = sem demonstração ativa). `demo_cycle_id` identifica o **episódio corrente**; `origin_demo_grant_tx_id` é o **grant original** (estável). `balance` (bruto materializado) passa a `demo_balance + bonus_balance + purchased_balance` via `trg_credit_balances_sync_total`.

#### Scenario: Colunas demo existem com defaults seguros

- **WHEN** a migration é executada
- **THEN** `demo_balance` é `0`, `demo_expires_at` é `NULL`, `demo_cycle_id` é `NULL` e `demo_contributing_tx_ids` é `'{}'` para lojas existentes (sem expiração retroativa)

#### Scenario: demo_balance não-negativo

- **WHEN** uma operação tenta definir `demo_balance < 0`
- **THEN** o CHECK `demo_balance >= 0` rejeita

#### Scenario: balance bruto soma os três buckets

- **WHEN** `demo_balance`, `bonus_balance` ou `purchased_balance` é atualizado
- **THEN** `balance` é sincronizado para `demo_balance + bonus_balance + purchased_balance` via trigger

### Requirement: Tipo de transação expiration

O sistema SHALL adicionar `expiration` ao CHECK `chk_credit_transactions_type` (9 tipos) e ao `chk_credit_transactions_amount_sign` com `amount < 0`. A transação `expiration` SHALL registrar `reference = demo_cycle_id` (episódio corrente) e `metadata = { bucket: 'demo', expired_amount, cycle_id, origin_demo_grant_tx_id, contributing_tx_ids }`.

#### Scenario: expiration com amount negativo é aceito

- **WHEN** INSERT com `type = 'expiration'` e `amount < 0`
- **THEN** o INSERT é aceito

#### Scenario: expiration com amount não-negativo é rejeitado

- **WHEN** INSERT com `type = 'expiration'` e `amount >= 0`
- **THEN** o CHECK rejeita

#### Scenario: expiration referencia demo_cycle_id e lista contribuintes

- **WHEN** uma expiração é materializada
- **THEN** `reference` = `demo_cycle_id`
- **AND** `metadata.contributing_tx_ids` lista o grant `demo` e os `refund`s de graça que contribuíram (sem fingir uma única origem)

### Requirement: Saldo disponível autoritativo

O sistema SHALL computar o saldo disponível como `demo_ativo + bonus_balance + purchased_balance`, onde `demo_ativo = (demo_expires_at > now()) ? demo_balance : 0`. **`demo_expires_at IS NULL` NUNCA conta como ativo.** `credit_balances.balance` (bruto) **não** é o saldo disponível. O saldo disponível SHALL ser a base do gate de cobrança e da rejeição `saldo_insuficiente`. **Invariante (CHECK):** `demo_balance > 0` implica `demo_expires_at`, `demo_cycle_id` e `origin_demo_grant_tx_id` não nulos.

#### Scenario: Demo vencido é excluído do disponível

- **WHEN** `demo_expires_at <= now()` e `demo_balance = 10`, `bonus_balance = 0`
- **THEN** o saldo disponível é `0`

#### Scenario: Demo ativo conta no disponível

- **WHEN** `demo_expires_at > now()` e `demo_balance = 10`
- **THEN** o saldo disponível inclui `10`

#### Scenario: demo_expires_at NULL não conta como ativo

- **WHEN** `demo_expires_at IS NULL` e `demo_balance = 10` (estado inconsistente)
- **THEN** o saldo disponível **não** inclui o demo (e o CHECK impede esse estado)

### Requirement: Materialização atômica e idempotente da expiração

O sistema SHALL prover a RPC `public.materialize_demo_expiration(p_store_id UUID) RETURNS JSONB` que, quando `demo_balance > 0 AND demo_expires_at <= now()`, escreve uma transação `expiration` (amount = `-demo_balance`, `reference = demo_cycle_id`, `metadata = { cycle_id, origin_demo_grant_tx_id, contributing_tx_ids }`), zera `demo_balance`, `demo_expires_at`, `demo_cycle_id` e `demo_contributing_tx_ids` (**`origin_demo_grant_tx_id` NÃO é zerado**), tudo sob `SELECT ... FOR UPDATE` na linha de `credit_balances`. Se já materializado (`demo_balance = 0`), é no-op. **Cada episódio produz no máximo uma transação `expiration`.** A transação `expiration` é a **evidência durável** do encerramento, produzida por `reserve_credit`/reconciliador (a **leitura NÃO materializa**).

#### Scenario: Expiração pendente é materializada uma única vez

- **WHEN** `demo_balance = 10` e `demo_expires_at <= now()`
- **THEN** a primeira chamada escreve `expiration` (`amount = -10`) e zera `demo_balance`
- **AND** uma segunda chamada é no-op (não cria nova transação)

#### Scenario: Demo ativo não é materializado

- **WHEN** `demo_expires_at > now()`
- **THEN** `materialize_demo_expiration` não escreve transação e mantém `demo_balance`

#### Scenario: Concorrência segura

- **WHEN** duas chamadas concorrentes para a mesma loja
- **THEN** o `FOR UPDATE` serializa e apenas uma transação `expiration` é criada

### Requirement: Evidência durável deriva telemetria e notificação de encerramento

O sistema SHALL derivar `demo_expired` (telemetria) e a notificação de encerramento **da transação `expiration`** (dedup key = `expiration_tx_id`), independentemente de qual caller materializou (`reserve_credit` ou reconciliador). O reconciliador SHALL reparar outbox/eventos ausentes varrendo transações `expiration` sem notificação/evento correspondente.

#### Scenario: Materialização por reserve não suprime o encerramento

- **WHEN** `reserve_credit` materializa a expiração antes do cron
- **THEN** o evento `demo_expired` e a notificação ainda são produzidos (derivados da `expiration`, com reparo pelo reconciliador)

### Requirement: Esgotamento nasce na transição demo_balance > 0 → 0

O sistema SHALL registrar na deduction (quando `demo_before > 0` e `demo_after = 0`, com demo ativa) a evidência de esgotamento. A notificação/evento `demo_exhausted` são derivados dessa deduction (dedup key = `deduction_tx_id`), não do cron.

#### Scenario: Reserva que zera a demo marca esgotamento

- **WHEN** `reserve_credit` consome o último crédito da demo ativa (`demo_before > 0`, `demo_after = 0`)
- **THEN** a deduction registra evidência de esgotamento
- **AND** `demo_exhausted` é derivado dessa deduction

### Requirement: reserve_credit exclui saldo vencido e materializa antes de consumir

O sistema SHALL fazer `reserve_credit` materializar a expiração pendente (mesma transação, antes do `SELECT ... FOR UPDATE`) e consumir na ordem **demonstração ativa → bônus → comprado**, registrando `demo_amount`, `bonus_amount`, `purchased_amount` e o snapshot `demo_expires_at` na metadata da deduction.

#### Scenario: reserve nunca consome demo vencido

- **WHEN** `reserve_credit(store, 5)` é chamado com demo vencido (`demo_expires_at <= now()`)
- **THEN** a expiração é materializada e o consumo considera demo = 0
- **AND** se o saldo restante for insuficiente, `reserve_credit` retorna `NULL` após confirmar a expiração; o `CreditService` traduz o retorno para `saldo_insuficiente`

#### Scenario: Consumo na ordem demo → bônus → comprado

- **WHEN** `demo_balance = 3`, `bonus_balance = 5`, `purchased_balance = 10` e `reserve_credit(store, 8)`
- **THEN** consome 3 do demo, 5 do bônus
- **AND** metadata registra `demo_amount: 3, bonus_amount: 5, purchased_amount: 0`

### Requirement: Estorno na borda do prazo (regra temporal)

O sistema SHALL, em `refund_credit`, restaurar `demo_amount` ao `demo_balance` por **regra temporal** (baseada em `demo_expires_at`, não em "materialização"):

1. **Episódio original ainda válido** (`demo_expires_at > now()` e `demo_cycle_id = origin_demo_grant_tx_id`) → restaura **sem estender**.
2. **Episódio de graça ainda ativo** (`demo_expires_at > now()` e `demo_cycle_id != origin_demo_grant_tx_id`) → restaura e `demo_expires_at = GREATEST(demo_expires_at, now()+24h)`.
3. **Nenhum episódio ativo** (`demo_expires_at <= now()` **ou** `demo_expires_at IS NULL`) → **materializa saldo vencido remanescente (se houver)** e **abre novo episódio de graça** (`demo_cycle_id` novo, `demo_expires_at = now()+24h`), preservando `origin_demo_grant_tx_id`.

A deduction SHALL registrar `demo_cycle_id`/`origin_demo_grant_tx_id` para reconstrução. **No máximo uma `expiration` por episódio** (zero quando o episódio termina já esgotado); múltiplos refunds rastreáveis até o grant original.

#### Scenario: Episódio original válido restaura sem estender

- **WHEN** `refund_credit` de uma deduction de demo com o episódio original ainda válido
- **THEN** restaura `demo_amount` sem alterar `demo_expires_at`

#### Scenario: Episódio de graça ativo restaura e estende

- **WHEN** `refund_credit` com um episódio de graça ativo
- **THEN** restaura `demo_amount` e `demo_expires_at = GREATEST(demo_expires_at, now()+24h)`

#### Scenario: Demo esgotada cujo prazo passou → refund abre graça de 24h (sem expiration prévia)

- **WHEN** a demo foi totalmente consumida (`demo_balance=0`) e o **prazo passou** (`demo_expires_at <= now()`), **sem** `expiration`, e um refund de demo ocorre depois do vencimento
- **THEN** abre novo episódio de graça (`demo_cycle_id` novo, `demo_expires_at = now()+24h`)
- **AND** `origin_demo_grant_tx_id` permanece o grant original

#### Scenario: Demo esgotada ainda dentro do prazo restaura no episódio original (sem graça)

- **WHEN** a demo foi totalmente consumida (`demo_balance=0`) mas **ainda dentro dos 7 dias** (`demo_expires_at > now()`), e um refund de demo ocorre
- **THEN** restaura no **episódio original** (sem estender, sem abrir graça antecipada)

#### Scenario: Saldo vencido não materializado é materializado antes da graça

- **WHEN** o refund ocorre com `demo_balance > 0 AND demo_expires_at <= now()` (saldo vencido ainda não materializado)
- **THEN** a expiração é materializada atomicamente **antes** de abrir a graça

#### Scenario: No máximo uma expiration por episódio, rastreável ao grant

- **WHEN** um episódio de graça expira
- **THEN** gera **no máximo** uma transação `expiration` para aquele episódio (um episódio esgotado pode vencer sem saldo e sem `expiration`)
- **AND** a cadeia (`origin_demo_grant_tx_id` + `demo_contributing_tx_ids`) rastreia até o grant original

#### Scenario: Reserva válida antes do vencimento conclui normalmente

- **WHEN** uma reserva foi feita com demo ativo antes do vencimento
- **THEN** a geração pode concluir normalmente, sem cancelamento retroativo
