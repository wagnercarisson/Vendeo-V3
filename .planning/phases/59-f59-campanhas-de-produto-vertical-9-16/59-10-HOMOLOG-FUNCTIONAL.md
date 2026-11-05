# F59 / 59-10 — Execução funcional em homolog

Data: 2026-11-05. Status: **EM ANDAMENTO — teste manual acompanhado**.
Limite: **5 submissões**, uma por vez. Orçamento operacional: **US$ 2,00**
(não é hard cap técnico).

## Estado inicial

- Ambiente: homolog local `127.0.0.1:57781` / DB `127.0.0.1:57782`.
- Aplicação: `http://127.0.0.1:3000`.
- Flag `product_9_16_enabled`: **ON** temporariamente, ativada via RPC auditado.
- Lojas de teste:
  - Loja Mega Vale — `3dc7d274-0b57-45ba-883a-7b235056feda` — 1 crédito;
  - Padaria da Esquina — `48b212f8-2b0f-4679-b553-122a601bacac` — 4 créditos.
- Campanhas nas lojas de teste: **70**.
- Eventos em `generation_events`: **336**.
- Campanhas verticais: **0**.

## Registro de submissões

| # | Data/hora | Loja | Intenção/fundo | Produto | campaignId | operationId | Dimensão | Path | Crédito | Custo observado | Resultado | Evidência |
|---:|---|---|---|---|---|---|---|---|---:|---:|---|---|
| 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |  |  |  |  |

## Pontos a verificar em cada submissão

- arte JPEG 1080×1920;
- path `.../product-9-16/{operationId}/art-1080x1920.jpg`;
- 1 crédito por entrega;
- miniatura WebP 162×288;
- detalhe vertical com `object-contain`;
- listagem com miniatura;
- download JPEG com attachment;
- copy entregue e legível;
- custo em `generation_events` (`format`, `requestedSize`, `returnedSize`, `outcome`);
- nenhuma troca silenciosa para 1:1.

## Observações

- Nenhuma geração foi executada pelo executor; as submissões serão feitas
  manualmente pelo responsável.
- Parar novas chamadas ao atingir US$ 2,00 ou qualquer defeito.
- Ao encerrar, desligar a flag e registrar o estado final.
