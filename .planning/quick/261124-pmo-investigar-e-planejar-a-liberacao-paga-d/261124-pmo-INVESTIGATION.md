---
quick_id: 261124-pmo
slug: investigar-e-planejar-a-liberacao-paga-d
title: Liberação paga do quadrado 1:1 pelo ledger existente
status: proofs-passed-pending-final-review
created: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: 4c795c17
mode: investigacao-e-planejamento
approval:
  status: pending-final-review
  note: Candidata pelo ledger; prova técnica PASS em PostgreSQL descartável. Sem implementação.
---

# Investigação revisada 261124-pmo — liberação 1:1 pelo ledger

## Revisão da recomendação anterior

As opções A e B foram **descartadas nesta etapa**:

- A linha `1:1` isolada em `product_two_format_deliveries` não é segura: os
  leitores administrativos e a projeção conjunta esperam o **par completo**
  (1:1 + 9:16). Uma linha isolada seria classificada como vínculo incompleto.
- Criar tabela/RPC dedicada adiciona estrutura antes de esgotar o mecanismo de
  cobrança que já existe.

Nova candidata: usar a **dedução de 1 crédito no ledger existente** como
comprovante durável da liberação. Nenhuma migration, tabela, RPC, flag ou
segredo novo é necessário no desenho proposto. A candidata permanece **não
aprovada** até as provas de concorrência e recuperação.

Nesta etapa nenhum ambiente foi acessado ou modificado.

## Fatos comprovados no código

### 1. A tabela F62 continua fora do sentido inverso

`campaign_format_additions` fixa:

- `ck_cfa_source_format CHECK (source_format = '1:1')`
- `ck_cfa_target_format CHECK (target_format = '9:16')`

Fonte: `supabase/migrations/20261123130252_campaign_format_addition.sql`.

“9:16 → 1:1” falha no banco. A tabela não será usada.

### 2. O quadrado já existe e é recuperável sem cópia

A etapa `base` do fluxo vertical executa o `square-base` com o `operationId` da
operação de controle (`base-step.ts`). O artefato fica em
`campaign_composition_artifacts` como `role='square_original'`, `format='1:1'`,
1024×1024 JPEG, bucket interno, path determinístico.

`retrieveCompositionArtifact` valida identidade, autorização, path, bucket,
bytes, dimensões, MIME, tamanho e checksum. Serve os bytes existentes sem
copiar, reencodar ou alterar o vertical.

### 3. “Reserva” de crédito já é a dedução efetiva

`CreditService.reserveCredit` chama `reserve_credit` com valor, campanha,
chave de idempotência e metadados
(`src/lib/credit/credit-service.ts:84`). A RPC mais recente
(`supabase/migrations/20260920000001_f50_demo_credits.sql:612`):

- valida `p_amount > 0`;
- consulta `(store_id, idempotency_key)` e, se já existir uma dedução,
  devolve o mesmo `tx_id` sem cobrar de novo; se o tipo existente não for
  `deduction`, levanta `idempotency_conflict`;
- trava `credit_balances ... FOR UPDATE`;
- debita demo → bônus → comprado;
- insere `credit_transactions` com `type='deduction'`, `amount=-p_amount`,
  `campaign_id`, `idempotency_key` e `metadata` (acrescentando os splits de
  demo/bônus/comprado);
- atualiza o saldo na mesma transação;
- retorna `NULL` quando o saldo é insuficiente.

`CreditService.confirmCredit` é **no-op** (`credit-service.ts:108`). Não existe
segunda etapa de confirmação: a dedução já é o efeito financeiro.

### 4. Idempotência e recuperação já existem no ledger

- Índice único parcial:
  `(store_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
  (`20260716000001_create_credit_tables.sql`).
- `credit_transactions` é append-only (trigger bloqueia UPDATE/DELETE).
- `refund_credit` insere uma transação `type='refund'` com
  `reference = deduction_tx_id`, restaura o saldo e é idempotente por
  `reference` ou por chave (`refund_credit_at`, migração F50.2).
- O extrato (`getHistory`) lê `reason`, `reference`, `idempotency_key` e
  `metadata`.

### 5. Não é preciso criar operação primária nem vínculo conjunto

O desenho **não** cria linha em:

- `product_1_1_campaign_credit_operations`;
- `product_two_format_deliveries`;
- `campaign_format_additions`.

Consequências:

- `product_1_1_get_campaign_operation_by_campaign` continua vendo apenas a
  operação primária/vertical existente;
- leitores administrativos do par não são afetados;
- recuperação de operação primária e F62 não são tocadas;
- não há novo estado de crédito além do ledger.

## Demonstração da candidata

### 1. Chave de idempotência estável, definida pelo servidor

Canônico, montado **somente** após validar campanha/loja/vertical/artefato:

```text
square_release:v1
| storeId
| campaignId
| verticalOperationId
| artifactId
| artifactChecksumSha256
| square_original
| 1:1
```

A chave persistida é:

```text
square_release:v1:<sha256(canônico)>
```

Propriedades:

- não vem do cliente, de request id, de preço, de data ou de sessão;
- é estável entre GET, POST, retry, recarregar página e renovar a modal;
- muda apenas se a identidade validada mudar — o artefato é imutável e a
  operação vertical é única por campanha;
- o índice único `(store_id, idempotency_key)` garante uma única dedução por
  loja/chave.

Na leitura, a chave é **recomputada** a partir das identidades atuais e o
registro é validado; não se confia em metadados fornecidos pelo cliente.

### 2. Dedução de exatamente 1 crédito e prova de identidade

```ts
const RELEASE_COST_CREDITS = 1 as const;

const txId = await creditService.reserveCredit(storeId, RELEASE_COST_CREDITS, {
  campaignId,
  idempotencyKey: releaseKey,
  metadata: {
    kind: "square_release",
    version: 1,
    feature: "square_release",
    vertical_operation_id: verticalOperationId,
    artifact_id: artifactId,
    artifact_role: "square_original",
    artifact_format: "1:1",
    artifact_checksum_sha256: checksumSha256,
    artifact_width: 1024,
    artifact_height: 1024,
    artifact_mime: "image/jpeg",
    cost_credits: 1,
  },
});
```

O ledger não tem `CHECK (amount = 1)` para toda dedução; a garantia de **1
crédito** é a constante server-side `RELEASE_COST_CREDITS = 1` mais teste
explícito. Na leitura, exigir `type='deduction'`, `amount=-1`,
`campaign_id=C` e metadados de identidade iguais aos recomputados.

A liberação é comprovada por:

1. dedução encontrada por `(store_id, chave)`;
2. tipo `deduction`, valor `-1`, campanha correta;
3. metadados de identidade coerentes;
4. **nenhum** `refund` com `reference = dedução.id`.

Dedução estornada **não** libera acesso. O estorno não apaga a dedução
(append-only); é uma linha separada referenciando-a.

### 3. Duas confirmações concorrentes: uma cobrança

O ponto crítico é que `reserve_credit` faz a checagem de idempotência **antes**
de travar o saldo. Com a mesma chave, há dois cenários de perdedora:

- **Saldo vira zero:** a vencedora deduz 1 e commita; a perdedora espera o lock,
  lê saldo 0 e `reserve_credit` retorna `NULL`. O serviço traduz como possível
  corrida, relê `(store_id, chave)` e encontra a dedução da vencedora; retorna
  sucesso sem nova cobrança.
- **Saldo ainda cobre duas:** a perdedora passa pela checagem de saldo e tenta
  inserir a mesma chave; o índice único levanta `23505`. O serviço captura,
  relê `(store_id, chave)` e encontra a vencedora; retorna sucesso.

Regra: **nunca** chamar `reserve_credit` uma segunda vez após a releitura; se a
releitura falhar, devolver estado incerto/refresh, sem segundo débito. A prova
de concorrência real com duas sessões Postgres continua pendente.

### 4. Resposta HTTP perdida após o commit

O POST sempre começa lendo a dedução pela chave:

- encontrada e não estornada → `delivered`, sem chamar `reserve_credit`;
- não encontrada → tenta a dedução.

Se o commit ocorreu e a resposta se perdeu, o retry e o GET encontram a dedução
e recuperam a liberação sem nova cobrança.

### 5. Quadrado ausente/inválido/indeterminado antes da cobrança

A ordem é obrigatória:

1. validar campanha `9:16` e vertical `delivered`;
2. validar `square_original` (linha + `retrieveCompositionArtifact`);
3. somente então montar a chave e chamar `reserveCredit`.

Ausente, inválido ou indeterminado ⇒ **nenhum débito**. O artefato é imutável,
portanto não há TOCTOU relevante entre a validação e a dedução.

### 6. Falha posterior de assinatura/download

A dedução é a prova de acesso; assinatura é por requisição. Falha transitória de
assinatura/download:

- **não** estorna automaticamente;
- mantém a liberação;
- permite novo GET/download sem nova cobrança.

Estorno só por decisão explícita (suporte/rollback), e nesse caso o acesso é
revogado pela linha de refund.

### 7. Extrato, contabilidade e suporte

- **Extrato:** a dedução aparece como uma transação normal. O rótulo atual de
  `deduction` é “Geração”; o plano inclui rotular `metadata.kind =
  'square_release'` como “Liberação do formato 1:1”, sem migration.
- **Contabilidade:** a view `admin_cost_vs_credits` soma deduções com
  `metadata.feature = 'campaign_pipeline'`
  (`20260808000001_f38_1_create_ai_cost_accounting.sql`). A liberação usa
  `feature='square_release'`, portanto **não** entra em custo/margem de
  geração. Teste de contrato deve provar o filtro.
- **Suporte:** `reserve_credit` não recebe `reason`; a linha terá `reason`
  NULL. A identificação vem dos metadados (`kind='square_release'`), sem PII,
  path ou URL. O histórico administrativo existente mostra a transação.
- **Operação primária/recuperação:** intocadas, pois não há linha em
  `product_1_1_campaign_credit_operations` nem em tabelas conjuntas.

### 8. Leitura em lote para chips de lista/dashboard

Algoritmo por página (constante, sem N+1, sem validação binária por card):

1. filtrar campanhas com formato persistido `9:16` (puro);
2. uma consulta em lote a `product_9_16_two_stage_operations` para obter `V`;
3. uma consulta em lote a `campaign_composition_artifacts` para
   `role='square_original'` (id/checksum/dimensões, sem bytes);
4. calcular as chaves em memória;
5. uma consulta em lote a `credit_transactions` por
   `store_id + idempotency_key IN (...)` (índice único);
6. uma consulta em lote de refunds por `reference IN (tx_ids)`;
7. mapear `delivered/refunded/absent` por campanha.

Nenhuma leitura de Storage, nenhum probe binário e nenhuma consulta por card.
O detalhe continua fazendo a validação integral antes de exibir/baixar.

## Prova técnica executada (2026-11-24)

Ambiente: stack Supabase efêmero `f50-4-disposable-pmo-20261124a`,
`127.0.0.1:55422/postgres`, CLI 2.75.0, 159 migrations do repo, sentinela
descartável presente. **46/46 asserções PASS**; evidência em
`evidence/ledger-proof-results.json` e script em `proofs/ledger-proof.mjs`.

| Prova | Resultado |
|---|---|
| saldo 1, duas sessões | 1 dedução; perdedora `NULL`; releitura recuperou a vencedora; saldo 0 |
| saldo ≥2, duas sessões | 1 dedução; perdedora `23505`; releitura recuperou a vencedora; saldo 1 |
| resposta perdida | mesma transação; sem nova cobrança |
| replay após estorno | não libera nem cobra; refund único; saldo restaurado |
| falha de transporte antes do commit | `57P01`; rollback; 0 deduções; saldo intacto |
| lote (3 campanhas) | 4 consultas constantes; sem Storage; sem N+1 |
| plano de deduções | `Index Scan` em `idx_credit_transactions_idempotency` |
| plano de refunds | `Bitmap Heap Scan` em `idx_credit_transactions_store_id` + filtro |
| consumidores | ledger/saldo incluem a liberação; `admin_cost_vs_credits` filtra `campaign_pipeline`; `admin_get_metrics.credits_consumed` é VS-específico |

**Limitações:** a prova foi SQL direto, não pelo `CreditService`, rota, UI ou
pré-voo real de artefato. O serviço deve implementar a releitura em `NULL`/
`23505`; isso será coberto por testes unitários na implementação.

## Lacunas restantes

1. **Total financeiro global:** ledger/extrato/saldo incluem o consumo, mas
   `admin_get_metrics.credits_consumed` é VS-específico e
   `admin_cost_vs_credits` é custo de IA. Não há, neste código, um total global
   que some todas as deduções. Se for requisito, é uma lacuna de relatório
   separada.
2. **Estorno operacional:** definir se haverá ação de suporte. Se sim, o refund
   revoga o acesso; nova compra fica bloqueada nesta quick.
3. **Escopo legado:** manter somente campanha nova `9:16` com
   `square_original` comprovado.
4. **Volume do filtro de refunds:** o plano usa o índice de loja + filtro, sem
   índice novo; observar volume por loja.
5. **CSRF/auth e pré-voo real:** implementação/testes, não prova de banco.
6. **Sem N+1/Storage por card:** comprovado no SQL; falta prova no código real.

## Não objetivos

- Não implementar antes da revisão final.
- Não criar migration, tabela, RPC, flag ou segredo.
- Não usar a tabela F62 no sentido inverso.
- Não criar linha em `product_two_format_deliveries` ou
  `product_1_1_campaign_credit_operations`.
- Não alterar vertical, copy, snapshot, `storage_path`, operação primária ou
  contabilidade existente.
- Não acessar ambiente compartilhado/produção.
- Não fazer merge, push ou deploy.
