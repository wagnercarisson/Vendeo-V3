---
quick_id: 261124-pmo
slug: investigar-e-planejar-a-liberacao-paga-d
title: Plano revisado — liberação 1:1 pelo ledger, sem migration
status: revised-plan-pending-design-review
created: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: 4c795c17
mode: planejamento-sem-implementacao
approval:
  status: pending-design-review
  note: Candidata pelo ledger; nenhuma task executada. Provas de concorrência/recuperação pendentes.
---

# Plano revisado 261124-pmo — liberação 1:1 pelo ledger

## Objetivo

Liberar o quadrado 1:1 já armazenado de uma campanha entregue em 9:16,
cobrando exatamente 1 crédito, usando a dedução no ledger existente como
comprovante durável. Sem migration, tabela, RPC, flag ou segredo novo.

**Status:** candidata sustentada pelo código; **não aprovada** até as provas de
concorrência e recuperação.

## Decisões já incorporadas

- Opções A/B descartadas: o vínculo conjunto exige o par e os leitores
  administrativos classificariam uma linha isolada como incompleta.
- Sem `product_1_1_campaign_credit_operations`, sem
  `product_two_format_deliveries`, sem `campaign_format_additions`.
- Confirmação autenticada + CSRF + revalidação server-side; **sem token/segredo
  novo**. O custo é fixo e a chave de idempotência é derivada no servidor.
- `9:16` permanece padrão; o quadrado é selecionável por `?format=1:1` somente
  após a liberação.
- Vertical, copy, snapshot, `storage_path` e operação primária intocados.

## Decisões ainda abertas

1. **Após estorno:** uma nova liberação exige novo identificador de tentativa
   (nova chave) ou fica bloqueada? Com a chave estável, repetir não cobra de
   novo, mas também não libera.
2. **Performance em lote:** confirmar que as consultas por chave/índice são
   suficientes sem índice novo; se não, avaliar indexação em etapa separada.
3. **Rótulo do extrato:** texto “Liberação do formato 1:1” e eventual i18n.
4. **Escopo legado:** somente campanha nova `9:16` com `square_original`
   comprovado.
5. **Estorno operacional:** haverá ação de suporte para estornar a liberação?
   Se sim, o refund revoga o acesso.

## Task 1 — Contrato puro

Criar `src/lib/campaign/square-release/{types,identity,state,index}.ts`:

- `RELEASE_COST_CREDITS = 1`;
- identidade canônica:
  `storeId`, `campaignId`, `verticalOperationId`, `artifactId`,
  `artifactChecksumSha256`, `square_original`, `1:1`;
- chave `square_release:v1:<sha256(canônico)>`;
- schema de metadados da dedução:
  `kind`, `version`, `feature`, `vertical_operation_id`, `artifact_id`,
  `artifact_role`, `artifact_format`, `artifact_checksum_sha256`,
  `artifact_width`, `artifact_height`, `artifact_mime`, `cost_credits`;
- estados: `eligible | delivered | refunded | unknown | unavailable |
  incompatible`;
- validação fechada do registro lido: tipo `deduction`, valor `-1`,
  `campaign_id`, metadados de identidade coerentes e ausência de refund;
- nenhum path, URL, bytes ou PII no contrato de UI.

## Task 2 — Serviço server-side

Criar o serviço de liberação:

- **pré-voo:** campanha 9:16, vertical `delivered`, `square_original` integral
  via `retrieveCompositionArtifact`; sem débito se falhar;
- **garantia de dedução única:**
  1. ler `credit_transactions` por `(store_id, idempotency_key)`;
  2. se existir, validar identidade/refund e retornar;
  3. se não existir, `CreditService.reserveCredit(store, 1, { campaignId,
     idempotencyKey, metadata })`;
  4. se a chamada retornar `saldo_insuficiente`/`NULL` ou `23505`, reler a
     chave **uma vez**; se a dedução vencedora existir, retornar sucesso; se
     não, devolver insuficiência/estado incerto;
  5. nunca chamar `reserveCredit` de novo após a releitura;
- **prova de acesso:** dedução + `-1` + identidade coerente + nenhum refund
  com `reference = dedução.id`;
- **estado:** `delivered` se a prova vale; `refunded` se houver refund;
  `unknown` se a leitura falhar; `unavailable/incompatible` conforme pré-voo;
- **sem estorno automático** por falha de assinatura/download;
- **batch:** função de leitura em lote para lista/dashboard, sem Storage e sem
  binário por card.

## Task 3 — API

Nova rota `src/app/api/campaign/[id]/square-release/route.ts`:

- **GET** read-only: pré-voo + estado, sem débito;
- **POST**:
  - `requireSameOrigin` + `requireApiUser` + `requireOwnership`;
  - revalidar campanha 9:16, vertical delivered e artefato integral;
  - recomputar identidade/chave no servidor;
  - garantir a dedução única (com recuperação de corrida);
  - retornar `delivered`/`refunded`/erros fechados;
  - nenhum path, URL, token ou bytes na resposta;
- sem token de confirmação; justificativa: custo fixo, chave server-side,
  ledger idempotente, autenticação + CSRF + revalidação.

## Task 4 — Download e detalhe

- Download: novo ramo estrito para campanha `9:16` + `?format=1:1`:
  - exigir prova de liberação e `square_original` integral;
  - servir os bytes existentes do bucket interno;
  - inválido/duplicado/não liberado falha fechado, sem fallback;
  - `?format=9:16` e ausência de `?format` inalterados;
  - nenhuma alteração em `campaigns.storage_path`.
- Detalhe:
  - ler o estado da liberação apenas para campanha `9:16`;
  - chip do quadrado: “Liberar quadrado 1:1” quando elegível, custo 1 crédito;
    acompanhamento/estado honesto; link `?format=1:1` quando liberado;
  - modal própria/isolada com o contrato consulta ≠ confirmação ≠
    processamento;
  - Cancelar/Escape/clique fora permitidos antes da confirmação;
  - sem ação na lista/dashboard.

## Task 5 — Lista, dashboard e extrato

- Lista/dashboard: leitura em lote do estado de liberação por página:
  1. campanhas 9:16;
  2. operações verticais em lote;
  3. artefatos `square_original` em lote (sem bytes);
  4. chaves em memória;
  5. deduções por `store_id + idempotency_key IN (...)`;
  6. refunds por `reference IN (...)`;
  7. estado por card.
  Sem N+1, sem Storage, sem binário por card.
- Extrato: rotular a dedução com `metadata.kind='square_release'` como
  “Liberação do formato 1:1” (fallback atual preservado).
- Contabilidade: garantir `feature='square_release'`, fora de
  `metadata.feature='campaign_pipeline'`; teste de contrato do filtro.

## Task 6 — Testes e provas

Testes unitários/contrato:

- chave estável: mesmos dados ⇒ mesma chave; qualquer identidade diferente ⇒
  chave diferente; entrada do cliente não influencia;
- exatamente 1 crédito: chamada sempre com 1; leitura exige `amount=-1`;
- prova: dedução válida libera; refund revoga; metadados divergentes falham;
- concorrência simulada: `reserveCredit` retorna `NULL`/`23505` e a releitura
  encontra a vencedora ⇒ sucesso sem segunda chamada; releitura vazia ⇒
  insuficiência/incerteza;
- resposta perdida: segunda chamada não chama `reserveCredit`;
- pré-voo: quadrado ausente/inválido/indeterminado ⇒ zero débito;
- assinatura/download falhando depois do commit ⇒ liberação preservada, sem
  refund;
- batch: número constante de consultas, sem Storage, sem N+1;
- extrato/contabilidade: rótulo e filtro `feature`;
- auth/CSRF/ownership;
- regressões 1:1, F62, conjunto, vertical e download.

Provas de ambiente (etapa futura, somente com autorização):

- duas sessões Postgres, mesma chave, saldo 1 ⇒ uma dedução, mesmo `tx_id`,
  saldo 0;
- saldo ≥2 ⇒ uma dedução e `23505` na perdedora, resolvida por releitura;
- resposta perdida/retry;
- estorno e nova tentativa conforme decisão aberta.

## Gates

- testes afetados;
- typecheck;
- lint;
- `git diff --check`;
- build somente se necessário e com `.next` livre;
- nenhum acesso a ambiente, provider, banco, Storage ou chamada paga nesta
  etapa de planejamento.

## Entrega desta etapa

Plano revisado + lacunas. Nenhuma implementação, migration, banco ou Storage.
Sem merge, push ou deploy.

## Review Stop

Aguardar decisão sobre:

- aprovar a candidata pelo ledger ou exigir prova adicional;
- política de nova tentativa após estorno;
- performance/índice da leitura em lote;
- rótulo do extrato e escopo legado;
- autorização para a etapa de provas reais em ambiente isolado.
