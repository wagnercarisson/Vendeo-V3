# Phase 40: Campos Comerciais e Avisos do Brief — Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-40-campos-comerciais-avisos-brief/`)

<domain>
## Phase Boundary

A F39 estruturou o domínio `CampaignBrief` e deixou o backend **~90% pronto** para os campos comerciais e avisos — mas **sem UI**: o form nunca envia `validity`, `mandatoryArtworkText` é string livre sem semântica de "ligado", e os 4 prompts do diretor hardcodam o aviso ilustrativo como instrução incondicional. A F40 traz para o formulário os campos comerciais e avisos que a F39 estruturou (sem mudar contrato HTTP/domínio/snapshot), remove o hardcode incondicional dos prompts (para o checkbox ser controle real), e renumera os trackings (F40 = Campos Comerciais e Avisos do Brief, Stripe → F41).

**Estado real verificado em código:**
- `commercial.validity { enabled, displayText?, endDate? }` e `commercial.legalNotice { enabled, text? }` vivem no domínio (`src/lib/campaign/brief.ts:63,70,82-83`) e no zod (`src/lib/campaign/brief-schema.ts:36,43`)
- `buildCampaignBriefFromFlat` (`brief.ts:146`) já converte `validity` (string) → `{ enabled: true, displayText }` (`brief.ts:153-155`) e `mandatoryArtworkText` → `legalNotice { enabled: true, text }` (`brief.ts:157-159`) — ambos **nunca fabricados** quando ausentes (`brief.ts:189-190`)
- Snapshot `campaign_brief_v1` já persiste `commercial.validity`/`legalNotice` via `buildCampaignBriefSnapshot` (sem migration, `jsonb` tolerante)
- Pipeline já lê os campos: `buildPromptVariables` expõe `validity`/`mandatoryArtworkText`; `buildCommercialRepertoire` decide por `validity.enabled && displayText && campaignIntent === "offer"` → `- Oferta válida: ${displayText}` (`src/lib/image-generation/services/image-generation-service.ts:738-739`); revisor já tem `validityTextSection`/`mandatoryArtworkTextSection` com rigor literal (`src/lib/image-generation/services/image-review-service.ts:185-223`)
- **O form nunca envia `validity`** — o body do `use-campaign-form.ts` (`:625-638`) só contém `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext` (condicional), `mandatoryArtworkText`, `productImageDataUrl`
- **`mandatoryArtworkText` é string livre** (`src/components/campaign/mandatory-artwork-field.tsx`): textarea com placeholder "Ex: Imagens meramente ilustrativas", `maxLength 200`, renderizado em `src/components/flow/campaign-input-form.tsx:503-506`. **Não existe checkbox** — semântica de "ligado" confundida com "string não vazia"
- **Os 4 prompts do diretor hardcodam o aviso como instrução incondicional** (herança UAT-3): `prompts/campaign-image-director.md:130`, `-offer.md:131`, `-spotlight.md:129`, `-exclusive.md:138` → "SEMPRE acrescente a arte o seguinte texto ... : 'Imagem meramente ilustrativa'". Isso contradiz a F39 D9 (`enabled=false` → nada na arte): **mesmo desmarcado, a arte exibe o aviso**. Se a F40 adicionasse o checkbox sem tocar nos prompts, o checkbox seria **no-op**
- A linha condicional do texto obrigatório já existe nos 4 prompts (`campaign-image-director.md:132`, `-offer.md:133`, `-spotlight.md:131`, `-exclusive.md:140`): "Se o campo 'Texto obrigatório na arte' estiver preenchido ({{mandatoryArtworkText}}), inclua esse texto na arte de forma visível e legível... Não o repita na legenda." — **mantida** na F40
- `CopyDirectorInput` (`src/lib/copy/schema.ts`) **não recebe** `validity`/`legalNotice` — coerente com F25 e com o revisor ("Não repetir o texto obrigatorio em legenda; o texto e escopo da arte, nao da legenda", `image-review-service.ts:205`)
- **Inconsistência de string:** singular ("Imagem meramente ilustrativa" — prompts UAT-3 e fixtures) × plural ("Imagens meramente ilustrativas" — placeholder do form e várias fixtures). A F40 unifica numa constante (D2)
- **Campos adormecidos permanecem sem UI:** `availabilityNotes`, `campaignDetails`, `additionalDetails`, `hook`, `cta`, `objective`, `targetChannel`, `format`, `sensitiveConstraints` — já no schema HTTP/prompts/mapper, sem formulário
- **`endDate` (ISO) permanece reservado** (F39 D8): datas na UI apenas geram `displayText`; o backend continua recebendo texto final — sem envio de `endDate`

**O que esta fase entrega:**
- **Checkbox de aviso ilustrativo como controle real (D2/D6)** — checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) que injeta a constante única no `mandatoryArtworkText` final; desmarcado + sem texto → campo ausente → `legalNotice.enabled=false` → nada na arte (opt-out real)
- **Remoção do hardcode incondicional dos 4 prompts (D6)** — bloco condicional de composição no mesmo local; mantém a inteligência visual do UAT-3 (tipografia mínima, visível/legível, posição lateral, sem competir com oferta/produto/preço); conjunto de variáveis/keys do prompt permanece idêntico (golden `EXPECTED_KEYS = 38`); o texto do prompt muda intencionalmente
- **Validade da oferta em 6 modos estruturados (D4/D5)** — seção offer-only com Sem validade / Até uma data / De... até... / Somente hoje / Enquanto durarem os estoques / Texto personalizado; cada modo gera `displayText` **nu, sem prefixo** (`até 30/09`, `de 25/09 até 30/09`, `somente hoje`, `enquanto durarem os estoques`); form passa a enviar `validity: displayText` no body (hoje nunca enviado); troca de intent preserva o rascunho sem enviar
- **Transporte normalizado, UI preservada (D3)** — checkbox + texto obrigatório enviados pelo mesmo campo legado `mandatoryArtworkText` concatenados com `\n`; form state guarda `showIllustrativeNotice`/`mandatoryArtworkTextFree` separados (autosave/restore preserva a intenção); concatenação só na montagem do body
- **Constante única `ILLUSTRATIVE_NOTICE_TEXT` (D2)** — `src/lib/campaign/constants.ts` (novo, módulo neutro sem `server-only`); normaliza referências plurais; co-migração de fixtures na mesma fase
- **Agrupamento Produto / Oferta / Avisos e texto obrigatório (D8)** — Descrição permanece em Produto (inalterada); **nenhum campo adormecido ganha UI**
- **Renumeração de trackings (D1)** — F40 = Campos Comerciais e Avisos do Brief (v1.5); Stripe → F41 (v1.7). Runbook 6 arquivos (ROADMAP raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`)

## Constraints

- **NENHUMA migration SQL** (D9) — `campaign_brief_v1` reusa `commercial.validity`/`legalNotice`; sem nova chave, sem CHECK, sem mudança de contrato HTTP/domínio/snapshot (`GenerateImageRequestSchema` já aceita `validity`/`mandatoryArtworkText`)
- **Form state guarda `showIllustrativeNotice` e `mandatoryArtworkTextFree` separados** — concatenação acontece **apenas na montagem do body** (D3); autosave/restore preserva a intenção (se concatenar cedo, "checkbox marcado + texto livre" vira indistinguível de texto livre digitado com a frase)
- **Transporte normaliza para o campo legado `mandatoryArtworkText`** — checkbox marcado + texto → `"Imagem meramente ilustrativa\n<texto>"`; marcado sem texto → `ILLUSTRATIVE_NOTICE_TEXT`; desmarcado + texto → só o texto; desmarcado + sem texto → campo ausente (`undefined`)
- **Checkbox default = marcado** (D2) — preserva o comportamento atual (arte sempre exibiu o aviso via UAT-3) e a proteção legal, criando o opt-out
- **Constante única singular `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"`** em `src/lib/campaign/constants.ts` — módulo neutro, sem `server-only`, sem importar o builder/domínio do brief; prompts (arquivos `.md`) usam o mesmo literal canônico singular (garantido por teste 14)
- **`validity` é `displayText` nu sem prefixo** (D5) — as DUAS superfícies compõem o rótulo uma única vez (`buildCommercialRepertoire` → `- Oferta válida: ${displayText}` e template offer/base → `**Validade da oferta:** {{validity}}`); a F40 **não mexe em nenhuma das duas superfícies**
- **`endDate` (ISO) reservado, sem envio** (D4/F39 D8) — datas na UI apenas geram `displayText`; backend recebe texto final
- **Validade só aparece/é enviada para `campaignIntent === "offer"`** (D4) — troca para spotlight/exclusive não envia `validity` mas preserva o rascunho no form state
- **Texto personalizado — normalização leve** (D5) — limpar prefixo "Oferta válida" antes de enviar
- **Copy Director fora de escopo (D7)** — `CopyDirectorInput` não recebe `validity`/`legalNotice`; revisor sem mudança de comportamento (seções já existem)
- **Nenhum campo adormecido ganha UI (D8)** — "Detalhes da oferta/produto" = **Descrição existente** (`product.description`, `maxLength 120`, `campaign-input-form.tsx:391-422`); não criar `campaignDetails`
- **Os 4 prompts perdem o hardcode incondicional e ganham o bloco condicional (D6)** — linha condicional do texto obrigatório **mantida** nos 4
- **Campanhas antigas (pré-F40) continuam funcionando** (D9) — sem migração destrutiva
- **Artefatos históricos não são reescritos** na renumeração D1 (padrão F37 D11 / F39 D1)

## Dependencies

- F39 (Brief Estruturado de Campanha — `commercial.validity`/`commercial.legalNotice` no domínio `brief.ts:82-83`, mapper `buildCampaignBriefFromFlat` `brief.ts:146`, snapshot `campaign_brief_v1`, helper `getCampaignLegalNotice` `brief.ts:134`)
- F31.x (intents, prompts por intent, diretores, revisor, quality gate)
- F24/F25 (pipeline de créditos/generação — orquestração da rota inalterada)
- F38.2.1 (snapshot econômico — precedente de snapshot imutável)
- **Antecede a F37** (Revisão e Aprovação da Arte — consome o snapshot)
- **F41 (Stripe)** — renumerada da antiga F40 (v1.7, pós-beta) pela D1

## Key Requirements

- F40-01: Checkbox "Exibir 'Imagem meramente ilustrativa'" como controle real — default marcado, coexiste com textarea livre (D2)
- F40-02: Constante única `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` em `src/lib/campaign/constants.ts` (módulo neutro, sem server-only) + placeholder/`EMPTY_FIELDS`/fixtures normalizados (singular) (D2)
- F40-03: Form state `showIllustrativeNotice` (boolean, default true) + `mandatoryArtworkTextFree` (string) separados — autosave/restore preserva intenção; concatenação só no submit (D3)
- F40-04: Transporte normalizado — `mandatoryArtworkText` final concatenado com `\n` quando checkbox marcado; campo ausente quando desmarcado + sem texto (D3)
- F40-05: Validade 6 modos (`Sem validade`/`Até uma data`/`De... até...`/`Somente hoje`/`Enquanto durarem os estoques`/`Texto personalizado`) gerando `displayText` determinístico `dd/mm` (D4)
- F40-06: `displayText` nu sem prefixo — duas superfícies do prompt compõem o rótulo; F40 não mexe em nenhuma (D5)
- F40-07: `validity` enviado no body apenas para `offer`; troca de intent preserva rascunho sem enviar; `endDate` reservado sem envio (D4)
- F40-08: Texto personalizado — normalização leve (limpar prefixo "Oferta válida") (D5)
- F40-09: UI agrupada Produto / Oferta / Avisos e texto obrigatório; Descrição permanece em Produto; nenhum campo adormecido ganha UI (D8)
- F40-10: Seção "Validade da oferta" renderizada apenas quando `offer` (via `ValidityField`) (D4)
- F40-11: Os 4 prompts do diretor perdem a instrução incondicional "SEMPRE acrescente... Imagem meramente ilustrativa" e ganham o bloco condicional de composição (D6)
- F40-12: Linha condicional do texto obrigatório mantida nos 4 prompts (D6)
- F40-13: Golden por intent (offer/spotlight/exclusive) — conjunto de variáveis/keys idêntico (`EXPECTED_KEYS = 38`); texto do prompt muda intencionalmente (D6)
- F40-14: `legalNotice.enabled=false` → `mandatoryArtworkText` vazio no prompt e `mandatoryArtworkTextSection` vazio no revisor; `validity.enabled` + displayText (offer) → `validityTextSection` montado (D2/D6)
- F40-15: Testes — validade modos→displayText (7.x), checkbox×texto (8.x), prompt reframe (9.x), regressão e co-migração de fixtures (10.x) (~21+ testes novos)
- F40-16: Mocks do form co-migrados (`campaign-flow-credits.test.tsx` mocka `MandatoryArtworkField: () => null`; novos campos no `EMPTY_FIELDS` — `use-campaign-form-navigation.test.ts`)
- F40-17: Trackings D1 (renumeração F40/F41 nos 6 arquivos de runbook — F40 = Campos Comerciais e Avisos do Brief, Stripe → F41)
- F40-18: Verificação — `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` zero erros + UAT local (aviso default, aviso off, validade por modo, restore, troca de intent, campanha antiga)

## Out of Scope

- Ativar campos adormecidos na UI (`campaignDetails`, `additionalDetails`, `availabilityNotes`, `hook`, `cta`, `objective`, `targetChannel`, `format`, `sensitiveConstraints`) — D8
- Novo campo `campaignDetails` no form — D8 ("Detalhes da oferta/produto" = Descrição existente)
- `endDate` (ISO) estruturado no envio — D4/F39 D8 (reservado)
- Copy Director com validade/aviso na legenda — D7
- Página de campanha exibindo validade/aviso — F37 (revisão/aprovação)
- Migration SQL / mudança de contrato HTTP/domínio/snapshot — D9
- Persistência da separação checkbox/texto no snapshot — D3 (transporte normaliza para texto final)
- Catálogo de produtos por loja — fase subsequente (F39 D3)
- Stripe / Monetização Pública — F41 (v1.7, pós-beta) — renumeração D1
- F37 — Revisão e Aprovação da Arte — fase própria, após F40
</domain>

<decisions>
## Implementation Decisions

### D1 — Numeração: F40 = Campos Comerciais e Avisos do Brief (v1.5), Stripe → F41 (v1.7) + runbook de trackings
`DECIDIDO` (segue o precedente F39 D1 / F37 D11: a fase conflitante é incrementada, não apagada). Runbook de atualização em 6 arquivos (`ROADMAP` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) na ordem da D1. Artefatos históricos não reescritos; `openspec/changes/fase-40-campos-comerciais-avisos-brief/` = fonte da verdade.

### D2 — Checkbox ilustrativo coexiste com texto obrigatório; default marcado; constante única
`DECIDIDO` (rejeição da opção A1 — "substituir textarea pelo checkbox"). Quatro intenções distintas no form, sem fusão: ① Ilustrativo → checkbox (texto fixo); ② Validade → modos estruturados (D4); ③ Detalhes da oferta/produto → **Descrição existente** (D8); ④ Texto obrigatório na arte → textarea livre (campo atual mantido). Checkbox **default marcado** (preserva comportamento atual + proteção legal, criando opt-out). **Constante única** `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` (singular, alinhada ao UAT-3 e aos prompts) em `src/lib/campaign/constants.ts` — módulo **neutro** (sem `server-only`). Checkbox marcado injeta a constante no texto obrigatório final (D3); desmarcado + sem texto → campo ausente → `legalNotice.enabled=false` → nada na arte.

### D3 — Transporte normaliza para texto final; UI preserva campos distintos
`DECIDIDO` (aceita concatenação no campo legado para F40). Checkbox + texto obrigatório são enviados pelo **mesmo campo legado** `mandatoryArtworkText`, concatenados com `\n` (marcado+texto → `"Imagem meramente ilustrativa\n<texto>"`; marcado sem texto → constante; desmarcado+texto → só texto; desmarcado+sem texto → ausente). **Form state mantém os campos separados até o submit (autosave/restore):** `showIllustrativeNotice` (boolean) + `mandatoryArtworkTextFree` (string) separados; concatenação **apenas na montagem do body**. Sem mudança de contrato/backend (mapper F39 e snapshot inalterados). Sem migration SQL.

### D4 — Validade: 6 modos estruturados, visível apenas para oferta
`DECIDIDO` (validade como campo estruturado de modos, não string livre). Seção "Validade da oferta" **só aparece quando `campaignIntent === "offer"`**. Modos → geração de `displayText`: Sem validade (ausente — não envia), Até uma data → `até 30/09`, De... até... → `de 25/09 até 30/09`, Somente hoje → `somente hoje`, Enquanto durarem os estoques → `enquanto durarem os estoques`, Texto personalizado → texto do usuário (normalização leve D5). Datas estruturadas na UI mas backend recebe **texto final** — `validity: displayText` no body; `endDate` (ISO) **reservado, sem envio** (F39 D8). **Troca de intent:** se preenche validade em `offer` e troca para spotlight/exclusive, o form **não envia `validity`** mas **preserva o rascunho** (voltar a `offer` restaura).

### D5 — `displayText` frase nua sem prefixo; as superfícies do prompt compõem o rótulo
`DECIDIDO` (opção 1 — mantém backend estável). `validity.displayText` = apenas o conteúdo, sem rótulo. **Duas superfícies** compõem o rótulo uma vez: `buildCommercialRepertoire` → `- Oferta válida: ${displayText}` (`image-generation-service.ts:739`) e template offer/base → `**Validade da oferta:** {{validity}}`. Repetição informacional já existente aceita; a F40 **não mexe em nenhuma das duas superfícies**. **Texto personalizado — normalização leve:** limpar prefixo "Oferta válida" antes de enviar. Fixtures existentes com strings completas são **normalizadas** (contrato continua o mesmo: displayText livre).

### D6 — Prompt reframe: remover hardcode incondicional → bloco condicional de composição
`DECIDIDO` (refinamento do usuário sobre "remover hardcode + default marcado"). Antes: "SEMPRE acrescente a arte o seguinte texto ... : 'Imagem meramente ilustrativa'" (herança UAT-3, `campaign-image-director.md:130`, `-offer.md:131`, `-spotlight.md:129`, `-exclusive.md:138`). Depois — bloco condicional de composição no mesmo local: "Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte. Se o aviso for 'Imagem meramente ilustrativa', posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço." Mantém a inteligência visual do UAT-3 mas respeita o checkbox como controle real (`legalNotice.enabled=false` → aviso NÃO entra na arte). Linha condicional do texto obrigatório **mantida** (`campaign-image-director.md:132`, `-offer.md:133`, `-spotlight.md:131`, `-exclusive.md:140`). Escopo ampliado para prompt engineering + testes de regressão por intent (offer/spotlight/exclusive) — inevitável: manter o hardcode faz o checkbox mentir; remover sem instrução perde qualidade visual.

### D7 — Copy Director fora de escopo (validade e aviso são da arte/review)
`DECIDIDO` (coerente com F25 e revisor). `CopyDirectorInput` **não recebe** `validity`/`legalNotice` (sem mudança em `src/lib/copy/schema.ts`). Validade e aviso são informação da **arte**, não da legenda — revisor já instrui ("Não repetir o texto obrigatorio em legenda", `image-review-service.ts:205`).

### D8 — "Detalhes da oferta/produto" = Descrição existente; sem novo `campaignDetails`
`DECIDIDO` (esclarecimento do usuário — reusar a Descrição, não criar campo novo). "Detalhes da oferta/produto" = **Descrição existente** (`product.description`, `maxLength 120`, `campaign-input-form.tsx:391-422`). **Nenhum campo adormecido ganha UI** (`campaignDetails`/`additionalDetails`/`availabilityNotes`/`hook`/`cta`/`objective`/`targetChannel`/`format`/`sensitiveConstraints`). **Agrupamento alvo da UI** (orientativo): Produto (Nome, Descrição) / Oferta (Preço, Condição/benefício, Validade da oferta) / Avisos e texto obrigatório (checkbox + textarea).

### D9 — Snapshot sem mudança de contrato
`DECIDIDO` (reuso do que a F39 já construiu). `campaign_brief_v1` continua como está: `commercial.validity` (via `validity` no body) e `commercial.legalNotice` (via `mandatoryArtworkText` concatenado) — **sem nova chave, sem migration**. `getCampaignLegalNotice` (`brief.ts:134`, testado) permanece o helper canônico. Snapshot registra o **texto final** (concatenado/quando aplicável); a UI é quem preserva os campos distintos (D3).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte da verdade (OpenSpec F40)
- `openspec/changes/fase-40-campos-comerciais-avisos-brief/proposal.md` — Why / What Changes / Impact
- `openspec/changes/fase-40-campos-comerciais-avisos-brief/design.md` — decisões D1–D9 (contexto real em código nas linhas 3-15)
- `openspec/changes/fase-40-campos-comerciais-avisos-brief/tasks.md` — 11 seções de tarefas (1 trackings … 11 verificação; testes numerados 1–21)
- `openspec/changes/fase-40-campos-comerciais-avisos-brief/specs/campaign-input-ui/spec.md` — agrupamento + body do submit (validity/concatenado)
- `openspec/changes/fase-40-campos-comerciais-avisos-brief/specs/illustrative-notice-control/spec.md` — checkbox controle real + constante + transporte + autosave/restore
- `openspec/changes/fase-40-campos-comerciais-avisos-brief/specs/offer-validity-modes/spec.md` — 6 modos → displayText; visibilidade offer-only; displayText nu; envio validity
- `openspec/changes/fase-40-campos-comerciais-avisos-brief/specs/mandatory-artwork-text/spec.md` — dois campos coexistindo; placeholder constante; propagation no Image Director/snapshot
- `openspec/changes/fase-40-campos-comerciais-avisos-brief/specs/ai-image-generation/spec.md` — prompt reframe (bloco condicional) + EXPECTED_KEYS = 38 + legalNotice/validity no revisor

### Código afetado (estado real verificado)
- `src/lib/campaign/brief.ts` — `commercial.validity`/`legalNotice` (63,70,82-83), `buildCampaignBriefFromFlat` (146,153-159,189-190), `getCampaignLegalNotice` (134) — **NÃO muda nesta fase**
- `src/lib/campaign/brief-schema.ts` — zod validity/legalNotice (36,43) — **NÃO muda**
- `src/components/flow/use-campaign-form.ts` — `CampaignFormFields` (84), `EMPTY_FIELDS` (133), body do submit (625-638 — ganha `validity` + concatenação), `mandatoryArtworkText` no frozen/required (575,598), reset (652)
- `src/components/flow/campaign-input-form.tsx` — `MandatoryArtworkField` (503-506), Descrição (391-422), agrupamento de seções, seção "Validade da oferta" offer-only, checkbox + textarea coexistindo
- `src/components/campaign/mandatory-artwork-field.tsx` — placeholder "Ex: Imagens meramente ilustrativas" → usa a constante (singular), `maxLength 200` mantido
- `src/components/campaign/illustrative-notice-field.tsx` — **NOVO** (checkbox "Exibir 'Imagem meramente ilustrativa'", default marcado, estilos do design system)
- `src/components/campaign/validity-field.tsx` — **NOVO** (6 modos → displayText)
- `src/lib/campaign/constants.ts` — **NOVO** (`export const ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"`, módulo neutro sem `server-only`)
- `prompts/campaign-image-director.md` (130/132), `-offer.md` (131/133), `-spotlight.md` (129/131), `-exclusive.md` (138/140) — hardcode → bloco condicional; linha condicional mantida
- `src/lib/image-generation/services/image-generation-service.ts` — `buildCommercialRepertoire` (738-739) — **NÃO muda** (D5)
- `src/lib/image-generation/services/image-review-service.ts` — `validityTextSection`/`mandatoryArtworkTextSection` (185-223), "Não repetir o texto obrigatorio em legenda" (205) — **NÃO muda**
- Testes: `src/lib/campaign/__tests__/brief.test.ts`, `src/lib/campaign/__tests__/brief-mapper.test.ts`, `src/components/flow/__tests__/use-campaign-form-navigation.test.ts`, `src/app/api/campaign/generate-image/__tests__/route.test.ts`, `src/lib/image-generation/services/__tests__/image-generation-service.test.ts`, `.../image-review-service.test.ts`, `src/components/flow/__tests__/campaign-flow-credits.test.tsx` (mock `MandatoryArtworkField: () => null`)

### Design system
- `openspec/design-system/MASTER.md` — princípios do design system
- `openspec/design-system/pages/campaign-input.md` — página do formulário de campanha (checkbox/validade seguem os estilos existentes do form)

### Precedentes
- `.planning/phases/39-brief-estruturado-campanha/` — domínio/snapshot da F39 (fonte dos campos `validity`/`legalNotice`)
- `.planning/phases/38.2.1-economic-snapshot/` — snapshot imutável (padrão F38.2.1)
- `.planning/phases/31-1-modelo-comercial-formulario/` — formulário de campanha existente (31-1-01..05)
</canonical_refs>

<specifics>
## Specific Ideas

- **D1 runbook já aplicado nesta sessão de planejamento (ciclo 1):** os 6 arquivos de tracking foram atualizados (F40 = Campos Comerciais e Avisos do Brief, Stripe → F41) e a seção "### Phase 40 — Campos Comerciais e Avisos do Brief" foi adicionada ao `.planning/ROADMAP.md`. O plano de trackings (F40-17) deve **verificar** a consistência (grep de resíduos Stripe-as-F40) e registrar o commit, não reescrever
- **Bloco condicional de composição (D6) — texto exato:**
  ```
  Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte.
  Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.
  ```
- **Concatenação do body (D3):** `mandatoryArtworkText` final = checkbox + texto livre com `\n`; o estado do form guarda `showIllustrativeNotice` e `mandatoryArtworkTextFree` separados até o submit
- **displayText por modo (D4):** `até 30/09`, `de 25/09 até 30/09`, `somente hoje`, `enquanto durarem os estoques`, personalizado (normalizado); data em `dd/mm`
- **EXPECTED_KEYS = 38 (golden por intent)** — conjunto de variáveis/keys idêntico para o mesmo input; o texto do prompt muda intencionalmente (D6); regressão por intent (offer/spotlight/exclusive)
- **`validity` nunca enviado para intents ≠ offer** — mas o rascunho é preservado no form state (D4)
- **Placeholder do textarea:** referencia `ILLUSTRATIVE_NOTICE_TEXT` (singular) — remove "Ex: Imagens meramente ilustrativas"
- **Mock co-migração:** `campaign-flow-credits.test.tsx` mocka `MandatoryArtworkField: () => null` — novos campos no `EMPTY_FIELDS` quebram `use-campaign-form-navigation.test.ts`
- **UAT visual obrigatório antes de fechar a fase** — checkbox default → aviso como hoje; desmarcado → arte sem aviso; validade por modo sem duplicação de "Oferta válida"
</specifics>

<deferred>
## Deferred Ideas

- Ativar campos adormecidos na UI (`campaignDetails`/`additionalDetails`/`availabilityNotes`/`hook`/`cta`/`objective`/`targetChannel`/`format`/`sensitiveConstraints`) — D8
- `endDate` (ISO) estruturado no envio — D4/F39 D8
- Copy Director com validade/aviso na legenda — D7
- Página de campanha exibindo validade/aviso — F37 (revisão/aprovação)
- Persistência da separação checkbox/texto no snapshot — D3 (transporte normaliza para texto final)
- Migration SQL / mudança de contrato — D9
- Catálogo de produtos por loja — fase subsequente (F39 D3)
- Stripe / Monetização Pública — F41 (v1.7, pós-beta) — renumeração D1
- F37 — Revisão e Aprovação da Arte — fase própria, após F40
</deferred>
