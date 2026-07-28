# Alinhamento Fase 5.0 — Identity-Aware Campaign Briefing

## Navegação das Fases

```text
v1.0 — Foundation (MVP)                                   (entregue)
  ├── Fase 1 — Foundation & Store Identity                 (concluída)
  └── Fase 2 — Campaign Input UI                          (concluída)

v1.1 — AI + Rendering + Identidade                        (entregue)
  ├── Fase 3 — AI Campaign Intelligence                    (concluída)
  ├── Fase 4 — Visual Rendering & Preview                  (concluída)
  │    ├── 4.1 — Campaign Visual Renderer & Preview        (concluída)
  │    ├── 4.2 — Commercial Visual Quality                 (concluída)
  │    ├── 4.3 — Agency-grade Campaign Composition         (concluída)
  │    ├── 4.4 — Store Visual Signature                    (concluída)
  │    ├── 4.4.1 — Existing Logo & Brand Direction         (concluída)
  │    ├── 4.4.2 — Generated Visual Signature              (concluída)
  │    ├── 4.5 — Segment & Subsegment Alignment            (concluída)
  │    └── 4.6 — Store Form Adjusts (subfases)             (concluída)
  │
  └── Fase 5 — Identity-Aware Campaign Briefing            ← esta fase
```

---

## Propósito

Criar uma camada de briefing entre o cadastro da loja e a geração de campanhas. Essa camada centraliza a resolução da identidade da loja no backend, monta um contrato padronizado de dados (o `CampaignBrief`), e entrega ao diretor de campanhas tudo que ele precisa — mastigado, coerente, e independente do estado de identidade da loja (`text_only`, `logo`, `visual_signature`).

O diretor de campanhas continua focado no que importa: gerar arte que converte, que vende, que causa o efeito "UAU". Ele não precisa descobrir o estado da loja nem buscar dados em campos ambíguos.

---

## Contexto: O Diagnóstico

### A descoberta

A identidade da loja hoje é resolvida **três vezes** no fluxo de geração:

```
1. GET /api/store/:id
     └── resolveStoreIdentity() chamada internamente

2. CampaignPageClient (linha 65)
     └── resolveStoreIdentity(store) — server action

3. StoreIdentityBlock (linha 27)
     └── resolveStoreIdentity(store) — server action, de novo
```

O fluxo repete consultas de profile/assets em cada ponto (endpoint, server action, block). O `identity_state` da loja **não é exposto** no `StoreIdentitySnapshot`. O `useCampaignForm()` monta o body com `storeLogoUrl` (vem de `logoUrl`) e `brandProfile.logoVariantUrl` — campo de nome enganoso que carrega a URL da VS quando a loja não tem logo. A `visualSignatureUrl` existe no snapshot mas nunca é enviada.

O prompt `campaign-image-director.md` instrui sempre: *"A loja possui um logotipo real fornecido como imagem de referência"* — independentemente do estado. Quando a loja é `text_only`, a IA pode alucinar um logotipo. Quando a loja tem VS, a URL da assinatura visual viaja como texto na tabela de brand profile mas **nunca chega como imagem de referência** para a OpenAI.

### Os 3 problemas estruturais

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. CONTRATO FRAGMENTADO                                            │
│     • identity_state não existe no StoreIdentitySnapshot            │
│     • VS URL viaja como brandProfile.logoVariantUrl (nome enganoso) │
│     • visualSignatureUrl existe no snapshot mas nunca é enviada     │
│     • Resolução ocorre 3 vezes (endpoint → page → block)            │
│                                                                     │
│  2. PROMPT CEGO PARA O ESTADO                                       │
│     • Instrução fixa: "A loja possui um logotipo real"              │
│     • IA não é orientada sobre o que NÃO fazer                      │
│     • Ativo ausente ainda geraria alucinação (mesmo com estado ok)  │
│                                                                     │
│  3. ASSINATURA VISUAL NÃO CHEGA COMO REFERÊNCIA                     │
│     • Só vem como texto na tabela de brand profile                  │
│     • Não é passada como input_image para a OpenAI                  │
│     • Fallback também perde identidade (qualquer attempt ≥ 1)       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## A Solução: Fluxo Centralizado

```
CLIENTE                                    BACKEND
───────                                    ───────
CampaignInputForm
  │
  ├─ productName, prices (original opcional),
  │   badge, description, productImage
  └─ storeId (único dado da loja)
        │
        │  POST /api/campaign/generate-image
        ▼
                              ┌─────────────────────────────────┐
                              │  CAMADA DE BRIEFING              │
                              │                                 │
                              │  1. read store + identity_state  │
                              │     (fonte canônica, 1 query)   │
                              │                                 │
                              │  2. resolve brand_profile:      │
                              │     • synced (único, constraint)│
                              │     • se source incompatível     │
                              │       com state → diagnóstico   │
                              │     • fallback: segmento        │
                              │                                 │
                               │  3. resolve asset:              │
                               │     • logo  → asset_url do logo │
                               │     • vs    → asset_url da VS   │
                               │     • text  → null              │
                               │                                 │
                               │  4. validar referência visual:  │
                               │     • tentar fetch com timeout  │
                               │     • se falhar → imageUrl=null │
                               │     • log de diagnóstico        │
                               │                                 │
                               │  5. derive directive:           │
                               │     state + asset disponível    │
                               │     → instrução textual         │
                               │                                 │
                               │  6. build CampaignBrief:        │
                              │     product: {...}              │
                              │     store: { name, seg, ...}    │
                              │     brandProfile: {...}         │
                              │     identity: {                 │
                              │       state,                    │
                              │       imageUrl,                 │
                              │       directive                 │
                              │     }                           │
                              └─────────────────────────────────┘
                                        │
                                        ▼
                              ImageGenerationService
                                        │
                              Prompt com directive injetada
                                        │
                              OpenAIImageProvider
                                        │
                              identityImageUrl → input_image
                              (e também no fallback — ver escopo)
                                        │
                              Imagem gerada ← NDJSON stream
                                        │
                                        ▼
                              CLIENTE
                              PreviewPayload em sessionStorage
```

### O que muda no fluxo

| Hoje | Novo |
|------|------|
| Cliente resolve identidade 3 vezes | Cliente envia só `storeId` |
| Body leva `storeLogoUrl` + `brandProfile.logoVariantUrl` | Body leva `storeId` + dados do produto |
| Backend recebe dados pré-resolvidos (podem estar stale) | Backend resolve identidade fresco |
| Prompt recebe instrução fixa ("loja tem logotipo") | Prompt recebe `directive` derivada de state + asset |
| Provider recebe `logoImageUrl` | Provider recebe `identityImageUrl` |
| Fallback perde identidade visual | Fallback também envia `identityImageUrl` |

---

## Política de Resolução de Identidade

### identity_state + asset disponível → diretiva

A diretiva é condicional ao **par** (state, asset presence), não ao state isoladamente. Se o state espera um ativo mas ele não está disponível, a diretiva instrui a IA a não inventar — sem alterar o estado persistido.

| state | asset | identityImageUrl | directive |
|-------|-------|------------------|-----------|
| `text_only` | — | `null` | "Não colocar logotipo. Não gerar assinatura visual. Usar a direção visual do perfil de marca." |
| `logo` | presente | URL do logo | "Assinar a campanha com o logotipo da loja. Seguir a direção visual do perfil de marca." |
| `logo` | **ausente** | `null` | "Não inventar logotipo. Usar apenas a direção visual do perfil de marca." |
| `visual_signature` | presente | URL da VS | "Assinar a campanha com a assinatura visual da loja. Seguir a direção visual do perfil de marca. Não adicionar logotipo." |
| `visual_signature` | **ausente** | `null` | "Não inventar assinatura visual nem logotipo. Usar apenas a direção visual do perfil de marca." |

A `directive` é **derivada no backend** — o cliente nunca envia a diretiva. O estado persistido (`identity_state`) **nunca é alterado** por falta de asset.

### brand_profile → direção criativa

O brand profile fornece direção criativa **qualquer que seja o estado de identidade**. A partial unique index `(store_id) WHERE status = 'synced'` garante no máximo um perfil synced por loja. A resolução é:

1. Buscar o brand profile `synced` (1 query)
2. Se encontrado: usar como direção criativa
3. Se `source` não corresponder ao `identity_state` esperado: registrar diagnóstico, mas usar o perfil normalmente
4. Se não encontrado: fallback para dados de segmento (cores padrão, tom genérico)

**Isso resolve a contradição nas specs:** o perfil é preservado mesmo após remoção de logo/VS. A remoção muda o ativo visual, não a direção criativa.

### Princípio defensivo: ativo ausente

A validação da referência visual ocorre **antes** da montagem do prompt, em etapa própria entre a resolução e o briefing:

```
resolveStoreIdentity()
  → signature.url = URL_do_asset
      ↓
validarReferênciaVisual(url):
  • tentar fetch HEAD/GET com timeout curto
  • se sucesso → mantém url
  • se falhar  → imageUrl = null, diagnóstico
      ↓
buildCampaignBrief():
  • state + imageUrl → directive "não inventar" se null
  • monta CampaignBrief com directive já correta
      ↓
ImageGenerationService → Provider
  • provider só envia a referência já validada
  • fallback: converte com toFile para [productFile, identityFile]
```

Dois níveis de degradação:

**Nível 1 — Resolver:** registro/path do asset ausente no banco → `signature.url = null`, estado não alterado, diagnóstico.

**Nível 2 — Validação:** URL existe no banco mas irrecuperável no fetch → `imageUrl = null`, estado não alterado, diagnóstico.

Em ambos, `buildCampaignBrief` recebe `imageUrl = null` e deriva directive "não inventar". O prompt nunca é montado com a instrução errada. O provider não precisa tomar decisão sobre asset ausente — só envia o que recebeu.

---

## Escopo

### Wave 1 — Contrato backend

**1. StoreIdentitySnapshot 2.0**
- `identityState: IdentityState`
- `signature: { url: string | null, type: "logo" | "visual_signature" | null }` — substitui `logoUrl`, `visualSignatureUrl`, `visualSignatureType`
- `BrandProfileSnapshot` sem `logoVariantUrl`

**2. resolveStoreIdentity() 2.0 (declarativa)**
- Pipeline:
  1. Ler `identity_state` da loja (1 query)
  2. Buscar brand profile `synced` (1 query, constraint garante único)
  3. Se state espera ativo, buscar asset correspondente (storage_path)
  4. Montar `StoreIdentitySnapshot` com state + signature + brandProfile
- Verificação defensiva: se `profile.source` incompatível com `identity_state` → diagnóstico, sem bloqueio
- Degradação: se registro/path do asset está ausente → `signature.url = null`, estado não alterado, log de diagnóstico
- **`resolveStoreIdentity` não deriva directive** — essa responsabilidade é do builder

**3. validateIdentityReference(snapshot) (nova função)**
- Assinatura: `validateIdentityReference(snapshot: StoreIdentitySnapshot): Promise<StoreIdentitySnapshot>`
- Retorna uma **cópia** do snapshot com `signature.url = null` quando o fetch da referência falha
- Faz fetch HEAD/GET com timeout curto
- Se sucesso: retorna snapshot inalterado
- Se falha: retorna snapshot com `signature.url = null` + diagnóstico (estado persistido não alterado)
- Estado persistido nunca é modificado — a degradação é apenas na resposta

**4. buildCampaignBrief() (nova função)**
- Recebe `StoreIdentitySnapshot` (já validado por `validateIdentityReference`) + dados do produto
- Deriva `directive` a partir de `identityState` + `signature.url` (tabela de 5 cenários)
- Monta e retorna `CampaignBrief`

**5. GET /api/store/:id**
- Simplificar: retorna Store + StoreIdentitySnapshot em uma passada
- O cliente (CampaignPageClient + StoreIdentityBlock) deixa de chamar `resolveStoreIdentity` separadamente

### Wave 2 — Pipeline de geração

**6. POST /api/campaign/generate-image**
- Cliente envia apenas: `storeId` + dados do produto
- Backend: recebe `storeId` → resolve identidade → `validateIdentityReference()` → `buildCampaignBrief()` → passa ao `ImageGenerationService`

**7. CampaignBrief (tipo interno, sem Zod)**
```typescript
interface CampaignBrief {
  product: {
    name: string;
    originalPriceCents?: number;        // opcional
    discountedPriceCents: number;
    badgeText: string;
    description?: string;
    imageDataUrl: string;
  };
  store: {
    name: string;
    segment: string;
    subsegment: string | null;          // reinserido
    toneOfVoice: string | null;
    positioning: string | null;         // reinserido
    shortDescription: string | null;    // reinserido
    slogan: string | null;              // reinserido
    brandColor: string;
  };
  brandProfile: BrandProfileSnapshot | null;
  identity: {
    state: IdentityState;
    imageUrl: string | null;            // único canal: logo / VS / null
    directive: string;                  // derivado de state + asset presence
  };
}
```

**8. GenerateImageRequestSchema 2.0**
- Entrada do cliente: `storeId: z.string().uuid()` + campos de produto apenas
- `brandColor` sai do schema público — é resolvida no backend a partir do brand profile ou fallback de segmento

**9. Prompt**
- `campaign-image-director.md`: instrução fixa de logotipo → `{{identityDirective}}`
- `buildPromptVariables()`: monta a diretiva a partir de `CampaignBrief.identity`
- `brandProfileSection` sem `logoVariantUrl`

**10. Validação de referência visual**
- Função entre `resolveStoreIdentity()` e `buildCampaignBrief()`
- Assinatura: `validateIdentityReference(snapshot) → Promise<StoreIdentitySnapshot>`
- Faz fetch HEAD/GET da `signature.url` com timeout
- Se falhar: retorna cópia do snapshot com `signature.url = null` + diagnóstico (estado persistido inalterado)
- Se sucesso: retorna snapshot inalterado
- Provider não precisa validar — recebe a URL já confirmada como acessível

**11. Provider**
- `ImageProviderInput`: `identityImageUrl` (substitui `logoImageUrl`)
- `OpenAIImageProvider`: enviar `identityImageUrl` como `input_image`
- **Fallback corrigido**: `fallbackToImageApi()` recebe a URL já validada, faz fetch, converte com `toFile` para `[productFile, identityFile]`. O SDK da OpenAI suporta múltiplas imagens em `images.edit`.

**12. Componentes consumidores do snapshot**
- `CampaignRenderer`: consumir `signature.url` + `signature.type` em vez de `logoUrl`/`visualSignatureUrl`
- `StoreIdentityBlock`: consumir `signature` unificado
- `StoreVisualSignatureSection`: idem

### Wave 3 — Validação

**13. Testes automáticos**
- `resolveStoreIdentity` para cada estado (com e sem asset disponível)
- Directive correta para cada combinação (state, asset) — 5 cenários
- Provider recebe `identityImageUrl` em vez de `logoImageUrl`
- Fallback também recebe `identityImageUrl`
- Prompt contém diretiva compatível
- Estado persistido não é alterado quando asset está ausente

**14. Validação manual**
- Fluxo text_only: sem logo, sem VS, brand profile aplicado
- Fluxo logo: logotipo na campanha, brand profile aplicado
- Fluxo VS: assinatura visual na campanha, sem logo, brand profile aplicado
- Remoção de logo: brand profile preservado, campanha sem logo, diretiva "não inventar"
- Asset quebrado: campanha gerada sem asset, estado inalterado, diagnóstico registrado

### Fora de escopo

- Ajustes criativos no prompt (melhorias de copy visual, hierarquia, composição)
- Phase 5 pós-geração: Review, Adjust & Export (futura)
- Sistema de planos, auth, dashboard

---

## Arquivos Afetados

| Arquivo | O que muda |
|---------|------------|
| `src/components/campaign/types.ts` | `StoreIdentitySnapshot`: `identityState` + `signature` unificado. `BrandProfileSnapshot`: remover `logoVariantUrl`. `CampaignBrief` (novo tipo interno). |
| `src/lib/actions/store.ts` | `resolveStoreIdentity()` reescrita: pipeline declarativo, 3 queries (store, profile, asset), verificação de asset + source compat. `buildCampaignBrief()` (nova). |
| `src/lib/store.ts` | Se necessário, helper de coerência identity_state ↔ assets. |
| `src/components/flow/campaign-page-client.tsx` | Remover chamada a `resolveStoreIdentity`. Passar `storeId` ao form. Simplificar carregamento. |
| `src/components/flow/store-identity-block.tsx` | Remover chamada a `resolveStoreIdentity`. Consumir `signature` unificado do snapshot. |
| `src/components/flow/campaign-input-form.tsx` | Props: `storeId` em vez de `storeIdentity`. |
| `src/components/flow/use-campaign-form.ts` | Montar body com `storeId` + dados do produto. Remover `storeLogoUrl` e `brandProfile`. |
| `src/components/campaign/campaign-renderer.tsx` | Consumir `signature.url` + `signature.type` em vez de `logoUrl`/`visualSignatureUrl`. |
| `src/components/flow/store-visual-signature-section.tsx` | Consumir `signature` unificado. |
| `src/lib/image-generation/schema.ts` | `GenerateImageRequestSchema`: `storeId` + `product.*`. |
| `src/app/api/campaign/generate-image/route.ts` | Receber `storeId`, resolver identidade, montar `CampaignBrief`. |
| `src/lib/image-generation/providers/types.ts` | `ImageProviderInput`: `identityImageUrl` (substitui `logoImageUrl`). |
| `src/lib/image-generation/providers/openai.ts` | `identityImageUrl` como `input_image`. Fallback `images.edit` com `identityImageUrl`. |
| `src/lib/image-generation/services/image-generation-service.ts` | `CampaignBrief` como input. `buildPromptVariables()` com `directive`. Provider `identityImageUrl`. |
| `src/app/campaign/preview/page.tsx` | Normalizar snapshot legado (sem `identityState`) para o novo formato, ou descartar preview de sessão antiga. |
| `prompts/campaign-image-director.md` | Instrução de logotipo → `{{identityDirective}}`. |

---

## Riscos

### 1. Validação prévia garante consistência

A validação da referência visual (fetch com timeout) ocorre antes do `buildCampaignBrief()`, garantindo que a directive nunca seja montada com instrução incompatível com o asset disponível. O provider só recebe URLs já confirmadas como acessíveis.

### 2. Fallback perde identidade — corrigido nesta fase

**Identificado:** O provider `OpenAIImageProvider` envia `logoImageUrl` como `input_image` apenas no caminho principal (Responses API, attempt 0). Em `attempt >= 1`, qualquer erro de Responses API cai no `fallbackToImageApi()` que envia apenas a imagem do produto.

**Decisão:** Trazer a correção para esta fase. A validação prévia já confirmou que a URL é acessível. No fallback, o provider faz fetch e converte com `toFile` para enviar `[productFile, identityFile]` no `images.edit`. Escopo da Wave 2.

### 3. Imagem de referência ≠ fidelidade pixel a pixel

A OpenAI recebe logo/VS como `input_image` (referência visual), mas o modelo pode não reproduzir o asset com fidelidade exata — especialmente detalhes finos, texto pequeno ou cores de borda. Isso é limitação inerente da geração por IA, não um bug. O prompt instrui fidelidade, mas não há garantia contratual de reprodução pixel-perfeita.

### 4. Degradação controlada, não silenciosa

Após validação prévia bem-sucedida, a URL do asset é confirmada como acessível. Se o provider falhar ao carregá-la durante a execução (timeout de storage, erro HTTP), isso deve ser tratado como **erro controlado** — retornar erro ao cliente — e não como degradação silenciosa. O prompt nesse ponto já foi montado com diretiva "usar identidade", e o asset não pode ser removido sem inconsistência.

A degradação silenciosa (converter asset em null com diretiva "não inventar") só é possível na etapa anterior ao `buildCampaignBrief()`.

### 5. PreviewPayload legado em sessionStorage

Previews gerados antes do deploy têm `storeIdentity` no formato antigo (sem `identityState`, com `logoUrl`/`visualSignatureUrl`). A página de preview deve tratar ausência de `identityState` como formato legado. Baixo impacto.

---

## Critérios de Sucesso

### Automáticos

- [ ] TypeScript — sem erros de tipo
- [ ] Lint — sem violações
- [ ] Build — `npm run build` passa
- [ ] Testes existentes — continuam passando
- [ ] `resolveStoreIdentity` com `identity_state = 'text_only'` → `identityState = 'text_only'`, `signature.url = null`
- [ ] `resolveStoreIdentity` com `identity_state = 'logo'` + asset presente → `identityState = 'logo'`, `signature.url = URL_do_logo`
- [ ] `resolveStoreIdentity` com `identity_state = 'logo'` + asset ausente → `identityState = 'logo'`, `signature.url = null`, diagnóstico registrado
- [ ] `resolveStoreIdentity` com `identity_state = 'visual_signature'` + asset presente → `identityState = 'visual_signature'`, `signature.url = URL_da_VS`
- [ ] `resolveStoreIdentity` com `identity_state = 'visual_signature'` + asset ausente → `identityState = 'visual_signature'`, `signature.url = null`, diagnóstico registrado
- [ ] `buildCampaignBrief` deriva directive correta para cada combinação (state, asset) — 5 cenários
- [ ] Provider: `identityImageUrl` em vez de `logoImageUrl` no input
- [ ] Provider: `identityImageUrl` também presente no fallback (attempt ≥ 1)
- [ ] Prompt contém directive compatível

### Manuais

1. **Fluxo text_only** — Cadastrar loja sem logo, sem VS, inferir brand profile. Gerar campanha. A imagem não contém logotipo nem assinatura visual. Direção visual do brand profile aplicada.
2. **Fluxo logo** — Cadastrar loja com logo, brand profile analisado. Gerar campanha. Logotipo presente como assinatura. Direção visual do brand profile aplicada.
3. **Fluxo VS** — Cadastrar loja sem logo, gerar VS, aprovar. Gerar campanha. VS presente como assinatura. Sem logotipo. Direção visual do brand profile aplicada.
4. **Remoção de logo** — Loja com logo. Remover logo. Gerar campanha. Sem logotipo. Direção visual do brand profile (original) preservada.
5. **Asset quebrado** — Corromper URL do logo no banco. Gerar campanha. Sem logotipo. `identity_state` permanece `'logo'`. Diagnóstico registrado.
