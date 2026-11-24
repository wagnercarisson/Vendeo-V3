---
quick_id: 261124-pmo
slug: investigar-e-planejar-a-liberacao-paga-d
title: Plano revisado — liberação 1:1 pelo ledger, sem migration
status: implementation-complete-pending-manual-review
created: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: 4c795c17
mode: implementacao-focada
approval:
  status: approved
  note: Desenho aprovado; implementação concluída. Teste manual completo pendente no Review Stop.
---

# Plano revisado 261124-pmo — liberação 1:1 pelo ledger

## Correções pós-revisão (2026-11-24) — antes do código

1. **Pré-condição da cobrança incompleta (alta).** A API checava formato 9:16 e
   operação `delivered`, mas não comprovava origem nova, operação de controle e
   vertical íntegro. Correção: pré-voo com `nineSixteenVerticalAccess`
   (origem `two_stage_9_16`, crédito `delivered`, probe vertical integral) antes
   de qualquer débito. Fonte ausente/inválida/indeterminada não cobra.
   Liberação já paga continua recuperável pelo ledger sem repetir o pré-voo.
2. **Chip perdia a recuperação.** A ação do chip era escolhida pelo estado
   (`eligible`), voltando ao 9:16 em `unknown/unavailable/refunded/incompatible`.
   Correção: escolher o formato da ação pela origem da campanha (campanha 9:16
   ⇒ ação no 1:1), separando isso da permissão de compra; estados excepcionais
   abrem a consulta/explicação e nunca oferecem cobrança.
3. **GET `delivered` não atualizava a página.** Correção: GET que recupera
   `delivered` conclui a jornada uma única vez por sessão, respeitando descarte
   de respostas obsoletas; POST continua concluindo uma única vez.
4. **Releitura financeira falha virava falso “saldo insuficiente”.** Correção:
   distinguir `none` (ausência comprovada) de `read_failed` (incerteza). Após
   `saldo_insuficiente`, `read_failed` retorna `unknown`, nunca insuficiência.

**Validador F62:** tratar separadamente, com correção mínima autorizada, sem
excluir a suíte nem enfraquecer verificações.

## Objetivo

Liberar o quadrado 1:1 já armazenado de uma campanha entregue em 9:16,
cobrando exatamente 1 crédito, usando a dedução no ledger existente como
comprovante durável. Sem migration, tabela, RPC, flag ou segredo novo.

**Status:** prova técnica **PASS** em PostgreSQL local descartável; implementação
de UI/API ainda **não iniciada**, aguardando o Review Stop.

## Prova técnica executada (2026-11-24)

Ambiente: stack Supabase efêmero `f50-4-disposable-pmo-20261124a`,
`127.0.0.1:55422/postgres`, CLI 2.75.0, **159 migrations do repo**, sentinela
`f50_4_harness_identity` presente. Nenhum ambiente compartilhado foi acessado.
Evidência: `evidence/ledger-proof-results.json`; script:
`proofs/ledger-proof.mjs`.

Resultado: **46/46 asserções PASS**.

| Prova | Resultado real |
|---|---|
| Saldo 1, duas sessões | Sessão A deduziu; B aguardou o lock, recebeu `NULL`, releu a chave e recuperou a mesma transação; 1 dedução; saldo 0. |
| Saldo ≥2, duas sessões | A deduziu; B recebeu `23505` (`idx_credit_transactions_idempotency`), releu a chave e recuperou a mesma transação; 1 dedução; saldo 1. |
| Resposta perdida | Duas chamadas com a mesma chave retornaram o mesmo `tx_id`; 1 dedução; sem nova cobrança. |
| Replay após estorno | Estorno único; saldo restaurado; repetição devolve a mesma dedução e o mesmo estorno; acesso negado pela presença do refund. |
| Falha de transporte antes do commit | Backend terminado (`57P01`); transação revertida; 0 deduções; saldo intacto. |
| Lote (3 campanhas) | 4 consultas constantes; nenhum Storage; campanha liberada `delivered`, demais `absent`; sem N+1. |
| Plano de deduções | `Index Scan` em `idx_credit_transactions_idempotency`. |
| Plano de refunds | `Bitmap Heap Scan` por `idx_credit_transactions_store_id` + filtro; sem índice novo. |
| Consumidores | Deduções totais da loja incluem a liberação; saldo reflete; `admin_cost_vs_credits` filtra `campaign_pipeline`; `admin_get_metrics.credits_consumed` é VS-específico. |

**Limitações da prova:** executada em SQL direto, não pelo `CreditService`/rota;
não exercita pré-voo real de artefato, HTTP, CSRF, UI ou assinatura. O serviço
deve implementar a recuperação de `NULL`/`23505` e a releitura obrigatória,
cobertas por testes unitários na implementação. O lote de refunds usa o índice
de loja + filtro (sem índice novo); volume por loja deve ser observado.

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

## Decisões fechadas na revisão

- **Após estorno:** bloquear nova compra da mesma liberação nesta quick. Não
  criar nova chave automaticamente; replay não cobra e não libera.
- **Confirmação:** autenticação + ownership + CSRF + revalidação server-side;
  sem token/segredo novo.
- **Formato padrão:** `9:16`; quadrado por `?format=1:1`.
- **Extrato:** rótulo “Liberação do formato 1:1” derivado de
  `metadata.kind='square_release'`. `reserve_credit` não recebe `reason`; a
  linha terá `reason` NULL, sem prometer esse campo.
- **Contabilidade:** a liberação não é custo de IA e fica fora de
  `campaign_pipeline`, mas o consumo permanece no ledger/saldo/extrato.
- **Lote:** 4 consultas constantes; sem N+1, Storage por card ou índice novo.

## Lacunas restantes

1. **Total financeiro global:** o ledger e o extrato incluem o consumo, mas
   `admin_get_metrics.credits_consumed` é VS-específico e
   `admin_cost_vs_credits` é custo de IA. Não foi encontrado, neste código, um
   total global de consumo que some todas as deduções. Se esse total for
   requisito, é uma lacuna de relatório separada — não refatorar fora do
   escopo nesta quick.
2. **Estorno operacional:** definir se haverá ação de suporte; se sim, o refund
   revoga o acesso.
3. **Escopo legado:** manter somente campanha nova `9:16` com
   `square_original` comprovado.
4. **Volume do filtro de refunds:** o plano usa o índice de loja + filtro; sem
   índice novo. Observar volume por loja antes de considerar indexação.

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

Provas de ambiente executadas em 2026-11-24 (PASS; stack descartável):

- duas sessões, saldo 1: uma dedução, perdedora `NULL` e releitura da vencedora;
- duas sessões, saldo ≥2: uma dedução, perdedora `23505` e releitura;
- resposta perdida/retry: mesma transação, sem nova cobrança;
- replay após estorno: não libera nem cobra novamente;
- falha de transporte antes do commit: rollback total, zero dedução;
- lote: 4 consultas constantes; deduções por índice único; refunds por índice
  de loja + filtro; sem Storage por card.

## Gates

- testes afetados;
- typecheck;
- lint;
- `git diff --check`;
- build somente se necessário e com `.next` livre;
- nenhum acesso a ambiente compartilhado/produção, provider, Storage de
  produção ou chamada paga nesta etapa.

## Entrega desta etapa

Plano final + prova técnica. Nenhuma implementação, migration, tabela, RPC,
flag ou segredo. O banco descartável foi destruído após a prova. Sem merge,
push ou deploy.

## Review Stop

Aguardar decisão final para iniciar a implementação focada, com atenção às
lacunas restantes:

- total financeiro global (ledger/extrato OK; relatório global inexistente);
- estorno operacional de suporte;
- escopo legado;
- volume do filtro de refunds (sem índice novo).
