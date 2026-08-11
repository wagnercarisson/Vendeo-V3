## ADDED Requirements

### Requirement: Snapshot econômico por evento em generation_events

O sistema SHALL persistir, em cada evento de `generation_events` gravado por chamada de IA (call-level), o snapshot dos parâmetros econômicos vigentes **no momento da geração/entrega**, em duas colunas de valor novas **mais duas colunas de origem**:

```sql
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS usd_brl_rate_at_generation           NUMERIC;
  ADD COLUMN IF NOT EXISTS credit_value_brl_at_generation       NUMERIC;
  ADD COLUMN IF NOT EXISTS usd_brl_rate_source_at_generation    TEXT;
  ADD COLUMN IF NOT EXISTS credit_value_brl_source_at_generation TEXT;
```

- **`usd_brl_rate_at_generation`** = snapshot **contábil** do câmbio conhecido na geração (valor de `economic_parameters.usd_brl_rate` lido no momento em que o run começou). É estrutural e continua válido em fases futuras; usado para converter `custoUsdTotal` → `custoBrl`.
- **`credit_value_brl_at_generation`** = snapshot **estimativo/fallback** do valor configurado do crédito na geração (valor de `economic_parameters.credit_value_brl` lido no momento da geração). Usado **somente** para `receitaEstimadaBrl`, `resultadoEstimadoBrl` e `margemEstimadaPct`. **NUNCA** tratado/nomeado como receita real.
- **`usd_brl_rate_source_at_generation`** / **`credit_value_brl_source_at_generation`** = **origem explícita** do valor persistido na coluna de valor correspondente. Valores possíveis:
  - `"captured_at_generation"` — capturado no momento real da geração (via tracker)
  - `"backfilled_from_audit"` — reconstruído depois via `economic_parameter_audit` (valor vigente na data do evento, aproximado)
  - `"backfilled_seed"` — reconstruído depois com a seed `1.00` (sem audit anterior ao evento)
  - `"economic_parameter_fallback"` — sem valor persistido; derivado em leitura com o parâmetro corrente
- A coluna de origem é **obrigatória e não-nula sempre que a coluna de valor for preenchida**: todo valor snapshotado/backfilled tem origem marcada — nada é chamado de "snapshot" sem procedência.
- O snapshot **capturado na geração** é gravado **daqui para frente** (eventos anteriores à migration ficam NULL e são tratados por backfill ou fallback legacy — ver `Requirement: Fallback legacy para eventos sem snapshot` e `Requirement: Backfill aproximado na migration`).
- Os valores snapshotados são **imutáveis por construção**: alterar `economic_parameters` depois não altera os snapshots já gravados.

#### Scenario: evento grava snapshot das duas taxas com origem no momento da geração

- **WHEN** `AiCostTracker.record` grava um evento call-level enquanto `economic_parameters` contém `usd_brl_rate = 5.20` e `credit_value_brl = 2.00`
- **THEN** a linha em `generation_events` contém `usd_brl_rate_at_generation = 5.20`, `credit_value_brl_at_generation = 2.00`, `usd_brl_rate_source_at_generation = 'captured_at_generation'` e `credit_value_brl_source_at_generation = 'captured_at_generation'`

#### Scenario: alterar parâmetro depois não muda snapshot existente

- **WHEN** um evento já gravado tem `usd_brl_rate_at_generation = 5.20` e, depois, o admin altera `usd_brl_rate` para `6.00`
- **THEN** a linha do evento permanece com `5.20` (snapshot imutável) e a origem `captured_at_generation` inalterada

#### Scenario: valor de snapshot nunca sem origem

- **WHEN** `usd_brl_rate_at_generation` é não-nulo
- **THEN** `usd_brl_rate_source_at_generation` é não-nulo e um dos valores permitidos (`captured_at_generation`/`backfilled_from_audit`/`backfilled_seed`)

#### Scenario: evento sem cost (delivery marker) não exige snapshot

- **WHEN** `AiCostTracker.record` grava um delivery marker (sem `cost` e sem tokens — anti-dupla-contagem D1/D6)
- **THEN** o evento pode ter os snapshots NULL (não há custo USD a converter nem crédito a derivar no marker)

### Requirement: Persistência do snapshot pelo tracker (AiCostTracker.record)

O sistema SHALL fazer `AiCostTracker.record` persistir `usd_brl_rate_at_generation`, `credit_value_brl_at_generation` **e as origens `captured_at_generation`** a partir do snapshot recebido no momento da gravação:

- O `AiCostEvent` (ou o argumento de `record`) SHALL carregar os valores de snapshot (`usdBrlRateAtGeneration`, `creditValueBrlAtGeneration`) **resolvidos no ponto de chamada** — o serviço/rota que inicia o run resolve os parâmetros uma vez no início e propaga o snapshot às chamadas filhas (padrão telemetria D7/D12).
- Quando o snapshot é gravado pelo tracker (valor presente), a origem persistida SHALL ser `"captured_at_generation"` — o tracker **nunca** grava como `backfilled_*` nem como `economic_parameter_fallback`.
- O snapshot é **best-effort** como todo o `record`: se a resolução dos parâmetros falhar no ponto de chamada, o evento é gravado com snapshots NULL (fallback legacy em leitura), e a geração **não** é bloqueada.
- **Daqui para frente**: nenhum reclassificação/backfill de histórico no `record` — eventos anteriores continuam NULL até o backfill da migration.

#### Scenario: record grava snapshots propagados do início do run

- **WHEN** o run inicia com `usd_brl_rate = 5.20` e `credit_value_brl = 2.00` e as chamadas filhas gravam eventos com o snapshot propagado
- **THEN** todas as linhas do run carregam `usd_brl_rate_at_generation = 5.20`, `credit_value_brl_at_generation = 2.00`, `usd_brl_rate_source_at_generation = 'captured_at_generation'` e `credit_value_brl_source_at_generation = 'captured_at_generation'`

#### Scenario: falha na resolução do snapshot não bloqueia geração

- **WHEN** a leitura de `economic_parameters` falha no início do run
- **THEN** os eventos são gravados com snapshots NULL (ou o run segue sem snapshot) e a geração não é bloqueada

#### Scenario: eventos antigos continuam NULL até o backfill

- **WHEN** um evento foi gravado antes da migration de snapshot
- **THEN** `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` e as colunas de origem permanecem NULL (sem reclassificação pelo tracker)
- **AND** o valor/origem só serão preenchidos pelo backfill da migration (origem `backfilled_*`), nunca pelo tracker

### Requirement: Contrato de nomenclatura estimada (receitaEstimadaBrl / resultadoEstimadoBrl / margemEstimadaPct)

O sistema SHALL usar, para todos os derivados de valor de crédito, a nomenclatura estimada — **nunca** "receita real":

| Campo (service/API/UI) | Fórmula | Semântica |
|------------------------|---------|-----------|
| `receitaEstimadaBrl` | `creditosLiquidos × credit_value_brl_at_generation` (fallback: `× credit_value_brl` corrente) | Receita **estimada** do valor operacional do crédito |
| `resultadoEstimadoBrl` | `receitaEstimadaBrl − custoBrl` | Resultado **estimado** |
| `margemEstimadaPct` | `receitaEstimadaBrl > 0 ? (resultadoEstimadoBrl / receitaEstimadaBrl) × 100 : null` | Margem **estimada** % |
| `creditValueSource` | `"captured_at_generation"` / `"backfilled_from_audit"` / `"backfilled_seed"` / `"economic_parameter_fallback"` | Origem do valor do crédito usado (procedência do valor persistido ou fallback) |
| `revenueEstimationNote` | `"estimated_from_admin_credit_value"` | Nota de estimativa (quando o valor é fallback/estimado) |

- **Nomes proibidos nesta fase:** `receitaRealBrl`, `resultadoRealBrl`, `margemRealPct` (ou equivalentes que afirmem receita real).
- `custoBrl` permanece como **custo convertido** (`custoUsdTotal × usd_brl_rate_at_generation`), sem prefixo "estimado" obrigatório — mas a UI o apresenta com badge de confiança de custo (D5) e legend "estimativas operacionais".
- **`creditValueSource`** expõe a origem real do valor usado: quando o valor veio do snapshot capturado na geração → `captured_at_generation`; do backfill via audit → `backfilled_from_audit`; do backfill via seed → `backfilled_seed`; de parâmetro corrente em leitura (evento sem valor persistido) → `economic_parameter_fallback`.
- Quando o valor usado for `backfilled_from_audit`/`backfilled_seed`, o `revenueEstimationNote` pode carregar uma nota adicional de reconstrução (ex.: `"backfilled_historical_approximation"`) para deixar claro que o valor não foi capturado no momento real.
- Quando `credit_value_brl_at_generation` for NULL (evento legacy ou snapshot ausente) e o fallback corrente for usado, `creditValueSource = "economic_parameter_fallback"` e `revenueEstimationNote = "estimated_from_admin_credit_value"` SHALL ser expostos no contrato.
- Estornos permanecem descontados: `creditosLiquidos` (bruto − estorno, floor 0 — RPC 38-2-12) é sempre a base da receita estimada.

#### Scenario: campos renomeados para estimados na API

- **WHEN** a API de operation runs retorna derivados de crédito
- **THEN** expõe `receitaEstimadaBrl`, `resultadoEstimadoBrl`, `margemEstimadaPct` (e NÃO `receitaOpBrl`/`resultadoOpBrl` como receita)
- **AND** quando usa fallback de `credit_value_brl` corrente, expõe `creditValueSource = "economic_parameter_fallback"` e `revenueEstimationNote = "estimated_from_admin_credit_value"`

#### Scenario: receita estimada usa créditos líquidos

- **WHEN** um run tem `creditosLiquidos = 7` (10 debitados − 3 estornados) e `credit_value_brl_at_generation = 2.00`
- **THEN** `receitaEstimadaBrl = 14.00` (estorno já descontado)

#### Scenario: margem null quando receita estimada é zero

- **WHEN** `receitaEstimadaBrl = 0` (run falho 100% estornado)
- **THEN** `margemEstimadaPct = null` (e `resultadoEstimadoBrl = 0 − custoBrl` — custo de IA permanece)

#### Scenario: source reflete origem backfilled

- **WHEN** um run tem `credit_value_brl_at_generation` preenchido pelo backfill via audit
- **THEN** `creditValueSource = "backfilled_from_audit"` (não `captured_at_generation` — o valor foi reconstruído, não capturado)

### Requirement: Fallback legacy para eventos sem snapshot

O sistema SHALL tratar eventos antigos (sem `usd_brl_rate_at_generation`/`credit_value_brl_at_generation`) de forma **explícita e marcada**, NUNCA silenciosa, seguindo uma cadeia de prioridade:

1. **Snapshot capturado (`captured_at_generation`)** — evento gravado após a migration com valor capturado no momento real da geração. Fonte da verdade primária.
2. **Backfill aproximado (`backfilled_from_audit` / `backfilled_seed`)** — evento anterior à migration preenchido pela migration com valor reconstruído (via `economic_parameter_audit` ou seed `1.00`). Valor **não** foi capturado no momento real — origem marcada.
3. **Fallback em leitura (`economic_parameter_fallback`)** — evento ainda sem valor persistido após o backfill (ex.: falha de escrita, linha nova sem backfill). O service usa o parâmetro corrente **apenas como fallback**, sinalizando `creditValueSource = "economic_parameter_fallback"` / `revenueEstimationNote = "estimated_from_admin_credit_value"` (e equivalente para a taxa USD, ex.: `usdBrlRateSource = "economic_parameter_fallback"`).

- **A contradição "NULL vs backfill" é resolvida assim:** eventos anteriores à migration **são backfilled** pela migration (origem `backfilled_*`); eventos que permanecem NULL após o backfill (falha de escrita, linha criada depois do backfill) são tratados pelo fallback em leitura (`economic_parameter_fallback`). O termo "sem snapshot" refere-se ao **estado persistido** da coluna de valor — backfilled ≠ NULL.
- O backfill é **aproximado por construção** (o valor efetivamente usado na geração nunca foi gravado antes desta fase); documentar essa limitação no design.
- A origem (`usd_brl_rate_source_at_generation`/`credit_value_brl_source_at_generation`) é o mecanismo que garante que valores backfilled **nunca** sejam exibidos como `captured_at_generation`.

#### Scenario: run sem valor persistido usa fallback corrente com origem explícita

- **WHEN** um run legado (sem valor persistido após o backfill) é consultado e `credit_value_brl` corrente é `2.00`
- **THEN** `receitaEstimadaBrl` é derivada com `2.00` E `creditValueSource = "economic_parameter_fallback"` e `revenueEstimationNote = "estimated_from_admin_credit_value"` são expostos

#### Scenario: backfill reconstitui snapshot via audit com origem marcada

- **WHEN** a migration roda e um evento tem `created_at` posterior à alteração de `usd_brl_rate` para `5.20` registrada no audit
- **THEN** o evento recebe `usd_brl_rate_at_generation = 5.20` E `usd_brl_rate_source_at_generation = 'backfilled_from_audit'` (janela do audit; sem audit anterior → `backfilled_seed` com valor `1.00`)

#### Scenario: valor backfilled nunca se apresenta como capturado

- **WHEN** um evento tem `usd_brl_rate_source_at_generation = 'backfilled_from_audit'`
- **THEN** o service/API/UI tratam e exibem o valor como reconstruído (origem backfilled), nunca como `captured_at_generation`

### Requirement: RPCs de operation runs expõem os snapshots por run

O sistema SHALL fazer os RPCs `admin_get_ai_operation_runs` e `admin_get_ai_operation_run_events` exporem, por run, os campos de snapshot **e suas origens** (`usd_brl_rate_at_generation`, `credit_value_brl_at_generation`, `usd_brl_rate_source_at_generation`, `credit_value_brl_source_at_generation`) — campos **adicionados** ao contrato JSON (backward-compatible, sem remover nada):

- O RPC NÃO deriva BRL — continua devolvendo dados brutos (USD + créditos + snapshots + origens); a derivação é no service layer (D1).
- Para runs com múltiplos eventos de snapshots diferentes (caso raro — parâmetro alterado no meio do run), o RPC expõe os snapshots e origens por evento e o service decide o valor do run (ex.: primeiro evento do run com snapshot).
- **Origens sempre acompanham os valores**: cada `*_at_generation` exposto tem seu `*_source_at_generation` correspondente (nunca valor sem procedência).

#### Scenario: RPC lista expõe snapshots e origens por run

- **WHEN** `admin_get_ai_operation_runs` é chamado e um run tem eventos com snapshots
- **THEN** o run retornado inclui `usd_brl_rate_at_generation`, `credit_value_brl_at_generation` e as origens `usd_brl_rate_source_at_generation`/`credit_value_brl_source_at_generation` (do evento de referência do run)

#### Scenario: RPC detalhe expõe snapshots e origens por evento

- **WHEN** `admin_get_ai_operation_run_events` é chamado
- **THEN** cada evento call-level inclui `usd_brl_rate_at_generation`, `credit_value_brl_at_generation` e as origens correspondentes

### Requirement: Backfill aproximado na migration (economic snapshot)

O sistema SHALL incluir, na migration de snapshot, um backfill **aproximado** dos snapshots para linhas existentes de `generation_events`, preenchendo **valor E origem**:

- Fonte de reconstrução: `economic_parameter_audit` (append-only, `created_at` + `old_value`/`new_value`) — para cada evento, o valor vigente é o `new_value` da alteração mais recente com `created_at <= generation_events.created_at` para a chave; sem alteração anterior → valor da seed (`1.00`).
- **Origem preenchida pelo backfill:** quando o valor vem de uma janela do audit → `backfilled_from_audit`; quando vem da seed → `backfilled_seed`. O backfill **nunca** grava `captured_at_generation`.
- Implementação preferencial: CTE com `ROW_NUMBER()`/`LATERAL` (LAG por chave) — sem `FOR` loop em plpgsql, preservando determinismo e performance em volumes razoáveis.
- O backfill SHALL ser idempotente (rodar 2× não muda nada) e NÃO tocar linhas que já tenham valor (garante re-aplicação segura; `WHERE usd_brl_rate_at_generation IS NULL`).
- Limitação documentada: é reconstrução **aproximada** — o valor real da geração não foi persistido antes desta fase; a origem `backfilled_*` comunica exatamente isso.

#### Scenario: backfill preenche apenas linhas sem valor, com origem marcada

- **WHEN** a migration roda em banco com linhas antigas (NULL) e linhas já snapshotadas
- **THEN** apenas as linhas NULL recebem o valor reconstituído E a origem `backfilled_from_audit` ou `backfilled_seed`
- **AND** rodar de novo não altera as linhas preenchidas (idempotente)

#### Scenario: backfill usa janela do audit e seed como fallback

- **WHEN** um evento tem `created_at` após a 1ª alteração da chave e outro antes
- **THEN** o primeiro recebe o `new_value` da alteração com origem `backfilled_from_audit` e o segundo recebe `1.00` (seed) com origem `backfilled_seed`
