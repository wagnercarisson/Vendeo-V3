# Alinhamento Fase 13 — Serviço de Persistência e Download (v1.3)

## Contexto

```
v1.3 — Persistência e Entrega da Campanha  (milestone)
  ├── Fase 1 / Phase 12 — Fundação DB/Storage                 ✅ completa
  ├── Fase 2 / Phase 13 — Serviço de Persistência e Download  ← esta fase
  ├── Fase 3 / Phase 14 — Integração no generate-image        (pendente)
  ├── Fase 4 / Phase 15 — /campanha/[id]                      (pendente)
  ├── Fase 5 / Phase 16 — /minhas-campanhas + limpeza         (pendente)
  └── Fase 6 / Phase 17 (cond) — Edição Publication Copy      (condicional)
```

Esta fase constrói a camada de persistência isolada sobre a infraestrutura criada na Fase 12: tabela `campaigns` e bucket `campaign-images`. Ela cria os helpers de escrita/leitura, a rota de download por signed URL, e os testes unitários — **sem acoplar ao fluxo de geração existente**. A integração real com `generate-image` fica para a Fase 14.

**Dependências:** Fase 12 — tabela `campaigns`, bucket `campaign-images`, RLS e Storage policies.
**Pré-requisito lógico:** Fase 13 pode ser executada em paralelo com o design de F4/F5, mas precisa estar completa antes da F14.

---

## Propósito

1. Criar `src/lib/campaign/persistence.ts` com helpers de escrita e leitura
2. Criar `src/lib/campaign/types.ts` com tipos manuais (shape mínimo v1 dos snapshots)
3. Criar `GET /api/campaign/[id]/download` com signed URL + redirect 302
4. Testar isoladamente: serviço de persistência + rota de download

**Entrega verificável:**
- `createCampaign(storeId, input)` insere registro `generating` com `storage_path` pré-calculado
- `dataUrlToCampaignImage(dataUrl)` valida e extrai buffer de PNG/JPEG/WEBP; rejeita formatos inválidos (sem transcodificação)
- `uploadCampaignImage(storeId, campaignId, image)` sobe ao bucket `campaign-images` com `upsert: false`; rejeita MIME diferente de `image/jpeg`
- `updateCampaignReady(campaignId, data)` seta `status='ready'` com snapshots e metadados
- `updateCampaignError(campaignId, errorMessage)` seta `status='error'`; rejeita mensagem vazia
- `getCampaign(id)` retorna `CampaignRecord | null` via `supabaseAdmin`
- Rota de download: 401 sem sessão, 400 (`[id]` malformado), 404 (inexistente ou de outro tenant), 302 com signed URL para owner
- `npm run typecheck`, `npm run lint`, `npm run build` — zero erros
- Fluxo de geração intacto (Fase 13 não toca `generate-image`)

---

## Estado Atual

```
                                    ANTES (Fase 12)                  DEPOIS (Fase 13)
═══════════════════════════════════════════════════════════════════════════════════════
campaigns table                     ✓ EXISTS                          ✓ (inalterado)
campaign-images bucket              ✓ EXISTS                          ✓ (inalterado)
RLS / Storage policies              ✓ configuradas                    ✓ (inalterado)
src/lib/campaign/                   ✗ não existe                      ✓ persistence.ts + types.ts
createCampaign()                    ✗ não existe                      ✓ INSERT generating + storage_path
dataUrlToCampaignImage()            ✗ não existe                      ✓ extração + validação MIME
uploadCampaignImage()               ✗ não existe                      ✓ Storage upsert:false
updateCampaignReady()               ✗ não existe                      ✓ UPDATE ready + snapshots
updateCampaignError()               ✗ não existe                      ✓ UPDATE error + mensagem
getCampaign()                       ✗ não existe                      ✓ SELECT via supabaseAdmin
GET /api/campaign/[id]/download     ✗ não existe                      ✓ signed URL + redirect 302
Testes de persistence               ✗ não existe                      ✓ unitários (service + rota)
Fluxo de geração                    intacto                           ✓ intacto — nada mudou
```

---

## Decisões de Arquitetura

### D1 — Separação entre "registro" e "imagem"

`CONFIRMADO`

O fluxo de persistência é decomposto em operações atômicas independentes, não em uma única função "salvar campanha":

```
createCampaign()
  → INSERT campaigns status=generating
  → retorna { id, storage_path }            ← {storeId}/{campaignId}.jpg

dataUrlToCampaignImage(dataUrl)       ← função pura, testável isoladamente
  → { buffer, mimeType }              ← valida PNG/JPEG/WEBP, sem conversão

uploadCampaignImage(storeId, campaignId, image)
  → Storage upload em campaign-images/{storeId}/{campaignId}.jpg
  → contentType: image/jpeg
  → upsert: false

updateCampaignReady(campaignId, data)
  → UPDATE status='ready' + snapshots + generation_metadata

updateCampaignError(campaignId, errorMessage)
  → UPDATE status='error' + error_message
```

**Motivo:** A Fase 14 (integração no `generate-image`) orquestrará essas operações em sequência. Manter cada operação independente hoje permite testar cada etapa isoladamente e torna a orquestração futura explícita — não escondida dentro de um "save" monolítico.

---

### D2 — `dataUrlToCampaignImage()` antes de `uploadCampaignImage()`

`CONFIRMADO`

O upload recebe dados já convertidos, não uma data URL bruta:

```ts
// Validação + extração (função pura, sem transcodificação)
dataUrlToCampaignImage(dataUrl: string): { buffer: Buffer; mimeType: string }
  → Aceita: image/png, image/jpeg, image/webp — apenas valida e extrai
  → Rejeita: MIME não suportado, data URL malformada, payload vazio

// Upload (efeito colateral: Storage) — formato canônico: JPEG
uploadCampaignImage(
  storeId: string,
  campaignId: string,
  image: { buffer: Buffer; mimeType: "image/jpeg" }
): Promise<{ storagePath: string }>
  → Bucket: campaign-images
  → Path: {storeId}/{campaignId}.jpg
  → contentType: image/jpeg
  → upsert: false
  → Nota: F14 garante que o buffer chega como JPEG sRGB qualidade 90 antes do upload
```

**Motivo:** Separa responsabilidade de parsing/validação (testável sem mock de Storage) da operação de upload (requer mock de Storage). `dataUrlToCampaignImage` é um parser genérico que aceita PNG/JPEG/WEBP — funciona como entrada para `uploadCampaignImage` **apenas se a data URL já for JPEG**. A transcodificação PNG/WEBP → JPEG fica em um helper separado na F14.

---

### D3 — Sem `upsert` no Storage

`CONFIRMADO`

O upload usa `upsert: false` (padrão). O bucket `campaign-images` não tem policy de UPDATE — consistente com a invariante de imutabilidade da milestone.

Para retry no mesmo `storage_path` após falha parcial (ex.: Storage OK mas DB UPDATE falhou), o helper oferece uma função auxiliar:

```text
tentativa de upload falhou por conflito (objeto já existe no path)
  → deleteCampaignImage(storagePath)   ← remoção deliberada
  → upload novamente no mesmo path
```

`deleteCampaignImage` é exportada como **helper secundário deliberado** — necessária para compensação em falha parcial (F14) e para cleanup futuro. É pública mas não faz parte do contrato principal de persistência (create → upload → update).

---

### D4 — Política de compensação (quem orquestra decide)

`CONFIRMADO`

A sequência esperada na F14 será:

```
DB INSERT OK → Storage upload OK → DB UPDATE ready
```

Mas uma falha parcial pode ocorrer:

```text
DB INSERT OK
Storage upload OK
DB UPDATE ready FALHA
```

Neste caso:
- `updateCampaignReady` **propaga o erro** — não esconde a falha, não tenta compensar sozinho
- O orquestrador (F14) captura o erro, chama `updateCampaignError` para marcar a campanha como erro
- Opcionalmente: chama `deleteCampaignImage` para remover a imagem órfã (decisão da F14)

**Na F13, os helpers são honestos:** criam registro, sobem imagem, marcam sucesso/erro. A compensação é responsabilidade de quem chama.

---

### D5 — Tipos manuais em `src/lib/campaign/types.ts`

`CONFIRMADO`

Não travar a Fase 13 em `supabase gen types`. Como os snapshots ainda estão com shape parcialmente estabilizado (v1 mínima), tipos manuais são mais práticos e evitam dependência de execução do gerador.

```ts
type CampaignStatus = "generating" | "ready" | "error"

interface CampaignRecord {
  id: string
  store_id: string
  status: CampaignStatus
  product_name: string
  input_snapshot: Record<string, unknown>
  identity_snapshot: Record<string, unknown> | null
  generation_metadata: Record<string, unknown> | null
  render_snapshot: Record<string, unknown> | null
  publication_copy_snapshot: Record<string, unknown> | null
  storage_path: string
  error_message: string | null
  created_at: string
  updated_at: string
}

interface CreateCampaignInput {
  storeId: string
  productName: string
  inputSnapshot: Record<string, unknown>
  identitySnapshot?: Record<string, unknown>
}

interface CampaignReadyData {
  generationMetadata: Record<string, unknown>
  renderSnapshot: Record<string, unknown>
  publicationCopySnapshot: Record<string, unknown>
}
```

**Motivo:** Manter agilidade na F13 sem esperar execução de `supabase gen types`. Quando F14-F16 estabilizarem os snapshots com tipos definitivos, vale gerar `database.types.ts` e migrar os tipos manuais.

---

### D6 — Shape mínimo v1 dos snapshots (não diferido)

`CONFIRMADO`

Diferentemente da Fase 12, que adiou o shape dos snapshots, a Fase 13 define um **shape mínimo v1** para cada campo JSONB. O shape pode evoluir em fases futuras, mas a F13 precisa de contratos definidos para os testes passarem.

**`input_snapshot`** — entrada do lojista, equivalente ao `GenerateImageRequest` sem `storeId` e sem `productImageDataUrl` bruta. A imagem é substituída por metadados seguros:

```ts
{
  productName: string
  originalPriceCents?: number
  discountedPriceCents: number
  badgeText?: string
  hook?: string
  cta?: string
  description?: string
  objective?: string
  campaignDetails?: string
  additionalDetails?: string
  targetChannel?: string
  format?: string
  validity?: string
  availabilityNotes?: string
  sensitiveConstraints?: string
  inputValidationOverride?: { productImageCheck?: "user_confirmed_continue" }
  productImage: { provided: true; mimeType: string }
}
```

**`identity_snapshot`** — snapshot da identidade da loja usada na geração:

```ts
{
  storeName: string
  storeSegment: string
  brandColor: string
  identityState: "text_only" | "logo" | "visual_signature"
  signature: { url: string | null; type: "logo" | "visual_signature" | null }
  storeInitials: string
  brandProfile: Record<string, unknown> | null
  toneOfVoice: string | null
  subsegment: string | null
  positioning: string | null
  shortDescription: string | null
  slogan: string | null
}
```

**`render_snapshot`** — metadados de render/arquivo (não confundir com parâmetros visuais da IA). A v1 fixa o formato canônico — a saída é sempre JPEG 1080×1080 qualidade 90:

```ts
{
  format: "jpeg"
  width: 1080
  height: 1080
  aspectRatio: "1:1"
  mimeType: "image/jpeg"
  quality: 90
  colorSpace: "srgb"
}
```

**`publication_copy_snapshot`** — copy publicável extraída da campanha:

```ts
{
  title: string
  subtitle?: string
  hook: string
  cta: string
  badgeText: string
  priceDisplay: string
}
```

**`generation_metadata`** — metadados da geração:

```ts
{
  provider: string
  model: string
  durationMs: number
  generatedAt: string
  corrections?: {
    productName?: { from: string; to: string; reason: string }
  }
}
```

**Nota:** Na F13, os snapshots ainda não são populados por um fluxo real (isso é F14). O shape serve para tipar os parâmetros de `CampaignReadyData` e permitir testes de `updateCampaignReady` com dados realistas. A implementação da IA que produz esses dados, assim como a transcodificação para JPEG qualidade 90, é responsabilidade da F14.

---

### D7 — Download route: `requireApiUser` + `supabaseAdmin` + `requireOwnership`

`CONFIRMADO`

```
GET /api/campaign/[id]/download
  → requireApiUser()
  → validar [id] como UUID v4 — se malformado: 400
  → getCampaign(id) via supabaseAdmin
  → se null: 404 (campanha inexistente)
  → requireOwnership(campaign.store_id, user.userId)
  → se não pertencer: 404 (mesmo status que inexistente — sem vazamento de existência)
  → createSignedUrl(storage_path, 3600)
  → redirect 302 para signed URL
```

Padrão idêntico ao usado em `generate-image/route.ts` e demais rotas protegidas do sistema.

**Motivo:** Evita depender de cookies/RLS dentro do service. A rota usa `supabaseAdmin` para buscar a campanha, `requireOwnership` para verificar posse, e `createSignedUrl` para gerar acesso temporário. Owner e não-existente retornam 404 — sem distinguir os casos.

---

### D8 — Eager vs Lazy signed URL

`ADIADO PARA F4/F5`

A rota de download (`/api/campaign/[id]/download`) gera a signed URL **lazy** (no momento do clique) — não precisa decidir agora.

A decisão de eager vs lazy para as páginas (`/campanha/[id]`, `/minhas-campanhas`) fica postergada para F4/F5, como já definido no alinhamento da Fase 12 (D6).

---

### D9 — Formato canônico de entrega: JPEG

`CONFIRMADO`

O formato canônico da campanha final na v1.3 é **JPEG**:

| Atributo | Valor |
|----------|-------|
| Formato visual | Instagram Feed quadrado |
| Dimensão | 1080×1080 |
| Proporção | 1:1 |
| MIME type | `image/jpeg` |
| Extensão | `.jpg` |
| Espaço de cor | sRGB |
| Qualidade alvo | 90 |
| Transparência | Sem transparência (não necessária para arte final de campanha) |

**Motivo da escolha:** JPEG oferece o melhor equilíbrio peso/qualidade para Instagram Feed (canal principal do lojista). PNG, embora sem perda, resulta em arquivos significativamente maiores para arte que mistura produto, fundos, gradientes e textos — sem vantagem proporcional para o lojista, dado que as plataformas recomprimem imagens no upload. WEBP é tecnicamente superior em peso/qualidade, mas pode gerar atrito em compartilhamento/download direto e integrações externas; fica como otimização futura. Stories/Reels/TikTok/WhatsApp (9:16) ficam fora do formato v1 — o contrato dimensional é **1080×1080, 1:1, Instagram Feed**.

**Impacto na implementação:**
- `storage_path` sempre usa `.jpg` — `{storeId}/{campaignId}.jpg`
- `uploadCampaignImage` recebe `mimeType: "image/jpeg"` na assinatura — rejeita qualquer outro MIME
- `dataUrlToCampaignImage` valida PNG/JPEG/WEBP mas **não faz transcodificação** — é um parser genérico. Só funciona como entrada do `uploadCampaignImage` se a data URL já for JPEG
- A transcodificação PNG/WEBP → JPEG qualidade 90 sRGB 1080×1080 é responsabilidade da F14 (pipeline de geração), em um helper separado
- `render_snapshot` registra `format`, `width`, `height`, `aspectRatio`, `mimeType`, `quality`, `colorSpace`

---

## Estrutura de Código

```
src/lib/campaign/
  types.ts              → interfaces CampaignStatus, CampaignRecord, CreateCampaignInput, CampaignReadyData
  persistence.ts        → createCampaign, dataUrlToCampaignImage, uploadCampaignImage,
                          updateCampaignReady, updateCampaignError, getCampaign,
                          deleteCampaignImage (helper secundário exportado)

src/app/api/campaign/
  [id]/
    download/
      route.ts          → GET: requireApiUser → validate UUID → getCampaign → requireOwnership → createSignedUrl → 302

src/__tests__/
  lib/
    campaign/
      persistence.test.ts
  api/
    campaign-download.test.ts
```

---

## Testes

### `persistence.test.ts`

| Teste | O que valida |
|-------|-------------|
| `createCampaign` gera UUID e `storage_path` | `{storeId}/{campaignId}.jpg` (formato canônico JPEG) |
| `createCampaign` insere `status=generating` | `product_name`, `input_snapshot`, `identity_snapshot` |
| `createCampaign` rejeita storeId inválido | UUID malformado |
| `dataUrlToCampaignImage` aceita PNG/JPEG/WEBP | Retorna `{ buffer, mimeType }` sem conversão |
| `dataUrlToCampaignImage` rejeita data URL inválida | MIME não suportado, string vazia, malformada |
| `uploadCampaignImage` usa bucket `campaign-images` | Confirma bucket e path corretos |
| `uploadCampaignImage` usa `upsert: false` | Sem sobrescrita |
| `uploadCampaignImage` path sempre `.jpg` | `{storeId}/{campaignId}.jpg`, formato canônico |
| `uploadCampaignImage` usa content type correto | `image/jpeg` |
| `updateCampaignReady` seta `status='ready'` | Snapshots e metadados persistidos |
| `updateCampaignReady` seta `error_message: null` | Sempre limpa mensagem de erro anterior |
| `updateCampaignError` seta `status='error'` | `error_message` preenchido |
| `updateCampaignError` rejeita `error_message` vazia | Validação antes do banco (ou CHECK constraint faz) |
| `getCampaign` retorna record | Campanha existe |
| `getCampaign` retorna null | Campanha não existe |
| `getCampaign` com UUID malformado | Não testado — helper assume ID validado pela rota |
| `getCampaign` propaga erro do Supabase | Erro inesperado → exceção ou retorno explícito |

### Rota `GET /api/campaign/[id]/download`

| Teste | Status esperado |
|-------|----------------|
| Sem sessão | 401 |
| `[id]` malformado (não-UUID) | 400 |
| Campanha inexistente | 404 |
| Campanha de outra loja | 404 (mesmo que inexistente) |
| Owner acessando | 302 com signed URL |
| `createSignedUrl` falha | 502 |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Modificação do fluxo `generate-image` | Fase 3 / Phase 14 |
| Página `/campanha/[id]` | Fase 4 / Phase 15 |
| Página `/minhas-campanhas` | Fase 5 / Phase 16 |
| Edição publication copy | Fase 6 condicional |
| Geração de tipos com `supabase gen types` | Pós-F14, quando snapshots estabilizarem |
| `store-logos` cleanup | Pós-v1.3 |
| Job de cleanup de `generating` stale | Futuro |
| Integração com `CampaignIntelligenceService` | Fase 14 (geração do `publication_copy_snapshot`) |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| `createSignedUrl` falha em produção | A rota de download retorna 502; fallback via `supabase.storage.download()` + proxy de blob (documentado no alinhamento da milestone) |
| Data URL malformada chega ao `uploadCampaignImage` | `dataUrlToCampaignImage` valida e rejeita antes do upload |
| Buffer em formato não-JPEG chega ao `uploadCampaignImage` | O tipo `mimeType: "image/jpeg"` na assinatura é contrato — F14 deve garantir JPEG antes de chamar o upload |
| Transcodificação PNG/JPEG/WEBP → JPEG para formato canônico | Não é responsabilidade da F13. F14 implementa a conversão com sharp ou similar antes de chamar `uploadCampaignImage` |
| Upload com `upsert: false` falha por path existente | Retry não é automático — `deleteCampaignImage` + re-upload é caminho explícito |
| Shape dos snapshots muda em F14-F16 | Tipos manuais em `types.ts` facilitam ajuste sem quebrar `database.types.ts` |
| Sem `supabase gen types`, tipos manuais ficam dessincronizados do banco | Risco aceito. Tipos manuais são mais ágeis nesta fase; sincronização é planejada para pós-F14 |
| UUID malformado chega ao `getCampaign` sem validação | Supabase/PG pode lançar exceção interna → 500. Rota valida UUID antes de chamar `getCampaign`; helper assume ID válido |

---

## Checklist de Revisão

### Serviço `src/lib/campaign/`
- [ ] `types.ts` com `CampaignStatus`, `CampaignRecord`, `CreateCampaignInput`, `CampaignReadyData` e shapes dos snapshots
- [ ] `createCampaign(storeId, input)` — INSERT `generating` com `storage_path` pré-calculado
- [ ] `dataUrlToCampaignImage(dataUrl)` — validação e extração PNG/JPEG/WEBP (sem transcodificação)
- [ ] `uploadCampaignImage(storeId, campaignId, image)` — Storage `upsert: false`
- [ ] `updateCampaignReady(campaignId, data)` — UPDATE `ready` com snapshots + `error_message: null`
- [ ] `updateCampaignError(campaignId, errorMessage)` — UPDATE `error` com validação de mensagem
- [ ] `getCampaign(id)` — SELECT via `supabaseAdmin`
- [ ] `deleteCampaignImage(storagePath)` — helper secundário exportado

### Rota `/api/campaign/[id]/download`
- [ ] `requireApiUser()` executado
- [ ] Validação de UUID v4 para `[id]` — 400 se malformado
- [ ] `getCampaign(id)` com `supabaseAdmin`
- [ ] 404 para campanha inexistente ou de outro tenant
- [ ] `requireOwnership(campaign.store_id, user.userId)` executado
- [ ] `createSignedUrl(storage_path, 3600)` com redirect 302
- [ ] 502 em falha de `createSignedUrl`

### Testes
- [ ] `persistence.test.ts` — todos os cenários da tabela de testes
- [ ] `campaign-download.test.ts` — 401, 400 (malformed UUID), 404 (inexistente), 404 (outra loja), 302, 502

### Build
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido
- [ ] Nenhum arquivo do fluxo de geração foi modificado

---

*Documento criado: 2026-07-09*
*Baseado no alinhamento da milestone v1.3 (D1–D6), no alinhamento da Fase 12, e em 8 pontos de alinhamento definidos durante a revisão do escopo da Fase 13*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 13*
