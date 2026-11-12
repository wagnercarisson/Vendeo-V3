## 1. Contratos puros e política da base

- [x] 1.1 Criar `src/lib/campaign/square-base/types.ts` com a entrada fechada (`identity`, `authorization`, `briefing`, `attempt`, `copyContext`, `timeoutMs`/`signal`), o payload de conteúdo congelado, os desfechos `ArtOutcome`, `CopyOutcome`, `SquareBaseCallEvidence` e a união `SquareBaseResult`; reutilizar tipos da F60/F60.1 e do 1:1 sem duplicar contratos.
- [x] 1.2 Criar `src/lib/campaign/square-base/policy.ts` com constantes puras: papel `square_original`, formato `1:1`, dimensão 1024×1024, MIME JPEG, origem `provider_generation`, tamanho de provider `1024x1024` e timeout local padrão de 180 s.
- [x] 1.3 Implementar validação pura de entrada (UUIDs, ao menos uma imagem de produto, `attempt.number` positivo, `target` `primary|fallback`, `reference` não vazio, rejeição de path/URL/bytes/modelo/qualidade/prompt/promptBase/tamanho enviados pelo chamador).
- [x] 1.4 Escrever `types.contract.test.ts`/`policy.contract.test.ts` cobrindo união fechada, rejeições de entrada e derivação de dimensão/MIME/origem; rodar os testes focados.

## 2. Estado congelado, gate de arte e compatibilidade

- [x] 2.1 Criar `src/lib/campaign/square-base/frozen-state.ts` com leitura read-only de `image_generation_config_snapshots`, `product_1_1_snapshot_frozen_evidence` e `product_1_1_snapshot_content_binding`, classificando `absent`/`complete`/`repairable`/`bound_to_other_operation`/`unproven`/`corrupt`/`indeterminate` e devolvendo snapshot, evidência/binding e fingerprint persistidos. A leitura deve usar `snapshot_original_id` (PK/UNIQUE) para provar a operação vinculada.
- [x] 2.2 Implementar a serialização/parse canônica do conteúdo congelado (`briefing`, `copyContext`, `identityDirective`, intenção, direção de fundo, seleções/versões de prompt/compositor/políticas) no campo `briefing` existente; validar shape fail-closed e reutilizar `computeContentFingerprint`.
- [x] 2.3 Implementar a comparação de retomada (`complete`/`repairable`): conteúdo recebido × fingerprint/evidência congelados; divergência → `content_divergence` antes de qualquer chamada. Verificar os data URLs de produto/identidade por hash de conteúdo, papel e ordem contra `referenceSelections`. Em `repairable` equivalente, reparar a evidência para o mesmo snapshot; em `bound_to_other_operation`, conflitar; em `unproven`/`corrupt`/leitura falha, bloquear.
- [x] 2.4 Criar `src/lib/campaign/square-base/gate.ts` com o probe linha/objeto: `getArtifactByIdentity`, `retrieveCompositionArtifact`, `CompositionArtifactStorage.readObjectInfo/downloadBytes`, evidência esperada por `buildObjectEvidence` e verificação por `verifyObjectEvidence`.
- [x] 2.5 Implementar compatibilidade de `square_original`: papel, 1024×1024, JPEG, `origin: "provider_generation"`, `derivedFromArtifactId`/`sourceCampaignId` nulos e proveniência vazia; qualquer divergência é conflito, nunca reutilização silenciosa.
- [x] 2.6 Implementar adoção de órfão íntegro exclusivamente por `persistCompositionArtifact` e readback por `getArtifactByIdentity`/`retrieveCompositionArtifact`; nenhum upload/delete/update fora da F60.1. Arte existente sem estado congelado bloqueia com `artifact_without_frozen_state`.
- [x] 2.7 Escrever `frozen-state.contract.test.ts` e `gate.contract.test.ts` com fake de DB/Storage e Sharp real: primeira composição, retomada `complete`, `repairable` equivalente/divergente, snapshot vinculado a outra operação, snapshot sem binding, estado parcial/leitura falha, payload inválido, reused, row_object_missing, proceed, adoção, órfão sem/with evidência inválida, objeto truncado, indeterminado e linha incompatível; zero chamadas em todos os bloqueios.

## 3. Prompt e configuração congelada

- [x] 3.1 Criar `src/lib/campaign/square-base/prompt.ts` que monta o mesmo input do 1:1 a partir do **conteúdo congelado** (briefing, referências de produto derivadas de `referenceSelections` sem identidade ou do campo legado `references`, contribuições de identidade, anexos na ordem produto→referências→identidade) e chama `composeProductPrompt` com `PRODUCT_1_1_PROMPT_BASE`; não criar prompt/política nova.
- [x] 3.2 Criar `src/lib/campaign/square-base/config.ts` que usa `runNewFlowPreflight`/`buildProductOneToOneSnapshot`/`buildProductOneToOneFrozenEvidence`/`persistProductOneToOneSnapshot` **somente na primeira execução**, com seams injetáveis para preflight/snapshot/client.
- [x] 3.3 Implementar o caminho de retomada sem preflight atual: usar o snapshot congelado, validar elegibilidade e pricing do par congelado (`assertEligibleModelPair`/`assertImagePairExecutable` ou seams) e reparar apenas a evidência `repairable` equivalente; nenhuma chamada paga antes do snapshot/evidência completos. Snapshot vinculado a outra operação conflita; sem binding, bloqueia.
- [x] 3.4 Garantir a ordem: estado congelado → gate de arte → (primeira composição: preflight/config/snapshot; retomada: snapshot congelado) → (copy) → imagem; na retomada, nenhuma resolução de config atual. Snapshot vinculado a outra operação ou sem binding bloqueia antes do gate/chamada.
- [x] 3.5 Escrever `prompt.contract.test.ts` e `config.contract.test.ts`: equivalência com o input 1:1, primeira composição × retomada, snapshot vinculado a outra operação, snapshot sem binding, snapshot congelado antes do provider, pricing do par congelado, pricing incompleto, falha de evidência, config divergente, `content_divergence` e reserva de persistência atingida sem chamada.

## 4. Transporte e geração da imagem

- [x] 4.1 Criar `src/lib/campaign/square-base/transport.ts` compondo `AiGateway` + `NewFlowImageModelResolver` + `UpstreamImagesAdapter` com `createOpenAiImagesSdkLoader({ maxRetries: 0 })` e `{ maxRetries: 0, preserveUsageWithoutImage: true }`; não alterar `createNewFlowImageGateway` nem o runtime 1:1.
- [x] 4.2 Implementar a requisição de imagem com prompt composto, imagens de produto/identidade, `quality` do alvo no snapshot (`primary`/`fallback`), `size: "1024x1024"` e `signal`; executar exatamente uma invocação com o alvo explícito da F60.
- [x] 4.3 Criar `src/lib/campaign/square-base/failure.ts` reutilizando o tradutor/classificador F60 existente (`classifyExpansionFailure`/`classifyProviderFailure`) e mapeando para `provider_failure`, `definitive_failure`, `unknown_result` e `invalid_output`, sem retry.
- [x] 4.4 Implementar deadline local com `deadlineAt`/`remainingBudget`/`createDeadlineRejection`, abort cooperativo, reserva de escrita e classificação de timeout/abort/perda como desconhecido.
- [x] 4.5 Escrever `transport.contract.test.ts`, `image.contract.test.ts` e `failure.contract.test.ts`: uma única chamada, alvo explícito, `maxRetries: 0` capturado, request correto, resposta sem imagem com usage, timeout/abort, classes transitória/definitiva/desconhecida e nenhuma segunda chamada.

## 5. Conversão e persistência F60.1

- [x] 5.1 Criar `src/lib/campaign/square-base/artifact.ts` que decodifica a data URL com `dataUrlToCampaignImage`, converte com `resizeToJpeg1024`, persiste por `persistCompositionArtifact` (`origin: "provider_generation"`, `source: { kind: "none" }`, `provenance: {}`) e faz readback por `retrieveCompositionArtifact`.
- [x] 5.2 Mapear todos os desfechos da F60.1/readback para resultados tipados (`created`, `reused`, conflito, integridade, persistência, readback) preservando `call` e o desfecho da copy.
- [x] 5.3 Escrever `artifact.contract.test.ts` com o fake de Storage/DB e Sharp real: JPEG 1024 criado/lido, reused pós-corrida, evidência/checksum, conflito de conteúdo/identidade/metadados/proveniência, falha após upload, falha de readback e nenhuma sobrescrita/delete.

## 6. Copy reutilizável, resumível e sem retry oculto

- [x] 6.1 Criar `src/lib/campaign/square-base/copy.ts` usando `ProductOneToOneCopyAcquisitionClient`, `createDefaultProductOneToOneCopyOps` (com `copyDirectorEnabled` default de `getLaunchConfig()` e seam de teste), `drainCopyTask`, `readCopyDelivery`, `recordCopyState`/`recordCancellation` e `createCopyBudgetSignal`; alimentar o runner com `briefing`/`copyContext` do conteúdo congelado, nunca do payload recebido na retomada.
- [x] 6.2 Criar `src/lib/campaign/square-base/copy-transport.ts` com um `AiGateway` sobre o resolver de `campaign_copy` e registry no-retry (`ChatCompletionsAdapter`/`ResponsesAdapter` com `maxRetries: 0`; Gemini sem camada de retry); manter `defaultAiGateway`/`defaultAdapterRegistry` intactos.
- [x] 6.3 Adicionar a opção aditiva `maxRetries` aos adapters `chat-completions` e `responses`, sem mudar o cliente quando ausente; testar o default e a opção explícita.
- [x] 6.4 Implementar os desfechos de aquisição (`attempt_already_completed`, `attempt_in_progress`, `already_acquired`, `wait_not_elapsed`, `attempt_limit_reached`, `automatic_closed`, erro) e o dreno com orçamento `min(COPY_BUDGET_MS, restante até o deadline)`.
- [x] 6.5 Garantir que copy nunca bloqueia a arte: iniciar após o gate (e após o snapshot, no caminho de geração), drenar em `finally` e devolver o texto/payload do estado persistido; falha de copy vira desfecho próprio.
- [x] 6.6 Escrever `copy.contract.test.ts` e `copy-transport.contract.test.ts` cobrindo conteúdo congelado, copy `completed` gerada/reutilizada, `in_progress`, `waiting`, `failed`, `unavailable`, `not_requested`, copy concluída + arte falha, arte criada + copy falha, exatamente uma requisição ao provider, `maxRetries: 0` capturado e default legado inalterado.

## 7. Orquestração, resultado e telemetria

- [x] 7.1 Criar `src/lib/campaign/square-base/run-square-base.ts` como única API pública, implementando a ordem completa do design (entrada → autorização → estado congelado → gate → [primeira execução: config/snapshot | retomada: snapshot congelado] → copy → imagem → conversão → persistência → readback → resultado).
- [x] 7.2 Criar `src/lib/campaign/square-base/telemetry.ts` reutilizando `createDefaultTelemetryContext`/sink único, com `operationRunId = operationId`, `traceId = callId`, tentativa F60, snapshot econômico, `internalCost` por par (`defaultResolveAttemptCost` + `attemptCostForTarget`) e `onCostResolved` para a evidência da chamada; a copy usa o runner existente com `runId = operationId` e o invoker no-retry.
- [x] 7.3 Garantir que toda falha pós-chamada (conversão, persistência, readback, exceção inesperada) devolva `call` com `usage`/custo/duração e nunca execute uma segunda chamada paga.
- [x] 7.4 Escrever `orchestration.contract.test.ts` e `telemetry.contract.test.ts`: sucesso completo, primeira execução × retomada, reused, `content_divergence`, arte sem estado congelado, conflito, falhas de cada etapa, copy+arte distinguíveis, correlação base/expansão pelo `operationRunId`, custo desconhecido `null`, um envelope por chamada e falha de sink sem nova chamada.

## 8. Fronteiras, regressão e testes offline

- [x] 8.1 Escrever `boundaries.contract.test.ts` provando zero RPC/chamada de crédito, zero writes em `campaigns`, zero `createSignedUrl`/`getPublicUrl`, zero download público/entrega, zero update/delete de objeto e zero migrations/tabelas/buckets novos.
- [x] 8.2 Escrever `regression.contract.test.ts` provando que `runProductOneToOneGeneration`, `createNewFlowImageGateway`, prompts/compositor, `defaultAiGateway`/`defaultAdapterRegistry`, o default dos adapters textuais sem opção e os contratos F60/F60.1/F60.3 permanecem inalterados; nenhuma rota/UI/flag/ativação criada.
- [x] 8.3 Adicionar testes de concorrência: duas leituras com arte existente, persistência concorrente, copy concorrente, gate indeterminado, retomada com conteúdo divergente e reserva de persistência.
- [x] 8.4 Rodar a suíte focada completa da base quadrada + regressões F60.1/F60.3/1:1 e corrigir qualquer divergência sem alterar os módulos reutilizados.

## 9. Gates e fechamento documental

- [x] 9.1 Rodar `npm.cmd run typecheck`, `npm.cmd run lint` e `git diff --check`; registrar exit codes e limitações preexistentes.
- [x] 9.2 Confirmar `openspec validate`/status da change e que `proposal.md`, `design.md`, `specs/campaign-square-base-composition/spec.md` e `tasks.md` estão coerentes.
- [x] 9.3 Documentar no fechamento que a implementação 60.4-01..04 não executou migration, chamada paga, acesso a homolog, crédito, campanha, entrega ou ativação; a prova real autorizada do 60.4-05 é evidência separada.
- [x] 9.4 Documentar que a prova real é gate separado, no homolog existente, com autorização explícita de quantidade/orçamento e sem reconstruir infraestrutura; executada uma única vez no 60.4-05 (1 imagem + 1 copy), com evidência no manifesto/relatório.


## Evidence map (F60.4 closure, 2026-11-12)

| Tarefas | Evidência verificável |
|---|---|
| 1.1–1.4 | `src/lib/campaign/square-base/{types,policy,validation}.ts`; `__tests__/{types,policy,validation}.contract.test.ts`; `60.4-01-SUMMARY.md` |
| 2.1–2.7 | `frozen-state.ts`, `gate.ts`; `__tests__/{frozen-state,gate,gate.decode-limit}.contract.test.ts`; `60.4-01-SUMMARY.md`, `60.4-02-SUMMARY.md` |
| 3.1–3.5 | `prompt.ts`, `config.ts`; `__tests__/{prompt,config}.contract.test.ts`; `60.4-01-SUMMARY.md`, `60.4-02-SUMMARY.md` |
| 4.1–4.5 | `transport.ts`, `failure.ts`; `__tests__/{transport,image,failure,deadline-budget}.contract.test.ts`; `60.4-02-SUMMARY.md`, `60.4-04-SUMMARY.md` |
| 5.1–5.3 | `artifact.ts`; `__tests__/artifact.contract.test.ts`; `60.4-02-SUMMARY.md` |
| 6.1–6.6 | `copy.ts`, `copy-transport.ts`, `ai/adapters/{chat-completions,responses}.ts`; `__tests__/{copy,copy-transport,text-adapters-options,regression}.contract.test.ts`; `60.4-03-SUMMARY.md` |
| 7.1–7.4 | `run-square-base.ts`, `telemetry.ts`; `__tests__/{orchestration,telemetry}.contract.test.ts`; `60.4-04-SUMMARY.md` |
| 8.1–8.4 | `__tests__/{boundaries,regression,concurrency}.contract.test.ts`; gate focado **50 arquivos / 773 testes**; `60.4-04-SUMMARY.md` |
| 9.1–9.2 | typecheck 0, lint 0, `git diff --check` limpo; `openspec status`/`validate --strict`; `60.4-OPSX-VERIFY.md` |
| 9.3–9.4 | implementação sem homolog/provider; prova real autorizada única no `60.4-05`; `60.4-05-PROOF-MANIFEST.json`, `60.4-05-PROOF-REPORT.md`, `60.4-UAT.md` |

> A prova real 9.4 foi executada no gate separado `60.4-05`, sob autorização explícita, sem reconstruir infraestrutura. A suíte global não é declarada verde; `telemetry-coverage` e `legacy-frontier` permanecem vermelhos preexistentes fora do gate focado.
