## Context

A iniciativa 60 já entregou as peças isoladas do 9:16 por expansão e elas não devem ser reabertas:

- **F60** — operação `9_16_two_stage` com identidade `(campaign_id, operation_id)`, etapas `base`/`expansion`, autorização de execução única, classificação de falha, resultado desconhecido persistido, integração financeira de 1 crédito e views de leitura compartilhada.
- **F60.1** — `campaign_composition_artifacts` + bucket privado `campaign-internal-artifacts`, papéis `square_original` (1024×1024), `square_prepared` (1152×1152) e `vertical` (1080×1920), persistência imutável, checksum, proveniência e evidência durável.
- **F60.2** — preparação determinística `square_original` → `square_prepared`.
- **F60.3** — expansão paga `square_prepared` → `vertical` JPEG 1080×1920, com gate linha/objeto, uma chamada, sem retry oculto e telemetria por chamada.
- **F60.4** — etapa `base` interna: copy + arte quadrada 1024, configuração/conteúdo congelados, uma chamada de imagem e uma requisição de copy por invocação, sem crédito/entrega/UI.

Falta o **percurso do lojista**: selecionar 9:16, gerar base + copy, preparar 1152, expandir, apresentar/baixar o vertical e confirmar 1 crédito. Hoje `src/app/api/campaign/generate-image/route.ts` despacha 9:16 para `runProductVertical9x16Generation`, o caminho direto antigo, que gera uma única imagem vertical e não usa a base quadrada. O orquestrador novo não pode chamar `runProductOneToOneGeneration` como atalho: esse fluxo reserva/confirma/estorna crédito, emite resposta pública e entrega — efeitos que precisam de um único dono no novo percurso.

### Mapa de reutilização, criação e adaptação

| Necessidade | Módulo existente | Uso nesta fatia | Lacuna/restrição verificada |
|---|---|---|---|
| Controle de etapas, tentativas, exclusividade, unknown | `ProductTwoStageOperationClient`, RPCs `product_9_16_*`, `product_9_16_two_stage_*` | Reutilizar integralmente | Falta um leitor **read-only** de operação/steps/outcomes para status e detecção de reenvio sem `open`/`resume` (que travam linha). |
| Uma reserva / confirmação / estorno | `TwoStageFinancialService`, `ProductOneToOneCreditOperationClient` | Reutilizar; fornecer sonda vertical real e projeção | `confirmOnVerticalDelivery`/`refundOnDefinitiveFailure`/`resolveUnknown` já aceitam `VerticalArtifactProbe`; falta a implementação para `campaign_composition_artifacts` e a projeção com fonte `composition`. |
| Base quadrada + copy | `runSquareBase`, `SquareBaseInput/Result` | Chamar uma vez por tentativa `base` autorizada | O módulo não reserva/entrega/finaliza etapa; o orquestrador deve traduzir o resultado para `finish`/`recordOutcome` e decidir retry via F60. |
| Preparação 1152 | `prepareSquareForExpansion` | Chamar entre base e expansão | Não é etapa nomeada da F60; deve ser tratada como trabalho determinístico idempotente, fora de tentativa paga. |
| Expansão | `expandVerticalToNineSixteen` | Chamar uma vez por tentativa `expansion` autorizada | O módulo exige `square_prepared` e devolve `expanded`/`reused`/falhas tipadas; o orquestrador não repete chamadas. |
| Persistência/recuperação | F60.1 (`persistCompositionArtifact`, `retrieveCompositionArtifact`, `getArtifactByIdentity`, storage/path/evidence) | Única autoridade dos três papéis | Não expõe assinatura de URL; a nova camada de entrega precisa assinar somente o papel `vertical` após a entrega. |
| Copy/recovery | `runSquareBase` (copy), `ProductOneToOneCopyRecoveryClient`, `copy-state` | Reutilizar política e persistência | A rota de recuperação atual reconstrói contexto da loja **atual**; a origem nova deve usar o payload congelado da F60.4. |
| Primeira execução antes do congelado | `campaigns.input_snapshot`, `campaigns.identity_snapshot`, bucket `campaign-images` (`inputs/`) | Persistir descritores/copyContext/economicSnapshot e arquivos originais; reconstruir `dataUrlPrefix + base64` com hash exato do data URL | Hoje o novo fluxo não persiste os bytes de entrada; se a requisição morrer após a reserva e antes da F60.4, não há como recompor sem dados atuais ou novo briefing. |
| Eventos NDJSON e UI | `use-campaign-form`, `GenerationProgress`, `unknown-result-panel` | Reutilizar a tela e o parser | Hoje não existe `processing`/continuação explícita entre requisições; o parser trata qualquer fechamento sem terminal como unknown. |
| Projeção de entrega | `projectDeliveredCampaign` | Reutilizar com fonte de artefato explícita | Hoje valida somente `product_1_1_campaign_artifacts` e assume `artifactStoragePath` 1:1. |
| Download/detalhe/lista/thumbnails | rotas e `display.ts`/`list.ts` | Ramificar por origem persistida | Consumidores atuais presumem `campaign-images` ou o store vertical direto; o vertical novo vive no bucket interno da F60.1. |
| Administração de pendências | `SupabasePendingOperationsRepository`, `resolvePendingOperation`, `createPendingFormatAdapter` | Reutilizar | O adapter atual só conhece 1:1 e o vertical direto; precisa reconhecer a origem `9_16_two_stage` e projetar a composição. |
| Custos/telemetria | `AiGateway`, sink único, `generation_events`, pricing existente | Reutilizar | O orquestrador não escreve custo; apenas correlaciona `operation_run_id = operationId` entre base, copy e expansão. |
| Gate de ativação | `feature_flags`, `FeatureFlagService` | Nova chave fail-closed | A flag antiga `product_9_16_enabled` controla o caminho direto e não deve ser reutilizada como gate do novo caminho. |

## Goals / Non-Goals

**Goals:**

- Entregar um orquestrador server-only próprio para o percurso 9:16 por expansão, compondo F60/F60.1/F60.2/F60.3/F60.4.
- Abrir **uma** operação e **uma** reserva de 1 crédito, confirmar somente após vertical íntegro e entrega autorizada, estornar uma única vez em falha definitiva sem entrega e jamais presumir retry/estorno em resultado desconhecido.
- Retomar a mesma operação a partir das etapas persistidas, inclusive entre requisições e antes do congelado F60.4, sem regenerar base concluída, sem nova reserva e sem chamadas concorrentes duplicadas.
- Reutilizar a tela de processamento e distinguir, no contrato de eventos/status, **processando/entre etapas** de **resultado desconhecido**.
- Entregar apenas o vertical final 1080×1920 JPEG + copy; manter base/preparado internos; acessar o vertical pela F60.1 sem duplicá-lo em `campaign-images`; preservar miniaturas leves derivadas para os cards.
- Desligar novas gerações diretas de 9:16 na ativação, preservar o código e manter campanhas históricas legíveis/baixáveis, sem conversão silenciosa.
- Manter `1:1` funcionalmente inalterado.
- Preservar custos reais correlacionados por operação; desconhecido é `null`/`not_available`, nunca zero.

**Non-Goals:**

- Dois formatos na mesma solicitação, aquisição posterior do outro formato ou migração de campanhas 1:1 para 9:16.
- Recriar compositor, prompt, copy, preparação, expansor, gateway ou telemetria.
- Chamar `runProductOneToOneGeneration`/`runProductVertical9x16Generation` para gerar a base ou o vertical novo.
- Criar fila, worker, cron, serviço externo, tabela de jobs ou infraestrutura de processamento assíncrono.
- Alterar prompts, modelos, qualidades, pricing, catálogo, compositor, políticas F60 ou contratos das specs F60.1/F60.2/F60.3/F60.4.
- Duplicar o vertical em `campaign-images`, gerar segunda cópia integral da entrega, alterar retenção ou limpar artefatos nesta fatia. A miniatura derivada de exibição é a única exceção e não é entrega.
- Alterar o comportamento do 1:1, do 9:16 direto histórico, do laboratório ou do piloto 1:1.
- Implementação, migration, banco/Storage, provider/chamada paga, ativação, merge, push ou deploy nesta rodada.

## Decisions

### D1 — Orquestrador próprio em `src/lib/product-9-16-two-stage/orchestration/**`

O módulo novo é server-only e recebe: identidade `(storeId, campaignId, operationId)`, `authorization` resolvida no servidor, o conteúdo/briefing/identidade já congelados pela rota, o orçamento da requisição e o modo (`initial`/`continue`). Ele devolve uma resposta NDJSON e não conhece componentes React.

Ele **não** é um segundo serviço financeiro: usa `TwoStageFinancialService` e `ProductTwoStageOperationClient`; **não** é um segundo compositor: chama `runSquareBase`; **não** é um segundo expansor: chama `expandVerticalToNineSixteen`; **não** é um segundo persistidor: usa F60.1. O import do orquestrador novo na rota é dinâmico e ocorre somente no ramo 9:16, preservando o isolamento de bundle/carregamento do caminho 1:1.

Alternativa descartada: reutilizar `runProductVertical9x16Generation` como “quase orquestrador”. Ele concentra crédito, fence, falha, retry, projeção e resposta pública do caminho direto; adaptá-lo misturaria duas autoridades e manteria o caminho antigo vivo.

### D2 — Origem canônica persistida, não inferida pelo formato

A origem do novo percurso é gravada no `campaigns.input_snapshot` da campanha criada pelo novo caminho:

```ts
{
  campaignFormat: "9:16",
  formatContractVersion: "f59-vertical-9-16-v1", // contrato de formato existente, inalterado
  generationOrigin: "9_16_two_stage",
  generationContractVersion: "f60.5-two-stage-9-16-v1"
}
```

- `resolveCampaignFormat` continua sendo a autoridade do **formato** e ignora as chaves novas.
- Um helper puro novo (`resolveCampaignGenerationOrigin`) classifica:
  - `two_stage_9_16` — par `generationOrigin`/`generationContractVersion` exato;
  - `historical` — ausência das duas chaves (inclui 1:1 e 9:16 direto antigo);
  - `indeterminate` — chave presente porém malformada/versão desconhecida.
- As chaves entram no snapshot congelado/hash de conteúdo da campanha nova (somente no ramo 9:16). Reenvio com conteúdo divergente continua `operation_identity_conflict`.
- Para leitura/entrega, `two_stage_9_16` exige também a linha de controle F60 `(campaign_id, operation_id)`; marcador sem linha de controle em leitura é `indeterminate`/fail-closed. A linha de controle é a prova verificável da operação; o formato isolado nunca decide o caminho.
- Uma campanha `historical` 9:16 **nunca** é convertida para `two_stage_9_16`; uma campanha `two_stage_9_16` nunca é lida como direta.

Alternativa descartada: reutilizar `formatContractVersion` como marcador de origem. Isso quebraria a resolução histórica e misturaria formato com mecanismo de geração.

### D3 — F60 é a única autoridade de execução; o orquestrador não cria política paralela

Para cada etapa:

1. O orquestrador lê o estado persistido (steps/outcomes/credit).
2. Se a etapa está `done`, não a executa.
3. Se há `in_progress`, não adquire nem chama provider; devolve `processing` (`step_in_progress`).
4. Se é a vez da etapa, adquire com o `requestId` **daquela etapa** e `target` informados pela F60. Somente `authorization: "execute"` autoriza chamada.
5. Executa **no máximo uma** chamada de imagem daquela etapa por invocação (a base também pode fazer uma requisição de copy, por contrato F60.4).
6. Finaliza com `finish` usando o `attemptToken`; falha tardia é recusada.
7. Em falha, grava `recordOutcome` (`unknown` ou `failed`) quando aplicável e delega retry/limite à F60.

O orquestrador não conta tentativas, não escolhe fallback, não cria lock, não abre uma segunda operação e não reserva crédito por etapa. Erros de envelope/RPC da F60 são fail-closed: não autorizam provider, retry, estorno ou entrega e viram estado seguro (`processing`/`unknown`/erro tipado) conforme a leitura posterior.

**Identidade de aquisição por etapa (correção obrigatória):** a F60 usa `request_id` único por operação e o vincula à etapa/alvo. Reutilizar o mesmo `requestId` na expansão após a base retorna `operation_identity_conflict`; reutilizá-lo numa repetição retorna o claim antigo (`query_only`). Portanto:

- cada aquisição SHALL ter uma identidade própria: `acquisitionIds.base` e `acquisitionIds.expansion` são UUIDs distintos;
- o mesmo par SHALL ser reutilizado apenas em uma repetição idêntica da **mesma invocação** (mesmo HTTP request);
- uma nova invocação/continuação SHALL gerar um novo par, permitindo uma nova tentativa conforme o limite F60;
- nunca se reutiliza o ID da base para a expansão, nem o ID de uma tentativa anterior para uma repetição;
- o modo `initial` gera o par no servidor; o modo `continue` recebe o par do cliente no corpo estrito, com `base != expansion`.

### D4 — Continuação explícita entre requisições, sem fila

Cada invocação tem **um deadline absoluto** ancorado no início da requisição (`deadlineAt(requestStartedAtMs, PRODUCT_1_1_GENERATION_DEADLINE_MS)`). Todas as etapas da invocação compartilham esse deadline; nenhuma etapa ganha um novo orçamento dentro da mesma requisição.

Antes de adquirir uma etapa, o orquestrador exige orçamento suficiente para a chamada e para a reserva de persistência (`remainingBeforeDeadline`/`remainingBudget`). Se não couber:

- **não adquire** a etapa;
- devolve um evento terminal **da requisição** `{ type: "processing", state: "between_steps", nextStep, canContinue: true }`;
- a operação permanece com a etapa `pending`/`failed` persistida, sem claim residual e sem efeito financeiro.

O cliente continua a mesma operação por `POST /api/campaign/[id]/continue` (nova rota autenticada, same-origin, ownership), com corpo estrito `{ operationId, requestIds: { base, expansion } }`, onde os dois UUIDs são distintos e gerados por invocação. A rota:

- exige origem `two_stage_9_16` e linha de controle existente;
- **não** abre operação, **não** reserva crédito e **não** consulta a flag de novas solicitações (a flag bloqueia apenas nova etapa paga);
- valida `requestIds.base != requestIds.expansion` e entrega o ID da etapa à aquisição F60; repetição do mesmo par na mesma invocação devolve `query_only` e não executa de novo;
- executa a próxima etapa que couber no novo orçamento e devolve o mesmo contrato NDJSON.

O cliente SHALL gerar um novo par `{ base, expansion }` a cada nova continuação; o par é estável apenas para repetir a mesma requisição HTTP. A base e a expansão nunca compartilham `requestId`.

Assim, “entre requisições” é continuação autorizada da mesma operação, não uma fila. Se o navegador fechar, a operação permanece persistida e pode ser consultada; a execução só recomeça por uma nova continuação autorizada.

**Deadline entre invocações:** não existe coluna de deadline operacional na F60. A invocação seguinte tem um novo deadline absoluto porque é uma nova requisição; o que não se renova é o trabalho já concluído, a reserva, a contagem de tentativas ou a identidade. Persistir um deadline único de operação exigiria extensão de schema; não é proposto nesta fatia. Se a revisão exigir um teto de wall-clock por operação, isso deve voltar como decisão explícita.

### D5 — Uma chamada por etapa por invocação; retry é continuação, não loop oculto

O orquestrador executa no máximo uma tentativa de imagem de `base` e uma de `expansion` por invocação. Em falha transitória com tentativa disponível, ele finaliza a etapa como `failed`/`transient` e devolve `processing` com `nextStep`; a próxima continuação adquire a repetição. Isso:

- mantém cada chamada paga auditável e separada;
- preserva o limite F60 entre requisições;
- evita loop/retry oculto;
- permite que o usuário feche a aba sem perder a operação.

A copy da base roda de forma não bloqueante no módulo F60.4 e pode terminar depois; a entrega do vertical não espera copy concluída.

### D6 — Mapa de desfechos para `finish`/`recordOutcome`/financeiro

| Desfecho do módulo | `finish` | `recordOutcome` | Ação financeira |
|---|---|---|---|
| `completed` (base) / `expanded` ou `reused` (expansão) | `completed` | — | Nenhuma; segue para a próxima etapa |
| `provider_failure` transitória (rate limit/capacidade/pré-envio comprovado) | `failed`/`transient` | — | Se há tentativa F60 disponível, `processing`; se não, falha definitiva |
| `provider_failure` definitiva, `definitive_failure`, `invalid_output` | `failed`/`definitive` | `failed` | Estorno único se não houver vertical íntegro |
| `unknown_result` (timeout/abort/perda após possível envio) | `failed`/`unknown` | `unknown` | **Nenhum retry, nenhum estorno**; estado desconhecido |
| `blocked`/`snapshot_failed`/`frozen_state_read_failed` **antes de chamada paga, com causa transitória** (preflight, leitura/reparo, reserva de persistência, probe indeterminado) | `failed`/`transient` | — | `processing`; retry é gratuito e respeita o limite F60 |
| `content_divergence`, `frozen_state_conflict`, `artifact_without_frozen_state`, `frozen_content_invalid`, `existing_artifact_conflict`, `snapshot_failed` por identidade/conflito, `invalid_input`, `authorization_denied` | `failed`/`definitive` | `failed` | Estorno único se não houver vertical íntegro |
| `persistence_failed`/`readback_failed` **após chamada paga, sem artefato íntegro** | `failed`/`definitive` | `failed` | Estorno único se não houver vertical íntegro; sem nova chamada paga |
| `persistence_failed`/`readback_failed`/`conflict` **após chamada paga, com artefato íntegro e prova compatível** (base: congelado `complete`/`repairable` + binding; expansão: proveniência/evidência F60.3) | `completed` (após reconciliação) | — | Segue para a próxima etapa/entrega; sem retry pago |
| `persistence_failed`/`readback_failed`/`conflict` **após chamada paga, com artefato íntegro sem congelado/prova admissível** | `failed`/`definitive` | `failed` | Bloqueia; estorno único se não houver vertical; nunca conclui só pela imagem |
| `persistence_failed`/`readback_failed`/`conflict` **após chamada paga, com sonda indeterminada** | `failed`/`unknown` | `unknown` | Sem retry, sem estorno; resolução administrativa |
| `source_unavailable`/`model_unavailable`/`pricing_unavailable`/`conflict`/`export_failed` | `failed`/`definitive` | `failed` | Estorno único se não houver vertical íntegro |
| `source_unavailable`/`blocked` por indeterminação de Storage **sem chamada paga** | `failed`/`transient` | — | `processing`; retry é gratuito |

Regras adicionais:

- **Reconciliação antes do `finish`:** uma falha pós-chamada (`persistence_failed`, `readback_failed`, `conflict`) pode ter deixado o artefato íntegro (upload feito, linha/readback/telemetria falharam). Antes de finalizar a etapa como falha, o orquestrador SHALL reconciliar **somente** por uma prova compatível, nunca pela mera existência/integridade da imagem:
  - **base:** usar o gate da F60.4 (`probeSquareBaseTarget`/admissibilidade) e exigir estado congelado `complete` ou `repairable` com binding da **mesma operação**. Arte `square_original` íntegra + congelado `absent`/`unproven`/`corrupt`/`indeterminate`/de outra operação SHALL bloquear (`artifact_without_frozen_state`/conflito) e SHALL NOT ser finalizada como `completed`.
  - **expansão:** usar a compatibilidade/evidência do F60.3 (fonte `square_prepared`, origem `ai_expansion`, proveniência, `derived_from_artifact_id`, checksum e evidência durável). Vertical integral, porém incompatível ou sem evidência, SHALL bloquear e SHALL NOT ser finalizado como `completed`.
  - Se a prova compatível existir, a etapa SHALL ser finalizada como `completed` e o fluxo SHALL seguir; se a sonda for indeterminada, a etapa SHALL ser finalizada como desconhecida (`failed`/`unknown` + `recordOutcome(unknown)`), sem retry e sem estorno; se estiver ausente/inválida confirmada, aplica a classificação da tabela.
  Isso evita estornar uma entrega comprovadamente existente e evita que um `finish(failed)` bloqueie a entrega vertical (`confirmOnVerticalDelivery` exige steps `done`), sem afrouxar a proteção `artifact_without_frozen_state`.
- **Unknown de provider não é reconciliado em entrega:** `unknown_result` (timeout/abort/perda após possível envio) permanece desconhecido e vai para resolução administrativa; não se entrega automaticamente por um artefato encontrado, porque a tentativa não confirmou o desfecho.
- **Reconciliação tardia:** se um artefato íntegro só for observado depois de a etapa já ter sido finalizada como falha, o sistema SHALL NOT reabrir/reescrever a etapa nem forçar entrega; o caso vai para resolução administrativa, que pode entregar a arte existente somente com prova de compatibilidade/evidência e vínculo, ou estornar.
- **Nunca** confirmar crédito por base concluída, por preparação concluída ou por expansão concluída sem entrega.
- `finish` que falhar por resposta tardia/terminal não produz efeito; o orquestrador relê a autoridade financeira e emite `result`/`error`/`unknown` conforme o estado persistido.
- Se `recordOutcome`/`finish` falharem por infraestrutura, o orquestrador emite `unknown` com referência de suporte e **não** tenta compensar com retry ou estorno presumido; o claim residual é resolvido pela via administrativa.
- `refundOnDefinitiveFailure` só estorna com sonda `absent`; `invalid`/`indeterminate` ⇒ `unknown` operacional, sem estorno. Se a sonda for `integral`, o caminho correto é entrega, não estorno.
- Após estorno confirmado, o orquestrador SHALL projetar a campanha fechada (idempotente, sem tocar crédito/artefato). Falha dessa projeção não desfaz o estorno; o detalhe continua lendo a autoridade financeira e a listagem pode ser reparada depois.
- O estorno só é tentado antes de `beginPublication` ou depois de a publicação estar encerrada; `publication_state` `in_flight`/`result_unknown`/`published` SHALL NOT ser tratado como falha definitiva nem estornado.

### D7 — Entrega única do vertical e projeção da campanha

A entrega autorizada segue:

1. `expansion` está `done`.
2. Sonda vertical real: `retrieveCompositionArtifact` do papel `vertical` (bytes, dimensões 1080×1920, MIME JPEG, checksum, evidência/path).
3. `beginPublication` adquire o token/fence da operação de crédito.
4. `confirmOnVerticalDelivery` revalida autoridade, steps `done`, sonda integral, token e então `markArtUploaded` + `deliver`.
5. Projeção da campanha: `status = ready`, `error_message = null`, `storage_path = <path determinístico do vertical na F60.1>`.
6. Geração **best-effort** de uma miniatura de exibição derivada do vertical (`thumb-v1.webp`), usando o mecanismo existente de `campaign-images`, sem bloquear a entrega e sem criar segunda cópia do vertical.
7. Evento `result` somente depois de crédito `delivered` + vertical íntegro + projeção aplicada (ou já aplicada).

`projectDeliveredCampaign` recebe uma fonte de artefato **aditiva**:

```ts
type DeliveredArtifactSource =
  | { kind: "product_1_1" } // default histórico; comportamento atual
  | {
      kind: "composition";
      role: "vertical";
      expectedPath: string; // compositionArtifactStoragePath(identity)
    };
```

No modo `composition`, a projeção valida a linha em `campaign_composition_artifacts` por `(campaign_id, operation_id, role)`, o `store_id`, o path exato, dimensão/MIME e a operação `delivered`; não toca `product_1_1_campaign_artifacts`, não copia bytes e não altera aprovação comercial.

`campaigns.storage_path` passa a ser um ponteiro para o vertical interno. Nenhum consumidor pode assumir que todo `storage_path` vive em `campaign-images`: o bucket é decidido pela origem persistida + F60.1. Testes de contrato cobrem essa premissa.

Se a projeção falhar após o crédito `delivered`, o orquestrador devolve `processing` (`delivery_projection_pending`, `canContinue: true`). A continuação reaplica a projeção idempotente, sem nova chamada paga, nova confirmação ou novo crédito. Só emite `result` quando a apresentação estiver consistente.

Alternativa descartada: copiar o vertical para `campaign-images` para reutilizar os consumidores antigos. Viola a decisão de arquivo único e cria segunda verdade de bytes. A **miniatura derivada** é a exceção explícita: é um derivado de exibição leve, não o vertical de entrega.

### D8 — Acesso ao vertical: um adaptador, três modos, nenhum papel interno exposto

Um adaptador server-only (`nineSixteenVerticalAccess`) resolve, a partir da origem persistida:

- **`previewUrl`**: exige operação `delivered` + linha `vertical` compatível (role/path/dimensão/MIME) e assina o objeto **original** no bucket `campaign-internal-artifacts` com TTL curto. Não baixa bytes.
- **`thumbnailUrl`**: exige operação `delivered` e assina a **miniatura derivada** (`thumb-v1.webp`) no bucket `campaign-images`; não usa o original inteiro no card.
- **`downloadBytes`**: exige operação `delivered` + `retrieveCompositionArtifact` integral (bytes/checksum) e devolve os bytes autoritativos do original.
- **`not_available`**: qualquer estado não entregue, origem divergente, linha ausente/incompatível ou indeterminação.

Regras:

- O adaptador **só** consulta o papel `vertical`; nunca `square_original`/`square_prepared`.
- Nenhuma URL assinada é criada antes de `delivered`.
- A miniatura é gerada a partir do vertical no momento da entrega ou por reparo autorizado; é best-effort e não bloqueia crédito/projeção.
- Para a miniatura, o caminho do vertical de composição é reconhecido pelo mecanismo existente (`deriveThumbnailPath`) e mapeado para `campaign-images/{store}/{campaign}/{operation}/vertical.thumb-v1.webp`; o vertical original permanece no bucket interno.
- Detalhe usa `previewUrl` do **vertical original**; download usa `downloadBytes` do **vertical original**; listagem usa a **miniatura derivada** (`thumb-v1.webp`) do mesmo vertical, pelo mecanismo existente de `campaign-images`.
- A miniatura é um **derivado de exibição** (≤288 px, WebP), não uma segunda cópia da entrega. O vertical final continua único no bucket interno; preview e download nunca usam a miniatura.
- A listagem não copia o vertical para `campaign-images`; apenas assina a miniatura derivada. Se a miniatura estiver ausente/ilegível, o card usa placeholder; não carrega o original inteiro como fallback silencioso.
- Campanhas históricas (1:1 e 9:16 direto) continuam usando os stores/paths atuais, sem mudança de bytes.

### D9 — Copy: política existente, conteúdo congelado na origem nova

- A base usa `runSquareBase` com `copyContext` resolvido server-side; a copy é persistida pelo caminho F60.4 (`ProductOneToOneCopyAcquisitionClient`/`drainCopyTask`/`copy-state`), sem regenerar imagem e sem novo crédito.
- Falha/indisponibilidade da copy **não** bloqueia a entrega do vertical. O detalhe mostra a arte e a superfície de recuperação de copy existente.
- Na recuperação de copy da origem `two_stage_9_16`, o runner é construído a partir do **payload congelado** da F60.4 (`readSquareBaseFrozenState` + `parseFrozenPayload`: `briefing`, `copyContext`, intenção, direção e versões), nunca de dados atuais da loja.
- Se o estado congelado estiver `bound_to_other_operation`/`unproven`/`corrupt`/`indeterminate`, a recuperação falha fechada sem chamada de IA. `repairable` equivalente pode ser reparado pelo caminho F60.4 antes de gerar a copy.
- A recuperação de copy não regenera imagem, não confirma crédito e não estorna; o limite de tentativas existente permanece.
- Para `two_stage_9_16`, a barreira de autorização de **novo fluxo** é substituída por: ownership + origem persistida + linha de controle + estado congelado válido. A recuperação é somente texto de uma operação já existente; não cria campanha, imagem ou crédito, portanto não depende da flag de novas solicitações 9:16. A flag continua bloqueando apenas novas gerações.
- Campanhas históricas mantêm o comportamento atual da rota de recuperação (contexto da loja), sem conversão para o payload congelado.

### D10 — Status somente leitura e distinção processing × unknown

A rota `generation-status` passa a ramificar por origem:

- **Histórico/1:1:** mantém `queryProductOneToOneOperation`, com o prober correto por formato (vertical direto para 9:16 histórico, 1:1 para quadrado).
- **`two_stage_9_16`:** usa um leitor read-only novo (`getOperationView`) que faz `SELECT` em `product_9_16_two_stage_operations`, `..._steps`, `..._outcomes` e na linha de crédito. **Não** usa `product_9_16_resume_operation` (que adquire `FOR UPDATE`) nem `open`/`acquire`.

O estado devolvido é fechado:

```ts
type TwoStageStatus =
  | { state: "delivered" | "refunded"; terminal: true; ... }
  | { state: "unknown"; terminal: false; supportReference: string | null; ... }
  | {
      state: "processing";
      terminal: false;
      phase: "step_in_progress" | "between_steps" | "delivery_pending" | "preparation_retry" | "suspended";
      canContinue: boolean;
      nextStep: "base" | "expansion" | "delivery" | null;
      base: StepView;
      expansion: StepView;
    };
```

`canContinue` é derivado apenas de estado persistido (sem lock): `true` quando não há claim ativo, não há `unknown`/`failed` final e a próxima ação F60 não é `wait`/`blocked`. A rota não inicia execução, não assina URL e não promove estado por presença de objeto; o cliente decide continuar por uma rota separada.

### D11 — Desligamento do 9:16 direto e tratamento de pendências históricas

- `generate-image` deixa de despachar **qualquer nova** solicitação 9:16 para `runProductVertical9x16Generation`.
- O entrypoint direto é preservado no código, mas não é importado por nenhuma rota; um teste de arquitetura garante zero referências em `src/app/**`.
- A flag nova `product_9_16_two_stage_enabled` (fail-closed, ausente = OFF) governa **novas solicitações** 9:16; a tela de campanha usa a mesma flag para habilitar o seletor. A flag antiga `product_9_16_enabled` deixa de decidir o caminho novo.
- Flag OFF:
  - nova campanha 9:16 ⇒ `503 format_unavailable`, sem criar campanha, reservar ou chamar provider;
  - rascunho 9:16 restaurado ⇒ mensagem de pausa e envio bloqueado (padrão F59 existente);
  - **não** há fallback para o direto antigo;
  - operação `two_stage_9_16` já existente permanece consultável e resolvível; continuação que exigiria **nova etapa paga** fica bloqueada em `processing`/`suspension` (`canContinue: false`), sem provider e sem reserva; entrega/projeção de vertical já comprovadamente íntegro/compatível pode ser concluída sem provider; a administração pode estornar/entregar pela via auditada.
- Campanhas 9:16 históricas (sem marcador):
  - `delivered` + arte íntegra ⇒ detalhe/listagem/download pelo store vertical direto, como hoje;
  - `refunded` ⇒ detalhe terminal, como hoje;
  - `reserved`/`art_uploaded`/`unknown` ⇒ **somente leitura**; nenhuma continuação executa o gerador direto. A UI mostra estado seguro de atendimento (`legacy_vertical_pending`), sem “Tentar novamente”, sem nova geração e sem conversão silenciosa. A resolução é administrativa (pendências) ou suporte.
- Uma campanha histórica nunca recebe marcador de origem nova; uma campanha nova nunca é lida pelo store direto.

### D12 — Gate de ativação separado e fail-closed

- Chave nova: `product_9_16_two_stage_enabled`, lida por `FeatureFlagService` com default `false`, sem envOverride e sem coortes.
- A chave ausente/erro ⇒ OFF. O deploy do código **não** ativa o percurso; a ativação é um checkpoint autorizado separado que cria/liga a linha em `feature_flags`.
- Suspender = desligar a chave. Isso bloqueia novas solicitações e novas etapas pagas; não reativa o direto antigo e não impede consulta, entrega/projeção de vertical já íntegro ou resolução administrativa.
- A ativação produtiva é separada do aceite técnico e do aceite humano.

### D13 — Custos correlacionados sem contabilidade paralela

- `operation_run_id = operationId` em todas as chamadas da operação (base, copy, expansão).
- `trace_id = callId` por chamada real; `attempt_number` e alvo vêm da F60; `metadata.stage`/`generation_type` preservam o evento real.
- O orquestrador não escreve `generation_events`, não calcula custo e não usa preço fixo aproximado.
- Custo desconhecido permanece `null`/`not_available`; estorno de crédito não apaga custo interno.
- A correlação de aceite é uma leitura por `operation_run_id`, sem nova tabela/ledger.

### D14 — Projeção/administração reconhecem a origem canônica

- `createPendingFormatAdapter` (ou um adaptador irmão) passa a resolver três perfis: 1:1, vertical direto histórico e `two_stage_9_16`.
- Para `two_stage_9_16`, o prober de pendências e a projeção usam a composição/F60.1; para histórico, o store vertical direto; para 1:1, o store atual.
- `resolvePendingOperation` continua sendo a autoridade auditada. `deliver_existing_art` exige vertical íntegro; `refund_once` exige ausência comprovada. `unknown` nunca é resolvido por botão do lojista.
- `TwoStageFinancialService.resolveUnknown` SHALL receber a fonte de artefato da operação (`product_1_1` default ou `composition`) e repassá-la à projeção injetada, para que a entrega administrativa use o path vertical F60.1 e não o default 1:1.
- `image-recovery` rejeita `two_stage_9_16` (a entrega é feita pela continuação). Histórico direto mantém a recuperação de arte existente, sem gerar nova imagem.

### D15 — Primeira execução recuperável antes do congelado da F60.4

A operação pode ser aberta e reservada e a requisição morrer **antes** de `runSquareBase` persistir snapshot/evidência F60.4. Nesse intervalo, `continue` não pode depender de `readSquareBaseFrozenState` `complete` nem pedir um briefing novo ao navegador. A reconstrução usa somente dados duráveis da campanha + arquivos de entrada persistidos.

**Dados duráveis mínimos gravados na criação da campanha 9:16** (em `campaigns.input_snapshot`, JSONB existente; sem migration):

```ts
{
  // campos já existentes do briefing/identidade/origem
  ...,
  copyContext: ProductOneToOneCopyContext,       // resolvido server-side na criação
  economicSnapshot: { usdBrlRateAtGeneration, creditValueBrlAtGeneration },
  inputFiles: Array<{
    kind: "product" | "identity";
    role: "primary" | "variation" | "combo_item" | "reference" | "identity";
    index: number;
    contentId: string;      // SHA-256 do data URL EXATO (mesmo hash de frozenContentReferences)
    storagePath: string;    // caminho determinístico no bucket privado de inputs
    mimeType: string;
    dataUrlPrefix: string;  // prefixo EXATO, ex.: "data:image/jpeg;base64,"
    byteSize: number;
  }>
}
```

- As imagens de produto e a identidade efetiva são gravadas **sem transcode** em `campaign-images`, prefixo `{storeId}/{campaignId}/inputs/{contentId}.{ext}`, com `upsert:false`. O helper novo não substitui `uploadCampaignInputImage` (que transcodifica e é usado pelo legado).
- **Hash do data URL ≠ hash dos bytes.** O `contentId`/`frozenContentReferences` é `sha256` da **string exata do data URL** (`data:<mime>;base64,<base64>`), não dos bytes. A reconstrução SHALL reproduzir exatamente `dataUrlPrefix + bytes.toString("base64")` e SHALL verificar `sha256(dataUrl) === contentId` **antes** de usar a imagem. Na criação, a mesma igualdade SHALL ser verificada contra o data URL recebido; se a representação não for reconstruível por prefixo + base64 canônico (ex.: parâmetros/whitespace/encoding divergentes), a entrada SHALL ser recusada **antes** da reserva, sem alterar a função de hash da F60.4.
- O contrato de hash da F60.4 permanece `sha256` da string exata; nenhuma normalização de base64 ou prefixo é introduzida no módulo existente.
- Os descritores `inputFiles` entram no snapshot congelado/hash. A criação da campanha acontece antes do upload (o path precisa do `campaignId`); o upload ocorre **antes** de `reserveOperationOnce`. Falha de upload impede reserva/crédito; a campanha pode ser recuperada por um reenvio com as mesmas imagens.
- Depois da reserva, os arquivos de entrada duráveis **não** são removidos por falha de requisição; limpeza/retenção fica fora desta fatia.
- Em campanha 9:16 já existente, os campos resolvidos no servidor (`identityDirective`, `identityContext`, `copyContext`, `economicSnapshot`, `inputFiles`) vêm do snapshot durável, nunca de uma nova leitura da loja. O conteúdo do usuário (produto/oferta/imagens) é comparado por hash ao congelado; divergência continua conflito.

**Reconstrução da primeira execução (`frozen.kind === "absent"`)**

1. O estado congelado F60.4 é a autoridade. Se `frozen.kind` for `complete`/`repairable`, usar o payload congelado e chamar `runSquareBase`; o gate do módulo decide reutilização ou bloqueio. **Arte íntegra sozinha NUNCA conclui a base.**
2. Se `frozen.kind` for `absent`, reconstruir o conteúdo abaixo e chamar `runSquareBase` como primeira composição. Se já existir `square_original` sem estado congelado admissível, o gate F60.4 SHALL bloquear (`artifact_without_frozen_state`); o orquestrador SHALL NOT marcar `completed` por conta própria.
3. Se `frozen.kind` for `bound_to_other_operation`/`unproven`/`corrupt`/`indeterminate`, falhar fechado sem reconstrução/entrega.
4. Ler `campaigns.input_snapshot` + `campaigns.identity_snapshot`, baixar os `inputFiles` do bucket privado e verificar `contentId`/hash, papel e índice contra `frozenContentReferences`.
5. Reconstruir, por mapper puro server-side:
   - `briefing`/`briefingText` a partir de produto/comercial/restrições/direção de fundo + identidade congelada;
   - `copyContext` e `economicSnapshot` do snapshot;
   - `productImagesDataUrls`/`identityImageUrl` dos arquivos verificados, na ordem dos índices, usando `dataUrlPrefix + base64(bytes)` e conferindo o hash exato;
   - `references`/`referenceSelections` do congelado;
   - `campaignIntent`/`backgroundDirection` do snapshot.
6. Chamar `runSquareBase` como primeira composição normal (config atual é resolvida pelo próprio módulo; isso não é dado da loja).
7. Se o processo morrer depois de persistir snapshot/evidência mas antes da arte, a próxima continuação já usa o caminho normal `complete`/`repairable`.
8. Não há leitura de `stores`, não há briefing/imagens aceitos como “novos” do navegador e não há chamada paga antes de a reconstrução passar na verificação.

**Falhas da reconstrução**

- Data URL não reconstruível exatamente por `dataUrlPrefix + base64(bytes)` (prefixo/MIME/encoding/whitespace divergente) ⇒ a entrada SHALL ser recusada **na criação**, antes da reserva; na retomada, hash reconstruído divergente ⇒ bloqueio sem chamada paga.
- Arquivo ausente, hash (do data URL exato)/papel/índice divergente ou `copyContext` indisponível de forma **confirmada** ⇒ falha definitiva sem chamada paga; estorno único se não houver vertical.
- Storage indeterminado ⇒ `processing`/`preparation_retry`, sem chamada paga e sem estorno; nova tentativa de leitura é gratuita.
- Nunca se aceita um briefing novo do navegador como substituto; no máximo, um reenvio da mesma requisição inicial com as mesmas imagens pode re-upload dos inputs antes da reserva.

## Contract

### Eventos NDJSON (novo caminho)

O parser existente continua aceitando `phase`, `result`, `error` e `unknown`. O novo caminho adiciona **um** terminal de requisição não final:

```ts
type NineSixteenEvent =
  | {
      type: "phase";
      campaignId: string;
      operationId: string;
      phase:
        | "campaign_validation"
        | "campaign_base"
        | "campaign_preparation"
        | "campaign_expansion"
        | "campaign_copy"
        | "campaign_delivery";
      status: "running" | "complete" | "failed" | "skipped";
      message?: string;
    }
  | {
      type: "processing";
      campaignId: string;
      operationId: string;
      state: "between_steps" | "step_in_progress" | "delivery_pending" | "preparation_retry" | "suspended";
      nextStep: "base" | "expansion" | "delivery" | null;
      canContinue: boolean;
      continueAfterMs?: number;
    }
  | { type: "result"; campaignId: string; campaignUrl: string }
  | {
      type: "error";
      code: string;
      message: string;
      campaignId?: string;
      refunded?: boolean;
    }
  | {
      type: "unknown";
      campaignId: string;
      operationId: string;
      reference: string;
    };
```

Regras:

- Exatamente um evento terminal **por requisição**: `result`, `error`, `unknown` ou `processing`.
- `processing` nunca é tratado como sucesso; ele apenas instrui a continuação/consulta.
- `unknown` nunca oferece retry automático nem promete continuidade; mostra referência e suporte.
- O evento `processing` de `step_in_progress` tem `canContinue: false` e deve ser acompanhado por consulta read-only, não por nova execução.
- `error` só é emitido para falha terminal conhecida (com `refunded` quando confirmado) ou erro de validação sem efeito. Falha definitiva com estorno não confirmado vira `unknown`.

### Entrada do orquestrador

```ts
type RunNineSixteenInput = {
  mode: "initial" | "continue";
  storeId: string;
  campaignId: string;
  operationId: string;
  authorization: AuthorizationContext; // owner | system, resolvida no servidor

  // Conteúdo já validado/congelado pela rota; obrigatório no modo initial.
  briefing: ProductPromptCompositionBriefing;
  briefingText: string;
  campaignIntent: ProductOneToOneIntent;
  backgroundDirection: ProductOneToOneBackgroundDirection;
  productImagesDataUrls: readonly string[];
  identityImageUrl?: string;
  identityDirective?: string;
  references?: readonly string[];
  referenceSelections?: readonly ProductOneToOneEvidenceReference[];
  copyContext?: ProductOneToOneCopyContext;

  requestStartedAtMs: number;
  acquisitionIds?: { base: string; expansion: string }; // obrigatório no continue; UUIDs distintos
  allowNewPaidStep?: boolean; // default true; false quando a flag está OFF (só entrega/projeção)
  timeoutMs?: number;       // nunca alonga o deadline da requisição
  signal?: AbortSignal;
  usdBrlRateAtGeneration?: number | null;
  creditValueBrlAtGeneration?: number | null;
};
```

O modo `continue` não recebe conteúdo novo: lê o congelado da F60.4 ou reconstrói a primeira execução por D15. Campos de conteúdo no modo `continue` são rejeitados/ignorados (a autoridade é o congelado ou o snapshot durável + arquivos verificados), incluindo `copyContext`/`economicSnapshot` do navegador.

### Visão read-only da operação

```ts
type TwoStageOperationView = {
  campaignId: string;
  operationId: string;
  origin: "9_16_two_stage";
  credit: { status: string; terminal: boolean; delivered: boolean; refunded: boolean; reserved: boolean };
  base: StepView;
  expansion: StepView;
  unknown: boolean;
  failedOutcome: boolean;
  supportReference: string | null;
  nextAction: ResumeAction;
  canContinue: boolean;
  processingPhase: "step_in_progress" | "between_steps" | "delivery_pending" | "preparation_retry" | "suspended" | null;
};
```

## Flow

### Abertura (`mode: initial`)

1. Rota valida same-origin, usuário, ownership, elegibilidade legal/loja/rate limit/saldo e o flag novo (somente para campanha nova ou operação ainda não aberta).
2. Rota resolve formato persistido e origem persistida. `1:1` segue o caminho atual; `9:16` novo exige `two_stage_9_16` ou campanha nova. Campanha histórica 9:16 é classificada **antes** de compor o snapshot novo, não recebe marcador novo e retorna status seguro sem geração.
3. Campanha nova: `createCampaign` com snapshot congelado + marcador de origem + identidade efetiva + `copyContext`/`economicSnapshot`/`inputFiles`.
4. Campanha nova 9:16: persistir os arquivos originais de produto/identidade no bucket privado (`inputs/{contentId}`), verificando hash, **antes** de reservar. Falha de upload ⇒ sem reserva/crédito.
5. Orquestrador verifica `verifyCampaignAccess`, lê a operação de controle.
6. Operação ausente ⇒ `reserveOperationOnce` (uma reserva de 1 crédito; identidade `(campaignId, operationId)`).
7. Operação existente ⇒ **query-only**: devolve status/`processing`/terminal, sem reservar, sem adquirir e sem provider.
8. Loop de etapas (D3/D4): base → preparação → expansão → entrega. Antes de chamar a base sem congelado F60.4, reconstruir a primeira execução por D15.
9. Em qualquer caminho, nunca chama o orquestrador 1:1 nem o gerador direto.

### Continuação (`mode: continue`)

1. Rota autentica, valida ownership, corpo `{ operationId, requestIds: { base, expansion } }` (UUIDs distintos), origem `two_stage_9_16` e linha de controle.
2. Orquestrador lê a visão read-only; terminal/unknown ⇒ emite estado.
3. Se há etapa executável e orçamento, adquire com o ID **daquela etapa** e executa no máximo uma tentativa daquela etapa.
4. Se a etapa está `in_progress`, devolve `processing` sem adquirir.
5. Se não couber, devolve `processing` antes de adquirir.
6. Se a etapa já está `done`, avança; se expansão `done`, entrega.
7. Se `allowNewPaidStep === false` e a próxima ação exigir chamada paga (base/expansão) ou copy, devolve `processing`/`suspended` sem adquirir; preparação gratuita e entrega/projeção de vertical já íntegro continuam permitidas.
8. Nunca reserva, nunca regenera base concluída e nunca executa etapa concorrente.

### Base

- Se `base` está `done`, pular.
- Se `base` não está `done` e o congelado F60.4 está `complete`/`repairable`, usar o payload congelado; o gate do módulo decide `reused` ou bloqueio.
- Se `base` não está `done` e o congelado F60.4 está `absent`, reconstruir a primeira execução por D15 (dados duráveis + arquivos de entrada), nunca por dados atuais da loja ou briefing novo do navegador.
- Se existir `square_original` sem congelado admissível, **bloquear** (`artifact_without_frozen_state`), mesmo que os bytes sejam íntegros; nunca concluir a base apenas pela arte.
- Adquirir `base` com target `primary`/`fallback` decidido pela F60 e o `requestId` **da base**.
- `runSquareBase` recebe attempt/target/reference, conteúdo reconstruído/congelado e `timeoutMs` restante.
- `completed` ⇒ `finish(completed)`; copy pode estar `completed`/`in_progress`/`failed` sem afetar a etapa.
- Falhas seguem D6. Falha pós-chamada só reconcilia como `completed` se o gate F60.4 comprovar arte compatível **e** estado congelado `complete`/`repairable` com binding da mesma operação; arte sem congelado admissível bloqueia.

### Preparação

- Executada somente após `base done` e antes de adquirir `expansion`.
- `prepareSquareForExpansion({ source: square_original, preparedOperationId: operationId })`.
- `prepared`/`reused` ⇒ segue. `reused` não faz transformação.
- Falha determinística (fonte ausente/inválida, transform, conflito) ⇒ falha definitiva sem chamada paga; estorno se não houver vertical.
- Indeterminação de Storage sem chamada paga ⇒ `processing`/`preparation_retry`; nova tentativa é gratuita.

### Expansão

- Antes de adquirir, sonda o `square_prepared` (F60.1) para evitar consumir tentativa paga com fonte ausente/inválida.
- Adquirir `expansion` com target `initial`/`retry` da F60 e o `requestId` **da expansão** (distinto do `base`).
- `expandVerticalToNineSixteen` recebe `source.operationId = operationId`, `operationId`, attempt/token e `timeoutMs` restante.
- `expanded`/`reused` ⇒ `finish(completed)` e entrega.
- Falhas seguem D6; `unknown_result` nunca vira retry. Falha pós-chamada só reconcilia o `vertical` como `completed` se a compatibilidade/proveniência/evidência F60.3 comprovar a fonte e a operação; vertical íntegro sem prova bloqueia.

### Entrega

1. Revalidar steps `done` via `confirmOnVerticalDelivery`.
2. Sonda vertical F60.1 integral.
3. `beginPublication`; se não adquirir, ler crédito e emitir `processing`/`delivered`.
4. `markArtUploaded` + `deliver`.
5. Projeção `composition`.
6. `result`.

Se a entrega falhar após vertical íntegro, a continuação reexecuta apenas a entrega/projeção (idempotente), sem nova chamada de imagem/copy e sem nova reserva.

## Identity, Idempotency and Concurrency

- **Operação**: `(campaign_id, operation_id)` única na F60; mesma identidade da reserva.
- **Origem**: `input_snapshot.generationOrigin = "9_16_two_stage"` + linha de controle; nunca inferida pelo formato.
- **Base**: `(storeId, campaignId, operationId, "square_original")`; F60.1 converge/reutiliza.
- **Preparado**: `(storeId, campaignId, operationId, "square_prepared")`; determinístico e idempotente.
- **Arquivos de entrada**: `(storeId, campaignId, contentId, kind/role/index)`; bytes originais + prefixo exato; reconstrução `dataUrlPrefix + base64(bytes)` verificada contra o hash do data URL; não são entrega.
- **Primeira composição sem congelado**: reconstruída do snapshot durável + arquivos de entrada; nunca de loja atual ou briefing novo.
- **Vertical**: `(storeId, campaignId, operationId, "vertical")`; único; nenhuma cópia em `campaign-images`.
- **Tentativa**: `(operationId, attemptNumber, attemptToken)`; a F60 é a autoridade.
- **Requisição**: `requestId` por **aquisição**, distinto entre `base` e `expansion`; o mesmo ID só é reutilizado em repetição idêntica da mesma invocação. Uma nova continuação usa um novo par.
- **Concorrência**: índice único parcial de claim `in_progress` + serialização da linha financeira; o orquestrador não cria lock.
- **Replay**: operação existente em `generate-image` é query-only; continuação só executa etapa não concluída.
- **Resposta tardia**: `finish` condicionado a token/estado; recusa sem entrega/estorno/cobrança.
- **Unknown**: imutável; bloqueia novas tentativas; não autoriza retry nem estorno.

## Shared Surface and Regression Protection

| Superfície | Mudança | Proteção |
|---|---|---|
| `generate-image/route.ts` | Despacho 9:16 para o orquestrador novo; marcador de origem; sem direto; descritores/arquivos de entrada antes da reserva | Testes do caminho 1:1 com o mesmo input/response; teste de que 9:16 não importa/chama o entrypoint direto; testes de hash/path dos inputs |
| `campaign/persistence.ts` | Helper aditivo de input original sem transcode para o novo 9:16 | `uploadCampaignInputImage` legado permanece intacto; testes de bytes/hash/upsert |
| `thumbnail/thumbnail-path.ts` | Reconhecer o vertical de composição | Testes de paths elegíveis/inelegíveis; `/inputs/` continua excluído |
| `runNewFlowGeneration` | Ramo 9:16 removido; 1:1 intocado | Teste de contrato 1:1 byte-equivalente; sem alteração de schema/inputs |
| `GenerationProgress` | Novas fases 9:16 + variante `processing` | Ordem/rotulos 1:1 inalterados; testes de componente para ambos |
| `use-campaign-form` | Continuação automática limitada + status read-only | Testes existentes de unknown/erro/abort 1:1; novos testes 9:16 |
| `unknown-result-panel` | Botão de recuperação de imagem desabilitado para two-stage | Prop default preserva 1:1; teste de que unknown two-stage não oferece recuperação |
| `projectDeliveredCampaign` | Fonte de artefato opcional `composition` | Default `product_1_1`; testes 1:1 existentes + novos testes de composição |
| `TwoStageFinancialService` | Nenhuma regra nova; sonda/projeção injetadas | Testes de integração F60 existentes; novos testes de sonda composition |
| `ProductTwoStageOperationClient` | Novo `getOperationView` read-only | Não altera `open`/`acquire`/`finish`/`recordOutcome`/`resume`; testes de que status não usa RPC de lock |
| `listCampaigns`/`display`/download | Resolver por origem; thumbnail derivada para cards | Campanhas históricas/1:1 mantêm paths/bytes; testes de regressão e de miniatura |
| `copy-recovery` | Contexto congelado para two-stage | Histórico mantém comportamento; teste de que duas fontes não se misturam |
| `image-recovery` | two-stage recusado | Histórico direto continua recuperando arte existente; teste de zero geração |
| `admin/product-1-1-pending` | Perfil de origem | 1:1/histórico preservados; dois-stage usa composição; testes de projeção |
| `feature-flags` | Nova chave fail-closed | Flag ausente = OFF; flag antiga não é reutilizada |

## Data / Migration

**Nenhuma migration estrutural.** A fatia cabe no contrato existente:

- `campaigns.input_snapshot` (JSONB) recebe as chaves de origem, `copyContext`, `economicSnapshot` e os descritores `inputFiles` (com `dataUrlPrefix` exato); os bytes originais ficam no bucket privado existente. Nenhuma coluna nova.
- `product_9_16_two_stage_operations/steps/attempt_claims/outcomes` (F60) já têm identidade, etapas, tentativas, tokens e outcomes; o novo leitor é `SELECT`.
- `campaign_composition_artifacts` + bucket `campaign-internal-artifacts` (F60.1) já têm os três papéis, unicidade, imutabilidade e evidência.
- `image_generation_config_snapshots`, `product_1_1_snapshot_frozen_evidence`, `product_1_1_snapshot_content_binding` e `product_1_1_copy_state` (F60.4) guardam configuração/conteúdo congelados e copy.
- `product_1_1_campaign_credit_operations` é a autoridade financeira; `generation_events` é a telemetria.
- `feature_flags` é uma tabela chave/valor já existente; a chave nova nasce **desligada** e só é criada/ligada no checkpoint de ativação (data-only, não schema).

O que exigiria migration e **não** é proposto: coluna de deadline operacional, contador de continuação, tabela de jobs/fila, nova tabela de custos, novo bucket ou cópia do vertical em `campaign-images`.

Pré-requisito de ambiente: a migration da F60.1 deve estar aplicada onde o fluxo for exercitado; se não estiver, a execução para. Não se cria/reaplica/renomeia migration nesta fatia.

### Migration Plan

1. **Agora (proposta):** nenhum `.sql`, nenhuma escrita em banco/Storage, nenhuma chamada paga, nenhuma flag ligada.
2. **Implementação:** nenhuma migration estrutural. Se a governança exigir seed de flag em migration, aceitar apenas um `INSERT ... ON CONFLICT DO NOTHING` com `enabled=false`; não é necessário para o runtime (ausente = OFF).
3. **Ativação (gate separado):** criar/ligar `product_9_16_two_stage_enabled` com autorização e registro; desligar o direto antigo para novas solicitações (o código já não o despacha).
4. **Rollback:** desligar a flag; operações já abertas continuam consultáveis e resolvíveis. Nenhum dado apagado; nenhuma conversão de campanhas históricas.
5. **Produção:** fora do escopo desta proposta; promoção é gate separado.

## Test Strategy

### A. Offline (obrigatório)

Provider, DB e Storage simulados nas fronteiras; Sharp/decoder reais com fixtures determinísticas; o orquestrador real é exercitado (não apenas o resultado mockado). Reutilizar `src/lib/campaign/__tests__/support/**`, fakes/seams da F60/F60.1/F60.2/F60.3/F60.4.

| Área | Casos |
|---|---|
| Percurso completo | seleção 9:16 → base + copy → preparação → expansão → entrega → `result`; 1 reserva, 1 confirmação, 1 crédito; vertical único |
| Retomada | após base `done` (não regenera base); após preparado existente (reusa); após expansão `done` (não reexpande); reenvio/continuação com o mesmo par de IDs da invocação; nova continuação com novo par |
| Orçamento | base cabe e expansão não cabe → `processing` antes de adquirir expansão, zero claim residual; continuação expande; deadline não alonga |
| Primeira execução sem congelado | campanha+reserva sem F60.4 → reconstrução por snapshot durável + arquivos de entrada; `dataUrlPrefix + base64` reproduz o hash exato; data URL não reconstruível recusado antes da reserva; zero leitura de `stores`/briefing novo; arte sem congelado admissível bloqueia; falha confirmada sem provider; indeterminação sem cobrança |
| Concorrência | duas aberturas simultâneas (uma reserva, um vencedor de base); duas continuações com o mesmo par (uma executa); pares distintos (F60 recusa a segunda); base `in_progress` não chama provider |
| Desconhecido | timeout/abort/perda após envio → `recordOutcome(unknown)`, `unknown`, zero retry, zero estorno; resposta tardia recusada sem efeito |
| Falha definitiva | `finish failed` → `recordOutcome(failed)` → estorno único; replay idempotente; base concluída não confirma; vertical íntegro não estorna |
| Financeiro | uma reserva na abertura; expansão não reserva; confirmação só na entrega; operação delivered recusa estorno; authority/store mismatch fail-closed |
| Entrega | vertical ausente → estorno; vertical inválido/indeterminado → sem estorno/`unknown`; projeção falha → `processing` e retry sem nova chamada; projeção idempotente |
| Acesso | apenas `vertical` é assinado/baixado; `square_original`/`square_prepared` nunca; nenhuma URL antes de `delivered`; nenhuma escrita em `campaign-images`; listagem/detalhe/download com o mesmo artefato |
| Copy | falha de copy não bloqueia vertical; copy `completed` reutilizada; recuperação usa conteúdo congelado; mudança de dados atuais da loja não altera copy; recuperação não regenera imagem/crédito |
| 1:1 | rota/resposta/comportamento 1:1 inalterados; 1:1 não abre operação two-stage; nenhum import vertical no caminho 1:1 |
| Histórico 9:16 | delivered legível/baixável; refunded terminal; reserved/unknown só leitura e sem nova geração; nenhuma conversão de origem |
| Direto desligado | nenhuma rota importa/executa `runProductVertical9x16Generation`; nova solicitação 9:16 com flag OFF retorna 503; flag OFF não reativa direto |
| UI/rotas | NDJSON `processing`/`result`/`error`/`unknown`; parser não trata `processing` como sucesso; continuação limitada; status read-only não adquire etapa; `unknown` sem retry |
| Custos | um evento por chamada real; `operation_run_id = operationId` em base/copy/expansão; tipos/modelos/qualidades/usage/pricing/eventos preservados; desconhecido `null`; estorno não apaga custo |
| Migration/flag | nenhuma migration estrutural; flag ausente = OFF; nenhuma flag ligada em teste |

### B. Integração

- Reutilizar o homolog existente e as evidências das fases anteriores; **não** criar ambiente descartável, resetar, reprovisionar ou reaplicar migrations para repetir provas já aceitas.
- Acesso a DB/Storage, escritas e chamadas pagas dependem de checkpoint específico, com quantidade/teto/autorização explícitos.
- Não adicionar login de teste com captcha quando o teste puder usar contexto server-side autorizado; se autenticação for indispensável, reutilizar o padrão local existente sem desativar captcha.
- Preflight read-only: F60.1 aplicada, bucket, catálogo/pricing da F60.3, snapshot congelado F60.4, flag OFF e uma campanha controlada.
- Evidência: `operationId`, par de `requestIds` por invocação, steps/attempts, `callId`s, modelos/qualidades, dimensões, checksums, custo/origem, crédito, eventos e desfecho.

### C. Prova final manual assistida

- Selecionar 9:16 pelo aplicativo (flag ON apenas no checkpoint autorizado).
- Acompanhar a tela de processamento, incluindo uma continuação real se o orçamento exigir.
- Receber vertical + copy; abrir detalhe/listagem, visualizar e baixar.
- Conferir crédito único (1 reserva/1 confirmação) e ausência de segundo débito.
- Testar preservação do 1:1 e leitura de uma campanha histórica 9:16.
- Separar **aceite técnico**, **aceite humano** e **ativação produtiva**.
- Se precisar de ação/decisão humana, chamar o usuário com instrução direta; não insistir em tentativas automáticas improdutivas.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| O deploy desligar 9:16 até a flag nova ser ligada | Intencional e fail-closed; a ativação é checkpoint separado e deve ser coordenada com a janela de release. Não há fallback silencioso para o direto. |
| Duas requisições abrirem a mesma operação | `open` idempotente + identidade única + claim F60; uma reserva; o perdedor vira `processing`/query-only. |
| Reutilizar o mesmo `requestId` entre base e expansão | Contrato exige `requestIds.base != requestIds.expansion`; cada aquisição usa o ID da sua etapa; teste dedicado e recusa da F60. |
| Reutilizar o mesmo `requestId` de tentativa anterior | O mesmo par só vale para repetir a mesma invocação; nova continuação gera novo par; teste de retry. |
| Hash de bytes divergir do hash do data URL | Persistir prefixo exato + bytes e reconstruir `prefixo + base64`; verificar `sha256(dataUrl) === contentId`; recusar entrada não reconstruível antes da reserva. |
| Arte íntegra sem congelado admissível ser aceita | Reconciliação exige gate F60.4 + congelado/binding; `artifact_without_frozen_state`/conflito bloqueia; testes negativos dedicados. |
| Morrer após reservar e antes do congelado F60.4 | D15 reconstrói por `input_snapshot` + `identity_snapshot` + arquivos verificados; sem loja atual/briefing novo; testes de sucesso e falha fechada. |
| Arquivos de entrada aumentarem Storage | Apenas 9:16 novo, bytes originais no prefixo `inputs/`, `dataUrlPrefix` exato e hash reconstruído verificado; retenção/limpeza fora do escopo e explicitamente não alterada. |
| Base concluída e expansão não caber na requisição | `processing` antes de adquirir a expansão; continuação lê steps e segue; nenhum claim residual. |
| Processo morrer durante chamada paga | F60 mantém claim/tentativa; a próxima requisição não executa concorrente; timeout/desconexão após envio vira `unknown` quando observável; claim residual vai para resolução administrativa. |
| Resultado desconhecido virar retry/estorno | `recordOutcome(unknown)` imutável; D6 e testes proíbem retry/estorno; UI não continua automaticamente. |
| Projeção falhar após crédito confirmado | `processing` + continuação idempotente da projeção, sem nova chamada/crédito; detalhe já consegue ler operação delivered. |
| Listagem assinar a miniatura derivada | A miniatura é leve e derivada do vertical; TTL curto, somente owner, somente `delivered`, somente papel `vertical` como fonte. Se a miniatura falhar, placeholder; preview/download continuam no original. |
| Thumbnail do vertical de composição não ser reconhecida pelo path atual | `deriveThumbnailPath` ganha o padrão `{store}/{campaign}/{operation}/vertical.jpg` e testes de elegibilidade; `/inputs/`, logos e assinaturas continuam inelegíveis. |
| Histórico 9:16 pendente ficar preso | Estado seguro `legacy_vertical_pending`, sem nova geração; resolução administrativa/suporte; nenhuma conversão silenciosa. |
| `campaigns.storage_path` apontar para bucket interno | Consumidores ramificam por origem; testes garantem que nenhum caminho histórico tenta `campaign-images` para two-stage e vice-versa. |
| Copy atrasar e a entrega do vertical esperar | Copy é não bloqueante por contrato F60.4; entrega não a aguarda; recuperação posterior usa conteúdo congelado. |
| Limite de tentativas consumido por falha pré-chamada | D6 classifica falhas pré-chamada sem custo como transitórias quando há retry F60; falhas definitivas encerram com estorno. |
| Custo desconhecido virar zero | `null`/`not_available`; aceite exige custo verificado quando disponível; nenhum preço fixo aproximado. |
| Escopo escorregar para fila/worker | Non-goal explícito; continuação é browser-driven e autorizada; nenhuma infraestrutura nova. |

## Decisions Locked in Review

| Ponto | Decisão |
|---|---|
| Orquestrador | **Novo**, server-only, compõe F60/F60.1/F60.2/F60.3/F60.4; não chama o fluxo 1:1. |
| Origem | **Marcador persistido** `generationOrigin`/`generationContractVersion` + linha de controle; nunca inferir pelo formato. |
| Formatos | **Um por solicitação**; 1:1 intocado; dois formatos/aquisição posterior fora. |
| Reserva | **Uma** na abertura; nenhuma por etapa; continuação nunca reserva. |
| Confirmação | **Somente** vertical íntegro + entrega autorizada. |
| Estorno | **Único** em falha definitiva sem entrega; idempotente. |
| Desconhecido | **Sem retry, sem estorno**; resolução administrativa. |
| Reconciliação | **Antes do `finish`**, artefato pós-chamada só vira etapa concluída com prova compatível (base: congelado `complete`/`repairable` + binding; expansão: proveniência/evidência F60.3); arte sem congelado admissível bloqueia; indeterminado vira desconhecido. |
| Identidade de aquisição | **Um ID por etapa/aquisição**: base e expansão nunca compartilham `requestId`; mesmo par só em repetição idêntica da mesma invocação. |
| Primeira execução | **Reconstrução durável** por `input_snapshot` + `identity_snapshot` + arquivos verificados; hash do data URL exato (`prefixo + base64`), nunca loja atual ou briefing novo do navegador. |
| Continuação | **Endpoint autorizado** + F60; status read-only; `processing` distinto de `unknown`; sem fila. |
| Suspensão | **Flag OFF bloqueia nova etapa paga**, consulta/entrega de vertical já íntegro e resolução administrativa continuam; não reativa o direto. |
| Deadline | **Um por requisição**, compartilhado entre etapas; sem deadline operacional persistido (exigiria schema). |
| Entrega | **Vertical único** F60.1; sem segunda cópia em `campaign-images`; miniatura derivada de exibição é exceção; base/preparado internos. |
| Projeção | `projectDeliveredCampaign` com fonte `composition`; `storage_path` é ponteiro interno. |
| Listagem/thumbnails | **Miniatura derivada** do vertical para os cards; preview/download no original; sem segunda cópia do vertical. |
| Copy | Política existente; falha não bloqueia vertical; recuperação usa conteúdo congelado. |
| Direto antigo | **Sem novas gerações**; código preservado; histórico legível/baixável; pendências com resolução segura. |
| Ativação | **Flag nova fail-closed**, separada; deploy não ativa; suspensão não reativa o antigo. |
| Migration | **Nenhuma estrutural**; chave de flag é data-only no checkpoint de ativação. |
| Prova real | **Gate separado**, homolog existente, autorização explícita, sem reconstruir infraestrutura. |
