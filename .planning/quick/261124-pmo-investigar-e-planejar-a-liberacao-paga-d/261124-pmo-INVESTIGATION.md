---
quick_id: 261124-pmo
slug: investigar-e-planejar-a-liberacao-paga-d
title: Liberação paga do quadrado 1:1 já armazenado após entrega 9:16
status: investigation
created: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: 4c795c17
mode: investigacao-e-planejamento
approval:
  status: pending-design-review
  note: Nenhum código, migration, banco ou Storage será alterado antes da revisão do desenho.
---

# Investigação 261124-pmo — liberação paga do quadrado 1:1

## Pergunta

Como liberar para o lojista o **quadrado 1:1 já armazenado** de uma campanha
entregue em **9:16**, cobrando **exatamente 1 crédito**, sem alterar a arte
vertical, a copy, a operação vertical ou a projeção atual da campanha — e sem
tratar a tabela F62 como se ela aceitasse o sentido inverso?

Escopo desta etapa: **somente investigação e planejamento**. Nada foi
implementado, migrado, aplicado, gerado ou cobrado.

## Fatos comprovados no código atual

### 1. A tabela F62 é unidirecional por constraint

`campaign_format_additions` fixa a direção no schema:

- `ck_cfa_source_format CHECK (source_format = '1:1')`
- `ck_cfa_target_format CHECK (target_format = '9:16')`

Fonte: `supabase/migrations/20261123130252_campaign_format_addition.sql`
(colunas + constraints `ck_cfa_*`).

Portanto, registrar “9:16 → 1:1” nessa tabela **falha no banco**. Ela não é
candidata para a liberação do quadrado. Qualquer desenho que a reutilize no
sentido inverso está descartado.

### 2. O quadrado já existe e é recuperável sem cópia

No fluxo vertical 9:16, a etapa `base` executa o mesmo `square-base` com o
`operationId` da operação de controle vertical
(`src/lib/product-9-16-two-stage/orchestration/base-step.ts`). O artefato é
persistido pela F60.1 em `campaign_composition_artifacts` como:

- `role = 'square_original'`
- `format = '1:1'`
- 1024×1024, JPEG
- bucket `campaign-internal-artifacts`
- path determinístico
  `{store}/{campaign}/{operation}/square_original.jpg`

A tabela `campaign_composition_artifacts` é imutável por trigger e tem
identidade única `(store_id, campaign_id, operation_id, role)`.

`retrieveCompositionArtifact(...)` valida identidade, autorização, path, bucket,
bytes, dimensões, MIME, tamanho e checksum antes de devolver os bytes
(`src/lib/campaign/composition-artifacts/retrieve.ts`). Logo, a liberação pode
**servir os bytes existentes no bucket interno**, sem copiar, sem reencodar e
sem tocar no vertical.

### 3. A cobrança de exatamente 1 crédito já existe

`product_1_1_campaign_credit_operations`:

- `CONSTRAINT chk_p1_1_campaign_credit_operations_amount CHECK (amount = 1)`
- identidade única `(campaign_id, operation_id)`
- estados `reserved | art_uploaded | delivered | refunded`

As autoridades existentes são:

- `product_1_1_reserve_credit_operation(store, campaign, operation, 1, metadata)`
  — reserva **um** crédito no ledger na mesma transação, com chave de
  idempotência `p1_1_reserve_{campaign}_{operation}` e rollback total em falha;
- `product_1_1_begin_publication(campaign, operation)` — fence/token;
- `product_1_1_mark_campaign_credit_art_uploaded(campaign, operation, token)`;
- `product_1_1_deliver_campaign_credit_operation(campaign, operation, token)`;
- `product_1_1_refund_campaign_credit_operation(campaign, operation, reason)`.

Fontes: `supabase/migrations/20261008000002_f56_2b1a_product_1_1_campaign_credit.sql`
e `supabase/migrations/20261016000001_f56_2b2b_publication_fence.sql`.

A RPC de reserva recusa qualquer valor diferente de 1 (`invalid_credit_amount`)
e o CHECK do banco reforça o mesmo invariante. Não é necessário criar preço,
tabela de preço, crédito de 2 ou uma segunda cobrança.

### 4. Existe um vínculo durável por formato, mas a RPC conjunta não serve

`product_two_format_deliveries` aceita **uma linha por formato**:

- `format IN ('1:1','9:16')`
- `artifact_role IN ('square_original','vertical')`
- `1:1` exige `artifact_role='square_original'` e
  `delivery_operation_id <> operation_id`
- FK para a operação de controle em `product_9_16_two_stage_operations`
- FK para a identidade financeira em `product_1_1_campaign_credit_operations`
- uniques por `(campaign, operation, format)` e por `delivery_operation_id`

O schema **permite** uma linha `1:1` isolada. Porém, a RPC existente
`product_two_format_deliver_format` chama
`product_two_format_project_campaign`, que exige **dois vínculos** coerentes
(1:1 + 9:16) e levanta `delivery_links_inconsistent` quando há apenas um. Como a
entrega e a projeção ocorrem na mesma transação, essa RPC não pode ser usada
para a liberação isolada.

Conclusão: o **vínculo** existente é aproveitável; a **RPC conjunta** não é.

### 5. A operação de liberação não pode ser confundida com a operação primária

`product_1_1_get_campaign_operation_by_campaign` escolhe a operação de crédito
mais recente, excluindo apenas adições F62 via
`campaign_format_additions`. Uma nova operação de crédito para o quadrado
apareceria como a “operação da campanha” em leituras que usam essa RPC.

Portanto, o desenho precisa excluir explicitamente a operação de liberação
dessa leitura (por exemplo, `NOT EXISTS` contra o vínculo `1:1` de liberação).
Isso será um teste obrigatório.

### 6. Hoje a campanha 9:16 só entrega o vertical

Na rota de download, campanhas com `generationOrigin = two_stage_9_16` entram no
ramo vertical e **sempre** servem o vertical; não existe caminho `?format=1:1`
para esse formato. O ramo F62 de `?format=` só existe para campanha `1:1` com
adição posterior (`src/app/api/campaign/[id]/download/route.ts`).

A liberação exige um ramo novo e estrito: `9:16` + `?format=1:1` só serve o
quadrado quando a liberação estiver `delivered` e o artefato `square_original`
for integral. Sem fallback para o vertical.

### 7. A apresentação atual só prevê adição do 9:16

`buildIndividualFormatPresentation` recebe uma adição opcional tipada
`format: "9:16"`. Para a campanha persistida `9:16`, o quadrado é sempre
`absent/not_requested`. É necessário um input simétrico de liberação do `1:1`
(sem reutilizar a semântica da tabela F62).

## Demonstração — usando as estruturas existentes

Identidades:

- `S` = store
- `C` = campaign
- `V` = operação de controle vertical já existente
- `R` = nova operação de crédito exclusiva da liberação do quadrado

### Passo 1 — pré-condições (somente leitura)

- `campaigns` pertence a `S`;
- `campaigns.input_snapshot->>'campaignFormat' = '9:16'` e
  `formatContractVersion = 'f59-vertical-9-16-v1'`;
- operação `V` existe em `product_9_16_two_stage_operations` para `C/S`;
- crédito de `V` em `product_1_1_campaign_credit_operations` está `delivered`;
- `square_original` de `(C,V)` existe e `retrieveCompositionArtifact` devolve
  `integral` (verificação server-side, antes de reservar);
- não existe vínculo de liberação ativo para `(C,V)`;
- não há vínculo `9:16` para a mesma campanha (a campanha é individual, não
  conjunta).

Se qualquer pré-condição falhar, **não reserva**.

### Passo 2 — registrar e cobrar na mesma transação

Dentro de uma RPC nova (a tabela de vínculo é `SELECT`-only para
`service_role`; INSERT direto não é permitido):

```sql
-- pseudocódigo do corpo da RPC, com as autoridades reais
SELECT ... FROM public.campaigns
 WHERE id = C AND store_id = S
 FOR UPDATE;

-- valida 9:16, V entregue, ausência de vínculo 9:16 e inexistência de
-- liberação ativa; replay retorna o vínculo existente sem cobrar

SELECT public.product_1_1_reserve_credit_operation(
  S, C, R, 1,
  jsonb_build_object(
    'kind', 'square_release',
    'source_operation_id', V,
    'artifact_role', 'square_original'
  )
);

INSERT INTO public.product_two_format_deliveries (
  campaign_id, operation_id, store_id, format,
  delivery_operation_id, artifact_role
) VALUES (
  C, V, S, '1:1', R, 'square_original'
);
```

Invariantes:

- `amount = 1` é garantido pela autoridade e pelo CHECK;
- a reserva entra no ledger com idempotência por `(C,R)`;
- se o INSERT falhar, a reserva é desfeita na mesma transação;
- concorrência: o unique `(C,V,'1:1')` e a identidade `(C,R)` impedem duas
  liberações; a perdedora faz rollback da própria reserva;
- replay: se o vínculo já existe, a RPC devolve o `R` existente e o estado do
  crédito, sem nova cobrança.

### Passo 3 — entregar o crédito e liberar o acesso

Depois de o servidor confirmar `square_original` integral:

```sql
SELECT public.product_1_1_begin_publication(C, R);          -- token
SELECT public.product_1_1_mark_campaign_credit_art_uploaded(C, R, token);
SELECT public.product_1_1_deliver_campaign_credit_operation(C, R, token);
```

Não há upload, cópia ou regeneração: o objeto existente é a arte publicada. A
opção `product_1_1_confirm_existing_art(C, R, 'integral')` também existe para
arte já existente, mas o caminho padrão com fence/token é preferível para não
perder a semântica de publicação e de recuperação.

### Passo 4 — falha e estorno

- Falha comprovada antes da publicação: `product_1_1_refund_campaign_credit_operation(C,R,motivo)`
  devolve exatamente o crédito reservado.
- Estado de publicação `in_flight`/`result_unknown`/`published`: seguir as
  regras existentes do fence; nunca estornar cegamente.
- `unknown`: não estornar nem liberar; manter acompanhamento.
- `delivered` é terminal e não estorna.

### Passo 5 — acesso ao quadrado

- A rota de download lê o vínculo `1:1` + crédito `R = delivered`;
- valida `square_original` integral com `retrieveCompositionArtifact`;
- serve os bytes do bucket interno com `Content-Disposition: attachment`;
- não altera `campaigns.storage_path`, `input_snapshot`, copy, vertical ou
  projeção; o vertical continua sendo o formato preferido da campanha.

## O que já existe vs. o que falta

| Necessidade | Estrutura existente | Situação |
|---|---|---|
| Cobrar 1 crédito | `product_1_1_campaign_credit_operations` + RPCs de reserva/entrega/estorno | **Reutilizável** |
| Ledger/idempotência | `reserve_credit` com chave `p1_1_reserve_C_R` | **Reutilizável** |
| Arte quadrada | `campaign_composition_artifacts` (`square_original`) + `retrieveCompositionArtifact` | **Reutilizável, sem cópia** |
| Vínculo formato↔crédito | `product_two_format_deliveries` (linha `1:1` isolada) | **Estruturalmente possível; RPC conjunta não serve** |
| Registro da liberação | Nova RPC que reserve + insira o vínculo | **Necessária** |
| Exclusão da operação primária | `product_1_1_get_campaign_operation_by_campaign` | **Precisa ser estendida** |
| Leitura/UI/download do quadrado liberado | Novo reader + ramo `?format=1:1` + apresentação | **Necessário** |
| Tabela F62 | `campaign_format_additions` | **Não serve: direção fixa 1:1 → 9:16** |

## Decisão estrutural em aberto (para revisão)

**Opção A (recomendada para esta quick):** reutilizar
`product_two_format_deliveries` como vínculo `1:1` isolado, com uma RPC nova de
abertura e uma guarda explícita de que a campanha é `9:16` individual (sem
vínculo `9:16`). Não cria tabela nova. Exige documentar que uma linha `1:1`
isolada é um uso deliberado de liberação e que a projeção conjunta não é
chamada.

**Opção B:** criar uma tabela dedicada `campaign_square_releases` (campanha,
loja, operação de controle, operação de crédito, timestamps), mantendo
`product_two_format_deliveries` exclusivamente para o par. Mais limpa
semanticamente, porém adiciona tabela e migration.

A escolha precisa de aceite humano porque a Opção A reutiliza uma tabela cujo
nome expressa “dois formatos”, ainda que os constraints permitam a linha
isolada.

## Riscos e decisões para o Review Stop

1. **Opção A vs. B** — reutilizar o vínculo conjunto ou criar tabela dedicada.
2. **Token de confirmação** — criar token próprio da liberação (mesmo segredo
   `FORMAT_ADDITION_CONFIRMATION_SECRET`, payload com `kind` distinto) ou usar
   confirmação autenticada sem token adicional.
3. **Formato preferido após a liberação** — manter `9:16` como preferido e o
   quadrado acessível por `?format=1:1`; não reprojetar `campaigns.storage_path`.
4. **Escopo legado** — liberar somente campanha nova `9:16` com
   `square_original` comprovado; legado sem esse artefato fica fora.
5. **Fence** — usar `begin/mark/deliver` ou `confirm_existing_art`; recomendo o
   primeiro.
6. **Exclusão em `getCampaignOperation`** — obrigatória para a operação `R` não
   virar a operação primária.
7. **Ambiente** — migration nova precisa de autorização separada para
   aplicação; nada será aplicado nesta fase.

## Não objetivos

- Não alterar a tabela F62 nem sua semântica.
- Não alterar vertical, copy, `input_snapshot` ou `campaigns.storage_path`.
- Não copiar/reencodar a arte quadrada.
- Não gerar imagem nem chamar provider.
- Não implementar UI/rota/migration antes da revisão do desenho.
- Não fazer merge, push ou deploy.
