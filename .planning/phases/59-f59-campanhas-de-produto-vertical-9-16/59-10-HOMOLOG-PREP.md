# F59 / 59-10 — Preparação da homologação (NÃO EXECUTADA)

Data de preparação: 2026-11-05. Este documento apresenta o seed OFF, o ambiente
proposto e o roteiro manual para autorização específica. **Nada foi aplicado,
ativado, gerado ou publicado.**

## 1. Estado

- Código local: Wave 7 local aprovada; suítes 1:1, IA e vertical verdes.
- Seed: arquivo criado, **não aplicado**.
- Flag `product_9_16_enabled`: **OFF**; ativação não autorizada.
- Homologação: ledger reconciliado (152 × 152, sem lacunas); seed F59 ainda não
  copiado/aplicado (ver `59-10-HOMOLOG-BASELINE.md`).
- Produção: não acessada.
- Chamadas pagas novas: nenhuma.

## 2. Seed OFF proposto

Arquivo local:

`supabase/migrations/20261105162052_f59_product_9_16_flag.sql`

Conteúdo efetivo:

```sql
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'product_9_16_enabled',
  false,
  'Registra a preparação inativa do Produto vertical 9:16. Não ativa geração, roteamento, provider, crédito, entrega ou download; apenas permite administração futura da flag.'
)
ON CONFLICT (key) DO NOTHING;
```

Garantias:

- data-only; nenhum `ALTER`, `CREATE`, `GRANT` ou `DROP`;
- `enabled = false`;
- reaplicação idempotente por `ON CONFLICT (key) DO NOTHING`;
- timestamp UTC de 14 dígitos: `20261105162052`;
- verificação de prefixo: sem colisão na worktree e nas branches conhecidas
  (`main`, `origin/main`, `feat/fase-59-campanhas-produto-vertical-9-16`,
  `feat/pagina-publica-padarias`, `feature/fase-44-temas-de-campanha-v2`,
  `origin/feature/fase-44-temas-de-campanha-v2`).

Aplicação permitida **somente em homolog**, após autorização específica, e com
comprovação da linha `enabled = false`.

## 3. Ambiente proposto

Confirmar no momento da autorização, sem imprimir segredos:

- ambiente: `vendeo-homolog` local;
- API: `127.0.0.1:57781`;
- banco: `127.0.0.1:57782/postgres`;
- workdir de referência: `G:\Vendeo-Homolog`;
- lojas de teste: `is_test_store = true` (Adega e NovaTek, IDs a capturar no
  baseline);
- saldo controlado por loja, registrado antes da matriz;
- chave de provider de homolog, nunca produção;
- commit de código em teste a registrar no baseline;
- fingerprint do ledger de migrations a registrar;
- orçamento de UAT: **pendente de aprovação humana**, separado do teto de
  US$ 3,00 da prova técnica;
- número máximo de gerações pagas: **pendente**, deve ser declarado antes da
  matriz.

Declaração obrigatória no baseline: **produção NÃO será acessada**.

## 4. Ordem de autorização

1. Aprovar o arquivo de seed e o timestamp acima.
2. Autorizar aplicação do seed **somente** em homolog.
3. Comprovar `product_9_16_enabled` existente com `enabled = false` e o painel
   admin renderizando a linha.
4. Registrar baseline: ambiente, lojas, saldos, flag OFF, campanha 1:1 de
   referência e contagens read-only.
5. Aprovar orçamento e limite de gerações pagas.
6. Autorizar a ativação temporária da flag via RPC auditado com motivo.
7. Autorizar a execução da matriz manual.
8. Ao final, desligar a flag via RPC auditado e registrar o ciclo.

## 5. Roteiro de validação manual

Cada item deve ser registrado como **PASS / FAIL / PENDING**, com id, path,
dimensão, crédito e evidência.

### 5.1 Pré-condições

- lojas de teste e saldo controlado confirmados;
- flag OFF antes da matriz;
- baseline 1:1 capturado;
- orçamento de UAT e limite de gerações aprovados;
- ambiente de homolog confirmado.

### 5.2 Matriz vertical (flag ON)

Para cada intenção/fundo acordado:

- gerar campanha 9:16 em loja de teste;
- registrar `campaignId` e `operationId`;
- confirmar arte JPEG 1080×1920;
- confirmar path
  `{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`;
- confirmar consumo de 1 crédito;
- confirmar miniatura WebP 162×288;
- abrir detalhe com container vertical e `object-contain`;
- confirmar listagem com miniatura;
- baixar e confirmar `attachment` JPEG e nome seguro.

### 5.3 Falhas e recuperação

- resultado desconhecido: sem estorno automático e sem retry cego;
- falha confirmada: estorno único;
- reenvio: consulta query-only, sem nova geração;
- operação já entregue: sem novo crédito/provider;
- recuperação vertical: arte existente chega a detalhe/listagem **sem nova
  geração** e **sem path 1:1**.

### 5.4 Ciclo de flag

- iniciar geração vertical com flag ON;
- desligar a flag via RPC auditado;
- comprovar consulta, download, recuperação de imagem/copy, detalhe, listagem e
  resolução administrativa preservados;
- comprovar que a geração em andamento chega ao terminal;
- comprovar nova submissão vertical rejeitada **antes** de reserva/provider.

### 5.5 Restauração

- vertical restaurado com flag ON: permanece 9:16 e reenvia 9:16;
- vertical restaurado com flag OFF: visível, bloqueado e sem troca para 1:1;
- 1:1 restaurado: permanece 1:1.

### 5.6 Regressão 1:1 manual

- gerar campanha 1:1 em homolog com loja de teste;
- confirmar arte 1024×1024 e path `product-1-1/.../art-1024.jpg`;
- comparar download e miniatura com o baseline;
- confirmar que nenhuma campanha existente foi afetada pela flag.

### 5.7 Revisão visual

Aplicar sobreposições reais de Stories/Reels e registrar por critério:

- essencial dentro da área segura (`safe-area-9-16-v1`);
- sem faixas, guias ou letterbox;
- fundo preenchendo todo o canvas;
- peça compreensível sem legenda;
- legibilidade de produto, preço, badge, validade, texto obrigatório, CTA e
  identidade.

### 5.8 Encerramento

- desligar a flag via RPC auditado;
- registrar custo total observado contra o orçamento de UAT;
- comparar contagens com o baseline e registrar resíduos;
- emitir relatório com `homolog-ready` ou FAIL explícito;
- marcar produção como **NÃO aprovada** e gate de produção como **não executado**.

## 6. Proibições

- Aplicar seed em produção.
- Ativar a flag sem autorização específica.
- Executar geração paga sem orçamento e acompanhamento.
- Declarar PASS sem evidência.
- Regenerar arte durante recuperação.
- Fazer push, deploy ou smoke de produção.
- Publicar arte de loja real.

## 7. Evidências a produzir

- linha da flag com `enabled = false` e depois o ciclo OFF → ON → OFF;
- campanha 1:1 baseline e campanha 1:1 manual;
- campanhas verticais com ids, paths, dimensões e crédito;
- download e miniatura;
- recuperação vertical;
- sobreposições visuais e vereditos;
- custo total da UAT;
- contagens antes/depois.

## 8. Decisão solicitada

Solicito autorização específica para:

1. aplicar o seed data-only acima **somente em homolog**;
2. registrar o baseline e validar a linha OFF;
3. aprovar orçamento e limite de gerações pagas;
4. ativar a flag temporariamente para a matriz manual acompanhada.

Nenhum desses passos foi executado nesta preparação.
