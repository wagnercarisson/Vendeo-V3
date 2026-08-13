## Context

O Vendeo recebe o input da campanha como payload **flat de 21 campos** (`GenerateImageRequestSchema`, zod `.strict()`) e monta no backend o que hoje se chama `CampaignBrief` (`src/components/campaign/types.ts:37`) — um wrapper de transporte `{ campaignInput, store, brandProfile, identity }`. Esse wrapper é passado direto ao pipeline paralelo (Copy Director ∥ Image Director → revisão → persistência), e o `input_snapshot` da campanha é um `Record<string, unknown>` **flat e sem versionamento**.

**Estado real verificado em código (explorado na fase):**
- O snapshot **já não guarda base64** (`src/app/api/campaign/generate-image/route.ts:357-380`): grava `productImage: { provided: true, mimeType: "image/jpeg" }` e descarta o `productImageDataUrl`. O gap real é a **estrutura flat e não versionada**.
- Existem **TRÊS conceitos de "brief"** no código (colisão de nomeação): ① `brand_profile.campaign_brief` (texto gerado pelo Brand Profiler); ② `CampaignBrief` atual (`src/components/campaign/types.ts:37`, wrapper de transporte); ③ o contrato de domínio proposto nesta fase.
- O pipeline inteiro lê o corpo flat diretamente: `ImageGenerationService` faz `const body = brief.campaignInput as GenerateImageRequest` (`src/lib/image-generation/services/image-generation-service.ts:95`) e espalha ~20 leituras de `body.*` em `buildPromptVariables`, `buildCommercialRepertoire` e na montagem do `ImageReviewInput`. Não existe um ponto único de contrato — são **4 costuras** hoje (rota/snapshot, prompts, copy, review), e a ponte do `productImageDataUrl` para provider/validação está implícita dentro delas (a D11 a formaliza como costura explícita).
- Dos 21 campos do schema, ~11 estão "adormecidos" no formulário (`use-campaign-form.ts:625` só envia `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext`, `mandatoryArtworkText`, `productImageDataUrl`) — mas `hook`, `cta`, `objective`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints` existem no schema **e nos prompts**.
- `validity` entra no prompt via **heurística frágil** em `buildCommercialRepertoire` (`src/lib/image-generation/services/image-generation-service.ts:726-732`): só entra se a string contém `/`, `até` ou `válida`.
- `mandatoryArtworkText` é string livre; a semântica de "ligado" é confundida com "string não vazia" (fix `260804-s16` já espelha diretor↔revisor, mas a semântica continua string-based).
- Imagem única em todo o transporte (`productImageDataUrl`); não existe noção de `role`, `source` (upload/câmera) nem lista.
- Único cliente real é o próprio form (+ `scripts/benchmark.ts` e testes). A rota já fez breaking change ao rejeitar campos legados de identidade (`route.ts:95-103`).

Esta fase cria o **contrato de domínio estruturado** `CampaignBrief` (produto × oferta × mídia × contexto criativo × metadados) e **5 costuras de mappers + builder de snapshot** para que o pipeline consuma o domínio **sem reescrever a rota** e **sem mudar o comportamento atual de geração**.

## Goals / Non-Goals

**Goals:**
- Criar o tipo `CampaignBrief` agrupado por domínio (produto/oferta/mídia/aviso legal/contexto criativo/metadados), separando **dados estáveis de produto** de **dados promocionais da campanha** (D3)
- Renomear o wrapper atual para `ResolvedCampaignContext` — eliminando a colisão de 3 "briefs" (D4)
- Mapper `flat → CampaignBrief` na fronteira da rota; pipeline passa a consumir o brief estruturado (D5/D11)
- Snapshot `input_snapshot` versionado (`campaign_brief_v1`) com seções por domínio; **nunca** contém base64 (D6)
- `media.images[]` com `role`/`source`/`mimeType` — 1 imagem `primary` nesta fase (D7)
- `commercial.validity` e `commercial.legalNotice` estruturados, com mapeamento para campos/prompts atuais (D8/D9)
- `creativeContext.themeId?` reservado (D10)
- 5 costuras de mappers + builder de snapshot preservando o comportamento de geração atual (D11)
- Testes de contrato obrigatórios (D12); `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

**Non-Goals:**
- **Catálogo de produtos por loja** (persistência, storage de imagens, CRUD/seleção, reuso, edição, histórico, deduplicação, ownership) — decisão arquitetural futura explícita (D3); `source`/`catalogProductId?` são apenas contrato reservado
- **Múltiplas imagens completas na UI** e **captura de câmera** — contrato pronto (D7), implementação em fase própria
- **Revisão pré-geração** e **aprovação pós-geração (F37)** — F37 é a próxima fase (D2) e consome o snapshot desta fase
- **CRUD de temas / direção visual de tema / `themeSnapshot`** — `themeId?` reservado (D10)
- **Migrar o form para enviar payload estruturado** — Opção 1 (D5): form continua flat nesta fase
- **Refatoração grande da rota de geração** — só a camada de input muda de shape (D11)
- **CHECK no banco para `schemaVersion`** — JSONB tolerante + validação TS/testes (D6)
- **Pacotes de crédito / precificação pública** — F40 (Stripe)
- NENHUMA migration SQL nesta fase

## Decisions

### D1 — Numeração: F39 = Brief Estruturado de Campanha (v1.5), Stripe → F40 (v1.7) + runbook de trackings

`DECIDIDO` (Q&A — precedente F37 D11: a fase conflitante é incrementada, não apagada)

- F39 = **Brief Estruturado de Campanha** (nova, v1.5); **Stripe / Monetização Pública → F40** (v1.7, pós-beta).
- **Runbook de atualização dos trackings** (aplicar nesta fase, na ordem):
  1. `ROADMAP.md` (raiz): linha 39 → "Brief Estruturado de Campanha | v1.5 | 0/0 | ○ Pending"; adicionar linha 40 → "Stripe / Monetização Pública | v1.7 | 0/0 | ○ Pending"; menções "F39 (Stripe)" → "Stripe (F40)"; bullet da F39 no `<details open>` do v1.5.
  2. `.planning/ROADMAP.md`: nota "Phase numbering" (linha 7) com F39/F40; tabela Progress; notas de renumeração (~405/466); menções "Phase 39 (Stripe)" em Dependencies (~570/616/644/661) → F40; Dependency Graph (~734); seção "### Phase 39 — Brief Estruturado de Campanha"; rodapé "Last updated".
  3. `.planning/STATE.md`: `current_phase: 39`, status F39; tabela "Next Phases" (F39 in progress, F40 future renumerada); corpo + "Last updated".
  4. `.planning/PROJECT.md`: "Stripe... adiado para F39 (v1.7)" → **F40** (linha 48); rodapé.
  5. `.planning/REQUIREMENTS.md`: seção v1.7 "Stripe... F39/v1.7" → **F40/v1.7** (~563-565).
  6. `.planning/MILESTONES.md`: "diferido para v1.7 (F39)" → **(F40)** (linha 20).
- Artefatos históricos não são reescritos; `openspec/changes/fase-39-brief-estruturado-campanha/` é a fonte da verdade da fase.

### D2 — Sequenciamento: v1.5, antes da F37

`DECIDIDO` (Q&A)

- F39 entra antes da F37 (Revisão e Aprovação da Arte). F37 **consome o snapshot** estruturado para pré-revisão/aprovação pós-geração e reconstrói o brief **semântico** (produto/oferta/legal/validade).
- **Ressalva:** o snapshot é **sem base64** — NÃO garante regeração fiel com a imagem original do produto. Se a F37 precisar regenerar com a imagem original, dependerá de **asset persistido** (a criar/consumir na F37).
- O v1.5 não está fechado enquanto F37 estiver pendente.

### D3 — Produto separado de Oferta + decisão arquitetural futura (catálogo)

`DECIDIDO` (recomendação do usuário)

- **Princípio estrutural:** a campanha entende "produto" como domínio **separado** de "oferta". Dados estáveis de produto não se misturam com dados promocionais:
  - `product`: `source: "manual" | "catalog"`, `catalogProductId?`, `name`, `brand?`, `sizeOrVariant?`, `description?` — dados **textuais/semânticos** do produto; as imagens vivem em `media.images` (D7), não em `product`.
  - `commercial`: `offerPrice`, `originalPrice?`, `validity?`, `legalNotice?`, `availabilityNotes?`, `badgeText?`.
- `source: "manual"` é o padrão atual (upload avulso); `source: "catalog"` é **contrato reservado** (só `manual` é produzido nesta fase). `catalogProductId?` não aponta tabela alguma nesta fase.
- **Persistência de produtos por loja = fase subsequente explícita** (consumirá este contrato).
- **Regra de snapshot fundamental:** a campanha **sempre armazena snapshot do produto/oferta usados na geração** — nunca depende do produto "vivo" do catálogo. Produto do catálogo editado depois não altera campanhas antigas.

### D4 — Novo `CampaignBrief` (domínio estruturado) + rename do wrapper atual para `ResolvedCampaignContext`

`DECIDIDO` (resolução da colisão de nomeação)

| Conceito | Antes | Depois |
|----------|-------|--------|
| Domínio estruturado | — | **`CampaignBrief`** (novo) — `src/lib/campaign/brief.ts` |
| Wrapper de transporte | `CampaignBrief` (`src/components/campaign/types.ts:37`) | **`ResolvedCampaignContext`** |
| Campo de direção de marca | `brand_profile.campaign_brief` | inalterado (string) |

- `buildCampaignBrief` (`src/lib/store-identity-service.ts`) passa a retornar `ResolvedCampaignContext`; o `CampaignBrief` estruturado é montado pelo mapper da rota (D5/D11).
- Callers que consomem o wrapper atual continuam recebendo `ResolvedCampaignContext` com o **mesmo shape** (teste de contrato 25).

### D5 — Opção 1: transporte flat mantido, mapper na fronteira da rota

`DECIDIDO` (Q&A — "Opção 1 agora")

- **Nesta fase o form não muda** — continua enviando flat. A rota converte flat→`CampaignBrief` **uma única vez** na fronteira.
- **Sem contrato duplo eterno:** flat = transporte (contrato HTTP); brief = domínio (contrato interno). Migração do form acontece na fase que precisar dele (múltiplas imagens/câmera).
- **Co-migração de testes:** fixtures de `route.test.ts`, `image-generation-service.test.ts`, `image-review-service.test.ts` e `scripts/benchmark.ts` atualizados na mesma fase.
- Regra de borda preservada: `productImageDataUrl` ausente → 400 (imagem obrigatória).

### D6 — Snapshot versionado estruturado (`campaign_brief_v1`)

`DECIDIDO` (formalização do que já é parcialmente verdade + estruturação)

```ts
input_snapshot: {
  schemaVersion: "campaign_brief_v1",   // canônico no ROOT
  product: { source: "manual", name: string, description?: string },
  commercial: {
    intent, originalPriceCents?, discountedPriceCents?, badgeText?,
    validity?: { enabled, displayText?, endDate? },
    legalNotice?: { enabled, text? },       // vive APENAS dentro de commercial (D9)
    availabilityNotes?,
  },
  media: { images: [ { id, role: "primary", source: "upload", mimeType, provided: true } ] },  // CampaignBriefSnapshotImage — sem dataUrl (D7)
  creativeContext: { preserveImageContext?: boolean, themeId?: string | null },
  metadata: { source: "web_form" | "api" },  // SEM schemaVersion aqui — canônico no ROOT
}
```

- **Base64 nunca entra no snapshot** — garantido por teste de contrato (varredura recursiva de chaves) e **por tipo** (`CampaignBriefSnapshotImage` não tem campo `dataUrl`).
- **Versão canônica no ROOT** do snapshot persistido; `metadata.schemaVersion` existe **apenas no brief runtime** (`CampaignBrief`), sem duplicação no snapshot.
- **Sem CHECK no banco** nesta fase: `input_snapshot` continua `jsonb` tolerante; validação no TS (escrita) + testes de contrato. Se a F37 exigir, um CHECK entra lá (padrão F38.2.1).
- **Dois tipos de imagem:** `CampaignProductImageInput` (brief runtime — pode carregar `dataUrl`) **≠** `CampaignBriefSnapshotImage` (snapshot — só `id`/`role`/`source`/`mimeType`/`provided`; `storagePath?`/`productAssetId?` reservados). Snapshot serializado **sempre** com o tipo de snapshot — impossível vazar base64 por serializar o objeto errado.

### D7 — Contrato de mídia: `media.images[]` com role/source

`DECIDIDO` (preparação para múltiplas imagens e câmera — sem implementá-las)

```ts
images: [
  {
    id: string;                    // uuid gerado na montagem do brief
    role: "primary" | "variation" | "combo_item" | "reference";
    source: "upload" | "camera";
    mimeType: string;              // ex.: "image/jpeg"
    dataUrl?: string;              // APENAS no transporte, nunca no snapshot
  }
]
```

- **Regra:** sempre existe exatamente **1 imagem `primary`**. Validação de produto×imagem futura parte dessa invariante.
- **Nesta fase:** transporte continua aceitando 1 imagem (via `productImageDataUrl`); o mapper produz `media.images = [{ role: "primary", source: "upload", ... }]`. Rejeição sem imagem mantida (400).
- **Sem UI de múltiplas imagens, sem câmera** nesta fase.

### D8 — Validade estruturada (`commercial.validity`)

`DECIDIDO` (substitui a heurística frágil de string)

```ts
validity: {
  enabled: boolean;
  displayText?: string;   // texto exibido na arte/copy (beta começa com este)
  endDate?: string;       // data ISO opcional — reservada, ainda sem UI
}
```

- O mapper converte `validity` (string atual) → `validity.displayText`; `buildCommercialRepertoire` deixa de depender de heurística (`/`, `até`, `válida`) e decide por `enabled` + `displayText`.
- Sem string no transporte → `validity` **ausente** no contrato e no snapshot (regra canônica: campo não informado → ausente; nunca `enabled: false` fabricado — `enabled: false` só existirá com estado explícito futuro).
- `endDate` é contrato reservado (decisão de UI futura).

### D9 — Aviso ilustrativo estruturado (`commercial.legalNotice`)

`DECIDIDO` (substitui a semântica de string solta)

```ts
legalNotice: {
  enabled: boolean;
  text?: string;           // ex.: "Imagem meramente ilustrativa"
}
```

- **Regra:** `enabled=false` → **nada entra na arte** (nem prompt, nem revisão).
- O mapper preserva compat: `mandatoryArtworkText` (transporte) → `legalNotice.text`; prompts e revisor continuam recebendo o texto como antes (fix `260804-s16` mantido).
- **Campo canônico único:** `legalNotice` vive **apenas** em `commercial.legalNotice`. **Não há espelho** em `CampaignBrief` — leitura direta futura (F37) via **helper** `getCampaignLegalNotice(brief)`.

### D10 — Preparação para temas (`creativeContext.themeId?`)

`DECIDIDO` (reserva de encaixe, sem especular)

- `creativeContext.themeId?: string | null` nasce no contrato, sempre `null` nesta fase.
- **Nenhum sistema de temas** (CRUD, direção visual, `themeSnapshot`) é criado aqui.

### D11 — Mappers para o pipeline (5 costuras + builder de snapshot) — o núcleo do esforço

`DECIDIDO` (o coração da fase; sem reescrever a rota inteira)

```
flat payload (transporte)
        │  mapper #1 (fronteira da rota)
        ▼
CampaignBrief (domínio)
        │
        ├── mapper #2 → ImageGenerationService (prompt vars / repertoire)
        ├── mapper #3 → provider / input-validation (media.primary.dataUrl)
        ├── mapper #4 → CopyDirectorInput (mapBriefToCopyDirectorInput)
        ├── mapper #5 → ImageReviewInput (revisor)
        └── builder   → input_snapshot (campaign_brief_v1)
```

1. **flat → `CampaignBrief`** — na rota, único ponto de conversão (D5). `buildCampaignBriefFromFlat(input, storeId, source = "web_form")`.
2. **`CampaignBrief` → prompts** — `buildPromptVariables`/`buildCommercialRepertoire` passam a ler `brief.product`, `brief.commercial`, `brief.media` em vez de `body.*`. O conjunto de variáveis de prompt **permanece idêntico** para o mesmo input (regressão garantida por golden tests por intent).
3. **`CampaignBrief` → provider/input-validation** — ponte explícita `brief.media.primary.dataUrl` para o **provider de imagem** e para o **`InputValidationService`/revisor de visão** (hoje lê `productImageDataUrl` direto). O base64 vive **só em memória/transporte** (tipo runtime `CampaignProductImageInput`); o snapshot nunca o expõe (D6/D7).
4. **`CampaignBrief` → copy** — `mapBriefToCopyDirectorInput` lê do domínio; saída `CopyDirectorInput` inalterada.
5. **`CampaignBrief` → review** — `ImageReviewInput` (revisor) montado a partir do domínio, incluindo `legalNotice` e `validity`.
6. **`CampaignBrief` → snapshot** — `buildCampaignBriefSnapshot(brief)` deriva as imagens **do próprio brief** (não recebe imagem externa — evita divergência de id com `brief.media.images`), removendo `dataUrl` e produzindo `CampaignBriefSnapshotImage` (D6/D7).

- **Comportamento preservado:** para o mesmo payload flat de hoje, o pipeline gera o mesmo prompt/copy/review. Verificação por testes de contrato + regressão completa.
- **Sem refatoração grande da rota:** a orquestração (crédito, rate limit, clearance, stream, telemetria) **não muda** — só a camada de input muda de shape.

### D12 — Testes de contrato

`DECIDIDO` (obrigatórios nesta fase)

Cobertura mínima (~34+ testes): brief mínimo válido; oferta com preço+validade; aviso ilustrativo marcado/desmarcado; uma imagem principal; rejeição sem imagem; **snapshot nunca contém dataUrl/base64** (por tipo `CampaignBriefSnapshotImage`, não só por convenção); round-trip flat→brief→snapshot; **ponte provider/input-validation com `media.primary.dataUrl`**; mappers preservam comportamento atual; compat com payload atual (benchmark).

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Regressão pesada em mocks** — `route.test.ts` tem dezenas de `mockResolvedValue({ campaignInput: {}, store: {} })`; `image-generation-service.test.ts` e `image-review-service.test.ts` montam briefs flat | Atualizar fixtures **na mesma fase** (co-migração, D5); testes de contrato comparando variáveis de prompt antigas × novas (golden tests por intent) |
| **Contrato duplo eterno** (flat aceito para sempre + brief estruturado) | Não há promessa de compat eterna (D5): flat é transporte; a migração do form acontece na fase que precisar (múltiplas imagens/câmera) |
| **Mudar o shape interno quebra o pipeline silenciosamente** | Mappers preservam comportamento (D11); verificação por golden tests de prompt + regressão completa |
| **Colisão de nomeação (3 "briefs")** | Resolvida na D4 (`CampaignBrief` = domínio; wrapper atual → `ResolvedCampaignContext`; `campaign_brief` do Brand Profiler inalterado) |
| **Base64 vazar no snapshot** | Já ausente hoje; formalizado com teste de contrato (D6) + tipo `CampaignBriefSnapshotImage` sem campo `dataUrl` por construção (D7) |
| **Escopo crescer para catálogo de produtos** | Bloqueado pela D3: catálogo é fase subsequente explícita; `source`/`catalogProductId?` são apenas contrato reservado |
| **F37 (revisão/aprovação) quebrar por mudança de snapshot** | F39 é pré-requisito da F37 (D2); F37 consome o snapshot versionado novo; sem gate retroativo |
| **Campos adormecidos (hook/cta/objective/etc.) mudarem de semântica na estruturação** | São mantidos no contrato (`commercial`/`creativeContext`) com mapeamento 1:1; prompts continuam recebendo as mesmas variáveis |
| **`metadata.schemaVersion` confundido entre runtime e snapshot** | Canônico no ROOT do snapshot; `metadata.schemaVersion` existe **apenas** no brief runtime — nomeado/testado com clareza (teste de contrato: snapshot NÃO tem `metadata.schemaVersion`) |

## Migration Plan

**Migration SQL:** NENHUMA (D6). `input_snapshot` continua `jsonb` tolerante; a validação de shape/versão acontece no TS (escrita) + testes de contrato. Se a F37 exigir garantia no banco, um CHECK de `schemaVersion` entra lá (decisão posterior, padrão F38.2.1).

**Deploy:** migrations inexistentes + código no mesmo PR (padrão Vercel). Rollback: reverter o commit — não há mudança de schema de banco; campanhas antigas (pré-F39) com `input_snapshot` flat continuam exibindo/baixando normalmente (sem migração destrutiva).

**Trackings (D1 — runbook):** aplicar atualizações em `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md` na ordem listada na D1.

## Open Questions

- **Nenhuma bloqueante.** Decisões explícitas registradas no alinhamento: catálogo de produtos é fase subsequente (D3); F37 consome o snapshot e criará asset persistido se precisar regenerar com a imagem original (D2); sem CHECK no banco nesta fase (D6); `metadata.schemaVersion` só existe no runtime (D6).
