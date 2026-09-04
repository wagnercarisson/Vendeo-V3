---
phase: 45-briefing-contextual-do-diretor-de-arte
plan: 06
subsystem: ai-image-generation
tags: [art-director-briefing, regression, non-change-verification, d7, prompts, human-review, checkpoint]
status: PARTIAL — tasks 1-2 done; task 3 (checkpoint humano) PENDING

# Dependency graph
requires:
  - phase: fase-45-briefing-contextual-do-diretor-de-arte
    provides: 45-05 (invariantes D5 + validatePrompts por cenário + invariantes transversais + blocos presente/ausente; 253 files/2392 testes verdes), 45-03/45-04 (4 .md reescritos em camada editorial + 8 slots; mapa FINAL de 12 chaves), 45-01 (registro de superfícies congeladas D7), tasks.md §6 (6.1/6.2/6.3)
provides:
  - Regressão completa VERDE: `npx vitest run` 253 files / 2392 testes — zero resíduos de fixtures/asserções do mapa antigo ou âncoras antigas dos .md (nenhuma correção necessária — co-migrações 45-03/04/05 já haviam zerado o estado pré-F45)
  - Gates typecheck/lint/build VERDES (exit 0 nos três) + verificação git de NÃO-MUDANÇA das superfícies congeladas (D7): rota HTTP generate-image, schema.ts, brief.ts/domínio/snapshot, use-campaign-form.ts, image-review-service.ts + campaign-image-reviewer.md, Copy Director, providers/openai.ts — NENHUM arquivo congelado alterado na branch F45 (diff contra merge-base de0cbc78)
  - Suites irmãs (revisor/copy/form/rota/snapshot/domínio) verdes SEM edição (33 files / 416 testes no run direcionado)
  - Material completo de revisão humana da Task 3 (checkpoint): 4 .md com camada editorial + 8 slots; texto final montado via service real + PromptLoader real para 3 casos (offer completo, spotlight, exclusive); checklist a–e
affects: [45-07 (verificação/UAT comparativo — herdará a aprovação humana deste plano), verificação final da fase]

# Tech tracking
tech-stack:
  added: []
  patterns: [regressão de não-mudança com verificação git contra merge-base (git diff --name-only <base>...HEAD) e lista explícita de superfícies congeladas; montagem do prompt final para revisão humana exercitando o caminho real (ImageGenerationService.buildPromptVariables privado via `as any` + PromptLoader real do disco — mesmo molde dos testes 45-05)]

key-files:
  created: [.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-06-SUMMARY.md]
  modified: []

key-decisions:
  - "Nenhuma correção de resíduo foi necessária na Task 1: o vitest total (2392 testes) ficou 100% verde na primeira execução — as co-migrações in-plan dos 45-03/45-04/45-05 já haviam zerado referências ao mapa antigo de variáveis (39→36→12 chaves) e às âncoras antigas dos .md; greps de confirmação (EXPECTED_KEYS, LINHA_*, chaves legadas) retornaram apenas asserções de AUSÊNCIA legítimas (not.toHaveProperty/not.toContain) e nomes de campos de domínio ainda existentes (discountedPriceCents/badgeText)"
  - "Task 2 confirmou via git (diff de0cbc78...HEAD, 25 commits da branch F45) que NENHUM arquivo das superfícies congeladas foi alterado pela fase — arquivos alterados na branch limitam-se aos 4 .md do diretor, art-director-briefing.ts, image-generation-service.ts, 3 suites-alvo de teste e artefatos .planning/openspec/prompts da própria F45"
  - "Nenhum commit de código para Tasks 1-2: ambas foram puramente de verificação (zero arquivos modificados) — mesmo padrão da Task 5 do 45-05 ('sem commit próprio'); o commit docs deste SUMMARY registra o estado parcial com a Task 3 em aberto"

patterns-established:
  - "Checkpoint de revisão humana com material anexado no próprio SUMMARY (estado PARTIAL): textos finais montados via caminho real (service + PromptLoader) para leitura do humano sem exigir que ele rode comandos"
  - "Regressão de não-mudança reproduzível: diff da branch contra merge-base + lista explícita de superfícies congeladas + run direcionado das suites irmãs"

requirements-completed: [] # Parcial — F45-23/F45-24 (Tasks 1-2) atendidas em código; F45-25 (revisão humana) PENDENTE de aprovação no checkpoint. Finalizar no SUMMARY definitivo após resposta do humano.

# Metrics
duration: 8min (tasks 1-2) + 10min (adendo F45-06a: ajustes de revisão humana no spotlight)
completed: 2026-09-03
---

# Phase 45 Plan 06: Regressão Completa + Não-Mudança D7 — ESTADO PARCIAL (Tasks 1–2 verdes; Task 3 re-apresentada com ajustes aplicados)

**Regressão total F45 VERDE (253 files / 2392 testes) com zero resíduos do mapa antigo/âncoras antigas dos `.md`; gates typecheck/lint/build verdes; superfícies congeladas (rota HTTP/schema/domínio/form/revisor/copy/fallback OpenAI) confirmadas INTACTAS por verificação git (D7); suites irmãs verdes sem edição; material completo de revisão humana dos 4 `.md` reescritos e dos textos finais montados preparado e apresentado; após retorno do humano, 5 ajustes focados no SPOTLIGHT foram aplicados e revalidados — AGUARDANDO REAPROVAÇÃO HUMANA (Task 3)**

> **STATUS DO PLANO: PARCIAL.** Tasks 1–2 concluídas e verdes. Task 3 (`checkpoint:human-verify`, gate blocking) NÃO aprovada. A revisão humana pediu ajustes FOCADOS no spotlight (adendo F45-06a); os ajustes foram aplicados, validados (253 files/2395 testes + typecheck/lint/build exit 0) e o material foi re-montado e re-apresentado. Este documento NÃO declara aprovação humana — aguarda "approved" ou novos ajustes.

## Performance

- **Duration:** 8 min (Tasks 1–2); Task 3 aguardando resposta humana desde 2026-09-03T20:42Z
- **Started:** 2026-09-03T20:35:40Z
- **Completed:** (parcial — ver checkpoint)
- **Tasks:** 2/3 concluídas (Task 3 em checkpoint)
- **Files modified:** 0 (verificação pura — nenhuma edição necessária)

## Accomplishments

### Task 1 — Regressão completa (6.1): 253 files / 2392 testes VERDES, zero resíduos
- `npx vitest run` completo: **253 test files passed / 2392 tests passed** na primeira execução — exatamente a baseline herdada do 45-05.
- **Nenhuma correção de resíduo foi necessária.** Greps de confirmação nas suites-alvo (`image-generation-service.test.ts`, `prompt-reframe.test.ts`, `art-director-briefing.test.ts`) para o mapa antigo de variáveis e âncoras antigas retornaram:
  - `EXPECTED_KEYS`/`LINHA_*`/`REWRITTEN`/`LEGACY_INTENTS`: **zero ocorrências** em `src/`.
  - Chaves mortas/legadas (`commercialFrame`, `brandColorsChosen`, `visualTone`, `brandPersonality`, `campaignGuidelines`, `visualStyle`): única ocorrência é a asserção legítima de AUSÊNCIA `expect(vars).not.toHaveProperty('commercialFrame')` (image-generation-service.test.ts:807) — comportamento novo que deve ser mantido, não enfraquecido.
  - Chaves de domínio (`discountedPriceCents`, `badgeText`, `campaignDetails`, etc.) presentes apenas como **nomes de campos do `CampaignBrief`/flat request** (ainda existem no domínio) ou em asserções de ausência — não são resíduos do mapa antigo.
- **Suites irmãs NÃO co-migradas e verdes** (regra do plano): revisor/copy/form/rota/snapshot/domínio passaram dentro do run total sem nenhuma edição.
- Contagem final registrada: **2392 testes verdes** (253 files).

### Task 2 — Gates + não-mudança do contrato externo (6.2/D7): tudo VERDE
- **Gates:** `npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm run build` → exit 0 (build Next.js completo, incluindo `check:cnae`).
- **Verificação git de não-mudança:** diff `de0cbc78...HEAD` (merge-base da branch `feature/fase-45-briefing-contextual-do-diretor-de-arte` com a branch base; 25 commits da F45) — arquivos alterados pela F45 limitam-se a:
  - `prompts/campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md` (alvo da F45)
  - `src/lib/image-generation/services/art-director-briefing.ts`, `image-generation-service.ts` (alvo da F45)
  - `src/lib/image-generation/services/__tests__/image-generation-service.test.ts`, `art-director-briefing.test.ts`, `src/lib/campaign/__tests__/prompt-reframe.test.ts` (suites-alvo co-migradas)
  - artefatos `.planning/phases/45-*/`, `openspec/changes/fase-45-*/`, trackings (AGENTS/ROADMAP/.planning/PROJECT)
- **Superfícies congeladas confirmadas INTACTAS** (nenhuma na lista de alterados): rota HTTP `generate-image` (`src/app/api/campaign/generate-image/`), `schema.ts` (`GenerateImageRequestSchema`), `brief.ts`/`brief-schema.ts`/`src/components/campaign/types.ts` + `brief*.test.ts`/snapshot/mapper, `use-campaign-form.ts` + `use-campaign-form-*.test.ts`, `image-review-service.ts` + `campaign-image-reviewer.md` + `image-review-service.test.ts`, Copy Director (`src/lib/copy/*` + `campaign-copy-director*.md` + `copy-director-service.test.ts`/`copy-director-prompt.test.ts`), `providers/openai.ts`, `prompt-validator.ts`/`prompt-loader.ts`, `store-identity-service.ts`.
- **Run direcionado das suites de não-mudança:** `route.test.ts` + `image-review-service.test.ts` + copy + form + brief/snapshot/mapper → **33 files / 416 tests passed**.
- Nenhum arquivo congelado precisou de investigação/reversão (nenhum apareceu como alterado).

### Task 3 — Material de revisão humana PREPARADO (6.3) — AGUARDANDO APROVAÇÃO
- Material completo montado e apresentado no checkpoint (Anexo A: excertos editoriais dos 4 `.md`; Anexo B: 3 textos finais montados via **caminho real** — `ImageGenerationService.buildPromptVariables` + `PromptLoader` real lendo os `.md` do disco; Anexo C: checklist a–e).
- Nenhuma aprovação declarada neste documento — o plano permanece em estado PARCIAL até a resposta do humano.

## Task Commits

Tasks 1–2 foram **puramente de verificação** — nenhum arquivo foi modificado, portanto não há commits de código por task (mesmo padrão da Task 5 do 45-05). O commit docs abaixo registra o estado parcial:

1. **Task 1 (6.1): Regressão completa** — verificação apenas; zero resíduos encontrados → sem commit de produção
2. **Task 2 (6.2): Gates + não-mudança D7** — verificação apenas; gates verdes, superfícies congeladas intactas → sem commit de produção
3. **Task 3 (6.3): Revisão humana** — PENDENTE (checkpoint; ajustes do adendo F45-06a aplicados, aguardando reaprovação)
4. **Docs: estado parcial** — `45-06-SUMMARY.md` (este arquivo) com material do checkpoint
5. **Adendo F45-06a: ajustes de revisão humana no spotlight** — `2ae83c35` (fix; 5 arquivos) + docs deste SUMMARY

## Files Created/Modified

- `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-06-SUMMARY.md` — estado parcial (Tasks 1–2 verdes; Task 3 pendente) + material de revisão humana em anexo
- Adendo F45-06a (ajustes spotlight): `prompts/campaign-image-director-spotlight.md`, `src/lib/image-generation/services/art-director-briefing.ts`, `src/lib/image-generation/services/image-generation-service.ts`, `src/lib/image-generation/services/__tests__/art-director-briefing.test.ts`, `src/lib/campaign/__tests__/prompt-reframe.test.ts`
- Nenhum arquivo de código/`.md`/teste das Tasks 1–2 modificado (verificação pura)

## Decisions Made

- **Nenhuma correção de resíduo (Task 1):** o estado pré-F45 já estava zerado pelas co-migrações in-plan dos 45-03/45-04/45-05 — corrigir seria reescrever asserções verdes sem necessidade (violaria a regra "nunca enfraquecer comportamento novo" por tabela).
- **Suites irmãs intocadas (D7):** confirmadas verdes sem edição, tanto no run total quanto no run direcionado.
- **Verificação de não-mudança por diff de branch (de0cbc78...HEAD)** em vez de apenas `git status`: evidência completa de que a F45 inteira (25 commits) não tocou nenhuma superfície congelada.

## Deviations from Plan

Nenhuma — plano executado como escrito até o ponto do checkpoint. Observações registradas (não são desvios):
- **Tasks 1–2 sem commit de código:** o plano previa "corrigir resíduos APENAS onde existiam"; não existiam resíduos, logo não houve edição nem commit por task (verificação pura). A contagem final (2392 testes) e a lista de superfícies confirmadas intactas ficam registradas neste SUMMARY.
- **Artefato de montagem temporário removido:** um spec vitest temporário (`tmp-45-06-mount.spec.ts`) foi usado para montar os 3 textos finais via caminho real e foi **removido antes de qualquer commit** (working tree limpo, exceto a pasta pré-existente `docs/alinhamento-fase-44-temas-de-campanhas`, intocada).

## Issues Encountered

- **`npm` não executável em pipeline no PowerShell 5.1** (resolve como `npm.ps1`/documento) — invocado como `npm.cmd` nos gates (mesmo problema documentado no 45-02). Zero impacto no resultado.
- Ruído de jsdom no vitest ("Not implemented: navigation/scrollTo") no stderr — pré-existente, não afeta exit code nem contagem.

## User Setup Required

None — sem configuração externa. O checkpoint humano é de **leitura/revisão** (o agente monta e apresenta; o humano valida e responde "approved" ou descreve ajustes).

## Next Phase Readiness

- **Regressão total verde e superfícies congeladas confirmadas intactas (D7)** — base para o 45-07 (verificação final/UAT comparativo).
- **Bloqueio atual:** Task 3 aguarda REAPROVAÇÃO humana após o adendo F45-06a (ajustes de spotlight aplicados em `2ae83c35`). Após "approved" (ou novos ajustes + reapresentação), o plano é finalizado e este SUMMARY é consolidado (requirements F45-23/24/25, status completo).
- **Próximo plano:** 45-07 (Verificação final — `45-VERIFICATION.md` + `45-UAT.md` + 4 gates + registros/arquivamento do change) — depende da aprovação humana deste plano.

## Self-Check: PASSED (parcial — Tasks 1–2 + adendo F45-06a)

- `npx vitest run` → **253 test files passed, 2392 tests passed** (zero falhas — Tasks 1–2) ✓
- `npx vitest run` → **253 test files passed, 2395 tests passed** (adendo F45-06a — +3 testes focados) ✓
- `npm run typecheck` → exit 0 ✓ | `npm run lint` → exit 0 ✓ | `npm run build` → exit 0 (Tasks 1–2) ✓
- `npm run typecheck` → exit 0 ✓ | `npm run lint` → exit 0 ✓ (adendo F45-06a) ✓
- Run direcionado das suites de não-mudança → **33 files / 416 tests passed** ✓
- `git diff --name-only de0cbc78...HEAD` → nenhuma superfície congelada na lista ✓
- Greps de resíduo (EXPECTED_KEYS/LINHA_*/chaves legadas) → apenas asserções de ausência legítimas ✓
- Adendo F45-06a: diff do commit `2ae83c35` limitado aos 5 arquivos-alvo (spotlight `.md` + módulo + service + 2 suites-alvo) — nenhuma superfície congelada ✓
- Working tree limpo (exceto pasta pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` e artefatos do revisor humano `resultado.md`/`image.png`, intocados) ✓

---

## ADENDO F45-06a — Ajustes de revisão humana no SPOTLIGHT (aplicados e revalidados)

**Gatilho:** o humano revisou a Task 3 e solicitou ajustes FOCADOS no formato spotlight (5 itens). Escopo respeitado: apenas `prompts/campaign-image-director-spotlight.md` + builders/blocos estritamente necessários em `art-director-briefing.ts` + call site no service; offer/base/exclusive `.md` e blocos intocados; superfícies congeladas D7 intocadas.

### O que mudou (5 ajustes)

**1. Badge informado → OBRIGATÓRIO (não mais opcional)** — `campaign-image-director-spotlight.md` (Diretrizes de Composição nº 5):
- Antes: "Quando houver badge informado nos fatos, ele pode ser integrado se presente. É opcional"
- Depois: "Quando houver badge informado nos fatos, incorporá-lo à arte. Sem badge informado, um apoio visual discreto é opcional — apenas se trouxer clareza visual, sem inventar promessa comercial"

**2. Identidade: linha de composição simplificada** — `campaign-image-director-spotlight.md` (nº 2):
- Antes: "O nome {{storeName}} deve aparecer como assinatura de marca — consistente com a identidade visual da loja" (redundante com a seção)
- Depois: "A campanha deve ser assinada pela loja — ver a seção 'Identidade da Loja'" (fidelidade/limites/preservação concentrados na seção/bloco)

**3. Assinatura com respiro** — `identityReferenceSection` (`art-director-briefing.ts`), SOMENTE spotlight:
- Adicionada orientação curta por estado de identidade: "Posicionar {o logotipo | a assinatura visual | o nome da loja} com liberdade na composição, mantendo respiro adequado e sem cortes nas bordas da arte." — sem contradizer o estado `text_only` (fallback "nome da loja") e sem ser longa.

**4. Texto obrigatório multilinha** — `requiredArtworkTextSection` (`art-director-briefing.ts`), SOMENTE spotlight com quebra de linha:
- Adicionada orientação: "Se o texto tiver mais de uma linha ou item, mantenha legibilidade, separação visual e respiro adequado entre as linhas/itens — não os trate como um bloco único agrupado."
- A separação texto obrigatório × aviso ilustrativo (seções próprias distintas) NÃO foi alterada. Assinatura ganhou parâmetro `campaignIntent` (default `"offer"` — compatível retroativo); call site do service passa o intent.

**5. CTA × badge** — `campaign-image-director-spotlight.md` (nº 6):
- Adicionado: "O CTA não deve repetir literalmente o texto do badge — com badge informado, o CTA complementa a chamada para ação sem redundância"

### Testes focados aditivos (+3)

- `art-director-briefing.test.ts` (+2): (a) `identityReferenceSection` com respiro/sem corte nas bordas APENAS para spotlight (offer/exclusive sem a linha); (b) `requiredArtworkTextSection` com separação multilinha APENAS para spotlight com `\n` (offer sem; spotlight linha única sem).
- `prompt-reframe.test.ts` (+1): âncoras `.md` do spotlight — badge obrigatório quando informado, apoio opcional sem promessa, linha de identidade simples, CTA sem repetir badge.

### Textos finais re-montados (spotlight, caminho real)

Montagem via service real + `PromptLoader` real (fixtures "Loja Bella Moda", `moda-calcados-acessorios`, `#E11D48`, produto "Vestido Floral Verão", preço R$ 159,90, preserveImageContext, 1 primary). Artefatos temporários removidos antes do commit; conteúdo verificado e conferido:

- **Variant A (sem badge, assinatura visual):** composição nº 2 simplificada ("A campanha deve ser assinada pela loja — ver a seção 'Identidade da Loja'"); seção Identidade com "Posicionar a assinatura visual com liberdade na composição, mantendo respiro adequado e sem cortes nas bordas da arte."; sem seções vazias, sem placeholders residuais.
- **Variant B (com badge "Novidade" + hook + CTA + texto obrigatório multilinha + logo):** Fatos com `- **Badge:** Novidade`; composição nº 5 "incorporá-lo à arte" (obrigatório); nº 6 "O CTA não deve repetir literalmente o texto do badge — com badge informado, o CTA complementa a chamada para ação sem redundância"; seção Identidade com "Posicionar o logotipo com liberdade..."; `## Texto Obrigatório na Arte` com orientação multilinha ("mantenha legibilidade, separação visual e respiro adequado entre as linhas/itens") seguida do texto em 2 linhas; sem `## Aviso Ilustrativo` vazio, sem placeholders residuais.

Conferência checklist (a–e) re-executada sobre os textos montados: (a) briefing coerente sem ruído ✓; (b) cada natureza em sua seção, sem duplicação ✓; (c) tom de destaque sem urgência preservado ✓; (d) seções próprias de texto obrigatório e aviso claras e separadas ✓; (e) identidade/preservação + hierarquia primary×auxiliares explícitas ✓.

---

## ANEXO — Material de Revisão Humana (Task 3 / 6.3)

### Anexo A — Excertos editoriais dos 4 `.md` reescritos (leitura recomendada nos próprios arquivos: `prompts/campaign-image-director*.md`)

Todos os 4 arquivos seguem a mesma anatomia: **persona editorial** (1º bloco) → `## Fatos da Campanha` + `{{campaignFactsSection}}` → `## Especificações Técnicas` → `## Diretrizes de Composição` numeradas → `## Instruções Obrigatórias` + `{{constraintsSection}}` → `## Produto e Imagens de Referência` + `{{productReferenceSection}}` → `## Identidade da Loja` + `{{identityReferenceSection}}` → `{{commercialDetailsSection}}` → `## Direção Criativa Contextual` + `{{creativeDirectionSection}}` → `{{requiredArtworkTextSection}}` → `{{illustrativeNoticeSection}}`. Slots de natureza condicional aparecem como **linha inteira** `{{slot}}`, sem headings literais no `.md` (heading vive no valor do bloco).

| Arquivo | Persona/tom (excerto) | DNA por intent |
|---|---|---|
| `campaign-image-director.md` (base/referência offer) | "Você é o Diretor de Marketing da {{storeName}}... A peça deve ser publicável, comercial e transmitir confiança ao lojista." | Oferta/geral: framing promocional; composição nº 4 "Exibir o preço com desconto informado nos fatos como preço principal"; hierarquia produto > preço > loja > CTA. |
| `campaign-image-director-offer.md` | idem base (espelho runtime do intent offer) | Promocional; preço com desconto + original riscado; badge promocional integrado quando informado; hierarquia produto > preço > loja > CTA. |
| `campaign-image-director-spotlight.md` | "Briefing: Campanha Visual para Instagram — **Destaque**... O produto deve ser apresentado como destaque ou novidade, **sem urgência promocional**." | Preço único nos fatos; composição nº 4 "NÃO usar formato DE/POR ou indicar desconto"; Instrução "NÃO criar senso de urgência ou escassez (sem 'corra', 'últimas unidades', 'aproveite')"; nº 7 "sem urgência". |
| `campaign-image-director-exclusive.md` | "Briefing: Campanha Visual para Instagram — **Exclusivo**... item exclusivo, premium ou edição limitada — **sem divulgação de preço**." | Instrução nº 1 "NÃO exibir preço, desconto, condições de pagamento ou parcelamento"; badge "NÃO usar badges promocionais"; tom premium/full-bleed (preserveImageContext) + notas de segmento/categoria; hierarquia produto > loja > CTA. |

**Instruções obrigatórias comuns (anti-invenção + criatividade):** os 4 arquivos mantêm "NÃO inventar preços, descontos, condições de pagamento, prazos, garantias..." (offer/spotlight) / "NÃO inventar informações que não estejam explícitas no briefing" (exclusive), e a autorização de criatividade vive no `{{productReferenceSection}}` ("Você possui liberdade total para criar fundo, composição, iluminação, hierarquia...") — regras transferidas dos arquivos antigos sem amputação.

### Anexo B — Textos finais montados (3 casos representativos)

Montagem via **caminho real**: `ImageGenerationService.buildPromptVariables` (service real, mapa FINAL de 12 chaves) + `PromptLoader` real interpolando os `.md` do disco. Fixtures: loja "Loja Bella Moda" (segmento `moda-calcados-acessorios`, paleta `#E11D48`).

**Caso 1 — OFFER completo (validade + texto obrigatório + aviso ilustrativo + details):** `prompts/campaign-image-director-offer.md` interpolado com brief contendo preço com desconto R$ 199,90 + original R$ 299,90, badge, hook, CTA, objetivo, validade com data ("de 25/09/2026 até 30/09/2026"), texto obrigatório + aviso (split kqo), details/additional/availability com escassez, restrição sensível, 1 primary + 1 auxiliar, identidade logo + perfil de marca:

```
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Tênis Runner Pro
- **Preço com desconto:** R$ 199,90
- **Preço original:** R$ 299,90
- **Badge:** Oferta Imperdível
- **Hook:** Leveza e estilo para o seu dia
- **CTA:** Aproveite em nossa loja
- **Objetivo:** Vender o tênis em destaque
- **Canal alvo:** Instagram — **Formato:** Feed 1:1
- **Validade da oferta:** de 25/09/2026 até 30/09/2026

> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: "até 30/09/2026", "de 25/09/2026 até 30/09/2026"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Tênis Runner Pro deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Tênis Runner Pro deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir o preço com desconto informado nos fatos como preço principal. Quando houver preço original informado, exibi-lo como preço riscado (indicação de desconto)
5. **Badge promocional:** Quando houver badge promocional informado nos fatos, integrá-lo de forma visualmente coerente
6. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

## Restrições Sensíveis

Restrições sensíveis informadas pelo lojista:

- Não usar modelo humano na arte

---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido.
NÃO editar, alterar, redesenhar, distorcer nem inventar o logotipo fornecido — reproduzir o ativo enviado com fidelidade.

## Detalhes Comerciais (repertório para inspiração)

> **Nota:** O conteúdo abaixo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

- **Detalhes da campanha:** Frete grátis acima de R$ 199
- **Detalhes adicionais:** Aceitamos Pix e cartão em até 3x
- Disponível: Restam poucas unidades por loja

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.

### Perfil de Marca (Store Brand Director)

> **Nota:** Este perfil de marca é contexto criativo direcional para repertório da campanha, não regra obrigatória. Use como referência visual e comercial, preservando seu julgamento criativo na composição.
| Campo | Valor |
|-------|-------|
| **Diretrizes de campanha** | Priorizar a cor da marca como fundo ou destaque; evitar poluição visual |
| **Brief do Diretor de Marca** | Campanha de lançamento de coleção com foco em estilo e custo-benefício |
| **Personalidade da marca** | Próxima, estilosa e acessível |
| **Estilo visual** | Moderno e clean, com tipografia forte |
| **Tom visual** | Acolhedor e confiante |
| **Cores da marca** | #E11D48, #FFFFFF |

## Texto Obrigatório na Arte

O texto abaixo foi informado pelo lojista para ser incluído na arte. Inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.

"Promoção válida enquanto durarem os estoques."

## Aviso Ilustrativo

Quando houver aviso ilustrativo, exiba-o em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Texto do aviso: "Imagem meramente ilustrativa"
```

**Caso 2 — SPOTLIGHT (preço único, sem validade, preserveImageContext):** `campaign-image-director-spotlight.md` interpolado com brief de preço único (R$ 159,90, sem DE/POR), `preserveImageContext: true`, 1 primary, identidade assinatura visual:

```
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram — Destaque

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. O produto deve ser apresentado como destaque ou novidade, sem urgência promocional.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Vestido Floral Verão
- **Preço:** R$ 159,90

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Vestido Floral Verão deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Vestido Floral Verão deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir o preço informado nos fatos como preço principal. Se disponível, exibir como valor de destaque. NÃO usar formato DE/POR ou indicar desconto
5. **Badge:** Quando houver badge informado nos fatos, ele pode ser integrado se presente. É opcional
6. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva
7. **Tom de descoberta e destaque:** O produto é apresentado como novidade ou vitrine — sem urgência

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO criar senso de urgência ou escassez (sem "corra", "últimas unidades", "aproveite")
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

NÃO recortar o produto. Preservar o contexto original da imagem. Adaptar a composição ao redor do produto sem isolá-lo. Legibilidade continua obrigatória.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo.
NÃO editar, alterar, redesenhar, distorcer nem inventar a assinatura visual fornecida — reproduzir o ativo enviado com fidelidade. Não adicionar logotipo.

## Detalhes Comerciais (repertório para inspiração)

> **Nota:** O conteúdo abaixo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

- **Detalhes da campanha:** Peça versátil para o dia a dia

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Apresentar como destaque ou novidade, sem urgência. Benefício e diferencial são o foco.
```

**Caso 3 — EXCLUSIVE (sem preço, tom premium):** `campaign-image-director-exclusive.md` interpolado com brief SEM preço/badge, `preserveImageContext: true`, details + availability premium ("Restam poucas unidades no Brasil"), 1 primary + 1 auxiliar, identidade logo:

```
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram — Exclusivo

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. O produto deve ser apresentado como item exclusivo, premium ou edição limitada — sem divulgação de preço.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Bolsa de Couro Legítimo — Edição Limitada

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Bolsa de Couro Legítimo — Edição Limitada deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Bolsa de Couro Legítimo — Edição Limitada deve ser exibido com destaque e legibilidade
4. **Badge:** Quando houver badge informado nos fatos, ele pode ser integrado se presente. É opcional. NÃO usar badges promocionais ("Promoção", "Oferta", "Imperdível"). Se o badge não foi informado, não é obrigatório criar um selo. Se optar por comunicar exclusividade visualmente, faça de forma discreta e coerente com o produto
5. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva
6. **Tom premium e de exclusividade:** O produto é apresentado como item especial ou edição limitada

Quando preserveImageContext=true, trate a imagem enviada como base principal da arte.
Prefira composição full-bleed, crop amplo ou foto dominante ocupando a maior parte do quadro.
Não coloque a imagem dentro de moldura, card, painel, janela ou template decorativo pesado.
Elementos gráficos, bordas e ornamentos devem ser sutis e secundários.
A composição deve parecer uma campanha criada a partir da fotografia, não uma fotografia encaixada em um layout.

Se o segmento for "outros", use a categoria do produto para especializar a direção criativa.
Para categoria "flores-arranjos", priorize beleza natural, fotografia elegante, atmosfera acolhedora, ocasião especial e sofisticação discreta.
Evite linguagem visual excessivamente institucional, promocional ou ornamental.

## Instruções Obrigatórias

- NÃO exibir preço, desconto, condições de pagamento ou parcelamento
- NÃO inventar informações que não estejam explícitas no briefing
- NÃO criar urgência promocional
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.

NÃO recortar o produto. Preservar o contexto original da imagem. Adaptar a composição ao redor do produto sem isolá-lo. Legibilidade continua obrigatória.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido.
NÃO editar, alterar, redesenhar, distorcer nem inventar o logotipo fornecido — reproduzir o ativo enviado com fidelidade.

## Detalhes Comerciais (repertório para inspiração)

> **Nota:** O conteúdo abaixo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

- **Detalhes da campanha:** Peças numeradas com certificado de autenticidade
- Disponibilidade: Restam poucas unidades no Brasil

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Valor percebido e exclusividade são os pilares. Tom premium, sem preço.
```

**Conferência automática dos 3 textos (feita antes do checkpoint):** sem seções vazias/headings órfãos/linhas de tabela em branco/placeholders residuais `{{...}}`; validade em ocorrência única nos fatos (offer), ausente em spotlight/exclusive; preço presente em offer/spotlight e **ausente em exclusive** (zero linhas `R$`); texto obrigatório e aviso em seções próprias separadas (offer); `NÃO recortar` presente nos não-offer com preserveImageContext; sufixos de orientação por intent corretos; determinismo garantido por teste (D5 invariante b).

### Anexo C — Checklist de revisão humana (6.3)

(a) O prompt final é um briefing de direção de arte coerente e sem ruído? (b) cada natureza está na seção certa e sem duplicação? (c) o tom por intent foi preservado (offer promocional, spotlight sem urgência, exclusive premium sem preço)? (d) as seções próprias do texto obrigatório e do aviso estão claras? (e) identidade/preservação e hierarquia primary×auxiliares estão explícitas?

---
*Phase: 45-briefing-contextual-do-diretor-de-arte*
*Status: PARCIAL — aguardando aprovação humana da Task 3 (2026-09-03)*
