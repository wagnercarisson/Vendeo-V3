# Phase 5: Identity-Aware Campaign Briefing — Context

**Gathered:** 2026-07-02
**Status:** Ready for execution
**Source:** OpenSpec — `openspec/changes/fase-5-0-identity-aware-campaign-briefing/`
**Alignment:** `docs/alinhamento-fase-5.0-identity-aware-briefing.md`
**Decisions:** 11 (D01–D11)

<domain>
## Phase Boundary

**Propósito:** Criar uma camada de briefing entre o cadastro da loja e a geração de campanhas. Centralizar a resolução da identidade da loja no backend, montar um contrato padronizado (`CampaignBrief`), e entregar ao diretor de campanhas tudo que ele precisa — mastigado, coerente, e independente do estado de identidade da loja (`text_only`, `logo`, `visual_signature`).

**O que esta fase entrega:**

1. **StoreIdentitySnapshot 2.0** — `identityState` explícito, `signature` unificado (substitui `logoUrl`, `visualSignatureUrl`, `visualSignatureType`), `BrandProfileSnapshot` sem `logoVariantUrl`
2. **resolveStoreIdentity() reescrita** — Pipeline declarativo: store → profile → asset, sem directive
3. **validateIdentityReference()** — Valida URL do asset com fetch HEAD/GET antes do briefing
4. **buildCampaignBrief()** — Deriva directive de (state, asset presence) — 5 cenários
5. **GET /api/store/:id enriquecido** — Retorna Store + StoreIdentitySnapshot em uma passada
6. **POST /api/campaign/generate-image reformulado** — Cliente envia `storeId` + dados do produto (sem identity fields), backend resolve identidade
7. **CampaignBrief (tipo interno, sem Zod)** — Contrato padronizado: campaignInput, store, brandProfile, identity
8. **GenerateImageRequestSchema 2.0** — `storeId` + product fields apenas
9. **Prompt com directive injetada** — Instrução fixa de logotipo → `{{identityDirective}}`
10. **Provider identityImageUrl** — `logoImageUrl` → `identityImageUrl`, fallback `images.edit` com `[productFile, identityFile]`
11. **Componentes consumidores** — CampaignRenderer, StoreIdentityBlock, StoreVisualSignatureSection consomem `signature` unificado
12. **Normalização de preview legado** — Detecta formato sem `identityState` e deriva state de `logoUrl`/`visualSignatureUrl`
13. **Remoção de resolução duplicada** — CampaignPageClient e StoreIdentityBlock deixam de chamar `resolveStoreIdentity` separadamente

**Não escopo desta fase:**
- Ajustes criativos no prompt `campaign-image-director.md` (hierarquia, composição, copy) — fora de escopo
- Phase 6 pós-geração (Review, Adjust & Export) — futura
- Sistema de planos, auth, dashboard
- Refatoração do `campaign-renderer.tsx` além da migração para `signature`

</domain>

<decisions>
## Implementation Decisions

### D01 — Resolução de identidade no backend

**Decisão:** O cliente envia apenas `storeId` + dados do produto no `POST /api/campaign/generate-image`. O backend lê a loja, resolve o brand profile e o asset, valida a referência, deriva a directive, e monta o `CampaignBrief`.

**Alternativa considerada:** Manter o modelo atual (cliente resolve e envia dados pré-montados). Rejeitada porque a resolução ocorria 3 vezes no mesmo fluxo, os dados podiam estar stale, e a duplicação de responsabilidade dificultava manter coerência.

**Pipeline backend:**
```
resolveStoreIdentity(storeId)
  → StoreIdentitySnapshot
    ↓
validateIdentityReference(snapshot)
  → StoreIdentitySnapshot (cópia, signature.url = null se falhar)
    ↓
buildCampaignBrief(snapshot, campaignInput)
  → CampaignBrief (directive já derivada)
    ↓
ImageGenerationService.generateImage(CampaignBrief)
```

### D02 — validateIdentityReference antes do briefing

**Decisão:** `validateIdentityReference(snapshot): Promise<StoreIdentitySnapshot>` é chamada entre a resolução e o builder. Retorna uma cópia do snapshot. Se o fetch HEAD/GET da `signature.url` falhar, a cópia tem `signature.url = null` e um diagnóstico é registrado. O builder nunca recebe uma URL que não pode ser carregada.

### D03 — identityImageUrl como canal único de asset

**Decisão:** Um único campo `identityImageUrl` substitui três (`logoUrl`, `visualSignatureUrl`, `brandProfile.logoVariantUrl`). O campo carrega a URL do logo ou da VS dependendo do `identity_state`, ou `null` se não houver asset. O nome genérico `identityImageUrl` evita associar semanticamente a logo ou VS.

### D04 — Directive derivada de (state, asset presence)

**Decisão:** A directive textual injetada no prompt é determinada pelo par `(identityState, signature.url !== null)`, não pelo state isoladamente. São 5 cenários. `buildCampaignBrief()` é responsável por essa derivação — `resolveStoreIdentity()` retorna state + asset, sem directive.

| state | asset | directive |
|-------|-------|-----------|
| `text_only` | — | "Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório." |
| `logo` | presente | "Assinar a campanha com o logotipo da loja. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório." |
| `logo` | ausente | "Não inventar logotipo. Usar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório." |
| `visual_signature` | presente | "Assinar a campanha com a assinatura visual da loja. Não adicionar logotipo. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório." |
| `visual_signature` | ausente | "Não inventar assinatura visual nem logotipo. Considerar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório." |

### D05 — Brand profile preservado independentemente do estado

**Decisão:** O brand profile `synced` (único por constraint de unicidade) é sempre usado como direção criativa, qualquer que seja o `identity_state`. Se `source` for incompatível com o estado atual, um diagnóstico é registrado mas o perfil é aplicado normalmente. Nenhum campo individual do perfil é instrução visual obrigatória — sua tradução na composição permanece sob julgamento do diretor.

### D06 — CampaignBrief como tipo interno, sem Zod

**Decisão:** `CampaignBrief` é um tipo TypeScript puro, construído e consumido exclusivamente no backend. A validação de entrada externa (Zod) fica no `GenerateImageRequestSchema`. `CampaignBrief` contém: `campaignInput` (transparent transport), `store`, `brandProfile`, `identity`.

### D07 — Fallback corrigido com `[productFile, identityFile]`

**Decisão:** No `fallbackToImageApi()`, o provider recebe a URL de identidade já validada, faz fetch para obter o arquivo, converte com `toFile`, e envia ambos os arquivos (`productFile`, `identityFile`) para `images.edit`.

### D08 — Erro controlado após validação

**Decisão:** Após `validateIdentityReference()` confirmar que a URL do asset é acessível, qualquer falha do provider ao carregá-la durante a execução é tratada como erro controlado — retorna erro ao cliente. Não há degradação silenciosa.

### D09 — GET /api/store/:id enriquecido

**Decisão:** O endpoint passa a retornar `Store + StoreIdentitySnapshot` em uma única resposta. CampaignPageClient e StoreIdentityBlock consomem os dados já resolvidos do endpoint.

### D10 — Preservação comportamental do diretor

**Decisão:** `CampaignBrief` é uma agregação de dados, não uma nova estratégia criativa. Todas as invariantes são mantidas: campos ausentes continuam ausentes, `inputValidationOverride` continua sendo controle técnico, subsegmento/posicionamento/descrição curta/slogan não são adicionados ao prompt. `buildPromptVariables()` preserva todas as variáveis e regras atuais, alterando somente a directive de identidade.

### D11 — Normalização de preview legado

**Decisão:** A página `/campaign/preview` detecta a ausência de `identityState` no `PreviewPayload` e normaliza silenciosamente: deriva `identityState` e `signature` de `logoUrl` (→ `'logo'`), `visualSignatureUrl` (→ `'visual_signature'`) ou nenhum ativo (→ `'text_only'`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec Change Artifacts
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/proposal.md` — Visão geral, what changes, capabilities, impacto
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/design.md` — 11 decisões de design (D01-D11), riscos, critério de regressão
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/tasks.md` — 9 grupos (1.1–9.5), 42 tasks

### Specs
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/store-identity-foundation/spec.md` — StoreIdentitySnapshot, resolveStoreIdentity, GET /api/store/:id
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/store-brand-profile/spec.md` — BrandProfileSnapshot sem logoVariantUrl, brand profile sempre incluso
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/identity-aware-campaign-briefing/spec.md` — CampaignBrief, validateIdentityReference, buildCampaignBrief, 5 directives
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/campaign-input-ui/spec.md` — storeId em vez de snapshot, submit sem identity fields
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/campaign-visual-renderer/spec.md` — signature consumido, 3 prioridades de identidade
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/creative-direction-context/spec.md` — CreativeBrief com identity block
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/generation-retry-fallback/spec.md` — Fallback com identityFile
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/campaign-preview-page/spec.md` — Normalização de preview legado
- `openspec/changes/fase-5-0-identity-aware-campaign-briefing/specs/ai-image-generation/spec.md` — ImageGenerationService, ImageProvider, POST endpoint

### Alignment Document
- `docs/alinhamento-fase-5.0-identity-aware-briefing.md` — Alinhamento completo (418 linhas), diagnóstico, 3 waves, política de resolução, riscos

### Existing Code Patterns
- `src/components/campaign/types.ts` — StoreIdentitySnapshot, BrandProfileSnapshot, PreviewPayload
- `src/lib/actions/store.ts` — resolveStoreIdentity() atual
- `src/lib/image-generation/schema.ts` — GenerateImageRequestSchema atual
- `src/lib/image-generation/providers/types.ts` — ImageProviderInput, ImageProviderOutput
- `src/lib/image-generation/providers/openai.ts` — OpenAIImageProvider, fallbackToImageApi
- `src/lib/image-generation/services/image-generation-service.ts` — ImageGenerationService, buildPromptVariables
- `src/app/api/campaign/generate-image/route.ts` — POST endpoint atual
- `src/app/api/store/[id]/route.ts` — GET /api/store/:id
- `src/components/flow/campaign-page-client.tsx` — CampaignPageClient
- `src/components/flow/store-identity-block.tsx` — StoreIdentityBlock
- `src/components/flow/campaign-input-form.tsx` — CampaignInputForm
- `src/components/flow/use-campaign-form.ts` — useCampaignForm hook
- `src/components/campaign/campaign-renderer.tsx` — CampaignRenderer
- `src/components/flow/store-visual-signature-section.tsx` — StoreVisualSignatureSection
- `src/app/campaign/preview/page.tsx` — Preview page
- `prompts/campaign-image-director.md` — Prompt template do diretor de campanhas

### Prior Phase Contexts
- `.planning/phases/4.6.2.2-state-specific-drift-policy/4.6.2.2-CONTEXT.md` — Drift detection, snapshot structure
- `.planning/phases/04.6.3-logo-state-lifecycle/04.6.3-CONTEXT.md` — Logo lifecycle, identity_state como canônico
- `.planning/phases/04.6.4-visual-signature-lifecycle/04.6.4-CONTEXT.md` — VS lifecycle, approval, restore
- `.planning/phases/4.6.4.1-cancel-button-vs-approval-modal/4.6.4.1-CONTEXT.md` — Modal, substitution mode

</canonical_refs>

<specifics>
## Fluxo Centralizado

```
CLIENTE                           BACKEND
───────                           ───────
CampaignInputForm
  │
  ├─ productName, prices, badge,
  │   description, productImage
  └─ storeId (único dado da loja)
        │
        │ POST /api/campaign/generate-image
        ▼
                        1. resolveStoreIdentity(storeId)
                           → StoreIdentitySnapshot
                        2. validateIdentityReference(snapshot)
                           → StoreIdentitySnapshot (cópia)
                        3. buildCampaignBrief(snapshot, campaignInput)
                           → CampaignBrief (directive derivada)
                        4. ImageGenerationService.generateImage(CampaignBrief)
                           → NDJSON stream
                        identityImageUrl → input_image (Responses API)
                        Fallback: [productFile, identityFile] (images.edit)
```

### Resolução de Identidade (resolveStoreIdentity)

Pipeline:
1. Ler `identity_state` da loja (1 query, fonte canônica)
2. Buscar brand profile `synced` (1 query, constraint garante único)
3. Se state espera ativo, buscar asset correspondente (storage_path)
4. Se asset esperado está ausente → `signature.url = null`, log de diagnóstico, estado não alterado
5. Se `profile.source` incompatível com `identity_state` → diagnóstico, sem bloqueio
6. Montar `StoreIdentitySnapshot` com state + signature + brandProfile

### Degradação em 2 níveis

**Nível 1 — Resolver:** registro/path do asset ausente no banco → `signature.url = null`, estado não alterado, diagnóstico.

**Nível 2 — Validação:** URL existe no banco mas irrecuperável no fetch → `imageUrl = null`, estado não alterado, diagnóstico.

### Campos removidos do POST /api/campaign/generate-image (BREAKING)

- `storeName` → resolvido no backend
- `storeSegment` → resolvido no backend
- `storeTone` → resolvido no backend
- `brandColor` → resolvido no backend (brand profile ou fallback de segmento)
- `storeLogoUrl` → removido, substituído por `storeId`
- `brandProfile` → removido, resolvido no backend

</specifics>

<deferred>
## Deferred Ideas

| Item | Motivo |
|------|--------|
| Ajustes criativos no prompt campaign-image-director.md | Fora de escopo — hierarquia, composição, copy |
| Phase 6 — Review, Adjust & Export | Fase futura, pós-geração |
| Sistema de planos, auth, dashboard | Futuro, dependente de validação do core |
| Refatoração do campaign-renderer.tsx além da migração para signature | Escopo mínimo |

</deferred>

---

*Phase: 05-identity-aware-campaign-briefing*
*Context gathered: 2026-07-02 via OpenSpec alignment*
