# 59-10 — Incidente de geração (2026-11-05 22:39–22:40 UTC)

## Sintoma

Duas submissões verticais terminaram com a mensagem pública de geração não
concluída e crédito estornado. Nenhuma arte foi entregue.

## Campanhas e operações

| Campanha | Operação | Composer / formato | Status | Crédito |
|---|---|---|---|---|
| `4d4e7d94-dd39-472c-b38d-a9af144be9dc` | `b1e8ed02-ecef-48a9-8d06-5697293091f1` | `f59-vertical-9-16-composer-v6` / `f59-9-16-v4` | error / refunded | 1 estornado |
| `93da742a-8fd7-4dfd-905c-c41aeefebc2e` | `81b6519b-6e82-414e-9263-5169e529d1fd` | `f59-vertical-9-16-composer-v6` / `f59-9-16-v4` | error / refunded | 1 estornado |

A evidência congelada foi gravada nas duas campanhas, com o compositor v6. O
prompt foi composto corretamente antes da falha.

## Causa raiz

O **gate de gasto do piloto** bloqueou a chamada de imagem antes do provider:

- `product_1_1_pilot_spend_state.cap_usd = 0.8454`;
- `spent_usd = 0.8258`;
- margem restante = **0.0196**;
- estimativa da chamada de imagem = **0.11** (registrada na geração bem-sucedida
  anterior, `0166cbb9…`).

A chamada de imagem não chegou ao provider:

- não há linha `image_primary` em `product_1_1_pilot_paid_calls` para as duas
  campanhas — apenas `copy_initial`;
- não há evento de imagem em `generation_events`;
- as tentativas foram marcadas `failed` e o crédito foi estornado.

Não é regressão do prompt, do seletor ou do compositor. A última geração
bem-sucedida (21:57 UTC) consumiu a margem restante do teto do piloto.

## Correção aplicada

Teto elevado via RPC oficial `product_1_1_pilot_set_cap`:

- operação: `648ef874-aefd-46ee-a736-f06555c6fe73`;
- ator: `1273d07b-c2d1-48c9-88ca-9acfe6c0ac14`;
- novo `cap_usd`: **1.10**;
- motivo: “teste manual F59 prompt v6 - margem para 1 geracao de imagem
  (estimativa 0.11)”;
- `spent_usd` permaneceu `0.8258`; margem resultante: **0.2742**.

Nenhuma migration, flag, push ou deploy foi alterado. Nenhuma geração paga foi
executada nesta correção.

## Evidências preservadas

- campanhas, operações, tentativas, evidência congelada e estornos acima;
- artes das gerações anteriores (`01a66557…` e `0166cbb9…`) intactas;
- auditoria do novo teto em `product_1_1_pilot_cap_audit`.

## Resolução

Após a elevação do teto, a execução de 22:46 UTC concluiu com sucesso:

- campanha `bc10ce42-d330-4332-a7e9-9045bd80b72b`;
- operação `1b31c766-a1f6-4e2b-9fdf-ebdb33b8f15e`;
- composer `f59-vertical-9-16-composer-v6` / formato `f59-9-16-v4`;
- arte 1080 × 1920 entregue.

O prompt efetivamente composto está reconstruído e registrado em
`59-10-PROMPT-EFFECTIVE-V6.md`.

## Observação

O teto do piloto é um guarda de gasto operacional, não um feature flag. Para o
teste único, a margem agora cobre a estimativa da imagem. Após o teste, o teto
pode ser revisto pelo responsável.
