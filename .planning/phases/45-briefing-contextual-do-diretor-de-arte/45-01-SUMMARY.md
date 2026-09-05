---
phase: 45-briefing-contextual-do-diretor-de-arte
plan: 01
subsystem: docs
tags: [runbook, roadmap, f45, tracking, consumer-inventory, baseline, art-director-briefing]

# Dependency graph
requires:
  - phase: fase-45-briefing-contextual-do-diretor-de-arte
    provides: OpenSpec F45 source of truth (D-trackings renumbering decision, applied in commit 371077f7 during planning cycle; D1/D2/D5/D7 design decisions)
provides:
  - Grep-verification of F45/F44/Stripe tracking consistency across the 5 runbooks (ROADMAP raiz, .planning/ROADMAP.md, .planning/STATE.md, .planning/PROJECT.md, AGENTS.md) — zero current-state residue
  - Consumer inventory (decision table manter/remover/mover) of the 10 dead/orchestration keys of the buildPromptVariables map (D1 prerequisite for key removal in 45-03)
  - Baseline of frozen surfaces (D7 non-change register: reviewer, Copy Director, OpenAI fallback, GenerateImageRequestSchema, form helpers, domain/snapshot)
  - Baseline of current tests (golden 39 keys per intent, validatePrompts, prompt-reframe) + decision to keep the base campaign-image-director.md in sync
affects: [phase 45 execution (45-02 helper extraction, 45-03 offer rewrite + transitional key map, 45-05 test co-migration), F44 (Temas de Campanha) planning, F37 planning]

# Tech tracking
tech-stack:
  added: []
  patterns: [grep-verification of runbook consistency with precise current-state residue patterns (no generic wildcards), consumer grep before key removal, frozen-surface non-change register]

key-files:
  created: [.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-01-SUMMARY.md]
  modified: []

key-decisions:
  - "D-trackings verificado (não reescrito): F45 = Briefing Contextual do Diretor de Arte (v1.5) = próxima fase numerada após F43; F44 = Temas de Campanha permanece fora da numeração (adicionada pelo runbook da própria F44); Stripe/Monetização Pública fora da numeração (iniciativa diferida v1.7+) — zero resíduos de estado atual nos 5 runbooks"
  - "Inventário de consumidores (D1): das 10 chaves do mapa de buildPromptVariables, apenas campaignIntent é consumida em runtime (assemblePrompt :1010) e identityImageUrl é provider-only; as outras 8 (commercialFrame, hasCategoryConflict, brandColorsChosen, visualStyle, visualTone, brandPersonality, campaignGuidelines, campaignBrief) NÃO são placeholders dos 4 .md do diretor — decision table registrada para remoção/realocação no 45-03"
  - "Base campaign-image-director.md MANTIDA em sync como referência offer/geral (lida por teste prompt-reframe.test.ts :10-15; não usada pelo runtime que seleciona campaign-image-director-${intent} em assemblePrompt :1010-1011)"

patterns-established:
  - "Runbook consistency check precedente F43: historical renumbering notes never rewritten; only current-state markers checked; source of truth = OpenSpec"
  - "Dead-key removal gate: only remove buildPromptVariables keys after consumer inventory (this plan) — 45-03 uses this table"

requirements-completed: [F45-01, F45-02, F45-03, F45-04]

# Metrics
duration: 35min
completed: 2026-09-02
---

# Plan 45-01: Trackings + Inventário de Consumidores + Baselines Summary

**Grep-verificação dos 5 runbooks (F45 = Briefing Contextual do Diretor de Arte v1.5 em planejamento; F44 = Temas fora da numeração; Stripe fora da numeração) com zero resíduos de estado atual, inventário de consumidores das 10 chaves candidatas do mapa de `buildPromptVariables` (tabela de decisão manter/remover/mover — base factual do D1), baseline de não-mudança das superfícies congeladas (D7) e baseline dos testes atuais (golden 39 keys, validatePrompts, prompt-reframe) + decisão de manter o arquivo base `campaign-image-director.md` em sync (D2/D5)**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-02
- **Completed:** 2026-09-02
- **Tasks:** 3 (1.1 grep-verificação; 1.2 inventário de consumidores; 1.3+1.4 baselines + SUMMARY)
- **Files modified:** 1 (apenas este SUMMARY — zero edições de código, zero edições de runbook)

## Accomplishments

### 1.1 — Grep-verificação de trackings F45/F44/Stripe (Task 1)
- Grep de **padrões precisos de resíduo de estado atual** nos 5 runbooks (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `AGENTS.md`) → **0 ocorrências reais**:
  - `F45 = Stripe`, `Phase 45 (Stripe`, `fase-45-stripe`, `| 45 |.*Stripe` (célula de Progress) → **zero** nos 5 arquivos
  - `| 44 |`, `Phase 44 (`, `fase-44`, `44-briefing`, `| 44 |.*Temas` (linha numerada F44 na Progress) → **zero** nos 5 arquivos
  - Únicas ocorrências de "F44" são as **exceções documentadas** (contexto "fora da numeração / adicionada pelo runbook da própria F44"): `.planning/ROADMAP.md` nota Phase numbering (:7), seção Phase 45 (:861), nota Fora-da-numeração (:980), rodapé Last updated (:1065); `.planning/STATE.md` (:19, :535); `.planning/PROJECT.md` (:52); `AGENTS.md` (:202). Menções históricas em fases concluídas (F40/F41/F43) intocadas.
  - **Nota de verificação:** o snippet de verify do plano retornou 1 "hit" em `AGENTS.md [\| 45.*Stripe]` (L194) — **falso positivo**: a linha é a linha de **tabela de planos** `| 45-01 | 1 | ... Trackings — grep-verificação F45/F44/Stripe (registro 371077f7) ...`, onde "Stripe" aparece na **descrição da tarefa de verificação de trackings**, não em uma linha de Progress `| 45 |` atribuindo Stripe à F45. Com padrão de fronteira de célula (`| 45 |.*Stripe`, `| 45-...`), zero ocorrências. Nenhum resíduo real; nenhuma edição.
- **Confirmação positiva por rótulo/valor:**
  - `ROADMAP.md` raiz: linha Progress `| 45. Briefing Contextual do Diretor de Arte | v1.5 | 0/7 | ◆ Planned` (L252) e `| —. Monetização pública / Stripe (diferida, v1.7+) | v1.7 | — | Fora da numeração | —` (L253)
  - `.planning/ROADMAP.md`: nota "Phase numbering" (:7) com `**F45 = Briefing Contextual do Diretor de Arte (v1.5)**` e `**F44 = Temas de Campanha permanece fora da numeração**`; seção `### Phase 45: Briefing Contextual do Diretor de Arte` (:859) com Goal/Success criteria; linha Progress `| 45 | ○ Briefing Contextual do Diretor de Arte (v1.5) | 0/7 | Planned` (:44) e `| — | Monetização pública / Stripe ... | Fora da numeração |` (:45)
  - `.planning/STATE.md`: frontmatter `current_phase: 45` (:5); linha "F45 (Briefing Contextual do Diretor de Arte, v1.5) EM PLANEJAMENTO" (:19); stopped_at (:14) com F44/Stripe fora da numeração
  - `.planning/PROJECT.md`: linha 52 "Briefing Contextual do Diretor de Arte (F45, v1.5) — EM PLANEJAMENTO" com numeração F44/Stripe
  - `AGENTS.md`: bloco `## Phase 45 — Briefing Contextual do Diretor de Arte` (:185) com "Status: Em planejamento — 7/7 plans escritos" (:187)
- **Registro D-trackings confirmado:** commit `371077f7` ("docs(fase 45): registra F45 = Briefing Contextual do Diretor de Arte (v1.5) nos trackings...") tocou exatamente os 5 arquivos de runbook — consistente.
- **Nenhum arquivo editado** — consistência já estava aplicada no ciclo de planejamento (registro 371077f7).

### 1.2 — Inventário de consumidores das chaves do mapa de `buildPromptVariables` (Task 2)
Grep de consumidores nas 10 chaves candidatas (`commercialFrame`, `hasCategoryConflict`, `brandColorsChosen`, `visualStyle`, `visualTone`, `brandPersonality`, `campaignGuidelines`, `campaignBrief`, `identityImageUrl`, `campaignIntent`) em `src/` (runtime), `prompts/` (templates) e testes — **sem alterar código**.

**Achado central:** **nenhuma das 10 chaves é `{{placeholder}}` em nenhum dos 4 templates do diretor** (`campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md`). Os placeholders reais desses templates são 26-29 chaves por intent (oferta: inclui `discountedPrice`/`originalPrice`/`validity`; spotlight/exclusive: sem `validity`; base: como offer). As 10 chaves inventariadas são mortas para interpolação direta OU de orquestração/provider.

**Tabela de decisão (manter / remover / mover — referência do 45-03 e 45-05):**

| Chave | Linha mapa | Consumidor runtime (evidência) | Consumidor template diretor | Consumidor Copy Director | Consumidor testes | Decisão |
|---|---|---|---|---|---|---|
| `campaignIntent` | :979 | **assemblePrompt :1010** `variables.campaignIntent ?? "offer"` → seleciona `campaign-image-director-${intent}` (:1011) | nenhum | — (copy tem o próprio via mapper :108) | asserts :599/:611/:622 + EXPECTED_KEYS :563 | **MANTER** (orquestração — seleção de arquivo) |
| `identityImageUrl` | :977 | entregue ao provider via `generateWithRetry` (param :1053, repassado :1106) → `providers/openai.ts` :86-87 (Responses `input_image`) e :318-322 (fallback `images.edit`); nunca interpolada | nenhum (provider-only — spec ai-image-generation :513) | — | EXPECTED_KEYS :563 | **MANTER provider-only fora do template** (não é chave de interpolação textual; identidade entra só como `identityReferenceSection` textual — D5) |
| `commercialFrame` | :983 | nenhum no service (só construção do mapa) | **nenhum** nos 4 .md do diretor | **Copy Director tem builder próprio** `buildCommercialFrame` (copy/mapper.ts:6; copy-director-service.ts:72) + placeholder `{{commercialFrame}}` em `campaign-copy-director*.md` | EXPECTED_KEYS :564 + assert de valor :623 | **REMOVER** do `buildPromptVariables` do diretor (D1: "commercialFrame sai do buildPromptVariables do diretor — o copy director tem builder próprio") |
| `hasCategoryConflict` | :997 | nenhum (o booleano `hasConflict` :904-906 é usado internamente para `categoryConflictDirective` :911-913 e `buildCreativeContextGuidance` :917 — a chave string "sim"/"nao" não é lida fora do mapa) | nenhum | — | EXPECTED_KEYS :566 | **REMOVER** (chave morta; conflito já é veiculado pela diretiva textual `categoryConflictDirective`) |
| `brandColorsChosen` | :987 | nenhum no service além do mapa | **nenhum** | — | EXPECTED_KEYS :564 | **REMOVER do mapa** / conteúdo realocado para direção criativa via bloco contextual (D3: brand profile → `creativeDirectionSection`; `buildBrandProfileSection` :1209-1246 já cobre `Cores da marca`) |
| `visualStyle` | :988 | nenhum além do mapa | nenhum | — | EXPECTED_KEYS :564 | **REMOVER do mapa** / mover para direção criativa (D3) — coberto por `buildBrandProfileSection` (linha `Estilo visual`) |
| `visualTone` | :989 | nenhum além do mapa | nenhum | — | EXPECTED_KEYS :565 | **REMOVER do mapa** / mover para direção criativa (D3) — coberto por `buildBrandProfileSection` (linha `Tom visual`) |
| `brandPersonality` | :990 | nenhum além do mapa | **nenhum** no diretor | **placeholder real no Copy Director** (`{{brandPersonality}}` em `campaign-copy-director*.md` :20/:66), alimentado pelo mapper do copy (copy/mapper.ts:115), NÃO pelo mapa do diretor | EXPECTED_KEYS :565 | **REMOVER do mapa do diretor** / mover para direção criativa (D3) — coberto por `buildBrandProfileSection` (linha `Personalidade da marca`) |
| `campaignGuidelines` | :991 | nenhum além do mapa | **nenhum** no diretor | **placeholder real no Copy Director** (`{{campaignGuidelines}}` em `campaign-copy-director*.md` :21/:70, via copy/mapper.ts:116) | EXPECTED_KEYS :565 | **REMOVER do mapa do diretor** / mover para direção criativa (D3) — coberto por `buildBrandProfileSection` (linha `Diretrizes de campanha`) |
| `campaignBrief` | :992 | nenhum além do mapa (cuidado: símbolos de domínio homônimos `CampaignBrief`/`buildCampaignBrief` em brief.ts/store-identity-service.ts/route são de domínio, não a chave) | nenhum | — | EXPECTED_KEYS :565 | **REMOVER do mapa** / mover para direção criativa (D3) — coberto por `buildBrandProfileSection` (linha `Brief do Diretor de Marca`) |

Nota transversal: `brandProfileSection` (chave interpolada de verdade — `{{brandProfileSection}}` nos 4 .md) é construída por `buildBrandProfileSection` (:1209-1246) a partir **dos mesmos campos** `campaign_guidelines`/`campaign_brief`/`brand_personality`/`visual_style`/`visual_tone`/`brand_colors_chosen` — ou seja, as 6 chaves cruas de brand profile do mapa são **redundantes** com o bloco já montado. A decisão de "mover" significa: na nova montagem contextual (45-03), o conteúdo de brand profile viverá dentro da direção criativa (como foundation direcional condicional — D3), e não como chaves cruas avulsas.

A tabela acima é a **referência factual** para o 45-03 (remoção/realocação de chaves no mapa + delegação ao módulo `art-director-briefing.ts`) e para o 45-05 (co-migração dos testes golden de key-set). Nenhuma linha de código foi alterada nesta task.

### 1.3 — Baseline de superfícies congeladas (Task 3a)
Superfícies **congeladas (D7 — somente leitura na F45)**, confirmadas por grep de existência/papel:

| Superfície congelada | Arquivo(s) | Papel na F45 |
|---|---|---|
| Revisor de imagem | `src/lib/image-generation/services/image-review-service.ts` (builders de seção com heading no valor, ex. `buildMandatoryArtworkTextSection`; `sanitizePromptText` :186-188) + `prompts/campaign-image-reviewer.md` | **Referência de padrão** (não muda); revisor não muda (D7) |
| Copy Director | `src/lib/copy/mapper.ts` (`buildCommercialFrame` :6), `copy-director-service.ts`, `schema.ts` + `prompts/campaign-copy-director*.md` (4 arquivos) | Congelado — dono do `commercialFrame` e dos placeholders `brandPersonality`/`campaignGuidelines` (via mapper próprio); não muda |
| Fallback OpenAI | `src/lib/image-generation/providers/openai.ts` (Responses N `input_image` + fallback `images.edit` — quick 260902-mqj) | Congelado — fora do escopo; consome `identityImageUrl` provider-only |
| Schema HTTP | `src/lib/image-generation/schema.ts` (`GenerateImageRequestSchema` :20) | Congelado — contrato externo intacto (D5/D7) |
| Helpers do form | `src/components/flow/use-campaign-form.ts` — `buildValidityDisplayText` :379, `buildMandatoryArtworkText` :405, `buildCampaignGenerationBody` :466 | Congelados (D7) |
| Domínio/snapshot | `src/lib/campaign/brief.ts` (`CampaignBrief`, `buildCampaignBriefFromFlat`, `buildCampaignBriefSnapshot`), `brief-schema.ts`, `src/components/campaign/types.ts` | Somente leitura (D7) — sem migration, sem mudança de contrato |
| Identidade (só se necessário) | `src/lib/store-identity-service.ts` (`deriveDirective` :8-25) | Texto de preservação explícita "só se necessário" (fora do escopo default) |
| Validação/interpolação | `src/lib/image-generation/services/prompt-validator.ts` (`validatePrompt` :8-32) + `prompt-loader.ts` (:29-45) | Contrato mantido: zero placeholders não resolvidos; sem engine condicional (D4) |

### 1.4 — Baseline de testes atuais + decisão do arquivo base (Task 3b)
- **Golden tests por intent — `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` :556-708:** describe "golden tests por intent (8.16/8.17/8.18, F39-15/F39-19)" (:556); `EXPECTED_KEYS` :557-569 (**39 chaves** exatas); asserts de `toHaveLength(39)` e key-set por intent (offer :581-600, spotlight :602-614, exclusive :616-624, legalNotice ausente :626-638, 9.5 campos novos :640-654, F41 multi-imagem 39 keys por intent :656-675); **casos quick 260902-kqo a/b/c :677-708** (split aviso × texto livre); repertório `buildCommercialRepertoire` :710-719 (8.17).
- **validatePrompts — mesmo arquivo :65-298:** describe `ImageGenerationService.validatePrompts` (valida prompt válido, por intent, revisor com `campaignIntent` F31.3 :174, cenários offer/spotlight/exclusive); service `validatePrompts` em `image-generation-service.ts` :637-708.
- **prompt-reframe — `src/lib/campaign/__tests__/prompt-reframe.test.ts`:** lê os **4 `.md` do disco** (:6-15 `PROMPTS` inclui o base `campaign-image-director.md`); constantes/âncoras :17-22 (`LINHA_AVISO_SEPARADO`, `LINHA_MANTIDA`, `LINHA_TABELA_AVISO`, `LINHA_VALIDADE`); testes 16 (:25 — sem imposição SEMPRE fixa), 17 (:35 — instrução de aviso separado + linha mantida + linha de tabela), check A (:44 — validade em director/offer, ausente em spotlight/exclusive), check B (:51 — singular alinhado à constante), 21 (:61 — bloco descritivo 1+N F41).
- **Drift spec 38 × runtime 39 (reconciliado pela F45, design D5):** specs `openspec/specs/ai-image-generation/spec.md` ainda dizem `EXPECTED_KEYS = 38` (:748/:867/:874-877 — cenários F40/F41), enquanto o runtime/testes estão em **39** (quick 260902-kqo não passou por openspec).
- **Decisão do arquivo base `campaign-image-director.md`: MANTIDO em sync** como referência offer/geral — não é selecionado pelo runtime (`assemblePrompt` :1010-1011 usa `campaign-image-director-${intent}`), mas é **lido por teste** (`prompt-reframe.test.ts` :10-15 + checks de conteúdo :45-48), portanto não remover do runtime/testes (D2/D5; design :187 item 3).
- Fase terá **7 plans (45-01..45-07)**.

## Task Commits

1. **Task 1 (1.1): Grep-verificação de trackings F45/F44/Stripe nos 5 runbooks** — verificação apenas; nenhuma edição necessária (consistência já aplicada no registro 371077f7) → sem commit de produção
2. **Task 2 (1.2): Inventário de consumidores das 10 chaves** — grep + tabela de decisão registrada neste SUMMARY; nenhuma linha de código alterada → sem commit de produção
3. **Task 3 (1.3 + 1.4 + SUMMARY): Baselines + decisão do arquivo base + criação deste SUMMARY** — commit deste arquivo (docs)

## Files Created/Modified
- `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-01-SUMMARY.md` — Registro do plano de trackings (grep-verificação + inventário + baselines + decisão do arquivo base)
- Nenhum arquivo de runbook modificado (grep confirmou consistência — zero resíduos de estado atual)
- Nenhuma linha de código alterada (`git diff` do plano = apenas este SUMMARY)

## Decisions Made
- D-trackings verificado sem resíduos — F45 = Briefing Contextual do Diretor de Arte (v1.5) em planejamento, F44 e Stripe fora da numeração (registro 371077f7, precedente F43 D1). Artefatos históricos não reescritos.
- Inventário D1: 8 das 10 chaves candidatas são removíveis/realocáveis (não são placeholders dos 4 `.md` do diretor); `campaignIntent` mantida (orquestração); `identityImageUrl` mantida provider-only fora do template. Tabela de decisão completa no SUMMARY (referência do 45-03/45-05).
- Arquivo base `campaign-image-director.md` mantido em sync (D2/D5).

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito. Observações registradas (não são desvios):
- O snippet de verify da Task 1 retorna 1 falso positivo (`AGENTS.md [| 45.*Stripe]` na L194 — linha da **tabela de planos** 45-01 cuja descrição cita "grep-verificação F45/F44/Stripe", não uma linha de Progress). Com padrão de fronteira de célula, zero resíduos. Documentado no SUMMARY para reprodutibilidade.
- Nenhum runbook foi editado (os 5 listados em `files_modified` do plano são somente-if-resíduo; não havia resíduo real).

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- 45-01 (trackings + inventário + baselines) completo — base factual alinhada com a fonte da verdade `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/`
- Próximo: **45-02** (helper puro `art-director-briefing.ts` — extração SEM mudança de comportamento, `sanitizePromptText` cópia pura, delegação `buildPromptVariables` com saída idêntica, testes iniciais) — Wave 1
- O inventário de consumidores desta task é o gate D1 que autoriza a remoção/realocação de chaves no 45-03 (mapa transicional) e a co-migração de testes no 45-05
- Sem migrations, sem gates de CI nesta task (markdown apenas, verificação por grep seletivo)

---
*Phase: 45-briefing-contextual-do-diretor-de-arte*
*Completed: 2026-09-02*
