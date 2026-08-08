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

## v1.5 Requirements — Onboarding: Navegação por Abas (F36)

Adicionados em 2026-08-01 via OpenSpec (`openspec/changes/fase-36-onboarding-navegacao-por-abas/`). OpenSpec é a fonte detalhada; esta tabela é o índice rastreável para o gate de cobertura.

### Abas do Onboarding (F36-TABS)

- [x] **F36-TABS-01**: Definição das 3 abas em `src/lib/store-onboarding/tabs.ts` — `OnboardingTab = "dados" | "posicionamento" | "direcao-visual"`, `TAB_ORDER`, `OnboardingTabDef` com `label`/`labelMobile` (label mobile é apenas responsivo — id da aba permanece)
- [x] **F36-TABS-02**: `computeTabUnlock(tab, ctx)` puro retornando `{ unlocked, reason? }` — dados sempre aberta; posicionamento = nome+segmento+aceite legal+storeId; direção visual = storeId+tom de voz; loja existente com direção visual nasce aberta; CNPJ nunca bloqueia (`TabBlockReason`)
- [x] **F36-TABS-03**: Container `store-tabs.tsx` com WAI-ARIA Tabs (`tablist`/`tab`/`tabpanel`, roving tabindex, setas/Home/End, `aria-selected`/`aria-controls`/`aria-describedby`/`aria-live`); variantes desktop (labels completos) × mobile compacta (Dados/Perfil/Visual, badge pequeno, motivo no painel, "Continuar" sempre visível); touch ≥ 44px
- [x] **F36-TABS-04**: Deep-link em aba bloqueada — abre com bloqueio visível + link "Voltar para X"; nunca tela em branco; back/forward alternam a aba via `?tab=` no history
- [x] **F36-TABS-05**: Parsing de `?tab=` em `store-page-client.tsx` (aba inicial) + compat `required=` (`cadastro-fiscal` → `?tab=dados&fiscal=pending`, `visual-direction` → aba `direcao-visual`); `message=` mantido

### Rascunho localStorage (F36-DRAFT)

- [x] **F36-DRAFT-01**: `src/lib/store-onboarding/draft-store.ts` — `DRAFT_TTL_MS` (24h), `StoreDraft`, `draftKey(userId, storeId)` (`vendeo:store_draft:${userId}:new`/`:${storeId}`), `saveDraft`/`restoreDraft` (expira → null + remove chave)/`clearDraft`; escolha por localStorage (não sessionStorage) documentada no código
- [x] **F36-DRAFT-02**: Escrita síncrona no abandono mobile via `pagehide`/`visibilitychange` (`document.visibilityState === 'hidden'`) — grava draft síncrono; com `storeId` dispara PATCH fire-and-forget best-effort (não bloqueia)
- [x] **F36-DRAFT-03**: Restauração ao abrir `/loja` — restaura `:new` (sem loja) ou `:${storeId}` (reconcilia com banco; banco prevalece em campos persistidos); 1º save migra draft (lê uma vez, escreve no form, limpa chave)
- [x] **F36-DRAFT-04**: Limpeza da chave no logout e após o 1º save que cria a loja (a chave `:new` é removida; escopo de usuário — nunca cruza contas)

### Auto-save, estado por aba e drift (F36-AUTOSAVE)

- [x] **F36-AUTOSAVE-01**: `autoSave(fields)` em `use-store-form.ts` — silencioso, persiste apenas campos válidos; com `storeId` → PATCH silencioso; sem `storeId` + mínimo (nome+segmento+aceite) → POST `/api/store` modo draft; sem mínimo → `{ ok: false }` sem POST; retorna `{ ok: true|false }`; `saveStatus` no hook
- [x] **F36-AUTOSAVE-02**: Hook `use-onboarding-tabs.ts` — `activeTab`/`setActiveTab` (autoSave antes de navegar), `tabStates` via `computeTabState`, `saveStatus`, `handleInternalNavigation` (intercepta links internos), `handlePageHide`/`handleVisibilityChange` (draft síncrono + PATCH best-effort), `onNavigate`/`onLeave`, serialização de saves com ref/seq guard
- [x] **F36-AUTOSAVE-03**: Drift visual preservado na navegação por abas (D13) — intercepta troca de aba, navegação interna, back/forward e saída da página; `critical` → `DriftCriticalModal` + `dismissCriticalDrift()` (POST visual-signature/dismiss-critical-drift); `sensitive` → `DriftDecisionModal` + `realinhar()` (POST brand-profile/realign)/`ignorar()` (PATCH brand-profile/metadata); PATCH dos campos do snapshot adiado até decisão; campos fora do snapshot auto-save normalmente; `totalGeneratedSignatures`/gatilho de limite intactos
- [x] **F36-AUTOSAVE-04**: `computeTabState(tab, ctx)` em `src/lib/store-onboarding/tab-state.ts` — estados `blocked`/`draft`/`saved`/`ready`/`pending_generation` + prioridade `pending_generation > blocked > draft > ready > saved`; `ctx.readiness` = `StoreReadiness` da F34

### Criação de loja draft (F36-DRAFT-CREATE)

- [x] **F36-DRAFT-CREATE-01**: Migration SQL com RPC `create_store_draft(p_user_id, p_name, p_segment, ...)` — insere store com campos fiscais NULL + registra 2 aceites legais (`acceptance_source = 'onboarding'`) em transação; NÃO chama `try_grant_onboarding_entitlement`/`grant_credits`; retorna `{ store, onboardingGranted: false }`; `SECURITY DEFINER`/`SET search_path = ''`/service_role only (padrão F32); NÃO restaura `create_store_with_legal_acceptance`
- [x] **F36-DRAFT-CREATE-02**: `POST /api/store` em dois modos — sem `cnpj` → `create_store_draft` (validações name/segment/acceptedTerms reutilizadas, coleta IP/UA, 201 com `onboardingGranted: false`, sem crédito); com `cnpj` → fluxo verified/fiscal `create_store_with_cnpj` intacto (F32/F33); `cnpj` deixa de ser obrigatório
- [x] **F36-DRAFT-CREATE-03**: Gates preservados para loja draft — não gera campanha sem fiscal válido (guard `/campanhas/nova` + readiness RPC + guarda dupla F34); não concede freemium; `is_test_store` gera sem fiscal apenas com entitlement de teste concedido por admin (F33), nunca grant automático sem CNPJ; sem brand profile syncado/aceite vigente não gera
- [x] **F36-DRAFT-CREATE-04**: Transição loja draft → fiscal via `POST /api/store/update-cnpj` existente (`update_store_cnpj` RPC F32/F33) — valida CNPJ, calcula root hash, avalia freemium, anexa dados fiscais; grant possível se raiz elegível; sem mudança na rota — cobertura de testes do encadeamento

### UI da identidade (F36-IDENTITY-UI)

- [x] **F36-IDENTITY-UI-01**: `src/app/(app)/loja/page.tsx` (server) — `requirePageUser()` + `getCurrentStore(user.userId)`, `initialStore` prop; `/loja` compõe `StoreTabs` + painel ativo + `LegalAcceptancePanel` (substitui wizard 2 steps); segue `openspec/design-system/MASTER.md` + `pages/store-identity.md`
- [x] **F36-IDENTITY-UI-02**: Navegação `/loja` ↔ `/campanhas/nova` — guard de `/campanhas/nova` migra redirects para `?tab=` (`cadastro_fiscal` → `?tab=dados&fiscal=pending&returnTo=/campanhas/nova`; `brand_profile` → `?tab=direcao-visual&message=needs-visual-direction`); sem localStorage; sem loading state
- [x] **F36-IDENTITY-UI-03**: Create store (1º save) — sem `initialStore` → POST `/api/store`; sem CNPJ → modo draft (`onboardingGranted: false`, chave `:new` limpa); `store.id` em estado local (NUNCA `localStorage.setItem("store_id", ...)`); com CNPJ → fluxo verified
- [x] **F36-IDENTITY-UI-04**: Edit store (saves seguintes) — `storeId` local → PATCH `/api/store/${storeId}`; `save()` determina modo por `storeId`; auto-save silencioso via PATCH com apenas campos válidos alterados; sem mensagem de sucesso obrigatória (feedback via `saveStatus`)
- [x] **F36-IDENTITY-UI-05**: Auto-load — `StorePageClient` recebe `initialStore` do servidor; restaura rascunho `localStorage` se dentro do TTL (`:new` ou `:${storeId}` reconciliado com banco); NÃO lê `localStorage("store_id")`
- [x] **F36-IDENTITY-UI-06**: Step 2 renomeado para "Direção Visual" com badge "Necessário"; `?tab=direcao-visual` canônico + `?required=visual-direction` compat; parsing `initialStep={2}` substituído por parsing `?tab=`
- [x] **F36-IDENTITY-UI-07**: CNPJ **opcional** na criação (vazio = loja draft + aviso de fiscal pendente no painel Dados); máscara `XX.XXX.XXX/YYYY-ZZ`; lookup assíncrono `GET /api/cnpj/lookup?cnpj=` no blur (loading "Consultando dados cadastrais..."); razão social/nome fantasia bloqueados e pré-preenchidos após lookup (F33 inalterado)

### Aceite legal (F36-LEGAL)

- [x] **F36-LEGAL-01**: `legal-acceptance-panel.tsx` — enum único `LegalAcceptanceState = "pending" | "accepted" | "needs_reacceptance"`; variantes `desktop-sticky-column` (sticky no conteúdo, participa do grid) × `mobile-compact` (bloco no topo, sem sticky); estados `Pendente`/`Aceito`/`Reaceite necessário`; CTA "Revisar e aceitar" abre `ContractAcceptanceModal` (F30); derivação via `legalClearance`/`getAcceptanceStatus` (`current`→accepted, `outdated`→needs_reacceptance, ausente→pending); `aria-label`/`aria-expanded`
- [x] **F36-LEGAL-02**: Aceite `pending`/`needs_reacceptance` bloqueia a aba Posicionamento com motivo `falta aceite legal` no painel + link para abrir o card; aceite não é pré-requisito direto da Direção Visual (só seus próprios pré-requisitos); sem aceite vigente geração continua bloqueada (gate F34)

### Readiness (F36-READINESS)

- [x] **F36-READINESS-01**: `getStoreReadiness()` trata loja draft explicitamente — `ready: false` com `cadastro_fiscal` em `missing` (dado ausente já produz pendência na RPC F34; sem mudança na lógica); loja draft completa onboarding mas não gera nem recebe crédito
- [x] **F36-READINESS-02**: RPC `check_store_readiness` inalterada — critério atual (campos fiscais não-nulos E brand profile synced) trata loja draft como `cadastro_fiscal` pendente
- [x] **F36-READINESS-03**: Prioridade cadastro fiscal → brand profile mantida; redirects migrados para `?tab=` (`/campanhas/nova` guard, `/cadastro/cnpj` pós-cadastro, `ReadinessBanner` dashboard → `?tab=dados&fiscal=pending` / `?tab=direcao-visual&message=needs-visual-direction`)
- [x] **F36-READINESS-04**: `identity_state`/estado de onboarding NÃO vira critério de readiness — loja draft sem fiscal permanece "não pronta para gerar", mas completa para o onboarding em abas

### Ownership (F36-OWNERSHIP)

- [x] **F36-OWNERSHIP-01**: `POST /api/store` mantém `requireUser()` antes de qualquer operação de banco; `user_id` = `claims.sub` (body ignorado); `supabaseAdmin` para INSERT/RPC; valida `name`/`segment`/`acceptedTerms` antes de ambas as RPCs; versões de documentos resolvidas server-side via `getCurrentVersion()` (cliente não envia versões); sem CNPJ → `create_store_draft` (201, `onboardingGranted: false`, sem grant); com CNPJ → `create_store_with_cnpj` (root hash HMAC server-side, `cnpjMasked`, `onboardingGranted`); 409 usuário já tem loja / CNPJ em outra conta; 400 CNPJ inválido / sem aceite; 401 não autenticado (JSON, não redirect)

## v1.5 Requirements — Tabela de Custos por Operação (F38)

Adicionados em 2026-08-07 via OpenSpec (`openspec/changes/fase-38-credit-operation-costs/`). OpenSpec é a fonte detalhada; esta tabela é o índice rastreável para o gate de cobertura.

### Banco — Tabelas e RPC (F38-DB)

- [ ] **F38-DB-01**: Tabela `credit_operation_costs` como fonte única de custo por operação (D2) — `operation_key` TEXT PK, `cost_credits` INTEGER NOT NULL CHECK (> 0), `enabled` BOOLEAN NOT NULL DEFAULT true, `updated_by` UUID nullable, `updated_at`/`created_at` TIMESTAMPTZ; trigger scoped de `updated_at`; RLS service_role (sem GRANT para `authenticated`); sem CHECK enum no banco
- [ ] **F38-DB-02**: Tabela `credit_operation_cost_audit` append-only (D8) — `action` CHECK IN ('update_cost','toggle_enabled'), old/new de cost/enabled, `actor_id`, `reason` NOT NULL, `operation_id` com UNIQUE parcial (idempotência); trigger imutável bloqueia UPDATE/DELETE; RLS service_role
- [ ] **F38-DB-03**: RPC `admin_update_operation_cost` (D8) — SECURITY DEFINER, `SET search_path=''`; parâmetros p_actor_id/p_operation_key/p_cost_credits/p_enabled/p_reason/p_operation_id; exige **exatamente um** campo mutável por chamada (XOR); reason obrigatório; cost_credits > 0; idempotência por operation_id; transação única update + insert na audit; retorna JSONB `{operation_key, cost_credits, enabled, audit_id, updated_at, idempotent}`; rollback em falha
- [ ] **F38-DB-04**: Seeds idempotentes (INSERT ... ON CONFLICT DO NOTHING) — `campaign_generation=1` (enabled true) e `visual_signature_generation=1` (enabled true), `updated_by` NULL (seeds de sistema); verificações SQL/integradas I1–I6 (RLS, CHECK, imutabilidade, idempotência, seeds, transacionalidade)

### Core Library — Enum, Tipos e Service (F38-SERVICE)

- [ ] **F38-SERVICE-01**: Enum versionado `OPERATION_KEYS`/`OperationKey` em `src/lib/credit/types.ts` (D7) — `["campaign_generation","visual_signature_generation"]`; fonte da verdade das chaves; módulo sem server-only (importável por zod/UI); junto com `OperationCostResolution` e `OperationCostSnapshot`
- [ ] **F38-SERVICE-02**: `OperationCostService` em `src/lib/credit/operation-cost-service.ts` (server-only) — `getCost(operationKey)` → `{ operationKey, costCredits, enabled, source: "table" | "fallback" }`; `DEFAULT_OPERATION_COSTS` versionado (mesma fonte do enum); linha inexistente → default seguro (fail-open, `source: 'fallback'`, log aviso); linha existente → `source: 'table'`
- [ ] **F38-SERVICE-03**: `OperationCostUnavailableError` (D5) — erro real de leitura (rede/banco/query) lança a exceção (fail-closed, nunca retorna `enabled` presumido); log de erro; as rotas convertem em `503 operation_cost_unavailable`
- [ ] **F38-SERVICE-04**: `OperationCostSnapshot` (D6) — `{ operation_key, operation_cost_credits, operation_cost_source }` no metadata da deduction (ledger auto-descritivo); `reserve_credit` (F24) permanece inalterado

### API — Endpoints (F38-API)

- [ ] **F38-API-01**: `GET /api/operation-costs` (autenticado via apiHandler, D11) — custos resolvidos `{ "campaign_generation": { costCredits, enabled }, ... }`; NÃO expõe `updated_by`/`updated_at`/`source`; erro de leitura → `503 operation_cost_unavailable`
- [ ] **F38-API-02**: Hook client `useOperationCosts()` em `src/hooks/use-operation-costs.ts` (D11) — fetch + cache do endpoint; estados loading/erro (503 → "custos indisponíveis"); contrato único para form e modais
- [ ] **F38-API-03**: Server components leem `OperationCostService` diretamente (server-only, D11) — handlers HTTP convertem `OperationCostUnavailableError` em 503; componentes renderizam estado indisponível sem custo presumido

### Admin — API e Página (F38-ADMIN)

- [ ] **F38-ADMIN-01**: `GET /api/admin/operation-costs` (requireAdmin, D9) — lista todas as chaves do enum TS mesclando tabela + fallback, com `operationKey`, `costCredits`, `enabled`, `updatedBy`, `updatedAt`, `source`; 403 não-admin; erro de leitura → 503
- [ ] **F38-ADMIN-02**: `PUT /api/admin/operation-costs` (requireAdmin, D9) — schema zod (`UpdateOperationCostRequestSchema`), XOR costCredits/enabled, reason obrigatório, costCredits > 0, operationId idempotente; chama RPC `admin_update_operation_cost`; 200/400/403/500; sem mutação direta via query builder
- [ ] **F38-ADMIN-03**: Schema zod `UpdateOperationCostRequestSchema` em `src/lib/admin/schemas.ts` (D3/D7/D8) — `operationKey: z.enum(OPERATION_KEYS)`, `costCredits: z.number().int().min(1).optional()`, `enabled` optional, `reason: z.string().min(1)`, `operationId` uuid opcional, refine XOR
- [ ] **F38-ADMIN-04**: Página `/admin/operation-costs` (D10) — tabela por operação (key, cost input ≥1, toggle enabled, updated_by email, updated_at, badge source tabela/fallback); edição de custo + toggle com motivo obrigatório → PUT; feedback com audit_id; estados de erro/load; link na navegação admin (`/admin/layout.tsx`)

### Rotas de Geração — Custo Dinâmico (F38-ROUTES)

- [ ] **F38-ROUTES-01**: Resolução de custo nas rotas de geração (D12) — `OperationCostService.getCost(operationKey)` uma única vez por request, após auth/ownership/readiness/rate guards e antes de saldo/reserva/IA paga; `OperationCostUnavailableError` → `503 operation_cost_unavailable` (sem geração nem reserva); `enabled=false` → `503 operation_disabled` (sempre, independente de `creditsChargingEnabled`); balance check dinâmico `balance < costCredits` → 402; reserva com metadata snapshot; refund mantém metadata de feature
- [ ] **F38-ROUTES-02**: `generate-image` (campaign_generation, D12) — substitui `COST_PER_GENERATION` por `cost.costCredits` no balance check (`:227`) e na reserva (`:347`) com metadata `feature: "campaign_pipeline"`, `operation_key`, `operation_cost_credits`, `operation_cost_source`; `COST_PER_GENERATION` removido de `src/lib/image-generation/config.ts` sem imports restantes
- [ ] **F38-ROUTES-03**: `generate-without-logo` (visual_signature_generation, D12) — substitui literal `1` por `cost.costCredits` no balance check (`:176`) e na reserva (`:186`) com metadata `feature: "visual_signature"`, `mode`, `operationId`, snapshot; guards 503 operation_disabled/unavailable sempre (mesmo com cobrança desligada ou `v15Enabled=false`)
- [ ] **F38-ROUTES-04**: Pipeline pré-stream (`POST /api/campaign/generate-image`, D12) — resolve `campaign_generation` após guards e antes do saldo check; estrutura de 3 zonas mantida; 402 antes do stream sem chamada de IA nem evento NDJSON

### UI Dinâmica (F38-UI)

- [ ] **F38-UI-01**: `campaign-input-form.tsx` (D11) — `Custo: {cost}` dinâmico (via `useOperationCosts`), desabilita submit quando `balance !== null && balance < cost` (hoje só `balance === 0`); `enabled=false` → desabilitado com indisponibilidade; custo indisponível (503) → desabilitado com "Tente novamente em alguns instantes" (sem "1 crédito" presumido)
- [ ] **F38-UI-02**: `balance-card.tsx` (D11) — "Cada geração consome {cost} crédito(s)." dinâmico via hook; plural correto (`formatCredits`: 1 crédito / N créditos); sem custo presumido em 503
- [ ] **F38-UI-03**: `drift-critical-modal.tsx` (D11) — alerta sem crédito com custo dinâmico de `visual_signature_generation` + plural correto; sem custo presumido em 503
- [ ] **F38-UI-04**: `visual-signature-approval-modal.tsx` (D11) — sub-message "Cada geração de assinatura visual consome {cost} crédito(s)." dinâmico + plural; sem custo presumido em 503
- [ ] **F38-UI-05**: `use-operation-costs.ts` (D11) — hook compartilhado client (fetch/cache de `GET /api/operation-costs`); estados loading / indisponível (503) / carregado; usado por form e modais (sem duplicação de fetch)

### Assinatura Visual — Metadata Snapshot (F38-VS)

- [ ] **F38-VS-01**: Metadata de VS inclui snapshot de custo (D6) — `store_visual_signatures.metadata` ganha `operation_key`, `operation_cost_credits`, `operation_cost_source` além do `credit_tx_id` existente (auto-descritivo do custo na época da geração)

### Launch Config — Interação com Guards (F38-CONFIG)

- [ ] **F38-CONFIG-01**: `creditsChargingEnabled=false` pula saldo/reserva para operações **habilitadas**, mas NÃO ignora `enabled=false` (→ `503 operation_disabled`) nem erro real de leitura (→ `503 operation_cost_unavailable`) (D4/D5)
- [ ] **F38-CONFIG-02**: `v15Enabled=false` (compat v1.4) pula saldo/reserva mas mantém resolução de custo e guards de habilitação/disponibilidade (D4/D5); `generationPaused` permanece precedente de vocabulário de indisponibilidade

## v1.5 Requirements — Apuração de Custos de IA por Entrega (F38.1)

Desdobramento da F38, adicionados em 2026-08-08 via OpenSpec (`openspec/changes/fase-38-1-ai-cost-accounting/`). OpenSpec é a fonte detalhada; esta tabela é o índice rastreável para o gate de cobertura. F38.1 responde "quanto essa entrega custou para o Vendeo" (USD real/estimado por chamada de IA); a F38 responde "quanto o usuário paga/debita" (créditos) — camadas separadas, encontro apenas nas views de reconciliação.

### Apuração — Views e RPC (F38.1-ACCOUNTING)

- [x] **F38.1-01**: View `admin_ai_operation_costs` — agrupamento por run (`operation_run_id`), soma apenas call-level (anti-dupla-contagem)
- [x] **F38.1-02**: View `admin_campaign_delivery_costs` — detalhe por etapa da entrega
- [x] **F38.1-03**: Views `admin_ai_cost_by_provider_model` e `admin_ai_cost_by_stage` — agrupamentos dinâmicos por provider/model e etapa
- [x] **F38.1-04**: View `admin_ai_cost_by_store` — custo por loja
- [x] **F38.1-05**: View `admin_cost_vs_credits` — reconciliação USD × créditos
- [x] **F38.1-06**: RPC `admin_get_ai_costs` — apuração filtrada (8 params, `p_hours`)
- [x] **F38.1-07**: GET `/api/admin/ai-costs` — apuração (sem UI)
- [x] **F38.1-08**: `admin_get_metrics` (F28) permanece inalterado — compatível

### Estimador (F38.1-ESTIMATOR)

- [x] **F38.1-09**: `estimateAiCost()` calcula custo estimado — corrige gemini-3.1-flash-lite, gpt-image-2, cached/image tokens
- [x] **F38.1-10**: Modelo desconhecido → null (legado)

### Tracker — Tipos e Registro (F38.1-TRACKER)

- [x] **F38.1-11**: Tipos centrais de custo (`CostSource`, `OperationRunType`, `TokenUsage`, `CostResolution`)
- [x] **F38.1-12**: `AiCostEvent` — contrato do evento de chamada real de IA
- [x] **F38.1-13**: `AiCallInfo` — callback de usage (padrão dos serviços)
- [x] **F38.1-14**: `AiCostTracker` — camada única de registro (best-effort)

### Geração de Imagem (F38.1-IMAGE)

- [x] **F38.1-15**: `ImageGenerationService` emite métricas por run (attempt granular, duration_ms por chamada)

### Tabela de Preço (F38.1-PRICING)

- [x] **F38.1-16**: Tabela `ai_model_pricing` versionada (`effective_from`/`effective_until`, CHECK `at_least_one_price`, índice parcial único `uq_ai_model_pricing_vigente`)
- [x] **F38.1-17**: Seeds verificáveis de `ai_model_pricing` (bootstrap — 7 seeds incl. gemini-3.1-flash-lite e gpt-image-2)
- [x] **F38.1-18**: RPC `admin_set_ai_model_price` (SECURITY DEFINER, transacional, versiona vigência)
- [x] **F38.1-19**: GET `/api/admin/ai-model-pricing`
- [ ] **F38.1-20**: PUT `/api/admin/ai-model-pricing`

### Brand Profile (F38.1-BRAND)

- [ ] **F38.1-21**: Store Brand Director prompt file
- [ ] **F38.1-22**: Store Brand Director JSON output schema

### Copy (F38.1-COPY)

- [ ] **F38.1-23**: `CopyDirectorService` class — preserva usage para custo real

### Revisão de Imagem (F38.1-REVIEW)

- [ ] **F38.1-24**: `ImageReviewService` revisa imagens geradas — emite evento de custo (vision)

### Brand Profiler sem Logo (F38.1-PROFILER)

- [ ] **F38.1-25**: Brand profiler execution
- [ ] **F38.1-26**: Presence validation flow

### Assinatura Visual (F38.1-VS)

- [ ] **F38.1-27**: Generate visual signature via AI image generation (Abordagem B — main approach)
- [ ] **F38.1-28**: Generate 1 variation for automatic mode (Deixar o Vendeo Criar)
- [x] **F38.1-29**: Metadata includes generation_tier
- [ ] **F38.1-30**: Visual signature quality criteria
- [ ] **F38.1-31**: generate-without-logo resolve custo dinâmico (nova tentativa = novo run)

### Inferência Text-Only (F38.1-TEXT)

- [ ] **F38.1-32**: Brand inference service — `onCall` no caminho real (sem evento no mock dev)

### Pipeline (F38.1-PIPELINE)

- [ ] **F38.1-33**: traceId gerado por request
- [ ] **F38.1-34**: Telemetria persistida no pipeline
- [ ] **F38.1-35**: Attempt granular e duration_ms por chamada (furo 6/7)
- [ ] **F38.1-36**: metadata.totalCost correto (furo 2)
- [ ] **F38.1-37**: Reconciliação via views — anti-dupla-contagem

### Validação (F38.1-VALIDATION)

- [ ] **F38.1-38**: `ValidationContext` type definido — validação de input emite evento de custo

## v1.7 Requirements (Stripe / Monetização Pública)

Deferred from v1.5 critical path. Stripe será implementada como F39/v1.7 após validação do beta controlado (renumerada de F35 → F36 → F37 → F39 nos alinhamentos do Changelog/Novidades, do Onboarding — Navegação por Abas e da Tabela de Custos por Operação).

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
| F38-DB-01 | Phase 38 | ○ Pending |
| F38-DB-02 | Phase 38 | ○ Pending |
| F38-DB-03 | Phase 38 | ○ Pending |
| F38-DB-04 | Phase 38 | ○ Pending |
| F38-SERVICE-01 | Phase 38 | ○ Pending |
| F38-SERVICE-02 | Phase 38 | ○ Pending |
| F38-SERVICE-03 | Phase 38 | ○ Pending |
| F38-SERVICE-04 | Phase 38 | ○ Pending |
| F38-API-01 | Phase 38 | ○ Pending |
| F38-API-02 | Phase 38 | ○ Pending |
| F38-API-03 | Phase 38 | ○ Pending |
| F38-ADMIN-01 | Phase 38 | ○ Pending |
| F38-ADMIN-02 | Phase 38 | ○ Pending |
| F38-ADMIN-03 | Phase 38 | ○ Pending |
| F38-ADMIN-04 | Phase 38 | ○ Pending |
| F38-ROUTES-01 | Phase 38 | ○ Pending |
| F38-ROUTES-02 | Phase 38 | ○ Pending |
| F38-ROUTES-03 | Phase 38 | ○ Pending |
| F38-ROUTES-04 | Phase 38 | ○ Pending |
| F38-UI-01 | Phase 38 | ○ Pending |
| F38-UI-02 | Phase 38 | ○ Pending |
| F38-UI-03 | Phase 38 | ○ Pending |
| F38-UI-04 | Phase 38 | ○ Pending |
| F38-UI-05 | Phase 38 | ○ Pending |
| F38-VS-01 | Phase 38 | ○ Pending |
| F38-CONFIG-01 | Phase 38 | ○ Pending |
| F38-CONFIG-02 | Phase 38 | ○ Pending |
| F38.1-01 | Phase 38.1 | ○ Pending |
| F38.1-02 | Phase 38.1 | ○ Pending |
| F38.1-03 | Phase 38.1 | ○ Pending |
| F38.1-04 | Phase 38.1 | ○ Pending |
| F38.1-05 | Phase 38.1 | ○ Pending |
| F38.1-06 | Phase 38.1 | ○ Pending |
| F38.1-07 | Phase 38.1 | ○ Pending |
| F38.1-08 | Phase 38.1 | ○ Pending |
| F38.1-09 | Phase 38.1 | ○ Pending |
| F38.1-10 | Phase 38.1 | ○ Pending |
| F38.1-11 | Phase 38.1 | ○ Pending |
| F38.1-12 | Phase 38.1 | ○ Pending |
| F38.1-13 | Phase 38.1 | ○ Pending |
| F38.1-14 | Phase 38.1 | ○ Pending |
| F38.1-15 | Phase 38.1 | ○ Pending |
| F38.1-16 | Phase 38.1 | ○ Pending |
| F38.1-17 | Phase 38.1 | ○ Pending |
| F38.1-18 | Phase 38.1 | ○ Pending |
| F38.1-19 | Phase 38.1 | ○ Pending |
| F38.1-20 | Phase 38.1 | ○ Pending |
| F38.1-21 | Phase 38.1 | ○ Pending |
| F38.1-22 | Phase 38.1 | ○ Pending |
| F38.1-23 | Phase 38.1 | ○ Pending |
| F38.1-24 | Phase 38.1 | ○ Pending |
| F38.1-25 | Phase 38.1 | ○ Pending |
| F38.1-26 | Phase 38.1 | ○ Pending |
| F38.1-27 | Phase 38.1 | ○ Pending |
| F38.1-28 | Phase 38.1 | ○ Pending |
| F38.1-29 | Phase 38.1 | ○ Pending |
| F38.1-30 | Phase 38.1 | ○ Pending |
| F38.1-31 | Phase 38.1 | ○ Pending |
| F38.1-32 | Phase 38.1 | ○ Pending |
| F38.1-33 | Phase 38.1 | ○ Pending |
| F38.1-34 | Phase 38.1 | ○ Pending |
| F38.1-35 | Phase 38.1 | ○ Pending |
| F38.1-36 | Phase 38.1 | ○ Pending |
| F38.1-37 | Phase 38.1 | ○ Pending |
| F38.1-38 | Phase 38.1 | ○ Pending |

**Coverage:**

- v1 requirements: 218 total (54 v1.5 + 36 LEGAL + 12 INTENT + 21 INTENT-TEST + 30 F34 + 27 F38 + 38 F38.1)
- Mapped to phases: 218
- Unmapped: 0 ✓
- Deferred to v1.7: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06
- F29.1.2: Fase complementar refinando LAUNCH-01 e LAUNCH-02 (sem REQ-IDs próprios)
- F30 (LEGAL-*): Adicionados em 2026-07-23 via alinhamento com OpenSpec
- F31.1 (INTENT-*): Adicionados em 2026-07-24 via alinhamento com OpenSpec
- F34 (F34-*): Adicionados em 2026-07-29 via alinhamento com OpenSpec (Store Readiness)
- F38 (F38-*): Adicionados em 2026-08-07 via alinhamento com OpenSpec (Tabela de Custos por Operação)
- F38.1 (F38.1-*): Adicionados em 2026-08-08 via alinhamento com OpenSpec (Apuração de Custos de IA por Entrega)

---

*Requirements defined: 2026-07-15*
*Last updated: 2026-08-08 — Added F38.1 (F38.1-01 a 38) requirements*
