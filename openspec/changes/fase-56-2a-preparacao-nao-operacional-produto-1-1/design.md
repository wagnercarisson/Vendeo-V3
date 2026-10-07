## Context

A change original `fase-56-2-novo-fluxo-geracao-produto-1-1` especificou a F56.2 inteira (13 specs e 57 tasks — **total da change original**, não de uma fatia). O responsável aprovou o recorte em três fatias executáveis: **F56.2a** (preparação não operacional), **F56.2b1** (núcleo ponta a ponta) e **F56.2b2** (copy recuperável e piloto). Esta change é a F56.2a e contém **5 specs** (3 novas + 2 deltas).

Estado relevante:

- A F56.1 (arquivada em 2026-10-06) entregou componentes puros/server-only: `image-model-pair`, `image-model-pair-config-service`, `image-generation-config-snapshot` (componente), `image-generation-failure-policy`, `image-generation-support-reference`, `image-generation-diagnosis-repository`, `upstream-images`/`upstream-images-runtime`, `image-pair-pricing`, capacidade `campaign_product_image`, tabela `image_generation_config_snapshots` (com `run_id`/`trace_id` mutáveis) e `image_generation_failure_diagnoses`.
- Os prompts/políticas aprovados na bancada F48.2.6 são **estáticos e pinados** em `src/lib/lab/bench/domain/**` (`COMPOSER_VERSION=48.2.4-prompt-composer-v5`, `PRODUTO_POLICY_VERSION=48.2.6-produto-v4`, `BENCH_DEFAULT_PROMPT_BASE_VERSION=48.2.6-produto-1-1-v1`) e **não** são consumidos pela produção.
- As chaves operacionais vivem em `feature_flags` (`20260821000001_f43_create_feature_flags.sql`) com RPC auditada `admin_update_feature_flag`.
- Decisões do responsável já incorporadas (não reabrir): chave geral prevalece; usar `feature_flags` + RPC auditada; módulo produtivo versionado com testes de equivalência; relação append-only própria; `campaign-images` com prefixo próprio (a partir da F56.2b1); vínculo reserva/entrega/estorno por identidade estável (F56.2b1); falha de leitura mantém legado sem reinterpretar campos novos como legados; 1024×1024; `IMG-001` só para falhas operacionais; copy sem novo crédito (custo interno registrado); reuso do snapshot é contrato arquitetural sem implementar a F56.3.

A F56.2a é **preparação inativa**: nada é servido ao lojista, nada chama provider, nada reserva crédito, nada entrega, nada baixa.

## Goals / Non-Goals

**Goals:**

- Domínio/componentes (inativos) de seleção de intenção e fundo, com a regra de Original.
- Módulo produtivo versionado de composição dos prompts aprovados, com equivalência à bancada.
- Estrutura append-only de operações/tentativas + contrato de reuso do snapshot.
- Registro das duas chaves desligadas por padrão + decisão server-side fail-closed testável.
- Barreira que impede a chave de encaminhar campanhas reais.

**Non-Goals:**

- Rota de geração real, provider, crédito, entrega, download (F56.2b1).
- Interface de ativação efetiva e roteamento real (F56.2b1).
- Aprovação/reprovação, correção, contador, regeneração F37 (F56.3).
- Alterar a bancada F48.2.6 ou o fluxo legado.

## Decisions

### A-D1 — Duas chaves em `feature_flags`, desligadas por padrão, sem ativação efetiva

As duas chaves SHALL ser registradas em `feature_flags` (uma para `is_test_store=true`, outra para todas as lojas), desligadas por padrão, alteráveis pela RPC auditada existente (`admin_update_feature_flag`). A **interface de ativação efetiva** e o **roteamento real** pertencem à F56.2b1; nesta fatia a chave SHALL NOT encaminhar campanhas reais.

Alternativa considerada: tabela dedicada + RPC própria — rejeitada por duplicar infraestrutura já existente e auditada.

### A-D2 — Decisão server-side pura, fail-closed, com precedência da chave geral

A função de decisão SHALL ser server-side e pura/testável: se a leitura falhar, chave ausente ou desligada → legado; se a chave geral estiver ligada → todas as lojas elegíveis; senão, a chave de lojas de teste decide. **A chave geral prevalece** (decisão fechada; não é questão aberta).

Alternativa considerada: decisão no cliente — rejeitada por segurança.

### A-D3 — Seletores como domínio + componentes inativos

Os contratos/componentes de seleção de intenção (Oferta/Destaque/Exclusivo) e fundo (Estúdio/Ambientado/Original) SHALL existir como domínio puro e componentes, **sem** serem montados no fluxo produtivo do lojista nesta fatia. A regra "Original exige exatamente uma imagem de produto" (identidade não conta) SHALL viver no domínio, com erro de campo (nunca `IMG-001`). A montagem no formulário de produção é da F56.2b1.

Alternativa considerada: montar direto no formulário — rejeitada por expor ao lojista um caminho incompleto.

### A-D4 — Módulo produtivo de composição versionado e congelado

A composição SHALL viver em módulo **produtivo próprio**, com versões fixadas (compositor, base de prompt, políticas), **sem** ler configuração mutável da bancada em runtime e **sem** alterar as políticas validadas da bancada. Testes de **equivalência** SHALL comparar a saída do módulo produtivo com a da bancada aprovada nos casos representativos.

Alternativa considerada: reaproveitar o domínio da bancada como dependência de runtime — rejeitada por acoplar produção ao laboratório.

### A-D5 — Estrutura append-only de operações/tentativas + contrato de reuso do snapshot

SHALL existir uma relação append-only própria de operações/tentativas, vinculada à **campanha** e ao **snapshot original da mesma campanha**; uma tentativa que combine dois IDs existentes de campanhas distintas SHALL ser rejeitada no INSERT. A validação de pertencimento SHALL ser somente leitura e não modificar a tabela/snapshot original. A relação não sobrescreve o `run_id`/`trace_id` do snapshot único (ressalva registrada na F56.1). O contrato `resolveConfigForCorrection` (reuso do snapshot original) SHALL ser preservado e testado. A **persistência operacional** dessas estruturas em geração real é da F56.2b1; a F56.2a entrega a estrutura e o contrato.

Alternativa considerada: reutilizar `generation_events` — rejeitada por não expressar tentativa/operação do novo fluxo nem correlação com o snapshot.

### A-D6 — Falha de leitura mantém legado sem reinterpretar campos novos

Quando a leitura das chaves falhar, o fluxo legado SHALL ser mantido **sem** reinterpretar campos exclusivos do novo formulário (intenção/fundo explícitos) como campos legados. Nesta fatia a regra é contratual/testável; a integração efetiva é da F56.2b1.

### A-D7 — Verificação isolada

Testes/migrações/resets SHALL rodar apenas em instância Supabase descartável comprovadamente isolada, preservando a stack compartilhada e as evidências F48/F56.1.

## Risks / Trade-offs

- **[Ativação acidental]** → chaves desligadas por padrão, sem interface efetiva na F56.2a e teste explícito de que a chave não roteia campanhas reais.
- **[Divergência entre módulo produtivo e bancada]** → testes de equivalência nos casos representativos.
- **[Acoplamento produção↔laboratório]** → módulo próprio; bancada não é dependência de runtime.
- **[Sobrescrita do histórico em correção futura]** → append-only + snapshot imutável + invariante testado.
- **[Associação cruzada campanha/snapshot]** → trigger `BEFORE INSERT` na nova relação rejeita o vínculo quando ambos os IDs existem mas o snapshot pertence a outra campanha; FKs continuam tratando IDs inexistentes separadamente.
- **[Regressão no legado]** → mudanças aditivas/inativas; `git diff` dos caminhos legados.

## Migration Plan

1. Estrutura local (relação append-only; registro das chaves em `feature_flags`), sem `db push`.
2. Módulo de composição + domínio/componentes de seleção + função de decisão; typecheck/lint/build/testes locais.
3. UAT local sem provider na instância isolada; não-ativação verificada.
4. Migration remota/deploy somente em etapa posterior autorizada.

## Open Questions

- Nomes literais das duas chaves (recomendado: `product_1_1_test_stores_enabled` e `product_1_1_all_stores_enabled`).
- Se os componentes de seleção são apenas apresentacionais (recomendado: domínio + apresentacional, sem wiring) — decisão de baixo risco.
