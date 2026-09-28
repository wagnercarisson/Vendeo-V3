# Design — F48.2.2: Fundação da bancada de geração no Admin/Laboratório

## Context

A F48.1 entregou um **laboratório de comparação A/B** (baseline × candidata, cenários fixture, avaliação cega) e a F48.2.1 uma bancada **manual** para os prompts do Diretor — ambas no mesmo modelo de dados (`lab_experiments` → variantes → cenários → avaliação). A nova F48.2.2 não é A/B: é uma **bancada de geração** que exercita o caminho real (loja de teste local, branding persistido, imagens enviadas pelo admin, prompt manual, preset de modelo/qualidade) e registra evidência técnica e financeira de **uma** geração por vez.

O laboratório já provê quase toda a infraestrutura de isolamento que a bancada precisa:

- guarda de ambiente fail-closed (`src/lib/lab/environment-guard.ts`);
- gateway paralelo com alvo fixo e single-shot (`src/lib/lab/gateway/runtime.ts`, `lab-model-resolver.ts`);
- provider no-op que explode se invocado (`noop-image-provider.ts`);
- sink de custo read-only, sem `generation_events` (`src/lib/ai/lab-telemetry-sink.ts`);
- persistência de artefato com URL assinada (`src/lib/lab/persistence/artifact-service.ts`);
- validação técnica com `sharp` (`technical-validation.ts`);
- gates arquiteturais e detector `forbidden_production_access` (`src/lib/ai/__tests__/architecture-guard.test.ts:139-234`, `src/lib/lab/__tests__/lab-isolation.contract.test.ts`).

Lacunas confirmadas na investigação:

1. **O modelo A/B não serve** à bancada (sem baseline/candidata/cenário/repetição/rubrica).
2. **Tipografia some antes da geração**: `store_brand_profiles.typography_direction` existe (`src/lib/brand-assets/types.ts:46`) mas não entra em `BrandProfileSnapshot` (`src/components/campaign/types.ts:7-15`), no mapper `resolveStoreIdentity` (`src/lib/store-identity-service.ts:94-102`) nem no prompt (`src/lib/image-generation/services/art-director-briefing.ts:225-254`).
3. **Qualidade só é honrada no caminho `responses`** (`src/lib/ai/adapters/responses.ts:42-48`); o `ImagesAdapter` ignora `quality` (`src/lib/ai/adapters/images.ts:49-58`).
4. **`gpt-image-2.5-flare` não existe** no código — só no roadmap.
5. **`campaign-images` é alvo proibido** e `stores`/`store_brand_profiles` não estão na allowlist do detector de isolamento.
6. **O path guard de artefato exige `experiments/{uuid}/runs/{uuid}/...`** (`artifact-service.ts:97`).

## Goals / Non-Goals

**Goals:**

- Bancada local `/admin/laboratorio/bancada`, admin-only, desktop-only, fail-closed fora do ambiente local.
- Seleção de loja de teste local e carregamento do **branding completo**, incluindo direção tipográfica, sem alterar o pipeline produtivo.
- Snapshot de campanha compatível com os contratos reais (produto/oferta) e upload local de imagens.
- Configuração extensível por dimensões + presets de modelo/qualidade validados, com spike bloqueante.
- Invocação isolada single-shot, sem fallback/retry oculto, com evidência técnica e financeira.
- Uma geração ativa por vez, estimativa + confirmação, custo distinguindo usage/calculado/estimado.
- Testes negativos provando ausência de acesso remoto/produção e ausência de créditos.

**Non-Goals:**

- Montador determinístico do prompt Oferta 1:1, injeção automática de branding no prompt, envio automático de logo/assinatura ao modelo, aprovação/versionamento do prompt, ciclo de ajuste/regeneração e avaliação/aprovação final (F48.2.3).
- Intenções Destaque/Exclusivo, formato 9:16, temas, carrossel, serviços, informativas, comparação cega, avaliação automática, mobile.
- Alterar o pipeline produtivo, o `ImagesAdapter` produtivo, o registry padrão de adapters, `prompts/`, `campaign-images`, créditos ou promoção de modelos/prompts/pipelines.
- Programa de orçamento/reserva financeira complexa.

## Decisions

### D1 — Entidade própria, não A/B

A bancada usa tabelas próprias `lab_bench_runs` e `lab_bench_artifacts`. **Alternativa rejeitada:** reutilizar `lab_runs`/`lab_artifacts` — a FK obrigatória para `lab_experiments`/variantes/cenários forçaria registros falsos e contaminaria o histórico A/B.

### D2 — Bounded context `src/lib/lab/bench/**`

A bancada vive sob `src/lib/lab/**` para **herdar** os gates arquiteturais do laboratório (sem `generation_events`, sem `AiCostTracker.record`, sem provider de imagem produtivo, sem SDK/wire, sem chaves de provider, sem `ai_model_selection`/`campaign_image_review`, sem escrita em catálogo/`prompts/`) e a guarda de ambiente. **Alternativa rejeitada:** `src/lib/bench/**` — exigiria um guard paralelo, ampliando a superfície a proteger.

### D3 — Contrato de branding local completo, sem alterar produção

Um loader dedicado lê, em **somente leitura** no Supabase local: `stores`, `store_brand_profiles` (`status='synced'`, com fallback `source='without_logo'`), `store_brand_assets` (`status='active'`) e `store_visual_signatures` (`status='active'`), produzindo um contrato que expõe **todos** os campos do branding, incluindo `typography_direction`. O loader **não** reutiliza nem altera `BrandProfileSnapshot`, `resolveStoreIdentity` ou `art-director-briefing`. **Alternativa rejeitada:** promover tipografia ao snapshot/mapper/prompt da campanha agora — muda o pipeline produtivo e é escopo natural da F48.2.3 ("branding como contrato obrigatório"). A lacuna de tipografia é **fechada no contrato da bancada**, não no pipeline.

**Signer local restrito para assets de branding (F48.2.2).** Logo/assinatura e demais assets do branding são servidos por um **signer local dedicado** (`createBenchBrandingSignedUrl`) que aceita **somente** os buckets locais `store-logos`, `store-brand-assets` e `visual-signatures`, com **allowlist estrita de bucket e path**, aplicado **somente após** a guarda de ambiente local (`assertLabEnvironment`). O cliente **nunca** informa bucket/path livremente: a API resolve o path a partir do registro persistido da loja selecionada (já validada pelo manifesto). O signer de artefatos do laboratório (`createArtifactSignedUrl`, bucket `lab-artifacts`, paths `experiments/...`) **não** é reutilizado para branding; `lab-artifacts` permanece **exclusivo** para entradas e resultados da bancada. Testes negativos obrigatórios: bucket produtivo, path traversal e loja fora do manifesto são recusados.

### D4 — Somente lojas de teste, via allowlist/manifesto local

A seleção lista **apenas lojas de teste da bancada**, identificadas por uma **allowlist/manifesto local** (ex.: `fixtures/lab/bench/stores.json`). Uma loja só é elegível se estiver no manifesto **e** existir no Supabase local; a leitura é somente leitura e não há sincronização remota. Isso evita depender de um campo produtivo novo apenas para a bancada. **Alternativas rejeitadas:** listar qualquer loja do Supabase local (ambíguo e sujeito a contaminar a bancada com lojas de produção) e adicionar um campo produtivo só para marcar lojas de teste.

**Asserção em toda entrada.** A elegibilidade (loja no manifesto **e** existente no Supabase local) é verificada por `assertBenchTestStore` em **todos** os pontos de entrada — leitura de branding (GET), estimativa e execução (POST) — **antes** de qualquer leitura de branding, tabela de loja ou storage. Um `storeId` local fora do manifesto enviado manualmente à API é recusado sem leitura.

### D5 — Imagens somente por upload; bucket local

Imagens de produto entram **apenas por upload** e são gravadas no bucket `lab-artifacts` sob `bench/{runId}/inputs/...`; a saída vai para `bench/{runId}/output.{ext}`. O bucket remoto `campaign-images` **não** é lido nem reutilizado. **Alternativa rejeitada:** reaproveitar imagens de campanhas reais com exceção read-only no detector — enfraqueceria o isolamento nesta fase (pode ser reavaliado depois).

### D6 — Configuração extensível por dimensões, registry validado em código

As dimensões `pipeline`, `formato`, `modelo`, `qualidade`, `intenção`, `tipo de conteúdo`, `estrutura`, `tema` são modeladas independentemente. O primeiro recorte habilitado é `manual-direto` / `1:1` / `oferta` / `produto` / `peça única` / `nenhum`. A configuração resolvida é persistida como `jsonb`, **sem CHECK por valor**, e validada por um registry em código que permite expansão futura (novos formatos/intenções/tipos/estruturas/temas/pipelines) sem migration. **Alternativa rejeitada:** enums/CHECK por dimensão — exigiria migration a cada preset.

### D7 — Presets de modelo/qualidade em registry de código, com spike bloqueante

Um registry puro define presets `{ id, label, capability, provider, model, protocol, quality, size }`, validados contra uma **allowlist própria da bancada** (`BENCH_MODEL_ALLOWLIST`, definida em código) — alimentada **somente** pelos modelos/qualidades **confirmados pelo spike** — e contra o catálogo ativo (`ai_model_catalog`) em modo leitura. O `MODEL_ALLOWLIST` e o registry produtivos **permanecem intocados**; um modelo confirmado pelo spike (ex.: `gpt-image-2.5-flare`) pode ser habilitado na bancada **sem alterar a allowlist de produção**. **Alternativa rejeitada:** exigir interseção com `MODEL_ALLOWLIST` — bloquearia um modelo confirmado que ainda não existe em produção. Candidatos: `gpt-image-2` low/medium e `gpt-image-2.5-flare` low/medium. **Nada é assumido**: um **spike bloqueante** confirma ID, protocolo/endpoints, edição com referências, qualidades, tamanho, limites, disponibilidade, estrutura de usage e pricing. Presets não confirmados ficam **desabilitados com motivo explícito**. O **primeiro recorte habilita apenas o caminho direto confirmado pelo spike**; o protocolo `responses` só entra se algum modelo exigir esse protocolo. **Alternativa rejeitada:** tabela de presets no banco — overkill para a fundação.

### D8 — Adapter/caminho `Images` dedicado à bancada

A bancada usa um **adapter `Images` dedicado** — novo arquivo em `src/lib/ai/adapters/**`, registrado **apenas** no adapter registry do runtime da bancada — que controla explicitamente modelo, qualidade, tamanho, prompt, referências e ordem/papel. O `ImagesAdapter` produtivo e o registry padrão de adapters **permanecem intocados** (o wire continua restrito a `src/lib/ai/adapters/**`). A composição do gateway usa um resolver que devolve **capability + alvo do preset**; no primeiro recorte, apenas o caminho direto confirmado pelo spike é habilitado (o protocolo `responses` só entra se algum modelo exigir). Invocação **single-shot**, sem fallback automático, sem consulta à seleção produtiva. **Alternativa rejeitada:** alterar o `ImagesAdapter` compartilhado para passar `quality` — toca o caminho produtivo e contraria a decisão aprovada.

### D9 — Persistência da geração

`lab_bench_runs`: `id`, `operation_id` (UNIQUE, idempotência), `status`, `created_by`, timestamps, `campaign_snapshot` (jsonb), `branding_snapshot` (jsonb, inclui tipografia), `config` (jsonb — dimensões resolvidas), `prompt_sent` (text), `references` (jsonb — paths locais), `provider`/`protocol`/`model`, `size`, `quality`, `intent`, `content_type`, `structure`, `theme`, `latency_ms`, `usage` (jsonb), `estimated_cost_usd`, `cost_detail` (jsonb), `cost_source`, `cost_rule_version`, `error_type`, `error_message` (sanitizado), `technical_validation` (jsonb). `lab_bench_artifacts`: `run_id`, `kind` (`input`/`output`), `storage_path`, `mime_type`, `width`, `height`, `bytes`, `checksum`, `removed_at`. Imutabilidade de snapshot/config por trigger; colunas de resultado atualizáveis; DELETE de runs sempre proibido.

### D10 — Estados, idempotência e recuperação

Estados: `draft → pending → running → succeeded | failed | cancelled | timeout`. O estado **`draft`** cobre a preparação e o upload de imagens e **não ocupa o slot global** (vários drafts podem coexistir). Índice único parcial **global** de geração ativa (`status IN ('pending','running')`) garante **uma geração ativa em toda a bancada**. A transição **`draft → pending`** é **compare-and-set** e **adquire o slot** atomicamente; a violação do índice parcial é mapeada como **409 `bench_run_already_active`** e **não** dispara chamada paga. **Drafts abandonados** (nunca confirmados) são reconciliados/removidos por reconciliação preguiçosa e **nunca bloqueiam** a bancada. Idempotência por `operation_id` (reenvio devolve o run existente, sem nova chamada paga). Recuperação de run preso por **reconciliação preguiçosa** na leitura (padrão `reconcileStaleRuns`), sem scheduler, marcando órfãos como `failed` (`bench_run_orphan_timeout`).

### D11 — Modelo de custo explícito

Três noções distintas e **nunca confundidas na UI**:

- **usage do provider** — quando retornado; permanece uma noção **separada** e nunca é substituído pelo cálculo local;
- **custo calculado** — resolvedor **local da bancada** sobre o usage + pricing **local** versionado, chaveado por `provider + model + protocol + quality + size` (`cost_source` + `cost_rule_version`);
- **custo estimado** — quando usage suficiente não existe, usando o mesmo resolvedor local por **modelo + qualidade + tamanho/protocolo**.

O `LabTelemetrySink` (read-only) acumula o custo sem gravar `generation_events`. Custo estimado **nunca** é apresentado como faturado.

### D12 — Segurança financeira leve

Estimativa antes da geração por um **resolvedor local da bancada** chaveado por `modelo + qualidade + tamanho/protocolo` (o helper produtivo `estimateLabCampaignImageCost`, que recebe apenas `provider`/`model`, **não** distingue `low` de `medium` e **não** é reutilizado para a estimativa da bancada), confirmação explícita (`confirmed: true`), uma geração ativa global e ambiente local-only. **Sem** programa de orçamento, reserva financeira ou créditos. **Alternativa rejeitada:** reusar `lab_prompt_programs` — escopo declarado fora desta fase.

### D13 — Erros, secrets e stream

Erros sanitizados **na origem** por `sanitizeAiErrorMessage` antes de persistir e de emitir no stream NDJSON (mesma mensagem segura para banco e cliente). Nenhuma chave/URL/segredo em banco, log, snapshot ou artefato. Exatamente um evento terminal (`done`/`error`) por stream.

### D14 — Paths de artefato da bancada

Novo esquema `bench/{runId}/{kind}/...` no bucket `lab-artifacts`, com guard de path próprio (anti-traversal, sem token de bucket de campanha). **Alternativa rejeitada:** reusar o path `experiments/...` — semântica incorreta. O signer de artefatos (`createArtifactSignedUrl`, bucket `lab-artifacts`) é **distinto** do signer de branding (D3); **nenhum** deles aceita bucket/path informado livremente pelo cliente.

### D15 — UI desktop mínima

Tela `/admin/laboratorio/bancada` com seleção de loja, branding completo, formulário mínimo produto/oferta, upload, editor de prompt, formato/modelo/qualidade, dimensões travadas no primeiro recorte, estimativa, confirmação, estado de execução, resultado, download e evidências. Segue `openspec/design-system/MASTER.md`; sem mobile; sem comparação/votação; estado de ambiente desabilitado claro.

### D16 — Estratégia de testes

- **Isolamento (negativo)**: prova de que nenhuma tabela/bucket remoto é acessado; `campaign-images`, `campaigns`, `generation_events`, `ai_model_selection`, `credit_*` fora de qualquer acesso; extensão **aditiva e estreita** da allowlist para leitura das tabelas de branding local.
- **Concorrência**: duas gerações simultâneas → exatamente uma ativa.
- **Catálogo/presets**: preset fora da allowlist/catálogo é recusado; preset não confirmado fica desabilitado com motivo; catálogo não é mutado.
- **Persistência/snapshots**: idempotência por `operation_id`; imutabilidade de snapshot/config; reconciliação de run preso; custo/usage/erro sanitizado.
- **API**: 403/400/409/422, confirmação obrigatória, uma geração ativa, hash/checksum de imagem, stream com um terminal.
- **UI**: estados, upload, estimativa/confirmação, evidências, download.
- **Gates**: typecheck, lint, build e suíte; nenhuma chamada paga em testes/CI.
- **UAT local**: Docker + chave de desenvolvimento, loja de teste, branding real e geração real controlada.

### D17 — DDL local-first, fora da cadeia de migrations remotas

O DDL da bancada (`lab_bench_runs`, `lab_bench_artifacts`, RLS/grants, triggers e o índice de geração ativa) **não** entra em `supabase/migrations/`. Ele vive em um local próprio do laboratório (ex.: `supabase/lab/bench-schema.sql` ou `scripts/lab/`), é aplicado por um **bootstrap local da bancada** e inclui bloco REVERT. Assim, um `supabase db push` geral **nunca** carrega as tabelas da bancada ao remoto — a opção "tabelas no schema remoto, inertes" foi rejeitada por não garantir a não contaminação. Adições de catálogo/pricing necessárias à validação local dos presets são aplicadas **também localmente** pelo bootstrap (o catálogo remoto é produtivo e não recebe as linhas da bancada); nenhuma promoção de modelo é feita nesta fase. **Aprovação:** esta escolha foi aprovada pelo alinhamento de não contaminar o remoto.

## Risks / Trade-offs

- **[Extensões do isolamento enfraquecem a fronteira]** → allowlist estrita e **somente leitura** para branding local; proibição explícita de `campaign-images`/lojas remotas; self-tests negativos provando que o detector dispara.
- **[Allowlist de buckets de branding amplia a fronteira de leitura]** → allowlist **somente leitura** e **local-only** para `store-logos`/`store-brand-assets`/`visual-signatures` via signer dedicado (D3), com testes negativos de bucket produtivo, traversal e loja fora do manifesto.
- **[`gpt-image-2.5-flare` inexistente]** → spike bloqueante antes de habilitar; preset desabilitado com motivo se não confirmado.
- **[Qualidade no caminho `images`]** → adapter `Images` **dedicado** da bancada; o `ImagesAdapter` produtivo e o registry padrão permanecem intocados, comprovado por regressão.
- **[Gasto real sem créditos]** → estimativa + confirmação + uma geração ativa + local-only; custo estimado nunca apresentado como faturado.
- **[Tipografia só exibida, não aplicada]** → decisão explícita: a injeção no prompt é F48.2.3; a bancada apenas carrega/registra.
- **[Duplicação de código do laboratório]** → reuso dos seams compartilhados (guards, sink, artefatos, validação, custo) e orquestração isolada própria; nada compartilhado que possa alterar produção.
- **[Vazamento de segredos]** → sanitização na origem; nenhum segredo em banco/log/snapshot/artefato.

## Migration Plan

1. DDL local da bancada (`lab_bench_runs`, `lab_bench_artifacts`, RLS/grants, triggers, índice de geração ativa) **fora de `supabase/migrations/`**, aplicado pelo bootstrap local + REVERT.
2. `npx supabase db reset` + `db lint`; aplicação do bootstrap da bancada; testes de contrato.
3. Adições de catálogo/pricing aplicadas **localmente** pelo bootstrap (somente se o spike confirmar).
4. Implementação e testes locais (fakes; sem chamadas pagas).
5. UAT local (Docker) com chave/projeto de desenvolvimento e geração real controlada.
6. **Sem `db push` remoto e sem promoção** — F48.2.3.

## Open Questions

- **Modelos/presets (único bloqueador)**: ID exato, protocolo/endpoints, suporte a edição com referências, qualidades, tamanho, limites de entrada, disponibilidade da conta, estrutura de usage e regra de pricing de `gpt-image-2` e `gpt-image-2.5-flare`. Tudo o mais está decidido (adapter dedicado; lojas de teste via manifesto local; bucket `lab-artifacts` com prefixo `bench/`; nomes `lab_bench_runs`/`lab_bench_artifacts` e capability `lab-generation-bench`).
