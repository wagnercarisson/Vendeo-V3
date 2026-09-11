# Campaign Correction Analysis

> Synced from `fase-37-2-correcao-unica-por-nao-conformidade` (ADDED).

## Purpose

Serviço de **IA textual** que analisa o relato do lojista (F37.2 realinhada — D37.2-R2). O serviço (`src/lib/campaign/correction-intent-service.ts`) usa a abstração de texto existente (`createTextProvider`), **entende o relato** e **tolera erros de escrita** (digitação, concordância, abreviação), mas **NÃO lê a imagem** — decide apenas a **intenção da declaração** (não se o lojista "está dizendo a verdade"). Classifica em **elegível | bloqueado | não-claro** e, quando elegível, produz uma **instrução normalizada** (objetiva, sem ruído de digitação) que orienta o diretor. **Nunca altera dados do briefing** — o relato é só texto (R4). Contrato de saída: **system prompt pedindo JSON estrito → `JSON.parse` defensivo → validação Zod discriminada** (o schema é o contrato; sem depender de `jsonMode`/`response_format` portável). **Fix 01a7021b:** o schema é **discriminado por `analysisState`** — `eligible` exige `category` válida + `normalizedInstruction` não vazia e tem `guidance` **opcional/nullable**; `blocked`/`unclear` exigem `guidance` amigável e aceitam `category`/`normalizedInstruction` **ausentes ou null**. JSON inválido → `analysis_failed` com telemetria `json_parse_failed`; fora do schema → `analysis_failed` com `schema_validation_failed` (**nunca** rebaixado a `unclear`); timeout/transporte/vazio → `analysis_failed`. Conteúdo não confiável (texto do lojista e `normalizedInstruction`) é **delimitado e saneado** (padrão `sanitizePromptText`) e incapaz de sobrescrever o briefing.

## Requirements

### Requirement: Análise textual de elegibilidade do relato (CorrectionIntentService)

O sistema SHALL prover um serviço (`src/lib/campaign/correction-intent-service.ts`) que analisa o relato textual do lojista via `createTextProvider()`:

- Recebe o `text` do relato (submissão válida).
- Usa `TextProvider.generateText(prompt, { system, temperature, maxTokens, signal })` — **sem `jsonMode`**: o contrato é **system prompt pedindo JSON estrito → `JSON.parse` defensivo → validação Zod** (schema de saída = contrato; providers podem usar `response_format` quando disponível, mas nada depende disso).
- **Entende o relato** em linguagem simples, tolerando erros de escrita.
- **NÃO lê a imagem** — não valida a veracidade da declaração; classifica a intenção.
- Retorna o estado de análise (`eligible | blocked | unclear`) validado por **schema Zod discriminado por `analysisState`**: `eligible` com `category` válida + `normalizedInstruction` não vazia e `guidance` **opcional**; `blocked`/`unclear` com `guidance` não vazia e `category`/`normalizedInstruction` **ausentes ou null**. Campos desconhecidos são rejeitados (`.strict()`).
- **Regra de prioridade (fix 01a7021b):** um defeito objetivo explicitamente relatado tem prioridade sobre o **verbo** usado para corrigi-lo — "logo cortado, reposicione" é `eligible`, não pedido estético.

#### Scenario: Relato elegível gera estado + categoria + instrução normalizada

- **WHEN** o lojista descreve "o preço tá cortado na borda" (com erro de escrita)
- **THEN** o serviço retorna `analysisState: "eligible"` com categoria (ex.: `truncated_element`) e uma `normalizedInstruction` objetiva sem ruído de digitação
- **AND** a análise é feita sobre o texto (nenhuma imagem é enviada ao provider)

#### Scenario: Defeito objetivo tem prioridade sobre o verbo de correção

- **WHEN** o lojista relata um defeito objetivo com verbo de correção (ex.: "o logotipo do mercado ficou mal posicionado e cortado, reposicione respeitando o respiro"; "o texto está encostado na borda, afaste"; "o produto ficou deformado, refaça")
- **THEN** o serviço classifica como `eligible` com a `category` correspondente (`truncated_element`/`deformed_product`/…)
- **AND** **não** classifica como `blocked` apenas porque o pedido usa "reposicione"/"afaste"/"refaça"
- **AND** a IA classifica a intenção declarada, sem tentar confirmar visualmente se o relato é verdadeiro

#### Scenario: Elegível sem guidance é aceito

- **WHEN** o provider devolve `{"analysisState":"eligible","category":"truncated_element","normalizedInstruction":"…"}` **sem** `guidance` (ou com `guidance: null`)
- **THEN** o serviço mantém `analysisState: "eligible"` (guidance é opcional em elegível)
- **AND** **não** rebaixa para `unclear`

#### Scenario: Relato bloqueado retorna orientação

- **WHEN** o lojista pede algo fora da política (ex.: "muda o preço pra 90", "não gostei, faz outra opção")
- **THEN** o serviço retorna `analysisState: "blocked"` com orientação específica do motivo
- **AND** nada é gerado nem consumido

#### Scenario: Relato pouco claro retorna orientação com exemplo

- **WHEN** a intenção não é determinável como elegível nem bloqueada
- **THEN** o serviço retorna `analysisState: "unclear"` com orientação e exemplo ("pode ser algo como: o preço saiu cortado / o texto está ilegível / o nome do produto está errado")
- **AND** nada é gerado nem consumido
- **AND** o lojista pode reformular imediatamente (janela de tentativas aberta)

### Requirement: Taxonomia de defeitos elegíveis e política bloqueada

O sistema SHALL classificar o relato conforme a política da F37.2 (alinhamento §4):

- **Elegível** (defeito objetivo da geração): elemento obrigatório cortado; logo/produto/texto gravemente cortados; texto ilegível/corrompido; dado divergente do briefing aprovado (nome/preço/validade/aviso); informação inventada; texto/badge/elemento duplicado; produto deformado; falha grave de composição que impeça a publicação.
- **Bloqueado** (não é elegível): alterar qualquer dado aprovado na revisão pré-geração; mudar preço/validade/produto/badge/fundo/identidade por preferência; reposicionar/reestilizar elementos sem defeito; "não gostei"/"faz outra opção"/"quero outro visual"; rebriefing/mudança estética.
- Cada categoria elegível deve ter um identificador estável (`category`) na taxonomia.

#### Scenario: Categorias elegíveis mapeadas

- **WHEN** o relato descreve um defeito objetivo (cortado, ilegível, divergente, inventado, duplicado, deformado, composição impeditiva)
- **THEN** o serviço classifica como `eligible` com a `category` correspondente

#### Scenario: Pedidos de preferência ou edição de dados são bloqueados

- **WHEN** o relato pede mudança de preço/validade/produto por preferência, "outra opção" ou rebriefing
- **THEN** o serviço classifica como `blocked`
- **AND** a orientação explica que o relato de defeito não é canal de edição e que preferência estética gera nova campanha

### Requirement: Tratamento de saída fora do contrato e falhas de transporte

O sistema SHALL tratar respostas do provider que não seguem o contrato:

- **JSON inválido** → tratado como `analysis_failed` com telemetria `errorType: "json_parse_failed"` (status `failed`) — **não** vira conclusão semântica `unclear` (fix 01a7021b).
- **Fora do schema Zod** → tratado como `analysis_failed` com telemetria `errorType: "schema_validation_failed"` (status `failed`).
- **Falha de transporte/timeout/resposta vazia** → tratada como `analysis_failed` (registrada na linha da tentativa com `completed_at`; conta como tentativa; não consome).
- A telemetria do evento registra `provider`, `model`, `errorType` e `attemptNumber` (sem persistir conteúdo bruto sensível).

#### Scenario: JSON inválido/schema inválido vira analysis_failed com telemetria

- **WHEN** o provider devolve texto livre (JSON inválido)
- **THEN** o serviço trata como `analysis_failed` e registra `errorType: "json_parse_failed"` (status `failed`)
- **WHEN** o provider devolve JSON fora do schema Zod
- **THEN** o serviço trata como `analysis_failed` e registra `errorType: "schema_validation_failed"`
- **AND** nada é gerado nem consumido; a falha técnica **não** é apresentada como conclusão semântica "não claro"

#### Scenario: Falha de transporte/timeout vira analysis_failed

- **WHEN** o provider falha por transporte, timeout ou devolve resposta vazia
- **THEN** o serviço trata como `analysis_failed`
- **AND** a tentativa é registrada como finalizada (`completed_at`) e não consome a oportunidade
- **AND** a tentativa conta para a janela de rate limit (limite absoluto de 3/30min — 4ª bloqueada mesmo após `analysis_failed`)

### Requirement: Conteúdo não confiável delimitado e incapaz de sobrescrever o briefing

O sistema SHALL tratar o **texto do lojista** e a **`normalizedInstruction`** como **conteúdo não confiável**:

- Ao compor o bloco do diretor (R4), ambos são **delimitados e saneados** (padrão `sanitizePromptText`/delimitadores já usados no pipeline).
- O bloco **nunca sobrescreve o briefing**: apenas declara o defeito a evitar — não altera produto/preço/validade/aviso/identidade nem reabre decisões aprovadas (anti-invenção).
- O relato de defeito **não** é canal de edição de dados aprovados.

#### Scenario: Instrução normalizada saneada e sem vazamento de placeholder

- **WHEN** a `normalizedInstruction` contém caracteres tipo chaves ou delimitares
- **THEN** o bloco do diretor é montado com o texto saneado (sem placeholder não resolvido, sem quebra de delimitador)
- **AND** o briefing aprovado permanece imutável

### Requirement: Custo da análise registrado no mesmo operation_run_id (instrumentação mínima)

O sistema SHALL registrar o custo da chamada de IA textual da análise como **evento call-level no mesmo `operation_run_id` da campanha** (hardening de revisão — achado 4), para que o custo real da entrega (imagem v1/v2 + análise) seja observável na contabilidade existente:

- A cada chamada de `TextProvider.generateText` da análise, registrar via `AiCostTracker.record` um evento com: `operationRunId` = `operation_run_id` da campanha, `operationRunType: "campaign_delivery"`, `generationType` **novo** (`campaign_correction_analysis`), **`provider` = `textProvider.name`** (o `TextProviderResult` só devolve `model`/`usage`; o provider vem de `TextProvider.name` — sem alterar a abstração), `model`/`usage` do `TextProviderResult`, `durationMs`, `status` (`success`/`failed`), `errorType` quando aplicável, `campaignId`/`storeId`/`userId`, **`attemptNumber` = `attempt_number` da submissão** (ordenação determinística do relato — achado 3), e custo resolvido por `resolveAiCost` (mesma cadeia de fontes da rota `generate-image`).
- Requer: novo literal no union `GenerationEventType` (`src/lib/visual-signature/types.ts`) **+ evolução idempotente do CHECK `chk_generation_events_type`** (bloco `DROP/ADD` no padrão das migrations F38.1/F44.1) **+ delta MODIFIED da capability `ai-cost-tracker`** (fonte normativa do contrato `generationType`/`AiCostEvent` — achado 4).
- **Sem** nova reserva de crédito, sem `credit_transactions`, sem `operation_key` nova; **sem** alteração em telas/admin, agregações financeiras ou cálculos existentes. O registro é best-effort (padrão `AiCostTracker.record` — nunca derruba o fluxo).
- A melhoria ampla da contabilidade (ex.: expor/agregar o novo tipo no painel F38.2, custo por tentativa de análise) fica para **fase futura**.

#### Scenario: Evento call-level da análise registrado no mesmo run

- **WHEN** a análise textual roda para um relato de uma campanha
- **THEN** um evento `campaign_correction_analysis` é registrado com `provider` (de `TextProvider.name`), `model`/`usage` do `TextProviderResult` e `attemptNumber` da submissão sob o `operation_run_id` da campanha
- **AND** nenhuma `credit_transactions`/`operation_key` nova é criada e nenhuma tela/cálculo financeiro é alterado

#### Scenario: Falha de transporte registra status failed

- **WHEN** a chamada de análise falha (timeout/transporte/vazio)
- **THEN** o evento é registrado com `status: "failed"`/`errorType` sob o mesmo `operation_run_id`
- **AND** o fluxo continua (registro best-effort)
