## Context

A identidade da loja hoje é resolvida 3 vezes no fluxo de geração (`GET /api/store/:id`, `CampaignPageClient`, `StoreIdentityBlock`), cada uma repetindo consultas de profile e asset. O `StoreIdentitySnapshot` não expõe `identity_state` — o estado é inferido indiretamente por qual URL de ativo está preenchida. O prompt `campaign-image-director.md` instrui "loja possui logotipo real" independentemente do estado, e a assinatura visual (VS) nunca chega como imagem de referência para a OpenAI.

O `useCampaignForm()` monta o body de geração com dados pré-resolvidos do cliente, abrindo margem para dados stale. Três campos carregam dados de identidade por caminhos diferentes (`logoUrl`, `visualSignatureUrl`, `brandProfile.logoVariantUrl`), todos com nomes que não refletem seu conteúdo real.

## Goals / Non-Goals

**Goals:**

1. Centralizar a resolução da identidade no backend: cliente envia apenas `storeId`, backend resolve dados frescos
2. Expor `identityState` como campo canônico no `StoreIdentitySnapshot`
3. Unificar o canal de asset visual em `signature.url`, eliminando `logoUrl`/`visualSignatureUrl`/`logoVariantUrl`
4. Derivar a `directive` do prompt a partir de `(identityState, asset presence)` — nunca fixa
5. Validar a acessibilidade da URL do asset **antes** de montar o prompt, garantindo consistência
6. Preservar o brand profile como direção criativa independentemente do estado de identidade
7. Corrigir o fallback do provider para preservar a identidade visual
8. Normalizar preview legado em sessionStorage

**Non-Goals:**

- Ajustes criativos no prompt `campaign-image-director.md` (hierarquia, composição, copy) — fora de escopo
- Phase 5 pós-geração (Review, Adjust & Export) — futura
- Sistema de planos, auth, dashboard
- Refatoração do `campaign-renderer.tsx` além da migração para `signature`

## Decisions

### D01 — Resolução de identidade no backend

**Decisão:** O cliente envia apenas `storeId` + dados do produto no `POST /api/campaign/generate-image`. O backend lê a loja, resolve o brand profile e o asset, valida a referência, deriva a directive, e monta o `CampaignBrief`.

**Alternativa considerada:** Manter o modelo atual (cliente resolve e envia dados pré-montados). Rejeitada porque:
- A resolução ocorria 3 vezes no mesmo fluxo
- Os dados podiam estar stale entre o carregamento da página e o submit
- A duplicação de responsabilidade (cliente + backend) dificultava manter coerência

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

### D02 — `validateIdentityReference` antes do briefing

**Decisão:** `validateIdentityReference(snapshot: StoreIdentitySnapshot): Promise<StoreIdentitySnapshot>` é chamada entre a resolução e o builder. Retorna uma cópia do snapshot. Se o fetch HEAD/GET da `signature.url` falhar, a cópia tem `signature.url = null` e um diagnóstico é registrado. O builder nunca recebe uma URL que não pode ser carregada.

**Alternativa considerada:** Deixar o provider tentar carregar a URL e degradar silenciosamente se falhar. Rejeitada porque o prompt já teria sido montado com directive "usar identidade" — inconsistência entre instrução e asset disponível.

### D03 — `identityImageUrl` como canal único de asset

**Decisão:** Um único campo `identityImageUrl` substitui três (`logoUrl`, `visualSignatureUrl`, `brandProfile.logoVariantUrl`). O campo carrega a URL do logo ou da VS dependendo do `identity_state`, ou `null` se não houver asset. O nome genérico `identityImageUrl` evita associar semanticamente a logo ou VS.

**No ImageProviderInput:** `logoImageUrl` → `identityImageUrl`
**No GenerateImageRequestSchema:** removido (`storeLogoUrl` deixa de existir)

### D04 — Directive derivada de (state, asset presence)

**Decisão:** A directive textual injetada no prompt é determinada pelo par `(identityState, signature.url !== null)`, não pelo state isoladamente. São 5 cenários (tabela no alignment doc). A `buildCampaignBrief()` é responsável por essa derivação — `resolveStoreIdentity()` retorna state + asset, sem directive.

**Impacto no prompt:** A instrução fixa "A loja possui um logotipo real..." desaparece. Em seu lugar, `{{identityDirective}}` é injetado com o texto adequado ao cenário.

### D05 — Brand profile preservado independentemente do estado

**Decisão:** O brand profile `synced` (único por constraint de unicidade) é sempre usado como direção criativa, qualquer que seja o `identity_state`. Se `source` for incompatível com o estado atual (ex.: `source = logo_analysis` com `identity_state = text_only` após remoção do logo), um diagnóstico é registrado mas o perfil é aplicado normalmente.

O brand profile **deve sempre ser entregue e considerado pelo diretor como direção criativa**. Nenhum campo individual do perfil (`visual_style`, `visual_tone`, `brand_personality`, `campaign_guidelines`, `campaign_brief`, `safe_color_tokens`) é uma instrução visual obrigatória — sua tradução na composição permanece sob julgamento do diretor.

**Alternativa considerada:** Restringir o brand profile ao `source` compatível com o estado (ex.: `text_only` usa só `text_only`). Rejeitada porque remove a direção criativa quando a loja remove um logo ou VS — exatamente os cenários onde a direção visual é mais valiosa.

### D06 — `CampaignBrief` como tipo interno, sem Zod

**Decisão:** `CampaignBrief` é um tipo TypeScript puro, construído e consumido exclusivamente no backend. A validação de entrada externa (Zod) fica no `GenerateImageRequestSchema` (o request do cliente). O `CampaignBrief` é montado por `buildCampaignBrief()` e consumido pelo `ImageGenerationService`.

### D07 — Fallback corrigido com `[productFile, identityFile]`

**Decisão:** No `fallbackToImageApi()`, o provider recebe a URL de identidade já validada pela etapa anterior, faz fetch para obter o arquivo, converte com `toFile`, e envia ambos os arquivos (`productFile`, `identityFile`) para `images.edit`.

**Contexto:** Atualmente, `attempt >= 1` no `OpenAIImageProvider` cai no fallback que envia apenas o produto. A validação prévia garante que a URL é acessível, então o fetch no fallback é seguro — se falhar, é erro controlado.

### D08 — Erro controlado após validação

**Decisão:** Após `validateIdentityReference()` confirmar que a URL do asset é acessível, qualquer falha do provider ao carregá-la durante a execução (timeout de storage, erro HTTP) é tratada como **erro controlado** — retorna erro ao cliente. Não há degradação silenciosa (continuar sem asset com prompt já montado pedindo identidade).

**Justificativa:** O prompt nesse ponto já foi montado com directive "usar identidade". Remover o asset sem ajustar a directive criaria inconsistência. A degradação silenciosa só é possível na etapa anterior ao `buildCampaignBrief()`.

### D09 — `GET /api/store/:id` enriquecido

**Decisão:** O endpoint passa a retornar `Store + StoreIdentitySnapshot` em uma única resposta. `CampaignPageClient` e `StoreIdentityBlock` deixam de chamar `resolveStoreIdentity` separadamente — consomem os dados já resolvidos do endpoint.

### D11 — Preservação comportamental do diretor

**Decisão:** `CampaignBrief` é uma agregação de dados, não uma nova estratégia criativa. As seguintes invariantes são mantidas:

- Todos os campos não relacionados à identidade mantêm exatamente os valores atuais
- Campos ausentes continuam ausentes — `hook`, `cta`, `objective`, `campaignDetails`, `additionalDetails`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints` não ganham defaults novos
- `inputValidationOverride` continua sendo controle técnico, sem reinterpretação
- Subsegmento, posicionamento, descrição curta e slogan **não são adicionados ao prompt nesta fase** — embora estejam no `CampaignBrief.store`, são campos de direção de loja, não de briefing criativo
- Brand profile mantém a nota atual de "contexto direcional, não obrigatório"
- `buildPromptVariables()` preserva todas as variáveis e regras atuais, alterando somente a directive de identidade e o asset enviado ao provider
- `campaign-image-director.md` muda **apenas** na instrução fixa de logotipo (→ `{{identityDirective}}`) — nenhuma regra de composição, hierarquia ou estilo é alterada

**Pipeline corrigido:**
```
resolveStoreIdentity(storeId)
  → StoreIdentitySnapshot
    ↓
validateIdentityReference(snapshot)
  → StoreIdentitySnapshot (cópia)
    ↓
buildCampaignBrief(snapshot, campaignInput)
  → CampaignBrief (directive já derivada)
    ↓
ImageGenerationService.generateImage(CampaignBrief)
```

Onde `campaignInput` contém todos os campos de entrada do cliente não derivados da loja — `productName`, `originalPriceCents`, `discountedPriceCents`, `badgeText`, `description`, `productImageDataUrl`, `inputValidationOverride`, `hook`, `cta`, `objective`, `campaignDetails`, `additionalDetails`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`.

### D10 — Normalização de preview legado

**Decisão:** A página `/campaign/preview` detecta a ausência de `identityState` no `PreviewPayload` (formato anterior ao deploy) e normaliza silenciosamente: deriva `identityState` e `signature` de `logoUrl` (→ `'logo'`), `visualSignatureUrl` (→ `'visual_signature'`) ou nenhum ativo (→ `'text_only'`). O preview nunca é descartado — a normalização garante exibição sem crash.

## Risks / Trade-offs

### R01 — Validação prévia adiciona latência

O fetch HEAD/GET da URL do asset adiciona RTT ao fluxo de geração. Para assets em storage CDN (Supabase), o impacto esperado é <200ms. Se o storage estiver lento, o timeout precisa ser configurado conservadoramente.

→ **Mitigação:** timeout curto (3-5s). Se exceder, tratar como "irrecuperável" e prosseguir com `signature.url = null` (a campanha é gerada sem o asset, com directive "não inventar"). A latência extra ocorre apenas na etapa de validação, não na geração da imagem.

### R02 — Fidelidade do asset na imagem gerada

A OpenAI recebe logo/VS como `input_image` na Responses API, mas o modelo pode não reproduzir o asset com fidelidade exata — especialmente detalhes finos, texto pequeno ou cores de borda.

→ **Mitigação:** O prompt instrui fidelidade ao asset de referência. Não há garantia contratual de reprodução pixel-perfeita. Limitação inerente da geração por IA, documentada como tal.

### R03 — Quebra de previews salvos

Previews em sessionStorage antes do deploy têm `storeIdentity` no formato antigo (sem `identityState`). Se não forem tratados, a página de preview pode crashar ao tentar acessar `identityState` inexistente.

→ **Mitigação:** Normalização na página de preview (detecta formato legado, exibe sem a nova diretiva). Baixo impacto.

### R04 — Coerência entre `identity_state` e assets persistidos

Se o storage de assets for manipulado fora do fluxo da aplicação (deleção manual, expiração de bucket), `identity_state` pode apontar para um asset inexistente. A `validateIdentityReference()` detecta o problema, mas não corrige o estado persistido.

→ **Mitigação:** A degradação é segura (a campanha é gerada sem asset com directive "não inventar", estado não alterado). Múltiplas ocorrências no log indicam corrupção de dados que merece investigação separada.

### R05 — Provider fallback ainda depende de fetch da URL

O fallback `images.edit` precisa buscar a URL validada e convertê-la com `toFile`. Se o storage estiver acessível na validação mas inacessível segundos depois no fallback, o provider retorna erro controlado ao cliente.

→ **Mitigação:** A validação prévia minimiza essa janela. O erro controlado é preferível à degradação silenciosa. O cliente pode tentar novamente.

## Critério de Regressão

Um teste de paridade deve validar que, para a mesma entrada de uma loja com logo, o prompt produzido antes e depois da fase permanece equivalente em todos os campos, regras criativas e contexto — exceto pela nova representação/diretiva de identidade.

Para lojas `text_only` e `visual_signature`, apenas a instrução e a imagem de identidade podem diferir. Nenhuma variável de campanha, regra de composição, guideline de segmento ou contexto criativo deve ser alterado.
