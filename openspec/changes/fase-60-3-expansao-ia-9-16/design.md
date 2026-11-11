## Context

A iniciativa 60 já entregou três peças independentes e não deve reabri-las:

- **F60** — operação 9:16 em duas etapas, identidade `(campaign_id, operation_id)`, autorização de execução única, classificação de falha e integração financeira.
- **F60.1** — artefatos de composição `square_original` / `square_prepared` / `vertical`, persistência imutável, recuperação validada por conteúdo, checksum, proveniência e evidência durável no objeto.
- **Quick 261111-idz (F60.2)** — preparação determinística `square_original` 1024×1024 → `square_prepared` 1152×1152, com reutilização condicionada à evidência durável.

O que falta é a **etapa paga de expansão**: receber o `square_prepared`, executar uma única chamada de IA que amplia o canvas para 9:16, validar o retorno 1152×2048, exportar 1080×1920 e persistir o `vertical` como `ai_expansion`. Esta fatia entrega somente esse módulo; orquestrador público, UI, creditamento e entrega ficam para etapas posteriores.

### Mapa de reaproveitamento

| Necessidade | Módulo existente | Lacuna real |
|---|---|---|
| Identidade, autorização e vínculo loja↔campanha | F60.1 `validateArtifactIdentity`, `verifyCampaignAccess`, `checkCampaignStoreBinding` | Nenhuma. O módulo apenas reafirma o papel de origem `square_prepared` e a identidade de destino `vertical`. |
| Recuperar e validar a fonte 1152×1152 | F60.1 `retrieveCompositionArtifact` + `ROLE_POLICY` | Nenhuma. A fonte é lida por identidade, nunca por path do chamador. |
| Persistir o vertical, checksum, proveniência e evidência | F60.1 `persistCompositionArtifact`, `buildObjectEvidence`, `CompositionArtifactStorage` | Nenhuma. A F60.1 revalida a fonte interna e deriva a proveniência; o módulo não cria tabela, bucket, index ou mecanismo paralelo. |
| Reutilizar sem nova chamada paga | F60.1 retrieve + evidência durável; padrão da quick 261111-idz (`verifyPreparedReuseEvidence`, `isCompatiblePreparedArtifact`) | Falta o predicado/checagem específicos de `vertical` ↔ `square_prepared` e a decisão de **não chamar** quando já existe linha/objeto incompatível. |
| Prompt de expansão | `src/lib/lab/bench/domain/expand-prompt.ts`, `expand-geometry.ts`, `expand-schema.ts` | O prompt do laboratório não exige explicitamente preservação de preço/logo/avisos (e o teste dele garante que não cita “preço”/“selo”). É um baseline, não o prompt de produto. |
| Chamada `images.edit` com qualidade e uma única tentativa | `UpstreamImagesAdapter` (qualidade explícita) + `VerticalImagesAdapter` (`returnedSize` real) | O loader padrão do `UpstreamImagesAdapter` não fixa `maxRetries`; o SDK pode repetir HTTP ocultamente. Além disso, uma resposta sem imagem lança antes de o gateway ver o `usage`, perdendo custo conhecido. Faltam opções aditivas (sem retry e preservar usage sem imagem), sem mudar o default do 1:1. |
| Classificação de falha | F60 `classifyProviderFailure`, `ProviderFailure`, `ProviderFailureReason`, `SendEvidence` | Falta mapear `AiInvocationError`/erros do adapter para motivo + evidência de envio. Nenhuma política de repetição nova. |
| Exportação vertical 1152×2048 → 1080×1920 | `resizeVerticalToJpeg1080x1920` / `verifyVerticalJpeg1080x1920` | Nenhuma. Reutilizar exatamente; não reimplementar crop/resize. |
| Seleção de modelo/qualidade | `ai_model_catalog` (`campaign_product_image`), listas fechadas de `image-model-pair.ts` | O catálogo não tem coluna de qualidade. A qualidade `low` é fixa nesta fatia; o modelo efetivo vem da linha ativa, não de literal adivinhado. Seletor/fallback ficam fora. |
| Pricing e custo | `AiModelPricingService` por `provider+model+quality`, `DefaultAiTelemetrySink` com `internalCost.settlement = "usage_tokens"`, `AiCostTracker`/`generation_events` | Falta resolver um único par (sem fallback), exigir pricing específico de qualidade antes da chamada e correlacionar `operationId`/`callId`/etapa/tamanhos no metadata. Nenhuma tabela nova. |
| Telemetria sem duplicação | `AiGateway` (1 envelope por tentativa) + `DefaultAiTelemetrySink` + `generation_events` | Falta bufferizar o envelope até o desfecho do módulo para gravar o resultado real (ex.: `invalid_output`) sem um segundo evento. |
| Testes offline e fixtures | Fake DB/Storage e fixtures JPEG da quick 261111-idz; suíte F60.1 | Extrair o fake/helpers para suporte comum (somente testes) e adicionar fixture 1152×2048; não repetir a prova de infraestrutura/RLS da F60.1. |

### Restrições

- Nenhuma alteração de comportamento no 1:1, no 9:16 direto, na F60, na F60.1, na quick de preparação ou no laboratório.
- Nenhuma migration, tabela, bucket, policy, flag, rota, UI ou ativação nesta fatia.
- Nenhum crédito reservado, confirmado, estornado ou comprado; nenhuma escrita em `campaigns`; nenhuma URL assinada/pública; nenhuma entrega/download.
- Nenhuma chamada paga nesta rodada de proposta. A prova real é um gate separado, com autorização explícita de quantidade e orçamento.

## Goals / Non-Goals

**Goals:**

- Entregar um módulo server-only reutilizável que expande um `square_prepared` íntegro em `vertical` JPEG 1080×1920.
- Fazer no máximo **uma** chamada paga por invocação, sem retry oculto do SDK, sem fallback e sem política paralela de tentativas.
- Reutilizar ou bloquear antes de qualquer chamada, validando linha, bytes, proveniência e evidência durável — não apenas o path.
- Validar o retorno por conteúdo e exportar pelo pipeline vertical existente, sem crop.
- Persistir via F60.1 com `origin: "ai_expansion"` e proveniência revalidada.
- Registrar uma chamada real com identidade, tamanhos, duração, resultado, usage e custo com origem; custo desconhecido é `null`.
- Deixar o módulo pronto para o orquestrador futuro sem criar o orquestrador.

**Non-Goals:**

- UI, seletor de formato/modelo, admin, downloads ou apresentação de duas versões.
- Orquestrador completo, ativação ou substituição do 9:16 direto.
- Cobrança/estorno, entrega de dois formatos, compra posterior ou confirmação de crédito.
- Geração/copy 1:1, preparação 1024→1152, 4:5, 1080 como fonte, outros modelos ou fallback.
- Persistência durável do bruto 1152×2048, TTL, limpeza, backfill ou migração de campanhas históricas.
- Produção, merge, push, deploy ou chamadas pagas nesta rodada.

## Decisions

### D1 — Módulo próprio em `src/lib/campaign/vertical-expansion/**`, sem orquestrador

Contratos puros separados de implementação server-only. O módulo recebe identidade/autorização e devolve artefato ou falha tipada; não conhece UI, crédito, entrega, campanha pronta ou fila. Alternativa descartada: importar o executor/rota do laboratório — traria conceitos de run, admin, bucket `lab-artifacts` e chave de bancada para o produto.

### D2 — Modelo/qualidade fixos: Sunburst low resolvido pelo catálogo

A escolha desta fatia é `gpt-image-2.5-sunburst` + `low`. O identificador efetivo é resolvido por uma linha **ativa** de `ai_model_catalog` na capacidade `campaign_product_image`, provider `openai`, protocolo `images`, com o modelo esperado; `provider`/`model`/`protocol` vêm da linha. A qualidade `low` é validada contra a lista fechada `ELIGIBLE_IMAGE_QUALITIES`. Se a linha não existir/estiver inativa, o módulo falha antes de qualquer chamada (`model_unavailable`). Não há seletor administrativo, fallback, leitura de `image_model_pair_config` nem nome de modelo montado por string.

Alternativas descartadas: importar `BENCH_PRESETS` (registry do laboratório, chave/capability de bancada), usar o par principal/fallback do 1:1 (pode estar em `medium` e mudar por admin) ou hardcodar o identificador sem conferir o catálogo.

### D3 — Fonte exclusivamente pela F60.1, papel `square_prepared`

O chamador informa `source: { storeId, campaignId, operationId, role: "square_prepared" }`; o módulo não aceita `path`, `bucket` ou URL. `retrieveCompositionArtifact` valida autorização, vínculo, linha, path determinístico, download, decodificação completa, dimensões 1152×1152 e MIME JPEG. O original e o preparado nunca são escritos, copiados ou reclassificados.

### D4 — Identidade de destino separada e explícita

`operationId` é a operação 9:16 de destino e a chave de correlação de custo; `source.operationId` é onde o preparado está armazenado (pode ser o mesmo ou não). O destino é `(storeId, campaignId, operationId, "vertical")`. A tentativa vem do chamador (`attemptNumber` positivo e `attemptRef` opaco); o módulo não cria contadores, não decide retry e não lê o estado da F60. Isso evita confundir tentativa, chamada e artefato sem criar uma tabela universal de operações.

### D5 — Gate pré-chamada: reutilizar, adotar órfão ou bloquear; nunca chamar às cegas

Antes de resolver modelo/pricing ou chamar o provider, o módulo SHALL tratar **linha** e **objeto** como estados distintos. `retrieveCompositionArtifact` pode devolver `absent` tanto quando a linha não existe quanto quando a linha existe e o objeto desapareceu; o probe SHALL NOT inferir ausência de linha a partir dele.

1. Verificar autorização e vínculo loja↔campanha (`verifyCampaignAccess`) antes de qualquer leitura de linha/objeto.
2. Consultar a linha **explicitamente** pela identidade de destino com `getArtifactByIdentity`.
   - `read_failed` → `blocked`/`indeterminate`; zero chamadas.
   - `found`:
     - `retrieveCompositionArtifact` integral → validar compatibilidade com a fonte (papel/formato/origem/dimensões/MIME/`derivedFromArtifactId`/proveniência exata/checksum da fonte) e evidência durável no objeto. Compatível + evidência verificada → `reused`, zero chamadas. Qualquer divergência → `existing_artifact_conflict`, zero chamadas.
     - `absent` → **linha existe, objeto desapareceu**: `existing_artifact_conflict` (`row_object_missing`), zero chamadas; nunca regravar/sobrescrever.
     - `invalid`/`metadata_conflict`/`indeterminate` → bloquear, zero chamadas.
   - `absent`:
     - Ler `info` do path determinístico. `found` → baixar, validar 1080×1920 JPEG, montar a evidência esperada com a fonte e verificar a evidência durável. Íntegro e compatível → `persistCompositionArtifact` com os próprios bytes (adoção de órfão) → `reused`, zero chamadas. Inválido/incompatível/ilegível → bloquear, zero chamadas.
     - `absent` comprovado → **único caminho que prossegue para a chamada paga**.
     - `indeterminate` → bloquear, zero chamadas.

O custo de um falso-negativo é uma operação bloqueada que o chamador resolve; o custo de um falso-positivo seria uma chamada paga que a F60.1 recusaria depois. O gate é deliberadamente conservador. Teste obrigatório: linha existente + objeto desaparecido → zero chamadas.

### D6 — Uma tentativa paga, sem retry automático e sem retry oculto

O módulo executa no máximo uma `images.edit` por invocação, com `n: 1`, `size: "1152x2048"`, `quality: "low"` e exatamente uma imagem de referência. `UpstreamImagesAdapter` é reutilizado com duas opções aditivas de transporte: `maxRetries: 0` e preservação do `usage` quando a resposta HTTP não traz imagem (o módulo trata como `invalid_output` e registra custo conhecido). O default do 1:1 permanece inalterado porque as opções são opt-in. A execução passa pelo `AiGateway` com um resolver fixo que devolve o alvo já resolvido pelo catálogo (ou por `invokePrepared`), preservando o envelope único por tentativa. Não há fallback, segunda chamada, loop, fila ou retry interno.

O timeout padrão do módulo é **180 s**, reduzido quando o chamador informa um prazo menor; `timeoutMs` nunca alonga um deadline mais curto do chamador. Timeout, abort e perda de comunicação após possível envio são `unknown`: o módulo não repete, não grava falha definitiva e não persiste vertical. `rate_limit` e indisponibilidade/capacidade explícita são `transient`; saída inválida do provider é `definitive`; demais falhas de provider sem evidência suficiente são `unknown`. A classificação de modelo/provider usa `classifyProviderFailure` da F60. Falhas de autenticação, quota, faturamento, capacidade da requisição, conteúdo/segurança e entrada 4xx são devolvidas como `definitive_failure` com motivo fechado, fora do `ProviderFailure` (não são falhas de modelo elegíveis a repetição). O chamador (F60/futuro orquestrador) decide se repete.

### D7 — Validação por conteúdo e exportação pelo pipeline existente

O retorno do provider é decodificado por completo com Sharp. A dimensão real precisa ser exatamente 1152×2048 e a proporção 9:16 por inteiros. O `returnedSize` é medido dos bytes reais (nunca copiado do solicitado). A exportação usa `resizeVerticalToJpeg1080x1920` (fator único 0,9375, Lanczos3, sRGB, JPEG q90 4:4:4, decode completo da saída). Não há crop, pad, extensão, upscale ou segundo resize. O bruto 1152×2048 não é persistido; só metadados de evidência (tamanho, checksum, bytes) vão para a telemetria.

### D8 — Persistência via F60.1 com `ai_expansion`

O vertical é persistido com `origin: "ai_expansion"` e `source: { kind: "internal_artifact", artifactId }`. A F60.1 revalida a fonte por linha/bytes/checksum e deriva a proveniência allowlisted; o módulo não inventa proveniência adicional. Depois do persist, o módulo faz readback por `retrieveCompositionArtifact` e devolve os bytes autoritativos lidos, não os exportados em memória.

### D9 — Custo e telemetria: um evento por chamada real, com resultado do módulo

O módulo usa o `AiGateway` e um sink bufferizado. O gateway emite exatamente um envelope por tentativa real; o módulo faz **um único flush em caminho protegido**, inclusive quando a chamada terminou em sucesso e uma etapa posterior falhou (decode, exportação, persistência, readback ou exceção inesperada). O envelope é decorado com o desfecho real do módulo, sem um segundo evento. Falha do flush é best-effort: é registrada/logada, não altera o resultado do módulo e **nunca** dispara outra geração paga.

- `operationRunId` = `operationId` de destino (mesma chave que a base usará, permitindo total base + expansão).
- `traceId` = `callId` gerado pelo módulo (UUID), devolvido no resultado.
- `attemptNumber` = número informado pelo chamador.
- `generationType` = `campaign_image` (mapa existente); `capability`/`protocol` ficam no metadata.
- `metadata`: `stage: "expansion"`, `operationId`, `callId`, `attemptRef`, `requestedSize`, `returnedSize`, `promptVersion`, `sourceArtifactId`, `expansionOutcome`.
- Custo: pricing específico de `provider+model+quality`; `internalCost.settlement = "usage_tokens"` com tokens reais. No flush, o módulo escolhe o contexto do sink: **sem** `internalCost` quando o envelope traz `providerReportedCostUsd` (para a cadeia existente `provider_reported`) e **com** `internalCost` caso contrário (cálculo por tokens). A fórmula/auditoria reutilizada mantém o nome histórico `productOneToOneImageUsage`; a etapa é identificada por `metadata.stage = "expansion"`.
- **Cobertura pré-chamada**: antes da chamada, o módulo SHALL exigir a cobertura das tarifas necessárias ao cálculo por usage — entrada textual, saída textual, entrada de imagem, saída de imagem e as duas dimensões de cache — além de `image_unit_usd` para o teto/budget. `image_unit_usd` sozinho SHALL NOT comprovar cobertura; ausência de qualquer tarifa necessária → `pricing_unavailable` (`incomplete_coverage`), zero chamadas.
- Sem usage/tarifa suficiente no pós-chamada → `estimatedCostUsd: null` e `costSource: "not_available"`, nunca zero. Custo conhecido é registrado mesmo quando a saída é inválida/truncada ou uma etapa posterior falha.
- Nenhuma chamada a `AiCostTracker.record`/`generation_events` fora de `src/lib/ai/**`; o módulo apenas usa o sink padrão.

### D10 — Nenhuma migration

A F60.1 já possui tabela, bucket, trigger, policies e evidência. `generation_events` já persiste chamada/usage/custo/metadata. O catálogo e o pricing existentes já têm as linhas necessárias (a confirmar no ambiente da prova). Não há nova coluna, tabela, index ou bucket. A migration da F60.1 precisa estar aplicada no ambiente autorizado; se não estiver, a prova real para — não se cria/reaplica migration nesta fatia.

### D11 — Testes offline primeiro; prova real em gate separado

Offline: provider/DB/Storage simulados nas fronteiras, Sharp/decoder reais, fixtures determinísticas, o módulo real (não mocks do resultado). Prova real: homolog existente, uma campanha controlada, uma única chamada autorizada, sem retry, com manifesto/log reutilizado no fechamento. Não repetir RLS/persistência da F60.1, não criar ambiente descartável, não resetar/reinstalar/reaplicar migrations.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Duas invocações concorrentes com o mesmo destino chamarem o provider duas vezes antes de existir vertical | O módulo não cria lock/política paralela; a autorização de execução única é da F60 (aquisição por operação). O módulo garante reutilização após o vertical existir e persistência sem sobrescrita. O limite é explícito no contrato. |
| Chamada paga e falha de persistência/readback | O vertical pode ficar como órfão com evidência; a repetição adota o objeto íntegro sem nova chamada. Sem delete/rollback automático. |
| `retrieve` devolver `absent` e esconder que a linha existe | O probe consulta a linha explicitamente por `getArtifactByIdentity`; linha encontrada + objeto ausente (`retrieve absent`) → bloqueio `row_object_missing`, zero chamadas. Teste dedicado. |
| Falha de decode/exportação/persistência/readback/exceção inesperada perder o registro da chamada paga | Flush único em caminho protegido após a chamada, com o desfecho real; teste cobre cada caminho. |
| Falha do flush de telemetria disparar nova geração | Telemetria best-effort; a falha é logada, não altera o resultado e nunca inicia nova chamada. |
| Vertical existente incompatível bloquear a operação | É intencional: uma nova chamada não poderia sobrescrever a linha imutável e só geraria custo. O chamador abre nova operação ou resolve a divergência. |
| Retry oculto do SDK | Opção aditiva `maxRetries: 0` no transporte do expansor; teste captura as opções do loader. Default do 1:1 intacto. |
| Resposta sem imagem descartar usage conhecido | Opção aditiva que devolve o resultado com `usage` e sem imagem; o módulo classifica como `invalid_output` e registra o custo. Default do 1:1 intacto. |
| Timeout/abort após possível envio | Classificado como `unknown`; nenhuma repetição, nenhum vertical, nenhuma falha definitiva. Chamador decide. |
| Custo desconhecido virar zero | `estimatedCostUsd: null` + `not_available`; nenhum valor fixo 0,05; a prova real exige custo verificado para aceite. |
| Prompt não garantir preservação pixel a pixel | O prompt orienta preservar textos/preço/logo/avisos/composição; a validação técnica não promete fidelidade visual. Aceite visual humano é separado. |
| Catálogo/pricing ausente ou divergente no ambiente da prova | Preflight não pago confirma linha ativa e pricing específico; ausência bloqueia antes da chamada. |
| Reutilização aceitar path sem evidência | Gate exige linha/bytes/proveniência + `verifyObjectEvidence`; path sozinho nunca é suficiente. |
| Escopo escorregar para entrega/crédito/UI | Non-goals explícitos e testes que garantem ausência de writes em `campaigns`, crédito, URL assinada e delete/update. |
| Extração do fake de testes quebrar a quick | Re-export no caminho antigo; nenhum teste existente é reescrito e nenhum código de produção da quick é alterado. |

## Contract

### Entrada

```ts
type ExpandVerticalInput = {
  source: {
    storeId: string;
    campaignId: string;
    operationId: string;
    role: "square_prepared";
  };
  /** Operação 9:16 de destino e chave de correlação de custo. */
  operationId: string;
  attempt: {
    number: number;      // 1-based, informado pelo chamador (F60)
    reference: string;   // referência opaca da tentativa (F60)
  };
  authorization: AuthorizationContext; // owner | system, derivado no servidor
  timeoutMs?: number;  // default 180 s; prazo menor do chamador prevalece
  signal?: AbortSignal;
};
```

O chamador **não** envia path, bucket, URL, bytes, modelo, qualidade, prompt, tamanho ou operação de origem do provider. O módulo rejeita esses campos.

### Saída

```ts
type ExpansionCallEvidence = {
  callId: string;
  operationId: string;
  attemptNumber: number;
  attemptReference: string;
  provider: string;
  model: string;
  protocol: "images";
  quality: "low";
  requestedSize: "1152x2048";
  returnedSize: string | null;
  durationMs: number;
  callStatus: "success" | "failed" | "timeout";
  outcome: "expanded" | "invalid_output" | "provider_failure" | "unknown" | "persistence_failed";
  usage?: TokenUsage;
  cost: CostResolution; // estimatedCostUsd null + not_available quando desconhecido
  errorType?: string;
};

type ExpandVerticalResult =
  | { kind: "expanded"; artifact: ArtifactRecord; bytes: Buffer; persistence: "created"; call: ExpansionCallEvidence }
  | { kind: "reused"; artifact: ArtifactRecord; bytes: Buffer; adoption: boolean; call: ExpansionCallEvidence | null }
  | { kind: "invalid_input"; reason: ... }
  | { kind: "authorization_denied"; reason: "not_owner" | "store_mismatch" | "identity_conflict" }
  | { kind: "source_unavailable"; reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict"; detail?: string }
  | { kind: "model_unavailable"; reason: "catalog_row_missing" | "catalog_read_failed" | "unsupported_protocol" | "quality_not_eligible" }
  | { kind: "pricing_unavailable"; reason: "row_missing" | "code_default" | "incomplete_coverage" }
  | { kind: "existing_artifact_conflict"; reason: "incompatible" | "object_unverified" | "object_invalid" | "row_object_missing"; artifact?: ArtifactRecord }
  | { kind: "provider_failure"; failure: ProviderFailure & { class: "transient" | "definitive" }; call: ExpansionCallEvidence }
  | { kind: "definitive_failure"; reason: "auth" | "quota" | "billing" | "capability" | "content_filter" | "invalid_request"; call: ExpansionCallEvidence }
  | { kind: "unknown_result"; reason: "timeout" | "abort" | "comm_lost"; failure: ProviderFailure & { class: "unknown" }; call: ExpansionCallEvidence }
  | { kind: "invalid_output"; reason: "decode_failed" | "dimensions_mismatch" | "aspect_mismatch" | "not_image"; returnedSize: string | null; call: ExpansionCallEvidence }
  | { kind: "export_failed"; reason: "source_decode_failed" | "source_dimension_mismatch" | "source_aspect_mismatch" | "artifact_format_not_jpeg" | "artifact_dimension_mismatch"; call: ExpansionCallEvidence }
  | { kind: "conflict"; reason: "content_conflict" | "identity_conflict" | "metadata_conflict" | "provenance_conflict"; detail: string; existing: ArtifactRecord | null; call: ExpansionCallEvidence }
  | { kind: "persistence_failed"; reason: "integrity_failure" | "persistence_failure"; detail: string; storagePath?: string; call: ExpansionCallEvidence }
  | { kind: "readback_failed"; reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict"; detail?: string; call: ExpansionCallEvidence }
  | { kind: "blocked"; reason: "pre_call_probe_indeterminate"; call: null };
```

`provider_failure` carrega classe transitória/definitiva e o motivo/evidência; `unknown_result` carrega a classe desconhecida. O módulo não converte nenhuma delas em retry, e `unknown_result` nunca é registrado como falha definitiva. `reused` antes da chamada tem `call: null`; um `reused` resultante de corrida após a chamada paga mantém a evidência dessa chamada, sem perder custo.

### Responsabilidade do chamador

- Ter autorização de execução única da operação (F60) e fornecer `attemptNumber`/`attemptRef` corretos.
- Decidir repetição/fallback conforme a política da F60; o módulo não repete.
- Reservar/confirmar/estornar crédito, entregar, publicar, alterar `campaigns` e liberar download — tudo fora do módulo.
- Escolher a campanha/fonte autorizada; o módulo só valida a identidade recebida.
- Tratar `existing_artifact_conflict`/`blocked` como decisão operacional, não como retry pago.

## Architecture / Files

Produção (novos):

| Arquivo | Papel |
|---|---|
| `src/lib/campaign/vertical-expansion/types.ts` | Contrato puro de entrada, resultado e evidência de chamada; reusa tipos F60/F60.1. |
| `src/lib/campaign/vertical-expansion/policy.ts` | Constantes puras derivadas de `ROLE_POLICY`: fonte 1152×1152, destino 1080×1920, provider 1152×2048, origem `ai_expansion`, qualidade `low`, etapa `expansion`. |
| `src/lib/campaign/vertical-expansion/prompt.ts` | Prompt estático versionado `f60.3-expand-9-16-v1`; preservação de textos/preço/logo/avisos/composição. |
| `src/lib/campaign/vertical-expansion/model.ts` | Tupla esperada pura + validação de qualidade/modelo elegível; resolução server-only da linha ativa do catálogo. |
| `src/lib/campaign/vertical-expansion/failure.ts` | Mapeamento puro de `AiInvocationError`/erros para `ProviderFailure` via `classifyProviderFailure`; sem política de retry. |
| `src/lib/campaign/vertical-expansion/reuse-compatibility.ts` | Predicado puro vertical↔fonte (papel, formato, origem, dimensões, MIME, vínculo, proveniência exata, checksum). |
| `src/lib/campaign/vertical-expansion/reuse-evidence.ts` | Verificação read-only da evidência durável do vertical (F60.1 `buildObjectEvidence` + `verifyObjectEvidence`). |
| `src/lib/campaign/vertical-expansion/probe.ts` | Gate pré-chamada: linha explícita + objeto separados, órfão, evidência e decisão `reuse`/`adopt`/`block`/`proceed`. |
| `src/lib/campaign/vertical-expansion/transport.ts` | Cria o adapter reutilizando `UpstreamImagesAdapter` com `maxRetries: 0` e `VerticalImagesAdapter` para `returnedSize`; timeout efetivo; loader injetável em testes. |
| `src/lib/campaign/vertical-expansion/telemetry.ts` | Contexto/sink bufferizado; um flush protegido por chamada, inclusive em falhas posteriores; metadata de correlação e desfecho; custo calculado/reportado. |
| `src/lib/campaign/vertical-expansion/output.ts` | Validação por conteúdo do retorno 1152×2048 e exportação via `resizeVerticalToJpeg1080x1920`. |
| `src/lib/campaign/vertical-expansion/expand.ts` | Orquestração server-only do fluxo completo; única API pública do módulo. |

Compartilhado (afetado, aditivo):

| Arquivo | Mudança |
|---|---|
| `src/lib/ai/adapters/upstream-images.ts` | Opções aditivas de `maxRetries` no loader/cliente e de preservação de `usage` quando a resposta não traz imagem; default atual preservado (sem opção = comportamento atual). |
| `src/lib/campaign/__tests__/support/fake-artifact-backend.ts` | Fake de DB/Storage extraído da quick 261111-idz (somente testes). |
| `src/lib/campaign/square-preparation/__tests__/support/fake-artifact-backend.ts` | Passa a re-exportar o fake comum; testes existentes não mudam. |
| `src/lib/campaign/__tests__/support/jpeg-fixtures.ts` | Helpers JPEG determinísticos + fixture 1152×2048. |
| `src/lib/campaign/square-preparation/__tests__/support/jpeg-fixtures.ts` | Re-exporta os helpers comuns e mantém as constantes específicas do quadrado. |

Nenhum arquivo de produção da F60/F60.1/F60.2/F59/1:1/lab é alterado além da opção aditiva do adapter.

## Flow

1. Validar entrada: formato, UUIDs, papel `square_prepared`, `attempt.number` inteiro positivo, autorização; rejeitar path/url/bytes/modelo/qualidade/prompt/tamanho enviados pelo chamador.
2. Recuperar a fonte com `retrieveCompositionArtifact`; exigir `integral`, papel `square_prepared`, 1152×1152, JPEG. Mapear ausência/invalidez/indeterminação para resultado tipado.
3. Resolver a identidade de destino `(store, campaign, operationId, "vertical")`; reafirmar autorização no probe.
4. Executar o gate pré-chamada (D5). Se `reused`/`adopt` → devolver sem chamar. Se `block`/`indeterminate` → devolver falha tipada sem chamar.
5. Resolver o modelo no catálogo (D2) e o pricing específico de qualidade (D9); falhar antes da chamada se ausente/inativo/`code_default`/cobertura incompleta das tarifas de usage (incluindo `image_unit_usd`).
6. Criar o contexto de telemetria bufferizado (`operationRunId = operationId`, `traceId = callId`, `attemptNumber = attempt.number`, `internalCost` uso-tokens) e aplicar o timeout efetivo: `min(timeoutMs do chamador, 180 s)` quando houver prazo menor.
7. Executar exatamente uma chamada com o adapter sem retry, prompt estático e uma referência; medir duração e `returnedSize`.
8. Classificar o desfecho do provider. Em erro desconhecido → `unknown_result`; em falha transitória/definitiva → `provider_failure`; em auth/quota/billing/capacidade da requisição/conteúdo/entrada → `definitive_failure`; nunca repetir.
9. Em sucesso HTTP, decodificar os bytes; exigir 1152×2048/9:16. Em falha → `invalid_output` com custo/usage preservados.
10. Exportar 1080×1920 JPEG pelo pipeline existente; verificar a saída por decode completo.
11. Persistir via F60.1 (`origin: "ai_expansion"`, fonte interna); mapear conflito/falha sem sobrescrever nem apagar. Se a F60.1 devolver `reused` após uma chamada paga (corrida), devolver `reused` mantendo a evidência da chamada.
12. Readback via F60.1; devolver os bytes autoritativos.
13. Fazer um único flush da telemetria em caminho protegido, cobrindo sucesso e todos os desfechos de falha após a chamada; devolver `call` com usage/custo observados. A gravação é a do mecanismo existente (best-effort); falha de flush não altera o resultado e não dispara nova geração.
14. Em qualquer caminho, não tocar crédito, `campaigns`, entrega, download ou URL.

## Identity, Idempotency and Concurrency

- **Artefato de origem**: `(storeId, campaignId, source.operationId, "square_prepared")`.
- **Artefato de destino**: `(storeId, campaignId, operationId, "vertical")`.
- **Tentativa**: `(operationId, attempt.number, attempt.reference)` — o módulo apenas registra; a autoridade é a F60.
- **Chamada**: `callId` (UUID) = `trace_id`; uma por invocação paga.
- **Reutilização**: só com linha integral + bytes compatíveis + proveniência compatível + evidência durável verificada; ou órfão íntegro com evidência compatível adotado via F60.1.
- **Concorrência**: a F60 garante uma execução em andamento por operação. O módulo não cria lock/tabela de tentativas; duas invocações concorrentes que ignoram a F60 podem gerar duas chamadas. Após o vertical existir, ambas reutilizam. A persistência concorrente converge pela unicidade da F60.1 (um vencedor; o outro reutiliza ou recebe conflito).

## Cost / Telemetry Details

- Um envelope do gateway por chamada real; um único `generation_events` por flush.
- `operation_run_id = operationId` (correlaciona base + expansão; a base futura deve usar a mesma chave).
- `trace_id = callId`; `attempt_number = attempt.number`; `generation_type = campaign_image`.
- Metadata: etapa, operação, chamada, tentativa, tamanho solicitado/recebido, versão do prompt, artefato-fonte e desfecho do módulo.
- Custo: `provider_reported` quando o provider reportar; senão tokens reais × tarifas específicas de qualidade (`pricing_table`); senão `not_available`/`null`. Nunca 0,05 fixo, nunca zero para desconhecido.
- O custo é registrado também em saída inválida/truncada quando há usage; em falha sem usage, permanece desconhecido.
- A gravação usa o sink/tracker existentes, que são best-effort por contrato. O módulo não promete durabilidade além disso e não tenta gravar um segundo evento quando o flush falha.

## Data / Migration

**Nenhuma migration nesta fatia.** Reutiliza:

- `campaign_composition_artifacts` e bucket `campaign-internal-artifacts` (F60.1, migration `20261110202749_f60_1_composition_artifacts.sql`).
- `generation_events` (chamada/usage/custo/metadata).
- `ai_model_catalog` (linha ativa) e `ai_model_pricing` (linha vigente por qualidade).

Pré-requisito da prova real: confirmar que a migration da F60.1 e o bucket existem no ambiente autorizado. Se não existirem, parar; não reaplicar/renomear migrations existentes.

### Migration Plan

1. **Agora (proposta)**: nenhum arquivo `.sql`, nenhuma escrita em banco/Storage, nenhuma chamada paga.
2. **Implementação**: nenhuma migration nova; o módulo apenas lê catálogo/pricing e usa tabela/bucket existentes.
3. **Prova real (gate separado)**: confirmar no homolog que a F60.1 já está aplicada e que a tabela/bucket/colunas/trigger existem; não resetar, reinstalar ou reaplicar.
4. **Rollback**: não aplicável a schema nesta fatia; o artefato vertical criado na prova pode ser removido apenas por decisão operacional autorizada (o módulo não apaga).
5. **Produção**: fora do escopo; qualquer promoção é gate separado, com migration já existente e autorização explícita.

## Test Strategy

### Offline (obrigatório)

Provider, DB e Storage simulados nas fronteiras; Sharp/decoder reais com fixtures determinísticas; o módulo real é exercitado (não apenas o resultado mockado).

| Área | Casos |
|---|---|
| Entrada/autorização | UUID inválido; papel diferente de `square_prepared`; `attempt.number` inválido; path/url/bytes/modelo/qualidade/prompt/tamanho rejeitados; `owner` de outra loja; `system` sem vínculo; autorização ausente. |
| Fonte | `square_prepared` 1152×1152 íntegro; ausente; truncado/não-JPEG; dimensão errada; `metadata_conflict`; `indeterminate`; original/preparado intactos após sucesso. |
| Modelo/pricing | linha ativa resolve Sunburst low; linha ausente/inativa → zero chamadas; qualidade fora da lista → zero chamadas; pricing ausente/`code_default`/cobertura incompleta de tarifas de usage (mesmo com `image_unit`) → zero chamadas; nenhum fallback/seletor. |
| Reutilização | linha+objeto compatíveis+evidência → `reused`, zero chamadas; **linha encontrada + objeto desaparecido (`retrieve absent`) → bloqueio, zero chamadas**; linha ausente + objeto ausente comprovado → prossegue; linha incompatível → bloqueio, zero chamadas; órfão íntegro com evidência → adoção via F60.1, zero chamadas; órfão sem/with evidência inválida → bloqueio, zero chamadas; `info`/download indeterminado → bloqueio, zero chamadas. |
| Chamada única | exatamente uma `images.edit`; uma referência; `size`/`quality` corretos; `maxRetries: 0` capturado no loader; sem fallback/segunda chamada; `returnedSize` real. |
| Falhas | rate_limit → transitória; indisponibilidade/capacidade → transitória; saída inválida → definitiva; timeout/abort/perda → desconhecida; sem retry; resultado desconhecido não vira falha definitiva; custo conhecido preservado em saída inválida com usage; falha sem usage → custo `null`. |
| Validação/exportação | 1152×2048 válido → JPEG 1080×1920 verificado por decode; 1024×1024/1080×1920/outra proporção → `invalid_output`; truncado/não-imagem → `invalid_output`; sem persistência nesses casos; bruto não persistido. |
| Persistência | `created` com `vertical`/`ai_expansion`/proveniência correta; readback; conflito de conteúdo/identidade/metadados/proveniência; falha de persistência após upload; falha de readback; nenhuma sobrescrita/delete; original/preparado intactos. |
| Fronteiras proibidas | zero writes em `campaigns`; zero RPC/crédito; zero `createSignedUrl`/`getPublicUrl`; zero download público; zero alteração de status/entrega; zero `update`/`delete` de objeto. |
| Telemetria | um evento por chamada real; sem duplicação; `operationId`/`callId`/etapa/provider/modelo/qualidade/tamanhos/duração/resultado/usage; custo com origem; desconhecido `null`; correlação base+expansão pelo mesmo `operationId`; flush presente em sucesso e em falha de decode/exportação/persistência/readback/exceção inesperada; falha de flush não gera nova chamada. |
| Concorrência | duas leituras com vertical já existente → ambas reutilizam, zero chamadas; persistência concorrente → um vencedor e o outro reutiliza/conflito; probe indeterminado não chama. |

### Prova real pequena (gate separado, somente com autorização)

- Reutilizar o homolog existente e a infraestrutura validada; **não** criar ambiente descartável, resetar, reinstalar ou reaplicar migrations.
- Preflight não pago: confirmar ambiente, credenciais, migration/bucket da F60.1, linha ativa do catálogo, pricing específico de Sunburst low, prompt/versão e uma campanha controlada com `square_prepared` 1152×1152.
- A fonte controlada deve ser um `square_original` 1024×1024 do novo fluxo 1:1 (com texto/preço/logo/aviso) preparado pela quick 261111-idz sem chamada paga, ou um `square_prepared` 1152×1152 já existente; o executor pode escolher a arte. Arte legada 1080×1080 não é fonte válida do papel `square_original`; se não houver fonte 1024/preparada adequada, a prova para — não se gera nova arte quadrada nesta fatia.
- Preferir exercício server-side direto; não adicionar login de lojista se não for necessário. Se autenticação for indispensável, reutilizar o padrão local da F47 (captcha de teste já configurado e `captchaToken: "XXXX.DUMMY.TOKEN"`), sem desativar captcha nem inventar outra estratégia.
- Uma campanha controlada, preferencialmente com texto, preço, logo e aviso obrigatório, para avaliar expansão e fidelidade. Reutilizar arte existente; não gerar nova copy/arte quadrada nesta fatia.
- Solicitar antes: quantidade máxima de chamadas (proposta: **1**), orçamento e autorização explícita. Sem retry automático pago; em falha, preservar evidência, diagnosticar e parar.
- Manifesto/log da prova: ambiente, campanha, fonte, `operationId`, `callId`, modelo/qualidade, tamanho solicitado/recebido, duração, usage, custo/origem, artefato/checksum, resultado e decisão. Reutilizar no fechamento; não exigir reexecução por documentação.
- Aceite técnico (dimensões, JPEG, checksum, proveniência, custo) separado do aceite visual humano (textos, preço, logo, avisos, composição central, ausência de emendas).
- Custo verificado (`provider_reported` ou `pricing_table`) é requisito do aceite técnico da prova. Se o custo vier `not_available`/`null`, preservar evidência, parar e reconciliar antes de qualquer nova chamada paga.
- Nenhuma produção, merge, push ou deploy nesta fatia.

## Decisions Locked in Review

Nenhuma pendência bloqueante. As decisões abaixo foram fechadas na revisão da proposta e substituem as recomendações anteriores:

| Ponto | Decisão |
|---|---|
| Vertical incompatível existente | **Bloquear sem chamada paga**; nunca sobrescrever/regerar. |
| Pricing pré-chamada | **Exigir cobertura das tarifas necessárias ao cálculo por usage** (entrada/saída textual, entrada/saída de imagem e cache textual/imagem) **além de `image_unit_usd`**; `image_unit_usd` sozinho não comprova cobertura. Cobertura incompleta → zero chamadas. |
| Timeout | **Padrão de 180 s**, respeitando prazo menor informado pelo chamador. |
| Capability do catálogo | **Reutilizar `campaign_product_image`**; sem capability nova/migration. |
| Credencial paga | **Caminho de credencial do produto já existente**, autorizado no gate; **não** usar silenciosamente a chave da bancada. |
| Fonte da prova | **Uma campanha controlada 1024 do fluxo atual, preparada pela quick**; o executor pode escolher a arte. Se não houver arte 1024/preparado, parar — não gerar nova arte quadrada. |
| Apoio dos testes | **Extração com re-export**, mantendo os testes anteriores funcionando. |
| Bruto 1152×2048 | **Não persistir nesta fatia**; apenas evidência em metadata. |
