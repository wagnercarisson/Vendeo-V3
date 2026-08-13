# Alinhamento Fase 39 — Brief Estruturado de Campanha (v1.5)

> **Renumeração (esta fase):** F39 = **Brief Estruturado de Campanha** (nova, v1.5). Stripe / Monetização Pública deslocada de F39 para **F40** (v1.7, pós-beta — segue o precedente de renumeração da F37 D11: a fase conflitante é incrementada, não apagada). A atualização dos trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) está documentada como runbook na seção **D1** deste documento — os próximos agentes devem seguir esse roteiro ao planejar/executar a fase.
>
> **Decisão arquitetural futura explícita (D3):** o contrato do brief **separa dados estáveis de produto de dados promocionais da campanha** e nasce preparado para origem **manual ou catálogo futuro** (`product.source` / `product.catalogProductId?`). A **persistência de produtos por loja** (tabela, storage de imagens, CRUD/seleção no fluxo, reuso, edição, histórico, deduplicação) será uma **fase subsequente** que consome este contrato — **não entra nesta fase**. Campanhas sempre armazenam **snapshot imutável** do produto/oferta usados na geração: o produto do catálogo pode mudar depois **sem alterar campanhas antigas**.

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                       ✓
  ├── F31.1 — Modelo Comercial — Formulário                      ✓
  ├── F31.2 — Diretores por Intenção                             ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                             ✓
  ├── F33 — Verificação CNPJ Freemium                            ✓
  ├── F34 — Prontidão de Loja para Geração (Store Readiness)     ✓
  ├── F35 — Changelog / Novidades                                ✓
  ├── F36 — Onboarding: Navegação por Abas                       ✓
  ├── F38 — Tabela de Custos por Operação                        ✓
  ├── F38.1 — Apuração de Custos de IA por Entrega               ✓
  ├── F38.2 — Admin de Custos + Config. Econômicas               ✓
  ├── F38.2.1 — Snapshot Econômico                               ✓
  ├── F39 — Brief Estruturado de Campanha                        ← esta fase
  ├── F37 — Revisão e Aprovação da Arte                          ○ depois desta (consome o snapshot)
  │        (experimento controlado beta, human-in-the-loop)
  └── F40 — Stripe / Monetização Pública                         ○ v1.7, pós-beta (renumerada de F39)

Depois desta fase (sequenciamento recomendado):
  F39 (brief) → F37 (revisão/aprovação) → [catálogo de produtos — fase futura] → F40 (Stripe)
```

O Vendeo hoje recebe o input da campanha como um **payload flat de 21 campos** (`GenerateImageRequestSchema`, zod `.strict()`), resolve a identidade da loja no backend, monta o que é chamado de `CampaignBrief` (um wrapper de transporte: input flat + identidade + brand profile) e passa esse wrapper direto para o pipeline paralelo (Copy Director ∥ Image Director → revisão → persistência). O `input_snapshot` da campanha é um `Record<string, unknown>` flat.

**Estado real em código (explorado nesta fase):**

- **O snapshot já não guarda base64** (`src/app/api/campaign/generate-image/route.ts:357-380`): grava `productImage: { provided: true, mimeType: "image/jpeg" }` e descarta o `productImageDataUrl`. O gap real não é vazamento de base64 — é a **estrutura flat e não versionada** do snapshot.
- **Existem TRÊS conceitos de "brief" no código** (colisão de nomeação — resolvida na D4):
  1. `brand_profile.campaign_brief` → texto gerado por IA no Brand Profiler (direção de marca);
  2. `CampaignBrief` (`src/components/campaign/types.ts:37`) → wrapper atual de transporte: `{ campaignInput, store, brandProfile, identity }`;
  3. o `CampaignBrief` estruturado por domínio proposto nesta fase.
- **O pipeline inteiro lê o corpo flat diretamente.** `ImageGenerationService` faz `const body = brief.campaignInput as GenerateImageRequest` (`src/lib/image-generation/services/image-generation-service.ts:95`) e espalha ~20 leituras de `body.*` em `buildPromptVariables`, `buildCommercialRepertoire` e na montagem do `ImageReviewInput`. Não existe um ponto único onde o contrato estruturado entraria — existem **4 costuras** hoje (rota/snapshot, prompts, copy, review), sendo que a ponte do `productImageDataUrl` para o provider/validação está **implícita** dentro delas; a D11 a formaliza como **5ª costura explícita**.
- **Dos 21 campos do schema, ~11 estão "adormecidos" no formulário.** O form (`src/components/flow/use-campaign-form.ts:625`) só envia: `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext`, `mandatoryArtworkText`, `productImageDataUrl`. Mas `hook`, `cta`, `objective`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints` estão no schema **e nos prompts** (`prompts/campaign-image-director-*.md`) mesmo sem UI.
- **`validity` entra no prompt via heurística frágil** em `buildCommercialRepertoire` (`src/lib/image-generation/services/image-generation-service.ts:726-732`): só entra se a string contém `/`, `até` ou `válida`. Um campo estruturado torna isso determinístico.
- **`mandatoryArtworkText`** é string livre; a semântica de "ligado" é confundida com "string não vazia". O fix `260804-s16` já espelha o campo diretor↔revisor, mas a semântica continua string-based.
- **Imagem única em todo o transporte:** `productImageDataUrl` é uma string base64; não existe noção de `role`, `source` (upload/câmera) nem lista de imagens.
- **Único cliente real é o próprio form** (+ `scripts/benchmark.ts` e testes simulando payloads). Não há API pública — a rota já fez breaking change ao rejeitar campos legados de identidade (`route.ts:95-103`). Isso reduz o valor de "compatibilidade eterna" e permite co-migrar form + rota + testes numa tacada quando necessário.

---

## Propósito

1. **Contrato de domínio estruturado** — criar o tipo `CampaignBrief` agrupado por domínio (produto / oferta / mídia / aviso legal / contexto criativo / metadados), separando **dados estáveis de produto** de **dados promocionais da campanha** (D3). É o contrato central que as fases seguintes (F37, catálogo de produtos, temas, múltiplas imagens, câmera) consomem sem retrabalho.
2. **Produto entendido como domínio separado da oferta** — `product` carrega dados estáveis **textuais/semânticos** (nome, `brand?`, `sizeOrVariant?`, `description?`, `source`, `catalogProductId?`); **`media` carrega as imagens do produto** (`media.images`); `commercial` carrega o que é promocional (preços, validade, aviso legal, disponibilidade). Isso resolve o problema estrutural do flat atual e deixa a porta aberta para reuso via catálogo.
3. **Preparação para produto salvo (catálogo) sem implementá-lo** — `product.source: "manual" | "catalog"` + `product.catalogProductId?` nascem no contrato. A persistência de produtos por loja é **fase subsequente** (D3), mas o contrato já está pronto para ela — evitando construir catálogo sobre um contrato flat frágil, sem transformar esta fase numa fase de produto/storage/biblioteca.
4. **Snapshot versionado e auditável** — `input_snapshot` passa a ser estruturado com `schemaVersion: "campaign_brief_v1"` e seções por domínio. Imutável, **nunca contém dataUrl/base64**. Base para a F37 (revisão/aprovação) e para auditoria de cada geração.
5. **Preparação para múltiplas imagens** — `media.images: CampaignProductImageInput[]` com `role` (`primary`/`variation`/`combo_item`/`reference`) e `source` (`upload`/`camera`). Nesta fase aceita **apenas 1 imagem** (`primary`), mas já no formato de lista — o transporte (string única) e o snapshot (marcador único) evoluem sem quebra estrutural depois.
6. **Validade estruturada** — `commercial.validity: { enabled, displayText?, endDate? }`, substituindo a heurística frágil de string por semântica determinística no prompt/copy.
7. **Aviso ilustrativo estruturado** — `commercial.legalNotice: { enabled, text? }`, substituindo a string solta `mandatoryArtworkText` por semântica explícita (`enabled=false` → nada entra na arte).
8. **Preparação para temas** — `creativeContext.themeId?: string | null` reservado; nenhum sistema de temas é criado nesta fase.
9. **Mappers para o pipeline atual** — 5 costuras de adaptação (flat→brief, prompts, **provider/input-validation**, copy, review) + builder de snapshot para que o pipeline consuma o contrato estruturado **sem reescrever a rota inteira** e **sem mudar o comportamento atual** de geração. A ponte `media.primary.dataUrl → provider/input-validation` é costura explícita (D11): base64 vive **só em memória/transporte**, nunca no snapshot.

**Entrega verificável:**
- Novo tipo `CampaignBrief` (domínio estruturado) + rename do wrapper atual para `ResolvedCampaignContext` (D4)
- Mapper `flat → CampaignBrief` na fronteira da rota (`POST /api/campaign/generate-image`); pipeline passa a consumir o brief estruturado (D5/D11)
- Ponte `media.primary.dataUrl → provider/input-validation` — base64 **só em memória/transporte** (D11); snapshot usa tipo `CampaignBriefSnapshotImage` (D7)
- Snapshot `input_snapshot` versionado (`campaign_brief_v1`) com seções `product` / `commercial` / `media` / `creativeContext` / `metadata` (legalNotice vive dentro de `commercial` — D9); **nunca** contém base64 (D6)
- `media.images[]` com `role`/`source`/`mimeType` — aceitando 1 imagem `primary` no transporte atual (D7)
- `commercial.validity` e `commercial.legalNotice` estruturados, com mapeamento para os campos/prompts atuais (D8/D9)
- `creativeContext.themeId?` reservado (D10)
- Testes de contrato (brief mínimo, oferta+validade, aviso on/off, imagem principal, rejeição sem imagem, snapshot sem base64, round-trip flat→brief, mappers preservam comportamento atual) (D12)
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Estado Atual / Base Para F39

```
                                                ESTADO ATUAL                    DEPOIS (F39)
═══════════════════════════════════════════════════════════════════════════════════════════════

Contrato de entrada:
  Transporte                           payload flat (21 campos, zod strict)   payload flat MANTIDO
                                        GenerateImageRequestSchema             (Opção 1 — D5)
  Domínio interno                      CampaignBrief (wrapper flat +           CampaignBrief (domínio
                                       identidade) → consumido direto          estruturado) + mapper
                                                                               na rota; wrapper atual
                                                                               vira ResolvedCampaignContext

Produto × Oferta:
  Separação                           inexistente (campos flat misturados)    product (estável) ×
                                                                               commercial (promocional)
  Origem do produto                   implícita (só upload de imagem)          product.source:
                                                                               "manual" | "catalog"
                                                                               product.catalogProductId?
                                                                               (sem persistência nesta fase)

Snapshot:
  Estrutura                           Record<string, unknown> flat             versionado (campaign_brief_v1)
                                                                               product/commercial/media/
                                                                               creativeContext/metadata
  Base64 no snapshot                  já ausente (só marcador)                 formalizado + teste de contrato
  versionamento                       inexistente                              schemaVersion no snapshot

Imagens:
  Transporte                          productImageDataUrl (string única)       media.images[] (lista; 1 item
                                                                               primary aceito nesta fase)
  role/source                         inexistente                              role: primary|variation|
                                                                               combo_item|reference
                                                                               source: upload|camera

Domínios semânticos:
  Validade                            string livre + heurística no prompt      commercial.validity
                                                                               { enabled, displayText?, endDate? }
  Aviso ilustrativo                   mandatoryArtworkText (string livre)      commercial.legalNotice
                                                                               { enabled, text? }
  Tema                                inexistente                              creativeContext.themeId? (null)
  Metadados                           inexistente                              metadata { source } (schemaVersion no root)

Consumo no pipeline:
  ImageGenerationService              lê brief.campaignInput (flat)            lê brief.product/commercial/media
  Copy mapper                         mapBriefToCopyDirectorInput (flat)       lê brief.product/commercial
  Review input                        ImageReviewInput (flat)                  lê brief + legalNotice/validity
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F39) |
|------|-------------------|------------------|
| **Compatibilidade com input atual (mapper flat→brief)** | "rota continua aceitando o formato antigo por enquanto, com mapper" | **Opção 1 confirmada**: o form continua enviando flat **nesta fase**; a rota converte flat→`CampaignBrief` na fronteira e o pipeline passa a consumir o brief. **Sem contrato duplo eterno**: o flat é transporte, o brief é domínio; a migração do form para enviar o brief estruturado acontece na fase que precisar dele (múltiplas imagens/câmera). Sem promessa de compat "para sempre" — co-migração quando fizer sentido |
| **Snapshot persistido melhor** | "salvar o brief estruturado, sem base64 bruto" | **Já é verdade (base64 ausente)** — formalizar com `schemaVersion` + estrutura + teste de contrato "snapshot nunca tem dataUrl". Sem CHECK no banco nesta fase (JSONB tolerante; validação no TS + testes) |
| **`CampaignBrief` (nome)** | "criar tipo explícito CampaignBriefInput" | **Novo `CampaignBrief` assume o nome** (conceito certo); o wrapper atual (`campaignInput + identidade`) é **renomeado para `ResolvedCampaignContext`** — elimina a colisão com `brand_profile.campaign_brief` (D4) |
| **Produto persistido (catálogo)** | "persistência real de produtos por loja" | **DECISÃO ARQUITETURAL FUTURA EXPLÍCITA (D3)**: separar produto de oferta no contrato, `source`/`catalogProductId?` nascem; **persistência/catálogo é fase subsequente**, fora desta. "Junto no desenho, depois na implementação" |
| **Imagem principal explícita** | "definir que sempre existe primary" | `media.images[]` com pelo menos 1 `role: "primary"`; rejeição sem imagem mantida; validação produto×imagem futura fica destravada |
| **Validade** | "entrar como domínio comercial estruturado" | `commercial.validity { enabled, displayText?, endDate? }`; beta começa com `displayText`; remove heurística do prompt |
| **Aviso ilustrativo** | "trocar mandatoryArtworkText por algo semântico" | `commercial.legalNotice { enabled, text? }`; `enabled=false` → nada na arte; mapper mantém compat com o campo/prompt atual |
| **Temas** | "preparar o encaixe" | `creativeContext.themeId?` apenas (nullable); sem tema nesta fase |
| **Mappers para o pipeline** | "4 funções de adaptação" | **É o coração do esforço** (D11): flat→brief na rota; brief→prompt vars; **brief→provider/input-validation (base64 em memória)**; brief→copy; brief→review. Comportamento de geração preservado (testes de regressão) |
| **Numeração** | "sugiro fase 39" | F39 já era Stripe nos trackings → **Brief = F39, Stripe → F40** (precedente F37 D11); runbook D1 |

---

## Decisões de Alinhamento

### D1 — Numeração: F39 = Brief Estruturado de Campanha (v1.5), Stripe → F40 (v1.7) + runbook de trackings

`DECIDIDO` (Q&A — "Brief = F39, Stripe → F40 (Recommended)")

| Antes | Depois |
|-------|--------|
| F39 = Stripe / Monetização Pública (v1.7, pós-beta) | **F39 = Brief Estruturado de Campanha** (nova, v1.5) |
| — | **F40 = Stripe / Monetização Pública** (v1.7, pós-beta) |

Segue o precedente da F37 (D11): a fase conflitante é **incrementada** (não apagada), e o alinhamento registra a decisão.

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 39 → "Brief Estruturado de Campanha | v1.5 | 0/0 | ○ Pending"; adicionar linha 40 → "Stripe / Monetização Pública | v1.7 | 0/0 | ○ Pending". Atualizar menções a "F39 (Stripe)" (linhas ~57/62 do summary v1.5) para "Stripe (F40)". Adicionar bullet da F39 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering" (linha 7): "F39 = Brief Estruturado de Campanha (v1.5), F40 = Stripe/Monetização Pública (v1.7)". Linha da tabela Progress 39 → Brief; adicionar linha 40 → Stripe. Atualizar notas de renumeração (linhas ~405/466) e as menções "Phase 39 (Stripe)" em Dependencies (linhas ~570/616/644/661) → F40. Atualizar Dependency Graph (linha ~734). Adicionar seção "### Phase 39 — Brief Estruturado de Campanha" (goal/deps/source). Atualizar rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 39`, `status: Phase 39 (Brief Estruturado de Campanha)`. Tabela "Next Phases": F39 → "○ In progress — Brief Estruturado de Campanha (v1.5)"; F40 → "○ Future — Stripe / Monetização Pública (v1.7, pós-beta, renumerada de F39)". Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Linha 48: "Stripe / compra real de créditos: adiado para F39 (v1.7)" → **F40**. Rodapé "Last updated" (linha ~306) |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7 (linha ~563-565): "Stripe será implementada como F39/v1.7" → **F40/v1.7** |
| 6 | `.planning/MILESTONES.md` | Linha 20: "Stripe / Monetização Pública diferido para v1.7 (F39)" → **(F40)** |

**Regras gerais (padrão F37 D11):**
- Artefatos históricos (alinhamentos F26–F38.x, quick-plans, CONTEXT de fases concluídas) **não são reescritos** — refletem o estado da época.
- O `openspec/changes/fase-39-brief-estruturado-campanha/` será a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele.
- Renumeração de fases futuras segue a regra: a fase conflitante é incrementada (não apagada).

---

### D2 — Sequenciamento: v1.5, antes da F37

`DECIDIDO` (Q&A — "v1.5, antes da F37 (Recommended)")

- A F37 (Revisão e Aprovação da Arte) **consome o snapshot** estruturado para pré-revisão/aprovação pós-geração e reconstrói o brief **semântico** (dados de produto/oferta/legal/validade). **Ressalva:** como o snapshot é **sem base64**, ele NÃO garante regeração fiel com a imagem original do produto — se a F37 precisar regenerar com a imagem original, ela dependerá de um **asset persistido** (que a F37 criará/consumirá) ou criará essa persistência na F37. Sequência correta: **F39 (brief) → F37**.
- O v1.5 (Lançamento Externo Controlado) **não está fechado** enquanto F37 estiver pendente; a F39 entra antes dela.
- **Catálogo de produtos** (persistência real) fica para **fase subsequente** à F39 — o brief é o pré-requisito de contrato, mas a implementação do catálogo não é escopo da F39 (D3).

---

### D3 — Produto separado de Oferta + decisão arquitetural futura (catálogo)

`DECIDIDO` (recomendação do usuário — "persistência de produtos não deve vir antes do brief, mas precisa entrar no alinhamento agora")

**Princípio estrutural:** a campanha entende "produto" como domínio **separado** de "oferta". Dados estáveis de produto **não se misturam** com dados promocionais:

```
product: {
  source: "manual" | "catalog";
  catalogProductId?: string;     ← referência futura ao catálogo da loja
  name: string;
  brand?: string;
  sizeOrVariant?: string;
  description?: string;
  images: CampaignProductImageInput[];
}

commercial: {
  offerPrice: ...;
  originalPrice?: ...;
  validity?: ...;
  legalNotice?: ...;
  availabilityNotes?: ...;
  badgeText?: ...;
}
```

- `source: "manual"` (padrão atual — upload avulso no formulário) e `source: "catalog"` (futuro — produto salvo da loja). Nesta fase **só `manual` é produzido**; `catalog` é contrato reservado.
- `catalogProductId?` **não aponta para tabela alguma nesta fase** — é o ponto de encaixe que a fase de catálogo ocupará.
- **Persistência de produtos por loja** (tabela, storage de imagens, CRUD/seleção no fluxo, reuso, edição, histórico, deduplicação, ownership por loja) é **fase subsequente explícita**, fora do escopo da F39 — consumirá este contrato.

**Fluxo ideal futuro (declarado para a fase de catálogo):**

```
Produto salvo da loja
        |
        v
Pré-preenche novo brief
        |
        v
Lojista ajusta oferta/preço/validade
        |
        v
Campanha salva snapshot imutável
        |
        v
Produto do catálogo pode mudar depois sem alterar campanha antiga
```

**Regra de snapshot (fundamental):** a campanha **sempre armazena snapshot do produto/oferta usados na geração** — nunca depende do produto "vivo" do catálogo. Se o produto do catálogo for editado depois, **campanhas antigas permanecem intactas** (mesma filosofia do `input_snapshot`/`identity_snapshot`/`render_snapshot` atuais e do snapshot econômico da F38.2.1).

---

### D4 — Novo `CampaignBrief` (domínio estruturado) + rename do wrapper atual para `ResolvedCampaignContext`

`DECIDIDO` (resolução da colisão de nomeação encontrada na exploração)

| Conceito | Antes | Depois |
|----------|-------|--------|
| Domínio estruturado por domínio | — | **`CampaignBrief`** (novo) — `src/lib/campaign/brief.ts` |
| Wrapper de transporte (input flat + identidade + brand profile) | `CampaignBrief` (`src/components/campaign/types.ts:37`) | **`ResolvedCampaignContext`** |
| Campo de direção de marca (Brand Profiler) | `brand_profile.campaign_brief` | inalterado (string) |

- O nome `CampaignBrief` passa a significar **o contrato de domínio estruturado** — o nome conceitualmente correto.
- O wrapper atual é literalmente "input resolvido + identidade": renomear para `ResolvedCampaignContext` preserva o papel dele no pipeline (é o que o `ImageGenerationService` recebe hoje).
- `buildCampaignBrief` (`src/lib/store-identity-service.ts`) passa a retornar `ResolvedCampaignContext`; um novo builder/conversor gera o `CampaignBrief` estruturado (D5/D11).

---

### D5 — Opção 1: transporte flat mantido, mapper na fronteira da rota

`DECIDIDO` (Q&A — "Opção 1 agora: form ainda envia flat, rota converte para brief estruturado")

```
FORM (flat, inalterado nesta fase)
  │  productName, prices, badge, intent, preserveImageContext,
  │  mandatoryArtworkText, productImageDataUrl
  ▼
POST /api/campaign/generate-image
  │  GenerateImageRequestSchema (flat — transporte)
  ▼
[MAPPER flat → CampaignBrief estruturado]        ← fronteira da rota (novo)
  │  product / commercial / media / creativeContext / metadata
  ▼
Pipeline consome CampaignBrief (prompt / provider / copy / review / snapshot)
```

- **Nesta fase o form não muda** — continua enviando flat. A rota converte **uma única vez** na fronteira.
- **Sem contrato duplo eterno:** o flat é o **transporte** (contrato HTTP); o brief é o **domínio** (contrato interno). A migração do form para enviar o brief estruturado acontece na **fase que precisar dele** (múltiplas imagens/câmera) — e aí o mapper flat→brief é substituído pelo payload estruturado, sem reescrever o pipeline.
- **Co-migração de testes:** fixtures de `route.test.ts`, `image-generation-service.test.ts`, `image-review-service.test.ts` e do `scripts/benchmark.ts` são atualizados **na mesma fase** — sem janela de compat dupla.
- Regra de borda preservada: `productImageDataUrl` ausente → 400 (imagem obrigatória).

---

### D6 — Snapshot versionado estruturado (`campaign_brief_v1`)

`DECIDIDO` (formalização do que já é parcialmente verdade + estruturação)

```ts
input_snapshot: {
  schemaVersion: "campaign_brief_v1",
  product: {
    source: "manual",                 // "catalog" reservado (D3)
    name: string,
    description?: string,
  },
  commercial: {
    intent,
    originalPriceCents?,
    discountedPriceCents?,
    badgeText?,
    validity?: { enabled, displayText?, endDate? },
    legalNotice?: { enabled, text? },
    availabilityNotes?,
  },
  media: {
    images: [
      { id, role: "primary", source: "upload", mimeType, provided: true }  // CampaignBriefSnapshotImage — sem dataUrl (D7)
    ],
  },
  creativeContext: {
    preserveImageContext?: boolean,
    themeId?: string | null,           // reservado (D10)
  },
  metadata: {
    source: "web_form" | "api",        // sem schemaVersion aqui — canônico no ROOT
  },
}
```

- **Base64 nunca entra no snapshot** — o `dataUrl` vive apenas no transporte (request) e é descartado na montagem do snapshot. Garantido por **teste de contrato** ("snapshot não contém dataUrl/base64").
- **Versão canônica no ROOT** (snapshot persistido): `schemaVersion: "campaign_brief_v1"` fica no **root** do snapshot. `metadata.schemaVersion` existe **apenas no brief runtime** (`CampaignBrief` mantém em `metadata`) — **sem duplicação no snapshot**. Evolução futura do shape é rastreável pela versão do root.
- **Sem CHECK no banco nesta fase:** `input_snapshot` continua `jsonb` tolerante; a validação do shape/versão acontece no TS (escrita) + testes de contrato. Se a F37 exigir garantia no banco, um CHECK de `schemaVersion` entra lá (decisão posterior, padrão F38.2.1).
- **Dois tipos de imagem (D6/D7):** `CampaignProductImageInput` (brief runtime — pode carregar `dataUrl`) **≠** `CampaignBriefSnapshotImage` (snapshot persistido — só `id`/`role`/`source`/`mimeType`/`provided`; `storagePath?`/`productAssetId?` reservados). O snapshot é **sempre** serializado com o tipo de snapshot — impossibilita vazar base64 por erro de serialização.
- O snapshot passa a ser a fonte para **F37** (**reconstituição do brief semântico** para revisão/auditoria) e para **auditoria** por geração. **Ressalva (D2):** o snapshot é **sem base64** — ele NÃO permite regeração fiel com a imagem original do produto. Se a F37 precisar regenerar com a imagem original, ela dependerá de um **asset persistido** (a criar/consumir na F37) — ver D2.

---

### D7 — Contrato de mídia: `media.images[]` com role/source

`DECIDIDO` (preparação para múltiplas imagens e câmera — sem implementá-las)

```ts
images: [
  {
    id: string;                          // uuid gerado na montagem do brief
    role: "primary" | "variation" | "combo_item" | "reference";
    source: "upload" | "camera";
    mimeType: string;                    // ex.: "image/jpeg"
    dataUrl?: string;                    // APENAS no transporte, nunca no snapshot
  }
]
```

- **Regra:** sempre existe exatamente **1 imagem `primary`**. Validação de produto×imagem futura (e combos/variações) parte dessa invariante.
- **Nesta fase:** o transporte continua aceitando 1 imagem (via `productImageDataUrl`); o mapper produz `media.images = [ { role: "primary", source: "upload", ... } ]`. **Rejeição sem imagem mantida** (400).
- **Dois tipos distintos (D6/D7):** `CampaignProductImageInput` (imagem do brief **em memória** — pode carregar `dataUrl` para gerar a imagem) **≠** `CampaignBriefSnapshotImage` (imagem do **snapshot persistido** — **nunca** carrega `dataUrl`; só `id`/`role`/`source`/`mimeType`/`provided`, com `storagePath?`/`productAssetId?` reservados para a fase de catálogo/F37). O snapshot é serializado **sempre** com o tipo de snapshot — impossibilita vazar base64 por serializar o objeto errado.
- **Sem UI de múltiplas imagens, sem câmera** nesta fase — o contrato já suporta, a implementação vem na fase própria.

---

### D8 — Validade estruturada (`commercial.validity`)

`DECIDIDO` (substitui a heurística frágil de string)

```ts
validity: {
  enabled: boolean;
  displayText?: string;      // texto exibido na arte/copy (beta começa com este)
  endDate?: string;          // data ISO opcional — reservada, ainda sem UI
}
```

- Beta começa simples com `displayText` (o form atual **nem envia** `validity`; o campo vive no schema e nos prompts).
- O mapper converte `validity` (string atual) → `validity.displayText`; o `buildCommercialRepertoire` deixa de depender de heurística (`/`, `até`, `válida`) e passa a decidir por `enabled` + `displayText`.
- `endDate` fica como contrato reservado para quando o formulário ganhar campo de data (decisão de UI futura).

---

### D9 — Aviso ilustrativo estruturado (`commercial.legalNotice`)

`DECIDIDO` (substitui a semântica de string solta)

```ts
legalNotice: {
  enabled: boolean;
  text?: string;             // ex.: "Imagem meramente ilustrativa"
}
```

- **Regra:** `enabled=false` → **nada entra na arte** (nem prompt, nem revisão).
- O mapper preserva compat: `mandatoryArtworkText` (transporte) → `legalNotice.text`; os prompts e o revisor continuam recebendo o texto como antes (fix `260804-s16` mantido).
- A UI (`mandatory-artwork-field.tsx`) pode evoluir para um toggle `enabled` + texto — sem mudança nesta fase (não é escopo).
- **Campo canônico único:** `legalNotice` vive **apenas** em `commercial.legalNotice`. **Não há espelho** em `CampaignBrief` — se a F37 quiser leitura direta, usa **helper/mapper** (ex.: `getCampaignLegalNotice(brief)`). Snapshot bom é snapshot sem ambiguidade.

---

### D10 — Preparação para temas (`creativeContext.themeId?`)

`DECIDIDO` (reserva de encaixe, sem especular)

- `creativeContext.themeId?: string | null` nasce no contrato, sempre `null` nesta fase.
- **Nenhum sistema de temas** (CRUD, direção visual de tema, `themeSnapshot`) é criado aqui — só o ponto de encaixe no contrato.
- Risco YAGNI controlado: campo nullable não força design prematuro.

---

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

1. **flat → `CampaignBrief`** — na rota, único ponto de conversão (D5).
2. **`CampaignBrief` → prompts** — `ImageGenerationService.buildPromptVariables`/`buildCommercialRepertoire` passam a ler `brief.product`, `brief.commercial`, `brief.media` em vez de `body.*`. O conjunto de variáveis de prompt **permanece idêntico** para o mesmo input (regressão garantida por teste).
3. **`CampaignBrief` → provider/input-validation** — ponte explícita `brief.media.primary.dataUrl` para o **provider de imagem** e para o **`InputValidationService`/revisor de visão** (hoje o pipeline lê `productImageDataUrl` direto). O base64 vive **só em memória/transporte** (tipo runtime `CampaignProductImageInput`); o snapshot nunca o expõe (D6/D7).
4. **`CampaignBrief` → copy** — `mapBriefToCopyDirectorInput` lê do domínio; saída `CopyDirectorInput` inalterada.
5. **`CampaignBrief` → review** — `ImageReviewInput` (revisor) montado a partir do domínio, incluindo `legalNotice` e `validity`.
6. **`CampaignBrief` → snapshot** — builder do `input_snapshot` versionado, com imagem no tipo `CampaignBriefSnapshotImage` (D6).

- **Comportamento preservado:** para o mesmo payload flat de hoje, o pipeline gera o mesmo prompt/copy/review. Verificação por testes de contrato + regressão completa.
- **Sem refatoração grande da rota:** a orquestração (crédito, rate limit, clearance, stream, telemetria) **não muda** — só a camada de input muda de shape.

---

### D12 — Testes de contrato

`DECIDIDO` (obrigatórios nesta fase — ver seção Testes)

Cobertura mínima: brief mínimo válido; oferta com preço+validade; aviso ilustrativo marcado/desmarcado; uma imagem principal; rejeição sem imagem; **snapshot nunca contém dataUrl/base64** (por tipo `CampaignBriefSnapshotImage`, não só por convenção); round-trip flat→brief→snapshot; **ponte provider/input-validation com `media.primary.dataUrl`**; mappers preservam comportamento atual; compat com payload atual (benchmark).

---

```
ARQUIVOS MODIFICADOS (principais):
═══════════════════════════════════════════════════════════════

src/lib/campaign/brief.ts                     ← NOVO — contrato CampaignBrief (zod + types),
                                                 types de imagem runtime × snapshot (D7),
                                                 mapper flat→brief, builder de snapshot,
                                                 constantes (schemaVersion, roles, sources)
src/lib/campaign/brief-schema.ts              ← NOVO — zod schemas por domínio
                                                 (product/commercial/media/creativeContext/
                                                 metadata — legalNotice/validity aninhados em
                                                 commercial, sem seção top-level)
src/lib/campaign/types.ts                     ← InputSnapshot → CampaignBriefSnapshot
                                                 (versionado); types do novo domínio

src/components/campaign/types.ts              ← CampaignBrief (atual) → ResolvedCampaignContext
src/lib/store-identity-service.ts             ← buildCampaignBrief → ResolvedCampaignContext;
                                                 novo builder/helper do CampaignBrief
src/app/api/campaign/generate-image/route.ts  ← mapper flat→brief na fronteira + snapshot
                                                 versionado (D5/D6)
src/lib/image-generation/services/image-generation-service.ts
                                              ← buildPromptVariables/buildCommercialRepertoire/
                                                 reviewInput leem brief.product/commercial/media;
                                                 ponte media.primary.dataUrl → provider/
                                                 input-validation (D11 — variáveis de prompt idênticas)
src/lib/copy/mapper.ts                        ← mapBriefToCopyDirectorInput lê do domínio (D11)
src/lib/image-generation/services/image-review-service.ts
                                              ← ImageReviewInput montado do domínio (D11)

NOVOS testes:
src/lib/campaign/__tests__/brief.test.ts              ← contrato do brief (D12)
src/lib/campaign/__tests__/brief-mapper.test.ts       ← flat→brief→snapshot (D12)
src/lib/campaign/__tests__/brief-snapshot.test.ts     ← snapshot sem base64/versionado (D12)
```

---

## Contratos de Integração

```typescript
// src/lib/campaign/brief.ts (tipos de domínio — sem server-only)

export type CampaignBriefSource = "web_form" | "api";
export type CampaignBriefSchemaVersion = "campaign_brief_v1";

export type ProductSource = "manual" | "catalog";
export type CampaignImageRole = "primary" | "variation" | "combo_item" | "reference";
export type CampaignImageSource = "upload" | "camera";

export interface CampaignProductImageInput {
  id: string;                              // uuid gerado na montagem
  role: CampaignImageRole;                 // sempre existe 1 "primary" (D7)
  source: CampaignImageSource;
  mimeType: string;
  dataUrl?: string;                        // só em memória/transporte p/ gerar imagem — nunca no snapshot
}

// Imagem do SNAPSHOT PERSISTIDO — sem base64 POR CONSTRUÇÃO (D6/D7)
export interface CampaignBriefSnapshotImage {
  id: string;
  role: CampaignImageRole;
  source: CampaignImageSource;
  mimeType: string;
  provided: true;
  // reservados (fase de catálogo / F37 regeneração): storagePath?, productAssetId?
}

export interface CampaignBriefProduct {
  source: ProductSource;                   // "manual" agora; "catalog" reservado (D3)
  catalogProductId?: string;               // encaixe futuro — não aponta tabela nesta fase
  name: string;
  brand?: string;
  sizeOrVariant?: string;
  description?: string;
}

export interface CampaignOfferValidity {
  enabled: boolean;
  displayText?: string;                    // beta começa com displayText (D8)
  endDate?: string;                        // reservado — sem UI nesta fase
}

export interface CampaignOfferLegalNotice {
  enabled: boolean;
  text?: string;                           // ex.: "Imagem meramente ilustrativa"
}

export interface CampaignBriefCommercial {
  intent: CampaignIntent;
  originalPriceCents?: number;
  discountedPriceCents?: number;
  badgeText?: string;
  validity?: CampaignOfferValidity;
  legalNotice?: CampaignOfferLegalNotice;
  availabilityNotes?: string;
  campaignDetails?: string;
  additionalDetails?: string;
}

export interface CampaignBriefCreativeContext {
  preserveImageContext?: boolean;
  themeId?: string | null;                 // reservado (D10)
}

export interface CampaignBrief {
  product: CampaignBriefProduct;
  commercial: CampaignBriefCommercial;      // legalNotice/validity vivem AQUI (canônico — D9)
  media: { images: CampaignProductImageInput[] };   // ≥1, um primary (runtime);
                                                    // snapshot usa CampaignBriefSnapshotImage
  creativeContext: CampaignBriefCreativeContext;
  metadata: {
    source: CampaignBriefSource;
    schemaVersion: CampaignBriefSchemaVersion;
  };
}

// Leitura direta para F37 — helper/mapper, NÃO campo no contrato (D9)
export function getCampaignLegalNotice(brief: CampaignBrief): CampaignOfferLegalNotice | undefined {
  return brief.commercial.legalNotice;
}

// Snapshot PERSISTIDO (D6) — schemaVersion canônico no ROOT; sem base64
export interface CampaignBriefSnapshot {
  schemaVersion: CampaignBriefSchemaVersion;      // canônico no ROOT (D6)
  product: CampaignBriefProduct;
  commercial: CampaignBriefCommercial;            // legalNotice/validity aninhados aqui
  media: { images: CampaignBriefSnapshotImage[] }; // sem dataUrl por tipo (D7)
  creativeContext: CampaignBriefCreativeContext;
  metadata: {
    source: CampaignBriefSource;                  // SEM schemaVersion aqui — D6
  };
}
```

```typescript
// Mapper flat → CampaignBrief (fronteira da rota — D5/D11)

export function buildCampaignBriefFromFlat(
  input: GenerateImageRequest,
  storeId: string,
  source: CampaignBriefSource = "web_form"
): CampaignBrief;
```

```typescript
// Builder do snapshot versionado (D6) — deriva as imagens DO PRÓPRIO brief,
// removendo dataUrl (NÃO recebe imagem externa — evita divergência de id com
// brief.media.images; ver D7)

export function buildCampaignBriefSnapshot(
  brief: CampaignBrief
): CampaignBriefSnapshot;                  // schemaVersion no ROOT; sem base64 (D6/D7)
```

```sql
-- NENHUMA migration nesta fase
-- (input_snapshot continua jsonb; validação no TS + testes — D6)
```

---

## Testes

Padrão do repositório (vitest + Testing Library). Suíte estimada ~34+ testes novos. Referências: D3–D12.

### Contrato do brief — 8 testes
| # | Teste | Valida |
|---|-------|--------|
| 1 | brief mínimo válido (`manual`, 1 imagem `primary`, produto nomeado) | D4/D5 |
| 2 | oferta com preço + validade (`validity.enabled` + `displayText`) | D8 |
| 3 | `legalNotice.enabled=false` → nada entra na arte (prompt/copy/review vazios) | D9 |
| 4 | `legalNotice.enabled=true` + text → texto propaga (compat `mandatoryArtworkText`) | D9 |
| 5 | sempre existe exatamente 1 `role: "primary"` | D7 |
| 6 | rejeição sem imagem (400) — invariante preservada | D7 |
| 7 | `product.source` default `manual`; `catalogProductId` opcional e não-apontando tabela | D3 |
| 8 | `themeId` presente e `null` no contrato | D10 |

### Mapper flat→brief→snapshot — 9 testes
| # | Teste | Valida |
|---|-------|--------|
| 9 | round-trip flat→brief preserva todos os campos equivalentes (nome, preços, badge, intent, preserveImageContext) | D5/D11 |
| 10 | `validity` (string) → `validity.displayText`; sem string → `enabled: false` | D8 |
| 11 | `mandatoryArtworkText` → `legalNotice.text`; ausente → `enabled: false` | D9 |
| 12 | `productImageDataUrl` → `media.images[0]` (runtime) com `role: primary`, `source: upload`, mimeType; `dataUrl` fica **só no runtime** | D7 |
| 13 | `buildCampaignBriefSnapshot(brief)` **deriva as imagens do próprio brief** (não recebe imagem externa; remove `dataUrl`, preserva `id`/`role`/`source`/`mimeType`/`provided`) — `CampaignBriefSnapshotImage` sem `dataUrl` por tipo | D6/D7 |
| 14 | snapshot tem `schemaVersion: "campaign_brief_v1"` **no root** (metadata sem `schemaVersion`) e seções product/commercial/media/creativeContext/metadata — legalNotice só dentro de `commercial` | D6 |
| 15 | **snapshot nunca contém dataUrl/base64** (varredura recursiva de chaves) | D6 |
| 16 | snapshot imutável por construção (é serializado uma vez na criação; catálogo futuro não o altera) | D3 |
| 17 | compat payload atual (benchmark scenarios) → mesmo brief equivalente | D5/D11 |

### Mappers de consumo (prompt/provider/copy/review) — 9 testes
| # | Teste | Valida |
|---|-------|--------|
| 18 | `buildPromptVariables` com brief estruturado produz o MESMO conjunto de variáveis que o flat para o mesmo input | D11 |
| 19 | `buildCommercialRepertoire` decide por `validity.enabled/displayText` (não heurística `/`, `até`, `válida`) | D8 |
| 20 | **provider/input-validation recebe `media.primary.dataUrl`** (base64 em memória/transporte; snapshot nunca o expõe) | D11 |
| 21 | `mapBriefToCopyDirectorInput` lê do domínio e mantém `CopyDirectorInput` equivalente | D11 |
| 22 | `ImageReviewInput` montado do domínio (productName, storeName, intent, preços, `legalNotice`, `campaignDetails`) | D11 |
| 23 | revisor recebe `legalNotice.text` quando `enabled=true`; não recebe quando `false` | D9 |
| 24 | revisor recebe `validity.displayText` quando `enabled=true` | D8 |
| 25 | `ResolvedCampaignContext` (wrapper renomeado) mantém o shape consumido pelo pipeline atual | D4 |
| 26 | `buildCampaignBrief` (store-identity-service) retorna `ResolvedCampaignContext` sem quebrar callers | D4 |

### Regressão (obrigatória)
- `generate-image` — fluxo completo (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterado** para o mesmo payload flat
- Prompts finais idênticos aos atuais (golden test por intent: offer/spotlight/exclusive)
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Regressão pesada em mocks** — `route.test.ts` tem dezenas de `mockResolvedValue({ campaignInput: {}, store: {} })`; `image-generation-service.test.ts` e `image-review-service.test.ts` montam briefs flat | Atualizar fixtures **na mesma fase** (co-migração, D5); testes de contrato comparando variáveis de prompt antigas × novas (golden tests por intent) |
| **Contrato duplo eterno** (flat aceito para sempre + brief estruturado) | Não há promessa de compat eterna (D5): flat é transporte; a migração do form acontece na fase que precisar (múltiplas imagens/câmera) |
| **Mudar o shape interno quebra o pipeline silenciosamente** | Mappers preservam comportamento (D11); verificação por golden tests de prompt + regressão completa |
| **Colisão de nomeação** (3 "briefs" no código) | Resolvida na D4 (`CampaignBrief` = domínio; wrapper atual → `ResolvedCampaignContext`; `campaign_brief` do Brand Profiler inalterado) |
| **Base64 vazar no snapshot** | Já ausente hoje; formalizado com teste de contrato (D6) |
| **Escopo crescer para catálogo de produtos** | Bloqueado pela D3: catálogo é fase subsequente explícita; `source`/`catalogProductId?` são apenas contrato reservado |
| **F37 (revisão/aprovação) quebrar por mudança de snapshot** | F39 é pré-requisito da F37 (D2); F37 consome o snapshot versionado novo; sem gate retroativo |
| **Campos adormecidos (hook/cta/objective/etc.) mudarem de semântica na estruturação** | São mantidos no contrato (`commercial`/`creativeContext`) com mapeamento 1:1; prompts continuam recebendo as mesmas variáveis |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Catálogo de produtos por loja (persistência)** — tabela, storage de imagens, CRUD/seleção, reuso, edição, histórico, deduplicação, ownership | **Decisão arquitetural futura explícita (D3)** — fase subsequente que consome o contrato |
| **Múltiplas imagens completas na UI** | Contrato pronto (D7); UI/transporte multi-imagem é fase própria |
| **Captura de câmera** | `source: "camera"` no contrato (D7); implementação futura |
| **Revisão pré-geração** | Aproximação ao ciclo de revisão; não é escopo |
| **Aprovação pós-geração (F37)** | F37 é a próxima fase (D2), consome o snapshot desta fase; se precisar regenerar com a imagem original do produto, **criará asset persistido na F37** (snapshot é sem base64) |
| **CRUD de temas / direção visual de tema / `themeSnapshot`** | `themeId?` reservado (D10) |
| **Migrar o form para enviar o payload estruturado** | Opção 1 (D5): o form continua flat nesta fase; migração na fase que precisar |
| **Pacotes de crédito / precificação pública** | F40 (Stripe) |
| **Reconciliação financeira real de custos** | F38.3 (futura) |
| **Refatoração grande da rota de geração (735 linhas)** | Só a camada de input muda de shape (D11); orquestração intacta |
| **CHECK no banco para `schemaVersion`** | Decidido adiar (D6); JSONB tolerante + validação TS/testes; se F37 exigir, entra lá |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Numeração: F39 = Brief Estruturado de Campanha (v1.5), Stripe → F40 (v1.7); runbook de trackings aplicado
- [ ] D2 — Sequenciamento: v1.5, antes da F37 (F37 consome o snapshot)
- [ ] D3 — Produto separado de oferta; `source`/`catalogProductId?`; **catálogo = fase futura**; snapshot imutável do produto/oferta
- [ ] D4 — Novo `CampaignBrief` (domínio); wrapper atual renomeado para `ResolvedCampaignContext`
- [ ] D5 — Opção 1: form flat mantido; mapper na fronteira da rota; sem contrato duplo eterno
- [ ] D6 — Snapshot versionado `campaign_brief_v1`; nunca contém base64; sem CHECK no banco
- [ ] D7 — `media.images[]` com `role`/`source`; 1 imagem `primary` nesta fase
- [ ] D8 — `commercial.validity { enabled, displayText?, endDate? }`; beta com `displayText`
- [ ] D9 — `commercial.legalNotice { enabled, text? }`; `enabled=false` → nada na arte
- [ ] D10 — `creativeContext.themeId?` reservado; sem sistema de temas
- [ ] D11 — 5 mappers + builder de snapshot (flat→brief, prompts, **provider/input-validation**, copy, review) preservando comportamento atual
- [ ] D12 — Testes de contrato (brief, mapper, snapshot sem base64, round-trip, compat)

### Fluxo (comportamento preservado)
- [ ] Form envia payload flat como hoje → geração funciona sem mudança de UX
- [ ] Prompts finais idênticos aos atuais (golden test por intent)
- [ ] `legalNotice.enabled=false` → texto obrigatório NÃO entra na arte
- [ ] `validity.enabled` + `displayText` → entra no prompt de oferta de forma determinística
- [ ] Sem imagem → 400 (invariante preservada)
- [ ] `ResolvedCampaignContext` consumido pelo pipeline sem quebras de callers

### Snapshot / auditoria
- [ ] `input_snapshot` novo com `schemaVersion: "campaign_brief_v1"` e seções por domínio
- [ ] Teste de contrato prova que snapshot não contém dataUrl/base64
- [ ] Snapshot imutável (catálogo futuro não altera campanhas antigas)
- [ ] F37 (próxima fase) reconstrói o brief **semântico** do snapshot para revisão/auditoria; **regeneração fiel com a imagem original** dependerá de **asset persistido** a criar na F37 (snapshot é sem base64)

### Renumeração (D1 — trackings)
- [ ] `ROADMAP.md` (raiz) — F39 = Brief; F40 = Stripe
- [ ] `.planning/ROADMAP.md` — Phase numbering, tabela Progress, notas de renumeração, deps, dependency graph, seção Fase 39, rodapé
- [ ] `.planning/STATE.md` — frontmatter, Current Position, Next Phases, Last updated
- [ ] `.planning/PROJECT.md` — Stripe F39 → F40; rodapé
- [ ] `.planning/REQUIREMENTS.md` — v1.7 "F39" → "F40"
- [ ] `.planning/MILESTONES.md` — "diferido para v1.7 (F39)" → (F40)

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando (incluindo migrados)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### UAT Local
- [ ] Gerar campanha offer/spotlight/exclusive pelo form → resultado idêntico ao atual
- [ ] Snapshot da campanha exibe estrutura versionada no admin/DB (inspeção)
- [ ] Aviso ilustrativo desmarcado → arte sem o texto
- [ ] Campanha com validade → texto de validade na arte quando esperado
- [ ] Campanha antiga (pré-F39) continua exibindo/baixando normalmente (sem migração destrutiva)

---

*Documento criado: 2026-08-12*
*Baseado na exploração do estado real: `GenerateImageRequestSchema` flat (21 campos) e `.strict()`; `input_snapshot` já sem base64 (`route.ts:357-380`); pipeline lendo `brief.campaignInput` flat em `image-generation-service.ts:95` (prompt vars/repertoire/review); colisão de 3 conceitos "brief" (`brand_profile.campaign_brief`, `CampaignBrief` wrapper, novo domínio); `validity` via heurística no `buildCommercialRepertoire`; `mandatoryArtworkText` string-based; ~11 campos do schema adormecidos no form; único cliente = form + benchmark. Decisões do Q&A: **Brief = F39, Stripe → F40** (precedente F37 D11); **v1.5 antes da F37** (F37 consome o snapshot); **produto separado de oferta** com catálogo como decisão arquitetural futura explícita (junto no desenho, depois na implementação); **snapshot imutável** do produto/oferta; **Opção 1** (form flat, mapper na rota); **rename** do wrapper atual para `ResolvedCampaignContext`; **sem contrato duplo eterno** (co-migração de testes na fase; form migra na fase de múltiplas imagens/câmera). Revisão do usuário incorporada (2026-08-12): `legalNotice` canônico único em `commercial.legalNotice` (sem espelho — helper `getCampaignLegalNotice` para F37); **tipos separados** `CampaignProductImageInput` (runtime, com dataUrl) × `CampaignBriefSnapshotImage` (snapshot, sem base64 por construção); **F37 reconstrói o brief semântico do snapshot** (regen fiel com a imagem original dependerá de asset persistido a criar na F37); **5ª costura** `media.primary.dataUrl → provider/input-validation` explícita.*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec (`openspec/changes/fase-39-brief-estruturado-campanha/`).*
