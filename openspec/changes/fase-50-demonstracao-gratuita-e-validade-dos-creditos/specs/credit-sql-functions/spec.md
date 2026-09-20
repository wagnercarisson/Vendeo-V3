# Credit SQL Functions

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D3/D4/D6). `reserve_credit`/`refund_credit` com bucket demo e graça de 24h; `grant_credits` com `p_type='demo'`; nova `materialize_demo_expiration`.

## MODIFIED Requirements

### Requirement: grant_credits SQL function (MODIFIED F29.3)

O sistema SHALL estender `grant_credits` para aceitar `p_type = 'demo'`. Quando `demo`, a concessão SHALL, **explicitamente**:

1. inserir transação `type='demo'`;
2. usar o **ID dessa transação** em `demo_cycle_id`;
3. usar o **mesmo ID** em `origin_demo_grant_tx_id`;
4. iniciar `demo_contributing_tx_ids = ARRAY[grant_tx_id]`;
5. definir `demo_expires_at` e incrementar `demo_balance`.

> **Delta F50 (D3):** `p_type='demo'` direciona ao `demo_balance` e **inicializa todos os campos do CHECK** (`demo_expires_at`, `demo_cycle_id`, `origin_demo_grant_tx_id`). A RPC `grant_demo_credits` orquestra entitlement + expiração + auditoria.

#### Scenario: grant_credits demo inicializa todos os campos

- **WHEN** `grant_credits(store, 10, 'demo', ..., p_type='demo', expires_at)` é chamado
- **THEN** insere transação `type='demo'` com id `G`, incrementa `demo_balance` em 10
- **AND** define `demo_expires_at`, `demo_cycle_id = G`, `origin_demo_grant_tx_id = G` e `demo_contributing_tx_ids = ARRAY[G]`
- **AND** `bonus_balance`/`purchased_balance` não mudam

### Requirement: reserve_credit SQL function (MODIFIED F29.3)

O sistema SHALL reescrever `reserve_credit` para: materializar expiração pendente antes do lock, e consumir na ordem **demonstração ativa → bônus → comprado**, registrando `demo_amount`, `bonus_amount`, `purchased_amount`, o snapshot `demo_expires_at`, `demo_cycle_id`/`origin_demo_grant_tx_id` e a evidência de esgotamento (`demo_before`/`demo_after`) na metadata. A checagem de saldo usa o **saldo disponível** (excluindo demo vencido).

#### Scenario: Consumo demo → bônus → comprado

- **WHEN** `demo_balance=3`, `bonus_balance=5`, `purchased_balance=10` e `reserve_credit(store, 8)`
- **THEN** consome 3 demo + 5 bônus
- **AND** metadata registra `demo_amount:3, bonus_amount:5, purchased_amount:0`

#### Scenario: Demo vencido não é consumível

- **WHEN** `demo_expires_at <= now()` e `reserve_credit(store, 5)`
- **THEN** a expiração é materializada e o demo não conta
- **AND** `saldo_insuficiente` se o restante for insuficiente

#### Scenario: Esgotamento registrado quando a demo zera

- **WHEN** a reserva consome o último crédito da demo ativa (`demo_before > 0`, `demo_after = 0`)
- **THEN** a deduction registra evidência de esgotamento (para derivar `demo_exhausted`)

### Requirement: refund_credit SQL function (MODIFIED F29.3)

O sistema SHALL reescrever `refund_credit` para restaurar `demo_amount` por **regra temporal**: **episódio original válido → restaura sem estender**; **episódio de graça ativo → restaura + `GREATEST(demo_expires_at, now()+24h)`**; **nenhum episódio ativo (`demo_expires_at <= now()` ou `NULL`) → materializa saldo vencido remanescente (se houver) e abre novo episódio de graça** (`demo_cycle_id` novo + `demo_expires_at = now()+24h`), preservando `origin_demo_grant_tx_id` (que **não é zerado pela expiração**). O gatilho da graça é **somente o tempo vencido**. **No máximo uma `expiration` por episódio** (um episódio esgotado pode vencer sem saldo e, portanto, sem `expiration`).

#### Scenario: Episódio original válido restaura sem estender

- **WHEN** `refund_credit` de deduction de demo com o episódio original ainda válido
- **THEN** restaura `demo_amount` sem alterar `demo_expires_at`

#### Scenario: Episódio de graça ativo restaura e estende

- **WHEN** `refund_credit` com um episódio de graça ativo
- **THEN** restaura `demo_amount` e `demo_expires_at = GREATEST(demo_expires_at, now()+24h)`

#### Scenario: Demo esgotada cujo prazo passou → refund abre graça de 24h

- **WHEN** a demo foi esgotada (`demo_balance=0`) e o **prazo passou** (`demo_expires_at <= now()`, sem `expiration`), com o refund depois do vencimento
- **THEN** abre novo episódio de graça (`demo_cycle_id` novo, `demo_expires_at = now()+24h`), preservando `origin_demo_grant_tx_id`

#### Scenario: Demo esgotada ainda dentro do prazo restaura no episódio original

- **WHEN** a demo foi esgotada (`demo_balance=0`) mas **ainda dentro dos 7 dias** (`demo_expires_at > now()`)
- **THEN** restaura no **episódio original** (sem estender, sem graça antecipada)

#### Scenario: Saldo vencido não materializado é materializado antes da graça

- **WHEN** o refund ocorre com `demo_balance > 0 AND demo_expires_at <= now()`
- **THEN** materializa a expiração atomicamente **antes** de abrir a graça

#### Scenario: Refund restaura buckets bônus/comprado como antes

- **WHEN** `refund_credit` de deduction com `bonus_amount`/`purchased_amount`
- **THEN** restaura bônus/comprado sem prazo (comportamento preservado)

## ADDED Requirements

### Requirement: materialize_demo_expiration SQL function

O sistema SHALL criar `public.materialize_demo_expiration(p_store_id UUID) RETURNS JSONB` (SECURITY DEFINER, `search_path=''`, service_role) que materializa a expiração pendente de forma atômica e idempotente e retorna o saldo disponível.

#### Scenario: Materializa e retorna disponível

- **WHEN** `demo_balance>0` e `demo_expires_at<=now()`
- **THEN** escreve `expiration`, zera `demo_balance`/`demo_expires_at`, e retorna `available` correto

#### Scenario: No-op quando já materializado

- **WHEN** `demo_balance=0`
- **THEN** não escreve transação e retorna `available` sem efeito

### Requirement: Leitura de saldo disponível por RLS (não service_role)

O sistema SHALL prover leitura **pura** do saldo disponível para páginas autenticadas, **sem** chamar RPC exclusiva de service_role: a leitura deriva `available` de `demo_expires_at` (sem mutar), via RLS sobre `credit_balances` ou RPC `SECURITY DEFINER` acessível a `authenticated` com validação de `auth.uid()` e propriedade da loja. A materialização contábil permanece responsabilidade de `reserve_credit`/reconciliador.

#### Scenario: authenticated lê o próprio saldo disponível

- **WHEN** o owner autenticado lê o saldo da própria loja
- **THEN** recebe o saldo disponível derivado (demo ativo + bônus + comprado)

#### Scenario: acesso cruzado negado

- **WHEN** um usuário tenta ler o saldo de outra loja
- **THEN** o acesso é negado (RLS)

#### Scenario: leitura não materializa

- **WHEN** a leitura ocorre com demo vencido
- **THEN** o demo vencido é excluído do `available` **sem** escrever transação de expiração (materialização é do reserve/reconciliador)
