# 59-10 — Plano mínimo dos gates restantes no homolog (revisado)

Status: **proposta para aprovação única; nada executado**. Escopo: homolog atual
(`127.0.0.1:57782`, app `127.0.0.1:3000`), somente lojas/registros de teste.
Nenhuma suíte antiga será executada. Prompt, fluxo, modelos e runtime permanecem
inalterados.

## 1. Conclusão da investigação

Todos os gates restantes podem ser executados no homolog atual. **Não é necessário
outro ambiente.**

| Gate | Como |
|---|---|
| Recuperação vertical até detalhe/lista | campanha/operação sintética + arte real + `image-recovery` |
| Resolução administrativa vertical | campanha/operação sintética + arte real + rota admin |
| `unknown` → `refunded` | operação sintética sem arte + resolução administrativa explícita `refund_once` |
| Reenvio | somente leitura sobre campanha já entregue |
| Concorrência de rota / idempotência | duas submissões simultâneas; envelope pago declarado abaixo |
| Geração em andamento + flag OFF | combinar com a corrida; desligar quando a chamada de imagem aparecer |
| Concorrência SQL | duas conexões Postgres, sem provider |

## 2. Inventário completo

Loja: **Padaria da Esquina** `48b212f8-2b0f-4679-b553-122a601bacac`
(`is_test_store=true`; o dono `1273d07b…` também é admin — uma sessão serve para
loja e admin).

**Cinco** campanhas sintéticas, IDs gerados na execução:

| ID | Run | Operação | Reserva | Estado final | Fonte de arte |
|---|---|---|---|---|---|
| C-A1 | A | O-A1 | 1 crédito | `delivered` | JPEG 1080×1920 sintético |
| C-A2 | A | O-A2 | 1 crédito | `delivered` | JPEG 1080×1920 sintético |
| C-A3 | A | O-A3 | 1 crédito | `refunded` | sem arte (ausência confirmada) |
| C-B | B | O-B | 1 crédito | `delivered` (se o provider concluir) | gerada pelo provider |
| C-D | D | O-D | 1 crédito | `refunded` | sem arte; só concorrência SQL |

Todas levam `product_name` prefixado `F59 teste — ...` e
`input_snapshot.f59Test = { run, purpose, synthetic: true }`. Nenhum registro
existente é alterado.

## 3. Créditos, sequência e saldo por etapa

Concessão única: **3 créditos** via `admin_grant_credits` (auditado, motivo
“F59 gates restantes”). Execução **sequencial**.

| Etapa | Ação | Saldo após |
|---|---|---|
| 0 | concessão de 3 créditos | 3 |
| 1 | A3 reserva 1 | 2 |
| 2 | A3 `refund_once` (resolução administrativa explícita de `unknown`) | 3 |
| 3 | D reserva 1 | 2 |
| 4 | D estorna a reserva de teste | 3 |
| 5 | A1 reserva 1 e entrega | 2 |
| 6 | A2 reserva 1 e entrega | 1 |
| 7 | B reserva 1 e entrega | 0 |

Saldo final **0**, igual ao inicial. Nenhuma compra, crédito real ou ampliação
permanente.

A3 **não** é estorno automático: é resolução administrativa explícita de
`unknown`, com motivo e `resolutionOperationId`, pela rota admin auditada.

## 4. Run A — recuperação e resolução (sem provider)

| Caso | Estado inicial | Ação | Esperado |
|---|---|---|---|
| A1 | `reserved` + arte vertical real | `POST /api/campaign/[id]/image-recovery` | `delivered`, campanha `ready` com path vertical, detalhe/lista |
| A2 | `reserved` + arte vertical real | `POST /api/admin/product-1-1-pending` `deliver_existing_art` | `delivered`, projeção vertical, detalhe/lista |
| A3 | `reserved`, sem arte, outcome `unknown` | `POST` admin `refund_once` com motivo | `refunded` uma vez; novo `deliver_existing_art` recusado |

Sem provider. A arte sintética é um JPEG 1080×1920 gerado localmente; não altera o
prompt.

## 5. Run B — concorrência + em andamento (envelope pago)

### Envelope real do runtime

- O gateway **não** faz retry e **não** faz fallback automático.
- O orquestrador permite **2 tentativas `primary` + 1 `fallback`** = no máximo
  **3 invocações** de imagem.
- Cada invocação usa o SDK OpenAI sem `maxRetries` explícito; o padrão do SDK é
  **2 retries** → até **3 requisições HTTP por invocação**.
- Pior caso: **9 requisições HTTP de imagem**. A copy tem 1 invocação e o mesmo
  envelope de 3 HTTP.
- Não será alterado o runtime compartilhado, o `maxRetries`, o par de modelos nem o
  prompt para “facilitar” o teste.

### Custo máximo e teto cumulativo

- Estimativa histórica máxima: imagem **US$ 0,136** por requisição; copy
  **US$ 0,020**.
- Pior caso: `9 × 0,136 + 3 × 0,020` = **US$ 1,284**.
- Gasto atual: **2,0882**. Teto necessário para cobrir o pior caso:
  `2,0882 + 1,284` = **3,3722** → **teto de US$ 3,40**.
- **Não haverá restauração para 2,20**: se o gasto ultrapassar 2,20, um teto 2,20
  ficaria abaixo do gasto. Após o teste, o teto permanece **3,40** até decisão
  explícita; qualquer redução será para `max(2,20, gasto)` com nova autorização.
- Custo esperado: US$ 0,03–0,08. O pior caso só se realiza com retries e fallback
  completos.

### Execução

1. Duas submissões **simultâneas**, mesma identidade nova, flag ON, 1 crédito.
2. Quando `image_primary` aparecer em `product_1_1_pilot_paid_calls` (ou claim
   `in_progress`), desligar a flag pela via auditada.
3. Aguardar o terminal; religar a flag pela via auditada.
4. Evidência: uma campanha, uma dedução, um `paid_call`; vencedor entregue;
   perdedor observa a operação. A flag OFF não aborta a geração em andamento.
5. Se não for possível desligar a flag durante a execução, o cenário “em
   andamento” fica **inconclusivo**. **Não haverá repetição automática.**

## 6. Run C e Run D

**Run C (somente leitura):** `POST /api/campaign/generate-image` com a identidade
existente `72ab9ddb…` / `b703b7c5…` (9:16, `delivered`). Esperado: terminal
`result`, sem provider, crédito ou escrita.

**Run D (concorrência SQL, sem provider):** campanha/operação C-D próprias:
- duas conexões em `product_1_1_reserve_credit_operation` com a mesma identidade →
  uma reserva, sem cobrança dupla;
- duas conexões em `product_1_1_acquire_attempt_start` → um único
  `acquired=true`;
- reserva de teste estornada ao final.
É o teste completo de concorrência SQL; o Run B é o controle por execução.

## 7. Política de preservação das evidências

**Não haverá limpeza destrutiva** de `pilot_paid_calls`, `generation_events`,
`product_1_1_campaign_credit_operations`, `credit_transactions`,
`product_1_1_campaign_artifacts`, `attempt_claims`, `outcomes`, snapshots ou
`admin_audit_log`.

- Registros sintéticos ficam **identificados** por nome, `input_snapshot.f59Test`,
  loja de teste e motivos de auditoria.
- `credit_transactions` permanece append-only; o vínculo com a campanha é
  preservado.
- A “limpeza” restrita remove apenas arquivos temporários locais (scripts/imagens
  geradas fora do Storage). Nada é apagado do banco ou do Storage.
- Se a remoção posterior for desejada, será um procedimento separado, compatível
  com as regras existentes e com autorização própria.

## 8. Autorização única solicitada

1. Conceder **3 créditos** à Padaria (auditado).
2. Criar **5 campanhas/operações sintéticas** e 3 artes de teste.
3. Elevar o teto para **US$ 3,40** (auditado), sem restauração automática.
4. Executar **1 corrida paga** com envelope máximo de 9 HTTP de imagem + 3 de copy.
5. Executar Runs A, C e D.
6. Preservar todos os registros; remover apenas arquivos temporários locais.

Nenhuma ação ocorre sem essa autorização. A F59 permanece **PENDENTE**; nenhum gate
não executado é promovido.
