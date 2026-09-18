---
phase: 49-ativacao-orientacao-contextual-campos
verified: 2026-09-18T19:35:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification: true
warnings:
  - "ME-01 (49-REVIEW.md): `RecommendedBadge` hardcodes `Recomendado` instead of consuming `RECOMMENDED_LABEL`; the constant is dead in production (only tests import it). D14 single-source deviation — no actual divergence today (both strings identical)."
  - "ME-02: `store-identity-form.tsx` uses `as StoreToneOfVoice` on a free-form DB string with no CHECK constraint; a legacy/unknown tone renders an empty `<p>` still referenced by `aria-describedby`."
  - "ME-03: `campaign-image-upload.tsx` uses static ids (`productImages-label`, `productImages-required`) and `store-identity-form.tsx` uses `fiscal-section-helper` instead of `useId`-derived ids."
  - "LO-02: the neutral 'só preço anterior' feedback is rendered with `tone=\"amber\"` (warning color) although D9 calls it a neutral message (this follows the 49-05 plan instruction verbatim)."
  - "LO-03: `campaign-brief-review.tsx` displays `fields.mandatoryArtworkTextFree` untrimmed while the body trims it via `buildMandatoryArtworkText`."
  - "Tracking nit: the requirements table in `.planning/ROADMAP.md` (lines 1319–1325) still lists the 7 F49 capability slugs as `Planned` although the phase is `14/14 — Complete`."
human_verification: []
---

# Phase 49: Ativação e Orientação Contextual de Campos Verification Report

**Phase Goal:** Ensinar no ponto de decisão — os formulários de identidade da loja (`/loja`) e do brief da campanha (`/campanhas/nova`, incluindo a revisão F43) ganham orientação contextual no próprio campo (hint inline, descrição contextual da opção selecionada, ajuda expansível e feedback dinâmico), com dados fiscais separados do nome público, tom de voz explicado como campo crítico, posicionamento × descrição curta × slogan distinguidos, "Descrição do produto", preços com labels de significado + feedback dinâmico e "Informações obrigatórias na arte" positiva e multi-linha — **sem** alterar prompts, gateway/modelos, pipeline, schemas públicos, snapshot, domínio, contrato HTTP ou banco.

**Verified:** 2026-09-18T19:35:00Z
**Status:** passed
**Re-verification:** No — initial verification (no previous 49-VERIFICATION.md existed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Padrão reutilizável e acessível de ajuda de campo existe (hint inline, ajuda expansível, indicador "Recomendado") | ✓ VERIFIED | `src/components/ui/field-hint.tsx`, `expandable-help.tsx`, `recommended-badge.tsx` existem, são substantivos e são importados por `store-identity-form.tsx`, `campaign-input-form.tsx`, `mandatory-artwork-field.tsx`. `ExpandableHelp`: `<button aria-expanded>` + região sempre no DOM com `hidden`, `min-h-[44px]`, `focus-visible:ring-2`. |
| 2 | Loja: dados fiscais (CNPJ/Razão Social/Nome Fantasia) separados do Nome da Loja (nome público), com microcopy e atalhos preservados | ✓ VERIFIED | `store-identity-form.tsx:1482-1483` heading `FISCAL_SECTION_LABEL` + `FISCAL_SECTION_HELPER`; `:1681` `STORE_NAME_HINT` sob `#name`; atalhos "Usar nome fantasia/razão social como nome da loja" presentes (grep). |
| 3 | Loja: tom de voz explicado + descrição contextual por opção (8), exibida só com seleção; regra `needs_tone_of_voice` inalterada | ✓ VERIFIED | `store-identity-form.tsx:2016-2019` renderiza `TONE_OF_VOICE_HINT`, `TONE_OF_VOICE_COMPLEMENTS_HINT` e `TONE_OF_VOICE_DESCRIPTIONS[...]` condicionado a `tone_of_voice !== ""`. `tabs.ts`/`reason-text.ts` não alterados (git diff vazio). `field-guidance.correspondence.test.ts` importa `computeTabUnlock` real e prova `needs_tone_of_voice` + 8 chaves exatas. |
| 4 | Loja: posicionamento × descrição curta × slogan distinguidos; slogan opcional sem "Recomendado" | ✓ VERIFIED | `store-identity-form.tsx:2024-2041`: `POSITIONING_LABEL` + `POSITIONING_SECONDARY_LABEL` + `RecommendedBadge`; `ExpandableHelp` com `POSITIONING_EXAMPLE`; `SHORT_DESCRIPTION_HINT` + `RecommendedBadge`; `SLOGAN_HINT` + `OPTIONAL_LABEL`, sem `RecommendedBadge`. Placeholder antigo "A melhor loja de" ausente. |
| 5 | Campanha: "Descrição do produto" com microcopy/placeholder reais; continua alimentando apenas copy (não arte) | ✓ VERIFIED | `campaign-input-form.tsx:432-464` usa `PRODUCT_DESCRIPTION_LABEL/HINT/PLACEHOLDER`; placeholder promocional "20% OFF..." ausente. `phase49-fences.test.ts` prova `mapBriefToCopyDirectorInput(...).description === SENTINELA` e ausência do sentinela nas 7 seções de `art-director-briefing.ts` (`rg description` = 0). |
| 6 | Campanha: labels de preço com significado, ajuda expansível das 3 regras e feedback dinâmico dos 4 estados (incl. neutro "só anterior") | ✓ VERIFIED | `campaign-input-form.tsx:495-597`: `PRICE_HELP_TITLE` em `ExpandableHelp` (colapsado), `ORIGINAL_PRICE_LABEL`/`DISCOUNTED_PRICE_LABEL`, hints por campo, `priceFeedbackMessage` renderizado com id único. Testes de orientação cobrem os 4 estados com `not.toContain("Sem preço")` no estado neutro. |
| 7 | Campanha: obrigatoriedade acessível (`aria-required` sem `required` nativo); grupo de imagem com `role=group` + `aria-labelledby`/`aria-describedby` | ✓ VERIFIED | `campaign-input-form.tsx:407,563,617` `aria-required` condicional; `campaign-image-upload.tsx:58-70` `role=group` + `aria-labelledby="productImages-label"` + `aria-describedby` com `productImages-required`/erro. Testes afirmam ausência de `required` nativo. |
| 8 | Informações obrigatórias na arte: campo visível, positivo, multi-linha; contrato de transporte preservado | ✓ VERIFIED | `mandatory-artwork-field.tsx` usa `MANDATORY_ARTWORK_LABEL/HINT/PLACEHOLDER` (placeholder 3 linhas, 3ª = "Venda proibida para menores"), `id="mandatoryArtworkText"`, `maxLength=200`, `rows=3`, `aria-describedby` por `useId`. Nenhuma advertência negativa. |
| 9 | Revisão do brief: categorias separáveis (aviso ilustrativo × informações obrigatórias), rótulos de preço alinhados, validade em item próprio | ✓ VERIFIED | `campaign-brief-review.tsx:227-257` renderiza itens distintos (`ILLUSTRATIVE_NOTICE_TEXT` com `Check` × `MANDATORY_ARTWORK_LABEL` + `whitespace-pre-line`); `:165/:173` "Preço anterior"/"Preço de venda"; `:179-184` validade própria. `buildMandatoryArtworkText` removido do componente (grep = 0). |
| 10 | Fonte única de microcopy em módulos puros + correspondência com o comportamento real | ⚠️ VERIFIED (com ressalva) | `src/lib/store-onboarding/field-guidance.ts` e `src/lib/campaign/field-guidance.ts` são puros (sem `use client`/React/server-only) e consumidos pelos componentes; `field-guidance.correspondence.test.ts` importa `inferIntent` e `computeTabUnlock` reais. **Ressalva:** `RecommendedBadge` duplica o literal "Recomendado" (ME-01) — sem divergência atual, constante `RECOMMENDED_LABEL` dead em produção. |
| 11 | Fences de não-mudança cumpridas (`prompts/**`, `src/lib/ai/**`, brief, snapshot, `use-campaign-form.ts`, `validity-field.tsx`, tabs/reason-text/draft-store, drift, rotas, banco) | ✓ VERIFIED | `git diff --name-only 05b1a74b..HEAD` filtrado por todos os caminhos proibidos → **vazio**. `product.description` ausente de `art-director-briefing.ts` (rg = 0). `use-campaign-form.ts`/`validity-field.tsx`/`tabs.ts`/`reason-text.ts`/`draft-store.ts`/`use-drift-detection.ts`/`lib/drift.ts`/`supabase/**`/`src/app/api/**` não alterados. |
| 12 | Regressão de comportamento (auto-save/draft/abas/body) verde + 4 gates verdes | ✓ VERIFIED | Reexecutado nesta verificação: `npx vitest run` → **345 files / 3660 passed + 1 skipped (exit 0)**; `npm run typecheck` → **exit 0**. Lint/build registrados em `49-GATES.txt` (exit 0), coerentes com os gates reexecutados. Suites da fase (9 arquivos / 61 testes) verdes. |
| 13 | UAT humana de compreensão 9/9 PASS em desktop/375px/320px, sem poluição visual; decisões editoriais confirmadas | ✓ VERIFIED | `49-UAT.md`: aprovador **Wagner**, **2026-09-18**, 9/9 PASS, matriz de dispositivos PASS, poluição visual PASS, decisão 4.1 (manter "Informações obrigatórias na arte") e 4.2 (8 descrições de tom de voz aprovadas). |
| 14 | Gap closure 49-14 resolvido e revalidado | ✓ VERIFIED | `49-14-SUMMARY.md` + `49-GATES.txt` (§"Reexecução pós-gap-closure"): 4 gates verdes, 59/59 hashes sem divergência; `field-guidance.ts` com microcopy citando restrições e placeholder com restrição real; re-UAT reconfirmou cenário 7 PASS. |

**Score:** 14/14 truths verified (truth #10 carries a documented non-blocking warning).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/store-onboarding/field-guidance.ts` | Microcopy pura da loja | ✓ VERIFIED | 104 linhas, 8 descrições tipadas, sem dependências de runtime |
| `src/lib/campaign/field-guidance.ts` | Microcopy pura da campanha + `priceFeedbackMessage` | ✓ VERIFIED | 94 linhas, 4 estados, importa apenas `formatCurrencyBRL` |
| `src/components/ui/field-hint.tsx` | Hint inline associável por id | ✓ VERIFIED | 49 linhas, tom por mapa, sem `useId` |
| `src/components/ui/expandable-help.tsx` | Disclosure acessível colapsado | ✓ VERIFIED | 62 linhas, `aria-expanded`/`aria-controls`/`hidden`/`min-h-[44px]` |
| `src/components/ui/recommended-badge.tsx` | Indicador textual | ⚠️ VERIFIED (warning ME-01) | 14 linhas; literal duplicado em vez de `RECOMMENDED_LABEL` |
| `src/components/campaign/mandatory-artwork-field.tsx` | Campo visível positivo multi-linha | ✓ VERIFIED | 47 linhas, constante canônica, contrato preservado |
| `src/components/flow/store-identity-form.tsx` | Orientação da loja | ✓ VERIFIED | Importa `field-guidance`, usa `useId`/`aria-describedby`/`aria-required` |
| `src/components/flow/campaign-input-form.tsx` | Orientação da campanha | ✓ VERIFIED | Importa `field-guidance`, feedback dinâmico, `ExpandableHelp` |
| `src/components/flow/campaign-image-upload.tsx` | Grupo de imagem acessível | ⚠️ VERIFIED (warning ME-03) | `role=group` + `aria-labelledby`/`aria-describedby`; ids estáticos |
| `src/components/flow/campaign-brief-review.tsx` | Revisão separável | ✓ VERIFIED | Itens rotulados, rótulos de preço, sem `buildMandatoryArtworkText` |
| `.planning/phases/.../49-BASELINE.txt` | Baseline de não-mudança | ✓ VERIFIED | 4 seções, `SHA_INICIAL_F49`, 59 hashes |
| `.planning/phases/.../49-GATES.txt` | Evidência dos gates | ✓ VERIFIED | Regressão, 4 gates e não-mudança |
| `.planning/phases/.../49-UAT.md` | Resultado da UAT | ✓ VERIFIED | 9/9 PASS + decisões editoriais |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `store-identity-form.tsx` | `store-onboarding/field-guidance.ts` | import de strings | ✓ WIRED | imports em `:18-33`; strings renderizadas |
| `campaign-input-form.tsx` | `campaign/field-guidance.ts` | import de strings + `priceFeedbackMessage` | ✓ WIRED | imports em `:15-24`; feedback em `:592-597` |
| `mandatory-artwork-field.tsx` | `campaign/field-guidance.ts` | constantes canônicas | ✓ WIRED | `:5-9`, `:29/:38/:44` |
| `campaign-brief-review.tsx` | `fields.showIllustrativeNotice`/`fields.mandatoryArtworkTextFree` | derivação direta | ✓ WIRED | `:73-74`, `:232/:243`; `buildMandatoryArtworkText` ausente |
| `campaign-input-form.tsx` | `use-campaign-form.ts` (inferIntent) | feedback espelha sem alterar | ✓ WIRED | `priceFeedbackMessage` espelha a classificação; `use-campaign-form.ts` intocado |
| `field-guidance.correspondence.test.ts` | `inferIntent`/`computeTabUnlock` | import do caminho real | ✓ WIRED | testes puros importam as funções reais |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `campaign-input-form.tsx` (feedback) | `fields.originalPriceCents`/`discountedPriceCents` | `use-campaign-form` state | Sim (valores do form) | ✓ FLOWING |
| `store-identity-form.tsx` (tom) | `formData.tone_of_voice` | `use-store-form` state | Sim (valor selecionado) | ✓ FLOWING |
| `campaign-brief-review.tsx` | `fields.showIllustrativeNotice`/`mandatoryArtworkTextFree` | `use-campaign-form` state | Sim (derivação dos campos) | ✓ FLOWING |
| `mandatory-artwork-field.tsx` | `value`/`onChange` props | call site em `campaign-input-form.tsx` | Sim (prop real) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Testes de orientação/a11y/persistência da fase | `npx vitest run` (9 arquivos F49) | 9 files / 61 tests passed | ✓ PASS |
| Suíte completa | `npx vitest run` | 345 files / 3660 passed + 1 skipped, exit 0 | ✓ PASS |
| Typecheck | `npm run typecheck` | exit 0 | ✓ PASS |
| Fence do Diretor de Arte | `rg -c "description" art-director-briefing.ts` | 0 ocorrências (exit 1) | ✓ PASS |
| Diff de caminhos proibidos | `git diff --name-only <SHA_INICIAL_F49>..HEAD` filtrado | vazio | ✓ PASS |
| Módulos de conteúdo puros | grep `use client|from "react"|server-only` nos 2 módulos | 0 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | Não há probes declarados (`scripts/*/tests/probe-*.sh`) nem menção a probes no PLAN/SUMMARY; fase de UI/conteúdo. | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| `contextual-field-help` | 49-01, 49-03, 49-07, 49-09, 49-12, 49-13 | Primitivos de ajuda + a11y | ✓ SATISFIED | 3 primitivos + testes jsdom + `aria-describedby`/`aria-expanded` |
| `store-field-orientation` | 49-01, 49-02, 49-04, 49-08, 49-12, 49-13 | Orientação da loja | ✓ SATISFIED | Hints/descrições/tom/posicionamento; correspondência `computeTabUnlock` |
| `campaign-field-orientation` | 49-01, 49-02, 49-05, 49-06, 49-08, 49-09, 49-12, 49-13, 49-14 | Orientação da campanha | ✓ SATISFIED | Descrição, preços, feedback, obrigatórias; correspondência `inferIntent` |
| `store-identity-ui` | 49-04, 49-07, 49-11, 49-12, 49-13 | UI de identidade da loja | ✓ SATISFIED | Dados fiscais, nome público, recomendado/opcional |
| `campaign-input-ui` | 49-05, 49-07, 49-10, 49-12, 49-13 | UI do input de campanha | ✓ SATISFIED | Labels, ajuda expansível, obrigatoriedade acessível |
| `mandatory-artwork-text` | 49-06, 49-07, 49-10, 49-12, 49-13, 49-14 | Informações obrigatórias na arte | ✓ SATISFIED | Campo visível, multi-linha, transporte preservado; gap 49-14 resolvido |
| `campaign-brief-review` | 49-06, 49-09, 49-10, 49-12, 49-13 | Revisão do brief separável | ✓ SATISFIED | 4 casos testados; rótulos alinhados |

**Orphaned requirements:** none — all 7 plan slugs are claimed by at least one plan, and no additional F49 requirement exists in `.planning/REQUIREMENTS.md` (no REQ-IDs there).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `store-identity-form.tsx` | 1616 | `XX.XXX.XXX/YYYY-ZZ` | ℹ️ Info | Máscara de CNPJ (falso positivo de "XXX"); **não** é debt marker |
| — | — | `TBD`/`FIXME`/`TODO`/`PLACEHOLDER` | ℹ️ Info | Nenhum debt marker real encontrado nos arquivos da fase |

Nenhum blocker anti-pattern. As ressalvas do code review (`49-REVIEW.md`: 0 critical, 0 high, 3 medium, 5 low) estão listadas no frontmatter como `warnings` e resumidas em "Gaps Summary" abaixo.

### Human Verification Required

Nenhum item pendente. A UAT humana de compreensão da fase foi **executada e aprovada** (9/9 PASS, aprovador Wagner, 2026-09-18) e a re-UAT pós-gap-closure reconfirmou todos os cenários. Não há verificação humana adicional identificada por esta verificação.

### Gaps Summary

**Nenhum gap bloqueador.** O objetivo da fase está observavelmente alcançado no código:

- Os 7 requirement slugs estão implementados, consumidos e cobertos por testes.
- As fences de não-mudança estão intactas (diff de caminhos proibidos vazio; `product.description` ausente do Diretor de Arte).
- A suíte completa (345 arquivos / 3660 testes + 1 skipped) e o typecheck passam exit 0 nesta verificação; lint/build registrados em `49-GATES.txt`.
- A UAT humana aprovou 9/9 cenários em desktop/375px/320px, sem poluição visual, com decisões editoriais confirmadas.
- O gap closure 49-14 foi resolvido e revalidado.

**Warnings não-bloqueantes (documentados pelo code review `49-REVIEW.md`, não corrigidos):**

1. **ME-01 — `RecommendedBadge` duplica "Recomendado"** em vez de consumir `RECOMMENDED_LABEL` (constante dead em produção; D14/spec "Strings sem duplicação divergente"). Não há divergência atual (ambas as strings idênticas) e o teste de orientação guarda drift; correção trivial (import da constante).
2. **ME-02 — cast `as StoreToneOfVoice`** em valor livre do banco (sem CHECK) pode renderizar `<p>` vazio ainda referenciado por `aria-describedby` para tom legado/desconhecido.
3. **ME-03 — ids estáticos** em `campaign-image-upload.tsx` (`productImages-label`/`productImages-required`) e `store-identity-form.tsx` (`fiscal-section-helper`) divergem da convenção `useId` (não são instance-safe se renderizados duas vezes).
4. **LO-02 — feedback neutro em amber** ("só preço anterior" usa `tone="amber"`, cor de aviso) — segue literalmente a instrução do plano 49-05, mas contrasta com o princípio "sem advertência negativa".
5. **LO-03 — texto da revisão não trimado** (`fields.mandatoryArtworkTextFree` exibido cru, enquanto o body usa `buildMandatoryArtworkText` com `.trim()`).
6. **Nits de tracking:** a tabela de requirements em `.planning/ROADMAP.md` (linhas 1319–1325) ainda marca os 7 slugs F49 como `Planned`; a linha `*Last updated*` do `.planning/ROADMAP.md` não cita a F49.

Estas ressalvas são de qualidade/convenção (nenhuma impede o objetivo) e podem ser tratadas como follow-up de limpeza; nenhuma altera o veredito de que o objetivo da fase foi alcançado.

---

_Verified: 2026-09-18T19:35:00Z_
_Verifier: the agent (gsd-verifier)_

---

## Re-verificação pós-review (49-15)

**Data:** 2026-09-18
**Escopo:** gap closure dos achados acionáveis do `49-REVIEW.md` (ME-01, ME-02, ME-03 e LO-03). LO-01, LO-02, LO-05 e a futura melhoria do seletor de tom de voz permaneceram **fora de escopo** por decisão do plano 49-15.

### Achados endereçados

| Achado | Correção | Evidência |
|--------|----------|-----------|
| **ME-01** — `RecommendedBadge` duplicava o literal "Recomendado" | Componente passa a consumir `RECOMMENDED_LABEL` de `@/lib/store-onboarding/field-guidance`; teste co-migrado para importar/assertar a constante | `rg -n '"Recomendado"' src/components/ui/recommended-badge.tsx` → **0** (exit 1) |
| **ME-02** — cast `as StoreToneOfVoice` + `<p>` vazio com id órfão | Resolução cast-free via `Object.entries(TONE_OF_VOICE_DESCRIPTIONS).find(...)?.[1] ?? null`; `toneDescriptionId` e o `FieldHint` só entram quando `toneDescription` é truthy | `rg -n "as StoreToneOfVoice" src/components/flow/store-identity-form.tsx` → **0** (exit 1) |
| **ME-03** — ids estáticos (`productImages-label`, `productImages-required`, `fiscal-section-helper`) | Todos derivados de `useId` (`imageLabelId`/`imageRequiredId`/`fiscalHelperId`); asserções de `campaign-input-form.orientation.test.tsx` resolvem os ids dinamicamente via `aria-labelledby`/`aria-describedby` | `rg -n "productImages-label\|productImages-required\|fiscal-section-helper" src` → **0** (exit 1) |
| **LO-03** — revisão exibia o texto livre não trimado | Exibição passa a `fields.mandatoryArtworkTextFree.trim()` (mantendo `whitespace-pre-line`), coerente com `hasMandatoryArtworkText` e com `buildMandatoryArtworkText` | `rg -n "mandatoryArtworkTextFree.trim\(\)" src/components/flow/campaign-brief-review.tsx` → 2 ocorrências (gate + exibição) |

### Testes afetados (focados)

`npx vitest run` de `recommended-badge.test.tsx`, `campaign-input-form.orientation.test.tsx`, `store-identity-form.orientation.test.tsx` e `campaign-brief-review.orientation.test.tsx` → **4 files / 24 tests passed** (exit 0).

### Gates reexecutados (49-15 Task 2)

- `npx vitest run` → **345 files / 3660 passed + 1 skipped** (exit 0)
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `npm run build` → 62/62 páginas geradas (exit 0)
- **59/59** hashes protegidos idênticos ao baseline (**0 divergências**, 0 ausentes)
- `git diff --name-only 05b1a74b..HEAD` → **0 violações** de caminho proibido; untracked pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` preservado e não commitado

Evidência completa em `49-GATES.txt` (§ "Reexecução pós-review (49-15)").

### Veredito

Os achados acionáveis do review (ME-01/ME-02/ME-03/LO-03) foram **corrigidos** e as fences/gates **revalidados**. O status da verificação permanece **`passed`**; os warnings remanescentes (LO-01, LO-02, LO-05) são de qualidade/convenção e permanecem documentados como follow-up não-bloqueante.

_Re-verificado: 2026-09-18_
