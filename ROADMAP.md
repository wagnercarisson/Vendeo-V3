# Vendeo — Roadmap

> Milestones: **Contas e Propriedade** (v1.2 ✓) | **Persistência e Entrega da Campanha** (v1.3 ✓) | **Experiência SaaS** (v1.4 ✓) | **Lançamento Externo Controlado** (v1.5 ◆)

## Milestones

- ✅ **v1.4 Experiência SaaS** — F18-F22 (shipped 2026-07-15)
- ✅ **v1.3 Persistência e Entrega da Campanha** — F12-F17 (shipped 2026-07-10)
- ✅ **v1.2 Contas e Propriedade** — F7-F11 (shipped 2026-07-08)
- ✅ **v1.1 Motor de Campanhas** — shipped 2026-07-03
- ✅ **v1.0 Core de Geração** — shipped 2026-07-03

## Phases

<details>
<summary>✅ v1.4 Experiência SaaS (F18-F22) — SHIPPED 2026-07-15</summary>

O Vendeo passou a parecer e funcionar como um produto SaaS coerente — app shell profissional, navegação PT-BR, dashboard, onboarding, busca e mobile.

- [x] Phase 18: App Shell + UI Base + Rotas (3/3 plans) — 2026-07-13
- [x] Phase 19: Onboarding & Estados Vazios (3/3 plans) — 2026-07-13
- [x] Phase 20: Dashboard (3/3 plans) — 2026-07-13
- [x] Phase 21: Histórico e Busca (3/3 plans) — 2026-07-14
- [x] Phase 22: Mobile Hardening (3/3 plans) — 2026-07-15

</details>

<details>
<summary>✅ v1.3 Persistência e Entrega da Campanha (F12-F17) — SHIPPED 2026-07-10</summary>

O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

- [x] Phase 12: Fundação DB/Storage (5/5 plans) — 2026-07-09
- [x] Phase 13: Serviço de Persistência e Download (3/3 plans) — 2026-07-09
- [x] Phase 14: Integração no Fluxo de Geração (3/3 plans) — 2026-07-10
- [x] Phase 15: Página de Campanha (3/3 plans) — 2026-07-10
- [x] Phase 16: Minhas Campanhas (3/3 plans) — 2026-07-10
- [x] Phase 17: Edição de Publication Copy (2/2 plans) — 2026-07-10

</details>

<details>
<summary>✅ v1.2 Contas e Propriedade (F7-F11) — SHIPPED 2026-07-08</summary>

Autenticação completa, vínculo user→store, isolamento multi-tenant, beta.vendeo.tech operacional.

- [x] Phase 7: Sessão e Login Vertical (5/5 plans) — 2026-07-04
- [x] Phase 8: Ciclo de Conta (4/4 plans) — 2026-07-06
- [x] Phase 9: Cutover de Ownership e Onboarding (4/4 plans) — 2026-07-06
- [x] Phase 10: Perímetro Multi-tenant (6/6 plans) — 2026-07-07
- [x] Phase 11: Verificação e Hardening (1/1 plan) — 2026-07-08

</details>

### 📋 v1.5 — Lançamento Externo Controlado ◆

Copy Director com IA, pipeline de geração paralelo, sistema de créditos, admin operacional para suporte beta, UI de saldo e extrato, créditos mensais automáticos, observabilidade, launch readiness, UAT externo, fundação legal, modelo comercial, freemium anti-abuso CNPJ, changelog/novidades, onboarding por abas (F36), revisão e aprovação da arte (F37), tabela de custos por operação (F38), brief estruturado de campanha (F39), mídia de campanha mobile (F41), signup controlado e elegibilidade freemium (F42), revisão do brief pré-geração (F43) e briefing contextual do diretor de arte (F45).

<details open>
<summary>◆ v1.5 Lançamento Externo Controlado (F23-F39) — Em andamento</summary>

> **Monetização pública / Stripe** — iniciativa diferida **não numerada** (v1.7+), reaberta quando houver condição real de executar (empresa, jurídico, contabilidade, operação fiscal, decisão de monetização). Fora da tabela de fases numeradas.

Copy Director com IA, pipeline de geração paralelo, sistema de créditos, admin operacional para suporte beta, UI de saldo e extrato, créditos mensais automáticos, observabilidade, launch readiness, fundação legal, modelo comercial, store readiness, campos comerciais e avisos do brief (F40), mídia de campanha mobile (F41), signup controlado e elegibilidade freemium (F42), revisão do brief pré-geração (F43) e briefing contextual do diretor de arte (F45).

- [x] Phase 23: Text Provider + Copy Director (2/2 plans ✅)
- [x] Phase 24: Créditos — Schema, Saldo e Transações (2/2 plans ✅)
- [x] Phase 25: Pipeline de Geração v1.5 (3 plans ✅)
- [x] Phase 26: Admin Operacional + Convites + Créditos Manuais (3 plans ✅)
- [x] Phase 27: Conta + Saldo Visível + Extrato (3 plans ✅)
- [x] Phase 28: Observabilidade + Operação + Launch Controls (4 plans ✅)
- [x] Phase 29: Refinamento Visual + UAT + Launch Readiness (4/4 plans ✅)
- [x] Phase 29.1.1: Créditos na Assinatura Visual (3 plans ✅)
- [x] Phase 29.1.2: Histórico Curto + Assinatura Visual (3 plans ✅)
- [x] Phase 29.3: Créditos Mensais Automáticos (4/4 plans ✅)
- [x] Phase 30: Fundação Legal (6/6 plans ✅)
- [x] Phase 31.1: Modelo Comercial — Formulário (5/5 plans ✅)
  - CampaignIntent type (`"offer" | "spotlight" | "exclusive"`)
  - Inferência automática de intent a partir dos campos de preço
  - Seletor de intent no formulário com "Em breve" para spotlight/exclusive
  - Badge options separados por intent
  - preserveImageContext checkbox (visível apenas em spotlight/exclusive)
  - Pipeline guard para rejeitar intents não-offer

- [x] Phase 31.2: Diretores por Intenção (6 plans ✅)
  - Schemas tolerantes: discountedPriceCents opcional, CampaignSpecSchema nullable
  - Desbloqueio de spotlight/exclusive na UI, form e pipeline
  - 6 prompts separados por intent (3 image + 3 copy)
  - Roteamento de prompt por campaignIntent nos diretores de imagem e copy
  - commercialFrame substituindo offer no Copy Director
  - Conteúdo adaptado por intent (repertoire, guidance, fallback determinístico)
  - Normalização de exclusive com preço indevido
  - 15 testes, regressão zero para offer, 1051 testes totais

- [x] Phase 31.3: Quality Gate por Intenção Comercial (6 plans ✅)
  - ImageReviewInput com campaignIntent, preserveImageContext; badgeText/discountedPrice opcionais
  - ReviewIssueType union nomeada (17 valores); failureType string | null explícito
  - commercial_tone_mismatch como novo issue type
  - Prompt campaign-image-reviewer.md reestruturado com variáveis contextuais (expectedPriceBehavior, expectedBadgeBehavior, expectedImageTreatment, expectedCommercialTone, campaignIntentLabel)
  - review() monta variáveis em 2 etapas; expectedBadgeBehavior com 3 variantes por intent
  - callVisionModel trata empty_review como resultado estruturado
  - validatePrompts intent-aware com verificação de placeholders antigos
  - applyValidationContextToReviewResult reconhece commercial_tone_mismatch como non-removable
  - InputValidationService verificado (sem alteração)
  - 5 cenários E2E com IA real

- [x] Phase 32: Freemium Anti-Abuso CNPJ (5/5 plans ✅)
  - CNPJ obrigatório na criação da loja com validação de dígitos verificadores + formato
  - `stores.cnpj_normalized` + `stores.cnpj_root_hash` — CNPJ normalizado, hash HMAC-SHA256 da raiz com pepper server-side
  - `freemium_entitlements` — tabela de controle com idempotência (INSERT ... ON CONFLICT)
  - Onboarding grant (10 créditos) uma única vez por raiz de CNPJ
  - Créditos mensais (5 créditos) uma única vez por raiz de CNPJ por ciclo
  - Admin: CNPJ mascarado, badge de status freemium, exceção manual auditável
  - Termos de Uso v1.2 e Política de Privacidade v1.1
  - Lojas legadas: atualização cadastral sem novo grant de créditos
  - Pipeline guard de reaceite v1.2

- [ ] Phase 33: Verificação CNPJ Freemium (planned ◆)
  - Consulta cadastral externa de CNPJ — BrasilAPI como provedor primário, CNPJá como fallback, tratamento de timeout/erro/rate limit
  - Preenchimento automático de dados oficiais no formulário de criação de loja (razão social/nome fantasia bloqueados, endereço editável)
  - Cross-check de verossimilhança — nome da loja vs razão social/nome fantasia oficiais, cidade/UF informada vs oficial
  - Motor de decisão determinístico de elegibilidade: approve / review / reject / defer
  - Liberação condicional do freemium — concede onboarding grant apenas se decisão = approve
  - Cache de consulta CNPJ com TTL 24h (tabela `cnpj_lookup_cache`)
  - Fila de revisão admin (`/admin/reviews`) com abas Pendentes/Adiados/Recusados/Aprovados, ações Aprovar/Recusar/Exceção com audit trail
  - Criação de store de teste pelo admin com CNPJ fictício (`is_test_store`)
  - Revelação de CNPJ auditada no admin com registro em admin_audit_log
  - Mensagens ao usuário por estado (lookup, approve, review, reject, defer)
  - **Dependências:** F32 (cnpj validation, freemium entitlements, store route, admin), F30 (legal clearance, admin_audit_log), F24 (credit_transactions)
  - **Plans:**
    - [ ] 33-01-PLAN.md — Migration + Core Libraries (Lookup, Verification, Risk Service)
    - [ ] 33-02-PLAN.md — Store Route + Grant Conditional
    - [ ] 33-03-PLAN.md — Store Identity Form + Dashboard Banners
    - [ ] 33-04-PLAN.md — Admin Reviews + Test Stores + Privacy
    - [ ] 33-05-PLAN.md — Tests + Verification

- [ ] Phase 34: Store Readiness (pending)
  - getStoreReadiness() com RPC check_store_readiness — ready: boolean, missing: MissingItem[]
  - Guarda dupla: server component (/campanhas/nova) + API (412 Precondition Required)
  - Step 2 renomeado para "Direção Visual" com badge "Necessário", três caminhos (logo, VS, text-only)
  - Store type com campos CNPJ tipados (eliminar casts as unknown)
  - StoreBillingInfo type + tabela store_billing_info (não bloqueante)
  - Card colapsável de billing no Step 1 com pré-preenchimento via BrasilAPI/CNPJá
  - Dashboard banner de prontidão com checklist de pendências
  - Migration SQL: tabela store_billing_info + RPC check_store_readiness()
  - Dependências: F32 (cnpj_normalized, razao_social, nome_fantasia), F33 (store_brand_profiles, verification_status), F30 (legal clearance)

- [x] Phase 35: Changelog / Novidades (5/5 plans)
- [x] Phase 36: Onboarding — Navegação por Abas (6/6 plans ✅)
- [ ] Phase 37: Revisão e Aprovação da Arte (pending)
- [x] Phase 38: Tabela de Custos por Operação (8/8 plans ✅)
  - [x] **38.1 = Apuração de Custos de IA por Entrega** (desdobramento da F38, v1.5) — trilha granular de custo de IA por entrega + views/RPCs de apuração e reconciliação (USD × créditos) — **CONCLUÍDA** (11/11 plans, 1713 testes, UAT validado; fechada como camada de ESTIMATIVA OPERACIONAL GRANULAR — `responses:image_generation = 0.065` provisório beta, reconciliação financeira real na próxima fase), fonte `openspec/changes/fase-38-1-ai-cost-accounting/`
  - [x] **38.2 = Admin de Custos Operacionais + Configurações Econômicas** (desdobramento da F38, v1.5) — painel admin `/admin/ai-operation-costs` (KPIs, filtros, tabela por entrega, drilldown call-level, agregados por segmento), parâmetros econômicos configuráveis (`usd_brl_rate`, `credit_value_brl`), badges de confiança, correção do `/admin/metrics` — **CONCLUÍDA 15/15 plans** (gap closure UAT: 38-2-12 RPCs com creditos_estornados/creditos_liquidos ✅, 38-2-13 service líquidos, 38-2-14 UI breakdown, 38-2-15 tracking; 63/63 asserts I1-I6, 1839 testes, gates verdes, UAT manual aprovado), fonte `openspec/changes/fase-38-2-admin-custos-operacionais/`
  - [x] **38.2.1 = Snapshot Econômico** (desdobramento da F38.2, v1.5) — congelar `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` em `generation_events` no momento da geração; impedir recálculo retroativo; nomenclatura `receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct`; fallback legacy explícito; backfill aproximado via audit; receita real por pacote de crédito fica para F43 (Stripe) — **CONCLUÍDA 7/7 plans** (I1-I7 53/53 asserts, 1887 testes, gates verdes, UAT manual aprovado), fonte `openspec/changes/fase-38-2-1-economic-snapshot/`
- [x] Phase 39: Brief Estruturado de Campanha (8/8 plans ✅)
  - Contrato de domínio `CampaignBrief` estruturado (produto × oferta × mídia × contexto criativo × metadados) + mapper flat→brief na fronteira da rota + snapshot `input_snapshot` versionado (`campaign_brief_v1`, sem base64) + 5 costuras de mappers preservando o comportamento de geração atual
  - Fonte da verdade: `openspec/changes/fase-39-brief-estruturado-campanha/`
  - **Dependências:** F38.2.1 (snapshot econômico), F31.x (prompts por intent), F24/F25 (pipeline) — antecede a F37 (Revisão e Aprovação da Arte)

- [x] Phase 40: Campos Comerciais e Avisos do Brief (9/9 plans ✅)
  - Checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) com constante única `ILLUSTRATIVE_NOTICE_TEXT` (singular), removendo o hardcode incondicional dos 4 prompts do diretor de imagem
  - Seção "Validade da oferta" (6 modos: sem validade / até uma data / de... até... / somente hoje / enquanto durarem os estoques / texto personalizado), `displayText` determinístico `dd/mm`, apenas para `campaignIntent === "offer"`
  - Formulário agrupado em Produto / Oferta / Avisos e texto obrigatório (checkbox + textarea coexistindo)
  - **Fonte da verdade:** `openspec/changes/fase-40-campos-comerciais-avisos-brief/`
  - **Dependências:** F39 (brief estruturado — validity/legalNotice no domínio), F31.x (prompts por intent) — antecede a F43 (Stripe)

- [x] Phase 41: Mídia de Campanha Mobile (13/13 plans ✅)
  - Form multi-imagem: 1 imagem **primary** obrigatória + até 3 auxiliares (galeria + câmera com `capture="environment"`), preview grid com remoção por item, `source: "upload" | "camera"`, decode HEIC via canvas sem dependência de lib, orientação EXIF respeitada (`createImageBitmap from-image`)
  - Transporte aditivo `productImages[]` (`MAX_CAMPAIGN_IMAGES = 4`, invariante exatamente-1-primary via `superRefine`) com `productImageDataUrl` legado preservado; regra de exclusividade 400 na rota (ambos ausentes / ambos presentes)
  - Mapper flat→domínio multi-imagem com `mimeType` real derivado do dataUrl; snapshot com `storagePath` por input persistido
  - Persistência dos inputs no bucket `campaign-images` (`{storeId}/{campaignId}/inputs/{imageId}.jpg`) com `campaignId` pré-gerado, `createCampaign` com parâmetro opcional, limpeza pré-stream sem órfãos
  - Provider Responses com N `input_image`; fallback `images.edit` gated (só primary única); prompt com bloco descritivo 1+N sem nova variável (golden `EXPECTED_KEYS = 38`); validação primary-only; revisor com primary como referência (retrocompatível)
  - **Fonte da verdade:** `openspec/changes/fase-41-midia-de-campanha-mobile/`
  - **Dependências:** F39 (domínio multi-imagem `media.images[]`), F40 (campos comerciais/avisos no form) — antecede a F43 (Stripe)
  - **Status:** 4 gates verdes (222 files / 2033 testes), UAT humano 6/6 cenários (Android validado em produção ✅; iOS HEIC pendente de confirmação final)

- [x] Phase 42: Signup Controlado e Elegibilidade Freemium (20/20 plans ✅)
  - Reabrir o cadastro público de forma controlada: **Google OAuth como entrada principal** (`signInWithOAuth`, callback PKCE `/auth/callback`, escopos `openid email profile`) + **email/senha como fallback** (formulário restaurado: email, senha mín. 8, confirmação, ciência da privacidade, consentimento opcional)
  - **Turnstile** para email/senha, login por senha e recuperação (NÃO no Google OAuth); confirmação de email obrigatória apenas para email/senha; anti-enumeração com mensagens genéricas
  - Kill switch duplo: "Allow new users to sign up" (server-side Supabase) + flag `VENDEO_PUBLIC_SIGNUP_ENABLED` (UI/landing, default false)
  - Invariantes de elegibilidade preservados (conta ≠ loja ≠ benefício; apenas `approved` concede 10 créditos de onboarding); cidade/UF como gate de elegibilidade; situação ≠ ATIVA → review `situacao_nao_ativa` (corrige lacuna F33 INAPTA); CNAE determinístico sem rejeição exclusiva; admin reviews mais rico
  - **Fonte da verdade:** `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/`
  - **Status:** 20/20 plans, 2182 testes, 4 gates verdes, UAT 20.5–20.15 PASS

- [x] Phase 43: Revisão do Brief Pré-Geração (complete — UAT 9/9 PASS)
  - Gate client-side obrigatório de revisão do brief em tela intermediária (`reviewMode`) entre o form e o POST; botão "Revisar e gerar"; "Voltar e editar" preserva tudo; "Confirmar e gerar campanha" trava o snapshot e dispara o submit real
  - Compressão das imagens antes da revisão (`prepareCampaignImages`); resumo completo Produto/Oferta/Imagens/Avisos/Custo + loja/marca + rótulos Principal/Referência + "Vai consumir X crédito(s)" + slot Tema reservado (preparação F44)
  - Helpers puros `prepareCampaignImages`/`buildCampaignGenerationBody`; body idêntico ao exibido; override `brief_review_confirmed` (pula a IA de visão; fase `input_validation` como `skipped`)
  - Flag administrativa mínima `force_brief_vision_check` na tabela `feature_flags` (tela admin, motivo obrigatório, auditoria, fallback de leitura `enabled=false` que não derruba geração)
  - **Fonte da verdade:** `openspec/changes/fase-43-revisao-brief-pre-geracao/`
  - **Dependências:** F39 (domínio `CampaignBrief`/snapshot), F40 (form `validity`/`mandatoryArtworkText`), F41 (multi-imagem/`compressImage`), F31.x (intents), F38/F38.1 (custos/telemetria), F24/F25 (pipeline) — antecede a F44 (Temas) e a F37 (Revisão e Aprovação da Arte)
  - **Status:** 15/15 plans, 2317 testes, 4 gates verdes, UAT 15.5–15.13 PASS (9/9)

- [ ] Phase 45: Briefing Contextual do Diretor de Arte (pending)
  - Reestruturação dos 4 `.md` do diretor de imagem (`campaign-image-director.md` + offer/spotlight/exclusive) em **camada editorial legível + blocos contextuais** nomeados por propósito (fatos, texto obrigatório, aviso ilustrativo, identidade, produto/referências, detalhes comerciais, restrições, direção criativa)
  - Novo helper puro `art-director-briefing.ts` (fora do service de 1269 linhas): montagem **contextual por presença real de dados** — campo ausente → bloco não enviado (sem seção vazia, sem linha de tabela em branco, sem placeholder não resolvido)
  - Separação semântica explícita: texto obrigatório do lojista em seção própria; aviso ilustrativo em seção própria (mínimo/legível/discreto/lateral); identidade como preservação; primary = referência factual forte, auxiliares sem competir
  - Eliminação de duplicações (validade, detalhes, disponibilidade, aviso) — cada natureza em **um único bloco canônico**; `buildCommercialRepertoire` repartido
  - **Sem mudança de superfície externa:** UI/form, contrato HTTP, schema público, snapshot/domínio, revisor e Copy Director inalterados (regra de paridade substituída por determinismo + UAT humano comparativo)
  - **Fonte da verdade:** `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/`
</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 7. Sessão e Login Vertical | v1.2 | 5/5 | ✅ Complete | 2026-07-04 |
| 8. Ciclo de Conta | v1.2 | 4/4 | ✅ Complete | 2026-07-06 |
| 9. Cutover de Ownership | v1.2 | 4/4 | ✅ Complete | 2026-07-06 |
| 10. Perímetro Multi-tenant | v1.2 | 6/6 | ✅ Complete | 2026-07-07 |
| 11. Verificação e Hardening | v1.2 | 1/1 | ✅ Complete | 2026-07-08 |
| 12. Fundação DB/Storage | v1.3 | 5/5 | ✅ Complete | 2026-07-09 |
| 13. Serviço de Persistência | v1.3 | 3/3 | ✅ Complete | 2026-07-09 |
| 14. Integração no Fluxo de Geração | v1.3 | 3/3 | ✅ Complete | 2026-07-10 |
| 15. Página de Campanha | v1.3 | 3/3 | ✅ Complete | 2026-07-10 |
| 16. Minhas Campanhas | v1.3 | 3/3 | ✅ Complete | 2026-07-10 |
| 17. Edição de Publication Copy | v1.3 | 2/2 | ✅ Complete | 2026-07-10 |
| 18. App Shell + UI Base + Rotas | v1.4 | 3/3 | ✅ Complete | 2026-07-13 |
| 19. Onboarding & Estados Vazios | v1.4 | 3/3 | ✅ Complete | 2026-07-13 |
| 20. Dashboard | v1.4 | 3/3 | ✅ Complete | 2026-07-13 |
| 21. Histórico e Busca | v1.4 | 3/3 | ✅ Complete | 2026-07-14 |
| 22. Mobile Hardening | v1.4 | 3/3 | ✅ Complete | 2026-07-15 |
| 23. Text Provider + Copy Director | v1.5 | 2/2 | ✅ Complete | 2026-07-16 |
| 24. Créditos — Schema, Saldo e Transações | v1.5 | 2/2 | ✅ Complete | 2026-07-16 |
| 25. Pipeline de Geração v1.5 | v1.5 | 3/3 | ✅ Complete | 2026-07-17 |
| 26. Admin Operacional + Convites + Créditos Manuais | v1.5 | 3/3 | ✅ Complete | 2026-07-18 |
| 27. Conta e Saldo Visível + Extrato | v1.5 | 3/3 | ✅ Complete | 2026-07-18 |
| 28. Observabilidade + Operação + Launch Controls | v1.5 | 4/4 | ✅ Complete | 2026-07-19 |
| 29. Refinamento Visual + UAT + Launch Readiness | v1.5 | 4/4 | ✅ | 2026-07-20 |
| 29.1.1. Créditos na Assinatura Visual | v1.5 | 3/3 | ✅ Complete | 2026-07-21 |
| 29.1.2. Histórico Curto + Assinatura Visual | v1.5 | 3/3 | ✅ Complete | 2026-07-22 |
| 29.3. Créditos Mensais Automáticos | v1.5 | 4/4 | ✅ Complete | 2026-07-22 |
| 30. Fundação Legal | v1.5 | 6/6 | ✅ Complete | 2026-07-23 |
| 31.1. Modelo Comercial — Formulário | v1.5 | 5/5 | ✅ Complete | 2026-07-24 |
| 31.2. Diretores por Intenção | v1.5 | 6/6 | ✅ Complete | 2026-07-25 |
| 31.3. Quality Gate por Intenção Comercial | v1.5 | 6/6 | ✅ Complete | 2026-07-26 |
| 32. Freemium Anti-Abuso CNPJ | v1.5 | 5/5 | ✅ Complete | 2026-07-27 |
| 33. Verificação CNPJ Freemium | v1.5 | 0/5 | ◆ Planning | — |
| 34. Store Readiness | v1.5 | 0/0 | ○ Pending | — |
| 35. Changelog / Novidades | v1.5 | 5/5 | ✅ Complete | 2026-07-31 |
| 36. Onboarding — Navegação por Abas | v1.5 | 6/6 | ✅ Complete | 2026-08-05 |
| 37. Revisão e Aprovação da Arte | v1.5 | 0/0 | ○ Pending | — |
| 38. Tabela de Custos por Operação | v1.5 | 8/8 | ✅ Complete | 2026-08-07 |
| 38.1. Apuração de Custos de IA por Entrega | v1.5 | 11/11 | ✅ Complete | 2026-08-09 |
| 38.2. Admin de Custos Operacionais + Configurações Econômicas | v1.5 | 15/15 | ✅ Complete | 2026-08-11 |
| 38.2.1. Snapshot Econômico | v1.5 | 7/7 | ✅ Complete | 2026-08-12 |
| 39. Brief Estruturado de Campanha | v1.5 | 8/8 | ✅ Complete | 2026-08-13 |
| 40. Campos Comerciais e Avisos do Brief | v1.5 | 9/9 | ✅ Complete | 2026-08-14 |
| 41. Mídia de Campanha Mobile | v1.5 | 13/13 | ✅ Complete | 2026-08-15 |
| 42. Signup Controlado e Elegibilidade Freemium | v1.5 | 20/20 | ✅ Complete | 2026-08-21 |
| 43. Revisão do Brief Pré-Geração | v1.5 | 15/15 | ✅ Complete | 2026-08-21 |
| 45. Briefing Contextual do Diretor de Arte | v1.5 | 0/7 | ◆ Planned | — |
| —. Monetização pública / Stripe (diferida, v1.7+) | v1.7 | — | Fora da numeração | — |

---

_For milestone details, see `.planning/milestones/v1.4-ROADMAP.md` and `.planning/MILESTONES.md`_
