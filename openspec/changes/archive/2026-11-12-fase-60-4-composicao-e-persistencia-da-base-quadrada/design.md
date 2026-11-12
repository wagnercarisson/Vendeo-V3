## Context

A F60 define a operação 9:16 em duas etapas (`base` e `expansion`) com identidade `(campaign_id, operation_id)`, autorização de execução única, política de tentativas da base (até 2 no principal + 1 no fallback, máximo 3 chamadas) e autoridade financeira em `product_1_1_campaign_credit_operations`. A F60.1 já persiste e recupera `square_original` 1024×1024, `square_prepared` 1152×1152 e `vertical` 1080×1920 com identidade, checksum, proveniência, evidência durável e imutabilidade. A F60.3 já consome `square_prepared` e produz `vertical`.

Falta a **etapa `base` executável**: compor a copy e a arte quadrada, congelar a configuração, chamar o provider uma vez por tentativa autorizada e persistir o `square_original`. Hoje essa lógica existe apenas dentro de `runProductOneToOneGeneration`, que também reserva/confirma/estorna crédito, emite resposta pública NDJSON e entrega a campanha. Reutilizá-lo como atalho misturaria responsabilidades e criaria um segundo dono desses efeitos.

Esta fatia entrega somente o módulo interno da base quadrada. O orquestrador 9:16, a expansão, a preparação 1152, a entrega e a ativação permanecem fora.

### Mapa de reaproveitamento (restrições verificadas)

| Necessidade | Módulo existente | Lacuna real / restrição verificada |
|---|---|---|
| Prompt 1:1 | `composeProductPrompt`, `PRODUCT_1_1_PROMPT_BASE`, políticas atuais | Nenhuma. O módulo monta o mesmo input (briefing, referências, contribuições de identidade, anexos) e não altera prompt/compositor. |
| Configuração congelada | `runNewFlowPreflight`, `buildProductOneToOneSnapshot`, `buildProductOneToOneFrozenEvidence`, `resolveConfigForCorrection` | Lacuna comprovada: o preflight resolve a configuração **vigente**, mas a retomada não pode trocar de configuração. Falta um leitor read-only do snapshot/evidência congelados e uma comparação explícita entre o conteúdo recebido e o congelado. |
| Persistência do snapshot/evidência | `persistProductOneToOneSnapshot` (RPC `product_1_1_persist_snapshot_with_binding`), `computeContentFingerprint` | Nenhuma escrita nova, mas há restrição real: snapshot é único por campanha; binding e evidência são únicos **por snapshot** (`snapshot_original_id` é PK/UNIQUE). Logo, cada snapshot pertence a UMA operação. Config/conteúdo divergente ou snapshot já vinculado a outra operação bloqueia antes do provider. |
| Copy | `createDefaultProductOneToOneCopyOps`, `ProductOneToOneCopyAcquisitionClient`, `drainCopyTask`, `recordCopyState`, `readCopyDelivery` | Lacuna comprovada: o gateway padrão da copy usa adapters textuais que constroem o SDK OpenAI sem `maxRetries: 0`, então uma execução do runner não prova uma única requisição ao provider. Restrição real: copy é por `(campaign_id, operation_id)`, com até 6 tentativas (3 auto + 3 manual), `completed` é terminal e a RPC de aquisição trava a linha de crédito quando ela existe. |
| Gateway/adapter de imagem | `AiGateway`, `NewFlowImageModelResolver`, `UpstreamImagesAdapter`, `createOpenAiImagesSdkLoader` | Lacuna comprovada: o runtime 1:1 usa o loader padrão sem `maxRetries`, permitindo retry HTTP oculto. O módulo compõe o gateway com `maxRetries: 0` e `preserveUsageWithoutImage: true` usando as opções aditivas já existentes da F60.3, sem alterar o runtime 1:1. |
| Conversão JPEG 1024 | `dataUrlToCampaignImage`, `resizeToJpeg1024` | Nenhuma. O resultado continua sendo JPEG 1024×1024; a F60.1 revalida por conteúdo. |
| Persistência/recuperação `square_original` | `persistCompositionArtifact`, `retrieveCompositionArtifact`, `getArtifactByIdentity`, `CompositionArtifactStorage`, `buildObjectEvidence`, `verifyObjectEvidence` | Nenhuma tabela/bucket nova. Restrições reais: `campaign_composition_artifacts` aceita `square_original`/`provider_generation`, tem unicidade `(store_id, campaign_id, operation_id, role)`, trigger de imutabilidade e bucket `campaign-internal-artifacts`. `persistCompositionArtifact` exige `source: { kind: "none" }` para `provider_generation`. |
| Reutilização/adoção pré-chamada | F60.1 retrieve + evidência; padrão da F60.3 (`probeExpansionTarget`, `verifyExpansionReuseEvidence`) | Lacuna comprovada: a F60.1 não expõe um gate específico para `square_original`; `retrieve` devolve `absent` tanto para linha ausente quanto para linha com objeto desaparecido. O módulo precisa distinguir linha/objeto antes de qualquer chamada. |
| Classificação de falha/tentativa | F60 `classifyProviderFailure`; tradutor já existente `classifyExpansionFailure` (F60.3) | Nenhuma política nova. O módulo apenas traduz o erro do gateway e devolve a classe/motivo/evidência de envio para a F60 decidir. |
| Telemetria | `buildAttemptTelemetry`/`createDefaultTelemetryContext`, `DefaultAiTelemetrySink`, runner de copy | Nenhuma. A copy usa o runner existente; a imagem usa o contexto/sink único com `operationRunId = operationId`, `traceId = callId`, `attemptNumber` da F60 e custo interno por par. |

### Restrições invioláveis

- Nenhuma alteração de comportamento no 1:1, no 9:16 direto, na F60, na F60.1, na F60.3 ou no laboratório.
- Nenhuma migration, tabela, bucket, coluna, policy, RPC, índice, flag, rota, UI ou ativação.
- Nenhum crédito reservado/confirmado/estornado; nenhuma escrita em `campaigns`; nenhuma URL assinada/pública; nenhuma entrega/download.
- Nenhuma chamada paga nesta rodada de proposta. Qualquer prova real é gate separado, com autorização explícita de quantidade e orçamento.

## Goals / Non-Goals

**Goals:**

- Entregar um módulo server-only reutilizável que gera copy e `square_original` 1024×1024 para uma operação 9:16, dentro de uma autorização/tentativa F60 já adquirida.
- Reutilizar a configuração congelada, o prompt 1:1, a copy existente, o gateway/adapter existente e a F60.1 sem criar caminhos paralelos.
- Distinguir primeira composição de retomada: só a primeira resolve a configuração vigente; a retomada usa snapshot/evidência congelados e recusa conteúdo divergente antes de qualquer chamada.
- Fazer no máximo **uma** chamada de imagem e **uma requisição de copy** por invocação, com alvo explícito, sem retry, sem fallback automático e sem retry oculto do SDK.
- Preservar trabalho concluído em retomadas: arte existente não é regerada; copy `completed` não é rechamada; copy concluída sobrevive a falha posterior da arte e vice-versa, sempre com o conteúdo original.
- Devolver resultados distinguíveis para copy e arte, com falhas tipadas e evidência da chamada preservada em todos os desfechos pós-chamada.
- Deixar o módulo pronto para o orquestrador 9:16 sem criar o orquestrador.

**Non-Goals:**

- Reservar, confirmar, estornar ou consultar crédito; alterar `campaigns`; entregar, publicar ou liberar download.
- Adquirir etapa/tentativa F60, decidir retry/fallback, contar tentativas ou substituir a política da F60.
- Expansão 9:16, preparação 1152, UI, admin, rotas, flag, ativação, orquestrador 9:16.
- Alterar prompts, políticas, compositor, modelos, qualidades, catálogo ou pricing; expor substituição de prompt base no contrato do chamador.
- Alterar o comportamento legado dos adapters textuais ou do gateway padrão sem opção explícita.
- Criar migration, tabela, bucket, coluna, policy, RPC ou índice.
- Prova real paga nesta rodada; merge, push, deploy ou produção.

## Decisions

### D1 — Módulo próprio em `src/lib/campaign/square-base/**`, sem orquestrador público

Contratos puros separados da implementação server-only. O módulo recebe identidade/autorização/tentativa e devolve resultado tipado; não conhece crédito, entrega, NDJSON, UI ou campanha pronta. Alternativa descartada: chamar `runProductOneToOneGeneration` — ele reserva crédito, emite resposta pública e entrega, efeitos proibidos nesta etapa.

### D2 — Primeira composição × retomada: conteúdo e configuração congelados são a autoridade

A primeira leitura após validar entrada/autorização é o **estado congelado** da operação, não a configuração vigente. O schema existente impõe **um snapshot por campanha**, com **um único binding** (`snapshot_original_id` é PK) e **uma única evidência** (`snapshot_original_id` é UNIQUE) por snapshot. Portanto, o estado possível é:

- **`absent`** (sem snapshot para a campanha): é a **primeira composição**. O módulo resolve a configuração vigente, compõe/congela o conteúdo e persiste snapshot + binding + evidência antes de qualquer chamada paga. A partir daí, o conteúdo congelado é a autoridade.
- **`complete`** (snapshot + binding + evidência do **mesmo `operationId`**): é **retomada**. O módulo **não** chama `runNewFlowPreflight` nem resolve configuração atual; usa o snapshot congelado e o conteúdo da evidência. O conteúdo recebido é comparado ao congelado; divergência ⇒ `content_divergence`, zero chamadas.
- **`repairable`** (snapshot + binding do mesmo `operationId`, sem evidência): a retomada compara o conteúdo recebido ao fingerprint persistido. Equivalente ⇒ repara a evidência para o MESMO snapshot usando o conteúdo recebido (que é equivalente) e segue; divergente ⇒ `content_divergence`, zero chamadas.
- **`bound_to_other_operation`** (snapshot com binding/evidência de outro `operationId`): conflito explícito, zero chamadas. Não se cria segundo binding/evidência, não se troca a operação do snapshot e não se compõe uma nova base na mesma campanha.
- **`unproven`/`corrupt`/`indeterminate`** (snapshot sem binding, evidência incoerente, falha de leitura ou estado parcial não reparável): bloqueia sem adotar automaticamente, sem presumir ausência e sem trocar de configuração.

O **conteúdo congelado** é um payload canônico gravado no campo textual já existente `product_1_1_snapshot_frozen_evidence.briefing` (sem coluna/tabela nova):

```ts
{
  briefing,            // briefing estruturado do produto/comercial
  copyContext,         // contexto server-side da copy (loja, tom, preços em centavos, selo)
  identityDirective,   // direção de identidade aplicada ao prompt
  campaignIntent,
  backgroundDirection,
  referenceSelections, // papel + hash de conteúdo + índice das imagens
  promptBaseVersion,
  composerVersion,
  policyVersions
}
```

O fingerprint de conteúdo reutiliza `computeContentFingerprint`; ele cobre esse payload e as versões. Na retomada, o módulo **usa o payload congelado** para compor prompt e copy; o payload recebido serve apenas para a comparação. Campos opcionais ausentes no reenvio (por exemplo, `copyContext`) são preenchidos pelo congelado antes da comparação; campos presentes precisam ser equivalentes. As imagens de produto/identidade recebidas são verificadas por hash de conteúdo, papel e ordem contra `referenceSelections`; um data URL diferente é `content_divergence`, mesmo que o chamador declare os mesmos IDs. Assim, arte antiga nunca é combinada com preço/briefing/identidade/imagens novos, mesmo quando só a copy falta.

O **gate de arte** vem depois da leitura do estado congelado:

- arte existente + estado congelado `complete`/`repairable` ⇒ `reused`; se a copy falta, ela usa o conteúdo congelado.
- arte existente + estado `absent` ⇒ `blocked` (`artifact_without_frozen_state`): não há conteúdo original desta operação comprovável; não se reutiliza a arte com conteúdo novo.
- arte existente + estado `bound_to_other_operation` ⇒ conflito explícito, zero chamadas; não se reatribui o snapshot nem se cria segundo binding/evidência.
- arte existente + estado `unproven`/`corrupt`/`indeterminate` ⇒ `blocked`.
- arte ausente + estado `complete`/`repairable` ⇒ prossegue para a imagem **sem** resolver config atual, validando apenas elegibilidade/pricing do par congelado.
- arte ausente + estado `absent` ⇒ primeira composição: preflight/config atual, congela e persiste antes do provider.
- arte ausente + estado `bound_to_other_operation`/`unproven`/`corrupt`/`indeterminate` ⇒ conflito/bloqueio, zero chamadas.

Alternativa descartada: preflight/snapshot sempre antes do gate — um replay puro poderia ser bloqueado por config/pricing sem necessidade. Alternativa descartada: reutilizar a arte e gerar copy com o payload recebido — violaria o conteúdo original da operação.

Este limite não impede uma expansão futura de arte existente: o caminho de expansão reutiliza o artefato (`square_original`/`square_prepared`) pela identidade de origem e não precisa recompor a base nem criar outro binding.

### D3 — F60.1 é a única autoridade do `square_original`

O módulo não cria tabela, bucket, path ou evidência paralela. Persiste com:

```ts
{
  identity: { storeId, campaignId, operationId, role: "square_original" },
  authorization,
  bytes, // JPEG 1024×1024 produzido por resizeToJpeg1024
  origin: "provider_generation",
  source: { kind: "none" },
  provenance: {},
}
```

A F60.1 valida identidade, vínculo loja↔campanha, autorização, JPEG 1024×1024 por decode completo, checksum, evidência e imutabilidade. O módulo não passa metadados de geração em `provenance`: a allowlist da F60.1 descarta chaves desconhecidas e a evidência de geração vive no snapshot congelado e em `generation_events`. Isso evita prometer uma proveniência que a F60.1 não persiste.

### D4 — Gate pré-chamada: linha e objeto são perguntas distintas

Antes de qualquer chamada paga:

1. `getArtifactByIdentity` consulta a **linha** explicitamente.
2. Linha encontrada:
   - `retrieveCompositionArtifact` integral + compatibilidade (`role`, 1024×1024, JPEG, `origin: "provider_generation"`, sem `derived_from_artifact_id`/`source_campaign_id`, proveniência vazia) + evidência durável verificada → **reused**, zero chamadas.
   - `retrieve` `absent` → linha existe e objeto desapareceu → **row_object_missing**, zero chamadas; nunca regravar.
   - `invalid`/`metadata_conflict`/`indeterminate` → **blocked/conflict**, zero chamadas.
3. Linha ausente:
   - `readObjectInfo` do path determinístico `absent` comprovado → **proceed**, único caminho para a chamada paga.
   - objeto presente → baixar, validar JPEG 1024×1024, montar a evidência esperada com a F60.1 e verificar a evidência durável. Íntegro e compatível → `persistCompositionArtifact` com os próprios bytes (adoção de órfão) → **reused**, zero chamadas. Inválido/incompatível/ilegível → bloquear.
   - `indeterminate` → bloquear.

O custo de um falso-negativo é uma operação bloqueada que o chamador resolve; o custo de um falso-positivo seria uma chamada paga que a F60.1 recusaria depois. O gate é deliberadamente conservador. Teste obrigatório: linha existente + objeto desaparecido → zero chamadas.

### D5 — Uma chamada de imagem por invocação, alvo explícito, sem política paralela

O módulo executa no máximo uma `images.edit` por invocação, com `n: 1`, `size: "1024x1024"`, qualidade/modelo do alvo do snapshot e as imagens de produto/identidade já fornecidas. O alvo (`primary`/`fallback`) e o número da tentativa vêm da F60; o módulo não escolhe fallback, não faz segunda tentativa, não espera entre tentativas e não conta tentativas.

O gateway é composto com os componentes existentes (`AiGateway`, `NewFlowImageModelResolver`, `UpstreamImagesAdapter`) e as opções aditivas da F60.3:

- `maxRetries: 0` no loader/cliente e no adapter — nenhum retry HTTP oculto do SDK;
- `preserveUsageWithoutImage: true` — resposta sem imagem preserva `usage` e é classificada como `invalid_output`, sem perder custo conhecido.

O runtime 1:1 (`createNewFlowImageGateway`) permanece intocado.

### D6 — Copy independente, resumível, sem retry oculto e não bloqueante para a arte

A copy usa o caminho produtivo existente:

- `ProductOneToOneCopyAcquisitionClient.acquire` com `mode: "auto"` e `requestToken` server-side;
- `drainCopyTask` com orçamento `min(COPY_BUDGET_MS, tempo restante até o deadline local)`;
- `createDefaultProductOneToOneCopyOps` (Copy Director quando a flag está ligada; copy determinística caso contrário);
- `readCopyDelivery` para devolver o texto/payload persistidos.

**Conteúdo congelado:** a copy sempre usa `briefing` e `copyContext` do payload congelado da operação, nunca o payload recebido na retomada. Na primeira execução, o payload congelado é construído a partir da entrada antes de a copy começar. Na retomada, o payload recebido é usado apenas para a comparação de fingerprint; a copy lê preço, selo, briefing, loja e tom do estado congelado.

**Uma requisição de copy:** o runner existente recebe um invoker próprio composto por um `AiGateway` com o mesmo resolver de `campaign_copy` e um registry sem retry oculto:

- `ChatCompletionsAdapter({ maxRetries: 0 })` e `ResponsesAdapter({ maxRetries: 0 })` — opção aditiva, default atual preservado quando ausente;
- `GeminiAdapter()` — o SDK `@google/generative-ai` não possui camada de retry/backoff; a garantia é uma única `generateContent`;
- `defaultAiGateway`/`defaultAdapterRegistry` permanecem intocados; apenas o invoker da copy deste módulo usa o registry no-retry.

Regras de retomada:

- `attempt_already_completed` → ler o delivery e devolver copy `completed` com origem `reused` (zero chamadas de copy).
- `attempt_in_progress`/`already_acquired` → copy `in_progress`; a arte continua.
- `wait_not_elapsed` → copy `waiting` com o tempo restante; a arte continua.
- `attempt_limit_reached`/`automatic_closed` → copy `unavailable` com motivo; a arte continua.
- falha de aquisição/leitura → copy `unavailable`; a arte continua.
- copy concluída nesta invocação → `completed`; o texto é lido do estado persistido, não apenas do retorno em memória.

A copy nunca bloqueia, reverte ou falha a arte. A arte nunca apaga ou sobrescreve a copy. Se a arte falhar depois de a copy concluir, a próxima invocação reutiliza a copy e tenta apenas a arte. Se a copy falhar depois de a arte persistir, a próxima invocação reutiliza a arte e tenta apenas a copy.

A copy começa depois do gate de arte e, no caminho de geração, depois da persistência do snapshot — nunca antes de uma escrita durável que possa bloquear a operação. No caminho de arte reutilizada/órfã adotada, a copy pode começar imediatamente, sempre com o conteúdo congelado.

### D7 — Autorização e tentativa F60 são entradas, não decisões do módulo

O chamador já adquiriu a etapa `base` pela F60 e fornece `attempt: { number, target, reference }`. O módulo:

- não chama `product_9_16_acquire_step`, `finish_step` ou `record_outcome`;
- não verifica a posse da tentativa no banco (a F60 é a autoridade; o módulo é server-only e interno);
- executa uma chamada com o alvo informado;
- devolve a classificação `ProviderFailure` (classe/motivo/evidência de envio) para o chamador finalizar a etapa e decidir a próxima tentativa.

Isso evita uma segunda trava/política concorrente. A única trava do módulo é o deadline local e o gate de arte. O módulo também não usa o gate de gasto do piloto 1:1 (`pilotSpend`): a autorização F60 e a operação financeira da etapa são o controle; nenhuma política de gasto paralela é criada.

### D8 — Deadline local e abort cooperativo

O módulo aceita `timeoutMs` (orçamento restante informado pelo chamador; default conservador de 180 s) e `signal`. Ele cria um deadline local com os helpers puros existentes (`deadlineAt`, `remainingBudget`, `createDeadlineRejection`), aborta a chamada no limite e corre a promessa do gateway contra a rejeição do deadline. Timeout, abort e perda de comunicação após possível envio são `unknown`; não há retry, gravação de falha definitiva nem persistência da arte.

Antes de cada escrita durável (snapshot, artefato), o módulo exige reserva de tempo (`canStartDurableWrite`). Se a reserva já foi atingida, retorna bloqueio honesto sem iniciar a escrita nem a chamada paga.

### D9 — Telemetria existente, sem sink paralelo

- **Imagem**: `createDefaultTelemetryContext` (mesmo sink único) com `operationRunId = operationId`, `traceId = callId` (UUID por chamada), `attemptNumber` da F60, `storeId`, `campaignId`, snapshot econômico e `internalCost` resolvido pelo par congelado (`defaultResolveAttemptCost` + `attemptCostForTarget`, origem `new_flow_pair_pricing`). Um observador `onCostResolved` captura o custo resolvido para a evidência da chamada, sem uma segunda apuração.
- **Copy**: o runner existente cria seu próprio contexto (`createDefaultTelemetryContext`) com `campaignId`, `storeId`, `runId = operationId` (para o mesmo `operation_run_id`), `traceId` e snapshot econômico, usando o invoker no-retry do módulo. Nenhuma escrita direta em `generation_events`.
- Um envelope do gateway por chamada real; custo desconhecido é `null`/`not_available`, nunca zero.
- Base e expansão compartilham `operation_run_id = operationId`, permitindo somar o custo da operação 9:16.

### D10 — Resultado tipado com copy e arte distinguíveis

A saída é uma união fechada. `copy` aparece em todos os desfechos que chegaram a iniciar trabalho; `art` aparece no sucesso. Falhas pós-chamada carregam `call` com `usage`/custo/duração/resultado, mesmo quando a arte não foi persistida.

## Contract

### Entrada

```ts
type SquareBaseInput = {
  storeId: string;
  campaignId: string;
  operationId: string;
  authorization: AuthorizationContext; // owner | system, resolvido no servidor

  briefing: ProductPromptCompositionBriefing;
  briefingText: string;
  campaignIntent: ProductOneToOneIntent;
  backgroundDirection: ProductOneToOneBackgroundDirection;
  productImagesDataUrls: readonly string[]; // ≥ 1 (primária obrigatória)
  identityImageUrl?: string;
  identityDirective?: string; // primeira execução: congelada; retomada: congelado é autoridade
  references?: readonly string[];
  referenceSelections?: readonly ProductOneToOneEvidenceReference[];

  copyContext?: ProductOneToOneCopyContext; // primeira execução: solicitada se presente; retomada: congelado é autoridade
  attempt: {
    number: number;      // positivo; a F60 decide o limite (base: até 3)
    target: "primary" | "fallback";
    reference: string;   // token/referência opaca da tentativa F60
  };

  usdBrlRateAtGeneration?: number | null;
  creditValueBrlAtGeneration?: number | null;
  runId?: string;
  traceId?: string;
  timeoutMs?: number;    // orçamento restante; default 180 s
  signal?: AbortSignal;
};
```

O chamador **não** envia path, bucket, URL, bytes de arte, modelo, qualidade, prompt final/base, tamanho de imagem ou decisão de retry. O módulo rejeita campos que tentem substituir essas decisões; a base de prompt é sempre `PRODUCT_1_1_PROMPT_BASE` e uma substituição, se necessária em teste, vive em `SquareBaseDeps`, não na entrada pública.

Na retomada, `briefing`/`briefingText`/`copyContext` recebidos servem apenas para a comparação de conteúdo. O módulo usa o payload congelado para prompt e copy; `copyContext` ausente na retomada é aceitável quando o payload congelado o contém.

`SquareBaseDeps` (fora do contrato público, usado por testes/integração) pode fornecer `client`, `runPreflight`, `buildSnapshot`, `persistSnapshot`, `composePrompt`/`promptBase`, `createImageGateway`/`invoker`, operações de copy, `persist`/`retrieve` e `clock`. Em produção, `promptBase` não é passado e a base é sempre `PRODUCT_1_1_PROMPT_BASE`.

### Saída

```ts
type ArtOutcome =
  | { kind: "created"; artifact: ArtifactRecord; snapshotOriginalId: string }
  | { kind: "reused"; artifact: ArtifactRecord; adoption: boolean; snapshotOriginalId?: string };

type CopyOutcome =
  | { kind: "completed"; attemptSeq: number; text: string | null; payload: Record<string, unknown> | null; origin: "generated" | "reused" }
  | { kind: "failed"; attemptSeq?: number; failureClass: "transient" | "definitive" | null; unconfirmed: boolean }
  | { kind: "in_progress"; attemptSeq?: number }
  | { kind: "waiting"; waitRemainingMs: number }
  | { kind: "not_requested" }
  | { kind: "unavailable"; reason: "not_attempted" | "acquisition_failed" | "read_failed" | "attempt_limit" | "automatic_closed" | "budget_exhausted" };

type SquareBaseCallEvidence = {
  callId: string;
  operationId: string;
  attemptNumber: number;
  attemptReference: string;
  provider: "openai";
  model: string;
  protocol: "images";
  quality: string;
  requestedSize: "1024x1024";
  durationMs: number;
  callStatus: "success" | "failed" | "timeout";
  outcome: "generated" | "invalid_output" | "provider_failure" | "definitive_failure" | "unknown" | "persistence_failed" | "readback_failed";
  usage?: TokenUsage;
  cost: CostResolution; // null + not_available quando desconhecido
  errorType?: string;
};

type SquareBaseResult =
  | { kind: "completed"; copy: CopyOutcome; art: ArtOutcome; call: SquareBaseCallEvidence | null }
  | { kind: "provider_failure"; copy: CopyOutcome; failure: ProviderFailure; call: SquareBaseCallEvidence }
  | { kind: "definitive_failure"; copy: CopyOutcome; reason: "auth" | "quota" | "billing" | "capability" | "content_filter" | "invalid_request"; call: SquareBaseCallEvidence }
  | { kind: "unknown_result"; copy: CopyOutcome; reason: "timeout" | "abort" | "comm_lost"; failure: ProviderFailure; call: SquareBaseCallEvidence }
  | { kind: "invalid_output"; copy: CopyOutcome; reason: "empty_image" | "decode_failed" | "resize_failed"; call: SquareBaseCallEvidence }
  | { kind: "existing_artifact_conflict"; copy: CopyOutcome; reason: "incompatible" | "object_unverified" | "object_invalid" | "row_object_missing"; artifact?: ArtifactRecord; call: SquareBaseCallEvidence | null }
  | { kind: "persistence_failed"; copy: CopyOutcome; reason: "integrity_failure" | "persistence_failure"; detail: string; storagePath?: string; call: SquareBaseCallEvidence }
  | { kind: "readback_failed"; copy: CopyOutcome; reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict"; detail?: string; call: SquareBaseCallEvidence }
  | { kind: "snapshot_failed"; copy: CopyOutcome; reason: "snapshot_persist_failed" | "snapshot_read_failed" | "evidence_read_failed" | "operation_identity_conflict" | "frozen_evidence_persist_failed" | "persistence_reserve_reached"; call: null }
  | { kind: "content_divergence"; reason: "fingerprint" | "briefing" | "copy_context" | "references" | "prompt_version" | "composer_version" | "policy_version"; copy: null; call: null }
  | { kind: "frozen_state_conflict"; reason: "bound_to_other_operation" | "unproven" | "corrupt" | "indeterminate"; copy: null; call: null }
  | { kind: "blocked"; copy: CopyOutcome | null; reason: "pre_call_probe_indeterminate" | "preflight_failed" | "persistence_reserve_reached" | "frozen_state_read_failed" | "frozen_content_invalid" | "artifact_without_frozen_state"; call: null }
  | { kind: "invalid_input"; reason: string }
  | { kind: "authorization_denied"; reason: "not_owner" | "store_mismatch" | "identity_conflict" };
```

`provider_failure` carrega classe transitória/definitiva; `unknown_result` carrega a classe desconhecida; o módulo não converte nenhuma delas em retry. `completed` com `art.kind = "reused"` e `call = null` significa zero chamadas de imagem nesta invocação. `copy.origin` distingue trabalho gerado agora de trabalho reaproveitado.

## Architecture / Files

Produção (novos):

| Arquivo | Papel |
|---|---|
| `src/lib/campaign/square-base/types.ts` | Entrada, saída, copy/arte/call, conteúdo congelado e união fechada de resultados. |
| `src/lib/campaign/square-base/policy.ts` | Constantes puras de papel/dimensão/MIME/origem/tamanho/timeout. |
| `src/lib/campaign/square-base/validation.ts` | Validação pura da entrada e rejeição de campos que substituem decisões internas. |
| `src/lib/campaign/square-base/prompt.ts` | Input de composição equivalente ao 1:1 e chamada a `composeProductPrompt` com `PRODUCT_1_1_PROMPT_BASE`. |
| `src/lib/campaign/square-base/frozen-state.ts` | Leitura read-only de snapshot/evidência/binding, classificação `absent`/`complete`/`repairable`/`corrupt`, serialização/parse do payload congelado e comparação de fingerprint. |
| `src/lib/campaign/square-base/config.ts` | Preflight (só primeira execução), snapshot, evidência congelada, persistência/reparo e validação de pricing do par congelado. |
| `src/lib/campaign/square-base/gate.ts` | Probe linha/objeto, compatibilidade, evidência e adoção de órfão. |
| `src/lib/campaign/square-base/transport.ts` | Gateway + resolver + `UpstreamImagesAdapter` com `maxRetries: 0` e `preserveUsageWithoutImage`. |
| `src/lib/campaign/square-base/failure.ts` | Tradução do erro para `ProviderFailure` via classificação F60, sem retry. |
| `src/lib/campaign/square-base/artifact.ts` | Data URL → JPEG 1024 → F60.1 persist/readback. |
| `src/lib/campaign/square-base/copy.ts` | Aquisição, dreno, persistência e leitura da copy existentes, usando conteúdo congelado. |
| `src/lib/campaign/square-base/copy-transport.ts` | Invoker de copy com registry no-retry (`ChatCompletionsAdapter`/`ResponsesAdapter` com `maxRetries: 0`; Gemini sem retry), sem tocar no gateway padrão. |
| `src/lib/campaign/square-base/telemetry.ts` | Contexto do sink único, custo interno e observação do custo resolvido. |
| `src/lib/campaign/square-base/run-square-base.ts` | Única API pública; orquestra o fluxo e devolve o resultado tipado. |

Compartilhado (aditivo, default atual preservado):

| Arquivo | Mudança |
|---|---|
| `src/lib/ai/adapters/chat-completions.ts` | Opção de construtor `maxRetries?: number`; ausente ⇒ `new OpenAI({ apiKey })` como hoje. |
| `src/lib/ai/adapters/responses.ts` | Opção de construtor `maxRetries?: number`; ausente ⇒ `new OpenAI({ apiKey })` como hoje. |

Testes (novos): `src/lib/campaign/square-base/__tests__/*.contract.test.ts`, reutilizando `src/lib/campaign/__tests__/support/{fake-artifact-backend,jpeg-fixtures}.ts` e os seams já usados por F60.1/F60.3/1:1. Testes dos adapters textuais cobrem a opção aditiva e o default inalterado.

Nenhum arquivo de produção da F60/F60.1/F60.3/1:1/F59/lab é alterado; os dois adapters textuais recebem apenas a opção aditiva.

## Flow

1. Validar entrada (UUIDs, imagens, briefing, `attempt.number`/`target`/`reference`, `timeoutMs`/`signal`); recusar path/URL/bytes/modelo/qualidade/prompt/base de prompt/tamanho enviados pelo chamador.
2. `verifyCampaignAccess` (F60.1) antes de qualquer leitura/escrita.
3. Ler o estado congelado (D2): `absent` = primeira composição; `complete`/`repairable` = retomada da mesma operação; `bound_to_other_operation` = conflito; `unproven`/`corrupt`/indeterminado = bloqueio. Na retomada, comparar o conteúdo recebido ao fingerprint congelado; divergência ⇒ `content_divergence`, zero chamadas.
4. Gate de arte (D4). Se `reused`/`adopted`:
   - com estado congelado `complete`/`repairable`, seguir para a copy com o conteúdo congelado;
   - com estado `absent`/`bound_to_other_operation`/`unproven`/`corrupt`, bloquear/conflitar sem chamadas;
   - se a copy já estiver concluída ou não for solicitada, devolver `completed` sem preflight/imagem.
5. Se `blocked`/`conflict` → devolver falha tipada, zero chamadas de copy/imagem.
6. Primeira composição com arte ausente (`absent`): preflight fail-closed (`runNewFlowPreflight`) → config resolvida uma vez; compor prompt (`composeProductPrompt`) e payload congelado; persistir snapshot + binding + evidência antes de qualquer efeito pago. Falha → `snapshot_failed`, zero chamadas.
7. Retomada com arte ausente (`complete`/`repairable`): **não** resolver config atual; usar o snapshot congelado, reparar apenas a evidência `repairable` equivalente e validar elegibilidade/pricing do par congelado.
8. Iniciar copy (se o conteúdo congelado tiver `copyContext`) de forma não bloqueante, com transporte sem retry oculto, orçamento e identidade de tentativa próprios.
9. Resolver custo interno do alvo congelado, criar telemetria e executar **uma** chamada de imagem com o alvo explícito, deadline local e sem retry/fallback.
10. Em sucesso: decodificar data URL, `resizeToJpeg1024`, persistir `square_original` via F60.1, fazer readback e devolver `completed` com `call`. Em falha: classificar, preservar `call`/`usage`/custo e devolver a falha tipada.
11. Aguardar a copy em `finally` (nunca deixar task órfã) e anexar seu desfecho ao resultado.
12. Em qualquer caminho, não tocar crédito, `campaigns`, entrega, download ou URL.

## Identity, Idempotency and Concurrency

- **Artefato**: `(storeId, campaignId, operationId, "square_original")`, único na F60.1.
- **Snapshot**: um por campanha; **um binding e uma evidência por snapshot** (`snapshot_original_id` é PK no binding e UNIQUE na evidência). O snapshot fica vinculado a UMA operação. A primeira composição congela; a retomada só lê o congelado; snapshot vinculado a outra operação conflita e snapshot sem binding bloqueia. Conteúdo/config divergente bloqueia antes do provider.
- **Copy**: `(campaign_id, operation_id, attempt_seq)`, com `attempt_seq` 1..6 e `completed` terminal; o conteúdo vem sempre do payload congelado.
- **Tentativa F60**: `(operation_id, attempt.number, attempt.reference)`; a autoridade é a F60. O módulo apenas correlaciona.
- **Chamada**: `callId` UUID = `trace_id`; uma por invocação de imagem e uma requisição por invocação de copy.
- **Concorrência**: a F60 garante uma execução em andamento por operação; o módulo não cria lock/tabela de tentativas. A unicidade da F60.1 converge a arte; a RPC de copy converge o estado. Duas invocações que ignorem a F60 podem gerar duas chamadas — limite explícito, não corrigido por política paralela.
- **Retomada**: conteúdo congelado é comparado; arte existente → `reused`; copy `completed` → reutilizada sem chamada; órfão íntegro com evidência → adoção pela F60.1; linha com objeto ausente → bloqueio sem chamada; conteúdo divergente → `content_divergence` sem chamada.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Snapshot da campanha já vinculado a outra operação | `frozen_state_conflict` com `bound_to_other_operation`, zero chamadas. Não se cria segundo binding/evidência nem se reatribui o snapshot. O chamador abre nova campanha, se aplicável. |
| Snapshot sem binding ou estado parcial não reparável | Bloqueio como estado não comprovado; não se adota snapshot automaticamente nem se compõe nova base. |
| Retomada usar a configuração vigente ou o payload recebido | Estado congelado é lido antes do preflight; `complete`/`repairable` não resolvem config atual e usam o payload congelado; divergência ⇒ `content_divergence`. |
| Arte existente sem snapshot/evidência congelados | Bloqueio `artifact_without_frozen_state`; não se combina arte antiga com conteúdo novo. |
| Copy esgotar o limite de tentativas da operação | Copy `unavailable` com motivo; a arte continua. O chamador decide o caminho de copy. |
| Gate de arte bloquear por evidência ausente/indeterminada | Intencional e conservador: zero chamadas. O chamador resolve a divergência; nada é apagado/corrigido. |
| `persistCompositionArtifact` descartar metadados de geração na proveniência | A evidência de geração vive no snapshot congelado e em `generation_events`; o módulo não promete proveniência que a F60.1 não persiste. |
| Retry HTTP oculto do SDK na imagem | Gateway composto com `maxRetries: 0`; teste captura as opções do loader. Default 1:1 intacto. |
| Retry HTTP oculto do SDK na copy | Invoker próprio com `ChatCompletionsAdapter`/`ResponsesAdapter` em `maxRetries: 0`; Gemini sem camada de retry; teste prova uma única requisição. Default legado intacto. |
| Resposta sem imagem perder custo | `preserveUsageWithoutImage: true`; `invalid_output` com `usage`/custo conhecidos. |
| Chamada paga seguida de falha de resize/persistência/readback | `call` é devolvido com custo; a arte pode ficar como órfão com evidência e a próxima invocação a adota sem nova chamada. |
| Copy paga e arte falha | Copy permanece `completed`; a próxima invocação a reutiliza e tenta apenas a arte. |
| Arte persistida e copy falha | Arte permanece; a próxima invocação a reutiliza e tenta apenas a copy. |
| Timeout/abort após possível envio | `unknown_result`, sem retry/persistência/estorno; o chamador encaminha a pendência F60. |
| Duas invocações concorrentes fora da F60 | Limite explícito: o módulo não cria lock. A F60 é a autoridade de execução única; a F60.1 converge a arte. |
| Escopo escorregar para crédito/entrega/UI | Non-goals e testes de fronteira que garantem zero writes em `campaigns`, crédito, URL, download e delete. |

## Data / Migration

**Nenhuma migration nesta fatia.** A verificação das restrições reais mostrou que o contrato cabe no schema existente:

- `campaign_composition_artifacts` + bucket `campaign-internal-artifacts` (F60.1): `square_original`, `provider_generation`, unicidade por identidade/papel, imutabilidade.
- `image_generation_config_snapshots`, `product_1_1_snapshot_frozen_evidence` e `product_1_1_snapshot_content_binding`: configuração/evidência congelada. O snapshot é único por campanha; binding e evidência são únicos por snapshot, então o snapshot pertence a uma única operação. O payload de conteúdo congelado usa o campo textual `briefing` já existente; nenhuma coluna nova.
- `product_1_1_copy_state` e `product_1_1_copy_cancellations`: copy, tentativas e cancelamento.
- `generation_events`: telemetria/custo via sink existente.
- `product_1_1_campaign_credit_operations`: autoridade financeira compartilhada; o módulo apenas a referencia indiretamente pela trava da RPC de copy, sem escrever.

A opção `maxRetries` dos adapters textuais é código, não schema; nenhuma migration a acompanha.

Pré-requisito de ambiente: a migration da F60.1 precisa estar aplicada onde o módulo for exercitado. Se não estiver, a execução para; não se cria/reaplica/renomeia migration nesta fatia.

### Migration Plan

1. **Agora (proposta)**: nenhum `.sql`, nenhuma escrita em banco/Storage, nenhuma chamada paga.
2. **Implementação**: nenhuma migration; apenas leitura/escrita nas tabelas e no bucket existentes.
3. **Prova real (gate separado)**: confirmar F60.1 aplicada, bucket, catálogo/pricing e uma campanha controlada; não resetar/reinstalar/reaplicar.
4. **Rollback**: não aplicável a schema; artefatos criados em prova podem ser removidos apenas por decisão operacional autorizada (o módulo não apaga).
5. **Produção**: fora do escopo; promoção é gate separado.

## Test Strategy

### Offline (obrigatório)

Provider, DB e Storage simulados nas fronteiras; Sharp/decoder reais com fixtures determinísticas; o módulo real é exercitado (não apenas o resultado mockado). Reutilizar `src/lib/campaign/__tests__/support/{fake-artifact-backend,jpeg-fixtures}.ts` e os fakes/seams já usados por F60.1/F60.3 e pelo 1:1.

| Área | Casos |
|---|---|
| Entrada/autorização | UUID inválido; sem imagem primária; `attempt.number` inválido; `target` inválido; `reference` vazio; path/URL/bytes/modelo/qualidade/prompt/promptBase/tamanho rejeitados; `owner` de outra loja; `system` sem vínculo; autorização ausente. |
| Estado congelado | `absent` → primeira composição; `complete` → retomada sem preflight atual; `repairable` equivalente → reparo da evidência; `repairable` divergente → `content_divergence`; snapshot vinculado a outra operação → conflito, zero chamadas; snapshot sem binding/estado parcial → bloqueio; leitura falha → bloqueio; payload congelado inválido → bloqueio; arte existente sem estado congelado → `artifact_without_frozen_state`. |
| Gate de arte | linha+objeto+evidência compatíveis → `reused`, zero chamadas; linha encontrada + objeto ausente → bloqueio, zero chamadas; linha ausente + objeto ausente comprovado → prossegue; objeto órfão íntegro com evidência → adoção F60.1, zero chamadas; órfão sem/with evidência inválida → bloqueio; `info`/download indeterminado → bloqueio; linha com origem/proveniência incompatível → conflito, zero chamadas. |
| Configuração/snapshot | primeira execução congela config uma vez; snapshot/evidência persistidos antes do provider; pricing incompleto → zero chamadas; config divergente para a mesma campanha/operação → `snapshot_failed`, zero chamadas; retomada usa snapshot congelado e não resolve config atual; falha de reparo de evidência → bloqueio; reserva de persistência atingida → zero chamadas. |
| Imagem | exatamente uma `images.edit`; alvo explícito; `size`/`quality` do snapshot; `maxRetries: 0` capturado; sem fallback/segunda chamada; request com produto/identidade na ordem existente; prompt composto por `composeProductPrompt` (baseline de equivalência com o 1:1). |
| Falhas | rate_limit → transitória; capacidade/5xx → transitória; auth/quota/billing/capability/content/4xx → definitiva; timeout/abort/perda → desconhecida; sem retry; resultado desconhecido não vira falha definitiva; custo conhecido preservado em resposta sem imagem; falha sem usage → custo `null`. |
| Copy | conteúdo congelado usado em prompt/copy; copy `completed` prévia → reutilizada, zero chamadas; copy gerada + arte criada → ambas distinguíveis; copy falha + arte criada → arte preservada; arte falha + copy concluída → próxima invocação reutiliza copy; `attempt_in_progress`/`wait_not_elapsed`/`attempt_limit_reached`/`automatic_closed` → arte continua; leitura de copy falha → arte continua; copy não solicitada → arte continua. |
| Copy sem retry | exatamente uma requisição ao provider por execução; `ChatCompletionsAdapter`/`ResponsesAdapter` com `maxRetries: 0` capturado; Gemini com uma única `generateContent`; default `defaultAiGateway`/adapters sem opção inalterado. |
| Persistência/readback | `created` com `square_original`/`provider_generation`/proveniência vazia; readback integral; `reused` pós-corrida; conflito de conteúdo/identidade/metadados/proveniência; falha de persistência após upload; falha de readback; nenhuma sobrescrita/delete; original não é alterado. |
| Fronteiras proibidas | zero writes em `campaigns`; zero RPC/chamadas de crédito (reserva/confirmação/estorno); zero `createSignedUrl`/`getPublicUrl`; zero download público/entrega; zero `update`/`delete` de objeto; zero alteração de status. |
| Telemetria | um evento por chamada de imagem; um evento por chamada de copy; `operationId`/`callId`/tentativa/alvo/modelo/qualidade/duração/resultado/usage; custo com origem; desconhecido `null`; `operation_run_id` igual entre base e expansão; cópia do runner existente. |
| Concorrência | duas leituras com arte existente → ambas reutilizam, zero chamadas; persistência concorrente → um vencedor e o outro reutiliza/conflito; copy concorrente → RPC decide; gate indeterminado não chama. |

### Prova real pequena (gate separado, somente com autorização)

- Reutilizar o homolog existente e a infraestrutura validada; **não** criar ambiente descartável, resetar, reinstalar ou reaplicar migrations.
- Preflight não pago: confirmar F60.1/bucket, catálogo/pricing do par, campanha controlada e ausência de snapshot divergente.
- Fonte de produto real com texto/preço/logo/aviso; não gerar arte quadrada por outro caminho.
- Solicitar antes: quantidade máxima de chamadas (proposta: **1** de imagem + 1 de copy, se a flag de copy estiver ligada), orçamento e autorização explícita. Sem retry automático pago; em falha, preservar evidência, diagnosticar e parar.
- Manifesto/log: ambiente, campanha, operação, tentativa F60, `callId`, modelo/qualidade, tamanho, duração, usage, custo/origem, artefato/checksum, desfecho da copy e decisão.
- Aceite técnico (dimensões, JPEG, checksum, evidência, custo) separado do aceite visual humano (textos, preço, logo, avisos, composição).
- Nenhuma produção, merge, push ou deploy nesta fatia.

## Decisions Locked in Review

Nenhuma pendência bloqueante. As decisões abaixo fecham a proposta e devem ser mantidas no planejamento GSD:

| Ponto | Decisão |
|---|---|
| Atalho pelo orquestrador 1:1 | **Proibido**: crédito, resposta pública e entrega ficam fora da etapa. |
| Primeira execução × retomada | **Primeira composição** (campanha sem snapshot) resolve config/congela; **retomada** lê snapshot/evidência congelados, não resolve config atual e recusa conteúdo divergente antes de qualquer chamada. |
| Snapshot já vinculado | **Uma única operação por snapshot** (binding PK + evidência UNIQUE por `snapshot_original_id`). Snapshot vinculado a outra operação conflita; snapshot sem binding bloqueia; não se cria segundo vínculo. |
| Conteúdo congelado | **Briefing + copyContext + intenção + direção + seleções + versões** no campo `briefing` existente; arte e copy de retomada usam esse conteúdo, nunca o payload recebido. |
| Gate de arte | **Depois** da leitura do estado congelado. Arte existente sem estado congelado bloqueia; replay puro não depende de config/pricing. |
| Política de imagem | **Uma chamada por invocação**, alvo explícito; a F60 decide tentativa/retry. |
| Retry oculto da imagem | **Desligado** com `maxRetries: 0`; default 1:1 intacto. |
| Retry oculto da copy | **Desligado** no invoker do módulo (`ChatCompletionsAdapter`/`ResponsesAdapter` com `maxRetries: 0`; Gemini sem retry); default legado intacto. |
| Copy | **Independente** da arte; `completed` é reutilizada; falha nunca bloqueia a arte; conteúdo sempre congelado. |
| Prompt base | **Sempre** `PRODUCT_1_1_PROMPT_BASE`; substituição só em dependência de teste, nunca no contrato do chamador. |
| Proveniência F60.1 | **Vazia** para `provider_generation`; geração comprovada por snapshot + telemetria. |
| Migration | **Nenhuma**; schema/tabelas/bucket existentes confirmados; a opção `maxRetries` é código aditivo. |
| Prova real | **Gate separado**, homolog existente, autorização explícita, sem reconstruir infraestrutura. |
