# Alinhamento Fase 14 — Integração no Fluxo de Geração (v1.3)

## Contexto

```
v1.3 — Persistência e Entrega da Campanha  (milestone)
  ├── Fase 1 / Phase 12 — Fundação DB/Storage                   ✅ completa
  ├── Fase 2 / Phase 13 — Serviço de Persistência e Download    ✅ completa
  ├── Fase 3 / Phase 14 — Integração no Fluxo de Geração       ← esta fase
  ├── Fase 4 / Phase 15 — /campanha/[id]                        (pendente)
  ├── Fase 5 / Phase 16 — /minhas-campanhas + limpeza           (pendente)
  └── Fase 6 / Phase 17 (cond) — Edição Publication Copy       (condicional)
```

Esta fase conecta os serviços de persistência construídos na F13 ao fluxo de geração existente em `POST /api/campaign/generate-image`. Hoje a rota armazena o resultado apenas em `sessionStorage` e redireciona para `/campaign/preview` — após esta fase, toda campanha gerada nasce persistida no banco e no Storage, com `campaignId` retornado no NDJSON para navegação futura.

**Nota sobre `/campanha/[id]`:** A rota persistida da campanha será criada na F15. Ao final da F14, o consumer navegará para `/campanha/${campaignId}` — que resultará em 404 (página inexistente) até a F15. Isso é aceito como fase técnica: o download via `/api/campaign/[id]/download` já funciona, e a rota pública será construída em sequência. Um stub (página mínima de transição) pode ser incluído na F14 se o time preferir não ter 404 temporário — decisão a ser tomada durante o planejamento.

**Dependências:** F12 (tabela `campaigns`, bucket `campaign-images`, RLS), F13 (`persistence.ts` com 7 helpers, `types.ts`, rota de download).
**Pré-requisito lógico:** F14 precisa estar completa antes das F15 (página de campanha) e F16 (listagem de campanhas).

---

## Propósito

1. Conectar `generate-image/route.ts` aos helpers de persistência da F13
2. Garantir que o registro `generating` exista **antes** da chamada ao provider de IA
3. Transcodificar a imagem gerada pela IA (PNG/WEBP) para JPEG sRGB qualidade 90 1080×1080
4. Executar upload ao Storage e UPDATE `ready`/`error` após a geração
5. Estender o NDJSON de resultado para incluir `campaignId` + `campaignUrl`
6. Ajustar o consumer (`use-campaign-form.ts`) para navegar para `/campanha/[id]` em vez de salvar em `sessionStorage`
7. Realinhar o `publication_copy_snapshot` para o shape da milestone (kit de publicação: caption, hashtags, cta_post)

**Entrega verificável:**
- `POST /api/campaign/generate-image` persiste campanha durante o fluxo: INSERT `generating` → geração IA → transcode → upload → UPDATE `ready`
- NDJSON final emite `{ type: "result", campaignId, campaignUrl }`
- `use-campaign-form.ts` navega para `/campanha/[campaignId]` em vez de `/campaign/preview`
- `publication_copy_snapshot` no shape correto: caption, hashtags, cta_post
- `sessionStorage` mantido para rascunho do formulário, removido como fonte de verdade pós-geração
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F13)

```
                                    ANTES (F13)                       DEPOIS (F14)
═══════════════════════════════════════════════════════════════════════════════════════
campaigns table                     ✓ EXISTS                          ✓ (inalterado)
campaign-images bucket              ✓ EXISTS                          ✓ (inalterado)
persistence.ts (7 helpers)          ✓ EXISTS                          ✓ (inalterado)
types.ts                            ✓ EXISTS                          ✓ (publication_copy ajustado)
download route                      ✓ EXISTS                          ✓ (inalterado)

generate-image route:
  INSERT generating                 ✗ não existe                      ✓ antes da IA
  transcode PNG/WEBP → JPEG        ✗ não existe                      ✓ com sharp
  upload + updateReady             ✗ não existe                      ✓ pós-geração
  updateError em falha             ✗ não existe                      ✓ se algo falhar
  NDJSON resultado                 { imageDataUrl }                  { campaignId, campaignUrl }

use-campaign-form.ts:
  fonte de verdade                 sessionStorage                     ✓ /campanha/[id]
  rascunho formulário                sessionStorage                     ✓ mantido
  navigation pós-geração           /campaign/preview                 ✓ /campanha/[id]

image-processor.ts                 ✗ não existe                      ✓ transcode + buildPublicationCopy
publication_copy_snapshot shape    title/subtitle/hook/cta/...     ✓ caption | hashtags | cta_post
```

---

## Decisões de Arquitetura

### D1 — JPEG canônico (.jpg) é a decisão vigente

`CONFIRMADO`

O artefato da milestone (`docs/alinhamento-milestone-v1.3.md`) menciona `{storeId}/{campaignId}.png` na linha 62, mas a F13 já consolidou JPEG como formato canônico de entrega — `storage_path` sempre `.jpg`, `uploadCampaignImage` só aceita `image/jpeg`, `RenderSnapshot` fixa `format: "jpeg"`.

**Decisão:** Manter JPEG como decisão mais recente. O doc da milestone está desatualizado nesse detalhe. A F14 reforça essa escolha implementando a transcodificação PNG/WEBP → JPEG com sharp.

---

### D2 — Transcodificação com sharp

`CONFIRMADO`

O provider de IA pode devolver PNG ou WEBP. `dataUrlToCampaignImage` da F13 é parser puro (não transcodifica). `uploadCampaignImage` só aceita `image/jpeg`. Logo, a F14 precisa de um servidor de transcodificação.

```
dataUrl da IA (PNG/WEBP)
    │
    ▼
dataUrlToCampaignImage(dataUrl)    ← valida e extrai buffer (F13)
    │
    ▼
transcodeToJpeg(buffer, mimeType)  ← converte para JPEG sRGB q90 1080×1080 (F14 — sharp)
    │
    ▼
uploadCampaignImage(storeId, id, { buffer: jpegBuffer, mimeType: "image/jpeg" })  ← F13
```

**Escolha:** `sharp` — padrão da indústria, performático, compatível com Next.js/Vercel, necessário também para thumbnails em F15/F16.

---

### D3 — Realinhamento do `publication_copy_snapshot` para shape da milestone

`CONFIRMADO`

A milestone define `publication_copy_snapshot` como "kit de publicação": caption, hashtags, cta_post. O shape atual na `types.ts` da F13 (title, subtitle, hook, cta, badgeText, priceDisplay) reflete dados da arte, não da publicação.

**Decisão:** Ajustar o tipo `PublicationCopySnapshot` para o shape correto antes de gravar dados reais na F14:

```ts
interface PublicationCopySnapshot {
  caption: string        // texto da legenda do post
  hashtags: string[]     // array de hashtags
  cta_post: string       // call-to-action para a legenda
}
```

**Convenção de nomenclatura:** O snapshot é persistido como JSONB diretamente na tabela `campaigns`. Como a milestone e o banco usam `snake_case`, as chaves do JSONB seguem `snake_case` (`caption`, `hashtags`, `cta_post`). Se a UI precisar de `camelCase` no futuro, o mapeamento é feito na camada de apresentação — o dado no banco permanece `snake_case`.

O builder correspondente (`buildPublicationCopySnapshot`) será implementado em `image-processor.ts` na F14-01.

---

### D4 — `sessionStorage` mantido para rascunho, removido como fonte de verdade

`CONFIRMADO`

O `sessionStorage` tem dois usos distintos no fluxo atual:

| Uso | Decisão | Motivo |
|-----|---------|--------|
| `campaign_preview` (chave pós-geração) | **Remover** | Campanha agora está persistida no banco. Navegar para `/campanha/[id]` |
| `campaign_draft_image` (rascunho do formulário) | **Manter** | Não é campanha gerada — é imagem do produto antes do submit. Sem substituto server-side |
| `useInputPreservation` | **Manter** | Rascunho dos campos de texto antes do submit. Mesmo motivo. |

---

### D5 — Result NDJSON só após persistência completa

`CONFIRMADO`

A ordem deve ser:

```
1. INSERT campaigns (generating)
2. Geração IA via provider
3. dataUrlToCampaignImage → extrair buffer
4. transcodeToJpeg → JPEG sRGB q90 1080×1080
5. uploadCampaignImage → Storage
6. updateCampaignReady → status=ready
7. SÓ ENTÃO: emitir NDJSON { type: "result", campaignId, campaignUrl }
```

Política de compensação por ponto de falha:
- **Upload falha:** apenas `updateCampaignError` — não há imagem para deletar
- **UpdateReady falha (upload OK):** `deleteCampaignImage` + `updateCampaignError` — remove imagem órfã

Nunca emitir sucesso antes da persistência estar completa — o cliente redireciona na hora e não volta para tentar de novo.

---

### D6 — Runtime Node.js obrigatório para rota de geração

`CONFIRMADO`

A rota `generate-image/route.ts` atualmente não declara runtime. Com `sharp` como dependência (incompatível com Edge Runtime), a F14 deve adicionar explicitamente:

```ts
export const runtime = "nodejs";
```

Isso já é true por padrão no Next.js App Router (rotas são Node.js a menos que marcadas como `edge`), mas a declaração explícita remove ambiguidade e previne regressão se o time futuramente migrar outras rotas para Edge.

---

### D7 — Geração de metadados da geração

`CONFIRMADO`

`updateCampaignReady` exige `generationMetadata` com `provider`, `model`, `durationMs`, `generatedAt` e `corrections?`. No entanto, o `ImageGenerationService.generateImage()` não expõe esses dados diretamente — retorna apenas `imageDataUrl`, `inputCorrections` e indicador de sucesso/erro.

**Estratégia para F14:** O route handler já sabe qual provider foi usado (via `createImageProvider().name`) e qual modelo (via `IMAGE_GENERATION_RESPONSES_MODEL`). O handler envolve a chamada ao service com `performance.now()` para medir `durationMs`. As `corrections` vêm do `result.inputCorrections` já emitido no NDJSON.

| Campo | Fonte |
|-------|-------|
| `provider` | `createImageProvider().name` (ex.: `"openai"`) |
| `model` | `IMAGE_GENERATION_RESPONSES_MODEL` da config |
| `durationMs` | `performance.now() - start` medido no handler |
| `generatedAt` | `new Date().toISOString()` |
| `corrections` | `result.inputCorrections` (já emitido no NDJSON) |

Não é necessário modificar o `ImageGenerationService` — o handler tem todas as informações para montar o objeto.

---

### D8 — Ordem: validação + conflito ANTES do INSERT

`CONFIRMADO`

A milestone diz "registro antes da execução da IA" — e o fluxo atual executa validação de input e detecção de conflito (via `InputValidationService`, que chama IA) antes de qualquer persistência. Isso é deliberado.

```
validação de input + conflito IA  →  se falhar: 409, sem registro
auth + ownership                  →  se falhar: 401/404, sem registro
resolução de identidade           →  se falhar: 404/500, sem registro
                                    ──── barreira ────
INSERT campaigns (generating)    →  registro existe
Geração da imagem                 →  chamada lenta/paga
```

Interpretação: validação de input/conflito é **antes** do INSERT porque não queremos persistir tentativas inválidas. "Antes da IA" no contexto da milestone significa antes da geração da imagem (o custo principal), não antes de toda IA. O `InputValidationService` usa IA, mas é barato comparado à geração e serve como guarda de qualidade.

---

### D9 — Naming dos campos `generation_metadata` no JSONB

`CONFIRMADO`

A `GenerationMetadata` interface em F13 usa `camelCase` (durationMs, generatedAt). Como o JSONB é persistido em coluna do banco, o naming das chaves no objeto JavaScript não precisa casar com `snake_case`. A pergunta é: o objeto que vai ser `JSON.stringify`ado para o banco deve usar `camelCase` (como a interface TS) ou `snake_case`?

**Decisão:** Manter `camelCase` conforme a interface existente em `types.ts`. O JSONB armazena o objeto como um blob — o `snake_case` vs `camelCase` é irrelevante para o banco. O que importa é consistência no código. Como a F13 já definiu `durationMs`, `generatedAt` etc., a F14 segue o mesmo padrão. Se no futuro houver consumo desse JSONB por SQL (ex.: `SELECT generation_metadata->>'duration_ms'`), um migração ou view pode normalizar.

---

### D10 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **14-01** | Image processor + publication copy | Instalar sharp. `image-processor.ts` com `transcodeToJpeg` e `buildPublicationCopySnapshot`. Ajustar `PublicationCopySnapshot` em `types.ts`. Testes |
| **14-02** | Orquestração em generate-image | Modificar `generate-image/route.ts` com o pipeline: `createCampaign` precoce, transcode + upload + updateReady/Error pós-stream. NDJSON estendido com `campaignId` |
| **14-03** | Consumer no cliente | Ajustar `use-campaign-form.ts`: não montar `PreviewPayload`, não gravar `campaign_preview`, navegar para `campaignUrl` ou `/campanha/${campaignId}`. Manter rascunho |

```
14-01 ──► 14-02 ──► 14-03
(transcode)  (orquestração)  (consumer)
```

---

## Estrutura de Código

```
src/lib/campaign/
  types.ts              ← PublicationCopySnapshot ajustado para shape da milestone
  persistence.ts        ← inalterado (7 helpers da F13)
  image-processor.ts    ← NOVO: transcodeToJpeg, buildPublicationCopySnapshot

src/app/api/campaign/
  generate-image/
    route.ts            ← MODIFICADO: INSERT generating + transcode + upload + updateReady/Error
  [id]/
    download/
      route.ts          ← inalterado (F13)

src/components/flow/
  use-campaign-form.ts  ← MODIFICADO: consumer sem sessionStorage, navega por campaignId

src/__tests__/
  lib/
    campaign/
      processor.test.ts ← NOVO: transcode + publication copy builder
  api/
    campaign-generate.test.ts  ← NOVO: fluxo integrado com mocks
```

---

## Testes

### `processor.test.ts`

| Teste | O que valida |
|-------|-------------|
| `transcodeToJpeg` aceita PNG → retorna JPEG buffer | MIME `image/jpeg`, dimensões 1080×1080 |
| `transcodeToJpeg` aceita WEBP → retorna JPEG | Mesmo contrato |
| `transcodeToJpeg` aceita JPEG → retorna JPEG | Idempotente |
| `transcodeToJpeg` rejeita formato inválido | Erro descritivo |
| `buildPublicationCopySnapshot` retorna shape correto | caption, hashtags (array), cta_post |
| `buildPublicationCopySnapshot` com dados mínimos | Preenche campos obrigatórios |

### `campaign-generate.test.ts`

| Teste | O que valida |
|-------|-------------|
| sucesso: INSERT → IA → transcode → upload → updateReady | NDJSON final com campaignId |
| erro IA: INSERT → updateError | NDJSON error event |
| erro upload: INSERT → updateError | Apenas marca erro — não há imagem para deletar |
| erro updateReady: INSERT → upload → deleteImage + updateError | Compensação executada |
| sem auth: 401 antes de INSERT | Registro não criado |
| ownership mismatch: 404 antes de INSERT | Sem vazamento |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| `sharp` incompatível com runtime Vercel/Edge | Sharp é suportado em Node.js runtime (não Edge). F14 declara `export const runtime = "nodejs"`. Testar em preview deploy |
| Transcodificação aumenta latência da rota | É o menor dos custos comparado à chamada IA. O tempo de transcode de um buffer 1080×1080 com sharp é <50ms |
| `publication_copy_snapshot` shape diverge entre F14 e F15 | A F15 consome o snapshot que a F14 escreve. O shape fica congelado após a F14 |
| Falha parcial entre upload e updateReady | Compensação: updateCampaignError + deleteCampaignImage. Campanha fica como `error` em vez de `generating` órfão |
| `campaignUrl` no NDJSON diverge da URL real | A URL é construída pelo backend: `/campanha/${campaignId}`. Consumer usa essa URL para navegação |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Página `/campanha/[id]` | Fase 15 |
| Página `/minhas-campanhas` | Fase 16 |
| Edição de publication copy | Fase 6 condicional (pós-v1.3) |
| Remoção física de `/campaign/preview` | Fase 15 (pode virar redirect) |
| Fallback de signed URL via blob proxy | Documentado na F13, não implementado |
| Job de cleanup de `generating` stale | Futuro |
| Geração de tipos com `supabase gen types` | Pós-F14 |
| Thumbnails para listagem | Fase 16 |
| `store-logos` cleanup | Pós-v1.3 |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — JPEG canônico (.jpg) vigente | milestone doc desatualizado nesse detalhe
- [ ] D2 — Transcodificação com sharp (dependência de runtime)
- [ ] D3 — `publication_copy_snapshot` realinhado: `caption` | `hashtags[]` | `cta_post` (snake_case no JSONB)
- [ ] D4 — `sessionStorage` mantido para rascunho, removido como fonte de verdade pós-geração
- [ ] D5 — Result NDJSON só após persistência completa (nunca antes de upload + updateReady)
- [ ] D6 — `export const runtime = "nodejs"` explícito na rota generate-image
- [ ] D7 — Metadados de geração montados no handler: `provider`, `model`, `durationMs`, `generatedAt`, `corrections`
- [ ] D8 — Validação de input + conflito ANTES do INSERT (não persistir tentativas inválidas)
- [ ] D9 — `generation_metadata` no JSONB usa camelCase (durationMs, generatedAt), consistente com F13
- [ ] D10 — Três planos de execução: 14-01 | 14-02 | 14-03

### Plano 14-01 — Image processor + publication copy
- [ ] `sharp` instalado como dependência de runtime
- [ ] `src/lib/campaign/image-processor.ts` com `transcodeToJpeg`
- [ ] `src/lib/campaign/image-processor.ts` com `buildPublicationCopySnapshot`
- [ ] `PublicationCopySnapshot` em `types.ts` ajustado para `caption`, `hashtags[]`, `cta_post` (snake_case)
- [ ] Testes do processor

### Plano 14-02 — Orquestração em generate-image
- [ ] `export const runtime = "nodejs"` adicionado na rota
- [ ] `createCampaign()` após auth/ownership/identidade/validação de conflito, antes da IA
- [ ] `dataUrlToCampaignImage` + `transcodeToJpeg` no sucesso da IA
- [ ] `uploadCampaignImage` após transcode
- [ ] `updateCampaignReady` após upload bem-sucedido
- [ ] Compensação: upload falha → só updateError; upload OK + updateReady falha → deleteCampaignImage + updateError
- [ ] `generationMetadata` montado no handler (provider, model, durationMs, generatedAt, corrections)
- [ ] NDJSON estendido: `{ type: "result", campaignId, campaignUrl }`
- [ ] Fluxo de erro preservado: 409 conflitos, 400 validação, etc. (nada mudou no início da rota)
- [ ] Testes de integração

### Plano 14-03 — Consumer no cliente
- [ ] `use-campaign-form.ts` deixa de montar `PreviewPayload`
- [ ] Remove gravação de `campaign_preview` em `sessionStorage`
- [ ] Navega para `campaignUrl` ou `/campanha/${campaignId}` no sucesso (404 até F15 — aceito)
- [ ] Mantém rascunho do formulário (`campaign_draft_image`, `useInputPreservation`)
- [ ] Testes

### Build
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-09*
*Baseado no alinhamento da milestone v1.3, nos artefatos da F13 e em 6 pontos de alinhamento consolidados durante discussão da Fase 14*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 14*