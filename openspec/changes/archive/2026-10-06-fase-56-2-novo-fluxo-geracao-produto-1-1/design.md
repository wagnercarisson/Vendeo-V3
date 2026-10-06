## Context

A F56 divide a incorporação produtiva do fluxo Produto 1:1 em três fatias: F56.1 (contrato, modelos e fallback — **concluída, arquivada em 2026-10-06**), **F56.2 (esta proposta — geração real e entrega direta)** e F56.3 (aprovação/correção). A F56.1 entregou componentes puros e server-only, testados por simulação, **sem** campanha, provider ou crédito real:

- Capacidade própria `campaign_product_image` (distinta de `campaign_image`/`campaign_image_edit`), registrada no `ai_model_catalog`, com barreira fail-closed `AiNewFlowConfigRequiredError` no `PersistedModelResolver` (`src/lib/ai/persisted-model-resolver.ts:142`).
- Configuração global auditável do par (`image_model_pair_config`, RPC `admin_set_image_model_pair_config`, serviço server-only com cache/TTL e resolução fail-closed — `src/lib/ai/image-model-pair-config-service.ts`).
- Tabela de snapshot por campanha com colunas tipadas, origem fechada (`human_decision`/`selection`) e trigger de imutabilidade (`supabase/migrations/20261005000002_f56_1_snapshot_pricing_quality.sql`, `image_generation_config_snapshots`); componente puro de snapshot/correção/correlação (`src/lib/ai/image-generation-config-snapshot.ts`).
- Política de falhas pura (`classifyImageGenerationFailure`, `nextImageGenerationAttempt`, teto 2+1=3, `charged/consumedCredit = false` — `src/lib/ai/image-generation-failure-policy.ts`).
- Resposta pública `IMG-001` + referência opaca UUID v4 e repositório durável `image_generation_failure_diagnoses` (`src/lib/ai/image-generation-support-reference.ts`, `image-generation-diagnosis-repository.ts`).
- Adapter do novo fluxo que propaga `quality` (`src/lib/ai/adapters/upstream-images.ts`) e runtime isolado (`src/lib/ai/upstream-images-runtime.ts` — `createNewFlowImageGateway(pair)`).
- Pricing ciente de qualidade com cobertura `complete`/`partial`/`missing` e fail-closed `image_pair_pricing_incomplete` (`src/lib/ai-cost/image-pair-pricing.ts`).
- Envelope de telemetria aditivo com `quality`/`target`/`attemptNumber` (`src/lib/ai/gateway.ts`).

Nenhum desses componentes tem **caller** em geração real hoje. O fluxo de produção atual vive em `src/app/api/campaign/generate-image/route.ts`, que: extrai intenção do formulário, reserva crédito por `campaignId`, roda copy ∥ imagem, invoca o revisor automático (`campaign_image_review`), persiste em `campaign-images` e governa download pelo gate `campaign_approval_enabled`. A copy é **fatal**: se falha, aborta a imagem e estorna o crédito (`generate-image/route.ts:673-679,867-894`). Estado relevante:

- **Flags**: `feature_flags` via `FeatureFlagService` (`isCampaignApprovalEnabled` fail-closed; `isCampaignGenerationEnabled` fail-open). `stores.is_test_store` já existe (F33) e é usado para excluir lojas de teste de métricas e grants.
- **Créditos**: `reserve_credit` já **deduz** no momento da reserva; `confirmCredit` é **no-op** em v1.5; `refund_credit` é idempotente. `OperationCostService` define `campaign_generation = 1 crédito`.
- **Download**: `GET /api/campaign/[id]/download` serve bytes de `campaign-images` após `requireOwnership` e gate de aprovação.
- **Bancada F48.2.6** contém os prompts/políticas aprovados (`COMPOSER_VERSION=48.2.4-prompt-composer-v5`, `PRODUTO_POLICY_VERSION=48.2.6-produto-v4`, `BENCH_DEFAULT_PROMPT_BASE_VERSION=48.2.6-produto-1-1-v1`, direção de fundo em `background-direction.ts`), **estáticos, pinados e somente de bancada** — não são consumidos pela produção.
- **Ressalva F56.1→F56.2 (registrada em `.planning/STATE.md`)**: o snapshot é único por campanha (`campaign_id UNIQUE`), mas `run_id`/`trace_id` são atualizáveis; correção futura **não** pode sobrescrever a referência histórica. A correlação de cada geração precisa viver em telemetria ou relação própria.

## Goals / Non-Goals

**Goals:**

- Roteamento server-side por duas chaves de ativação auditáveis (lojas de teste / todas as lojas), desligadas por padrão, com precedência, rollback e preservação do legado.
- Seleção explícita de intenção (Oferta/Destaque/Exclusivo) e de fundo (Estúdio/Ambientado/Original) no formulário de Produto, com a regra "Original exige exatamente uma imagem de produto".
- Geração real Produto 1:1 (saída 1024×1024) executando os componentes F56.1, com snapshot por campanha, preflight de pricing fail-closed, política de tentativas, telemetria por tentativa e `IMG-001` + diagnóstico durável.
- Cobrança transacional de **um crédito por campanha entregue**, com não-débito de falha técnica sem arte utilizável e idempotência testável.
- Copy **não bloqueante** com ação de nova tentativa de copy autenticada, sem novo crédito e sem regenerar imagem.
- Persistência/download direto da arte do novo fluxo, preservando as regras de download das campanhas antigas e não sendo governado pela F37.
- Histórico append-only por geração/tentativa, sem sobrescrever o run/trace histórico, preparando a F56.3.
- Verificação e implantação em caminho isolado, com gates locais/transacionais em instância Supabase descartável.

**Non-Goals:**

- Aprovação/reprovação humana, correções, contador de correções e bloqueio server-side de download de artes pendentes (F56.3).
- Revisor automático de qualidade e reativação da regeneração da F37 no novo fluxo.
- Alterar o pipeline legado, a seleção legada, `MODELS_REGISTRY`, prompts legados, timeout/retry legado.
- Chamada paga, `db push`, deploy ou abertura da chave geral por esta proposta.
- Formatos além de 1:1 (9:16/carrossel são fases próprias).
- Serviços e informativas (F52/F53).

## Decisions

As decisões abaixo são normativas para o planejamento da F56.2 (prefixo `F2-D`). Não reabrem decisões humanas já travadas.

### F2-D1 — Duas chaves de ativação, roteamento server-side e fail-closed

Duas chaves auditáveis no admin, **desligadas por padrão**, lidas server-side antes de qualquer ramo: `new_flow_test_stores_enabled` (lojas com `is_test_store=true`) e `new_flow_all_stores_enabled` (todas as lojas). A decisão de roteamento é exclusivamente server-side, no início do handler de geração.

Precedência proposta (a confirmar): **chave geral tem precedência** porque é superconjunto — se `new_flow_all_stores_enabled` estiver ligada, toda loja elegível usa o novo fluxo; a chave de lojas de teste só decide enquanto a geral estiver desligada. **Qualquer falha de leitura, chave ausente ou desligada mantém o legado** (fail-closed para o novo fluxo, fail-open para o legado). A escolha de persistência (estender `feature_flags` versus tabela dedicada com RPC auditada) fica aberta, mantendo auditoria, motivo e `operation_id` no padrão das RPCs administrativas existentes.

Alternativa considerada: uma única chave com rollout percentual — rejeitada por não atender ao requisito explícito de duas chaves e dificultar a validação em loja de teste.

### F2-D2 — Fluxo congelado por campanha (campanhas já criadas)

Uma campanha **nasce** em um fluxo (novo ou legado) conforme a decisão do momento. Desligar uma chave **não** migra campanhas existentes: uma campanha criada no novo fluxo continua no novo fluxo (usa o snapshot congelado); uma campanha criada no legado permanece no legado (inclusive regras de download anteriores). O roteamento é decidido na **criação**, não em cada render/correção. Isso atende "comportamento de campanhas já criadas" e é a base do rollback: desligar a chave apenas deixa de admitir **novas** campanhas no caminho novo.

### F2-D3 — Seleção explícita de intenção e fundo no formulário, com validação server-side

O formulário de Produto passa a oferecer explicitamente intenção (Oferta/Destaque/Exclusivo) e direção de fundo (Fundo de estúdio / Cenário ambientado / Manter cenário original). A intenção escolhida é **respeitada**, não inferida silenciosamente — o prompt é composto pela intenção selecionada. Erros de seleção (ex.: Original com ≠1 imagem de produto) são **validação de campo** com erro claro, **não** `IMG-001`.

`Manter cenário original` SHALL ser rejeitado no servidor quando o total de imagens de **produto** (papel principal + auxiliares) for diferente de 1; imagens de **identidade** não contam. A regra espelha a bancada (`backgroundDirection === "original"` exige exatamente uma referência de produto) e o schema de produto que já garante exatamente um `role: "primary"`.

Alternativa considerada: derivar fundo de `preserveImageContext` legado — rejeitada por não cobrir Estúdio/Ambientado e por não ser explícito.

### F2-D4 — Runtime de composição de prompt do novo fluxo, incorporado e congelado

Os prompts e regras aprovados na bancada F48.2.6 (Produto v4, compositor v5, as três intenções, direção de fundo) SHALL ser incorporados ao novo fluxo por um **runtime produtivo próprio**, com as versões fixadas em código/constantes versionadas e registradas no snapshot da campanha (`composerVersion`, `promptBaseVersion`, `policyVersions`). O novo fluxo SHALL NOT ler configuração mutável da bancada em tempo de execução nem permitir que a intenção selecionada mude silenciosamente.

Há duas alternativas: (a) **extrair** o domínio puro (`prompt-composer`, `prompt-base`, `policies/*`, `background-direction`) de `src/lib/lab/bench/domain/**` para um módulo compartilhado consumido pela bancada e pelo novo fluxo; (b) **duplicar** o essencial em módulo produtivo. Recomenda-se (a), preservando a bancada como referência e evitando divergência; (b) fica como alternativa se a extração expuser demais a bancada. Decisão de local final em aberto, sem alterar a semântica das políticas.

### F2-D5 — Orquestrador de geração real no caminho novo

Um orquestrador do novo fluxo (server-only) SHALL conduzir a operação real:

1. Resolver a configuração vigente (`resolveImageModelPairConfig`, fail-closed) para **nova campanha**; para correção futura, reutilizar o snapshot original (`resolveConfigForCorrection`).
2. Persistir o **snapshot no início** da operação (F2-D7).
3. Rodar o **preflight de pricing**: cobertura `complete` para principal **e** fallback (`assertImagePairExecutable`), **antes** de reservar crédito e antes de chamar provider. Cobertura incompleta → falha identificável, sem débito e sem provider.
4. Construir o gateway isolado (`createNewFlowImageGateway(pair)`) e **executar a política de tentativas** (`nextImageGenerationAttempt`): até 2 no principal + 1 no fallback; `rate_limit` repete no principal; disponibilidade/capacidade vai direto ao fallback; quota/faturamento não aciona fallback.
5. Emitir **um envelope de telemetria por tentativa** real (modelo, qualidade, alvo, `attemptNumber`, run/trace, resultado) e custo por par (`resolveImagePairCost`).
6. Em sucesso: persistir a arte (F2-D9) e concluir a entrega. Em falha: produzir `buildPublicGenerationFailure` (`IMG-001` + referência) e persistir o diagnóstico durável (`recordDiagnosis`).

O gateway permanece sem retry/fallback internos; a decisão é do orquestrador, como na F56.1.

### F2-D6 — Cobrança: um crédito por campanha entregue, transacional

O novo fluxo SHALL cobrar **um crédito por campanha entregue**, independentemente de tentativas/fallback. "Entrega válida" = arte gerada, persistida e disponível para download. Falha técnica sem arte utilizável **não** debita.

Fluxo transacional proposto: **reservar** 1 crédito no início (idempotente por `operationId`/`campaignId`), **confirmar** ao disponibilizar a arte (marcador idempotente de entrega) e **estornar** quando não houver arte utilizável. Como `confirmCredit` é no-op e a reserva já deduz em v1.5, a "confirmação" é a marca idempotente de que a entrega ocorreu; o estorno restaura o saldo usando a mesma idempotência (`refund_${txId}`), evitando débito duplo em reenvio. A modelagem exata do vínculo reserva↔tentativas↔entrega é decisão técnica aberta, mantendo idempotência e atomicidade testáveis.

### F2-D7 — Snapshot no início + histórico append-only (ressalva F56.1)

O snapshot da configuração SHALL ser persistido **no início da operação real** de uma nova campanha e reutilizado por qualquer nova geração/correção da mesma campanha (`resolveConfigForCorrection`). Alterar o admin depois **não** muda o snapshot.

Para endereçar a ressalva registrada na F56.1: como `run_id`/`trace_id` do snapshot são mutáveis e o vínculo é único por campanha, o registro de **cada geração/tentativa** SHALL viver em estrutura **append-only** (tabela de execuções/tentativas por campanha ou linhas append-only correlacionadas por run/trace), **sem sobrescrever** a única referência histórica. A correlação `correlateSnapshotWithTelemetry` amarra par/tentativa. A forma final (tabela dedicada versus telemetria) é aberta, mas o requisito de não sobrescrever é normativo.

### F2-D8 — Copy não bloqueante e ação de nova tentativa

A copy SHALL NOT bloquear a entrega da arte. O novo fluxo orquestra imagem e copy de forma que a **arte** determine a entrega e o débito. Se apenas a copy falhar: a arte permanece pronta/baixável, o único débito é mantido, e a copy é marcada como **pendente/falha**; a ação "Tentar gerar copy novamente" aparece **somente** nesse estado.

A ação SHALL exigir autenticação e ownership, tentar **apenas os textos** (`campaign_copy`), **não** alterar/regerar a imagem e **não** consumir outro crédito; SHALL ser protegida contra cliques duplicados e repetição abusiva (guard de idempotência/estado) e registrar o custo interno da chamada. Alternativa considerada: manter a copy fatal como no legado — rejeitada pelo contrato explícito.

### F2-D9 — Persistência 1:1 1024×1024 e download direto (legado preservado)

A arte do novo fluxo SHALL ser persistida em 1:1 com **1024×1024 reais**, registrando as **dimensões reais** do arquivo. O sistema SHALL NOT declarar 1080×1080 para um arquivo de 1024×1024.

O download da arte do novo fluxo é **direto**, sem aprovação/reprovação e sem revisor automático (primeira entrega). Campanhas **antigas** mantêm as regras de download anteriores (inclusive o gate `campaign_approval_enabled`), e a flag/regeneração da F37 **não** governa o novo fluxo. A escolha de bucket/prefixo (reusar `campaign-images` com prefixo próprio, preservando imutabilidade, versus bucket dedicado) fica aberta.

### F2-D10 — Verificação isolada e autorização de geração paga

Os gates transacionais SHALL rodar em **instância Supabase descartável comprovadamente isolada**, preservando a stack compartilhada e as evidências F48/F56.1. UAT visual e uma geração paga controlada em loja de teste ocorrem **somente** após autorização humana específica e com pricing completo. O fechamento local da fase é separado da futura aplicação de migrations remotas, deploy e abertura da chave geral. Nenhuma inferência de autorização para `db push`/produção.

### F2-D11 — Recorte em planos (anti-monólito)

Se o recorte exigir **mais de 8–10 planos**, a divisão proposta é: **F56.2a** — ativação + intent/fundo + composição de prompt + orquestração mínima com snapshot/preflight/política/`IMG-001`; **F56.2b** — crédito transacional + copy recuperável + download + histórico/telemetria. A confirmação do recorte é do responsável **antes** de planejar, para não transformar a F56.2 em fase monolítica por conveniência.

## Risks / Trade-offs

- **[Ativar o fluxo errado por flag]** → default desligado/fail-closed, roteamento server-side, testes de precedência e de falha de leitura.
- **[Cobrança dupla ou de falha técnica]** → reserva/estorno idempotentes, entrega só com arte utilizável e testes transacionais na instância isolada.
- **[Copy travar a entrega]** → sucesso parcial com estado pendente/falha e ação de nova tentativa sem novo crédito.
- **[Prompt divergente da bancada aprovada]** → extração versionada, versões no snapshot e testes de fidelidade; sem leitura mutável da bancada.
- **[Sobrescrever o run/trace histórico em correção futura]** → histórico append-only por tentativa; snapshot imutável.
- **[Regressão no legado]** → ramo novo aditivo atrás de chave, runtime próprio, testes de fronteira e `git diff` dos caminhos legados.
- **[Divergência 1080×1080 vs 1024×1024]** → persistir dimensões reais e não declarar 1080×1080 (a saída nova é 1024×1024, divergindo do contexto genérico do design system).
- **[Qualidade de sunburst/medium]** → decisão humana, fallback definido, sem garantia universal.
- **[Fase grande virar monólito]** → divisão F56.2a/F56.2b proposta em F2-D11.

## Migration Plan

1. Criar as mudanças de schema localmente (chaves de ativação + auditoria; estrutura append-only de execuções/tentativas; estado de copy pendente; dimensões reais da arte, se necessário), sem `db push`.
2. Implementar runtime de composição, orquestrador, preflight, crédito transacional, ação de copy, download e roteamento por chave; rodar typecheck/lint/build e testes locais (sem chamada paga).
3. Gates transacionais e UAT local em instância Supabase descartável comprovadamente isolada; validação de não regressão do legado.
4. **Autorização humana específica** → UAT visual + uma geração paga controlada em loja de teste, com pricing completo.
5. Aplicação da migration no remoto e deploy **somente** em etapa posterior e autorizada; depois, abertura da chave geral.
6. **Rollback:** desligar as chaves restaura o legado sem tocar campanhas existentes; estruturas novas são aditivas.

## Open Questions

- Precedência das chaves: geral sobre teste (recomendado em F2-D1) ou teste sobre geral? Confirmar.
- Onde residirá o runtime de composição (extração do domínio da bancada versus módulo produtivo novo) — F2-D4.
- Forma de persistência do vínculo por tentativa (tabela dedicada versus linhas append-only em telemetria) — F2-D7.
- Modelagem transacional do vínculo reserva↔entrega↔estorno para idempotência — F2-D6.
- Bucket/prefixo da arte nova (reusar `campaign-images` imutável versus bucket dedicado) — F2-D9.
- Mecanismo (tabela de flags versus dedicada + RPC) das duas chaves — F2-D1.
- Confirmação do recorte F56.2a/F56.2b antes de planejar — F2-D11.
