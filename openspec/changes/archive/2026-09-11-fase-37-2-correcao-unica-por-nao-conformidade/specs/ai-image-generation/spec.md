# AI Image Generation

## Purpose

Evolução da capability `ai-image-generation` pela **F37.2 realinhada — Correção Única por Não Conformidade** (D37.2-R3/R4). A F37.2 **não altera** a rota `POST /api/campaign/generate-image` nem o comportamento default do `ImageGenerationService`. Ela acrescenta suporte **aditivo e opcional** usado apenas pelo fluxo corretivo (`problem-report` → geração da v2): (1) um **hook opcional `onBeforeImageProviderCall`** no serviço, disparado **imediatamente antes da 1ª chamada real ao provider** (dentro de `generateWithRetry`, iteração `attempt===0`) — é o ponto que invoca a RPC de consumo da oportunidade (R3); ausência do hook = comportamento atual inalterado. (2) A montagem do prompt da v2 usa o **diretor por intent atual** (`campaign-image-director-{offer|spotlight|exclusive}`, F31.2/F45) **+ um bloco pequeno e único de não conformidade** (instrução normalizada saneada + preâmbulo fixo anti-invenção e de fidelidade ao briefing) acrescentado **em tempo de montagem** — mesmo padrão dos blocos condicionais já usados pelo `assemblePrompt` — **sem duplicar os três prompts e sem editar os arquivos `.md`** (diff vazio). O revisor automático e o prompt `campaign-image-reviewer` permanecem **intocados**; a v2 passa pela mesma revisão de qualidade (rede de segurança). `input_validation` é emitida como `skipped` via override `brief_review_confirmed` (F43), sem revalidação de visão.

## ADDED Requirements

### Requirement: Hook aditivo onBeforeImageProviderCall (consumo da oportunidade)

O sistema SHALL suportar um **hook opcional e aditivo** no `ImageGenerationService` para disparar a RPC de consumo no instante exato em que a 1ª chamada ao provider começa (R3/R4):

- `ImageGenerationService.generateImage` (ou mecanismo equivalente de execução) aceita um callback assíncrono opcional, ex.: `onBeforeImageProviderCall?: () => Promise<void>`.
- O hook SHALL rodar **imediatamente antes da 1ª tentativa real ao provider** em `generateWithRetry` (iteração `attempt === 0`), **fire-once por execução de `generateImage`**.
- O hook é o ponto que invoca `rpc("consume_campaign_correction_opportunity", ...)` no fluxo corretivo; falhas que ocorrem **antes** do hook (preflight, montagem de contexto, validação de prompt) **não** consomem (caso permanece `open`; pode reenviar).
- **Ausência do hook → comportamento atual inalterado** (rota `generate-image` e demais chamadores não são afetados).

#### Scenario: Hook disparado antes do primeiro provider call

- **WHEN** o fluxo corretivo chama `generateImage` com `onBeforeImageProviderCall` informado
- **THEN** o hook roda imediatamente antes da 1ª chamada ao provider (iteração `attempt === 0`)
- **AND** roda uma única vez por execução (não re-dispara em retries internos/regerações do state machine)

#### Scenario: Sem hook o comportamento é o atual

- **WHEN** a rota `generate-image` (fluxo normal) chama `generateImage` sem o hook
- **THEN** nenhum callback adicional roda e o comportamento atual é exatamente o mesmo

#### Scenario: Falha pré-provider não dispara o hook

- **WHEN** uma falha ocorre antes do ponto do hook (preflight/montagem/validação)
- **THEN** o hook não roda (não consome) e o caso permanece `open`

### Requirement: Bloco único de não conformidade na montagem do diretor (v2)

O sistema SHALL compor o prompt da **v2** com o **diretor por intent atual + um bloco único de não conformidade**, sem novos arquivos `.md` e sem editar os existentes (R4):

- Diretor selecionado por `commercial.intent` do snapshot (`campaign-image-director-{offer|spotlight|exclusive}` — pipeline atual).
- Um bloco pequeno e único é acrescentado em tempo de montagem (padrão dos blocos condicionais do `ImageGenerationService.assemblePrompt`), contendo: preâmbulo fixo anti-invenção e de fidelidade ao briefing + a **instrução normalizada** (`normalizedInstruction`, saneada/delimitada como conteúdo não confiável — R2).
- O bloco **declara o defeito a evitar** e **nunca** altera produto/preço/validade/aviso/identidade nem reabre decisões aprovadas.
- **Sem `candidateArtDataUrl`**: a v1 não é enviada ao diretor como referência visual.
- Os 4 `.md` atuais (`campaign-image-director.md`/`-offer`/`-spotlight`/`-exclusive`) permanecem com **diff vazio** (verificado em teste).

#### Scenario: Montagem da v2 com bloco de não conformidade e diff vazio nos .md

- **WHEN** o fluxo corretivo monta o prompt da v2
- **THEN** o prompt usa o diretor por intent do snapshot acrescido do bloco único (preâmbulo + instrução normalizada saneada)
- **AND** os arquivos `.md` atuais não são alterados (diff vazio)
- **AND** nenhuma data URL da v1 é passada como referência

#### Scenario: Conteúdo não confiável não sobrescreve o briefing

- **WHEN** a `normalizedInstruction` contém texto sensível ou dados divergentes
- **THEN** o bloco apenas instrui evitar o defeito (delimitado/saneado)
- **AND** produto/preço/validade/aviso/identidade do briefing permanecem imutáveis (anti-invenção)

### Requirement: V2 reaproveita o mecanismo de skip do input_validation (F43)

O sistema SHALL, na geração da v2, **emitir `input_validation` como `skipped`** reutilizando o override `brief_review_confirmed` (F43) — sem nova chamada de visão e sem reavaliar o produto contra o nome (brief já aprovado na revisão pré-geração):

- A fase `input_validation` da v2 é emitida com `status: "skipped"`.
- Revisor automático da qualidade (`image-review-service` + prompt `campaign-image-reviewer`) permanece **intocado** e roda como rede de segurança sobre a v2.
- **Sem copy director**: a v2 regenera somente a arte; copy não é reprocessado (F17).

#### Scenario: input_validation skipped na v2

- **WHEN** a geração corretiva (v2) roda
- **THEN** a fase `input_validation` é emitida como `skipped` (override `brief_review_confirmed`)
- **AND** nenhuma chamada de visão valida o produto contra o nome
- **AND** a v2 passa pela revisão de qualidade automática existente

### Requirement: Eventos da v2 no mesmo operation_run_id (sem nova operação financeira)

O sistema SHALL registrar os eventos call-level da geração da v2 **sob o mesmo `operation_run_id` da campanha** (rastro F38.2), **sem** nova reserva de crédito, **sem** `credit_transactions` e **sem** `operation_key` nova:

- A v2 é parte da mesma entrega (1 crédito = 1 campanha aprovada); o custo aparece como mais eventos do mesmo run no painel F38.2.
- Contabilidade F38/F38.2 e o mecanismo de crédito F24/F25 permanecem intactos.

#### Scenario: Eventos da v2 no mesmo run da campanha

- **WHEN** a v2 é gerada
- **THEN** os eventos call-level usam o `operation_run_id` persistido da campanha original
- **AND** nenhuma nova `credit_transactions`/`operation_key` é criada
