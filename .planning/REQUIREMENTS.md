# Requirements: Vendeo V3

**Defined:** 2026-07-15
**Core Value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

## v1 Requirements — Lançamento Externo Controlado

### Copy Director (COPY)

- [x] **COPY-01**: TextProvider abstraction layer (createTextProvider, OpenAI implementation)
- [x] **COPY-02**: CopyDirectorService generates title, caption, hashtags, CTA from CopyDirectorInput
- [x] **COPY-03**: Prompt template in `prompts/campaign-copy-director.md` with segment-aware copywriting
- [x] **COPY-04**: Copy Director callable standalone (without image generation)

### Sistema de Créditos (CRED)

- [x] **CRED-01**: credit_balances table with RLS (user can SELECT own balance)
- [x] **CRED-02**: credit_transactions table (append-only, types: grant/purchase/deduction/refund/adjustment)
- [x] **CRED-03**: CreditService with reserveCredit, confirmCredit, refundCredit, grantCredits, getBalance, getHistory
- [x] **CRED-04**: Balance never negative — every deduction checks balance before executing
- [x] **CRED-05**: Atomic reserve/refund via SQL transactions (SELECT FOR UPDATE or SQL function)

### Pipeline de Geração (PIPE)

- [x] **PIPE-01**: Parallel execution of Copy Director || Image Director in generate-image pipeline
- [x] **PIPE-02**: Rate limit guard (10/h per user, 30/dia) before any paid operation
- [x] **PIPE-03**: Saldo check before pipeline starts; 402 Payment Required if insufficient
- [x] **PIPE-04**: Credit reserve before IA calls; refund on failure; confirm on success
- [x] **PIPE-05**: publication_copy_snapshot populated by Copy Director (replaces deterministic buildCaption/hashtags)
- [x] **PIPE-06**: Timeout abort (120s total) treated as failure with refund

### Admin Operacional (ADMIN)

- [x] **ADMIN-01**: Admin access control — only explicitly authorized users (admin_users table) access admin routes/pages
- [x] **ADMIN-02**: Admin user/store directory — list and search beta users/stores with support data
- [x] **ADMIN-03**: Admin credit grant — manual credit grant with mandatory reason, via RPC admin_grant_credits (encapsula grant_credits + audit log)
- [x] **ADMIN-04**: Admin credit ledger view — view balance and full transaction history of any store/user
- [x] **ADMIN-05**: Admin campaign error review — view errored campaigns with error_message, status, dates
- [x] **ADMIN-06**: Admin audit log — every sensitive admin action recorded with actor, target, action, reason, timestamp

### Conta e Saldo Visível (UI-CREDIT)

- [x] **UI-01**: Credit balance visible in dashboard metrics grid (contextual, not global — D1)
- [x] **UI-02**: Credits section in `/conta` — balance card, transaction history
- [x] **UI-03**: Zero-credit CTA during beta — "Solicitar créditos" / "Fale com o time" (não Stripe)
- [x] **UI-04**: Extrato paginado (credit_transactions history with all types except adjustment)
- [x] **UI-05**: Onboarding grant: 5 free credits on store creation (POST /api/store integration)
- [x] **UI-06**: Zero-credit states: tooltip, disabled button, CTA to request credits — product never blocks entirely

### Créditos Mensais Automáticos (MONTHLY)

- [ ] **MONTHLY-01**: Modelo contábil com buckets — `bonus_balance` + `purchased_balance` em `credit_balances`, `balance` como soma automática via trigger
- [ ] **MONTHLY-02**: Categorias de transação expandidas — `bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase` substituem `grant` genérico
- [ ] **MONTHLY-03**: `grant_credits()` bucket-aware com parâmetro `p_type` — direciona ao bucket correto conforme o tipo
- [ ] **MONTHLY-04**: `reserve_credit()` com consumo prioritário — deduz de `bonus_balance` primeiro, `purchased_balance` por último
- [ ] **MONTHLY-05**: `refund_credit()` bucket-aware — restaura `bonus_balance` e `purchased_balance` exatos via metadata; fallback legacy para deductions sem metadata
- [ ] **MONTHLY-06**: `grant_monthly_credits()` RPC — elegibilidade por idade da loja (>= 30 dias), teto de bônus configurável, grant parcial, idempotência por ciclo efetivo de 30 dias, FOR UPDATE SKIP LOCKED
- [ ] **MONTHLY-07**: Launch Config expandido — 4 novas flags: `monthlyCreditsEnabled`, `monthlyCreditsAmount`, `monthlyBonusCap`, `monthlyCreditsMinStoreAgeDays`
- [ ] **MONTHLY-08**: Vercel Cron `GET /api/cron/monthly-credits` — schedule `0 6 * * *`, proteção CRON_SECRET, leitura de Launch Config, execução RPC, logging via `logPipelineEvent()`
- [ ] **MONTHLY-09**: Admin fallback — botão "Executar concessão mensal" + rota `POST /api/admin/monthly-credits/grant` protegida por `requireAdmin`
- [ ] **MONTHLY-10**: Backfill de transações existentes — `grant + onboarding` → `bonus_onboarding`; `grant + outros` → `admin_grant`; `bonus_balance` populado com saldo atual

### Observabilidade e Operação (OPS)

- [x] **OPS-01**: Structured logging in pipeline (traceId, campaignId, phase, duration_ms, status)
- [x] **OPS-02**: IA telemetry (tokens, cost, model, provider) in generation_events
- [x] **OPS-03**: Deploy checklist, rollback process, environment variables documented
- [x] **OPS-04**: Support runbook (manual grant via admin, refund, balance check)
- [x] **OPS-05**: Launch config centralizado — 9 flags (5 originais + 4 mensais) lidas via helper único, zero process.env espalhado
- [x] **OPS-06**: Admin metrics dashboard — /admin/metrics com cards (sucesso, erro, custo, tempo, créditos, estorno, users) + health state banner
- [x] **OPS-07**: AI cost estimator — estimateAiCost() com tabela de preços OpenAI + Gemini
- [x] **OPS-08**: Data retention cleanup (90d) — função SQL versionada + runbook manual; auto-job planejado para D+30
- [x] **OPS-09**: Concurrency test — 2 requests simultâneos, saldo=1, apenas um vence

### Refinamento Visual e Launch Readiness (LAUNCH)

- [/] **LAUNCH-01**: Loading, empty, error states for all new screens/components
  - Refinado por F29.1.2: HistoryModal reescrito com loading/error/empty states + paginação
- [/] **LAUNCH-02**: Insufficient-credit UX across the app (disabled states, tooltips, microcopy)
  - Refinado por F29.1.2: Ações condicionais ao identity_state com tooltips contextuais
- [/] **LAUNCH-03**: Mobile hardening for credit flows (viewport 320–768px, touch targets >=44px)
- [/] **LAUNCH-04**: UAT externo com 3–5 lojistas reais (convite manual, grant admin, geração, saldo, extrato)
- [/] **LAUNCH-05**: Canal de feedback, métricas de saúde, critérios de expansão/pausa documentados
- [/] **LAUNCH-06**: Feature flag active and verified in UAT before milestone close

### Segurança (SEC)

- [ ] **SEC-01**: RLS policies for credit_balances and credit_transactions
- [ ] **SEC-02**: Ownership validation on all /api/credits/* and /api/admin/* routes
- [ ] **SEC-03**: Sanitized inputs to Copy Director (no sensitive data in prompts)
- [ ] **SEC-04**: Admin routes protected by requireAdmin gate — admin_users table, no auth.users flag
- [ ] **SEC-05**: Service role usage reviewed — credit operations use service role only after identity validation
- [ ] **SEC-06**: Admin audit log is append-only; grant without audit trail is treated as failure

## v1.5 Requirements — Fundação Legal (F30)

### Documentos Legais (LEGAL-DOC)

- [ ] **LEGAL-DOC-01**: 3 documentos legais draft em `docs/legal/` — Termos de Uso v1.0, Política de Privacidade v1.0 (LGPD), Uso Aceitável v1.0, com ressalva de revisão jurídica
- [ ] **LEGAL-DOC-02**: Páginas públicas `/termos`, `/privacidade`, `/uso-aceitavel` sem auth, renderizadas do conteúdo versionado
- [ ] **LEGAL-DOC-03**: `legal_document_versions` table com document_type, version, published_at, effective_at, summary; UNIQUE(document_type, version)
- [ ] **LEGAL-DOC-04**: `getCurrentVersion()`, `getVersionHistory()`, `isVersionCurrent()` — consultam legal_document_versions via supabaseAdmin

### Ciência de Privacidade (LEGAL-PRIVACY)

- [ ] **LEGAL-PRIVACY-01**: `privacy_acknowledgements` table (PK user_id, upsert) com RLS
- [ ] **LEGAL-PRIVACY-02**: `registerPrivacyAcknowledgement()` — upsert por user_id, server-side apenas via service role
- [ ] **LEGAL-PRIVACY-03**: `hasValidPrivacyAcknowledgement(userId)` — compara versão vigente
- [ ] **LEGAL-PRIVACY-04**: Checkbox obrigatório "Declaro ciência da Política de Privacidade" no signup
- [ ] **LEGAL-PRIVACY-05**: POST /api/legal/acknowledge-privacy — resolve versão server-side, registra ciência + opcionalmente consentimento

### Aceite Contratual (LEGAL-ACCEPT)

- [ ] **LEGAL-ACCEPT-01**: `legal_acceptances` table com UNIQUE(store_id, accepted_by_user_id, document_type, document_version)
- [ ] **LEGAL-ACCEPT-02**: `registerAcceptance()` — resolve versão automaticamente, idempotente na mesma versão
- [ ] **LEGAL-ACCEPT-03**: `registerAllContractAcceptances()` — registra terms_of_service + acceptable_use
- [ ] **LEGAL-ACCEPT-04**: `getAcceptanceStatus(storeId, documentType)` — current/outdated/never
- [ ] **LEGAL-ACCEPT-05**: `getStoreAcceptanceHistory(storeId)` — histórico ordenado

### Consentimento LGPD (LEGAL-CONSENT)

- [ ] **LEGAL-CONSENT-01**: `user_consent_events` table append-only (granted/revoked), auditável
- [ ] **LEGAL-CONSENT-02**: `recordConsentEvent()` — sempre INSERT, nunca UPDATE/DELETE
- [ ] **LEGAL-CONSENT-03**: `getEffectiveConsent(userId, consentType)` — último evento por occurred_at DESC
- [ ] **LEGAL-CONSENT-04**: Checkbox opcional "Aceito receber comunicações comerciais" no signup (LGPD art. 7º, I)
- [ ] **LEGAL-CONSENT-05**: Toggle de consentimento em `/conta` — revoga/reativa via POST /api/legal/communications-consent

### Guardião Legal (LEGAL-CLEARANCE)

- [ ] **LEGAL-CLEARANCE-01**: `requireLegalClearance({ storeId, userId, capability })` — guard central
- [ ] **LEGAL-CLEARANCE-02**: CAPABILITY_DOCUMENTS map — content_generation → [terms_of_service, acceptable_use]
- [ ] **LEGAL-CLEARANCE-03**: CAPABILITY_TREE — content_generation sub-capabilities (campaigns.create, visual_signatures.create, exports.create)
- [ ] **LEGAL-CLEARANCE-04**: Privacy policy NÃO incluída no guard — verificada no signup
- [ ] **LEGAL-CLEARANCE-05**: Guard no generate-image (pré-stream, antes de rate-limit e saldo)
- [ ] **LEGAL-CLEARANCE-06**: Guard no visual-signature-approval-modal
- [ ] **LEGAL-CLEARANCE-07**: 403 padronizado quando clearance falha: message, reason, requiredDocuments, acceptUrl

### Re-aceite (LEGAL-REACCEPT)

- [ ] **LEGAL-REACCEPT-01**: Tela `/legal/reaccept` com sumário de mudanças e botão "Aceitar nova versão"
- [ ] **LEGAL-REACCEPT-02**: Bloqueio operacional (não absoluto) — docs legais, suporte, conta e cancelamento livres
- [ ] **LEGAL-REACCEPT-03**: Banner não-bloqueante para mudança de privacidade
- [ ] **LEGAL-REACCEPT-04**: Histórico de aceites preservado no re-aceite

### RPC Atômica (LEGAL-RPC)

- [ ] **LEGAL-RPC-01**: `create_store_with_legal_acceptance()` — loja + 2 aceites + grant em transação única
- [ ] **LEGAL-RPC-02**: POST /api/store substituído para usar nova RPC com parâmetros de versão, IP e UA
- [ ] **LEGAL-RPC-03**: Checkbox obrigatório "Li e aceito os Termos de Uso e a Política de Uso Aceitável" no onboarding

### Admin Legal (LEGAL-ADMIN)

- [ ] **LEGAL-ADMIN-01**: AdminUserSummary estendido com privacyAcknowledged, legalAcceptanceStatus, communicationsConsent
- [ ] **LEGAL-ADMIN-02**: Badges legais em `/admin/users/[id]` — privacidade, aceite, consentimento
- [ ] **LEGAL-ADMIN-03**: Detalhamento por documento (versão, data, usuário, IP, UA)
- [ ] **LEGAL-ADMIN-04**: Admin NÃO pode aceitar em nome do lojista (sem bulk_migration)

### Middleware (LEGAL-MIDDLEWARE)

- [ ] **LEGAL-MIDDLEWARE-01**: `/termos`, `/privacidade`, `/uso-aceitavel` como rotas livres de auth
- [ ] **LEGAL-MIDDLEWARE-02**: `/legal/reaccept` requer auth mas passa pelo middleware

## v1.5 Requirements — Modelo Comercial — Formulário (F31.1)

### Intenção Comercial (INTENT)

- [ ] **INTENT-01**: CampaignIntent type — `"offer" | "spotlight" | "exclusive"` em `src/lib/campaign/types.ts`
- [ ] **INTENT-02**: InputSnapshot com campos opcionais `campaignIntent?: CampaignIntent` e `preserveImageContext?: boolean`
- [ ] **INTENT-03**: CampaignGenerationInputSchema com `campaignIntent: z.enum([...]).optional().default("offer")`
- [ ] **INTENT-04**: GenerateImageRequestSchema com `campaignIntent` (optional, default "offer") e `preserveImageContext` (optional boolean)
- [ ] **INTENT-05**: BADGE_OPTIONS_BY_INTENT: Record<CampaignIntent, readonly string[]> em `src/lib/constants.ts`
- [ ] **INTENT-06**: inferIntent(originalPriceCents, discountedPriceCents): CampaignIntent — DE+POR → offer, só preço → spotlight, nenhum → exclusive
- [ ] **INTENT-07**: Seletor de intent (radio group) no formulário entre badge e botão "Criar", com opções filtradas por intent inferida
- [ ] **INTENT-08**: Spotlight/Exclusive exibem "Em breve" e bloqueiam submit com tooltip "Disponível em breve"
- [ ] **INTENT-09**: Badge validation condicional por intent — obrigatório apenas para offer; opcional para spotlight/exclusive
- [ ] **INTENT-10**: preserveImageContext checkbox — invisível em offer, visível e opcional em spotlight/exclusive
- [ ] **INTENT-11**: discountedPriceCents opcional (number | undefined) no CampaignFormFields, mantido required nos schemas do pipeline
- [ ] **INTENT-12**: Pipeline guard — rejeitar intents não-offer no pré-stream com HTTP 400 antes de criar campanha ou consumir crédito

### Testes (INTENT-TEST)

- [ ] **INTENT-TEST-01**: inferIntent com DE+POR → "offer"
- [ ] **INTENT-TEST-02**: inferIntent com só preço → "spotlight"
- [ ] **INTENT-TEST-03**: inferIntent sem preço (undefined/null) → "exclusive"
- [ ] **INTENT-TEST-04**: inferIntent com ambos preços zerados → "exclusive"
- [ ] **INTENT-TEST-05**: DE+POR com intent spotlight → bloqueado no submit
- [ ] **INTENT-TEST-06**: Preço original sem preço com desconto → erro (quando intent=offer)
- [ ] **INTENT-TEST-07**: intent=offer sem badge → erro de validação
- [ ] **INTENT-TEST-08**: intent=spotlight sem badge → sem erro de validação
- [ ] **INTENT-TEST-09**: Trocar intent de offer para spotlight limpa badge inválido
- [ ] **INTENT-TEST-10**: Trocar intent de spotlight para exclusive (badge incompatível) limpa badge
- [ ] **INTENT-TEST-11**: preserveImageContext invisível em offer
- [ ] **INTENT-TEST-12**: preserveImageContext visível em spotlight
- [ ] **INTENT-TEST-13**: preserveImageContext reset ao voltar para offer
- [ ] **INTENT-TEST-14**: GenerateImageRequestSchema aceita campaignIntent e preserveImageContext opcionais
- [ ] **INTENT-TEST-15**: GenerateImageRequestSchema mantém discountedPriceCents required
- [ ] **INTENT-TEST-16**: CampaignGenerationInputSchema default campaignIntent = "offer"
- [ ] **INTENT-TEST-17**: Request com campaignIntent "spotlight" → HTTP 400
- [ ] **INTENT-TEST-18**: Request com campaignIntent "exclusive" → HTTP 400
- [ ] **INTENT-TEST-19**: Request sem campaignIntent → pipeline prossegue (default offer)

## v1.5 Requirements — Store Readiness (F34)

### Store Readiness (READINESS)

- [ ] **READINESS-01**: RPC `check_store_readiness(p_store_id UUID) RETURNS JSONB` — verifica cadastro fiscal mínimo (cnpj_normalized, razao_social, nome_fantasia não nulos) + brand profile synced (EXISTS store_brand_profiles WHERE status = 'synced')
- [ ] **READINESS-02**: `getStoreReadiness(storeId)` em `src/lib/store-readiness.ts` — chama RPC, retorna `StoreReadinessResult { ready, missing }`, fallback seguro em erro
- [ ] **READINESS-03**: Prioridade de resolução: cadastro_fiscal → brand_profile
- [ ] **READINESS-04**: Fallback `nome_fantasia = razao_social` se CNPJ sem nome_fantasia oficial

### Store Billing Info (BILLING)

- [ ] **BILLING-01**: Tabela `store_billing_info` com RLS, índice único, triggers updated_at
- [ ] **BILLING-02**: `StoreBillingInfo` type + `StoreWithBillingInfo` em `src/lib/billing/store-billing-info.ts`
- [ ] **BILLING-03**: `getStoreBillingInfo(storeId, userId)` com ownership check obrigatório
- [ ] **BILLING-04**: `upsertStoreBillingInfo(storeId, userId, data)` com ownership check + reset de billing_data_confirmed_at se editado após confirmação
- [ ] **BILLING-05**: `getPreFillFromCnpj(cnpjData)` — mapeia dados oficiais do CNPJ para endereço fiscal
- [ ] **BILLING-06**: Billing info não bloqueia geração de campanhas

### Store Type / CNPJ Fields (STORE-TYPE)

- [ ] **STORE-TYPE-01**: Store interface com todos os campos CNPJ tipados (cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia, verification_status, is_test_store, etc.)
- [ ] **STORE-TYPE-02**: Todos os casts `(store as unknown as Record<string, unknown>)` substituídos por acesso tipado

### Guarda Dupla (GUARD)

- [ ] **GUARD-01**: Guarda de readiness no server component `/campanhas/nova` — redirect conforme primeira pendência
- [ ] **GUARD-02**: Guarda de readiness na API `generate-image/route.ts` — 412 Precondition Required com reasons

### Fluxo Legacy (LEGACY)

- [ ] **LEGACY-01**: Lojas legacy sem cadastro fiscal bloqueadas na geração com redirect
- [ ] **LEGACY-02**: Redirect encadeado: cadastro fiscal → verificar brand profile → direção visual se necessário
- [ ] **LEGACY-03**: Microcopy contextual em cada etapa de redirect

### Store Identity UI (UI)

- [ ] **UI-01**: Step 2 renomeado para "Direção Visual" com badge "Necessário"
- [ ] **UI-02**: Mensagem pós-Step 1 alterada para "Loja salva. Agora configure a direção visual."
- [ ] **UI-03**: Query param `?required=visual-direction` abre formulário no Step 2
- [ ] **UI-04**: Card colapsável "Dados para faturamento (opcional)" com pré-preenchimento e botão de confirmação próprio

### Dashboard (DASHBOARD)

- [ ] **DASHBOARD-01**: Banner de prontidão com checklist das pendências quando `ready: false`
- [ ] **DASHBOARD-02**: Cada item pendente é link direto para configuração
- [ ] **DASHBOARD-03**: Botão "Configurar agora" aponta para primeira pendência
- [ ] **DASHBOARD-04**: Botão "Configurar direção visual" para lojas sem brand profile

### Brand Profile (BRANDPROFILE)

- [ ] **BRANDPROFILE-01**: Três caminhos de direção visual (logo upload, VS, text-only) convergem para brand profile synced
- [ ] **BRANDPROFILE-02**: "Confirmar direção visual" só libera com profile synced

## v1.5 Requirements — Changelog/Novidades (F35)

Adicionados em 2026-07-31 via alinhamento com OpenSpec (`openspec/changes/fase-35-changelog-novidades/`).

### Conteúdo do Changelog (F35-CONTENT)

- [x] **F35-CONTENT-01**: Fonte de dados `content/changelog/*.md` com frontmatter YAML (id, title, date ISO `YYYY-MM-DD`, milestone opcional, category, importance, announcement) versionada no repositório; 3 entries seed (F30, F32, F34), apenas F32 com `announcement: "card"`
- [ ] **F35-CONTENT-02**: `parseFrontmatter(raw)` em `src/lib/changelog/parse-frontmatter.ts` — valida `---` de abertura/fechamento, split no primeiro `:`, remove aspas opcionais de valores escalares, retorna `{ frontmatter, body }`
- [ ] **F35-CONTENT-03**: `renderMarkdown(md)` em `src/lib/changelog/render-markdown.ts` — suporta `## heading`, parágrafos, `- listas`, `**negrito**`; HTML sanitizado (h2, p, ul, li, strong); escapa texto bruto; lança erro em sintaxe não suportada (build)
- [ ] **F35-CONTENT-04**: `ChangelogFrontmatterSchema` (Zod) em `src/lib/changelog/schema.ts` — id/title string min 1, date regex `^\d{4}-\d{2}-\d{2}$`, milestone opcional, enums category/importance/announcement; fail-fast no build
- [ ] **F35-CONTENT-05**: Tipos em `src/lib/changelog/types.ts` — ChangelogCategory, ChangelogImportance, ChangelogFrontmatter, ChangelogEntry (slug derivado do filename)
- [x] **F35-CONTENT-06**: `get-changelog.ts` com `import "server-only"` — `getAllEntries()` (data DESC, diretório vazio → `[]`), `getLatestAnnouncement()` (entry mais recente com `announcement !== "none"` ou null), `getEntryById(id)`; frontmatter inválido → throw no build

### Estado de Leitura (F35-STATE)

- [x] **F35-STATE-01**: Hook `useChangelogState()` em `src/hooks/use-changelog-state.ts` — duas chaves `vendeo:last_seen_changelog_id` e `vendeo:dismissed_changelog_announcement_id`; SSR-safe (localStorage apenas em useEffect; estado inicial null)
- [ ] **F35-STATE-02**: `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` — atualiza SEEN_KEY e, se announcementId, DISMISSED_KEY
- [ ] **F35-STATE-03**: `dismissAnnouncement(id)` — atualiza APENAS DISMISSED_KEY (não afeta indicador da sidebar)
- [ ] **F35-STATE-04**: `hasUnseen(latestId)` — `lastSeenId !== latestId`; false se latestId vazio; comparação de ID exato
- [ ] **F35-STATE-05**: `isAnnouncementVisible(entryId)` — `dismissedId !== entryId`; false se entryId vazio
- [x] **F35-STATE-06**: Sem Supabase, sem requisição extra, sem estado global (D3/D7)

### UI do Changelog (F35-UI)

- [x] **F35-UI-01**: Página `/novidades` (server component) — `getAllEntries()`, PageHeader, breadcrumb "Dashboard > Novidades", ChangelogList, EmptyState sem entries
- [ ] **F35-UI-02**: Componente client chama `markChangelogAsViewed` ao montar (limpa indicador + dispensa anúncio ativo)
- [ ] **F35-UI-03**: `ChangelogCard` — badge categoria (feature=accent-green, improvement=accent-blue, fix=accent-amber), título, data pt-BR sem shift de fuso, importância, conteúdo via renderMarkdown
- [ ] **F35-UI-04**: `ChangelogList` — múltiplos cards ordenados com separação visual; estado vazio tratado
- [ ] **F35-UI-05**: `ChangelogAnnouncement` (client) — card (padrão) ou modal (exceção) conforme `announcement`; "Ver novidades" → `/novidades`; × → `dismissAnnouncement`; null quando entry null ou announcement none
- [ ] **F35-UI-06**: `SidebarBadge` (client) — usa `useChangelogState`, recebe `latestEntryId` por prop, badge quando `hasUnseen`; nada quando null
- [x] **F35-UI-07**: Estilo conforme design system (dark mode, tokens bg-*, text-*, accent-*, Poppins/Open Sans)

### App Shell (F35-APP-SHELL)

- [x] **F35-APP-SHELL-01**: Fluxo `latestEntryId` do server (layout) → AppShell → Sidebar/SidebarDrawer por prop; NUNCA importar `get-changelog`/`server-only` em componentes client
- [ ] **F35-APP-SHELL-02**: Sidebar com 5º item "Novidades" (`/novidades`, ícone Sparkles/Newspaper) + active state + SidebarBadge
- [x] **F35-APP-SHELL-03**: AccountMenu com link "Novidades" (`/novidades`, ícone Lucide) entre Configurações e Sair

### Dashboard (F35-DASHBOARD)

- [x] **F35-DASHBOARD-01**: Dashboard renderiza `<ChangelogAnnouncement entry={latestAnnouncement} />` via `getLatestAnnouncement()` após VerificationBanners e ReadinessCheckBanner, antes do conteúdo principal (nos estados com loja)
- [ ] **F35-DASHBOARD-02**: Dashboard não quebra quando `latestAnnouncement === null`
- [x] **F35-DASHBOARD-03**: Rotina documentada `docs/changelog-update.md` ajustada cirurgicamente se necessário (sem recriar)

## v1.7 Requirements (Stripe / Monetização Pública)

Deferred from v1.5 critical path. Stripe será implementada como F36/v1.7 após validação do beta controlado (renumerada de F35 → F36 no alinhamento do Changelog/Novidades).

### Pagamento (PAY)

- **PAY-01**: POST /api/credits/create-checkout — Stripe Checkout Session creation
- **PAY-02**: POST /api/webhooks/stripe — process checkout.session.completed with HMAC verification
- **PAY-03**: 3 credit packs (10/25/50) with fixed pricing
- **PAY-04**: CreditService.grant on successful purchase (idempotent)
- **PAY-05**: Asaas/Pix como provedor de pagamento secundário para mercado brasileiro
- **PAY-06**: Planos e assinaturas mensais (créditos recorrentes)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Geração

- **PIPE-07**: Cache de prompts / otimização de tokens para redução de custo
- **PIPE-08**: Geração de campanhas multi-formato (Stories, Landscape)

### Expansão

- **SOCIAL-01**: Integração com Instagram API para postagem automática
- **PWA-01**: Install prompt e experiência offline

## Out of Scope

| Feature | Reason |
|---------|--------|
| Planos e assinaturas mensais | Uso livre + créditos avulsos é suficiente para lançamento controlado |
| Múltiplas lojas (1:N) | Relação 1:1 user->store mantida |
| Times / permissões multi-usuário | Single-user |
| Integração com Instagram (API de postagem automática) | Milestone futura |
| Analytics avançado (CTR, impressões, conversão) | Fora do core de geração |
| Editor visual livre (Canva-like) | Geração guiada, não livre |
| PWA / install prompt | Não prioritário para lançamento controlado |
| OAuth social / Magic link | Exclusão deliberada desde v1.2 |
| Campanhas multi-formato (Stories, Landscape) | Apenas 1080x1080 feed |
| Cache de prompts / otimização de tokens | Feature futura de redução de custo |
| Dashboard administrativo avançado | Dashboard operacional mínimo (taxa de sucesso, custo médio, erro rate) está dentro do escopo |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COPY-01 | Phase 23 | ✅ Complete |
| COPY-02 | Phase 23 | ✅ Complete |
| COPY-03 | Phase 23 | ✅ Complete |
| COPY-04 | Phase 23 | ✅ Complete |
| CRED-01 | Phase 24 | ✅ Complete |
| CRED-02 | Phase 24 | ✅ Complete |
| CRED-03 | Phase 24 | ✅ Complete |
| CRED-04 | Phase 24 | ✅ Complete |
| CRED-05 | Phase 24 | ✅ Complete |
| PIPE-01 | Phase 25 | ✅ Complete |
| PIPE-02 | Phase 25 | ✅ Complete |
| PIPE-03 | Phase 25 | ✅ Complete |
| PIPE-04 | Phase 25 | ✅ Complete |
| PIPE-05 | Phase 25 | ✅ Complete |
| PIPE-06 | Phase 25 | ✅ Complete |
| ADMIN-01 | Phase 26 | ✅ Complete |
| ADMIN-02 | Phase 26 | ✅ Complete |
| ADMIN-03 | Phase 26 | ✅ Complete |
| ADMIN-04 | Phase 26 | ✅ Complete |
| ADMIN-05 | Phase 26 | ✅ Complete |
| ADMIN-06 | Phase 26 | ✅ Complete |
| UI-01 | Phase 27 | ✅ Complete |
| UI-02 | Phase 27 | ✅ Complete |
| UI-03 | Phase 27 | ✅ Complete |
| UI-04 | Phase 27 | ✅ Complete |
| UI-05 | Phase 27 | ✅ Complete |
| UI-06 | Phase 27 | ✅ Complete |
| OPS-01 | Phase 28 | ✅ Complete |
| OPS-02 | Phase 28 | ✅ Complete |
| OPS-03 | Phase 28 | ✅ Complete |
| OPS-04 | Phase 28 | ✅ Complete |
| OPS-05 | Phase 28 | ✅ Complete |
| OPS-06 | Phase 28 | ✅ Complete |
| OPS-07 | Phase 28 | ✅ Complete |
| OPS-08 | Phase 28 | ✅ Complete |
| OPS-09 | Phase 28 | ✅ Complete |
| SEC-04 | Phase 26 | ✅ Complete |
| SEC-06 | Phase 26 | ✅ Complete |
| LAUNCH-01 | Phase 29 | ✅ Complete |
| LAUNCH-02 | Phase 29 | ✅ Complete |
| LAUNCH-03 | Phase 29 | ✅ Complete |
| LAUNCH-04 | Phase 29 | ✅ Complete |
| LAUNCH-05 | Phase 29 | ✅ Complete |
| LAUNCH-06 | Phase 29 | ✅ Complete |
| LEGAL-DOC-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-DOC-02 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-DOC-03 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-DOC-04 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-PRIVACY-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-PRIVACY-02 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-PRIVACY-03 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-PRIVACY-04 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-PRIVACY-05 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ACCEPT-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ACCEPT-02 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ACCEPT-03 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ACCEPT-04 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ACCEPT-05 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CONSENT-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CONSENT-02 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CONSENT-03 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CONSENT-04 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CONSENT-05 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CLEARANCE-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CLEARANCE-02 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CLEARANCE-03 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CLEARANCE-04 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CLEARANCE-05 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CLEARANCE-06 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-CLEARANCE-07 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-REACCEPT-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-REACCEPT-02 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-REACCEPT-03 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-REACCEPT-04 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-RPC-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-RPC-02 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-RPC-03 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ADMIN-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ADMIN-02 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ADMIN-03 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-ADMIN-04 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-MIDDLEWARE-01 | Phase 30 | ✅ Complete (Done ✓) |
| LEGAL-MIDDLEWARE-02 | Phase 30 | ✅ Complete (Done ✓) |
| SEC-01 | Phase 24-26 | ✅ Complete (F24 RLS, F26 admin) |
| SEC-02 | Phase 25-26 | ✅ Complete (F25 pipeline, F26 admin) |
| SEC-03 | Phase 25 | ✅ Complete (F25 sanitized inputs) |
| SEC-05 | Phase 25 | ✅ Complete (F25 service role) |
| MONTHLY-01 | Phase 29.3 | ✅ Complete |
| MONTHLY-02 | Phase 29.3 | ✅ Complete |
| MONTHLY-03 | Phase 29.3 | ✅ Complete |
| MONTHLY-04 | Phase 29.3 | ✅ Complete |
| MONTHLY-05 | Phase 29.3 | ✅ Complete |
| MONTHLY-06 | Phase 29.3 | ✅ Complete |
| MONTHLY-07 | Phase 29.3 | ✅ Complete |
| MONTHLY-08 | Phase 29.3 | ✅ Complete |
| MONTHLY-09 | Phase 29.3 | ✅ Complete |
| MONTHLY-10 | Phase 29.3 | ✅ Complete |
| INTENT-01 | Phase 31.1 | ◆ Planned |
| INTENT-02 | Phase 31.1 | ◆ Planned |
| INTENT-03 | Phase 31.1 | ◆ Planned |
| INTENT-04 | Phase 31.1 | ◆ Planned |
| INTENT-05 | Phase 31.1 | ◆ Planned |
| INTENT-06 | Phase 31.1 | ◆ Planned |
| INTENT-07 | Phase 31.1 | ◆ Planned |
| INTENT-08 | Phase 31.1 | ◆ Planned |
| INTENT-09 | Phase 31.1 | ◆ Planned |
| INTENT-10 | Phase 31.1 | ◆ Planned |
| INTENT-11 | Phase 31.1 | ◆ Planned |
| INTENT-12 | Phase 31.1 | ◆ Planned |
| READINESS-01 | Phase 34 | ○ Pending |
| READINESS-02 | Phase 34 | ○ Pending |
| READINESS-03 | Phase 34 | ○ Pending |
| READINESS-04 | Phase 34 | ○ Pending |
| BILLING-01 | Phase 34 | ○ Pending |
| BILLING-02 | Phase 34 | ○ Pending |
| BILLING-03 | Phase 34 | ○ Pending |
| BILLING-04 | Phase 34 | ○ Pending |
| BILLING-05 | Phase 34 | ○ Pending |
| BILLING-06 | Phase 34 | ○ Pending |
| STORE-TYPE-01 | Phase 34 | ○ Pending |
| STORE-TYPE-02 | Phase 34 | ○ Pending |
| GUARD-01 | Phase 34 | ○ Pending |
| GUARD-02 | Phase 34 | ○ Pending |
| LEGACY-01 | Phase 34 | ○ Pending |
| LEGACY-02 | Phase 34 | ○ Pending |
| LEGACY-03 | Phase 34 | ○ Pending |
| UI-01 | Phase 34 | ○ Pending |
| UI-02 | Phase 34 | ○ Pending |
| UI-03 | Phase 34 | ○ Pending |
| UI-04 | Phase 34 | ○ Pending |
| DASHBOARD-01 | Phase 34 | ○ Pending |
| DASHBOARD-02 | Phase 34 | ○ Pending |
| DASHBOARD-03 | Phase 34 | ○ Pending |
| DASHBOARD-04 | Phase 34 | ○ Pending |
| BRANDPROFILE-01 | Phase 34 | ○ Pending |
| BRANDPROFILE-02 | Phase 34 | ○ Pending |

**Coverage:**
- v1 requirements: 153 total (54 v1.5 + 36 LEGAL + 12 INTENT + 21 INTENT-TEST + 30 F34)
- Mapped to phases: 153
- Unmapped: 0 ✓
- Deferred to v1.7: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06
- F29.1.2: Fase complementar refinando LAUNCH-01 e LAUNCH-02 (sem REQ-IDs próprios)
- F30 (LEGAL-*): Adicionados em 2026-07-23 via alinhamento com OpenSpec
- F31.1 (INTENT-*): Adicionados em 2026-07-24 via alinhamento com OpenSpec
- F34 (F34-*): Adicionados em 2026-07-29 via alinhamento com OpenSpec (Store Readiness)

---

*Requirements defined: 2026-07-15*
*Last updated: 2026-07-24 — Added F31.1 (INTENT-01 a INTENT-12 + INTENT-TEST-01 a 19) requirements*
