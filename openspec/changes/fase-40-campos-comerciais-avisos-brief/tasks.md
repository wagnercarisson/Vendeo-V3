## 1. Trackings — Renumeração F40/F41 (D1 runbook)

- [ ] 1.1 `ROADMAP.md` (raiz): linha 40 → "Campos Comerciais e Avisos do Brief | v1.5 | 0/0 | ○ Pending"; adicionar linha 41 → "Stripe / Monetização Pública | v1.7 | 0/0 | ○ Pending"; menções "F40 (Stripe)" → "Stripe (F41)"; bullet da F40 no `<details open>` do v1.5 — D1
- [ ] 1.2 `.planning/ROADMAP.md`: nota "Phase numbering" (F40 = Campos/avisos v1.5, F41 = Stripe v1.7); linha da tabela Progress 40 → Campos/avisos; adicionar linha 41 → Stripe; notas de renumeração; menções "Phase 40 (Stripe)" em Dependencies → F41; Dependency Graph; seção "### Phase 40 — Campos Comerciais e Avisos do Brief"; rodapé "Last updated" — D1
- [ ] 1.3 `.planning/STATE.md`: frontmatter `current_phase: 40`; tabela "Next Phases" (F40 in progress, F41 future renumerada); corpo "Current Position" + "Last updated" — D1
- [ ] 1.4 `.planning/PROJECT.md`: menção "Stripe ... F40 (v1.7)" → **F41**; rodapé "Last updated" — D1
- [ ] 1.5 `.planning/REQUIREMENTS.md`: seção v1.7 "Stripe... F40/v1.7" → **F41/v1.7** — D1
- [ ] 1.6 `.planning/MILESTONES.md`: "diferido para v1.7 (F40)" → **(F41)** (linha 20) — D1

## 2. Constante única + componente de checkbox (D2/D3)

- [ ] 2.1 `src/lib/campaign/constants.ts` (NOVO): `export const ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` — módulo neutro, sem `server-only`, sem importar o builder/domínio do brief — D2
- [ ] 2.2 `src/components/campaign/illustrative-notice-field.tsx` (NOVO): checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado), estilos do design system (`campaign-input` page / MASTER) — D2
- [ ] 2.3 `src/components/campaign/mandatory-artwork-field.tsx`: placeholder do textarea usa `ILLUSTRATIVE_NOTICE_TEXT` (singular — remove "Ex: Imagens meramente ilustrativas"); manter `maxLength 200` — D2
- [ ] 2.4 Verificar nenhuma string solta divergente singular×plural no form (placeholder usa a constante) — D2

## 3. Form state — use-campaign-form.ts (D2/D3/D4/D5)

- [ ] 3.1 `CampaignFormFields`: adicionar `showIllustrativeNotice: boolean` (default `true`) e `mandatoryArtworkTextFree: string`; se `mandatoryArtworkText` persistir no form state, deve ser compat/derivado — **nunca** o texto final concatenado salvo no draft — D2/D3
- [ ] 3.2 Estado de validade: `validityMode` (6 modos), datas (start/end), texto personalizado; gerar `displayText` determinístico (`até 30/09`, `de 25/09 até 30/09`, `somente hoje`, `enquanto durarem os estoques`, personalizado com normalização leve de prefixo "Oferta válida") — D4/D5
- [ ] 3.3 Montagem do body: `validity: <displayText | undefined>` presente apenas quando `campaignIntent === "offer"` e validade habilitada — D4
- [ ] 3.4 Montagem do body: `mandatoryArtworkText` final concatenado — checkbox marcado + texto → `"${ILLUSTRATIVE_NOTICE_TEXT}\n${texto}"`; marcado sem texto → `ILLUSTRATIVE_NOTICE_TEXT`; desmarcado + texto → só o texto; desmarcado + sem texto → `undefined` (campo ausente) — D3
- [ ] 3.5 Troca de intent: preservar o rascunho de validade no form state ao trocar `offer` → `spotlight`/`exclusive` (não envia `validity`; voltar a `offer` restaura) — D4
- [ ] 3.6 Autosave/restore: salvar/restaurar `showIllustrativeNotice` e `mandatoryArtworkTextFree` separados (concatenação só no submit) — D3
- [ ] 3.7 `EMPTY_FIELDS` e `FieldErrors` atualizados com os novos campos (sem novos requireds) — D3/D4

## 4. ValidityField — 6 modos de validade (D4/D5)

- [ ] 4.1 `src/components/campaign/validity-field.tsx` (NOVO): seletor de modos (Sem validade / Até uma data / De... até... / Somente hoje / Enquanto durarem os estoques / Texto personalizado) — D4
- [ ] 4.2 Datas estruturadas (date inputs) apenas geram `displayText`; `endDate` (ISO) NUNCA é enviado — D4/F39 D8
- [ ] 4.3 Formato de data `dd/mm` nos `displayText` gerados — D4
- [ ] 4.4 Texto personalizado: normalização leve (limpar prefixo "Oferta válida" antes de enviar) — D5
- [ ] 4.5 Validade só aparece/é enviada para `campaignIntent === "offer"` — D4

## 5. Campaign input form UI — camp-input-form.tsx (D2/D3/D4/D8)

- [ ] 5.1 Agrupamento Produto / Oferta / Avisos e texto obrigatório (D8); Descrição permanece na seção Produto (inalterada, `maxLength 120`) — D8
- [ ] 5.2 Seção "Avisos e texto obrigatório": `IllustrativeNoticeField` (checkbox) + `MandatoryArtworkField` (textarea) coexistindo, sem substituição — D2
- [ ] 5.3 Seção "Validade da oferta" renderizada apenas quando `offer` (via `ValidityField`) — D4
- [ ] 5.4 Verificar nenhum campo adormecido ganha UI (`campaignDetails`/`additionalDetails`/`availabilityNotes`/`hook`/`cta`/`objective`/`targetChannel`/`format`/`sensitiveConstraints`) — D8
- [ ] 5.5 Co-migrar mock `MandatoryArtworkField: () => null` em `campaign-flow-credits.test.tsx` (novo componente) — D2/D3

## 6. Prompts do diretor — reframe (D6)

- [ ] 6.1 `prompts/campaign-image-director.md` (~linha 130): remover instrução incondicional "SEMPRE acrescente ... 'Imagem meramente ilustrativa'" → bloco condicional de composição — D6
- [ ] 6.2 `prompts/campaign-image-director-offer.md` (~linha 131): idem — D6
- [ ] 6.3 `prompts/campaign-image-director-spotlight.md` (~linha 129): idem — D6
- [ ] 6.4 `prompts/campaign-image-director-exclusive.md` (~linha 138): idem — D6
- [ ] 6.5 Manter linha condicional do texto obrigatório ("Se o campo 'Texto obrigatório na arte' estiver preenchido ({{mandatoryArtworkText}})... Não o repita na legenda.") em todos os 4 — D6
- [ ] 6.6 Bloco condicional mantém inteligência visual do UAT-3 (tipografia mínima, visível/legível, posição lateral, sem competir com oferta/produto/preço) — D6

## 7. Testes — Validade (modos → displayText) (D4/D5)

- [ ] 7.1 Teste 1: modo "Sem validade" → `validity` ausente no body; mapper → campo ausente (nunca `enabled:false`) — D4/D5
- [ ] 7.2 Teste 2: modo "Até uma data" → `displayText` = `"até 30/09"` (dd/mm) — D4/D5
- [ ] 7.3 Teste 3: modo "De... até..." → `displayText` = `"de 25/09 até 30/09"` — D4/D5
- [ ] 7.4 Teste 4: modo "Somente hoje" → `"somente hoje"` — D4/D5
- [ ] 7.5 Teste 5: modo "Enquanto durarem os estoques" → `"enquanto durarem os estoques"` — D4/D5
- [ ] 7.6 Teste 6: modo "Texto personalizado" → texto do usuário; prefixo "Oferta válida" limpo se digitado — D5
- [ ] 7.7 Teste 7: validade só aparece/é enviada para `offer`; troca offer→spotlight/exclusive NÃO envia `validity` mas preserva o rascunho no form state (voltar a `offer` restaura) — D4
- [ ] 7.8 Teste 8: `displayText` nu não duplica rótulo nas DUAS superfícies: `buildCommercialRepertoire` → `- Oferta válida: até 30/09` e template mantém `**Validade da oferta:** até 30/09` — D5

## 8. Testes — Checkbox × texto obrigatório (D2/D3)

- [ ] 8.1 Teste 9: checkbox marcado + sem texto → `mandatoryArtworkText` = `ILLUSTRATIVE_NOTICE_TEXT` — D2/D3
- [ ] 8.2 Teste 10: checkbox marcado + texto → concatenação `"Imagem meramente ilustrativa\n{texto}"`; mapper → `legalNotice.text` — D2/D3
- [ ] 8.3 Teste 11: checkbox desmarcado + texto → apenas o texto — D2/D3
- [ ] 8.4 Teste 12: checkbox desmarcado + sem texto → campo ausente → `legalNotice` ausente → nada na arte — D2/D3
- [ ] 8.5 Teste 13: default do checkbox = marcado (estado inicial do form) — D2
- [ ] 8.6 Teste 14: constante única usada no form, prompts e fixtures (sem strings soltas/divergentes singular×plural) — D2
- [ ] 8.7 Teste 15: autosave/restore preserva a intenção — `showIllustrativeNotice` e `mandatoryArtworkTextFree` salvos/restaurados separados; concatenação só no submit — D3
- [ ] 8.8 `src/lib/campaign/__tests__/brief.test.ts`: casos checkbox/validade usando a constante via `constants.ts` — D2

## 9. Testes — Prompt reframe (D6)

- [ ] 9.1 Teste 16: os 4 prompts do diretor NÃO contêm a instrução incondicional "SEMPRE acrescente ... Imagem meramente ilustrativa" — D6
- [ ] 9.2 Teste 17: os 4 prompts contêm o bloco condicional (texto obrigatório informado → exibir exatamente; tipografia mínima/visível/legível; posição lateral; sem competir com oferta/produto/preço) — D6
- [ ] 9.3 Teste 18: `legalNotice.enabled=false` → `mandatoryArtworkText` vazio no prompt e `mandatoryArtworkTextSection` vazio no revisor — D2/D6
- [ ] 9.4 Teste 19: `validity.enabled` + displayText (offer) → `validityTextSection` montado no revisor; ausente → vazio — D4/D5
- [ ] 9.5 Teste 20: golden por intent (offer/spotlight/exclusive) — conjunto de variáveis/keys idêntico (`EXPECTED_KEYS = 38`) com os novos campos preenchidos; texto do prompt muda intencionalmente (D6) — D6
- [ ] 9.6 Teste 21: reviewer com checkbox default marcado → seção "Texto Obrigatorio na Arte" contém `ILLUSTRATIVE_NOTICE_TEXT`; rigor literal para aviso legal preservado — D2/D6

## 10. Regressão e co-migração de fixtures (D5/D6/D9)

- [ ] 10.1 `route.test.ts`: fixtures com `validity`/`mandatoryArtworkText` (novos campos) — fluxo completo inalterado para o mesmo payload — D9
- [ ] 10.2 `image-generation-service.test.ts`: fixtures singular/plural normalizadas (`ILLUSTRATIVE_NOTICE_TEXT`) — D2
- [ ] 10.3 `image-review-service.test.ts`: fixtures + seções (`validityTextSection`/`mandatoryArtworkTextSection`) — D2/D6
- [ ] 10.4 `use-campaign-form-navigation.test.ts`: novos campos no `EMPTY_FIELDS` (navegação) — D3
- [ ] 10.5 `campaign-flow-credits.test.tsx`: mock `MandatoryArtworkField` co-migrado — D2/D3
- [ ] 10.6 Regressão `generate-image` — fluxo completo (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterado** para o mesmo payload — D9
- [ ] 10.7 Copy Director e revisor sem mudança de comportamento (verificação por regressão) — D7

## 11. Verificação

- [ ] 11.1 `npx vitest run` — novos + existentes passando (incluindo co-migrados) — D2/D6
- [ ] 11.2 `npm run typecheck` — zero erros
- [ ] 11.3 `npm run lint` — zero erros
- [ ] 11.4 `npm run build` — build bem-sucedido
- [ ] 11.5 UAT local: gerar campanha offer com checkbox marcado (default) → arte com aviso ilustrativo legível, posição lateral — D2/D6
- [ ] 11.6 UAT local: gerar campanha offer com checkbox desmarcado e sem texto → arte SEM aviso — D2/D6
- [ ] 11.7 UAT local: gerar campanha offer com validade (modos distintos) → texto de validade correto na arte, sem duplicação de "Oferta válida" — D4/D5
- [ ] 11.8 UAT local: rascunho com checkbox marcado + texto livre → recarregar restaura checkbox e texto separados (intenção preservada) — D3
- [ ] 11.9 UAT local: gerar campanha spotlight/exclusive → seção de validade NÃO aparece; aviso segue o checkbox — D4
- [ ] 11.10 UAT local: preencher validade em offer, trocar para spotlight e voltar → validade reaparece no form (rascunho preservado; não enviada no meio) — D4
- [ ] 11.11 UAT local: campanha antiga (pré-F40) continua exibindo/baixando normalmente (sem migração destrutiva) — D9
