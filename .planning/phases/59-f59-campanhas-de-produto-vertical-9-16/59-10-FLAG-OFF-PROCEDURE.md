# 59-10 — Procedimento mínimo: flag OFF no homolog atual

Status: **preparado, NÃO executado**. Nenhuma flag foi alterada, nenhum crédito foi
usado, nenhuma operação foi manipulada e nenhuma infraestrutura foi criada ou
reparada.

## 1. Escopo

Validar, no homolog atual (`vendeo-homolog`, `127.0.0.1:57782`), que
`product_9_16_enabled = OFF`:

1. bloqueia **novas** gerações 9:16 antes de reserva e provider;
2. não bloqueia acesso a campanhas existentes (detalhe, listagem, download,
   restauração) nem a leitura de copy;
3. é revertido para o estado inicial com trilha de auditoria.

Fora do escopo deste procedimento: geração em andamento, recuperação com escrita,
resolução administrativa, concorrência e qualquer geração paga. Esses itens
continuam **não aprovados**.

## 2. Pré-condições (somente leitura)

Executar antes de qualquer mudança e anexar a saída ao registro.

```sql
-- ambiente e estado inicial
SELECT key, enabled, updated_at
FROM public.feature_flags
WHERE key = 'product_9_16_enabled';

-- ausência de operação em andamento (fonte autoritativa)
SELECT count(*) AS claims_in_progress
FROM public.product_1_1_generation_attempt_claims
WHERE status = 'in_progress';

SELECT count(*) AS creditos_em_aberto
FROM public.product_1_1_campaign_credit_operations
WHERE status IN ('reserved', 'art_uploaded');

SELECT count(*) AS campanhas_nao_terminais
FROM public.campaigns
WHERE status NOT IN ('ready', 'error');

-- orçamento e saldo (não serão alterados)
SELECT balance FROM public.credit_balances
WHERE store_id = '48b212f8-2b0f-4679-b553-122a601bacac';

SELECT cap_usd, spent_usd FROM public.product_1_1_pilot_spend_state;
```

Critérios de entrada:

- `enabled = true` (estado inicial esperado);
- `claims_in_progress = 0`;
- `creditos_em_aberto = 0`;
- `campanhas_nao_terminais = 0`;
- saldo `0` e `spent_usd = 2.0882` (ou o valor lido no momento, registrado);
- nenhum gerador/worker ativo para a loja.

Se qualquer contagem de andamento for maior que zero, **parar**: o ciclo não é
seguro.

## 3. Snapshot de efeitos (antes)

Registrar contagens para comparar depois:

```sql
SELECT
  (SELECT count(*) FROM public.campaigns) AS campanhas,
  (SELECT count(*) FROM public.product_1_1_campaign_credit_operations) AS credit_ops,
  (SELECT count(*) FROM public.product_1_1_generation_attempt_claims) AS claims,
  (SELECT count(*) FROM public.product_1_1_generation_outcomes) AS outcomes,
  (SELECT count(*) FROM public.generation_events) AS generation_events,
  (SELECT count(*) FROM public.product_1_1_pilot_paid_calls) AS paid_calls,
  (SELECT count(*) FROM public.generation_rate_events) AS rate_events;
```

Anexar também `SELECT balance`, `cap_usd`, `spent_usd` e a lista das quatro
campanhas de referência (`status`, `storage_path`, `updated_at`).

## 4. Controle com a flag ON (sem efeitos)

Objetivo: provar que o mesmo corpo, com saldo zero, é rejeitado por **saldo** quando
a flag está ON — e por **flag** quando está OFF. Sem esse controle, um 402 seria
indevidamente lido como bloqueio da flag.

Com a sessão do lojista aberta em `http://127.0.0.1:3000`, executar no console do
navegador (mesma origem, cookies automáticos):

```js
const campaignId = crypto.randomUUID();
const operationId = crypto.randomUUID();
const png1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=";

const body = {
  storeId: "48b212f8-2b0f-4679-b553-122a601bacac",
  productName: "Teste bloqueio flag F59",
  campaignIntent: "offer",
  discountedPriceCents: 1990,
  backgroundDirection: "studio",
  campaignId,
  operationId,
  campaignFormat: "9:16",
  productImages: [
    { role: "primary", source: "upload", mimeType: "image/png", dataUrl: png1x1 }
  ]
};

const res = await fetch("/api/campaign/generate-image", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log(res.status, await res.text());
```

Resultado esperado com a flag ON e saldo 0: **HTTP 402** com mensagem de saldo.
Classificação correta: **rejeição por saldo; não prova a flag**. Nenhum efeito
(colunas do passo 3 inalteradas).

Se vier 429, classificar como rate limit e **não** como flag. Se vier 503 de flag com
a flag ON, abortar e investigar leitura da flag.

Guardar `campaignId`/`operationId` do controle. Eles devem permanecer **ausentes** do
banco ao final.

## 5. Desligar pela via auditada

Via painel `/admin/feature-flags` (ou `PUT /api/admin/feature-flags`) com motivo
obrigatório:

```json
{
  "key": "product_9_16_enabled",
  "enabled": false,
  "reason": "F59 - validacao manual do ciclo OFF em homolog (59-10)",
  "operationId": "<uuid-gerado-para-esta-operacao>"
}
```

Confirmar a resposta com `enabled: false` e registrar o `operationId`. A RPC
`admin_update_feature_flag` grava `admin_audit_log` na mesma transação.

Conferir:

```sql
SELECT enabled, updated_at FROM public.feature_flags
WHERE key = 'product_9_16_enabled';

SELECT actor_id, action, reason, operation_id, metadata, created_at
FROM public.admin_audit_log
WHERE action = 'feature_flag_update'
  AND metadata->>'key' = 'product_9_16_enabled'
ORDER BY created_at DESC
LIMIT 2;
```

O `metadata` deve conter `old_value: true` e `new_value: false`.

## 6. Tentativa bloqueada (com a flag OFF)

Ainda no console do navegador, repetir o mesmo corpo com **novos** `campaignId` e
`operationId`:

```js
const campaignId2 = crypto.randomUUID();
const operationId2 = crypto.randomUUID();
const body2 = { ...body, campaignId: campaignId2, operationId: operationId2 };
const res2 = await fetch("/api/campaign/generate-image", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body2),
});
console.log(res2.status, await res2.text());
```

Resultado esperado: **HTTP 503** com `error.code = "format_unavailable"` e mensagem
“Novas gerações no formato vertical estão temporariamente pausadas.”

Ponto de corte comprovado pelo código: a checagem da flag ocorre em
`generate-image/route.ts` antes da revalidação de oferta, do rate limit, do saldo, da
criação de campanha, da reserva e do provider.

Classificação obrigatória:

| Resposta | Classificação | Conclusão |
|---|---|---|
| 503 `format_unavailable` | bloqueio pela flag | **prova o gate** |
| 402 saldo | bloqueio por saldo | **não prova a flag** |
| 429 | rate limit | **não prova a flag** |
| 200 | flag não está OFF | **abortar e investigar** |

### Ausência de novos efeitos

Repetir o snapshot do passo 3 e confirmar, para `campaignId2`/`operationId2`:

```sql
SELECT count(*) FROM public.campaigns WHERE id IN ('<campaignId>', '<campaignId2>');
SELECT count(*) FROM public.product_1_1_campaign_credit_operations
  WHERE campaign_id IN ('<campaignId>', '<campaignId2>');
SELECT count(*) FROM public.product_1_1_generation_attempt_claims
  WHERE campaign_id IN ('<campaignId>', '<campaignId2>');
SELECT count(*) FROM public.product_1_1_generation_outcomes
  WHERE campaign_id IN ('<campaignId>', '<campaignId2>');
SELECT count(*) FROM public.generation_events
  WHERE campaign_id IN ('<campaignId>', '<campaignId2>');
SELECT count(*) FROM public.product_1_1_pilot_paid_calls
  WHERE campaign_id IN ('<campaignId>', '<campaignId2>');
SELECT count(*) FROM public.generation_rate_events
  WHERE campaign_id IN ('<campaignId>', '<campaignId2>');
```

Todos devem retornar **0**. O saldo, o teto e `spent_usd` devem permanecer iguais.
Nenhum evento de provider deve existir.

## 7. Campanhas existentes com a flag OFF

Executar com a flag ainda OFF e registrar cada resultado:

| Verificação | Alvo | Esperado |
|---|---|---|
| Detalhe vertical | `b367b5c0-6abe-4161-b2c7-c8dc2c9fc401` (Bolo) | página abre, imagem e copy visíveis |
| Detalhe vertical | `72ab9ddb-9e5d-4bc7-a994-c1dc0ec3bb88` (Pão de Queijo) | idem |
| Detalhe 1:1 | `14278411-c1fd-4884-9760-ee0dcf98da06` | idem, sem frame vertical |
| Listagem | `/campanhas` | as quatro aparecem com miniatura |
| Download 9:16 | `/api/campaign/72ab9ddb-9e5d-4bc7-a994-c1dc0ec3bb88/download` | 200, `image/jpeg`, attachment |
| Download 1:1 | `/api/campaign/14278411-c1fd-4884-9760-ee0dcf98da06/download` | 200, `image/jpeg`, attachment |
| Restauração vertical | `/campanhas/nova?restoreFrom=72ab9ddb-9e5d-4bc7-a994-c1dc0ec3bb88` | 9:16 preservado, aviso de pausa, sem troca para 1:1 |
| Copy existente | detalhe do Pão de Queijo | copy persistida visível; sem regeneração |

Não executar recuperação de imagem nem resolução administrativa: não há operação
pendente e criar uma seria manipulação de estado.

## 8. Restaurar o estado inicial

Religar pela mesma via auditada, com **novo** `operationId` e motivo próprio:

```json
{
  "key": "product_9_16_enabled",
  "enabled": true,
  "reason": "F59 - encerramento da validacao manual do ciclo OFF em homolog (59-10)",
  "operationId": "<novo-uuid>"
}
```

Confirmar `enabled: true` e consultar novamente `admin_audit_log`: devem existir as
duas linhas, com `old_value`/`new_value` coerentes e `reason` preenchido.

Repetir o snapshot do passo 3. Esperado: mesmas contagens de campanhas, crédito,
claims, outcomes, eventos, paid calls e rate events; saldo e teto inalterados.

## 9. Evidência a anexar

- saída das consultas dos passos 2, 3, 5, 6, 8;
- status e corpo das respostas do controle (402) e da tentativa bloqueada (503);
- capturas de detalhe, listagem, download e restauração;
- linhas de `admin_audit_log` (OFF e ON);
- declaração explícita do que ficou **não comprovado**: geração em andamento,
  recuperação/resolução, concorrência e idempotência real.

## 10. Reenvio de operação — bloco separado

Não faz parte do bloco read-only nem do ciclo de flag. Exige autorização própria.

- **Alvo exato:** campanha `72ab9ddb-9e5d-4bc7-a994-c1dc0ec3bb88`
  (Pão de Queijo), operação `b703b7c5-4dda-4038-9cba-7d471c98f278`, formato 9:16,
  store `48b212f8-2b0f-4679-b553-122a601bacac`.
- **Pré-condição:** confirmar que a operação está `delivered` e a campanha `ready`.
- **Método:** `POST /api/campaign/generate-image` com os **mesmos**
  `campaignId`/`operationId`, `campaignFormat: "9:16"` e corpo Zod-válido.
- **Esperado:** HTTP 200, NDJSON com evento terminal `result` e
  `campaignUrl: "/campanhas/72ab9ddb-9e5d-4bc7-a994-c1dc0ec3bb88"`.
- **Efeitos possíveis:** o curto-circuito lê campanha e operação e emite o estado
  persistido. Não deve haver criação de campanha, reserva, provider, upload, claim,
  outcome, evento de geração nem `paid_call`. Se qualquer contagem mudar, tratar como
  falha e investigar.
- **Desvios:** 409 indica identidade/formato divergente; 402 ou 503 indicam que a
  operação **não** foi encontrada (IDs errados ou campanha diferente) — abortar, não
  reenviar.
- **Risco residual:** um erro de identidade pode cair no caminho de nova geração; com
  saldo 0 e flag ON ele para no saldo, mas ainda assim os IDs devem ser conferidos
  antes do envio.

## 11. O que este procedimento não aprova

- Não prova geração em andamento sobrevivendo ao OFF.
- Não prova recuperação/resolução vertical até detalhe/lista.
- Não prova idempotência/concorrência de banco.
- Não substitui a integração real isolada.
- Não autoriza conclusão da F59, arquivamento, produção ou publicação.
