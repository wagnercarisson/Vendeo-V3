---
id: 261107-qvo
title: Expandir campanha pronta para 9:16 na bancada do laboratório
status: planned
created: 2026-11-07
branch: feat/quick-extensao-laboratorio-9-16
checkpoint_a: implementação + testes locais sem provider (aguarda aprovação)
checkpoint_b: primeira expansão paga de uma imagem pronta (autorização separada)
checkpoint_c: fluxo completo 4:5 + expansão 9:16 (autorização separada)
---

# Plano — “Expandir campanha pronta” para 9:16

> **Somente planejamento.** Nenhum código, ambiente, banco, catálogo ou provider
> foi alterado. Este plano para antes da implementação, para revisão do Codex e
> aprovação do responsável.

## 0. Estado e limites

- Branch atual: `feat/quick-extensao-laboratorio-9-16`.
- `git status` contém apenas o diretório de evidências **pré-existente** da quick
  `261107-hcx` (não rastreado): `layout-guide-20-15.png/.svg`. Ele será
  preservado e não faz parte desta quick.
- A bancada existente já tem: admin, guarda local, loja de teste, presets
  (incluindo 2.6), execução single-shot, crédito? **não** — a bancada não usa
  crédito comercial; usa apenas confirmação financeira manual.
- O schema local da bancada já foi aplicado no `vendeo-homolog` na quick
  anterior (`lab_bench_runs`, `lab_bench_artifacts`, `lab_bench_store_imports`).
- Nenhuma chamada paga será executada neste plano.

## 1. Objetivo

Adicionar a operação **“Expandir campanha pronta”**, isolada do fluxo comercial
de criação, para:

1. enviar **uma única** imagem de campanha pronta;
2. exibir imagem e dimensões reais;
3. escolher modelo/qualidade entre os presets da bancada;
4. revisar e aprovar um prompt de expansão editável;
5. exibir tamanho solicitado + confirmação financeira;
6. executar **uma** chamada `images.edit` single-shot;
7. comparar original e resultado, com download e evidências.

A operação **não** usa produto/oferta, compositor comercial, identidade visual,
máscara, markup, recomposição de centro ou preenchimento determinístico.

## 2. Decisão de arquitetura: operação separada, não um modo do fluxo comercial

O fluxo atual (`/bancada`) é comercial: exige produto, oferta, preço, selo,
validade, referências de produto e compositor determinístico
(`buildBenchCampaignSnapshot`, `loadBenchBranding`, `recomposeBenchPrompt`,
`assertPreflight...`). Forçar a expansão por esse fluxo exigiria dados
comerciais falsos e misturaria versões do compositor comercial — proibido pelo
escopo.

**Decisão:** criar uma subpágina e rotas próprias da expansão, reutilizando os
serviços genéricos (upload, presets, custo, run/CAS, artifact, telemetry,
execução, histórico). O fluxo comercial existente permanece intocado.

- UI: `/admin/laboratorio/bancada/expandir`.
- API: `/api/admin/laboratorio/bancada/expand/runs` (execução) e reutilização de
  `/inputs`, `/estimate`, `/runs/[id]` e `/runs?storeId` com campos de operação.
- Link “Expandir campanha pronta” na página `/bancada`, sem alterar o workbench
  comercial.

## 3. Geometria

### 3.1 Formato 4:5 na bancada (menor ajuste)

Adicionar `4:5` ao resolvedor interno da bancada:

| formato | size | width | height | aspect |
|---|---|---|---|---|
| `4:5` | `1152x1440` | 1152 | 1440 | 4/5 |

- `1152/16 = 72` e `1440/16 = 90`; proporção 4:5; total 1.658.880 px —
  dentro dos limites documentados de dimensão customizada.
- Isso permite gerar campanhas **1152×1440** no fluxo comercial existente e
  depois expandi-las para **1152×2048** sem mudar a escala.
- Adicionar a política `formato-4-5` (linguagem natural, sem congelar layout) e
  as entradas de pricing por `model + quality + 1152x1440` (tarifas oficiais,
  **sem** estimativa de tokens de saída comprovada).
- O seletor de formato do fluxo comercial passa a exibir `4:5`; `1:1` e `9:16`
  permanecem com o comportamento atual.

### 3.2 Expansão 1152×1440 → 1152×2048

Para a entrada 4:5 canônica:

| Item | Valor |
|---|---|
| Entrada | `1152×1440` |
| Saída solicitada | `1152×2048` |
| Acréscimo horizontal | `0 px` |
| Acréscimo vertical | `608 px` |
| Acima | `304 px` |
| Abaixo | `304 px` |
| Escala solicitada | `1,0` em X e Y |
| Crop / resize / deformação | nenhum no pedido |

> A tabela acima é a **geometria solicitada**, não um resultado garantido. O
> provedor pode gerar outro enquadramento ou alterar conteúdo; a validação
> técnica só comprova dimensões/decodificação.

O módulo puro `expand-geometry.ts` calcula e devolve:

- `supported: true` somente quando `width === 1152` e `height < 2048`;
- `top = floor((2048 - height) / 2)`, `bottom = 2048 - height - top`;
- `left = right = 0`, `scaleX = scaleY = 1` (valores **solicitados**);
- `supported: false` com motivo explícito quando a largura for diferente de
  1152, a altura for `>= 2048` (altura 2048 não tem expansão) ou a altura
  exceder o destino.

**Regra de produto:** nesta primeira versão, entrada com largura diferente de
1152 é **recusada** com `bench_expand_geometry_unsupported` e uma mensagem que
explicita a solução futura (redimensionar/crop com perda de escala), sem
executar resize silencioso. Entrada `1152×2048` é recusada com
`bench_expand_not_needed` (não há quadro a expandir). Não se promete preservação
de escala quando houver redimensionamento.

**Limitação explícita:** o exemplo 1:1 `1024×1024` usado no Playground **não** é
aceito nesta primeira versão porque a largura não é 1152. Ele exigiria uma
decisão separada de redimensionamento/crop; este plano não a toma.

### 3.3 Validação dos bytes e aceites separados

- O servidor baixa a imagem de origem do bucket `lab-artifacts` e decodifica os
  bytes reais com `sharp` antes de executar; não confia apenas no metadado do
  cliente.
- A saída é validada por `validateArtifactTechnically` com
  `expectedWidth=1152`, `expectedHeight=2048` e `expectedAspectRatio=9/16`.
- Divergência dimensional é falha terminal (`bench_dimensions_mismatch`), sem
  resize, com `usage`, custo disponível e dimensões reais persistidos.
- O original nunca é sobrescrito: a entrada permanece em
  `bench/{runId}/inputs/0.*`; a saída vai para `bench/{runId}/output.*`.

**Dois aceites distintos:**

| Aceite | O que prova | O que não prova |
|---|---|---|
| Técnico | saída decodifica, dimensões exatas, MIME/bytes/checksum, original intacto por checksum, usage/custo registrados | que a campanha central foi preservada visualmente |
| Visual | comparação humana entre original e resultado (conteúdo, proporções, disposição, emendas) | nada é automatizado; não há score nem promoção |

- `succeeded` significa **somente sucesso técnico**.
- O checksum do original comprova que o **arquivo de entrada** não foi
  alterado; não comprova que a segunda geração preservou o centro.
- A UI deve exibir “Preservação visual não avaliada” e não usar “preservado”
  como resultado automático.

## 4. Prompt de expansão

Novo módulo puro `expand-prompt.ts`:

```ts
export const EXPAND_9_16_PROMPT_VERSION = "261107-expand-9-16-v1";
export const DEFAULT_EXPAND_9_16_PROMPT = `Você está recebendo uma campanha pronta.
Amplie o quadro para 9:16, mantendo a campanha centralizada e preservando
seu conteúdo, proporções e disposição.
Preencha o espaço acrescentado com uma continuação natural do fundo
original, preservando cores, iluminação, textura e perspectiva.
Não recorte, distorça, desfoque, redesenhe ou altere os elementos existentes.
Não acrescente textos, logotipos, produtos ou elementos decorativos nas
áreas novas. Entregue uma imagem contínua, sem emendas visíveis.`;
```

- O editor final é semeado com esse texto e pode ser editado/substituído.
- A aprovação é explícita e o texto aprovado é enviado **byte a byte**; o
  servidor não concatena instruções comerciais, identidade, marca ou políticas.
- Evidência: `promptVersion` + `promptApproved` + `promptSent` +
  `promptEdited` (booleano). **Não** preencher `composerVersion`,
  `policyVersions`, `promptCompiled`, `promptBase` ou `identityReference`.
- O botão “Restaurar prompt inicial” repõe o texto padrão da versão.

### 4.1 Aprovação e confirmação financeira

O contrato da expansão declara `promptApproved` explicitamente (não apenas
`prompt`):

- o servidor envia `promptApproved` byte a byte; não há campo `prompt` paralelo;
- `promptSent` persistido é idêntico a `promptApproved`;
- nenhuma instrução é acrescentada após a aprovação.

Invalidação:

| Evento | Aprovação do prompt | Confirmação financeira | Observação |
|---|---|---|---|
| Troca de imagem | **Invalida** | **Invalida** | a origem mudou |
| Troca de loja | **Invalida** | **Invalida** | contexto/guarda mudou |
| Edição do prompt | **Invalida** | **Invalida** | conteúdo/tokens de entrada mudaram |
| Troca de modelo | Mantém o texto | **Invalida** | prompt não depende do modelo |
| Troca de qualidade | Mantém o texto | **Invalida** | prompt não depende da qualidade |
| Nova tentativa | Invalida até recomporem | Reinicia | novo `draft` |

- O painel de estimativa usa `requestId` + revisão efetiva; resposta de revisão
  antiga é descartada e **não** reabre a confirmação.
- Ao confirmar, o servidor/cliente exige que a revisão estimada seja a atual.
- A confirmação é sempre manual e individual; não há hard cap financeiro.

## 5. Fluxo de UI

Subpágina `bancada/expandir`:

1. **Loja de teste** — reutilizar `BenchStoreSelector`; guarda
   `assertBenchTestStore`.
2. **Imagem de campanha** — upload de exatamente uma imagem (PNG/JPEG/WebP).
   Exibir preview, MIME, bytes, checksum e **dimensões reais** retornadas pelo
   servidor. Rejeitar segundo arquivo.
3. **Modelo/qualidade** — reutilizar `BenchPresetSelector` com o seletor de
   formato oculto/fixo em `9:16`; presets habilitados, incluindo 2.6.
4. **Prompt de expansão** — editor, versão, “Restaurar prompt inicial”,
   “Aprovar prompt”. Trocar imagem, loja, prompt, modelo ou qualidade invalida
   as aprovações correspondentes conforme §4.1.
5. **Geometria solicitada** — painel com entrada, saída, acréscimo
   superior/inferior, escala **solicitada** 1,0, avisos e bloqueio quando não
   suportado. O painel não afirma que o conteúdo central será preservado.
6. **Estimativa/confirmação** — reutilizar `BenchEstimatePanel` e o padrão de
   `ConfirmDialog`; exibir tamanho solicitado, geometria solicitada e cobertura
   de pricing. Respostas atrasadas de estimativa são descartadas; confirmar
   exige a revisão atual.
7. **Execução** — `POST /expand/runs` com NDJSON; exatamente um evento terminal.
   Single-shot, `OPENAI_BENCH_API_KEY`, `maxRetries: 0`.
8. **Comparação** — original e resultado lado a lado, dimensões de cada um,
   download por URL assinada, evidências. Exibir “Sucesso técnico; preservação
   visual não avaliada” e “O arquivo original foi preservado por checksum; isso
   não comprova a preservação do centro”.
9. **Histórico/tentativas** — lista de expansões da loja; “Nova tentativa”
   reutiliza `duplicateBenchRunInputs` para copiar a única entrada. A nova
   tentativa continua identificada como `operation = "expand"` e **não** herda
   versões comerciais.

Não exibir formulário de produto/oferta, painel de branding, campos de preço,
selo, validade ou políticas comerciais.

## 6. API e persistência

### 6.1 Upload (reuso com operação)

Estender `POST /api/admin/laboratorio/bancada/inputs` com um campo opcional
`operation`:

- `operation = "expand"` exige **exatamente um** arquivo;
- `operation` ausente/`campaign` mantém o comportamento atual (1 principal +
  até 3 adicionais);
- a rota continua reservando o `draft` idempotente por `operationId`, gravando
  o arquivo em `bench/{runId}/inputs/0.*` e devolvendo dimensões/checksum;
- nenhuma identidade é anexada no upload.

### 6.2 Execução da expansão

Nova rota `POST /api/admin/laboratorio/bancada/expand/runs`:

1. admin → guarda de ambiente → `confirmed: true` (422 se ausente) → Zod
   `BenchExpandRunInputSchema` (400).
2. `operationId`, `runId`, `storeId`, `presetId`, `promptApproved`,
   `references` (exatamente 1), `promptVersion` opcional. `promptApproved` é o
   texto final aprovado e a única fonte do prompt enviado; não há campo
   `prompt` paralelo sem aprovação explícita.
3. resolve o `draft` por `operationId`, valida `runId`/autoria/estado;
   terminal ⇒ idempotente; `pending`/`running` ⇒ 409.
4. `resolveBenchPreset` (2.5/2.6 habilitados) → `assertBenchTestStore`.
5. baixa a única entrada de `lab-artifacts`, decodifica dimensões reais com
   `sharp`, valida `references.length === 1` e o path
   `bench/{runId}/inputs/0.*`.
6. calcula `expand-geometry`; se não suportado ⇒ 400
   `bench_expand_geometry_unsupported` (largura ≠ 1152 ou altura > 2048) ou
   `bench_expand_not_needed` (altura = 2048), com motivo/geometria proposta;
   sem CAS e sem provider.
7. valida `promptApproved` não vazio e `promptVersion ===
   EXPAND_9_16_PROMPT_VERSION`; `promptSent = promptApproved` byte a byte;
   nenhum texto adicional.
8. persiste no `draft` via `setBenchRunInput`:
   - `campaign_snapshot` = `{ operation:"expand", storeId, source, target,
     geometry, promptVersion }`;
   - `branding_snapshot` = `{ storeId, storeName, operation:"expand" }` apenas
     como contexto de loja para o histórico (sem branding real);
   - `config` = `{ operation:"expand", formato:"9:16", promptVersion,
     promptEdited, source, target, geometry }`;
   - `promptSent`/`promptApproved` = texto exato; `promptCompiled`/`promptBase`/
     `composerVersion`/`policyVersions`/`identityReference` = `null`;
   - `references` = uma entrada; `provider/model/size/quality` do preset;
     `size = "1152x2048"`.
9. CAS `draft → pending` (`confirmBenchRun`), stream NDJSON e
   `executeBenchRun` com:
   - `productImagesDataUrls: [única origem]`;
   - **sem** `identityImageUrl`;
   - `size: "1152x2048"`, `expectedWidth: 1152`, `expectedHeight: 2048`,
     `expectedAspectRatio: 9/16`.
10. O adapter da bancada recebe **uma** imagem; reutilizar o `BenchImagesAdapter`
    existente, sem identidade automática e com `maxRetries: 0`.

### 6.3 Estimativa

Reutilizar `GET /api/admin/laboratorio/bancada/estimate` com
`formato=9:16` e o preset escolhido. A UI calcula a geometria localmente e
exibe o custo; a rota de execução revalida a geometria server-side. Nenhuma
fórmula de preço nova.

### 6.4 Histórico/detalhe

- `GET /runs?storeId=...`: adicionar `operation` (de `config.operation`),
  `promptVersion`, `size` e `estimatedCostUsd` já existente; a UI filtra
  expansões.
- `GET /runs/[id]`: adicionar `operation`, `promptVersion`, `sourceDimensions`,
  `targetDimensions` e `geometry` (de `config`/`campaign_snapshot`). O detalhe
  já devolve `promptSent`, `promptApproved`, `references`, modelo/qualidade,
  `technicalValidation`, `usage`, custos e artefatos com URLs assinadas.
- O original é um artefato `kind="input"` separado; o resultado é
  `kind="output"`. O detalhe devolve ambos.
- `POST /runs/[id]/attempts` já devolve `references`/config; reutilizar para
  “Nova tentativa” da expansão. A tentativa copia somente a entrada; o novo
  `draft` continua `operation = "expand"` quando a rota de expansão o preparar,
  e **não** herda `composerVersion`, `policyVersions`, `promptCompiled`,
  `promptBase` ou `identityReference` do run comercial.
- Campos comerciais não usados na expansão permanecem **nulos** no run:
  `promptCompiled`, `promptBase`, `composerVersion`, `policyVersions`,
  `identityReference`, `intent`, `contentType`, `structure`, `theme`. Não
  preencher com valores fictícios só para satisfazer o formato da tabela.
- `operation` e `promptVersion` são derivados de `config` no detalhe/lista; a
  UI usa isso para filtrar e para manter a tentativa como expansão.

### 6.5 Schema necessário

**Nenhuma alteração estrutural é necessária.** Reutilizar:

- `lab_bench_runs.config` (JSONB) para `operation`, `promptVersion`,
  `promptEdited`, `source`, `target`, `geometry`;
- `campaign_snapshot` para o snapshot da expansão;
- `branding_snapshot.storeId` para o agrupamento por loja no histórico
  (contexto mínimo, não branding);
- `prompt_*`, `references`, `provider/model/size/quality`, `usage`,
  `estimated_cost_usd`, `cost_detail`, `technical_validation`;
- `lab_bench_artifacts` para original (`input`) e resultado (`output`).

Não criar tabela, coluna ou migration. Se o Codex exigir colunas explícitas
(`operation`, `prompt_version`, `geometry`), isso deve ser uma decisão separada
de schema local, não uma ampliação automática deste plano.

## 7. Reaproveitamento do adapter (sem duplicação)

Reutilizar `BenchImagesAdapter`/`buildBenchInvocationRequest` **como estão**:

- a expansão envia **uma** imagem e **nenhuma** identidade automática;
- o basename interno `product.png` é cosmético e não instrui o modelo a tratar
  a imagem como produto; não é necessário parametrizar o nome nem criar um
  adapter quase idêntico;
- o adapter continua `maxRetries: 0`, single-shot, sem fallback;
- a execução usa `createBenchAdapterRegistry()`/`createBenchGateway()` sem
  alterações no registry padrão;
- o comportamento comercial permanece idêntico.

Nenhuma alteração em `src/lib/ai/adapters/bench-images.ts` ou
`src/lib/lab/bench/gateway/runtime.ts` é necessária para a expansão.

## 8. Arquivos afetados (previstos)

| Arquivo | Mudança |
|---|---|
| `src/lib/lab/bench/domain/expand-prompt.ts` (novo) | Prompt inicial + versão + `promptEdited` |
| `src/lib/lab/bench/domain/expand-geometry.ts` (novo) | Geometria 1152×1440 → 1152×2048, motivos de recusa |
| `src/lib/lab/bench/domain/expand-schema.ts` (novo) | Zod da execução de expansão |
| `src/lib/lab/bench/domain/bench-format.ts` | Adicionar `4:5` (`1152x1440`) |
| `src/lib/lab/bench/domain/config-registry.ts` | Habilitar `4:5` |
| `src/lib/lab/bench/domain/policies/formato-4-5.ts` (novo) | Política de formato 4:5 |
| `src/lib/lab/bench/domain/policies/registry.ts` | Registrar 4:5 |
| `src/lib/lab/bench/domain/prompt-base.ts` | Registrar recorte 4:5 |
| `src/lib/lab/bench/domain/bench-pricing.ts` | Entradas `1152x1440` (sem estimativa inventada) |
| `src/app/api/admin/laboratorio/bancada/inputs/route.ts` | `operation=expand` + exatamente 1 arquivo |
| `src/app/api/admin/laboratorio/bancada/expand/runs/route.ts` (novo) | Execução isolada da expansão |
| `src/app/api/admin/laboratorio/bancada/runs/route.ts` | Expor `operation`/`promptVersion` no histórico |
| `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` | Expor operação/geometria/dimensões |
| `src/app/(app)/admin/laboratorio/bancada/expandir/page.tsx` (novo) | Server page com guarda + lojas/presets |
| `.../expandir/_components/bench-expand-workbench.tsx` (novo) | Contêiner da operação |
| `.../expandir/_components/bench-single-image-upload.tsx` (novo) | Upload de uma imagem + dimensões + preview |
| `.../expandir/_components/bench-expand-prompt-panel.tsx` (novo) | Editor/aprovação/versão |
| `.../expandir/_components/bench-expand-geometry-panel.tsx` (novo) | Geometria **solicitada** antes da execução |
| `.../expandir/_components/bench-expand-execution-panel.tsx` (novo) | Estimativa, confirmação, NDJSON, idempotência |
| `.../expandir/_components/bench-expand-result-panel.tsx` (novo) | Original × resultado, dimensões, download, evidências |
| `.../bancada/page.tsx` | Link “Expandir campanha pronta” |
| `.../bancada/_components/bench-preset-selector.tsx` | `showFormat`/`fixedFormat` opcional |
| `.../bancada/_components/bench-evidence-panel.tsx` | Exibir `operation`/`promptVersion` (ou novo painel de evidência) |
| Testes listados na seção 10 | Novos contratos e regressões |

## 9. Fluxo completo e separação de validações

### Validação 1 — expansão de uma imagem pronta (foco do CHECKPOINT B)

- upload de uma imagem 1152×1440 (fixture controlada);
- preset/modelo escolhido; prompt aprovado; geometria **solicitada** 304/304;
- uma chamada paga de expansão;
- resultado 1152×2048; original intacto por checksum; custo/usage/evidências;
- preservação visual da campanha é avaliada separadamente, por inspeção humana.

### Validação 2 — fluxo completo 4:5 + expansão (CHECKPOINT C)

- gerar uma campanha 4:5 (1152×1440) no fluxo comercial da bancada (chamada
  paga separada);
- baixar a arte gerada;
- enviá-la como campanha pronta na operação de expansão;
- expandir para 9:16 (segunda chamada paga).

As duas validações têm autorizações e orçamentos separados. A primeira não
depende da geração 4:5 paga.

## 10. Testes sem provider

| # | Contrato | Onde |
|---|---|---|
| 1 | Upload de expansão aceita exatamente uma imagem; 0 ou 2 ⇒ erro; nenhuma assinatura/identidade anexada | `inputs` route test, upload UI test, adapter test |
| 2 | `promptApproved` explícito; prompt enviado === aprovado; `promptVersion`/`promptEdited` persistidos; nenhum texto comercial acrescentado | expansão route/service test |
| 3 | Isolamento comercial: rota/serviço de expansão não importa nem chama `buildBenchCampaignSnapshot`, `loadBenchBranding`, `recomposeBenchPrompt`, `resolveBenchPromptPolicies`, `composePromptBlocks` | boundary/source contract test |
| 4 | Confirmação ausente ⇒ 422; duplicidade por `operationId` ⇒ idempotente; concorrência ⇒ 409; exatamente uma invocação | expansão route test + gateway fake |
| 4b | Troca de imagem/loja/prompt invalida aprovação **e** confirmação; modelo/qualidade invalidam só a confirmação; estimativa atrasada não reabre confirmação | UI contract test |
| 5 | Geometria 1152×1440 ⇒ top/bottom 304, escala solicitada 1.0; 1152×2048 ⇒ `bench_expand_not_needed`; largura ≠ 1152 ⇒ 400; altura > 2048 ⇒ 400 | `expand-geometry.test.ts`, route test |
| 6 | Dimensão retornada divergente ⇒ falha `bench_dimensions_mismatch`, sem resize, com usage/custo/dimensões reais | `bench-execution.contract.test.ts` |
| 7 | Custo/usage/histórico: estimate 9:16, `usage`, custo calculado × reportado, `operation`/`promptVersion` na lista/detalhe | pricing/estimate/run-history tests |
| 8 | Original intacto como artefato `input` independente (checksum); saída `output` separada; paths distintos; **não** confundir com preservação visual | artifact/run-history tests |
| 9 | Formato 4:5: `1152x1440`, política/versionamento, composição 4:5, regressão 1:1/9:16, pricing sem estimativa inventada | bench-format/config/policy/pricing/composer tests |
| 10 | UI: subpágina acessível; upload único; painel de geometria **solicitada**; editor/aprovação; estimativa/confirmação; original × resultado; sem produto/oferta/branding | `bench-expand-ui.contract.test.tsx` |
| 11 | `succeeded` é sucesso técnico, não preservação visual; UI exibe “preservação visual não avaliada” | result/evidence panel test |
| 12 | Nova tentativa copia a única entrada, permanece `operation=expand` e não herda versões comerciais; campos comerciais nulos | run-history/api test |

Todos com fakes/`vi.mock`, sem rede e sem provider.

## 11. Gates locais (CHECKPOINT A)

1. `npm run typecheck`
2. `npm run lint`
3. `npx vitest run` dos contratos da bancada, expansão, 4:5, API/UI.
4. `npm run build`.
5. `git diff --check` e revisão de escopo:
   - nenhum arquivo de produção, crédito, catálogo, prompt produtivo,
     `MODEL_ALLOWLIST`, `ai_model_selection`, `product-1-1` ou
     `product-vertical-9-16`;
   - nenhuma migration compartilhada, dependência ou push/deploy;
   - nenhum segredo/URL em código/teste.

## 12. Checkpoints de autorização

### CHECKPOINT A — implementação e testes locais

- código/UI/rotas/helpers/testes da seção 8/10;
- 4:5 habilitado no fluxo comercial da bancada;
- expansão funcional com provider fake;
- nenhuma chamada paga, nenhuma escrita de ambiente/catálogo;
- diff revisável e gates verdes.

### CHECKPOINT B — primeira expansão paga de imagem pronta

- autorização específica de orçamento e matriz;
- uma única imagem 1152×1440 e um único preset;
- uma chamada `images.edit` de expansão; sem retry;
- o endpoint/tamanho `images.edit` `1152×2048` **já foi comprovado** nas
  gerações da bancada; o que se valida aqui é a **expansão de uma campanha
  pronta** nesse caminho;
- registrar dimensões retornadas, usage, custo disponível, original e resultado;
- separar aceite técnico de aceite visual humano;
- parar em divergência dimensional, erro de auth/capacidade ou custo acima do
  teto operacional.

### CHECKPOINT C — fluxo completo 4:5 + expansão

- autorização separada para **duas** chamadas pagas;
- gerar 4:5 no fluxo comercial, baixar a arte, expandir para 9:16;
- validar que a imagem 4:5 é preservada como original independente e que a
  expansão não a sobrescreve;
- sem promoção automática para produção.

## 13. Riscos e incompatibilidades concretas

1. **Expansão de campanha pronta ainda não comprovada.** O endpoint/tamanho
   `images.edit` `1152×2048` já é usado nas gerações da bancada; o novo teste é
   a expansão de uma campanha pronta nesse caminho. Se o provider rejeitar ou
   devolver outra dimensão, falhar fechado, sem retry.
2. **Qualidade de outpainting não é garantida.** `succeeded` será sucesso
   técnico (dimensões/decodificação), não preservação visual aprovada.
3. **Largura diferente de 1152:** o plano recusa; redimensionar/cropar seria uma
   decisão separada e explícita. Não há promessa de escala preservada.
4. **Exemplo 1:1 `1024×1024` do Playground:** não é aceito porque a largura não
   é 1152. Essa é uma limitação explícita do primeiro recorte; não ampliar o
   escopo agora.
5. **Reuso semântico de `campaign_snapshot`/`branding_snapshot`:** a expansão
   não tem branding; usa `branding_snapshot.storeId` apenas para o histórico.
   Documentar no código/UI. Não criar schema novo sem necessidade.
5. **O fluxo comercial não pode ser reutilizado como está:** `BenchRunInputSchema`
   exige produto/oferta e o `/runs` comercial recompoõe o prompt. A expansão
   precisa de rota/schema próprios; não simular dados comerciais.
6. **O adapter existente é suficiente:** o nome `product.png` é cosmético e não
   instrui o modelo a tratar a imagem como produto; reutilizar o
   `BenchImagesAdapter` como está, com uma única imagem e sem identidade. Não
   criar adapter quase idêntico.
7. **4:5 no bench não existe hoje:** `bench-format`/registry/policy/pricing/UI
   precisam do ajuste. O schema de cenários do laboratório A/B rejeita 4:5, mas
   é outro módulo e **não** será alterado.
8. **Histórico:** a lista existente agrupa por `branding_snapshot.storeId`; o
   contexto mínimo de loja mantém a expansão visível. Se o Codex preferir um
   campo explícito `operation`, isso é uma decisão de schema separada.
9. **Sem crédito comercial:** a bancada usa confirmação financeira manual; não
   reutilizar crédito, cobrança ou entrega de produção.
10. **Imagem original:** nunca sobrescrever; o path de saída é único por run.

## 14. Evolução futura — aplicação em produção, condicionada à validação no laboratório

> Registro de **possibilidade futura**, não compromisso de implementação. Não
> amplia entradas aceitas, não altera o teste 1152×1440 → 1152×2048 e não cria
> estruturas adicionais agora.

- **Possível fluxo de nova campanha:** gerar em `4:5` e depois expandir para
  `9:16`, com **duas chamadas de imagem**.
- **Possível ação sobre campanha existente:** “Criar versão em outro formato”,
  aproveitando uma arte `1:1` ou `4:5` já aprovada, **sem refazer briefing ou
  composição comercial**; uma chamada adicional de expansão.
- **Preservação e vínculo:** manter o original e vincular a versão derivada à
  campanha de origem.
- **Independência temporal:** não pressupor que a expansão precise ocorrer
  imediatamente após a geração; a arte aprovada pode ser expandida depois.
- **Escopo separado:** geometria de outras entradas, cobrança/créditos,
  recuperação de falhas, interface e ativação produtiva serão definidos em
  escopo próprio.
- **Aprovação no laboratório não autoriza automaticamente** integração ou
  ativação em produção.

Evitar acoplamentos desnecessários que impeçam essa evolução, sem implementar
qualquer parte dela neste CHECKPOINT A.

## 15. Fora do escopo

- Alterar produção, crédito, catálogo produtivo, prompt produtivo ou migrations
  compartilhadas.
- Push, deploy ou publicação.
- Máscara, markup, SVG, animação, recomposição de centro ou preenchimento
  determinístico.
- Automatizar avaliação visual ou promoção de modelo.
- Reconstruir o laboratório ou refatorar o fluxo comercial.
- Novas dependências/SDK.
- Executar chamadas pagas nesta etapa.

## 16. Critérios de aceite do plano

- [ ] Expansão é uma operação isolada; o fluxo comercial permanece idêntico.
- [ ] Uma única imagem é enviada; sem identidade automática; original preservado
      como artefato independente (comprovável por checksum).
- [ ] `promptApproved` é declarado explicitamente e enviado byte a byte; versão
      própria; sem compositor comercial.
- [ ] Troca de imagem/loja/prompt invalida aprovação e confirmação; modelo/
      qualidade invalidam apenas a confirmação; estimativa atrasada não reabre
      confirmação.
- [ ] Geometria **solicitada** 1152×1440 → 1152×2048 (304/304, escala 1.0)
      exibida antes da execução; largura diferente é recusada; altura 2048 é
      recusada como “sem expansão”, sem resize silencioso.
- [ ] Confirmação financeira, single-shot e proteção contra duplicidade
      reutilizados.
- [ ] Dimensões retornadas, usage, custo e resultado registrados; divergência
      falha com evidência.
- [ ] A UI distingue sucesso técnico de preservação visual e não afirma que a
      campanha central foi preservada sem comparação humana.
- [ ] Histórico/detalhe mostram operação, prompt version, origem, destino e
      artefatos; nova tentativa continua como expansão e não herda versões
      comerciais.
- [ ] Campos comerciais não usados permanecem nulos, sem valores fictícios.
- [ ] 4:5 (`1152x1440`) disponível no fluxo comercial da bancada.
- [ ] Validação da expansão de imagem pronta separada da validação 4:5 +
      expansão.
- [ ] Entrada 1024×1024 do Playground é explicitamente recusada nesta versão.
- [ ] Nenhuma alteração de produção/catálogo/migration compartilhada; nenhuma
      chamada paga no planejamento.

---

**PLANEJAMENTO PRONTO — IMPLEMENTAÇÃO NÃO INICIADA**
