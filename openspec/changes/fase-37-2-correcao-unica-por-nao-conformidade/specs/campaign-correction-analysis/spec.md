# Campaign Correction Analysis

## Purpose

Serviço de **IA textual** que analisa o relato do lojista (F37.2 realinhada — D37.2-R2). O serviço (`src/lib/campaign/correction-intent-service.ts`) usa a abstração de texto existente (`createTextProvider`), **entende o relato** e **tolera erros de escrita** (digitação, concordância, abreviação), mas **NÃO lê a imagem** — decide apenas a **intenção da declaração** (não se o lojista "está dizendo a verdade"). Classifica em **elegível | bloqueado | não-claro** e, quando elegível, produz uma **instrução normalizada** (objetiva, sem ruído de digitação) que orienta o diretor. **Nunca altera dados do briefing** — o relato é só texto (R4). Contrato de saída: **system prompt pedindo JSON estrito → `JSON.parse` defensivo → validação Zod** (o schema é o contrato; sem depender de `jsonMode`/`response_format` portável). Resposta com JSON inválido/fora do schema → `unclear`; timeout/transporte/vazio → `analysis_failed`. Conteúdo não confiável (texto do lojista e `normalizedInstruction`) é **delimitado e saneado** (padrão `sanitizePromptText`) e incapaz de sobrescrever o briefing.

## ADDED Requirements

### Requirement: Análise textual de elegibilidade do relato (CorrectionIntentService)

O sistema SHALL prover um serviço (`src/lib/campaign/correction-intent-service.ts`) que analisa o relato textual do lojista via `createTextProvider()`:

- Recebe o `text` do relato (submissão válida).
- Usa `TextProvider.generateText(prompt, { system, temperature, maxTokens, signal })` — **sem `jsonMode`**: o contrato é **system prompt pedindo JSON estrito → `JSON.parse` defensivo → validação Zod** (schema de saída = contrato; providers podem usar `response_format` quando disponível, mas nada depende disso).
- **Entende o relato** em linguagem simples, tolerando erros de escrita.
- **NÃO lê a imagem** — não valida a veracidade da declaração; classifica a intenção.
- Retorna o estado de análise (`eligible | blocked | unclear`) + `category` (quando elegível) + `normalizedInstruction` (quando elegível) + `guidance` (orientação para `blocked`/`unclear`).

#### Scenario: Relato elegível gera estado + categoria + instrução normalizada

- **WHEN** o lojista descreve "o preço tá cortado na borda" (com erro de escrita)
- **THEN** o serviço retorna `analysisState: "eligible"` com categoria (ex.: `truncated_element`) e uma `normalizedInstruction` objetiva sem ruído de digitação
- **AND** a análise é feita sobre o texto (nenhuma imagem é enviada ao provider)

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

- **JSON inválido ou fora do schema Zod** → tratado como `unclear` (orientação com exemplo; sem gerar, sem consumir).
- **Falha de transporte/timeout/resposta vazia** → tratada como `analysis_failed` (registrada na linha da tentativa com `completed_at`; conta como tentativa; não consome).

#### Scenario: JSON inválido vira unclear

- **WHEN** o provider devolve texto livre ou JSON fora do schema
- **THEN** o serviço trata como `unclear`
- **AND** nada é gerado nem consumido

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
