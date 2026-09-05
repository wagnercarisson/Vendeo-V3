# Tasks — Fase 45: Briefing Contextual do Diretor de Arte

> Divide a implementação em **plans pequenos (45-01..45-07)** conforme o design. Executar somente após revisão/aprovação dos artefatos (proposal/design/specs). Cada plano mantém os 4 gates verdes (vitest/typecheck/lint/build). Specs de referência: `specs/ai-image-generation/spec.md` (delta) e `specs/art-director-contextual-briefing/spec.md` (nova capability). Design de referência: `design.md`.

## 1. Plan 45-01 — Trackings e inventário de consumidores (onda 1)

- [ ] 1.1 Registrar F45 (Briefing Contextual do Diretor de Arte) nos runbooks de trackings conforme padrão de fases anteriores; grep-verificação de nomenclatura F44/F45 com zero resíduos
- [ ] 1.2 Grep de consumidores das chaves do mapa atual de `buildPromptVariables` (`commercialFrame`, `hasCategoryConflict`, `brandColorsChosen`, `visualStyle`, `visualTone`, `brandPersonality`, `campaignGuidelines`, `campaignBrief`, `identityImageUrl`, `campaignIntent`) para confirmar quais são usadas por template/roteamento/eventos de detail — registrar tabela de decisão (manter/remover/mover para bloco) sem alterar código
- [ ] 1.3 Confirmar superfícies congeladas com grep: revisor (`image-review-service.ts`, `campaign-image-reviewer.md`), Copy Director, fallback OpenAI (quick 260902-mqj), `GenerateImageRequestSchema`, `buildMandatoryArtworkText`/`buildValidityDisplayText`/`buildCampaignGenerationBody` — registrar baseline de não-mudança
- [ ] 1.4 Registrar baseline de testes atuais (golden 39 keys, `prompt-reframe`, `validatePrompts`) e decisão sobre o arquivo base `campaign-image-director.md` (mantido em sync como referência offer/geral)

## 2. Plan 45-02 — Helper puro `art-director-briefing` + extração sem mudança de comportamento (onda 1)

- [ ] 2.1 Criar `src/lib/image-generation/services/art-director-briefing.ts` com funções puras que **extraem sem mudar comportamento** os builders atuais (`commercialRepertoire`, `validationSummary`, `creativeContextGuidance`, `brandProfileSection`), `splitDirectorLegalText` e formatação de preço; portar `sanitizePromptText` como **cópia pura disponível (sem aplicá-la ao prompt final do diretor nesta etapa — aplicação só no 45-03, dentro dos blocos novos)**; não alterar o revisor
- [ ] 2.2 Delegar `buildPromptVariables` do service ao novo módulo mantendo **saída idêntica** (paridade garantida): rodar gates e golden tests atuais verdes antes de qualquer mudança de template
- [ ] 2.3 Criar testes unitários iniciais do módulo puro (mesmas asserções dos builders atuais movidas para o módulo)

## 3. Plan 45-03 — Reescrita dos templates `offer` + base e montagem contextual para offer (onda 2)

> **Alerta ao executor (reescrita com mão leve):** nos plans 45-03/45-04 a reescrita editorial dos `.md` deve ser **cirúrgica**. A fase reorganiza, rotula melhor e remove repetição — **não "moderniza" o texto nem troca o vocabulário/frases que já funcionam**. Preservar o DNA atual do diretor (tom, instruções, regras, liberdade criativa): reaproveitar ao máximo o texto existente movendo-o de lugar, só ajustando onde a estrutura/duplicação exige. Qualquer paráfrase desnecessária é risco de regressão de qualidade — validação por âncoras de conteúdo e UAT humano comparativo.

- [ ] 3.1 Reescrever `prompts/campaign-image-director.md` (base/referência offer) e `campaign-image-director-offer.md` na estrutura editorial + blocos contextuais (D2/D3 do design): seções editoriais fixas legíveis + slots nomeados por bloco; sem micro-tabela sempre-presente; heading fixo apenas onde o conteúdo é garantido
- [ ] 3.2 Implementar os blocos para offer no helper: `campaignFactsSection` (campos presentes; **validade em ocorrência única** quando `offer` + `validity.enabled`), `commercialDetailsSection` (**details + disponibilidade keyword-gated**; nada de validade), `requiredArtworkTextSection` (só texto livre, **saneado aqui**), `illustrativeNoticeSection` (só aviso), `identityReferenceSection` (heading fixo: directive + preservação quando ativo), `productReferenceSection` (heading fixo: fidelidade + hierarquia 1+N + preserveImage), `constraintsSection` (só `sensitiveConstraints`), `creativeDirectionSection` (**repertório recomposto sem validade/details** — repartição do `buildCommercialRepertoire`: validity→facts, details/availability→`commercialDetailsSection`; persona/categoria/conflict/guidance/brand profile)
- [ ] 3.3 Remover duplicações no prompt offer: validade, detalhes, disponibilidade, aviso e texto obrigatório em **bloco canônico único** (repartição do repertório concluída — nada reintroduz validity/details); nada de seção vazia/linha de tabela em branco para campos ausentes
- [ ] 3.4 Adaptar `validatePrompts` (placeholders dos novos slots; zero placeholder não resolvido) e `assemblePrompt` para o texto contextual de offer; manter rodapé CORRECT/REGENERATE
- [ ] 3.5 Rodar gates (vitest/typecheck/lint/build) e validar por amostragem o prompt offer montado (sem vazios/duplicação, riqueza preservada)
- [ ] 3.6 Conferir a reescrita editorial offer/base com mão leve: vocabulário e frases funcionantes preservados (diff textual priorizando movimento/reorganização sobre paráfrase), apenas rotulagem/deduplicação/remoção de repetição

## 4. Plan 45-04 — Reescrita `spotlight` e `exclusive` (onda 2)

- [ ] 4.1 Reescrever `prompts/campaign-image-director-spotlight.md` e `campaign-image-director-exclusive.md` na mesma estrutura (diferenças: sem validade; spotlight preço único sem DE/POR; exclusive **sem preço**; `preserveImageDirective` quando aplicável)
- [ ] 4.2 Ajustar blocos por intent no helper (ex.: `campaignFactsSection` de exclusive sem preço; `productReferenceSection` com preserveImageContext em não-offer)
- [ ] 4.3 Rodar gates e validar por amostragem os prompts spotlight/exclusive montados (sem vazios/duplicação; tom por intent preservado)
- [ ] 4.4 Conferir a reescrita editorial spotlight/exclusive com mão leve: DNA do diretor por intent preservado (tom de destaque sem urgência / premium sem preço), apenas reorganização/rotulagem/deduplicação

## 5. Plan 45-05 — Testes: co-migração e cobertura contextual (onda 3)

- [ ] 5.1 Co-migrar golden tests de `image-generation-service.test.ts` (39 keys por intent) para invariantes: placeholders dos templates ⊆ chaves fornecidas; determinismo; presença/ausência por bloco (offer/spotlight/exclusive)
- [ ] 5.2 Atualizar testes de `validatePrompts` (novos slots; casos com/sem texto obrigatório e aviso) e casos do quick 260902-kqo (a/b/c) para a nova estrutura
- [ ] 5.3 Atualizar `prompt-reframe.test.ts` com as novas âncoras: presença das seções editoriais nos 4 `.md`, ausência de templates secos, aviso/texto obrigatório em seção própria, hierarquia 1+N, ausência da frase incondicional antiga
- [ ] 5.4 Criar testes do helper `art-director-briefing` por bloco presente/ausente: brief mínimo (sem texto obrigatório/aviso/validade/restrições/detalhes) → nenhuma seção vazia/heading órfão/linha em branco; brief completo → cada natureza em **uma** ocorrência; texto do lojista com `{{` saneado sem placeholder residual
- [ ] 5.5 Rodar gates e garantir regressão verde das suites irmãs de revisor/copy/form/rota (sem co-migração)

## 6. Plan 45-06 — Regressão completa e verificação de não-mudança do contrato externo (onda 4)

- [ ] 6.1 Rodar regressão completa (vitest total) e corrigir resíduos de fixtures/asserções que referenciem o mapa antigo de variáveis ou âncoras antigas dos `.md`
- [ ] 6.2 Rodar typecheck, lint e build; verificar que rota HTTP/schema/snapshot/domínio/form/revisor/copy/fallback OpenAI continuam intactos (suites de não-mudança do 1.3/5.5)
- [ ] 6.3 Revisar os 4 `.md` reescritos por humano (legibilidade editorial + slots com intenção clara) e o texto final montado em casos representativos

## 7. Plan 45-07 — Verificação final (onda 5)

- [ ] 7.1 Gerar `45-VERIFICATION.md` (goal-backward sobre specs/critérios da proposta) e `45-UAT.md` (roteiro humano comparativo: campanhas reais antes/depois — identidade, aviso, texto obrigatório, validade, multi-imagem, oferta)
- [ ] 7.2 Confirmar 4 gates verdes e os critérios de aceitação da proposta (legibilidade dos `.md`, prompt sem seções vazias, separação aviso × texto obrigatório, preservação de identidade, fidelidade de produto/referências, anti-invenção e criatividade preservados, contrato externo inalterado, revisor fora do escopo)
- [ ] 7.3 Atualizar registros (AGENTS.md/STATE/ROADMAP e arquivamento do change) após aprovação
