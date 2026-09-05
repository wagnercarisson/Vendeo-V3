---
phase: 45-briefing-contextual-do-diretor-de-arte
plan: 08
subsystem: ai-image-generation
tags: [reviewer, director, alignment, narrow-authority, split-legal-text, identity-out-of-scope, checkpoint]
status: PARTIAL — Tasks 1–7 concluídas (253 files/2415 testes) + rodada de ajuste focado pós-revisão humana (253 files/2426 testes, 4 gates verdes); Task 8 (checkpoint humano de ENTREGA) EM CHECKPOINT aguardando re-aprovação humana

# Dependency graph
requires:
  - phase: fase-45-briefing-contextual-do-diretor-de-arte
    provides: 45-07 (UAT humano comparativo — defeito de alinhamento Diretor × Revisor descoberto; premissa 'revisor congelado' corrigida), 45-06 (4 .md do diretor HUMAN-APPROVED pós-F45-06a/06b), 45-03/45-04 (mapa FINAL de 12 chaves), splitDirectorLegalText canônico (quick 260902-kqo + 45-02)
provides:
  - Contrato interno do Revisor splitado: ImageReviewInput com requiredArtworkText/illustrativeNotice (mesmo splitDirectorLegalText do Diretor) + sensitiveConstraints/objective como contexto; builders finos de dados
  - campaign-image-reviewer.md reescrito com autoridade estreita: O que recebe/verifica/bloqueia (critical)/passa (minor) + políticas de severidade/tolerância legíveis; identidade visual 100% fora da avaliação (0 menções a corte/borda/fidelidade/logo/assinatura como alvo)
  - expectedCommercialTone offer sem 'CTA de compra esperado'/'senso de urgência'; availabilityNotes fora da montagem ativa do Diretor (commercialDetailsSection) com legado/schema/domínio intactos
  - identityReferenceSection canônico único (área segura, margem nas 4 bordas, posição secundária, fidelidade/anti-invenção) p/ os 4 intents
  - 19 testes novos provando o contrato (15 provas + regressões), 4 gates verdes (253 files/2415 testes)
  - RODADA DE AJUSTE FOCADO (pós-revisão humana): offer background = expectativa visual (sem "Fundo contextual NÃO é aceito"), regra de originalPrice corrigida, escassez inventada critical, ambiguidade tipográfica do nome do produto tolerada (caso Coca Cola 2l×21), parágrafo de oferta do Diretor autorizado em commit separado — 253 files/2426 testes, 4 gates verdes
  - 45-08-ENTREGA.md com os 4 prompts finais do Revisor montados via caminho real + prompt do Diretor com identidade + contrato Diretor × Revisor — EM CHECKPOINT
affects: [retomada do UAT do 45-07 com casos corrigidos (pós-aprovação), fechamento da F45 (registros + arquivamento), F44 (fora da numeração — intacta)]

# Tech tracking
tech-stack:
  added: []
  patterns: [split canônico único alimentando Diretor e Revisor (splitDirectorLegalText); builders de seção montam apenas dados (heading + valor + natureza) enquanto políticas de julgamento vivem no .md; identidade visual tratada como fora da avaliação do Revisor — o modelo nunca recebe a imagem de identidade; teste de não-envio da identidade como imagem]

key-files:
  created: [.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-08-ENTREGA.md]
  modified: [prompts/campaign-image-reviewer.md, src/lib/image-generation/services/image-review-service.ts, src/lib/image-generation/services/image-generation-service.ts, src/lib/image-generation/services/art-director-briefing.ts, src/lib/image-generation/services/__tests__/image-review-service.test.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts, src/lib/image-generation/services/__tests__/art-director-briefing.test.ts, src/lib/campaign/__tests__/prompt-reframe.test.ts]

key-decisions:
  - "Revisor recebe requiredArtworkText e illustrativeNotice em seções independentes alimentadas pelo MESMO splitDirectorLegalText do Diretor — legalNoticeText concatenado removido do contrato interno (T-45-08a mitigado por testes 1–4)"
  - "sensitiveConstraints e objective chegam ao Revisor como seções contextuais próprias SEM política embutida nos builders; julgamento (violação claramente visível; objective nunca reprova) vive no .md"
  - "Offer sem CTA exigido e sem 'senso de urgência' no expectedCommercialTone; urgência avaliada só quando derivada de fato explícito (badge/validade/condição) — política no .md"
  - "availabilityNotes retirado APENAS da montagem ativa do Diretor (commercialDetailsSection); schema/domínio/snapshot, buildAvailabilityLine e buildCommercialRepertoire legados intactos (testes legados verdes)"
  - "Identidade visual consolidada em instrução canônica única no identityReferenceSection (área segura/margem 4 bordas/posição secundária/anti-invenção) e COMPLETAMENTE fora da avaliação do Revisor — o .md do Revisor tem zero menção a identidade como alvo e teste prova que identityImageUrl nunca é enviada como imagem"
  - "RODADA DE AJUSTE (pós-revisão humana): expectedImageTreatment de offer passou a ser expectativa visual sem 'Fundo contextual NÃO é aceito' (fundo contextual publicável é minor/passa); dedução 'originalPrice vazio → nenhum preço' removida (Revisor segue exclusivamente expectedPriceBehavior); escassez não autorizada virou invented_information critical (disclaimers genéricos neutros seguem minor); wrong_product_name exige divergência clara e inequívoca com tolerância a ambiguidade tipográfica (l/I/1, O/0, caixa, pontuação) e caso Coca Cola 2l×21 documentado como não-bloqueante"

patterns-established:
  - "Contrato Diretor × Revisor com política no .md: builders finos (dados); severidade/tolerância legíveis no prompt; teste 15 garante .md sem vocabulário de identidade; teste 14 garante placeholders ⊆ variáveis sem identidade"
  - "Testes de prova a prova (1–15) com asserts explícitos por natureza (aviso only / obrigatório only / ambos / sensível+objetivo / availability ausente / identidade não-enviada / minor passa)"
  - "Rodada de ajuste com testes .md-level: deduções inválidas (originalPrice vazio) e expressões absolutas (fundo NÃO aceito) verificadas por AUSÊNCIA no .md; políticas novas (OCR não-rígido, escassez critical, fundo expectativa visual) verificadas por PRESENÇA textual; sincronia base/offer testada por igualdade de conteúdo"

requirements-completed: [F45-REVIEWER-ALIGN]

# Metrics
duration: ~75min (Tasks 1–7; checkpoint Task 8 na entrega) + ~20min (rodada de ajuste focado pós-revisão humana)
completed: 2026-09-05
---

# Phase 45 Plan 08: Alinhamento Diretor de Arte × Revisor de Imagem — PARTIAL (Tasks 1–7 + rodada de ajuste verdes; Task 8 EM CHECKPOINT)

**Contrato legal do Revisor splitado no mesmo split canônico do Diretor (requiredArtworkText × illustrativeNotice), sensitiveConstraints/objective como contexto próprio, políticas de severidade/tolerância legíveis no campaign-image-reviewer.md com autoridade estreita (identidade visual 100% fora da avaliação), offer sem CTA/urgência exigidos, availabilityNotes fora da montagem ativa do Diretor e bloco de identidade canônico único (área segura/margem 4 bordas/posição secundária) — 19 testes novos, 4 gates verdes (253 files/2415 testes); RODADA DE AJUSTE FOCADO pós-revisão humana (offer background = expectativa visual, regra de originalPrice corrigida, escassez inventada critical, tolerância a ambiguidade tipográfica do nome do produto, commit separado do parágrafo de offer do Diretor) — 253 files/2426 testes, 4 gates verdes; ENTREGA (4 prompts finais do Revisor + Diretor com identidade + contrato) submetida à RE-aprovação humana na Task 8**

> **STATUS DO PLANO: PARTIAL — checkpoint.** Tasks 1–7 concluídas e commitadas individualmente. Task 8 (checkpoint humano `gate="blocking"`): os 4 gates estão verdes, o escopo foi confirmado por git e a ENTREGA (material de revisão) foi montada via caminho real e salva em `45-08-ENTREGA.md` — **aguardando re-aprovação humana após rodada de ajuste focado**. Nenhuma aprovação é inferida; nenhum arquivamento/encerramento foi feito. Segue o precedente do 45-06/45-07 (estado PARTIAL no checkpoint).

## Performance

- **Duration:** ~75 min (Tasks 1–7) + ~20 min (rodada de ajuste focado) — checkpoint da Task 8 na entrega
- **Started:** 2026-09-05T14:20:00Z (UTC-3)
- **Completed (parcial):** 2026-09-05 (checkpoint da Task 8 após rodada de ajuste)
- **Tasks:** 7/8 concluídas + rodada de ajuste (Task 8: material pronto + checkpoint)
- **Files modified:** 7 no núcleo (3 serviços + 1 .md de prompt + 3 suites) + 1 suite extra (prompt-reframe) + 2 `.md` de diretor (commit separado autorizado) na rodada
- **Testes:** baseline 2396 → **2426** (+30; +11 na rodada de ajuste)

## Accomplishments

### Task 1 — Contrato legal splitado no Revisor
- `ImageReviewInput.legalNoticeText` removido; entram `requiredArtworkText` + `illustrativeNotice` (tipos internos estritos).
- Builder único de texto integral substituído por **dois builders finos** (`requiredArtworkTextSection` / `illustrativeNoticeSection`): heading + valor sanitizado entre aspas + identificação da natureza — sem política de julgamento.
- Mapa de variáveis do Revisor sem `mandatoryArtworkTextSection`; chaves novas resolvem o `.md`.
- Os DOIS call sites (`reviewInput` real em `generateImage` e espelho `validatePrompts`) aplicam **`splitDirectorLegalText`** (helper `buildReviewerLegalText`) — mesmo split canônico do Diretor. `!enabled` → ambos `undefined`.
- Grep: `legalNoticeText` = 0 no service; `requiredArtworkText|illustrativeNotice` = 8.

### Task 2 — sensitiveConstraints (seção própria) + objective (contexto não-bloqueante)
- `ImageReviewInput` + `sensitiveConstraintsSection` (`## Restrições Sensíveis`, valor listado, toda restrição vale para a arte) e `objectiveSection` (`## Objetivo da Campanha`, contexto explicativo, NÃO conteúdo obrigatório).
- Placeholders `{{sensitiveConstraintsSection}}`/`{{objectiveSection}}` no `.md` junto das seções contextuais, fora dos critérios bloqueantes.
- Call sites preenchem dos MESMOS campos do domínio que o Diretor usa (`commercial.objective` / `creativeContext.sensitiveConstraints`).

### Task 3 — Offer sem CTA/urgência; availabilityNotes neutralizado no Diretor ativo
- `expectedCommercialTone` offer → **"Tom comercial e promocional coerente com uma campanha de oferta."** (0 ocorrências de "CTA de compra esperado"/"senso de urgência" no service).
- `commercialDetailsSection` (montagem ATIVA) **não monta mais a linha de Disponibilidade**; `buildAvailabilityLine` + `buildCommercialRepertoire` legados intocados (2 refs restantes = definição + chamada legada); schema/domínio/snapshot intactos.

### Task 4 — Instrução canônica única de identidade no Diretor
- `identityReferenceSection` consolidado em **bloco canônico único** por estado: com ativo (logo/VS) → DEVE usar + fidelidade + NÃO editar/redesenhar/distorcer/reinterpretar/completar/inventar + integralmente na área segura com margem visível nas 4 bordas + posição livre desde que legível/reconhecível/secundária ao conteúdo principal; `text_only` → cores/linguagem como referência sem inventar logotipo/assinatura.
- Sentença antiga de "respiro/cortes nas bordas" absorvida (sem redundância interna); `.md` mantém apenas a linha de composição simples. Bloco compartilhado pelos 4 intents.
- Grep: `área segura|margem visível|secundário ao conteúdo` = 2 no módulo.

### Task 5 — Autoridade estreita e políticas legíveis no campaign-image-reviewer.md
- `.md` reescrito com seções explícitas: **O que o Revisor recebe** (dados + comportamento + seções + nota explícita de que NÃO recebe imagem de identidade), **O que verifica**, **O que bloqueia (critical)**, **O que deve passar (minor)**, **Texto obrigatório × aviso ilustrativo** (separados, sem co-presença/ordem/proximidade/concatenação, sem posição do aviso, aviso ≠ parte de outro texto legal), **Objetivo/CTA/urgência** (objective não-bloqueante; CTA/hook não exigidos; urgência só de fato explícito), **Regras finais** (minor→passa; dúvida→minor; fundo não bloqueia isoladamente).
- Contrato JSON + formatos mantidos; badge/preço por intent intactos.
- Grep de segurança: **0 menções** a `área segura|corte|borda|fidelidade|logotipo|assinatura` no `.md`.

### Task 6 — Ajustes finos de suporte no service
- `authorizedContextSection` neutralizada (sem "NÃO devem ser reportadas como invented_information" — política vive no `.md` Regras finais). Demais builders já neutros pós-Tasks 1–5.
- `parseResult`/`determineFailureType`/`empty_review`/retry **intocados**; badge/preço por intent intactos.

### Task 7 — Testes: co-migração + 15 provas
- Co-migração dos asserts de `legalNoticeText`/`mandatoryArtworkTextSection` nas 3 suites (revisor/service/diretor) para o contrato splitado.
- **15 provas** cobertas por asserts: ① aviso only → só seção de aviso; ② obrigatório only → só seção obrigatória; ③ ambos → seções independentes sem concatenação; ④ conteúdo distinto nas duas seções (separação aceita); ⑤ sensitiveConstraints em seção própria; ⑥ objective contexto não-bloqueante (ausência → seção vazia); ⑦ details/additional apenas contexto autorizado; ⑧ offer sem CTA/urgência; ⑨ badge intacto (offer obrigatório exato / demais informado-opcional); ⑩ availabilityNotes não chega ao Revisor nem à montagem ativa (legado intacto); ⑪ identidade nunca enviada como imagem ao Revisor (contexto logo/VS); ⑫ 4 intents recebem orientação preventiva de identidade (área segura/margem) + base/text_only canônicos; ⑬ minor continua aprovando; ⑭ prompt final do Revisor sem placeholders residuais (placeholders ⊆ variáveis; sem identidade no conjunto); ⑮ `.md` do Revisor sem vocabulário de identidade nem concatenação/posição dos dois textos.
- **Suites verdes:** revisor 48, service 45, diretor 41, prompt-reframe 12; **vitest total 253 files/2415 testes**.

### Rodada de ajuste focado (pós-revisão humana) — ver `45-08-ENTREGA.md` (atualizado)
- **Offer background:** `buildExpectedImageTreatment` de offer (sem preserveImageContext) agora orienta isolar o produto mas declara fundo contextual "NÃO é bloqueio automático" (minor/passa quando publicável; bloqueia só se prejudicar claramente identificação/legibilidade/qualidade/entendimento). Expressão absoluta "Fundo contextual NÃO é aceito" removida do contrato (0 ocorrências no .md e no service). `.md` Regras finais ganhou a mesma política.
- **Regra de originalPrice corrigida:** removida do `.md` a dedução "Se {{originalPrice}} estiver vazio (zerado), nenhum preço foi informado"; Revisor segue exclusivamente `expectedPriceBehavior` (offer valida preço promocional informado; destaque valida preço único sem exigir original; exclusivo nenhum preço). `expectedPriceBehavior` intacto nos 3 intents (testes).
- **Escassez inventada:** `invented_information` critical agora inclui alegações de escassez não autorizadas ("estoque limitado", "últimas unidades", "poucas unidades"); "consulte condições"/"sujeito a disponibilidade" seguem minor quando não contradizem dado explícito. `availabilityNotes` NÃO reintroduzido no Diretor nem no Revisor.
- **Ambiguidade tipográfica (`wrong_product_name`):** crítica apenas em divergência clara e inequívoca; nova subseção "Nome do produto e ambiguidade tipográfica" com tolerância a `l`/`I`/`1`, `O`/`0`, caixa, espaços/pontuação/acentuação; caso "Coca Cola 2l Original" × leitura incerta "Coca Cola 21 Original" documentado como correspondência válida; dúvida → minor → approve; OCR rígido proibido.
- **Commit separado autorizado:** parágrafo de offer do Diretor (`campaign-image-director.md`/`-offer.md`) commitado em `1cb8a264`; base/offer sincronizados (teste de igualdade adicionado em prompt-reframe).
- **Suites verdes na rodada:** revisor 58, service 45, diretor 41, prompt-reframe 13; **vitest total 253 files/2426 testes** (+11 na rodada); typecheck/lint/build exit 0.

## Task Commits

1. **Task 1 (split contrato legal):** `1cb9a3bf` — refactor; 2 arquivos (image-review-service.ts, image-generation-service.ts)
2. **Task 2 (sensitiveConstraints + objective):** `db88b9bf` — feat; 3 arquivos (+ campaign-image-reviewer.md placeholders)
3. **Task 3 (offer tone + availabilityNotes fora do ativo):** `7dd82a4c` — refactor; 2 arquivos
4. **Task 4 (identidade canônica única):** `57c0a85a` — refactor; 1 arquivo (art-director-briefing.ts)
5. **Task 5 (reescrita do .md do Revisor):** `afd26ee5` — feat; 1 arquivo
6. **Task 6 (builders finos):** `c9a03918` — refactor; 1 arquivo
7. **Task 7 (testes + 15 provas):** `91e1a9ac` — test; 3 arquivos de teste (+421/−31)
8. **Rodada de ajuste focado — commit SEPARADO do parágrafo de offer do Diretor:** `1cb8a264` — feat; 2 arquivos (`prompts/campaign-image-director.md` + `-offer.md`, conteúdo autorizado em revisão humana; base/offer sincronizados)
9. **Rodada de ajuste focado — código + .md do Revisor:** commit desta rodada (refactor/feat; image-review-service.ts + campaign-image-reviewer.md)
10. **Rodada de ajuste focado — testes:** commit desta rodada (test; image-review-service.test.ts + prompt-reframe.test.ts)
11. **Task 8:** EM CHECKPOINT — material em `45-08-ENTREGA.md` (commit docs deste SUMMARY + ENTREGA)

## Files Created/Modified

- `prompts/campaign-image-reviewer.md` — reescrita com autoridade estreita e políticas legíveis (Task 5) + ajustes da rodada (offer background expectativa visual; regra de originalPrice corrigida; escassez inventada critical; subseção de ambiguidade tipográfica do nome do produto)
- `src/lib/image-generation/services/image-review-service.ts` — input splitado + builders finos + seções novas + authorizedContextSection neutra (Tasks 1/2/6) + `buildExpectedImageTreatment` offer sem "Fundo contextual NÃO é aceito" (rodada)
- `src/lib/image-generation/services/image-generation-service.ts` — call sites com splitDirectorLegalText + sensitiveConstraints/objective (Tasks 1/2)
- `src/lib/image-generation/services/art-director-briefing.ts` — commercialDetailsSection sem availability + identityReferenceSection canônico (Tasks 3/4)
- `src/lib/image-generation/services/__tests__/image-review-service.test.ts` — co-migração + provas 1–8/10/13–15 (48 testes) + provas da rodada de ajuste (10 testes novos; 58 no total)
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` — co-migração + prova 11 (45 testes)
- `src/lib/image-generation/services/__tests__/art-director-briefing.test.ts` — co-migração + provas 10/12 (41 testes)
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` — teste de sincronia base/offer (13 testes; rodada)
- `prompts/campaign-image-director.md` + `prompts/campaign-image-director-offer.md` — parágrafo de offer autorizado (commit separado `1cb8a264`)
- `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-08-ENTREGA.md` — material da Task 8 atualizado na rodada (4 prompts do Revisor + Diretor + contrato)

## Decisions Made

- **Split canônico único:** o Revisor passa a consumir o MESMO `splitDirectorLegalText` do Diretor (paridade de origem garantida por construção; helper `buildReviewerLegalText` nos 2 call sites).
- **Política no `.md`, builders montam dados:** a reescrita do Revisor concentra severidade/tolerância; os builders de seção ficam finos (heading + valor + natureza). Ajuste fino (Task 6) removeu a última frase de política redundante de `authorizedContextSection`.
- **Validade permanece como regra de dados escopada à seção** (fidelidade dd/mm/aaaa quando a seção existe) — comportamento operacional F40 preservado, coerente com `expectedPriceBehavior`/`expectedBadgeBehavior` que também são fatos de dados.
- **Identidade visual = fora da avaliação do Revisor:** o modelo nunca recebe a imagem; nenhuma menção a corte/posição/tamanho/fidelidade de identidade em qualquer seção do `.md`; a única checagem de marca é o nome correto da loja quando exigido.
- **availabilityNotes** continua no schema/domínio/snapshot e no builder legado; some apenas da montagem ativa do Diretor e nunca chega ao Revisor.
- **Offer sem CTA esperado e sem senso de urgência** no tom esperado; a urgência derivada de fato explícito é política do `.md`.

## Deviations from Plan

Nenhuma até o checkpoint — plano executado como escrito (Tasks 1–7 + rodada de ajuste autorizada). Observações registradas (não são desvios):
- **Task 8 não concluída por definição:** checkpoint humano `gate="blocking"` — o executor para e aguarda re-aprovação antes de qualquer arquivamento/encerramento da fase.
- **Parágrafo de offer do Diretor (pré-existente na working tree) commitado em rodada autorizada:** `prompts/campaign-image-director.md` e `campaign-image-director-offer.md` carregavam (desde 2026-09-04 18:11) uma edição local não commitada adicionando orientação de isolamento de produto para ofertas ("Para campanhas de oferta, isole o produto..."). Em rodada de revisão humana o conteúdo foi **autorizado** e commitado em **commit SEPARADO e claramente identificado** (`1cb8a264`) — base/offer confirmados sincronizados (conteúdo idêntico; teste de sincronia em prompt-reframe). A pasta pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` permaneceu intocada.
- Artefatos temporários de montagem (specs vitest `tmp-45-08-mount.spec.ts`/`tmp-45-08-round2-mount.spec.ts` + pasta `tmp-45-08-material`) removidos antes do commit; conteúdo preservado em `45-08-ENTREGA.md`.

**Total de desvios:** 0 auto-corrigidos
**Impacto no plano:** Nenhum — escopo respeitado integralmente até o checkpoint.

## Issues Encountered

- Nenhum problema de implementação. A montagem do material via console do vitest no PowerShell degradava os acentos (UTF-8); contornado escrevendo os outputs via `fs.writeFileSync` (UTF-8) e montando o `45-08-ENTREGA.md` com script Node temporário (removido).

## Task 8 — Material de ENTREGA (EM CHECKPOINT)

**Arquivo de revisão:** `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-08-ENTREGA.md` (contém os 4 prompts finais montados do Revisor + prompt do Diretor com identidade + prova de área segura + contrato final).

### 1. Gates finais — 4/4 VERDES (sem chamadas de IA)
- `npx vitest run` → **253 files / 2415 testes passed** (baseline 2396 → +19)
- `npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm run build` → exit 0

### 2. Escopo respeitado por git (superfícies confirmadas INTACTAS)
`git diff --name-only a3abdf47..HEAD` (7 commits do 45-08) limita-se aos 7 arquivos-alvo do plano. **Nenhum arquivo fora do escopo mudou:** UI/form (`use-campaign-form*`), `schema.ts`/`GenerateImageRequestSchema`, `brief.ts`/`brief-schema.ts`/snapshot/domínio, Copy Director (`src/lib/copy/*` + `campaign-copy-director*.md`), `providers/openai.ts`, credits/metrics/telemetry, config, rota `generate-image`, `prompt-loader`/`prompt-validator` — todos intactos. Badge e preço por intent sem mudança (asserts originais verdes).

### 3. Os 4 prompts finais do Revisor montados (caminho real) — resumo estrutural
| Caso | Seções presentes no prompt final montado | Validação |
|------|------------------------------------------|-----------|
| ① Somente aviso | `## Aviso Ilustrativo` (texto do aviso) — **sem** `## Texto Obrigatório na Arte` | caso 1 do ENTREGA |
| ② Somente texto obrigatório | `## Texto Obrigatório na Arte` — **sem** `## Aviso Ilustrativo` | caso 2 do ENTREGA |
| ③ Ambos | **Duas seções independentes** (`## Texto Obrigatório na Arte` e `## Aviso Ilustrativo`, sem concatenação) | caso 3 do ENTREGA |
| ④ Restrição sensível + objetivo | `## Restrições Sensíveis` (valor listado) + `## Objetivo da Campanha` (contexto) | caso 4 do ENTREGA |

Todos com **zero `{{placeholder}}` residual** e tom comercial offer = "Tom comercial e promocional coerente com uma campanha de oferta."

### 4. Contrato final Diretor × Revisor + prova de área segura
Tabela completa no `45-08-ENTREGA.md`. Destaques: texto obrigatório e aviso chegam ao Revisor em seções independentes; availabilityNotes não chega ao Diretor ativo nem ao Revisor; objective/restrições como contexto; **identidade fora da avaliação** (Revisor não recebe a imagem e o `.md` não a menciona como alvo); Diretor recebe instrução canônica única de identidade com área segura/margem nas 4 bordas/posição secundária (Anexo C: `identityReferenceSection` montado com logo).

### 5. Próximo passo (humano)
Responder **"approved"** (autoriza retomar o UAT do 45-07 com casos corrigidos e posterior fechamento da F45) ou descrever ajustes. Nada foi arquivado/encerrado.

## Self-Check: PASSED

- Commits Tasks 1–7 existem: `1cb9a3bf`, `db88b9bf`, `7dd82a4c`, `57c0a85a`, `afd26ee5`, `c9a03918`, `91e1a9ac` ✓; commit separado do parágrafo de offer: `1cb8a264` ✓
- 4 gates: vitest 253 files/2426 testes exit 0; typecheck exit 0; lint exit 0; build exit 0 ✓
- Greps do plano: Task 1 (`requiredArtworkText|illustrativeNotice`=8, `legalNoticeText`=0 no service) ✓; Task 2 (`sensitiveConstraintsSection|objectiveSection`=4 no service, 2 no .md) ✓; Task 3 (`CTA de compra esperado|senso de urgência`=0; `buildAvailabilityLine`=2 no diretor) ✓; Task 4 (`área segura|margem visível|secundário ao conteúdo`=2 no diretor) ✓; Task 5 (0 menções de identidade no `.md` do Revisor) ✓
- Rodada de ajuste: 0 ocorrências de "Fundo contextual NÃO é aceito"/"nenhum preço foi informado" no `.md`/service ✓; `.md` com subseção de ambiguidade tipográfica + caso Coca Cola ✓; base/offer idênticos (hash igual) ✓
- Superfícies congeladas intactas por git (diff dos commits = só os arquivos-alvo) ✓
- `45-08-ENTREGA.md` atualizado na rodada (fences balanceados, contrato presente, seção da rodada) ✓
- Suites-alvo verdes na rodada: revisor 58, service 45, diretor 41, prompt-reframe 13 ✓
- **NENHUMA aprovação humana é reivindicada** — Task 8 aguarda o avaliador (re-aprovação) ✓

---

*Phase: 45-briefing-contextual-do-diretor-de-arte*
*Status: PARTIAL — Tasks 1–7 + rodada de ajuste verdes; Task 8 EM CHECKPOINT (2026-09-05)*
