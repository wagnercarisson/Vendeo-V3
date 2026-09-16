# Design — Fase 48.1: Laboratório Mínimo de IA

## Context

O Vendeo já possui as peças que o laboratório precisa **reutilizar sem reabrir**:

- **F46 — Gateway único de IA** (`src/lib/ai/`): `AiGateway.invoke(capability, request, telemetry, target)` executa **uma tentativa** por chamada, sem fallback automático; resolve a configuração por um `AiModelResolver` **injetado por construtor**; traduz pelo adapter do `protocol` do alvo; emite **um `AiCallEnvelope` por tentativa** para o `telemetry.sink`. `src/lib/ai/gateway.ts` **não muda**.
- **F46 — Seams de injeção**: serviços migrados recebem um `AiInvoker` por construtor (default `defaultAiGateway`); `OpenAIImageProvider` recebe um `AiInvoker`; `InputValidationService`/`ImageReviewService` idem. `ImageGenerationService` recebe `PromptLoader` + serviços de visão + provider por construtor.
- **F47 — Catálogo e seleção** (`ai_model_catalog`, `ai_model_selection`, `PersistedModelResolver`): o catálogo é a allowlist persistida por capacidade e é **somente leitura** na UI. A F48.1 lê o catálogo para restringir os alvos de modelo do laboratório.
- **Telemetria/custos**: `resolveAiCost` (leitura) e `AiCostTracker.record` (grava `generation_events`). O laboratório **não** grava `generation_events`.
- **Pipeline real**: `ImageGenerationService` monta o prompt do diretor por intent (`campaign-image-director-{offer|spotlight|exclusive}` via `PromptLoader` fs) e chama o provider de imagem.
- **Admin**: `requireAdmin()`, `apiHandler`, rotas `/api/admin/*`, páginas `/admin/*`, design system dark OLED.

O laboratório é um **simulador isolado da produção**, local-first, que executa IA real sob comando humano e produz evidências técnicas + avaliação humana.

## Goals / Non-Goals

**Goals**

- Menor bancada experimental já útil: cenário controlado → variante baseline × candidata → geração real isolada → comparação lado a lado → voto humano.
- Isolamento absoluto da produção, comprovado por guardas arquiteturais e testes.
- Guarda de ambiente **fail-closed** (somente Supabase local).
- Snapshots imutáveis por execução (prompt/modelo/cenário/pricing/código).
- Reutilizar gateway, adapters, catálogo e prompt assembly da F46/F47 sem alterá-los.
- Segurança financeira: ação humana explícita, estimativa, limites, nenhuma chamada paga em testes/CI.
- Deixar pontos de extensão claros para as demais fatias da F48 **sem implementá-las**.

**Non-Goals**

- Descoberta/crawling de modelos, monitoramento de pricing, dossiê dos 12 modelos, ciclo de vida/promoção/rollback, editor de prompts, colaboração, estatística/ranking, juiz textual, execução combinatória, canário em produção, scheduler/fila/infra distribuída, notificações, serviços/informativos/9:16/carrossel/i18n, migração de storage, app/subdomínio separado.
- Alterar prompts oficiais, `ai_model_selection`, `ai_model_catalog`, `generation_events`, `campaigns`, `campaign_art_versions`, `admin_audit_log`, gateway, domínio ou UI/form do lojista.
- Definir ou redefinir o `campaign_image_review` produtivo; julgar qualidade visual por IA.

## Decisions

### D1 — Bounded context próprio e uma única entrada na navegação

Todo o laboratório vive em `src/lib/lab/**` (domínio, cenários, guarda de ambiente, harness de gateway, persistência, validação técnica) e nas superfícies `src/app/(app)/admin/laboratorio/**` (UI) e `src/app/api/admin/laboratorio/**` (API). O admin ganha **um único link** “Laboratório” em `layout.tsx`; a navegação interna (Experimentos / Cenários / Avaliações) fica no `layout.tsx` do próprio laboratório. As APIs reutilizam `apiHandler` + `requireAdmin()` + schemas Zod em `src/lib/admin/schemas.ts`.

- **Por quê**: mantém o bounded context coeso e evita espalhar links na navegação principal, conforme exigido.
- **Alternativa rejeitada**: páginas soltas sob `/admin` — espalharia o contexto e a navegação.

### D2 — Guarda de ambiente fail-closed (local-only)

`src/lib/lab/environment-guard.ts` expõe:

```
getLabEnvironment(): {
  enabled: boolean;
  supabaseHost: string | null;
  local: boolean;
  reason: "ok" | "disabled_flag" | "missing_url" | "non_local_supabase" | "remote_blocked";
}
assertLabEnvironment(): void  // lança LabEnvironmentError quando não permitido
```

Regras:

1. Exige `VENDEO_LAB_ENABLED === "true"` (default **false**). Qualquer outro valor → desabilitado.
2. Exige `NEXT_PUBLIC_SUPABASE_URL` parseável. Ausente/inválida → desabilitado (fail-closed).
3. Host deve ser local: `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`. Hosts adicionais só entram por `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS` (CSV).
4. Hosts de produção conhecidos (`*.supabase.co`, `*.supabase.in`, `*.supabase.com`) são **sempre bloqueados** nesta fase, mesmo se presentes na allowlist.
5. `assertLabEnvironment()` é chamado no início de **toda** página e de **toda** rota do laboratório, antes de qualquer acesso às tabelas `lab_*`, ao storage do laboratório ou aos providers. Páginas renderizam estado “Laboratório desabilitado neste ambiente” com o `reason`; APIs retornam `403` com `{ error, reason }`. As consultas de autenticação/autorização dos **layouts pais** (`(app)` e `admin`: sessão, usuário, `admin_users`, loja, documentos legais) permanecem permitidas — a guarda do laboratório não as precede e não promete bloqueá-las.
6. Nenhuma chamada paga ocorre antes da guarda.

- **Por quê**: o laboratório é uma ferramenta de desenvolvimento; apontar para produção seria catastrófico. Fail-closed significa que qualquer dúvida de configuração resulta em recusa.
- **Alternativa rejeitada**: detectar produção por `NODE_ENV`/`VERCEL_ENV` — o projeto não usa essas variáveis para selecionar Supabase e `NODE_ENV=production` também ocorre em builds locais.

### D3 — Modelo de dados: poucas tabelas + snapshots JSONB imutáveis

Oito tabelas próprias (`lab_*`), todas server-only/service-role, RLS habilitada, sem grants a `anon`/`authenticated`:

| Tabela | Papel | Cardinalidade |
|---|---|---|
| `lab_scenarios` | catálogo de cenários (slug, nome, status, versão corrente) | 1 → N versões |
| `lab_scenario_versions` | conteúdo versionado e imutável do cenário (`content` JSONB + `content_hash`) | 1 → N experimentos |
| `lab_experiments` | experimento (objetivo, hipótese, dimensão alterada fixa em `prompt`, alvo de modelo **fixo**, params, repetições, teto, status) | 1 → 2 variantes, N cenários, N runs, N avaliações |
| `lab_experiment_variants` | variante `baseline`/`candidate` com snapshot imutável do prompt | 2 por experimento |
| `lab_experiment_scenarios` | junção experimento × versão de cenário (conjunto pequeno) | N por experimento |
| `lab_runs` | execução: snapshot imutável, status, latência, usage, custo, erro, validação técnica, `calls` | N por variante × cenário × repetição |
| `lab_artifacts` | artefato gerado (path, MIME, dimensões, bytes, checksum) | N por run |
| `lab_human_evaluations` | voto humano (verdict, `baseline_run_id`, `candidate_run_id`, ordem cega, observação, avaliador, timestamp) | N por experimento × cenário (append-only) |

- **Prompt versions**: **não** há tabela dedicada. O conteúdo do prompt é congelado como JSONB imutável em `lab_experiment_variants.prompt_snapshot` (`{ name, content, contentHash, source }`) e copiado para `lab_runs.snapshot`. A tabela `lab_prompt_versions` fica como ponto de extensão para quando existir um editor/catálogo de prompts (F48.2+). Evita normalização prematura, conforme instruído.
- **Auditoria**: **não** usa `admin_audit_log` (evita acoplar uma ferramenta local-only ao CHECK compartilhado e a uma migration remota). A auditoria é por autoria (`created_by`), timestamps e imutabilidade (snapshots/avaliações append-only).
- **Por quê**: menor número de entidades que ainda responde “o que foi executado, com qual configuração, por quem e qual foi o veredito”.
- **Alternativa avaliada**: tabelas normalizadas de prompt/modelo/parâmetro — rejeitada por excesso de abstração nesta fase.

### D4 — Cenários controlados: fixtures versionadas + metadados no banco

- Fixtures em `fixtures/lab/scenarios/<slug>/` (`scenario.json` + `images/*.jpg`), somente dados **fictícios** (loja, produto, oferta inventados) ou explicitamente autorizados. Imagens de produto controladas e pequenas.
- O `scenario.json` segue um schema Zod (`LabScenarioContent`) com: `brief` (produto/oferta/mídia/contexto), `store` (identidade fictícia) e `identity` (text_only por padrão; logo/VS opcionais controlados).
- Um bootstrap (`scripts/uat/48-local-scenarios.mjs` ou seed idempotente) materializa `lab_scenarios` + `lab_scenario_versions` a partir das fixtures, calculando `content_hash` (SHA-256 do JSON canônico). Reaplicar é idempotente (não duplica versões).
- **Corpus inicial (3)**: `produto-oferta-preco` (oferta com preço e 1 auxiliar, **sem logo**), `produto-oferta-texto-obrigatorio` (texto obrigatório + aviso ilustrativo + validade, **sem logo**) e `produto-oferta-logo` (oferta com **logo controlado**). Todos `intent: "offer"`, `format: "1:1"`, `locale: "pt-BR"`.
- O schema é **extensível**: campos `intent`, `format`, `locale`, `mediaKinds` existem, mas apenas `offer`/`1:1`/`pt-BR` são aceitos em F48.1; qualquer outro valor é rejeitado com erro explícito `unsupported_scenario_mode`.
- **Sem** reuso acoplado de `scripts/benchmark-scenarios.ts` (CLI de dev, imagens placeholder); o schema é compatível para importação futura.

### D5 — Experimentos prompt-only com modelo fixo

`lab_experiments` guarda `name`, `objective`, `hypothesis`, `changed_dimension` (**fixa em `prompt` na F48.1**; `model`/`configuration` ficam para a F48.2), `model_target` (**fixo e idêntico para as duas variantes**), `params` (`{ size, quality, skipInputValidation }`), `repetitions ∈ [1,3]`, `max_runs ∈ [1,12]`, `primary_capability` (fixa `campaign_image`) e `status`.

- **Escopo mínimo (correção de bloqueio)**: o catálogo F47 tem hoje **um único** alvo para `campaign_image` (`gpt-5.5`). Comparar modelos exigiria um catálogo laboratorial de candidatos, que é F48.2; permitir a dimensão `model` agora criaria uma dimensão vazia. A F48.1 é, portanto, um **laboratório de prompts** com o modelo fixo.
- **Variantes**: exatamente duas por experimento (`baseline`, `candidate`), cada uma carregando apenas o `prompt_snapshot` (`{ name, content, contentHash, source }`). A baseline usa o conteúdo **oficial atual** do arquivo (`source: "official"`); a candidata usa um override (`source: "override"`) com o texto completo alterado. Modelo e params pertencem ao **experimento** e são idênticos para as duas variantes.
- **Alvo de modelo**: deve corresponder a uma linha **ativa** do `ai_model_catalog` para `campaign_image` (leitura) — nunca é criado/alterado no catálogo.
- **Congelamento (correção de ajuste)**: `draft` e `ready` têm configuração **editável** (sem runs); a partir do **primeiro run** (`running`) a configuração é **congelada** — o trigger de banco consulta o estado do experimento e bloqueia UPDATE das variantes/alvo/params somente depois do primeiro run. Editar após o primeiro run exige criar um novo experimento.
- **Imutabilidade estrutural (correção de bloqueio)**: como as 8 tabelas recebem `SELECT, INSERT, UPDATE, DELETE` para `service_role`, o congelamento **não pode depender apenas do UPDATE**. Triggers de banco SHALL bloquear, após o primeiro run do experimento: `INSERT`/`UPDATE`/`DELETE` em `lab_experiment_variants` e em `lab_experiment_scenarios`; `DELETE` em `lab_experiments` com histórico (encerramento por `archived`); e `DELETE` em `lab_runs` (**sempre**, preservando o histórico de reexecução). A criação do experimento SHALL ser **atômica** via RPC `lab_create_experiment` (SECURITY DEFINER, `search_path=''`), pois chamadas PostgREST separadas não formam uma transação. Em `lab_experiment_variants` e `lab_experiment_scenarios`, `experiment_id` SHALL ser **imutável** e o congelamento SHALL considerar **ambos** `OLD.experiment_id` e `NEW.experiment_id`, impedindo mover uma linha de um experimento editável para um experimento congelado.

### D6 — Harness de gateway isolado (sem tocar o gateway F46)

O laboratório compõe uma **instância paralela** de `AiGateway` apenas para o run:

```
const resolver = new LabModelResolver({ fixedTarget, fallbackResolver: defaultAiModelResolver });
const gateway  = new AiGateway(resolver, defaultAdapterRegistry);   // gateway.ts intocado
const promptLoader = new LabPromptLoader({ overrides });            // extends PromptLoader
const sink     = new LabTelemetrySink({ onEnvelope });              // NÃO grava generation_events
// Invocação direta: gateway.invoke("campaign_image", request, telemetry)
// SEM OpenAIImageProvider → sem fallback automático para campaign_image_edit
```

- `LabModelResolver implements AiModelResolver`: devolve o **alvo fixo do experimento** para `campaign_image` (a única capacidade invocada no run) e delega ao `defaultAiModelResolver` (leitura) para qualquer outra capacidade. **Nunca** consulta nem altera `ai_model_selection` para o alvo em escopo.
- `LabPromptLoader extends PromptLoader`: sobrescreve `load(name, variables)` servindo o `prompt_snapshot` da variante quando `name` casa com o prompt sob teste; caso contrário delega ao loader real (fs). Nenhum prompt oficial é escrito.
- `LabTelemetrySink` (novo, em `src/lib/ai/lab-telemetry-sink.ts`, sob `src/lib/ai/**` para respeitar o gate de arquitetura que restringe `resolveAiCost`): computa custo via `resolveAiCost` (leitura) e **acumula** envelopes sanitizados para o run, **preservando a `CostResolution` completa** (`costSource`, `pricingVersion`, `costFormulaVersion`, componentes `textComponentUsd`/`imageToolComponentUsd` + `imageToolPricingProvider`/`imageToolPricingModel`/`imageToolPricingVersion`, `costEstimationNote`) e a sinalização de parcialidade via `costFormulaVersion`/`costEstimationNote` (o tipo real **não** possui `imageUnitUsd` nem um flag `costPartial`; a cobertura `complete|partial|missing` é derivada no domínio do laboratório). **Não** chama `AiCostTracker.record` e **não** grava `generation_events`.
- `AiTelemetryContext.operationRunType` reutiliza `"campaign_delivery"` (o union tem exatamente 4 domínios e um teste que o trava); o laboratório marca `runType: "lab"` no **próprio** snapshot. Adicionar um tipo `lab` ao union fica como extensão futura caso o laboratório passe a persistir custos.
- **Sem** segundo cliente de provider e **sem** duplicar adapters: usa `defaultAdapterRegistry` e `getApiKey` da F46.

### D7 — Caminho de execução: single-shot real, validação dispensada, revisão não redefinida

Cada run executa **uma geração de imagem** pelo caminho real do diretor, não o state machine completo:

1. `ImageGenerationService` ganha um seam **aditivo** e público `buildDirectorPrompt(brief, context)` que reutiliza `buildPromptVariables` + `assemblePrompt` (nenhuma lógica duplicada, nenhuma mudança de comportamento). O `generateImage` continua usando os mesmos métodos internos.
2. O laboratório monta o prompt com `buildDirectorPrompt` (com o `LabPromptLoader`), constrói o request real (`productImagesDataUrls`, `identityImageUrl`, `size`, `quality`, `tools: "image_generation"`) e chama **`gateway.invoke("campaign_image", request, telemetry)` diretamente**, sem passar pelo `OpenAIImageProvider`.
3. `skipInputValidation` é sempre `true` em F48.1: a fase de validação de visão é dispensada (o mesmo override `brief_review_confirmed` já suportado pela F43), eliminando uma chamada paga e isolando a dimensão sob teste.
4. **Fallback automático desabilitado (correção de ajuste)**: o `OpenAIImageProvider` consulta `defaultAiModelResolver` no fallback `campaign_image_edit` e pode disparar uma **segunda chamada paga** por erro de capability. Para garantir exatamente uma chamada por run, o laboratório **não usa o provider**: invoca a capacidade `campaign_image` direto no gateway. `campaign_image_edit` será alvo/experimento explícito em fatia futura.
5. **A revisão produtiva (`campaign_image_review`) não é executada em F48.1** e **não é redefinida**. Se vier a ser executada diagnosticamente em F48.2+, seu resultado será apresentado como **evidência separada**, nunca como decisão do experimento.
6. `ImageGenerationService.generateImage` (state machine com review/retry) e o `OpenAIImageProvider` permanecem intactos para a produção.

- **Por quê single-shot**: comparação A/B justa e custo previsível (**exatamente 1 chamada paga por run**, garantida pela ausência de fallback); evita que o loop de revisão/regeneração contamine a comparação e multiplique o custo. A montagem do prompt e a chamada de imagem são o caminho real que produz a campanha.
- **Trade-off**: o laboratório não reproduz o loop de revisão nem o fallback de edição da produção. Aceitável porque a decisão é humana, a revisão é evidência e o fallback fica para uma comparação explícita futura.

### D8 — Snapshots imutáveis, idempotência e histórico de reexecução

`lab_runs.snapshot` (JSONB imutável, escrito **na transação da reserva** a partir do `p_snapshot` montado pelo serviço e nunca atualizado exceto campos de resultado) congela:

```
{
  scenarioVersionId, scenarioVersion, scenarioContentHash,
  prompt: { name, content, contentHash, source },
  capability, modelTarget: { provider, model, protocol },
  params, changedDimension: "prompt", variantRole,
  codeVersion: { gitSha?, buildId? } | null,
  baselineConfig, candidateConfig,   // para leitura comparativa
  runType: "lab"
}
```

Campos de resultado preenchidos no fim: `status`, `startedAt`, `finishedAt`, `latencyMs`, `usage`, `estimatedCostUsd`, `provider`, `model`, `protocol`, `attempts`, `errorType`, `errorMessage` (sanitizado por `sanitizeAiErrorMessage`), `technicalValidation`, `calls[]`. O custo SHALL ser congelado com a **origem completa** (`cost.costSource`, `cost.pricingVersion`, `cost.costFormulaVersion`, componentes `textComponentUsd`/`imageToolComponentUsd` + `imageToolPricingProvider`/`imageToolPricingModel`/`imageToolPricingVersion`, `costEstimationNote`) e a sinalização de parcialidade via `costFormulaVersion`/`costEstimationNote` (o tipo real **não** possui `imageUnitUsd` nem um flag `costPartial`; a cobertura `complete|partial|missing` é derivada no domínio do laboratório) — `estimatedCostUsd` é o agregado, não a única evidência.

- **Imutabilidade**: `snapshot` e os campos de configuração nunca são atualizados por edição de prompt/modelo/cenário/pricing; só campos de resultado do próprio run. Trigger de banco impede UPDATE das colunas de snapshot.
- **Idempotência**: `operation_id` único (UUID gerado pela UI, reutilizado em retry). A verificação ocorre **depois** do `FOR UPDATE` do experimento (D14) e é **vinculada ao payload**: repetir a mesma operação devolve o run existente sem reexecutar; reutilizar o mesmo UUID com outro experimento/variante/cenário/repetição é rejeitado com `idempotency_conflict`.
- **Reexecução explícita**: um novo run referencia `supersedes_run_id` (validado como pertencente à **mesma combinação, incluindo `repetition_index`, e em estado terminal**) e recebe `run_sequence` **derivado no banco** (`max+1` da combinação, nunca aceito do cliente); o histórico é preservado e visível. Constraint única em `(experiment_id, variant_id, scenario_version_id, repetition_index, run_sequence)`.

### D9 — Validação automática limitada ao técnico

`src/lib/lab/technical-validation.ts` verifica **fatos objetivos** com `sharp` (já é dependência):

- artefato presente e decodificável (`sharp(buffer).metadata()` não lança);
- MIME real (`format` → `image/png|jpeg|webp`), dimensões, proporção, bytes;
- imagem vazia/corrompida;
- imagem uniforme (totalmente branca/preta/vazia): `sharp().stats()` com desvio-padrão ≈ 0 em todos os canais (threshold documentado);
- latência, custo, usage, retries/tentativas e status da chamada (vindos dos envelopes do `LabTelemetrySink`);
- saída estruturada válida: campo reservado (`structuredOutputValid: null`) — não há capacidade de texto em F48.1;
- **OCR** de texto obrigatório: **adiado** (exigiria dependência nova) — campo reservado `ocrAlert: null`; ponto de extensão.
- **Proibido**: qualquer score/nota de beleza, composição, apelo comercial, profissionalismo ou “publicável”; nenhum modelo textual aprova/reprova qualidade visual.

### D10 — Artefatos: bucket próprio, paths, retenção e cleanup

- Novo bucket **privado** `lab-artifacts` (service_role only; **sem** policy para `authenticated`; `public=false`).
- Paths: `experiments/{experimentId}/runs/{runId}/output.{png|jpg}` e, quando o cenário precisar materializar a imagem de entrada, `experiments/{experimentId}/runs/{runId}/inputs/{n}.{ext}`. Nunca usa os paths de `campaign-images` (`{storeId}/...`).
- Persistência: `lab_artifacts` registra `storage_path`, `mime_type`, `width`, `height`, `bytes`, `checksum` (SHA-256).
- Leitura: URLs assinadas de curta duração (`createSignedUrl`, 3600s) geradas server-side na API de detalhe/comparação.
- **Retenção/cleanup**: comando/script `scripts/lab/48-cleanup-artifacts.mjs` (opt-in) remove os **arquivos** de runs `archived`/mais antigos que `LAB_ARTIFACT_RETENTION_DAYS` (default 30) e marca `lab_artifacts` como removidos; **metadados, hashes, runs e avaliações permanecem**. Execução manual, sem scheduler. Run em andamento nunca é limpo. Retenção especial de arte aprovada fica para a F48.2.

### D11 — API administrativa

Sob `/api/admin/laboratorio`, todas com `requireAdmin()` + `assertLabEnvironment()` + schemas Zod:

| Rota | Método | Função |
|---|---|---|
| `/scenarios` | GET | lista versões de cenário disponíveis |
| `/experiments` | GET/POST | lista/cria experimento (com variantes e cenários) |
| `/experiments/[id]` | GET | detalhe (variantes, runs, avaliações, budget restante) |
| `/experiments/[id]/estimate` | GET | estimativa de custo do plano (repetições × cenários) por componente de pricing |
| `/experiments/[id]/runs` | POST | executa **um** run (NDJSON streaming) — exige `{ variantId, scenarioVersionId, repetitionIndex, confirmed: true, operationId }` |
| `/runs/[id]` | GET | detalhe do run + URLs assinadas dos artefatos |
| `/experiments/[id]/evaluations` | POST | registra avaliação humana |

- **Streaming**: o run usa NDJSON (`Content-Type: application/x-ndjson`) espelhando `generate-image`, porque a geração pode levar minutos e emite fases; o evento final traz `runId` (a imagem vai para o bucket, não no stream).
- **Confirmação**: `confirmed: true` obrigatório; a UI só habilita após exibir a estimativa. Sem confirmação → `422` `confirmation_required`.
- **Erros**: mapeamento por código (`unsupported_scenario_mode`, `budget_exceeded`, `experiment_not_ready`, `variant_not_found`, `environment_blocked`, …) para 400/403/409/422.

### D12 — UI administrativa

`src/app/(app)/admin/laboratorio/`:

- `layout.tsx` — guarda de ambiente + sub-navegação interna (Experimentos / Cenários / Avaliações) com `Link`s; um único link “Laboratório” na nav principal do admin.
- `page.tsx` — experimentos recentes + avaliações pendentes (funcional, sem dashboard sofisticado).
- `experimentos/novo/page.tsx` + form — nome, objetivo, hipótese, dimensão fixa `prompt`, cenário(s), baseline, candidata, repetições, teto; modelo fixo exibido como não editável por variante.
- `experimentos/[id]/page.tsx` — detalhe: variantes, runs, budget restante, botão “Executar run” (com estimativa + confirmação) e progresso NDJSON.
- `experimentos/[id]/comparar/page.tsx` — comparação lado a lado + voto humano.
- `cenarios/page.tsx` — lista de cenários versionados (somente leitura).
- Segue `openspec/design-system/MASTER.md` (dark OLED, Poppins/Open Sans, `lucide-react`, sem emojis/light mode) e usa os primitivos `src/components/ui/`.

### D13 — Comparação humana como fonte de qualidade

- Tela lado a lado por cenário: baseline vs candidata, com arte (signed URL), status técnico, custo, latência, erros/alertas, repetições disponíveis e seletor para **ocultar** modelo/prompt durante a escolha.
- Voto: `baseline` | `candidate` | `tie` | `none`, observação livre, avaliador (`requireAdmin` user), timestamp, `baseline_run_id`/`candidate_run_id` e `blind_order`. `lab_human_evaluations` é **append-only** — **trigger de banco impede `UPDATE`/`DELETE`** (não apenas convenção). A API/serviço SHALL validar que os runs comparados pertencem ao **mesmo experimento e à mesma versão de cenário** e às variantes `baseline`/`candidate` corretas. A UI mostra a avaliação mais recente por cenário e permite reavaliar (novo registro).
- Nenhuma métrica automática decide; a decisão humana é a única avaliação de qualidade.

### D14 — Segurança financeira e limites

- Toda chamada paga exige `confirmed: true` (ação humana explícita) + estimativa exibida.
- Limites: `MAX_SCENARIOS_PER_EXPERIMENT = 3`, `MAX_REPETITIONS = 3`, `MAX_RUNS_PER_EXPERIMENT = 12` (default 6), `MAX_CONCURRENT_LAB_RUNS = 1` (**global no laboratório** — no máximo um run ativo em toda a tabela `lab_runs`, independentemente do experimento).
- Sem loops automáticos: a F48.1 executa **um run por ação explícita**; não há “executar tudo”.
- **Reserva atômica obrigatória (correção de bloqueio)**: um “lock lógico via status + checagem de budget” **não é atômico** — duas requisições simultâneas podem passar pela checagem e criar dois runs pagos. A criação do run SHALL ser uma **reserva transacional** via RPC `lab_reserve_run` (SECURITY DEFINER, `search_path=''`) que, sob `SELECT ... FOR UPDATE` no experimento e **na mesma transação**: (1) adquire o lock; (2) verifica idempotência por `operation_id` **após o lock**, vinculada ao payload original (`idempotency_conflict` se divergir); (3) valida prontidão (`ready|running|evaluated`); (4) **valida as relações** (variante pertence ao experimento, cenário vinculado via `lab_experiment_scenarios`, `repetition_index ∈ [1, repetitions]`, `supersedes_run_id` da **mesma combinação, incluindo `repetition_index`, e em estado terminal**); (5) conta os runs contra `max_runs`; (6) recusa run ativo; (7) **deriva `run_sequence` no banco** e insere o run `pending` **com o `p_snapshot` completo**, na mesma transação. Reforço por **índice único parcial global** `uq_lab_runs_one_active_global ON lab_runs ((true)) WHERE status IN ('pending','running')` — garante **no máximo um run ativo em todo o laboratório**, mesmo entre experimentos diferentes. O `FOR UPDATE` no experimento serializa idempotência/budget do mesmo experimento; a exclusão cruzada entre experimentos é garantida pelo índice global (o perdedor recebe `unique_violation` → `run_already_active`). **Nenhuma chamada paga ocorre antes da reserva.** Teto → `409 budget_exceeded`; concorrência → `409 run_already_active`; snapshot ausente → `missing_snapshot`; `operation_id` reutilizado com outro payload → `409 idempotency_conflict`.
- Testes/CI: nenhuma chamada real — fakes de `AiInvoker` e `LabTelemetrySink` com envelopes simulados; `architecture-guard` impede SDK/wire fora dos adapters. UAT com providers reais é manual, opt-in, com orçamento documentado.

### D15 — Auditoria e ausência de secrets

- Auditoria do laboratório: autoria + timestamps + imutabilidade dos snapshots + avaliações append-only. Não usa `admin_audit_log` (D3).
- **Nenhum secret** em banco, logs, snapshots ou artefatos: erros sanitizados por `sanitizeAiErrorMessage`; nunca se grava `OPENAI_API_KEY`/`GEMINI_API_KEY`; `snapshot.calls[]` guarda apenas capability/provider/model/protocol/status/latência/usage/custo.
- Requisito operacional: usar chave/projeto de desenvolvimento separado para os providers no UAT (documentado em `.env.example`/docs), sem introduzir novo mecanismo de chave.

### D16 — Estratégia de migration local e remota

1. Criar e testar a migration **localmente** (tabelas + bucket + RLS + triggers), com `npx supabase db reset` e `db lint`.
2. Implementar e rodar **UAT local** (Docker) com a migration local.
3. **Remoto (após a UAT)**: aplicar a migration **deliberadamente** no remoto para **não deixar migration pendente** — uma migration em `supabase/migrations` seria arrastada e aplicada por um `supabase db push` de outra fase. O schema remoto fica **inerte** (tabelas/bucket existem, sem uso) e `VENDEO_LAB_ENABLED=false` em produção, de modo que nenhuma superfície acessa as tabelas `lab_*` fora do local.
4. Rollback: migration aditiva com bloco REVERT (drop bucket → drop tabelas), sem tocar objetos existentes.

### D17 — Das descobertas do laboratório para testes determinísticos

O design prevê o fluxo: um resultado humano que se torna decisão vira **fixture/caso regressivo determinístico**:

- O `lab_runs.snapshot` (prompt/modelo/params/cenário + hash) é a fonte para extrair um caso.
- A avaliação humana + validação técnica documentam a decisão.
- A conversão para teste usa **fakes** (envelope simulado + resposta fake do provider), nunca a imagem paga; o teste passa a travar o contrato (ex.: presença de bloco no prompt, params enviados, alvo resolvido) sem depender de arte gerada.
- A suíte **não** depende de imagens geradas; achados do laboratório não tornam os testes não-determinísticos.

### D18 — Compatibilidade F46/F47 e pontos de extensão

- F46: `gateway.ts` intocado; `AiInvoker`/`AiModelResolver`/`AiAdapterRegistry`/adapters reutilizados; nenhuma env-var de modelo nova.
- F47: catálogo lido como allowlist; `ai_model_selection` nunca consultada/alterada para o alvo em escopo; `PersistedModelResolver` permanece o único dono da seleção produtiva.
- Extensão F48.2+: comparação de **modelo/configuração** com catálogo laboratorial de candidatos, `campaign_image_edit` como alvo/experimento explícito, `lab_prompt_versions` (editor de prompts), tipos de run adicionais (review diagnóstica, copy), cenários de serviços/informativos/9:16/carrossel/i18n (`intent`/`format`/`locale`/`mediaKinds` já previstos), execução em lote com fila, habilitar remoto com `VENDEO_LAB_ALLOW_REMOTE`, promoção assistida para o catálogo.

## Data model (sketch)

```sql
-- Todas: RLS habilitada; REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT ... TO service_role.
CREATE TABLE public.lab_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  current_version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lab_scenario_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.lab_scenarios(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  fixture_path TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, version)
);

CREATE TABLE public.lab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  changed_dimension TEXT NOT NULL DEFAULT 'prompt'
    CHECK (changed_dimension IN ('prompt')),  -- F48.1: prompt-only; F48.2 amplia
  primary_capability TEXT NOT NULL DEFAULT 'campaign_image',
  model_target JSONB NOT NULL,               -- fixo e idêntico para as duas variantes
  params JSONB NOT NULL,                     -- { size, quality, skipInputValidation }
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','running','evaluated','archived')),
  repetitions INT NOT NULL DEFAULT 1 CHECK (repetitions BETWEEN 1 AND 3),
  max_runs INT NOT NULL DEFAULT 6 CHECK (max_runs BETWEEN 1 AND 12),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lab_experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('baseline','candidate')),
  label TEXT NOT NULL,
  prompt_snapshot JSONB NOT NULL,   -- { name, content, contentHash, source }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, role)
);

CREATE TABLE public.lab_experiment_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL REFERENCES public.lab_scenario_versions(id),
  position INT NOT NULL,
  UNIQUE (experiment_id, scenario_version_id)
);

CREATE TABLE public.lab_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.lab_experiment_variants(id),
  scenario_version_id UUID NOT NULL REFERENCES public.lab_scenario_versions(id),
  repetition_index INT NOT NULL CHECK (repetition_index >= 1),
  run_sequence INT NOT NULL DEFAULT 1 CHECK (run_sequence >= 1),
  supersedes_run_id UUID REFERENCES public.lab_runs(id),
  operation_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','succeeded','failed','cancelled','timeout')),
  snapshot JSONB NOT NULL CHECK (snapshot <> '{}'::jsonb),
  provider TEXT, model TEXT, protocol TEXT, capability TEXT,
  attempts INT NOT NULL DEFAULT 0,
  latency_ms INT,
  usage JSONB,
  estimated_cost_usd NUMERIC(12,6),
  cost_detail JSONB,               -- CostResolution agregada (origem/fórmula/versão/parcial)
  error_type TEXT,
  error_message TEXT,
  technical_validation JSONB,
  calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, variant_id, scenario_version_id, repetition_index, run_sequence)
);

-- Reserva atômica: no máximo um run ativo GLOBAL no laboratório (reforço do RPC; MAX_CONCURRENT_LAB_RUNS = 1)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_runs_one_active_global
  ON public.lab_runs ((true))
  WHERE status IN ('pending','running');

CREATE TABLE public.lab_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.lab_runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('output','input','diagnostic')),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  width INT, height INT, bytes BIGINT,
  checksum TEXT,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, kind, storage_path)
);

CREATE TABLE public.lab_human_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL REFERENCES public.lab_scenario_versions(id),
  baseline_run_id UUID NOT NULL REFERENCES public.lab_runs(id),
  candidate_run_id UUID NOT NULL REFERENCES public.lab_runs(id),
  blind_order TEXT CHECK (blind_order IN ('baseline_left','candidate_left')),
  verdict TEXT NOT NULL CHECK (verdict IN ('baseline','candidate','tie','none')),
  observation TEXT,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Bucket** (migration): `INSERT INTO storage.buckets (id,name,public,...) VALUES ('lab-artifacts','lab-artifacts',false,...) ON CONFLICT DO NOTHING;` + policies `FOR ALL TO service_role`; **sem** policies para `authenticated`/`anon`.

## RPC de reserva atômica (sketch)

`SECURITY DEFINER`, `search_path=''`, `REVOKE` de PUBLIC/anon/authenticated, `GRANT` a service_role. A chamada paga só ocorre depois do retorno bem-sucedido.

```sql
CREATE OR REPLACE FUNCTION public.lab_reserve_run(
  p_experiment_id UUID,
  p_variant_id UUID,
  p_scenario_version_id UUID,
  p_repetition_index INT,
  p_supersedes_run_id UUID,
  p_snapshot JSONB,
  p_operation_id UUID,
  p_actor_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_experiment public.lab_experiments;
  v_used INT;
  v_run_id UUID;
  v_existing UUID;
  v_existing_experiment UUID;
  v_existing_variant UUID;
  v_existing_scenario UUID;
  v_existing_repetition INT;
  v_sequence INT;
BEGIN
  IF p_snapshot IS NULL OR p_snapshot = '{}'::jsonb THEN RAISE EXCEPTION 'missing_snapshot'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  -- (1) Lock do experimento ANTES de qualquer checagem (serializa as reservas).
  SELECT * INTO v_experiment FROM public.lab_experiments
    WHERE id = p_experiment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'experiment_not_found'; END IF;

  -- (2) Idempotência verificada APÓS o lock e VINCULADA ao payload original.
  SELECT id, experiment_id, variant_id, scenario_version_id, repetition_index
    INTO v_existing, v_existing_experiment, v_existing_variant, v_existing_scenario, v_existing_repetition
  FROM public.lab_runs WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_experiment <> p_experiment_id
       OR v_existing_variant <> p_variant_id
       OR v_existing_scenario <> p_scenario_version_id
       OR v_existing_repetition <> p_repetition_index THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'run_id', v_existing);
  END IF;

  -- (3) Prontidão: avaliar NÃO encerra as execuções.
  IF v_experiment.status NOT IN ('ready','running','evaluated') THEN RAISE EXCEPTION 'experiment_not_ready'; END IF;

  -- (4) Invariantes relacionais sob o lock.
  IF NOT EXISTS (
    SELECT 1 FROM public.lab_experiment_variants
    WHERE id = p_variant_id AND experiment_id = p_experiment_id
  ) THEN RAISE EXCEPTION 'variant_not_in_experiment'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lab_experiment_scenarios
    WHERE experiment_id = p_experiment_id AND scenario_version_id = p_scenario_version_id
  ) THEN RAISE EXCEPTION 'scenario_not_in_experiment'; END IF;

  IF p_repetition_index IS NULL OR p_repetition_index < 1 OR p_repetition_index > v_experiment.repetitions THEN
    RAISE EXCEPTION 'repetition_out_of_range';
  END IF;

  IF p_supersedes_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lab_runs
    WHERE id = p_supersedes_run_id AND experiment_id = p_experiment_id
      AND variant_id = p_variant_id AND scenario_version_id = p_scenario_version_id
      AND repetition_index = p_repetition_index
      AND status IN ('succeeded','failed','cancelled','timeout')
  ) THEN RAISE EXCEPTION 'invalid_supersedes_run'; END IF;

  -- (5) Budget dentro da transação.
  SELECT count(*) INTO v_used FROM public.lab_runs WHERE experiment_id = p_experiment_id;
  IF v_used >= v_experiment.max_runs THEN RAISE EXCEPTION 'budget_exceeded'; END IF;

  -- (6) run_sequence DERIVADO no banco (nunca aceito do cliente).
  SELECT COALESCE(max(run_sequence), 0) + 1 INTO v_sequence
  FROM public.lab_runs
  WHERE experiment_id = p_experiment_id AND variant_id = p_variant_id
    AND scenario_version_id = p_scenario_version_id AND repetition_index = p_repetition_index;

  -- (7) Insere o run com o snapshot COMPLETO na mesma transação.
  -- O índice único parcial reforça a exclusão mútua de runs ativos.
  INSERT INTO public.lab_runs (
    experiment_id, variant_id, scenario_version_id, repetition_index, run_sequence,
    supersedes_run_id, operation_id, status, snapshot, created_by
  ) VALUES (
    p_experiment_id, p_variant_id, p_scenario_version_id, p_repetition_index, v_sequence,
    p_supersedes_run_id, p_operation_id, 'pending', p_snapshot, p_actor_id
  ) RETURNING id INTO v_run_id;

  UPDATE public.lab_experiments SET status = 'running', updated_at = now()
    WHERE id = p_experiment_id AND status IN ('ready','evaluated');

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'run_id', v_run_id, 'run_sequence', v_sequence);
EXCEPTION
  WHEN unique_violation THEN
    -- Corrida de operação: operation_id já existe → idempotente se o payload coincide.
    SELECT id, experiment_id, variant_id, scenario_version_id, repetition_index
      INTO v_existing, v_existing_experiment, v_existing_variant, v_existing_scenario, v_existing_repetition
    FROM public.lab_runs WHERE operation_id = p_operation_id;
    IF FOUND THEN
      IF v_existing_experiment <> p_experiment_id
         OR v_existing_variant <> p_variant_id
         OR v_existing_scenario <> p_scenario_version_id
         OR v_existing_repetition <> p_repetition_index THEN
        RAISE EXCEPTION 'idempotency_conflict';
      END IF;
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'run_id', v_existing);
    END IF;
    -- Caso contrário, é o índice de run ativo.
    RAISE EXCEPTION 'run_already_active';
END;
$$;
```

> O **snapshot é montado pelo serviço ANTES da reserva** e enviado em `p_snapshot`; a RPC grava o snapshot completo na **mesma transação** — nenhum run pode existir com snapshot vazio. O `operation_id` é **vinculado ao payload original**: reutilizá-lo com outro experimento/variante/cenário/repetição resulta em `idempotency_conflict` (nunca devolve um run não relacionado). O `unique_violation` do `operation_id` é resolvido como idempotente quando o payload coincide; o do índice de run ativo vira `run_already_active` (409). O `supersedes_run_id` exige **mesma combinação** (incluindo `repetition_index`) e **estado terminal**. O `run_sequence` é derivado no banco.

## Estados e transições

**Experimento**: `draft → ready → running ⇄ evaluated → archived`.
- `draft → ready`: exatamente 2 variantes + ≥1 cenário + repetições/teto válidos + alvo fixo ativo no catálogo.
- `ready → running`: primeiro run iniciado (configuração congelada).
- `running → evaluated`: primeira avaliação humana registrada.
- `evaluated → running`: novo run reservado após uma avaliação — **avaliar não encerra as execuções**.
- `ready|running|evaluated → archived`: arquivamento manual.
- Proibido: `draft → running`; qualquer transição a partir de `archived`.

**Run**: `pending → running → succeeded | failed | cancelled | timeout`.
- `pending → running` no início do stream; terminal em `finally` (mesmo com desconexão do cliente).
- Reexecução não reabre o run: cria novo run (`supersedes_run_id`, `run_sequence` derivado no banco).
- Run órfão em `pending` **ou** `running` (processo morto) é marcado `failed` de forma preguiçosa na próxima leitura após `LAB_RUN_STALE_MS` (default 15 min), usando `started_at`/`created_at` — sem scheduler. A reconciliação cobre os **dois** estados ativos, evitando que um `pending` preso bloqueie o experimento para sempre.

## Limites (constantes do domínio)

| Constante | Valor | Efeito |
|---|---|---|
| `MAX_SCENARIOS_PER_EXPERIMENT` | 3 | rejeita experimento maior |
| `MAX_REPETITIONS` | 3 | rejeita `repetitions` acima |
| `MAX_RUNS_PER_EXPERIMENT` | 12 | teto absoluto do budget |
| `MAX_CONCURRENT_LAB_RUNS` | 1 | um run por vez **global** (índice único parcial global) |
| `LAB_RUN_STALE_MS` | 900000 | marca run órfão (`pending`/`running`) como falho |
| `LAB_ARTIFACT_RETENTION_DAYS` | 30 | cleanup manual de artefatos |

## Tratamento de falhas

- Erro do provider → run `failed` com `errorType`/`errorMessage` sanitizados + `calls[]` com os envelopes reais; nada é gravado em `generation_events`.
- Falha ao gravar artefato → run `failed` (`artifact_persistence_failed`), sem artefato órfão (remove o objeto se o insert falhar).
- Falha de leitura/gravação do banco → erro mapeado na API; o run não fica `running` (transição terminal em `finally`).
- Desconexão do cliente durante o stream → geração continua e o run é finalizado; o cliente reabre o detalhe.
- Budget/concorrência/ambiente → recusa antes de qualquer chamada paga.

## Riscos / Trade-offs

- **[Chamada paga acidental]** → guarda fail-closed + `confirmed: true` + estimativa + limites + sem loops + testes sem rede.
- **[Vazamento para produção]** → tabelas/bucket próprios, RLS service_role, sem `generation_events`/`ai_model_selection`/campanhas/créditos, guardas arquiteturais e testes de isolamento.
- **[Seam enfraquecer o gateway]** → gateway intocado; instância paralela com resolver injetado; `f47-contract-guard` e `architecture-guard` estendidos.
- **[Comparação injusta]** → mesma imagem/modelo/params; a única dimensão comparada é o prompt (F48.1); `model`/`configuration` só na F48.2.
- **[Custo imprevisível]** → single-shot (1 imagem/run), validação dispensada, teto de runs, estimativa antes.
- **[Single-shot ≠ pipeline completo]** → aceito; decisão é humana e revisão é evidência, não gate.
- **[Run órfão `pending`/`running`]** → transição terminal em `finally` + reconciliação preguiçosa que cobre os dois estados ativos (usa `started_at`/`created_at`).
- **[Migration remota]** → não exigida para deploy; documentada para paridade futura.

## Decisões consolidadas

1. **Retenção**: 30 dias para os **arquivos**; metadados, hashes, runs e avaliações **permanecem**. Retenção especial de arte aprovada fica para a F48.2.
2. **Chave dedicada**: chave/projeto de desenvolvimento separado é **requisito operacional** da UAT (usa `OPENAI_API_KEY`/`GEMINI_API_KEY`; nenhum mecanismo novo de chave).
3. **Corpus inicial**: 3 cenários — **dois sem logo** e **um com logo controlado**.
4. **Revisão diagnóstica**: permanece **fora** da F48.1.
5. **Pricing incompleto**: a execução é permitida **somente após aviso explícito** de pricing parcial/indisponível (a UI exibe faixa/aviso, nunca um valor exato).
