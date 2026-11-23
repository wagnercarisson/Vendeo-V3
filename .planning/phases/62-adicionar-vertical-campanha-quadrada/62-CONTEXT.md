# Phase 62 — Contexto de planejamento (ponte compacta)

**Fase:** `62-adicionar-vertical-campanha-quadrada`
**Identificação:** próxima sequência real após a F61 (`61-padronizar-chips-formatos-campanhas`, encerrada e arquivada). Não existia F62 registrada no ROADMAP/STATE nem diretório `62-*` antes deste planejamento; a fase foi agora registrada no ROADMAP e no STATE como planejamento em revisão.
**Fonte técnica:** `openspec/changes/adicionar-vertical-campanha-quadrada/` — proposal, design, 11 delta specs e tasks; `openspec validate --strict` válido.
**Fluxo:** OpenSpec → GSD (este passo) → revisão dos planos → execução → verificação. GSD não redesenha decisões aprovadas.

**Status do planejamento:** contexto, matriz de cobertura e 8 planos criados; plan-check final `PASS WITH FINDINGS` (0 blockers, 0 high, 0 medium, 5 low/3 info); aguardando revisão. Nenhum código, migration, banco, Storage, provider, flag, ambiente, geração, merge, push, deploy, sync ou archive foi executado.

---

## 1. Baseline real de leitura (2026-11-22)

| Item | Valor observado |
|---|---|
| Branch | `feat/campaign-add-vertical` |
| HEAD | `241815fa831ceb6db85fbc8747a9599c83fb66bc` |
| Worktree | sem alterações rastreadas; apenas `openspec/changes/adicionar-vertical-campanha-quadrada/` não rastreada |
| `git diff --stat` | vazio |
| `git diff --check` | limpo |
| OpenSpec strict | `adicionar-vertical-campanha-quadrada` válido; `--changes --strict` 1/0 |
| Changes ativas | somente `adicionar-vertical-campanha-quadrada` |
| F61 | encerrada, verificada, sincronizada e arquivada; publicação não executada |
| Suíte global conhecida (F61) | 844 arquivos / 10.488 testes PASS, 10 skipped, conforme STATE; deve ser reexecutada na execução, não presumida |
| Lint | `npm run lint` executa, mas não cobre TypeScript; `lint:diagnostic` é ferramenta separada. Limitação preexistente preservada |

**Baseline documental:** esta fase adiciona somente arquivos em `.planning/phases/62-adicionar-vertical-campanha-quadrada/`; a pasta não rastreada da change OpenSpec é a fonte aprovada. Nenhuma alteração preexistente deve ser sobrescrita.

---

## 2. Objetivo e resultado esperado

Permitir que uma campanha `1:1` já entregue — do fluxo novo ou legada com fonte 1024 compatível — receba o `9:16` **na mesma campanha**, com operação própria de 1 crédito, sem regenerar o quadrado, alterar a copy ou substituir a referência principal.

**Resultado funcional:**
1. Ação exclusiva no detalhe, com custo de 1 crédito, confirmação e acompanhamento em modal.
2. Elegibilidade por compatibilidade da fonte, com origens `new_flow_1_1` e `legacy_campaign`, validando imagem, path, vínculo, acesso e integridade.
3. Vínculo durável, idempotente e concorrente-seguro; replay antigo após estorno não abre nova cobrança.
4. Operação financeira própria; saldo exigido somente na abertura; continuação usa a reserva da própria operação.
5. Ponte de proveniência estável por fonte, sem geração e sem operação financeira inventada no legado.
6. Economia e seleção congeladas e encaminhadas explicitamente ao motor, sem fallback ao snapshot econômico da campanha original.
7. Entrega vertical sem alterar `campaigns.storage_path`, status, erro ou artefato quadrado.
8. Detalhe, lista, dashboard e download reconhecem os dois formatos com leitura em lote, sem N+1.
9. Rollback por flag dedicada, preservando os fluxos publicados e finalizando operações abertas com segurança.
10. Procedimento de suporte documentado, sem crédito em duplicidade.

**Fora de escopo:** adicionar `1:1` a campanha vertical; adaptar 1080; gerar novo quadrado; editar copy/campanha; painel administrativo novo; pricing global; backfill; eventos históricos; refatoração ampla dos fluxos consolidados; ativação/publicação nesta etapa.

---

## 3. Decisões preservadas (não renegociar)

- **D-62-01** Elegibilidade por compatibilidade da fonte, não por idade. Origens suportadas: `new_flow_1_1` e `legacy_campaign`. 1024×1024 JPEG; 1080 ou outra dimensão bloqueada; sem conversão/backfill.
- **D-62-02** Legado 1024 usa validação opt-in no path histórico canônico, com acesso, vínculo e checksum. Não cria, exige ou simula operação financeira original.
- **D-62-03** Operação própria de 1 crédito; a operação primária, quando existir, não é reaberta, cobrada, estornada ou alterada.
- **D-62-04** Vínculo durável é a autoridade; `request_id` e token de confirmação são emitidos pelo servidor. Replay antigo após estorno retorna o estado terminal ou falha fechada, sem nova cobrança; nova tentativa exige novo token, novo `request_id` e nova confirmação.
- **D-62-05** Saldo ≥ 1 é gate de abertura; continuação valida a reserva da própria operação. Consulta, reconciliação, recuperação e download não dependem de saldo.
- **D-62-06** Ponte `square_original` byte-idêntica, uma por fonte/campanha, com identidade estável (operação primária no fluxo novo; identidade sintética no legado) e origem `delivered_campaign_reuse`. Sem geração; original intacto; divergência é conflito.
- **D-62-07** Preparação recebe **fonte e destino distintos**: `source.operationId = source_registration_operation_id`; `preparedOperationId = operationId` da adição. Defaults dos callers existentes preservados.
- **D-62-08** Economia congelada é encaminhada explicitamente ao motor (`selection`, catálogo, pricing e valores econômicos). **Nenhum fallback** ao snapshot econômico da campanha original; retomadas usam os valores gravados.
- **D-62-09** Orquestração reutiliza `prepareSquareForExpansion`, `expandVerticalToNineSixteen`, controles `9_16_two_stage`, claims, deadline, recheck, outcomes, fence e retomada. Não chama o orquestrador conjunto nem reserva dois formatos.
- **D-62-10** Entrega não chama `projectDeliveredCampaign`/`projectClosedCampaign`; não altera `campaigns.storage_path`, status ou erro. Quadrado e copy permanecem acessíveis.
- **D-62-11** Falha definitiva estorna somente a adição, uma vez; unknown não estorna nem regenera; artefato persistido é confirmado sem nova chamada paga.
- **D-62-12** Flag dedicada `campaign_format_addition_enabled` (default `false`, fail-closed) bloqueia somente novas adições. Operações abertas continuam consultáveis/retomáveis/finalizáveis; vertical individual, conjunto, 1:1 e download não são desligados.
- **D-62-13** `product_1_1_get_campaign_operation_by_campaign` exclui operações de adição; leituras novas usam identidade explícita. A adição não é a operação primária da campanha.
- **D-62-14** Gate de piloto é aplicado tecnicamente quando `armed`; `blocked` bloqueia; `inactive` não cria gate fictício; teto existente não é ampliado/contornado.
- **D-62-15** Declaração de produção da F60.7 feita pelo responsável é registrada, mas não substitui a conferência técnica de versão/hash/ledger/schema no release. Histórico anterior preservado.

---

## 4. Gate de economia congelada e preparação (explícito)

O plano `62-03` congela, na abertura: seleção de expansão (modelo/qualidade/versão), pricing/catálogo e valores econômicos aplicáveis. O plano `62-04` injeta:

- `expandVerticalToNineSixteen` com `selection` congelada e leitores estáticos de catálogo/pricing;
- `runExpansionStep`/equivalente com `readEconomicSnapshot` apontando para os valores congelados da adição;
- nenhuma chamada a `readExpansionEconomicSnapshot` da campanha original como fallback;
- falha fechada se o congelado estiver ausente/malformado/incompatível.

A preparação usa **fonte e destino distintos**: fonte `square_original` sob `source_registration_operation_id` (operação primária no fluxo novo; identidade sintética no legado) e destino `square_prepared` sob o `operationId` da adição. O wrapper existente pode ganhar parâmetro opcional default-preserving ou a chamada direta a `prepareSquareForExpansion` pode ser usada. Testes de regressão devem provar que os fluxos existentes continuam usando fonte=destino por default.

---

## 5. Contratos compartilhados (fonte para 02/03/05)

### 5.1 RPCs de banco

```text
campaign_format_add_open(
  p_store_id uuid, p_campaign_id uuid, p_operation_id uuid, p_request_id uuid,
  p_source_origin text, p_source_operation_id uuid, p_source_registration_operation_id uuid,
  p_source_artifact_id uuid, p_source_checksum_sha256 text,
  p_selection jsonb, p_frozen_economics jsonb
) returns jsonb
```

Retorno de sucesso: `{ success: true, idempotent: boolean, state: "open"|"delivered"|"refunded", operationId, sourceOrigin, sourceRegistrationOperationId, squareArtifactId, requestId, credits: 1, selection }`.
Erros: envelope fechado `{ success: false, reason: <código interno> }`; nenhum erro de transporte é sucesso.

Formas JSON canônicas:
- `p_selection := { model: string, quality: "low"|"medium", configVersionId: uuid, selectionOrigin: "configured"|"legacy" }`.
- `p_frozen_economics := { pricingVersionId: uuid, pricing: object, usdBrlRateAtGeneration: number|null, creditValueBrlAtGeneration: number|null, capturedAt: ISO-8601 }`.
- O JSONB gravado no vínculo é exatamente o objeto validado na abertura; não é recalculado na retomada e não pode ser substituído pelo snapshot econômico da campanha original.

```text
campaign_format_add_deliver(p_store_id uuid, p_campaign_id uuid, p_operation_id uuid, p_publication_token uuid) returns jsonb
campaign_format_add_refund(p_store_id uuid, p_campaign_id uuid, p_operation_id uuid, p_observed_epoch integer, p_reason text) returns jsonb
```

`deliver` retorna `{ success, idempotent, state: "delivered", operationId }`; `refund` retorna `{ success, idempotent, state: "refunded", operationId }`. Nenhum deles projeta a campanha.

### 5.2 Rota de preflight e confirmação

`GET /api/campaign/[id]/format-additions` retorna:

```text
{
  state: "eligible"|"incompatible"|"processing"|"delivered"|"unknown"|"unavailable",
  sourceOrigin: "new_flow_1_1"|"legacy_campaign"|null,
  costCredits: 1,
  requestId: uuid,
  confirmationToken: string,
  expiresAt: ISO-8601,
  reason?: string
}
```

O `requestId` é emitido pelo servidor no GET. O `confirmationToken` é **HMAC-SHA256** sobre payload canônico `{v:1, campaignId, format:"9:16", sourceChecksum, costCredits:1, requestId, intent:"start"|"retry", expiresAt}`, com segredo server-only e TTL curto (10 minutos). O token não contém segredo nem operação financeira.

`POST /api/campaign/[id]/format-additions` aceita somente `{ format: "9:16", confirmationToken: string }`. O servidor verifica o token, extrai `requestId` e `intent`; o cliente **nunca** envia `requestId`, `operationId`, path, URL, modelo, qualidade, prompt, economia ou identidade de crédito. `intent:"retry"` só é emitido após estado `refunded` e nova confirmação explícita; o token antigo de `start` continua retornando o estado terminal ou falhando fechado, sem nova cobrança.

### 5.3 Leitor canônico

`src/lib/campaign/format-addition/delivery-reader.ts` é server-only e expõe leitura por campanha e por identidade explícita (`operationId`, `requestId`, `sourceArtifactId`). Retorna DTO sanitizado com `state`, `sourceOrigin`, `refunded`, `operationId` (server-only, não enviado ao cliente), `requestId` (se necessário ao suporte), sem path/URL/snapshot/bytes. Prioridade: `open`/`delivered` mais recente; se só houver `refunded`, a mais recente. Distingue `delivered`, `processing`, `unknown`, `absent`/`refunded`, `unavailable`.

### 5.4 Convenções

- Códigos internos fechados; se houver código público de suporte, ler `docs/convencoes/codigos-de-erro-suporte.md` e manter código público separado da referência interna.
- Nenhuma rota aceita identidade financeira/operação vinda do cliente.
- Nenhum DTO de cliente recebe `operationId`, path, URL de Storage, snapshot ou bytes.

## 6. Planos, waves e Review Stops

| Plano | Entrega coesa | Wave | Depende de | Review Stop |
|---|---|---:|---|---|
| `62-01` | Contratos puros, elegibilidade, apresentação e textos | 1 | — | Sim (fundação) |
| `62-02` | Persistência, RPCs e flag dedicada (migration autorada, não aplicada) | 2 | 62-01 | **Sim — persistência/financeiro** |
| `62-03` | Ponte de proveniência, economia congelada e cliente financeiro | 3 | 62-02 | **Sim — persistência/financeiro** |
| `62-04` | Orquestração da adição (abertura, preparação, expansão, entrega, falhas); 4 tasks coesas + Review Stop intermediário | 4 | 62-03 | **Sim — orquestração** |
| `62-05` | Rotas e jornada do detalhe (confirmação, acompanhamento, `?format=`) | 5 | 62-04 | **Sim — jornada** |
| `62-06` | Listagem, dashboard, download e regressões integradas | 6 | 62-05 | **Sim — jornada integrada** |
| `62-07` | Suporte, gates offline e pacote de release | 7 | 62-06 | Sim (pré-gates reais) |
| `62-08` | Aplicação autorizada, provas PostgreSQL/Storage/provider e validação visual | 8 | 62-07 + autorização | **Sim — release** |

Nenhum plano executa `62-02` em banco, `62-08` sem autorização, ou qualquer merge/push/deploy.

---

## 7. Requisitos e matriz

A matriz completa está em `62-COVERAGE-MATRIX.md`, com 21 grupos de requisitos: 11 da capability nova e 10 deltas/modificações. Os IDs usados no frontmatter dos planos são:

`ADD-ELIG-01`, `ADD-OP-02`, `ADD-LINK-03`, `ADD-BRIDGE-04`, `ADD-ECON-05`, `ADD-ORCH-06`, `ADD-DELIV-07`, `ADD-FAIL-08`, `ADD-GATE-09`, `ADD-READ-10`, `ADD-SUPPORT-11`; `FMT-ADD-12`, `PAGE-ADD-13`, `LIST-ADD-14`, `DASH-ADD-15`, `DL-ADD-16`, `COMP-ADD-17`, `CREDIT-ADD-18`, `ORCH916-ADD-19`, `CTRL916-ADD-20`, `FLAG-ADD-21`.

---

## 8. Contratos e arquivos de referência

- **Fonte entregue:** `src/lib/campaign/composition-artifacts/resolve-source.ts`, `source-validation.ts`, `types.ts`, `persist.ts`.
- **Preparação:** `src/lib/campaign/square-preparation/prepare.ts`, `types.ts`, `src/lib/product-9-16-two-stage/orchestration/preparation-step.ts`.
- **Expansão:** `src/lib/campaign/vertical-expansion/**`, `src/lib/product-9-16-two-stage/orchestration/expansion-step.ts`, `economic-snapshot-reader.ts`.
- **Controles/financeiro:** `src/lib/product-9-16-two-stage/**`, `src/lib/product-1-1/credit-operation/**`, `src/lib/product-1-1/orchestration/**`.
- **Projeção/entrega:** `src/lib/product-1-1/orchestration/project-delivered-campaign.ts`, `project-closed-campaign.ts` (não usar na adição), `src/lib/product-two-format/**` (referência de padrões, não reutilizar o vínculo conjunto).
- **Apresentação:** `src/lib/campaign/format-presentation.ts`, `src/lib/campaign/list.ts`, `src/lib/dashboard/campaigns.ts`, `src/components/campaign/campaign-format-chips.tsx`, i18n de campanha.
- **Rotas:** `src/app/api/campaign/[id]/download/route.ts`, `src/app/(app)/campanhas/[id]/page.tsx`, `client.tsx`, `src/app/api/campaign/[id]/format-additions/route.ts` (novo).
- **Flags:** `src/lib/feature-flags/feature-flag-service.ts`, `src/app/(app)/admin/feature-flags/page.tsx`.
- **Pendências legadas:** `src/lib/product-1-1/pending/pending-operations-repository.ts`, rota admin de pendências.
- **OpenSpec:** proposal, design, delta specs e tasks da change aprovada.

---

## 9. Validação e separação de provas

**Offline (planos 01–07):** typecheck, lint, build, suítes dirigidas e global, OpenSpec strict, diff-check, testes de contrato, concorrência fake declarada e jornadas offline com os componentes reais.

**Gate de banco (plano 08, autorização separada):** migration aplicada em ambiente autorizado, ledger/hash/schema, backup, RLS/grants, concorrência real, reserva/consumo/estorno, operação original intacta, filtro da operação primária, rollback e preservação de conteúdo.

**Gate de Storage/provider (plano 08):** uma prova real autorizada, sem retry/fallback não autorizado, com custo/teto declarados; fake não é prova financeira.

**Validação visual (plano 08):** detalhe, modal, confirmação, acompanhamento, vertical selecionado, listagem, dashboard, download, pt-BR/es-419, legado 1024, saldo zero, replay e rollback.

**Release:** conferência de versão/hash/ledger/schema, declaração de produção separada da verificação técnica, sem merge/push/deploy nesta fase.

---

## 10. Não-objetivos de execução nesta etapa

Não implementar código, não criar/aplicar migration, não acessar banco/Storage/homolog/produção, não gerar campanha, não alterar flags, não instalar dependências, não fazer merge/push/deploy, não executar sync/archive. Parar após o plan-check e apresentar os planos para revisão.
