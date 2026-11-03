---
quick_id: 261102-qna
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
status: complete
gate_a_status: complete
gate_b_dry_run: complete
gate_b_pilot: complete
gate_b_local: complete
gate_b_production: complete_production
gate_b_homolog: pending
production_release_guard: complete_local
decisions_reviewed: 2026-11-02
approval_required: true
gate_a_authorized: 2026-11-02
implementation_authorized: true
backfill_authorized: false
publication_authorized: false
base_sha: 6447f3441a47be5ca2271245d3aab4e23a7ced9e
branch: perf/miniaturas-campanhas
files_modified:
  - src/lib/campaign/thumbnail/thumbnail-path.ts
  - src/lib/campaign/thumbnail/thumbnail-generator.ts
  - src/lib/campaign/thumbnail/thumbnail-safe.ts
  - src/lib/campaign/thumbnail/backfill-selection.ts
  - src/lib/campaign/thumbnail/backfill-runner.ts
  - src/lib/campaign/thumbnail/__tests__/thumbnail-path.test.ts
  - src/lib/campaign/thumbnail/__tests__/thumbnail-generator.test.ts
  - src/lib/campaign/thumbnail/__tests__/thumbnail-safely.test.ts
  - src/lib/campaign/thumbnail/__tests__/backfill-selection.test.ts
  - src/lib/campaign/thumbnail/__tests__/backfill-runner.test.ts
  - scripts/campaign-thumbnails/backfill.ts
  - src/lib/product-1-1/artifact/artifact-store.ts
  - src/lib/product-1-1/__tests__/artifact-store.contract.test.ts
  - src/app/api/campaign/generate-image/route.ts
  - src/app/api/campaign/generate-image/__tests__/route.test.ts
  - src/app/api/campaign/generate-image/__tests__/route.integration.test.ts
  - src/__tests__/api/campaign-generate.test.ts
  - src/__tests__/regression-master-switch.test.ts
  - src/__tests__/concurrency.test.ts
  - src/lib/campaign/correction-reports.ts
  - src/__tests__/lib/campaign/correction-v2-persistence.test.ts
  - src/__tests__/lib/campaign/correction-thumbnail-isolation.test.ts
requirements: [REQ-qna-01, REQ-qna-02, REQ-qna-03, REQ-qna-04, REQ-qna-05, REQ-qna-06, REQ-qna-07]
must_haves:
  truths:
    - "Toda arte final elegível persistida pelos fluxos legado, novo e correção v2 ganha uma miniatura WebP persistida no bucket privado campaign-images, derivada exatamente do arquivo original selecionado."
    - "O original nunca é sobrescrito, movido, reprocessado ou apagado; a miniatura é um objeto adicional em caminho determinístico com versão da receita."
    - "Falha de geração, validação ou upload da miniatura nunca reprova a campanha, nunca altera créditos, status comercial, entrega, recuperação ou verificações de integridade."
    - "Upload repetido ou concorrente da mesma miniatura é idempotente (upsert:false; conflito = já existe = sucesso) e nunca sobrescreve bytes existentes."
    - "A geração síncrona tem orçamento de tempo: o upload é abortado por AbortSignal a 2 s e, ao exceder, retorna failed sem alterar a campanha; não há tarefa solta nem retry no request. Abortar não prova ausência: o reparo confere existência e trata conflito como already_exists."
    - "O uploader da miniatura e o client do original estão vinculados ao mesmo endpoint; client customizado sem contexto compatível desabilita a miniatura com diagnóstico e nunca recorre silenciosamente às credenciais do ambiente."
    - "O preenchimento do legado é opt-in, dry-run por padrão, usa somente storage_paths canônicos de campanhas, exclui /inputs/ e artefatos sem vínculo, respeita lote/concorrência e retoma de forma idempotente; guardas de endpoint exato impedem chamadas antes de qualquer escrita."
    - "Nenhum consumidor (dashboard, listagem, detalhe, download) muda nesta quick; a troca fica contratada para a segunda quick."
  artifacts:
    - path: "src/lib/campaign/thumbnail/thumbnail-path.ts"
      provides: "Contrato puro do caminho determinístico, versão da receita, dimensões, formato e allowlist de paths elegíveis"
      exports: ["THUMBNAIL_RECIPE_VERSION", "THUMBNAIL_MAX_EDGE_PX", "THUMBNAIL_QUALITY", "THUMBNAIL_CONTENT_TYPE", "THUMBNAIL_BUCKET", "THUMBNAIL_UPLOAD_TIMEOUT_MS", "deriveThumbnailPath", "isEligibleCampaignArtPath", "isThumbnailPath"]
    - path: "src/lib/campaign/thumbnail/thumbnail-generator.ts"
      provides: "Render WebP com sharp + upload imutável idempotente com timeout abortável, sem lançar e sem escrever em banco"
      exports: ["generateCampaignThumbnail", "createTimedSupabaseUploader", "createDefaultThumbnailContext", "normalizeEndpoint", "renderThumbnail"]
    - path: "src/lib/campaign/thumbnail/thumbnail-safe.ts"
      provides: "Wrapper de defesa em profundidade usado pelos call sites; nunca lança"
      exports: ["generateCampaignThumbnailSafely"]
    - path: "src/lib/campaign/thumbnail/backfill-selection.ts"
      provides: "Regras puras de elegibilidade, classificação de resultado e agregação de relatório do preenchimento"
      exports: ["classifyBackfillOutcome", "isEligibleInventoryPath", "buildBackfillReport"]
    - path: "src/lib/campaign/thumbnail/backfill-runner.ts"
      provides: "Runner testável com dependências injetadas: guardas, dry-run sem escrita, limites, concorrência, cursor e retomada"
      exports: ["runBackfill"]
    - path: "scripts/campaign-thumbnails/backfill.ts"
      provides: "CLI de reparo versionada: dry-run padrão, guarda de ambiente, filtros, lotes, concorrência e relatório JSON"
    - path: "src/lib/product-1-1/artifact/artifact-store.ts"
      provides: "Geração da miniatura após upload+metadados do artefato do novo fluxo, isolada de falha"
      contains: "generateCampaignThumbnail"
    - path: "src/app/api/campaign/generate-image/route.ts"
      provides: "Geração da miniatura do fluxo legado após updateCampaignReady, reaproveitando o buffer JPEG já disponível"
      contains: "generateCampaignThumbnail"
    - path: "src/lib/campaign/correction-reports.ts"
      provides: "Geração da miniatura da v2 após a RPC atômica de conclusão, isolada de falha"
      contains: "generateCampaignThumbnail"
  key_links:
    - from: "src/lib/product-1-1/artifact/artifact-store.ts"
      to: "src/lib/campaign/thumbnail/thumbnail-generator.ts"
      via: "chamada após insert em product_1_1_campaign_artifacts"
      pattern: "generateCampaignThumbnail"
    - from: "src/app/api/campaign/generate-image/route.ts"
      to: "src/lib/campaign/thumbnail/thumbnail-generator.ts"
      via: "chamada após updateCampaignReady com jpegImage.buffer"
      pattern: "generateCampaignThumbnail"
    - from: "src/lib/campaign/correction-reports.ts"
      to: "src/lib/campaign/thumbnail/thumbnail-generator.ts"
      via: "chamada após complete_campaign_correction_v2"
      pattern: "generateCampaignThumbnail"
    - from: "scripts/campaign-thumbnails/backfill.ts"
      to: "src/lib/campaign/thumbnail/thumbnail-generator.ts"
      via: "download do original canônico + geração com client explícito"
      pattern: "generateCampaignThumbnail"
user_setup: []
---

# Geração e persistência de miniaturas de campanhas

**Objetivo:** persistir **uma** miniatura WebP por arte final imutável de campanha — no bucket privado `campaign-images`, em caminho determinístico versionado — para que uma segunda quick troque os consumidores de dashboard/listagem sem alterar contratos de geração, aprovação, entrega, recuperação ou cobrança.

**Status desta rodada:** **PLANEJAMENTO SOMENTE**. Nenhum código, commit, merge, push, deploy, migration, escrita em banco ou Storage, nem alteração de configuração.

**Base verificada (2026-11-02):** `HEAD = main = origin/main = 6447f3441a47be5ca2271245d3aab4e23a7ced9e`, branch `perf/miniaturas-campanhas` no mesmo commit, worktree limpo, nenhum worktree adicional aberto, F58 integrada e encerrada localmente (publicação não autorizada). A frente de fontes (`perf/fontes-locais`) não é reutilizada nem alterada.

## 1. Escopo e limites

**Dentro desta quick**
1. Módulo de contrato do caminho/recipe da miniatura.
2. Gerador com sharp + upload imutável e idempotente, sem lançar.
3. Integração nos três caminhos reais de persistência da arte final.
4. Script de preenchimento do legado, dry-run por padrão e guardas de ambiente.
5. Testes focados, evidência e gates locais.

**Fora desta quick (proibido)**
- Trocar URLs, `src`, `srcSet` ou componentes de dashboard/listagem/detalhe.
- Alterar layout, `next/image`, cache/CDN, visualização ou download do original.
- Migration, coluna, tabela, bucket, policy, API, fila, cron, dependência ou feature flag.
- Gerar miniatura com IA, regenerar arte, alterar créditos, status, aprovação, recuperação ou projeção de campanha.
- Escrever em homolog/produção; executar backfill com escrita.
- Commit, merge, push, deploy, tag ou alteração de configuração.

**Confirmação de escopo:** cabe em uma quick no limite superior (3 tarefas, ~22 arquivos, a maioria testes; sem migration e sem infraestrutura nova). Se a implementação exigir migration, fila durável, nova coluna de status de miniatura ou mudança transversal dos contratos de entrega, **parar e reavaliar** antes de codar.

## 2. Contrato proposto da miniatura (para a segunda quick)

### 2.1 Caminho determinístico

Derivação **pura** a partir do caminho do original efetivamente persistido, trocando somente a extensão por sufixo versionado:

```
original:  <dir>/<nome>.<ext>
miniatura: <dir>/<nome>.thumb-v1.webp
```

Shapes canônicos aceitos (allowlist fechada):

| Fluxo | Original | Miniatura |
|---|---|---|
| Legado | `{storeId}/{campaignId}.jpg` | `{storeId}/{campaignId}.thumb-v1.webp` |
| Correção v2/v3 (histórico) | `{storeId}/{campaignId}/v2.jpg` ou `v3.jpg` | `{storeId}/{campaignId}/v2.thumb-v1.webp` ou `v3.thumb-v1.webp` |
| Novo fluxo 1:1 | `{storeId}/{campaignId}/product-1-1/{operationId}/art-1024.jpg` | `.../art-1024.thumb-v1.webp` |

**Descoberta do contrato histórico (2026-11-03):** o schema permite `version_number` 1..3 e o RPC histórico `complete_campaign_regeneration` aceita v2/v3; produção tem **1** campanha com `v3.jpg` aprovada/ativa e referenciada por `campaigns.storage_path`. Por isso a allowlist aceita estritamente **v2.jpg e v3.jpg**, derivando `v3.thumb-v1.webp` pelo mesmo contrato central. `v1.jpg`, `v4.jpg`, versões arbitrárias e formas malformadas permanecem inelegíveis.

Qualquer outro path é **inelegível** (`skipped_ineligible`): `/inputs/`, logos, assinaturas, `bench/`, laboratório, arquivos de outro bucket, paths sem vínculo canônico e o próprio path de miniatura. A allowlist reutiliza `NEW_FLOW_ARTIFACT_PATH_RE` e adiciona regexes fechadas para legado e versões v2/v3.

### 2.2 Formato, dimensões e recipe

| Parâmetro | Valor proposto |
|---|---|
| Formato | WebP (`image/webp`), uma única variante |
| Maior aresta | **288 px** (`fit: "inside"`) |
| Proporção | Preservada; sem crop novo |
| Ampliação | Proibida (`withoutEnlargement: true`) |
| Qualidade | 78, `effort: 4`, `smartSubsample: true` |
| Metadados | Removidos (default do sharp) |
| Orientação | `.rotate()` antes do resize |
| Limite de entrada | `limitInputPixels: 40_000_000`, `failOn: "error"` |
| Versão da recipe | `1`, embutida no sufixo `.thumb-v1.webp` |
| Orçamento do upload | `THUMBNAIL_UPLOAD_TIMEOUT_MS = 2000`, abortável por `AbortSignal` no `fetch` |
| Excesso de tempo | `failed` / `thumbnail_upload_timeout`; sem retry no request; campanha intocada |

**Justificativa de 288 px:** as caixas atuais medem 80 px (mobile) e 96 px (desktop) — `available-campaign-card.tsx:47` — e a densidade 3× pede até 288 px. É o limite superior da faixa solicitada, cobre DPR 3 sem ampliar. O peso estimado (~8–20 KB por arte 1:1) é **estimativa não medida** e será medido no Gate A. Trocar a recipe exige `v2` e novo caminho, sem sobrescrever.

**Orçamento de tempo (limite, não promessa de desempenho):** o upload terá timeout de 2 s aplicado por `AbortSignal.timeout` no `fetch` do client dedicado de miniaturas; ao exceder, a requisição é abortada, a promise é aguardada e o resultado é `failed` (`thumbnail_upload_timeout`). Como `@supabase/storage-js@2.110.0` não expõe `signal` em `FileOptions.upload`, o cancelamento é aplicado no `global.fetch` do client dedicado — aborto HTTP real, sem reimplementar a API do Storage. Não existe tarefa solta: o sinal aborta o `fetch` e o gerador retorna depois que a promise de upload assentar. O render do sharp **não é abortável** (libvips), por isso é limitado por `limitInputPixels` e por uma única decodificação; ele ocorre antes do upload, então um eventual estouro de tempo de render não deixa objeto parcial. A estimativa “50–200 ms” da versão anterior **não foi medida** e não é garantia.

### 2.3 Privacidade e autorização

- Bucket existente **privado** `campaign-images`; mesma RLS/policies do original.
- Nenhum bucket público, policy ou signed URL é criado nesta quick.
- Consumers futuros assinam o **caminho da miniatura** com TTL de 3600 s, como já fazem com o original (`list.ts:185-193`); nunca expõem path bruto.
- A miniatura não contém dados além dos pixels da arte final.

### 2.4 Ausência e idempotência

- **Contrato para a segunda quick:** miniatura ausente ⇒ **placeholder** (o fallback atual do card, `ImageOff`) e abertura da campanha preservada. **Não** há fallback permanente ao original, justamente para eliminar downloads grandes. Eventual fallback temporário ao original exigiria decisão explícita e prazo; não é contrato.
- Reparo de miniatura ausente é feito pelo script desta quick (reexecução idempotente), não pelo consumer.
- Upload `upsert: false`; conflito/409/“already exists”/“duplicate” ⇒ `already_exists` (sucesso idempotente).
- Geração concorrente: o primeiro upload vence e o segundo é `already_exists`; a garantia é do `upsert:false`, **não** de bytes idênticos entre builds do sharp. Nenhuma sobrescrita.
- O original nunca é reprocessado, movido ou removido para criar a derivada.
- **Timeout não prova ausência:** abortar o HTTP não garante que o Storage não persistiu o objeto. Após `thumbnail_upload_timeout`, o reparo (nova execução do script) **conferem existência primeiro**; se o objeto existir, o resultado é `already_exists`, sem sobrescrita. Isso é testado.

### 2.5 Vínculo de ambiente (original × miniatura)

O client que grava o original e o uploader da miniatura **devem apontar para o mesmo endpoint**. Para tornar isso estrutural e não dependente de sorte:

```ts
interface ThumbnailUploader { readonly endpoint: string; upload(...): Promise<{ error }> }
interface ThumbnailContext  { readonly endpoint: string; readonly uploader: ThumbnailUploader }
```

- Ambos os endpoints são normalizados por `new URL(...).origin` (protocolo + host + porta).
- `context` ausente **ou** `context.endpoint !== uploader.endpoint` ⇒ `skipped` (`thumbnail_disabled_no_context` / `thumbnail_endpoint_mismatch`), **zero upload** e warn sanitizado.
- `ProductOneToOneArtifactStore` só usa o contexto padrão quando o client é o `supabaseAdmin` (mesmo ambiente por construção). Com client injetado/customizado:
  - contexto compatível explícito ⇒ miniatura habilitada;
  - contexto ausente/incompatível ⇒ miniatura **desabilitada com diagnóstico**, sem ler credenciais do ambiente e sem qualquer chamada de rede para outra origem.
- O contexto padrão lê `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` **lazy**, apenas quando chamado; nunca no import. Se ausente ⇒ `null` e miniatura desabilitada, sem exceção.
- Testes locais usam fake client + fake context/uploader; nenhum teste unitário constrói o contexto padrão nem toca Storage real. Teste com duas origens distintas comprova zero chamadas à origem errada.

## 3. Pontos de integração reais

### 3.1 Fluxo novo (Product 1:1)

- `src/lib/product-1-1/artifact/artifact-store.ts`
  - `storeArtifact` (linhas 174–248) já tem o JPEG final em memória (`jpeg.buffer`) e sobe o original com `upsert:false`.
  - Ponto de inserção: **depois** do upload (214–219) **e** do insert em `product_1_1_campaign_artifacts` (232–245), **antes** do `return ref` (247).
  - Chamada: `generateCampaignThumbnailSafely({ originalPath: storagePath, originalBuffer: jpeg.buffer, context: this.thumbnailContext })`.
  - Construtor: `new ProductOneToOneArtifactStore(client = supabaseAdmin, thumbnailContext = client === supabaseAdmin ? createDefaultThumbnailContext() : null)`. Com client customizado e sem contexto explícito, `thumbnailContext = null` ⇒ miniatura desabilitada com diagnóstico; **nunca** cai no ambiente silenciosamente.
  - Testes de contrato passam `client` fake + `ThumbnailContext` fake com endpoints iguais; o teste “client customizado sem contexto” comprova 1 upload (somente original) e nenhuma leitura de env/rede.
  - Se o insert de metadados falhar, o fluxo atual lança e o orquestrador mantém `result_unknown`; a miniatura não é criada e pode ser reparada depois. Nada muda nesse contrato.
- A projeção `projectCampaign` continua repontando `campaigns.storage_path` para o artefato; a miniatura acompanha o path do artefato.

### 3.2 Fluxo legado

- `src/app/api/campaign/generate-image/route.ts`
  - `jpegImage` é produzido em 1565–1567 e enviado em 1567; `storagePath` é canônico (`{storeId}/{campaignId}.jpg`).
  - Ponto de inserção: **depois** de `updateCampaignReady` (1597–1601), reaproveitando `jpegImage.buffer`.
  - Motivo de não inserir em `uploadCampaignImage`: o `catch` do route (1652–1659) apaga o original se `updateCampaignReady` falhar; gerar antes disso criaria órfão. Gerando depois, o caminho de falha comercial continua sem derivada.
  - Os eventos/credits seguintes já são individualmente tolerantes a falha; a chamada da miniatura também será.

### 3.3 Correção / substituição de arte (v2)

- `src/lib/campaign/correction-reports.ts`
  - Upload da v2 em 664–674; RPC atômica `complete_campaign_correction_v2` em 699–713; `jpeg.buffer` permanece no escopo.
  - Ponto de inserção: **depois** do sucesso da RPC, antes do `return { success: true, ... }` (718).
  - Se a RPC falhar, o `catch` (719–729) apaga a v2 e não há miniatura — sem órfão.
  - A v2 criada a partir de agora já nasce com miniatura, mesmo antes de aprovação; aprovar reponta `campaigns.storage_path` para a v2 e a derivada já existe.

### 3.4 Consumidores (não alterados)

- `src/lib/campaign/list.ts:173-201` continua assinando o original.
- `src/app/(app)/campanhas/client.tsx:254-256` e `src/components/dashboard/available-campaign-card.tsx:47-55` continuam iguais.
- A segunda quick decidirá assinatura da miniatura, fallback e medição.

## 4. Tarefas

### Task 1 — Contrato puro + gerador idempotente e à prova de falha

**Files**
- `src/lib/campaign/thumbnail/thumbnail-path.ts` (novo)
- `src/lib/campaign/thumbnail/thumbnail-generator.ts` (novo)
- `src/lib/campaign/thumbnail/thumbnail-safe.ts` (novo)
- `src/lib/campaign/thumbnail/__tests__/thumbnail-path.test.ts` (novo)
- `src/lib/campaign/thumbnail/__tests__/thumbnail-generator.test.ts` (novo)
- `src/lib/campaign/thumbnail/__tests__/thumbnail-safely.test.ts` (novo)

**Action**
1. `thumbnail-path.ts` (puro, sem `server-only`, sem sharp, sem Supabase):
   - constantes `THUMBNAIL_RECIPE_VERSION = 1`, `THUMBNAIL_MAX_EDGE_PX = 288`, `THUMBNAIL_QUALITY = 78`, `THUMBNAIL_CONTENT_TYPE = "image/webp"`, `THUMBNAIL_BUCKET = "campaign-images"`;
   - regexes fechadas dos três shapes canônicos; `isEligibleCampaignArtPath(path)`; `isThumbnailPath(path)`;
   - `deriveThumbnailPath(originalPath)`: valida elegibilidade, remove a extensão (`jpg`/`jpeg`) e acrescenta `.thumb-v<version>.webp`; retorna `null` para inelegível (sem lançar no caminho de produção).
2. `thumbnail-generator.ts` (server utils, **sem** `server-only` para ser reutilizável pelo script):
   - `renderThumbnail(buffer)` com a recipe da §2.2; valida por metadados que o resultado é `webp`, tem maior aresta ≤ 288 e não ampliou a fonte;
   - `inspectOriginalImage(buffer)`: inspeção **somente leitura** (sharp metadata + decode completo com saída 1×1), usada pelo dry-run do backfill; retorna `null` para conteúdo vazio/arbitrário/truncado/formato não suportado, sem gerar/upload;
   - tipos `ThumbnailUploader` (com `endpoint` readonly) e `ThumbnailContext` (endpoint + uploader), mais `normalizeEndpoint(origin)` puro;
   - `createTimedSupabaseUploader({ timeoutMs = THUMBNAIL_UPLOAD_TIMEOUT_MS, url?, key?, fetchImpl? })`: cria **lazy** um client Supabase dedicado cujo `global.fetch` injeta `AbortSignal.timeout(timeoutMs)`; `url`/`key` default vêm do ambiente e são lidos somente na chamada (nunca no import); `endpoint` = origem normalizada. **Sem opção de `client` injetado** — todo upload passa obrigatoriamente pelo fetch abortável. A promise é aguardada e o aborto encerra o `fetch` — sem tarefa solta. Exportado para o script;
   - `createDefaultThumbnailContext()`: **lazy**; usa `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; retorna `null` se ausentes. Nunca é chamado por client customizado;
   - `generateCampaignThumbnail({ originalPath, originalBuffer, context })` → `Promise<ThumbnailResult>` **nunca lança**; estados `created | already_exists | skipped | failed`. `context` nulo ⇒ `skipped` (`thumbnail_disabled_no_context`); endpoints divergentes ⇒ `skipped` (`thumbnail_endpoint_mismatch`); em ambos, **zero upload**;
   - upload no bucket privado com `contentType: "image/webp"`, `upsert: false`;
   - conflito/409/“already exists”/“duplicate” ⇒ `already_exists`; aborto/timeout ⇒ `failed` (`thumbnail_upload_timeout`), sem retry no request;
   - inelegível ⇒ `skipped` (`ineligible_path`); sharp/validação ⇒ `failed` (`thumbnail_generation_failed`/`thumbnail_invalid_output`); upload ⇒ `failed` (`thumbnail_upload_failed`);
   - nenhuma escrita em tabela, nenhuma chamada de crédito/status/IA, nenhum `setTimeout` flutuante/tarefa solta;
   - `thumbnail-safe.ts` (`generateCampaignThumbnailSafely`): envolve o gerador em `try/catch` local, registra `console.warn` sanitizado (`campaignId`, path, código — nunca bytes/segredos) e **não deixa exceção escapar**, mesmo se o gerador regredir e lançar. Também registra falhas esperadas (`failed`, ex. timeout) e desabilitações inesperadas (`skipped` ≠ `ineligible_path`), sem lançar nem afetar a campanha. É o único ponto usado pelos call sites de produção (módulo separado para permitir teste real com o gerador mockado).
3. Testes:
   - derivação dos 3 shapes, versão no nome, unicidade por original;
   - rejeição de `/inputs/`, logo, assinatura, `bench/`, path arbitrário, path de miniatura, store divergente;
   - geração real com sharp: WebP, 1:1 → 288×288, não quadrada preserva proporção, fonte 200 px não amplia, metadados removidos;
   - upload só no path derivado, `upsert:false`, original intocado;
   - duplicado ⇒ `already_exists`; erro de upload/entrada inválida ⇒ `failed` sem throw;
   - uploader fake só recebe o path derivado e nunca acessa tabelas;
   - **vínculo de ambiente:** `ThumbnailContext.endpoint = http://127.0.0.1:54321` com uploader `endpoint = http://127.0.0.1:54322` ⇒ `skipped thumbnail_endpoint_mismatch`, uploader com **zero** chamadas; `context = null` ⇒ `skipped thumbnail_disabled_no_context`, zero chamadas e nenhuma leitura de env (spy);
   - **cancelamento real:** `createTimedSupabaseUploader({ timeoutMs: 25, url: "http://127.0.0.1:54321", key: "test", fetchImpl: stalledFetch })` onde `stalledFetch` só rejeita ao receber `abort` ⇒ rejeita com `TimeoutError`/`AbortError` e o gerador devolve `failed` (`thumbnail_upload_timeout`) sem lançar e sem deixar promise pendente;
   - `generateCampaignThumbnailSafely` com `generateCampaignThumbnail` mockado para **lançar** ⇒ resolve sem exceção e registra warn sanitizado (prova de isolamento);
   - `createDefaultThumbnailContext` é lazy: importar o módulo sem env não lança; só a chamada tenta ler env;
   - `inspectOriginalImage` reconhece JPEG/PNG/WebP por header e rejeita bytes arbitrários/vazios sem lançar;
   - o uploader com timeout não aceita `client` injetado (sem caminho que contorne o abort).

**Verify**
- `npm.cmd test -- src/lib/campaign/thumbnail/__tests__/thumbnail-path.test.ts src/lib/campaign/thumbnail/__tests__/thumbnail-generator.test.ts src/lib/campaign/thumbnail/__tests__/thumbnail-safely.test.ts`
- `npm.cmd run typecheck`
- Prova de bytes: medir dimensões/peso da derivada e hash do original antes/depois no teste; registrar a medição (não usar a estimativa como garantia).

**Done**
- Contrato e gerador implementados, timeout/cancelamento comprovados, testes verdes, nenhuma dependência/bucket/coluna nova.

### Task 2 — Integração nos três caminhos de persistência

**Files**
- `src/lib/product-1-1/artifact/artifact-store.ts`
- `src/lib/product-1-1/__tests__/artifact-store.contract.test.ts`
- `src/app/api/campaign/generate-image/route.ts`
- `src/app/api/campaign/generate-image/__tests__/route.test.ts`
- `src/app/api/campaign/generate-image/__tests__/route.integration.test.ts`
- `src/__tests__/api/campaign-generate.test.ts`
- `src/__tests__/regression-master-switch.test.ts`
- `src/__tests__/concurrency.test.ts`
- `src/lib/campaign/correction-reports.ts`
- `src/__tests__/lib/campaign/correction-v2-persistence.test.ts`
- `src/__tests__/lib/campaign/correction-thumbnail-isolation.test.ts`

**Action**
1. Novo fluxo: adicionar ao `ProductOneToOneArtifactStore` um `thumbnailContext` opcional com a regra de vínculo da §2.5: default somente quando `client === supabaseAdmin`; client injetado sem contexto ⇒ `null` (desabilitado com diagnóstico, sem env). Chamar `generateCampaignThumbnailSafely({ originalPath: storagePath, originalBuffer: jpeg.buffer, context: this.thumbnailContext })` no ponto da §3.1. O wrapper é `try/catch` local e não deixa exceção escapar; falha só registra `console.warn` sanitizado. Nenhum `delete`/`update`/crédito é disparado pela miniatura.
2. Legado: chamar em `route.ts` após `updateCampaignReady`, com `const originalPath = storagePath!;` (guard explícito para satisfazer o typecheck de `string | undefined`) e `jpegImage.buffer`, usando `generateCampaignThumbnailSafely` (uploader default com timeout). **Isolamento local obrigatório:** um throw da miniatura não pode cair no `catch` externo (1652–1659), que apaga o original e estorna crédito. Edição **puramente aditiva**: nenhuma linha existente do route pode ser removida/alterada (contrato do `legacy-frontier.guard`). Não alterar `uploadCampaignImage`, `deleteCampaignImage`, ordem de créditos, refund ou eventos.
3. Correção: chamar em `correction-reports.ts` após a RPC de conclusão, com `storagePath` e `jpeg.buffer`, via `generateCampaignThumbnailSafely` (uploader default com timeout). **Isolamento local obrigatório:** um throw da miniatura não pode cair no `catch` (719–729), que chama `failCorrectionV2` e apaga a v2 recém-persistida. Não alterar a RPC, `failCorrectionV2`, cleanup ou contrato de retorno.
4. Atualizar testes existentes que contam uploads:
   - `artifact-store.contract.test.ts`: passa fake context com endpoint igual ao uploader fake; `uploads` passa de 1 para 2; original primeiro (path original, `image/jpeg`), miniatura depois (path `.thumb-v1.webp`, `image/webp`) e insert de metadados continua 1; adicionar caso “upload da miniatura falha ⇒ `storeArtifact` resolve e ref é retornada”; adicionar caso **“client customizado sem contexto ⇒ 1 upload, diagnóstico, zero leitura de env/rede”** e caso **“contexto de origem divergente ⇒ nenhuma chamada ao uploader”**.
   - `route.test.ts` e `route.integration.test.ts`: mockar `@/lib/campaign/thumbnail/thumbnail-generator`; acrescentar asserção de chamada única com `storagePath` e buffer do JPEG; garantir que caminhos de erro não chamam.
   - **`campaign-generate.test.ts`** (também exercita o route legado com persistence mockada): mockar o gerador e acrescentar asserção de chamada única com o path canônico e buffer JPEG; garantir que caminhos de erro não chamam. Sem esse mock, o teste passaria a executar sharp real e o upload real/mockado de forma não determinística.
   - **`regression-master-switch.test.ts` e `concurrency.test.ts`** (também executam o route legado com mock parcial de `@/lib/supabase/server`): mockar `@/lib/campaign/thumbnail/thumbnail-generator` e/ou afirmar explicitamente o fallback seguro, para não depender de sharp real sobre bytes fake.
   - **Teste de injeção de throw — legado:** com o gerador mockado para lançar, o route continua respondendo sucesso, `deleteCampaignImage`/refund **não** são chamados e `updateCampaignReady` permanece efetivo.
   - **Teste de injeção de throw — novo fluxo:** `storeArtifact` resolve e o insert de metadados permanece.
   - **Teste comportamental da correção v2 (`correction-thumbnail-isolation.test.ts`):** mockar provider/imagem, upload e RPC de conclusão; mockar `generateCampaignThumbnailSafely` para **lançar**; chamar `generateCorrectionV2` e comprovar: retorno `success: true`, RPC `fail_campaign_correction_v2` **não** chamada, `storage.remove` da v2 **não** chamado, `complete_campaign_correction_v2` chamada uma vez. Este teste substitui a asserção apenas estática.
   - `correction-v2-persistence.test.ts`: manter asserções F37.2; ordem (`complete_campaign_correction_v2` antes da miniatura) pode ser verificada como complemento, não como prova principal.
5. Não alterar nenhum consumidor, schema, RPC, migration ou componente de UI.

**Verify**
- `npm.cmd test -- src/lib/product-1-1/__tests__/artifact-store.contract.test.ts src/app/api/campaign/generate-image/__tests__/route.test.ts src/__tests__/lib/campaign/correction-v2-persistence.test.ts src/__tests__/lib/campaign/correction-thumbnail-isolation.test.ts`
- `npm.cmd test -- src/__tests__/api/campaign-generate.test.ts src/__tests__/api/campaign-download.test.ts src/__tests__/lib/campaign/persistence.test.ts src/__tests__/lib/campaign/list.test.ts src/__tests__/lib/campaign/display.test.ts src/__tests__/regression-master-switch.test.ts src/__tests__/concurrency.test.ts`
- `npm.cmd test -- src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` (contrato de fronteira: route legado sem remoções)
- `npm.cmd run typecheck`
- Grep de invariantes: nenhum consumidor novo de miniatura; nenhuma alteração em `approve_campaign_candidate`, `complete_campaign_correction_v2`, crédito ou status.
- `route.integration.test.ts` é atualizado para mockar o gerador, mas **não é executado** nesta quick (depende de ambiente/roteiro de integração); registrar como não executado.

**Done**
- Miniatura gerada nos 3 caminhos após sucesso da persistência original; falha isolada; contratos F37.2/F56/F58 preservados.

### Task 3 — Preenchimento controlado do legado + evidência

**Files**
- `src/lib/campaign/thumbnail/backfill-selection.ts` (novo)
- `src/lib/campaign/thumbnail/backfill-runner.ts` (novo)
- `src/lib/campaign/thumbnail/__tests__/backfill-selection.test.ts` (novo)
- `src/lib/campaign/thumbnail/__tests__/backfill-runner.test.ts` (novo)
- `scripts/campaign-thumbnails/backfill.ts` (novo)

**Action**
1. `backfill-selection.ts` (puro):
   - `isEligibleInventoryPath(path, storeId)` → allowlist da §2.1 + prefixo `${storeId}/` obrigatório + rejeição explícita de `/inputs/`, `/logo`, `signature`, `bench/`, `lab/`;
   - `classifyBackfillOutcome(...)` → `would_create | created | already_exists | missing_original | access_error | invalid_format | ineligible | failed` (dry-run usa `would_create`);
   - `buildBackfillReport(...)` → contadores + itens sem URL assinada/bytes/segredos.
2. `backfill-runner.ts` (lógica executável, **sem** `server-only`, dependências injetadas para teste real):
   - `runBackfill({ deps, options })` com `deps` mínimos: `listCampaignsPage`, `downloadOriginal`, `thumbnailExists`, `generate`, `now`, `log`;
   - aplica **guarda antes de qualquer chamada de deps**; se inválida, retorna `blocked` com zero chamadas (comprovado por teste);
   - dry-run: `thumbnailExists` + `downloadOriginal` somente leitura, classifica `would_create/missing_original/access_error/invalid_format/ineligible/already_exists`; **nunca** chama `generate`/upload;
   - write: skip-existing, baixa o original e chama o gerador com `ThumbnailContext` cujo endpoint é o **mesmo** do client/`--expected-url`; falha de item não aborta o lote;
   - **timeout não prova ausência:** se o gerador retornar `thumbnail_upload_timeout`, o runner apenas registra a falha; a **próxima execução** consulta `thumbnailExists` primeiro e, se o objeto tiver sido persistido, classifica `already_exists` sem sobrescrever;
   - respeita `limit`, `batchSize`, `concurrency` (pool com máximo observável), cursor `after` **keyset opaco** e ordenação `created_at,id`;
   - relatório com contadores/itens/cursor; retomada idempotente demonstrada por teste (segunda execução só processa pendentes); lote final parcial emite `null`, nunca UUID solto;
   - **precisão integral:** `created_at` é repassado como texto do PostgreSQL (até 6 casas) em encode/decode/filtro, sem `Date`/`toISOString`.
3. `scripts/campaign-thumbnails/backfill.ts` (tsx, fino, versionado, reutilizável):
   - monta `deps` a partir do Supabase client **lazy** (após parse/config) e delega ao runner;
   - **inventário canônico:** keyset em `campaigns` (`id, store_id, storage_path, status, created_at`) com `storage_path IS NOT NULL` e `status='ready'`; **nunca** varre o bucket; default somente `campaigns.storage_path` (sem `campaign_art_versions`);
   - **filtros:** `--store`, `--campaign`, `--limit` (50), `--batch-size` (25), `--concurrency` (2, máx. 4), `--after <createdAt EXATO>|<campaignId>` (cursor keyset opaco; offset/UUID solto/formato inválido rejeitados; timestamp validado estritamente antes do filtro), `--report`, `--env local|homolog|production`, `--expected-url <origem exata>`, `--dry-run` (default)/`--write`, `--confirm-env <env>`, `--verbose`;
   - **dry-run por padrão**, sem geração/upload;
   - **configuração/env:** `readDotEnv`/`parseDotEnv` de `scripts/testing/test-status.mjs` ou `--env-file`, nunca no topo; `process.env` tem precedência; `--help`/`--version` sem env/rede (exit 0); config ausente ⇒ exit 3;
   - **identificação de ambiente (endpoint completo):** comparar `new URL(actual).origin` **exatamente** com `--expected-url` (protocolo + host + porta; sem path/query). `--env local` exige adicionalmente host loopback. Origem divergente ⇒ exit 2 sem nenhuma chamada. `homolog`/`production` continuam **hard-blocked** nesta quick; `--write` exige `--confirm-env` igual ao `--env`;
   - **nunca** altera `campaigns`, créditos ou originais; **nunca** chama `.remove(`/`.update(`; exit `0/1/2/3` conforme o plano.
4. Testes **comportamentais** com deps fake (substituem a verificação apenas estática):
   - dry-run: `upload`/`generate` com **zero** chamadas; candidato elegível = `would_create`;
   - guarda: `--expected-url` divergente (mesmo loopback, porta diferente) e `--write` sem `--confirm-env` ⇒ `blocked`, zero chamadas a deps;
   - limites: `limit` e `batchSize` respeitados; concorrência máxima observada ≤ configurada;
   - exclusão de `/inputs/`, logos, assinaturas, bench/lab, path de outro store;
   - `missing_original` (404 objeto) ≠ `access_error` (401/403/rede/timeout);
   - retomada: primeira execução falha 1 item; segunda execução ignora miniaturas existentes e reprocessa só o pendente, com cursor estável;
   - cursor: lote final parcial emite `null`; `--after` keyset é repassado intacto e não vira `NaN`; timestamps com 6 casas preservam os microssegundos; paginação de 1 em 1 não repete item; retomada com o cursor exato;
   - dry-run inspeciona o original (somente leitura; metadata + decode 1×1): conteúdo inválido/truncado ⇒ `invalid_format`, sem `generate`;
   - **timeout com objeto persistido:** primeira execução retorna `thumbnail_upload_timeout`; o fake passa a reportar `thumbnailExists = true`; segunda execução classifica `already_exists` e **não** chama `generate`/upload — prova de reparo idempotente após aborto HTTP;
   - **vínculo de ambiente no CLI:** `expectedUrl` A + client B (mesmo loopback, porta diferente) ⇒ `blocked`, zero chamadas a `listCampaignsPage`/`downloadOriginal`/`generate`;
   - inspeção estática do CLI apenas como complemento (default dry-run, env/confirm, `upsert:false`, client lazy, ausência de `.update(`/`.remove(`/`campaign_art_versions`/`storage.list`).

**Verify**
- `npm.cmd test -- src/lib/campaign/thumbnail/__tests__/backfill-selection.test.ts src/lib/campaign/thumbnail/__tests__/backfill-runner.test.ts`
- `npm.cmd exec tsx -- scripts/campaign-thumbnails/backfill.ts --help` (sem env/rede; exit 0)
- `npm.cmd exec tsx -- scripts/campaign-thumbnails/backfill.ts --env local --dry-run --limit 1` com env ausente ⇒ exit 3 e mensagem clara (sem rede)
- `npm.cmd exec tsx -- scripts/campaign-thumbnails/backfill.ts --env local --dry-run --limit 1` **somente** se houver ambiente local configurado; caso contrário, registrar como não executado.
- `npm.cmd run test:gates` e `node scripts/testing/test-status.mjs` coerentes (nenhum `.test.mjs` novo sem inventário).
- `git diff --check`.

**Done**
- Runner e CLI disponíveis; dry-run provado sem escrita por teste comportamental; guardas, limites e retomada comprovados; inventário canônico e filtros cobertos.

## 5. Falhas, invariantes e limpeza

| Cenário | Comportamento |
|---|---|
| sharp falha / entrada inválida | `failed`; campanha/entrega/crédito intocados; log sanitizado; reparável |
| Upload da miniatura falha | `failed`; campanha/entrega/crédito intocados |
| Upload excede 2 s | `AbortSignal` aborta o `fetch`, promise aguardada, `failed` (`thumbnail_upload_timeout`), sem retry e sem tarefa solta. **Abortar não prova ausência:** o reparo confere existência primeiro e trata conflito como `already_exists` |
| Client customizado sem contexto compatível | Miniatura desabilitada com diagnóstico; nenhuma leitura de env nem chamada à origem errada |
| Miniatura já existe | `already_exists`; sem sobrescrita |
| Dois uploads concorrentes | primeiro vence (`created`), segundo é `already_exists`; **nunca** há sobrescrita (a idempotência não depende de bytes idênticos entre builds) |
| Original ausente no backfill | `missing_original`, distinto de `access_error` |
| Processo interrompido | reexecução ignora existentes e retoma pelo cursor |
| Original removido após sucesso | fora do fluxo normal; sem cascata nesta quick (ver abaixo) |

**Limpeza avaliada:** não há necessidade de cascata nesta quick. Todas as remoções existentes do original (`route.ts:1657-1659`, `correction-reports.ts:719-729`, falhas pré-stream) ocorrem **antes** do ponto de criação da miniatura. Aprovação/substituição não apaga versões anteriores; miniaturas de versões antigas permanecem válidas. Órfãos só surgiriam por remoção manual/administrativa futura do original; detectá-los exigiria varredura de bucket ou infraestrutura geral de assets — explicitamente adiado. Reparo de arte ausente continua sendo responsabilidade dos fluxos atuais.

## 6. Validação planejada

**Cobertura por requisito**
- `REQ-qna-01` — formatos de entrada realmente usados: JPEG 1080×1080 (legado), JPEG 1024×1024 (novo fluxo), JPEG v2/v3 (correção/regeneração histórica); PNG/WebP de entrada são convertidos antes de chegar ao gerador.
- `REQ-qna-02` — derivada: WebP, maior aresta 288, proporção preservada, sem upscale, sem metadados, peso medido no teste; original com hash/bytes inalterados.
- `REQ-qna-03` — geração após persistência nos 3 pontos; ordem comprovada por teste.
- `REQ-qna-04` — falha/timeout de miniatura (sharp, validação, upload, 2 s) sem falha comercial, sem crédito, sem status; aborto real comprovado por teste com `fetch` fake.
- `REQ-qna-04b` — correção v2: throw injetado da miniatura não chama `failCorrectionV2`, não remove a v2 e retorna sucesso (teste comportamental).
- `REQ-qna-05` — repetição e concorrência idempotentes (`upsert:false`, conflito = sucesso).
- `REQ-qna-06` — dry-run sem `upload`/`update`/`remove`; exclusão de `/inputs/` e não elegíveis; ausência vs acesso; lote/concorrência/retomada.
- `REQ-qna-07` — regressões de artefatos, créditos, correção, listagem e F58.

**Gates automatizados**
1. Testes focados Task 1–3.
2. Suítes de regressão relacionadas: `campaign-generate`, `campaign-download`, `persistence`, `list`, `display`, `correction-v2`, `correction-thumbnail-isolation`, `artifact-store`, `legacy-frontier.guard`.
3. Comportamento do backfill: `backfill-runner` com deps fake (dry-run sem escrita, guardas com zero chamadas, limites, concorrência, retomada).
4. `npm.cmd run typecheck` (exit 0).
5. `npm.cmd run lint` (exit 0, **limitação conhecida: sem cobertura de TypeScript** — registrar, não corrigir nesta quick).
6. `npm.cmd run build` (exit 0, páginas contadas).
7. `git diff --check` limpo.
8. `node scripts/testing/test-status.mjs` sem inventário inválido (nenhum `.test.mjs` novo).

**Evidência local vs ambiente de destino**
- Local: testes com client fake, sharp real, Storage simulado; nenhuma escrita em bucket, nenhuma chamada à rede e nenhuma construção do contexto padrão.
- **Medições do Gate A são separadas por camada** (não somar como latência fim-a-fim):
  1. render real do sharp, sem rede (medir p50/p95 de `renderThumbnail` em fixture 1024 e 1080);
  2. upload **simulado** (fake imediato e fake com atraso), medindo apenas o overhead do wrapper/timeout;
  3. medição integrada (render + upload real) **não pertence ao Gate A** — só depois, em ambiente autorizado, no Gate B.
- Os 2 s limitam **somente o upload**, não a operação inteira; o render não é abortável e é limitado por `limitInputPixels`.
- Ambiente de destino: **não executado nesta quick**. A validação real de Storage (objeto privado, signed URL, ausência/erro) fica para o gate B, após dry-run aprovado. Não confundir teste local com prontidão de produção.
- **Todas** as suítes de integração Product 1:1 que exercitam `storeArtifact`/o route contra Storage real (`artifact-download`, `atomic-attempt`, `concurrent-route-submission`, `credit-delivery`, `failure-closure`, `integration-corrections`, `pending-resolution`, `persisted-campaign`, `publication-fence`, `recovery-seams`, e demais listadas em `test-categories.json`) **não serão executadas** nesta quick e permanecem **pendentes** — pendência não é aceite nem autorização para deixar resíduos. Quando forem executadas, qualquer objeto de miniatura criado no Storage de destino deverá ser inventariado e limpo conforme o roteiro do ambiente; isso é gate posterior.

## 7. Gates separados

| Gate | O que autoriza | Estado nesta rodada |
|---|---|---|
| **A — Implementação** | Escrever código/testes; rodar gates locais; sem tocar Storage/banco | **BLOQUEADO** até aprovação explícita deste plano |
| **B — Preenchimento** | Rodar o script com `--write` no ambiente aprovado, após conferir o dry-run | **BLOQUEADO**; nenhuma escrita autorizada |
| **C — Publicação** | Push/merge/deploy/smoke; ativação dos consumidores | **FORA DE ESCOPO**; F58 já tem publicação pendente |

O gate B exige: dry-run revisado (contagens e amostra de paths), ambiente declarado, confirmação explícita e relatório arquivado. Homolog/produção continuam bloqueados mesmo após o gate A.

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Testes existentes contam uploads (artifact-store) | Vermelho falso/verdadeiro mascarado | Atualizar asserções explicitamente para 2 uploads e validar paths/tipos; caso de falha da miniatura |
| Latência extra na geração (sharp + upload) | **Não medida**; a estimativa 50–200 ms não é garantia | Trabalho único, 288 px, limite de pixels; upload aborta em 2 s; medir no Gate A e registrar p50/p95 reais |
| Upload lento/indefinido | Request preso após arte já persistida | `AbortSignal.timeout(2000)` no `fetch`, promise aguardada, retorno `failed`; sem retry/tarefa solta |
| Falha silenciosa sistêmica | Miniaturas nunca criadas | Log sanitizado + script de reparo + teste de ausência |
| Detecção de duplicado depende de mensagem do Storage | Falso `failed` | Mapear 409/“already exists”/“duplicate” + teste; script faz skip-existente antes |
| Path inelegível passar | Processar input/logo | Allowlist fechada + prefixo do store + testes negativos |
| Backfill apontar para ambiente errado | Escrita indevida | `--env` + `--expected-url` comparando **origem exata (protocolo+host+porta)** + `--confirm-env` + default dry-run; homolog/produção hard-blocked |
| Original e miniatura em ambientes diferentes | Original local + miniatura em outra instância; testes offline tocando Storage | `ThumbnailContext.endpoint` deve ser igual ao endpoint do uploader; client customizado sem contexto ⇒ miniatura desabilitada, sem env; teste com duas origens comprova zero chamadas à origem errada |
| Órfão após remoção manual do original | Objeto residual | Documentado como limitação conhecida; sem varredura/cascata nesta quick (não é autorização para deixar resíduos) |
| Recipe mudar sem versionar | Consumers com imagem antiga/errada | Versão no path; mudança = `v2` |
| Lint não cobre TS | Falsa sensação de gate | Registrar limitação; typecheck + testes como gates reais |

## 9. Decisões (recomendadas na revisão de 2026-11-02; pendentes de aprovação final)

1. **Caminho:** sufixo `.thumb-v1.webp` ao lado do original — **adotado**.
2. **Dimensão/qualidade:** maior aresta 288 px, WebP qualidade 78 — **adotado**.
3. **Processamento:** síncrono, aguardado, isolado e com orçamento de 2 s abortável — **adotado**.
4. **Ponto de integração:** após a persistência original bem-sucedida nos três fluxos — **adotado**.
5. **Legado:** inserção após `updateCampaignReady`, somente `campaigns.storage_path` de campanhas `ready` — **adotado**.
6. **Contrato de ausência:** placeholder + abertura preservada; sem fallback permanente ao original; fallback temporário só com decisão explícita — **adotado**.
7. **Limpeza:** sem cascata/varredura nesta quick; órfãos por remoção manual documentados como limitação — **adotado**.
8. **Guardas do script:** `--env` + `--expected-url` com origem exata (protocolo/host/porta) + `--confirm-env`; homolog/produção hard-blocked — **adotado**.
9. **Testes críticos:** comportamento real (não só estático) para timeout/cancelamento, isolamento da correção v2 e runner do CLI com deps fake — **adotado**.
10. **Lint:** manter a limitação conhecida registrada — **adotado**.
11. **Vínculo de ambiente:** original e miniatura no mesmo endpoint; client customizado exige contexto compatível ou desabilita a miniatura, nunca cai no env — **adotado**.
12. **Aborto não prova ausência:** reparo confere existência antes e trata conflito como `already_exists` — **adotado**.
13. **Medição em camadas:** render real, upload simulado e integração posterior são evidências distintas; 2 s limitam só o upload — **adotado**.

> **Gate A autorizado em 2026-11-02** (implementação e validação local). Permanecem **não autorizados**: preenchimento real, escrita em homolog/produção, troca de consumidores, merge, push e deploy.

## 10. Limites do Gate A (autorizado em 2026-11-02)

**Permitido:** implementar código/testes; executar validação local com mocks/fakes (sharp real, Storage simulado); rodar testes focados, typecheck, lint, build e `git diff --check`; commits atômicos da implementação, se o fluxo GSD exigir.

**Não permitido:** executar o backfill com escrita; qualquer escrita em Storage/banco de homolog ou produção; migration; troca de consumidores; merge, push, deploy ou tag. O Gate B (preenchimento) e o Gate C (publicação) continuam bloqueados.
