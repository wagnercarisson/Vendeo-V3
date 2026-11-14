## 1. Contratos de origem, status e ativação

- [x] 1.1 Criar os tipos puros e o classificador `resolveCampaignGenerationOrigin` para `two_stage_9_16` / `historical` / `indeterminate`, com constantes `generationOrigin`/`generationContractVersion`, testes de par exato, ausência, malformação e versão desconhecida.
- [x] 1.2 Integrar o marcador de origem ao snapshot congelado/hash da campanha 9:16 em `generate-image`, preservando `campaignFormat`/`formatContractVersion` e o comportamento 1:1; cobrir reenvio idempotente e divergência de conteúdo.
- [x] 1.3 Adicionar `getOperationView` read-only ao cliente F60 (`SELECT` em operations/steps/outcomes/credit), sem usar `open`, `acquire`, `finish`, `recordOutcome` ou `resume`; testar que nenhuma RPC com trava é chamada.
- [x] 1.4 Derivar a visão de status fechada (`delivered`/`refunded`/`unknown`/`processing` com `step_in_progress`/`between_steps`/`delivery_pending`/`preparation_retry`, `canContinue`, `nextStep`) apenas de estado persistido, com testes de precedência terminal e unknown não terminal.
- [x] 1.5 Adicionar a flag fail-closed `product_9_16_two_stage_enabled` (ausente/erro = OFF) e usá-la no gate de novas solicitações e no seletor de formato; nenhuma flag ligada nesta rodada, testes de default e suspensão.
- [x] 1.6 Persistir na criação da campanha 9:16 os dados duráveis de retomada: `copyContext`, `economicSnapshot` e descritores `inputFiles` (kind/role/index/contentId/storagePath/mimeType/dataUrlPrefix/byteSize), além dos arquivos originais de produto/identidade sem transcode no prefixo privado `inputs/{contentId}`; upload antes da reserva, sem remoção após reserva, e testes de que `dataUrlPrefix + base64(bytes)` reproduz o hash exato do data URL (não o hash dos bytes).
- [x] 1.7 Criar o mapper puro/server-only de reconstrução da primeira execução a partir de `input_snapshot` + `identity_snapshot` + arquivos verificados (briefing, briefingText, copyContext, economicSnapshot, intenção, direção, imagens, referências/seleções), sem ler `stores` e sem aceitar briefing novo; testar ausência/divergência/indeterminação e recusa de data URL não reconstruível antes da reserva.

## 2. Adaptadores financeiros e de entrega

- [x] 2.1 Criar o `VerticalArtifactProbe` de composição sobre `getArtifactByIdentity` + `retrieveCompositionArtifact`, validando papel `vertical`, 1080×1920, JPEG, checksum e evidência; testar `integral`/`absent`/`invalid`/`indeterminate`.
- [x] 2.2 Estender `projectDeliveredCampaign` com fonte aditiva `composition` (`role: "vertical"`, `expectedPath`), validando `campaign_composition_artifacts`, vínculo e operação `delivered`; manter o default 1:1 e testes existentes verdes.
- [x] 2.3 Criar `nineSixteenVerticalAccess` com `previewUrl` do vertical original (linha compatível + URL assinada TTL curto somente após `delivered`), `thumbnailUrl` da miniatura derivada, `downloadBytes` (retrieve integral) e `not_available`; testar que só o papel `vertical` é consultado/assinado, que a miniatura não é entrega e que nenhuma URL existe antes da entrega.
- [x] 2.4 Criar a sequência de entrega: `beginPublication` → sonda integral → `confirmOnVerticalDelivery` → projeção `composition` → miniatura best-effort, com leitura de autoridade em concorrência e idempotência de entrega/projeção; testar token ausente, terminal, falha de miniatura sem bloquear, projeção falha e replay.
- [x] 2.5 Atualizar o adaptador de pendências administrativas para três perfis (1:1, vertical direto histórico, `two_stage_9_16`), injetando sonda e projeção de composição para a origem nova e repassando a fonte de artefato ao `resolveUnknown`; preservar 1:1/histórico e testar resolução idempotente.
- [x] 2.6 Estender o contrato de miniatura (`deriveThumbnailPath`/`isEligibleCampaignArtPath`) para reconhecer o vertical de composição `{store}/{campaign}/{operation}/vertical.jpg` e derivar `vertical.thumb-v1.webp` em `campaign-images`, mantendo a exclusão de `/inputs/`, logos, assinaturas e bench/lab; testar paths elegíveis/inelegíveis.

## 3. Orquestrador 9:16 por expansão

- [x] 3.1 Criar contratos do orquestrador (`mode`, entrada, resultado/eventos, erros fechados) e validação de entrada; exigir `acquisitionIds.base`/`acquisitionIds.expansion` distintos, rejeitar conteúdo novo no modo `continue` e campos que tentem substituir decisões internas (path, modelo, qualidade, prompt, tamanho, retry).
- [x] 3.2 Implementar o orçamento/deadline único da invocação e a decisão `canContinue` antes de adquirir etapa; cada aquisição usa o ID da sua etapa (base/expansão), nunca o mesmo ID entre etapas; testar orçamento insuficiente sem claim residual e ID cruzado recusado.
- [x] 3.3 Implementar a execução da base com `runSquareBase`: usar `acquisitionIds.base`, escolher entre payload congelado (`complete`/`repairable`) e reconstrução da primeira execução (D15) quando `absent`, mapear `completed`/`reused` e falhas para `finish`/`recordOutcome`, reconciliar somente com gate F60.4 + congelado/binding compatível antes de finalizar falha pós-chamada (arte sem congelado admissível bloqueia; indeterminado ⇒ unknown) e não reservar crédito nem entregar.
- [x] 3.4 Implementar preparação com `prepareSquareForExpansion` antes de adquirir expansão, reutilização de `square_prepared` e classificação de falha determinística vs indeterminação gratuita; testar zero chamada paga em falha de preparação.
- [x] 3.5 Implementar execução da expansão com `acquisitionIds.expansion` (distinto da base), pré-sonda do preparado, `expandVerticalToNineSixteen`, mapeamento de falhas, reconciliação do `vertical` somente com compatibilidade/proveniência/evidência F60.3 antes de finalizar falha pós-chamada (indeterminado ⇒ unknown) e limite F60; testar uma chamada por invocação, `reused` sem chamada e nenhum retry oculto.
- [x] 3.6 Implementar a entrega autorizada e o tratamento de falha definitiva/desconhecida: confirmar somente com vertical íntegro, estornar uma vez sem vertical, projetar campanha fechada após estorno, manter reservado em unknown/inválido, não estornar com publicação `in_flight`/`result_unknown`/`published` e nunca confirmar por base/expansão isolada.
- [x] 3.7 Implementar o loop de etapas para `initial`/`continue`: pular etapa `done`, não executar `in_progress`, não regenerar base, não reservar de novo, não abrir operação no modo continuação e garantir que base/expansão usem IDs de aquisição distintos e estáveis por invocação.
- [x] 3.8 Implementar o emissor NDJSON com exatamente um terminal por requisição (`phase`/`processing`/`result`/`error`/`unknown`), incluindo `campaignId`/`operationId` e referência de suporte.

## 4. Rotas e despacho

- [x] 4.1 Alterar `generate-image` para despachar 9:16 novo ao orquestrador (import dinâmico somente no ramo 9:16), remover o despacho direto e preservar integralmente o ramo 1:1; cobrir campanha nova, operação existente query-only, reenvio usando campos server-side do snapshot (sem reler a loja), flag OFF e formato persistido divergente.
- [x] 4.2 Criar `POST /api/campaign/[id]/continue` com same-origin, autenticação, ownership, schema estrito `{ operationId, requestIds: { base, expansion } }` com UUIDs distintos, verificação de origem/controle, bloqueio de nova etapa paga com flag OFF (sem provider) e chamada do orquestrador em modo `continue`; testar recusa sem operação, par inválido/igual, suspensão e idempotência por par.
- [x] 4.3 Atualizar `generation-status` para ramificar por origem e formato, usando o leitor read-only no novo caminho e o store correto no histórico; testar que status não executa etapa nem usa RPC de trava.
- [x] 4.4 Atualizar a rota de download para resolver o vertical por origem (`two_stage_9_16` via F60.1, histórico via store direto, 1:1 inalterado), negando antes de `delivered`; testar bytes, filename seguro, 403/502 e ausência de URL pública.
- [x] 4.5 Atualizar `image-recovery` para recusar `two_stage_9_16` (entrega é pela continuação) e preservar a recuperação de arte existente no histórico direto; testar zero geração e zero crédito.
- [x] 4.6 Atualizar `copy-recovery` para usar o payload congelado da F60.4 na origem `two_stage_9_16`, falhar fechado sem congelado válido e manter o comportamento histórico; testar que dados atuais da loja não alteram a copy e que imagem/crédito ficam intocados.
- [x] 4.7 Atualizar detalhe e listagem para resolver imagem/thumbnail pela origem e formato, incluindo moldura/card 9:16, preview/download no vertical original, thumbnail derivada nos cards, placeholder sem entrega e estado seguro `legacy_vertical_pending` para histórico pendente; testar campanha nova, histórica entregue, histórica pendente e 1:1.
- [x] 4.8 Adicionar guard de arquitetura provando que nenhuma rota importa ou executa `runProductVertical9x16Generation` e que o caminho 1:1 não importa o runtime do novo 9:16.

## 5. UI de processamento, continuação e unknown

- [x] 5.1 Estender `GenerationProgress` com as fases do novo 9:16 e a variante `processing`, mantendo ordem/rótulos do 1:1 inalterados; testar ambos.
- [x] 5.2 Estender `use-campaign-form` para consumir `processing`: continuar via `/continue` com um novo par `requestIds: { base, expansion }` por invocação, limitar o número de continuações, tratar suspensão (`canContinue:false`) sem chamada paga, não tratar processamento como sucesso e não continuar automaticamente em `unknown`/`step_in_progress`.
- [x] 5.3 No fechamento anormal do stream, consultar status read-only uma vez; se `processing`, manter a tela de processamento; se `unknown`/terminal, seguir o fluxo; se a consulta falhar, usar o estado desconhecido seguro existente.
- [x] 5.4 Ajustar `unknown-result-panel` para não oferecer “Recuperar imagem salva” em `two_stage_9_16`, preservando a ação no 1:1/histórico; testar o contrato de props.
- [x] 5.5 Ajustar o seletor/restauração de formato para a flag nova, bloquear submissão de rascunho 9:16 pausado e não trocar o formato do lojista; testar flag OFF/ON e retomada de rascunho.
- [x] 5.6 Cobrir o contrato de eventos/rotas da UI: `processing` → continuação, `result` → navegação, `error refunded` → detalhe, `unknown` → painel sem retry, stream interrompido → status read-only.

## 6. Testes offline obrigatórios

- [x] 6.1 Testar o caminho completo com módulos reais e fronteiras simuladas: base + copy → preparação → expansão → entrega → `result`, uma reserva e uma confirmação, incluindo o intervalo reservado sem congelado F60.4 reconstruído por dados duráveis + arquivos de entrada.
- [x] 6.2 Testar retomada após base, após preparado e após expansão `done`, sem regenerar/repreparar/reexpandir e sem nova reserva; testar também congelado `complete`/`repairable` dispensando reconstrução.
- [x] 6.3 Testar concorrência/replay: duas aberturas, duas continuações com o mesmo par de IDs, pares distintos, tentativa de usar o ID da base na expansão, etapa `in_progress`, resposta tardia e encerramento administrativo.
- [x] 6.4 Testar desconhecido: timeout/abort/perda após envio → `recordOutcome(unknown)` + evento `unknown`, zero retry, zero estorno; late response sem efeito.
- [x] 6.5 Testar falha definitiva: `finish failed` → `recordOutcome(failed)` → estorno único, replay idempotente, operação entregue recusando estorno, base/expansão isoladas sem confirmação e reconciliação somente com prova compatível (base: congelado/binding; expansão: proveniência/evidência), incluindo negativos de arte íntegra sem congelado/prova.
- [x] 6.6 Testar entrega/acesso: vertical único, somente papel `vertical`, nenhuma segunda cópia integral em `campaign-images`, miniatura derivada usada apenas nos cards, preview/download no original, nenhuma URL antes de `delivered`, projeção idempotente e falha de projeção/miniatura sem nova chamada.
- [x] 6.7 Testar copy: falha não bloqueia vertical, copy concluída reutilizada, recuperação com conteúdo congelado, mudança de dados da loja sem efeito e recuperação sem imagem/crédito.
- [x] 6.8 Testar preservação: 1:1 inalterado, histórico 9:16 entregue acessível, histórico pendente somente leitura, nenhuma conversão de origem, direto não despachado e suspensão bloqueando nova etapa paga sem bloquear consulta/entrega de vertical já íntegro.
- [x] 6.9 Testar custos/eventos: um evento por chamada real, `operation_run_id = operationId` em base/copy/expansão, modelo/qualidade/usage/pricing preservados, desconhecido `null`, estorno não apaga custo e nenhuma duplicação.
- [x] 6.10 Testar falhas da reconstrução: data URL não reconstruível recusado antes da reserva, hash de `dataUrlPrefix + base64` divergente, arquivo ausente/papel/índice errado, `copyContext` ausente, storage indeterminado, arte íntegra sem congelado admissível bloqueada, zero leitura de `stores`, zero briefing novo e zero chamada paga nos casos bloqueados.
- [x] 6.11 Rodar a suíte focada, `typecheck`, lint, `git diff --check` e `openspec validate --strict`; registrar contagens e limitações preexistentes sem declarar suíte global verde.

## 7. Integração em homolog (checkpoint separado)

- [x] 7.1 Executar preflight read-only no homolog existente: F60.1 aplicada, bucket, catálogo/pricing F60.3, snapshot congelado F60.4, flag OFF, campanha controlada e ausência de operação divergente.
- [x] 7.2 Solicitar autorização explícita antes de qualquer escrita/acesso a DB/Storage/provider, informando quantidade máxima de chamadas, teto de orçamento e escopo; não iniciar sem checkpoint.
- [x] 7.3 Executar a prova integrada mínima reutilizando o homolog e as evidências existentes, sem criar ambiente descartável, resetar, reprovisionar ou reaplicar migrations já aceitas.
- [x] 7.4 Registrar manifesto: ambiente, campanha, operação, par de `requestIds` por invocação, steps/tentativas, `callId`s, modelos/qualidades, dimensões, checksums, custo/origem, crédito, eventos e desfechos; reutilizar no fechamento.

## 8. Prova final manual assistida e ativação

- [x] 8.1 Com autorização, ligar `product_9_16_two_stage_enabled` apenas no checkpoint de ativação e registrar a decisão; não ligar a flag em implementação/teste offline.
- [x] 8.2 Selecionar 9:16 pelo aplicativo, acompanhar a tela de processamento (incluindo continuação real se houver), receber vertical + copy e abrir detalhe/listagem/preview. **Preview confirmado pelo usuário em 2026-11-14.**
- [x] 8.3 Baixar o vertical, conferir JPEG 1080×1920, crédito único (1 reserva/1 confirmação), ausência de segundo débito e preservação do fluxo 1:1.
- [x] 8.4 Verificar uma campanha histórica 9:16 entregue e uma pendência histórica, confirmando leitura/download e ausência de nova geração/conversão. **EXCEÇÃO ACEITA (2026-11-14): campanha histórica entregue confirmada; cenário de pendência NÃO exercitado manualmente por ausência de caso. Não é PASS manual. Cobertura offline dos cenários preservada; exceção submetida e aceita explicitamente para o fechamento.**
- [x] 8.5 Separar e registrar aceite técnico, aceite humano e ativação produtiva; documentar rollback por desligamento da flag e resolução administrativa de operações em andamento.
- [x] 8.6 Se faltar ação/decisão humana, solicitar instrução direta ao usuário; não repetir tentativas automáticas improdutivas, chamadas pagas ou alterações de ambiente sem autorização.

---

## Evidências (reconciliação de 2026-11-13)

**Automação (reproduzida nesta rodada):** 124 arquivos / 1195 testes PASS no
conjunto focado (square-base, product-9-16-two-stage, fluxo/UI, rotas de campanha,
feature-flags e admin de flags); typecheck PASS; lint PASS; build PASS;
`git diff --check` limpo; `openspec validate --strict --type change` válido.
A suíte global **não** é declarada verde: `legacy-frontier.guard`,
`non-activation.contract` e a suíte de `admin/product-1-1-pending` mantêm
falhas preexistentes, fora deste conjunto focado.

**Manual (aceite do usuário):** campanha `1ff7949f-0167-4f49-87df-2a71a1a23ef8`;
flag nova exibida e ligada/desligada no admin; seletor legado removido; spinner
em "Texto"; campanha 9:16 persistida com download e copy corretos; exatamente 1
crédito; miniatura correta; 1:1 e 9:16 legados funcionais; geração 9:16
indisponível após flag OFF. Nenhuma leitura adicional de banco/Storage nesta
rodada.

| Tasks | Evidência principal |
|---|---|
| 1.1 | `orchestration/__tests__/origin.contract.test.ts` |
| 1.2 | `generate-image/__tests__/route.integration.test.ts`, `resume-context.contract.test.ts` |
| 1.3 | `__tests__/operation-view.contract.test.ts` (SELECT-only) |
| 1.4 | `orchestration/__tests__/status-view.contract.test.ts` |
| 1.5 | `feature-flags/__tests__/feature-flag-service.test.ts`, `generate-image/__tests__/route.test.ts` |
| 1.6 | `durable-input.contract.test.ts`, `upload-campaign-input-file.test.ts` |
| 1.7 | `reconstruction.contract.test.ts`, `reconstruction-parity.contract.test.ts` |
| 2.1 | `vertical-probe.contract.test.ts` |
| 2.2 | `resolve-unknown-source.contract.test.ts`, projeção composition |
| 2.3 | `vertical-access.contract.test.ts`, `campaign-download.test.ts` |
| 2.4 | `delivery.contract.test.ts`, `delivery-deps.contract.test.ts` |
| 2.5 | `admin-pending-*.test.ts`, `pending-operations-repository.test.ts` |
| 2.6 | `thumbnail-path` / `list.test.ts` (miniatura derivada) |
| 3.1 | `types.contract.test.ts` |
| 3.2 | `acquisition-ids.contract.test.ts`, `deadline-budget.contract.test.ts` |
| 3.3 | `base-step.contract.test.ts`, `reconciliation.contract.test.ts` |
| 3.4 | `preparation-step.contract.test.ts` |
| 3.5 | `expansion-step.contract.test.ts` |
| 3.6 | `delivery.contract.test.ts`, `unknown-and-refund.offline.test.ts` |
| 3.7 | `run-nine-sixteen.contract.test.ts`, `resume-and-budget.offline.test.ts` |
| 3.8 | `ndjson.contract.test.ts` |
| 4.1 | `generate-image/__tests__/route.test.ts` e `route.integration.test.ts` |
| 4.2 | `continue/__tests__/route.test.ts` |
| 4.3 | `generation-status/__tests__/route.two-stage.test.ts` |
| 4.4 | `__tests__/api/campaign-download.test.ts` |
| 4.5 | `image-recovery-format.test.ts` |
| 4.6 | `copy-recovery-runner.contract.test.ts` |
| 4.7 | `campaign-detail-format.test.tsx`, `list.test.ts`, `campaign-display-format.test.ts` |
| 4.8 | `api/campaign/__tests__/architecture-guard.test.ts` |
| 5.1 | `generation-progress*.test.tsx` |
| 5.2 | `use-campaign-form.processing*.test.ts` |
| 5.3 | `use-campaign-form.processing*.test.ts` (status read-only no fechamento) |
| 5.4 | `unknown-result-panel` / contrato de props |
| 5.5 | `use-campaign-form-restore-format.test.ts`, `nova-format-paused.test.tsx` |
| 5.6 | `use-campaign-form.processing*.test.ts` (matriz de eventos) |
| 6.1–6.10 | `orchestration/__tests__/integrated/{journey,resume-and-budget,unknown-and-refund,preservation}.offline.test.ts` e contratos correspondentes |
| 6.11 | gates desta rodada (acima) |
| 7.1 | `60.5-04-PREFLIGHT.json` (15/15) e preflight da sessão manual |
| 7.2 | `60.5-04-AUTHORIZATION-REQUEST-02.md` e autorização de `60.5-05` |
| 7.3 | `60.5-04-PROOF-REPORT.md` (tentativa 2, 3 chamadas, US$ 0,059442) |
| 7.4 | `60.5-04-PROOF-MANIFEST.json` + `60.5-05-ACTIVATION-MANIFEST.json` |
| 8.1 | flag ligada em 2026-11-13T23:32:23Z e desligada em 2026-11-13T23:40:44Z; valor final OFF |
| 8.2 | preview do vertical confirmado pelo usuário em 2026-11-14 |
| 8.4 | histórico entregue confirmado; pendência sem caso manual; exceção aceita; cobertura offline preservada |
| 8.3 | aceite manual: download correto, exatamente 1 crédito, 1:1 preservado |
| 8.5 | aceites separados em `60.5-05-ACTIVATION-REPORT.md`; rollback por flag OFF |
| 8.6 | decisão humana registrada; nenhuma repetição automática |

### Exceção documentada (aceita explicitamente)

- **8.2 — preview aprovado.** O usuário confirmou o preview do vertical em
  2026-11-14; a tarefa foi marcada com evidência manual.
- **8.4 — cenário legado pendente não exercitado manualmente.** A campanha
  histórica 9:16 **entregue** foi confirmada como funcional. Não havia caso de
  campanha histórica **em pendência** disponível para exercitar manualmente, então
  o cenário foi registrado como **não exercitado** — explicitamente **não** como
  PASS manual. A cobertura offline permanece nos testes de acesso histórico e de
  estado seguro somente leitura (`historical-access.contract`,
  `campaign-detail-format`, `list.test`, `architecture-guard`, suítes de
  preservação). A exceção foi documentada e aceita explicitamente para o
  fechamento; os cenários da spec continuam cobertos pela automação, sem
  alegação de validação manual.
