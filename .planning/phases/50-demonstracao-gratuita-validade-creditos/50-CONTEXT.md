# Phase 50: Demonstração Gratuita e Validade dos Créditos — Context

**Gathered:** 2026-09-20
**Status:** Ready for planning
**Source of truth:** `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/` (proposal.md / design.md D1–D26 / 27 specs / tasks.md / legal-package.md)
**Numbering:** F50 (v1.5). Stripe/Monetização Pública permanece fora da numeração (diferida, v1.7+). F44 (Temas de Campanha) também fora da numeração.
**Plan naming:** diretório `.planning/phases/50-demonstracao-gratuita-validade-creditos`; arquivos `50-XX-PLAN.md` (convenção GSD).

> Este CONTEXT é a **síntese fiel** da base técnica OpenSpec. **Nenhuma decisão de produto foi ampliada.** As decisões técnicas (D1–D26), o "Estado real em código", a matriz de riscos, o plano de migração e o rollout/corte são **tradução direta** de `design.md`/`proposal.md`/`tasks.md`/`specs/`. **Interpretação do D1/tasks (resolvida — mesmo precedente F49):** a nota "trackings/roadmap não são atualizados durante a elaboração/execução" vale **somente** para a geração inicial dos artefatos OpenSpec; a partir do planejamento/execução GSD, o tracking normal da fase é **obrigatório** (e foi explicitamente solicitado pelo usuário nesta fase).

<domain>
## Phase Boundary

A F50 **substitui o freemium contínuo** (10 créditos `bonus_onboarding` + 5 mensais `bonus_monthly`, sem validade) por uma **demonstração gratuita limitada e transparente** — 10 créditos válidos por 168h (7 dias), sem cartão e sem cobrança — preservando integralmente os saldos legados, encerrando as concessões mensais no corte e instrumentando os eventos que a F51 consumirá no funil.

**O que esta fase entrega:**

1. **Bucket de demonstração com validade (D1)** — `credit_balances` ganha `demo_balance`, `demo_expires_at` (autoritativo), `demo_cycle_id`, `origin_demo_grant_tx_id` e `demo_contributing_tx_ids`. `balance` (bruto) = `demo_balance + bonus_balance + purchased_balance` via trigger, mas **não é o saldo disponível** (derivado, D4).
2. **Tipos de transação `demo` e `expiration` (D2)** — CHECK de `credit_transactions` passa a 9 tipos; `expiration` é a **evidência durável** do encerramento (no máximo uma por episódio; zero quando o episódio termina já esgotado).
3. **Concessão automática da demonstração (D3)** — RPC `grant_demo_credits` (flag `p_demo_grant_enabled` **obrigatória** antes dos defaults), irrepetível por raiz de CNPJ via `benefit_type='demo'`, elegibilidade = ausência de `onboarding` **e** `demo`. Substitui o onboarding grant.
4. **Ordem de consumo autoritativa (D4/D16)** — demo ativo → bônus → comprado, atômica em `reserve_credit` (`SELECT ... FOR UPDATE`), metadata de origem (`demo_amount`/`bonus_amount`/`purchased_amount` + snapshot `demo_expires_at`), leitura de saldo disponível **por RLS** (não service_role).
5. **Expiração efetiva com autoridade híbrida (D5)** — `demo_expires_at` é a fonte de verdade; a **leitura calcula sem escrever**; `reserve_credit` materializa quando necessário; cron reconciliador materializa contas inativas; notificação/telemetria **derivadas da transação durável** com reparo.
6. **Estorno na borda do prazo (D6/D25)** — regra **temporal** (por `demo_expires_at`, não por materialização); **janela de graça de 24h** para estorno de demo após o vencimento, via **episódios de graça** rastreáveis por `origin_demo_grant_tx_id`.
7. **Irrepetibilidade por raiz (D7)** — `checkDemoEligibility`/`try_grant_demo_entitlement`.
8. **Transição sem expiração retroativa (D8)** — saldos `bonus_*` preservados; loja draft que informa CNPJ depois recebe demo se `approved` + flag ativa + raiz sem benefício anterior; marcador legado só com evidência real.
9. **Encerramento do freemium mensal (D9)** — `monthlyCreditsEnabled` preservado `true` até o corte; cron/botão desativados **no corte**; RPCs mantidas como legado.
10. **Notificações in-app + email transacional (D10/D23)** — outbox `credit_notifications` + módulo `src/lib/email` (Resend) gated por `VENDEO_EMAIL_ENABLED`; claim/lease anti-duplicidade; máquina de estados `pending → processing → sent|failed|suppressed`; supressão só de demo (backlog/fora de janela); `support_ack`/`support_notice` **duráveis e nunca suprimidos**; `sent` ≠ `delivered`.
11. **Estados de prazo na UI (D11)** — `getDemoStatus` (`active`/`expiring_soon`/`exhausted`/`expired`/`none`) + data/hora local + texto relativo; sem SLA, sem linguagem de compra.
12. **Suporte honesto (D12/D22)** — remoção do SLA "até 24h"; solicitação durável/idempotente em `support_credit_requests` (fonte canônica) + auto-ack + aviso ao suporte atômicos; protocolo + timestamps; reconsideração manual.
13. **Três documentos legais + reaceite (D13)** — Termos v1.5, Privacidade v1.4, AUP v1.2; reaceite contratual (Terms+AUP) via `requireLegalClearance` × ciência de privacidade (v1.4) via `PrivacyGate`/`privacy_acknowledgements`; validação jurídica formal = gate de corte; fornecedor (PJ) sem placeholder.
14. **Telemetria de produto (D14)** — tabela `product_events` com `demo_granted`/`first_generation`/`demo_exhausted`/`demo_expired`/`support_credit_request` (F51 consumidora).
15. **Fail-closed/fail-open e rollout (D15)** — demo/expiração fail-closed; telemetria/notificações de demo fail-open; rollout em 8 passos sem janela de vácuo.
16. **Operação do beta (D17/D18/D19)** — beta fechado, Brasil, ≤50 participantes; WhatsApp opcional/rotulado; aviso de privacidade versionado; maioridade via aceite; imagens/menores permitidas com direitos; proibições.
17. **Privacidade real dos arquivos (D20)** — buckets `store-brand-assets`/`visual-signatures`/`store-logos` tornados privados; migração `getPublicUrl` → URL assinada (read-time, nunca persistida).
18. **Conta, retenção e direitos (D21)** — conta ativa sem saldo; encerramento com janela de 30 dias; `data_subject_requests`; direitos via suporte com protocolo; retenção/anonimização.
19. **Continuidade e backup (D26)** — Supabase mantido; backup externo restaurável (banco + buckets) como gate do primeiro convite.

**O que esta fase NÃO entrega (Non-Goals):**

- Checkout, Stripe, preço público, venda de créditos, assinatura, cobrança automática, emissão fiscal, landing/SEO (F51).
- Crédito bônus com prazo excepcional (follow-up; **todo bônus é não-expirável na F50**).
- Modelagem de lote/parcela (lots) por expiração (a graça usa episódios, não lots completos).
- Migração de storage para Cloudflare/R2 (hardening do Supabase atual apenas).
- Autosserviço completo de direitos de titular (via suporte com protocolo durante o beta).
- Plataforma nova de convites; redesign geral; concessões promocionais complexas.
- Alteração de prompts, gateway de IA, snapshot, domínio ou contrato de geração.

**Estado real em código (explorado na fase, `design.md` Context):**

- **Ledger/buckets** (`supabase/migrations/20260716000001_create_credit_tables.sql`, `20260722000002_creditos_mensais_automaticos.sql`): `credit_balances` com `balance = bonus_balance + purchased_balance` (trigger `trg_credit_balances_sync_total`) e `last_monthly_grant_at` (deprecated F32). `credit_transactions` append-only com 7 tipos e CHECK de sinal por tipo. RPCs atômicas `grant_credits` (p_type), `reserve_credit` (bônus→comprado, metadata `bonus_amount`/`purchased_amount`), `refund_credit`, `admin_grant_credits`.
- **Concessão atual:** onboarding 10 (`bonus_onboarding`) via `create_store_with_cnpj`/`admin_approve_store_verification`/`admin_exception_store_verification`; mensal 5 (`bonus_monthly`) via `grant_monthly_credits` (por raiz, `20260815000001_grant_monthly_credits_por_raiz.sql`). Irrepetibilidade em `freemium_entitlements` (`root_hash, benefit_type, COALESCE(cycle)`), tipos `onboarding/monthly/admin_exception`. Motor `evaluateFreemiumEligibility` (F42).
- **Expiração:** inexistente.
- **Notificações/email:** nenhum email de app (só GoTrue: signup/recovery); nenhuma notificação in-app (só changelog F35 em localStorage). **Não há Edge Function** — precedente real é Resend como SMTP do GoTrue (`noreply@vendeo.tech`). Suporte = `mailto:SUPPORT_EMAIL`; SLA "até 24h" em `credit-cta.tsx`/`balance-card.tsx`.
- **Legal:** Terms v1.4 / Privacy v1.3 / AUP v1.1; `legal_document_versions` + `legal_acceptances`; reaceite via `requireLegalClearance` (gate 403 nas rotas de geração). `getCurrentVersion()` resolve a versão vigente por `effective_at <= now()`.
- **Telemetria:** `generation_events` (custo IA) + `pipeline-logger`; sem eventos de produto/funil.
- **Cron:** único `GET /api/cron/monthly-credits` (`vercel.json` 06:00 UTC, `CRON_SECRET` bearer, middleware passthrough).
- **Admin:** `admin_get_users_summary` (bonus/purchased), grant form, freemium exception, botão mensal.
- **Consumidores de saldo:** `generate-image/route.ts` (gate `getBalance` → `reserveCredit`; refunds em 4 pontos) e `generate-without-logo/route.ts` (gate + reserve + refund).

</domain>

<decisions>
## Implementation Decisions

### Nomenclatura e rastreabilidade (LOCKED)
- Fase lógica **50**; diretório `.planning/phases/50-demonstracao-gratuita-validade-creditos`; planos `50-XX-PLAN.md`; OpenSpec `fase-50-demonstracao-gratuita-e-validade-dos-creditos`.
- Requirements dos planos: usar os **slugs das capabilities** (10 novas + 19 modificadas, listadas no proposal). Não há REQ-IDs no `REQUIREMENTS.md`.
- **Interpretação do D1/tasks (confirmada — precedente F49):** a proibição de atualizar trackings/roadmap valia **somente** para a geração inicial dos artefatos OpenSpec; durante planejamento/execução/fechamento GSD o tracking é **obrigatório**.
- **17 planos / 10 waves** (DAG GSD com waves estritamente crescentes — o `tasks.md` propõe 9 waves, mas com dependências same-wave que violam o paralelismo de waves; ver `<divergences_resolved>`). Dependências-chave: 50-02 depende de 50-01; 50-03 de 50-02; 50-04 de 50-03; 50-05 de 50-03/50-04; 50-06 de 50-03/50-04/50-05/50-07/50-08; 50-07/50-08 (infra) na wave 3 (50-07 antes de 50-06, pois o cron usa o worker de email); 50-09 de 50-04/50-06/50-07; 50-12 de 50-05..50-10/50-15/50-16; 50-13 (regressão) **depois** de 50-11/50-12/50-15/50-16; 50-14 (corte) **depois** de 50-13 + 50-17 + 50-10 + 50-16 (e da PJ constituída + validação jurídica formal).

### D1 — Representação dos três buckets
`DECIDIDO` (menor migração: colunas em `credit_balances`; sem tabela de lots).
- `demo_balance INTEGER NOT NULL DEFAULT 0 CHECK (>=0)`; `demo_expires_at TIMESTAMPTZ NULL` (autoritativo; NULL = sem demo ativa); `demo_cycle_id UUID NULL` (episódio corrente — muda a cada episódio de graça, zera na expiração); `origin_demo_grant_tx_id UUID NULL` (grant original, **estável**, nunca zerado pela expiração); `demo_contributing_tx_ids UUID[] NOT NULL DEFAULT '{}'`.
- `bonus_balance` (não-expirável na F50) e `purchased_balance` (futuro) permanecem.
- `balance` (materializado) = soma dos 3 via trigger — **não é o saldo disponível**; todo consumidor direto de `balance` deve migrar para o saldo disponível (inventário em 50-01/50-04).
- No máximo **uma** demonstração por loja/raiz (um único `origin_demo_grant_tx_id`).

### D2 — Tipos de transação `demo` e `expiration`
`DECIDIDO`.
- `demo` (concessão, `amount > 0`) — incrementa `demo_balance`, define `demo_expires_at`/`demo_cycle_id`/`origin_demo_grant_tx_id`, inicia `demo_contributing_tx_ids`.
- `expiration` (expiração, `amount < 0`) — `amount = -demo_balance`, `reference = demo_cycle_id`, `metadata = { bucket:'demo', expired_amount, cycle_id, origin_demo_grant_tx_id, contributing_tx_ids }`; zera `demo_balance`/`demo_expires_at`/`demo_cycle_id`/`demo_contributing_tx_ids` (**`origin_demo_grant_tx_id` NÃO é zerado**).
- CHECK type → 9 tipos; amount_sign: `demo > 0`, `expiration < 0`. **No máximo uma `expiration` por episódio** (guard `demo_balance > 0 AND demo_expires_at <= now()`).

### D3 — Concessão da demonstração (RPC `grant_demo_credits`)
`DECIDIDO`.
- `public.grant_demo_credits(p_store_id UUID, p_root_hash TEXT, p_amount INTEGER, p_demo_grant_enabled BOOLEAN, p_ttl_hours INTEGER DEFAULT 168, p_idempotency_key TEXT DEFAULT NULL, p_granted_by UUID DEFAULT NULL) RETURNS JSONB` — `p_demo_grant_enabled` **obrigatório e antes dos defaults**.
- Gating explícito dentro da transação atômica (D16): `false` → `{granted:false, reason:'disabled'}` sem INSERT.
- Ordem: (1) flag off → disabled; (2) elegibilidade raiz **ANTES do INSERT** (entitlement `onboarding` → `onboarding_consumed`); (3) `try_grant_demo_entitlement` ON CONFLICT DO NOTHING (NULL → `already_granted`); (4) `grant_credits(..., p_type='demo')`; (5) vincula `grant_transaction_id` + auditoria `admin_audit_log` (`credit_grant`, `grant_type='demo'`); (6) emite `product_events.demo_granted` + enfileira notificação (best-effort).
- `demo_expires_at = now() + make_interval(hours => p_ttl_hours)` (UTC); exibição local no client.
- Substitui `bonus_onboarding` em `create_store_with_cnpj`, `admin_approve_store_verification`, `admin_exception_store_verification` (todos recebem `p_demo_grant_enabled` do caller); `update_store_cnpj` concede demo quando `approved` + flag ativa + raiz sem benefício anterior.

### D4 — Regra autoritativa de saldo disponível e ordem de consumo
`DECIDIDO`.
- **Saldo disponível** = `demo_ativo + bonus_balance + purchased_balance`, onde `demo_ativo = (demo_expires_at > now()) ? demo_balance : 0`. **`demo_expires_at IS NULL` NUNCA conta como ativo.** **Invariante (CHECK):** `demo_balance > 0` implica `demo_expires_at`/`demo_cycle_id`/`origin_demo_grant_tx_id` não nulos.
- **Leitura PURA (não materializa)** por RLS/`authenticated` (D24). Materialização é responsabilidade exclusiva de `reserve_credit`/reconciliador.
- Ordem em `reserve_credit`: demo ativo → bônus → comprado; materializa expiração pendente antes do `SELECT ... FOR UPDATE`; metadata `demo_amount`/`bonus_amount`/`purchased_amount` + snapshot `demo_expires_at`.

### D5 — Expiração efetiva com autoridade temporal híbrida
`DECIDIDO`.
- `demo_expires_at` é a **única fonte de verdade**; materialização é limpeza idempotente (não decisão de validade).
- Disparada **somente** por `reserve_credit` (mesma transação, `FOR UPDATE`) e pelo **reconciliador** (cron) para contas inativas.
- **Evidência durável:** a transação `expiration` é o registro canônico; `demo_expired`/notificação de encerramento derivados dela (dedup = `expiration_tx_id`); `demo_exhausted` da deduction (`demo_after=0` com `demo_before>0`); `demo_granted` reparável da transação `demo` (dedup = `grant_tx_id`). Reconciliador repara outbox/eventos ausentes.
- Cron `GET /api/cron/demo-credits` (cadência conforme plano Vercel — D23).

### D6/D25 — Estorno na borda do prazo (regra temporal)
`DECIDIDO` (revisado — D25).
- `refund_credit` lê `metadata.demo_amount`/`bonus_amount`/`purchased_amount` + snapshot `demo_expires_at`. Decisão **temporal**.
- (1) Episódio original válido (`demo_expires_at > now()` e `demo_cycle_id = origin_demo_grant_tx_id`) → restaura sem estender; (2) episódio de graça ativo (`demo_cycle_id != origin_demo_grant_tx_id`) → restaura + `GREATEST(demo_expires_at, now()+24h)`; (3) nenhum episódio ativo (`demo_expires_at <= now()` ou NULL) → materializa saldo vencido (se houver) e **abre novo episódio de graça** (`demo_cycle_id` novo, `demo_expires_at = now()+24h`), preservando `origin_demo_grant_tx_id`.
- Gatilho da graça é **somente o tempo vencido** (demo esgotada dentro dos 7 dias restaura no episódio original, sem graça antecipada). **No máximo uma `expiration` por episódio.**

### D7 — Irrepetibilidade por raiz de CNPJ (`benefit_type = 'demo'`)
`DECIDIDO`. Novo valor `demo` no CHECK de `freemium_entitlements.benefit_type`. Elegibilidade = raiz **sem** `onboarding` **e sem** `demo`. `checkDemoEligibility(rootHash)` + `grantDemoEntitlement` (ON CONFLICT DO NOTHING). **Sem conversão** de `onboarding`→`demo`.

### D8 — Transição dos dados legados
`DECIDIDO`. Backfill default (sem expiração retroativa); `bonus_*` intocados; entitlements/transações antigas permanecem histórico. Raiz que já consumiu `onboarding` **não** recebe segunda demo. `update_store_cnpj` (draft→fiscal) concede demo se `approved`+flag+raiz sem benefício; marcador `legacy_pre_f32_onboarding_consumed` só com evidência real. Créditos admin pós-mudança = **bônus** não-expirável.

### D9 — Encerramento do freemium mensal (coordenado com o corte)
`DECIDIDO`. `VENDEO_MONTHLY_CREDITS_ENABLED` default `true` **até o corte**. No corte: cron `/api/cron/monthly-credits` e botão `POST /api/admin/monthly-credits/grant` desativados (`monthlyCreditsEnabled=false`). RPCs mantidas como legado/deprecadas. Rollback **não** reativa o mensal.

### D10 — Notificações in-app + email transacional
`DECIDIDO` (email = Resend; sem Edge Function).
- Módulo server-side `src/lib/email` (Resend API) chamado por cron de envio (outbox), nunca inline.
- Outbox `credit_notifications` com `dedup_key UNIQUE(store_id, kind, dedup_key)`; kinds `demo_granted`/`demo_expiring_24h`/`demo_expired`/`demo_exhausted`/`support_ack`/`support_notice`.
- Envio assíncrono não-bloqueante (demo); `support_ack`/`support_notice` **duráveis/atômicos** com a solicitação.
- Claim atômico (`pending` due OU `processing` com lease vencido → `processing`+lease); máquina de estados `pending → processing → sent|failed|suppressed` (falha retryable → `pending`+`next_attempt_at`; `failed` terminal/dead-letter).
- Supressão: flag off → `suppressed` (**só demo**); janela temporal perdida → `suppressed` (**só demo**); `support_*` **nunca suprimidos**.
- `email_sent_at` = provedor aceitou; `delivered_at` reservado (webhook). Flag `VENDEO_EMAIL_ENABLED` (default false), `RESEND_API_KEY`, `VENDEO_EMAIL_FROM` (default `noreply@vendeo.tech`).
- In-app: badge/bell + lista, marcação de leitura idempotente (`inapp_read_at`).

### D11 — Estados de prazo na UI
`DECIDIDO`. `getDemoStatus(store)` → `active | expiring_soon (≤24h) | exhausted (demo ativa, balance=0) | expired (expires_at <= now()) | none`. Distinção adicional: saldo total insuficiente × bônus/comprado pós-demo. Exibição: `Intl.DateTimeFormat` local + texto relativo. Aplicado em `balance-card`/`balance-display`/`conta`/`dashboard`.

### D12/D22 — Suporte honesto e protocolo
`DECIDIDO`. Remover SLA "24h". Canal `mailto:SUPPORT_EMAIL` complementar. `support_credit_requests` (fonte canônica) com `operation_id UNIQUE`, `protocol`, timestamps `received_at`/`acknowledged_at`/`response_due_at`/`responded_at`/`closed_at`. `POST /api/support/credit-request` idempotente (operationId) grava solicitação + `support_ack` + `support_notice` atomicamente; retorna `protocol`+`receivedAt`; falha de gravação → falha explícita. `response_due_at` NULL até validação jurídica. Reconsideração manual via admin. Meta 5 dias submetida ao advogado.

### D13 — Três documentos legais, reaceite e validação jurídica
`DECIDIDO` (Termos v1.5 + Privacidade v1.4 + Uso Aceitável v1.2).
- Minutas delta em `legal-drafts/`; consolidação (delta + cláusulas inalteradas) + diff na task 10.1; `legal-package.md` preparado cedo.
- Migration **separada** publica as 3 versões (`effective_at` coordenado com o corte).
- **Reaceite em dois mecanismos distintos:** Terms v1.5 + AUP v1.2 (contratuais, por loja) via `requireLegalClearance`/`legal_acceptances`; Privacidade v1.4 (ciência por usuário) via `PrivacyGate`/`privacy_acknowledgements`. Nenhum gate bloqueia histórico/campanhas/downloads.
- **Fornecedor (bloqueante):** cláusula 12.4 sem placeholder; identidade = PJ constituída; mesma identidade na seção "Controlador e Contato".
- Auto-ack obrigatório (cláusula 12.3). **Validação jurídica formal das 3 minutas = gate de corte.**

### D14 — Telemetria de produto
`DECIDIDO`. Tabela `product_events` (append-only, índice único `(event_type, dedup_key)`), escrita via `ProductEventService.record` (best-effort, fail-open). Eventos: `demo_granted` (dedup grant_tx_id), `first_generation` (primeira geração concluída após o grant, dedup grant_tx_id), `demo_exhausted` (dedup deduction_tx_id), `demo_expired` (dedup expiration_tx_id), `support_credit_request` (múltiplo, dedup operationId). `credit_conversion` reservado (não emitido na F50).

### D15 — Fail-closed / fail-open, rollout e rollback
`DECIDIDO`.
- **Fail-closed:** validade/expiração e saldo disponível; `demoCreditsEnabled` default false; `emailEnabled` default false.
- **Fail-open:** telemetria e notificações de demo (best-effort). Exceção: `support_ack`/`support_notice` duráveis.
- **Rollout (8 passos, sem vácuo):** (1) migration estrutural (sem docs legais); (2) deploy demo off + mensal on; (3) validação jurídica das 3 minutas; (4) migration legal (effective_at coordenado); (5) UAT completa (demo habilitada); (6) corte (`monthlyCreditsEnabled=false` → `demoCreditsEnabled=true` → `emailEnabled=true` com `RESEND_API_KEY`/`VENDEO_EMAIL_FROM` validados); (7) reaceite automático; (8) smoke pós-corte.
- **Gates de go-live (bloqueiam o 1º convite, não a conclusão técnica):** PJ identificada; 3 docs aprovados; `publicSignupEnabled=false`; ≤50 controlado; suporte operante; email validado; MFA; buckets privados; backup restaurável.
- **Rollback:** `demoCreditsEnabled=false` congela novas concessões; **não** reativa mensal.

### D16 — Gating da flag nos grants SQL (fronteira explícita)
`DECIDIDO`. `demoCreditsEnabled` é config do Next.js; o banco não vê env vars. Caller/rota lê `getLaunchConfig().demoCreditsEnabled` e passa `p_demo_grant_enabled`. `grant_demo_credits.p_demo_grant_enabled` obrigatório (sem default); wrappers recebem `p_demo_grant_enabled BOOLEAN DEFAULT false` — omitir nunca concede. Decisão dentro da mesma transação que aprova/cria a loja.

### D17 — Operação do beta (fechado, Brasil, ≤50, PJ antes de convite)
`DECIDIDO`. Landing só para solicitação; Brasil (elegibilidade, não geobloqueio); ≤50 (`COUNT DISTINCT email_normalizado` das `approved`); `VENDEO_PUBLIC_SIGNUP_ENABLED=false`; maioridade/autoridade via aceite (sem coleta de nascimento).

### D18 — Solicitação pública de acesso (WhatsApp opcional e aviso)
`DECIDIDO`. WhatsApp opcional/rotulado (só contato sobre a solicitação); sem vínculo ao consentimento de marketing; aviso versionado `privacy_notice_version`; descarte do WhatsApp; anti-enumeração/idempotência preservadas.

### D19 — Imagens, pessoas e menores
`DECIDIDO`. Permitir imagens de adultos/crianças/bebês com direitos/consentimentos + melhor interesse do menor; **sem upload de autorizações**; aviso curto próximo aos uploads; proibir conteúdo ilegal/abusivo/exploratório e dados sensíveis; sanções proporcionais.

### D20 — Privacidade real dos arquivos (hardening do Supabase)
`DECIDIDO`. Tornar privados `store-brand-assets`/`visual-signatures`/`store-logos` (dropar `*_public_read`, `public=false`); migrar consumidores de `getPublicUrl` para `createSignedUrl`; `storage_path` canônico; `asset_url` nullable/deprecated; URL assinada **nunca persistida**; inventariar TODOS os consumidores de `asset_url`/`logo_url`; testar renovação após expiração; sem R2.

### D21 — Conta, retenção e direitos
`DECIDIDO`. Conta ativa sem saldo/atividade (sem exclusão automática); `data_subject_requests` (tipos `access`/`export`/`correction`/`deletion`/`closure`, `protocol`, timestamps); encerramento com janela de 30 dias (transição `received → in_progress` = início da exclusão; cancelamento só em `received`); direitos via suporte; retenção/anonimização de `product_events`/`credit_notifications`/`support_credit_requests` (prazos jurídicos a confirmar).

### D23 — Outbox e cron (plano Vercel real)
`DECIDIDO`. Confirmar plano Vercel; Hobby → cron diário + lookahead 48h ("aproximadamente 24 horas"); Pro → horário + 24h. Confirmação in-app independe do cron. Máquina de estados corrigida (retryable → `pending`+`next_attempt_at`; reclaim por lease vencido). max attempts + backoff + alerta operacional + teste de dois workers.

### D24 — Saldo disponível e autorização (leitura RLS)
`DECIDIDO`. Páginas autenticadas **não** chamam RPC service_role; leitura pura deriva `available` de `demo_expires_at` (sem mutar); RPC `SECURITY DEFINER` acessível a `authenticated` com `auth.uid()` + propriedade da loja aceita. Testes: service_role, authenticated, acesso cruzado negado.

### D26 — Continuidade e backup (gate de convite)
`DECIDIDO`. Supabase mantido; backup externo temporário (dump lógico + objetos de todos os buckets, criptografia, destino externo privado, retenção 30 dias, checksum, teste real de restauração) **antes do primeiro convite**. Rollout bloqueado até evidência de restauração. Segredos/backups fora do Git.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte da verdade OpenSpec
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/proposal.md` — Why/What/Impact, capabilities (10 novas + 19 modificadas), impact.
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/design.md` — D1–D26, "Estado real em código", riscos, migration plan, rollout/corte, open questions.
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/tasks.md` — decomposição 50-01..50-17 (a base propõe 9 waves; o DAG GSD usa 10 waves estritamente crescentes — ver acima).
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-package.md` — pacote jurídico + placeholders + perguntas ao advogado.
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/specs/*/spec.md` — 27 delta specs (ver lista de capabilities abaixo).
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-drafts/*.md` — minutas delta (Terms v1.5 / Privacy v1.4 / AUP v1.2).

### Capacidades (specs) — slugs
**Novas:** `demo-credit-grant`, `credit-expiration`, `credit-notifications`, `demo-status-ui`, `product-events`, `beta-access-request`, `storage-privacy`, `account-retention`, `support-protocol`, `backup-continuity`.
**Modificadas:** `credit-tables`, `credit-sql-functions`, `credit-service`, `freemium-entitlement`, `onboarding-grant`, `monthly-credits-engine`, `monthly-credits-cron`, `launch-config`, `legal-document-versions`, `legal-documents`, `privacy-acknowledgement`, `credit-cta`, `balance-card`, `balance-display`, `conta-page`, `admin-credit-grant`, `admin-user-directory`.

### Código real (âncoras para execução)
- `supabase/migrations/20260716000001_create_credit_tables.sql`, `20260722000002_creditos_mensais_automaticos.sql`, `20260815000001_grant_monthly_credits_por_raiz.sql` — ledger/buckets/mensal.
- `src/lib/credit/**` (credit-service, types, labels, credit-transactions) — serviço/consumidores.
- `src/lib/freemium/**` (entitlement-service, engine) — irrepetibilidade.
- `src/lib/launch-config/config.ts` — flags.
- `src/lib/legal/**` (clearance.ts, legal-document-versions) — reaceite/versões.
- `src/app/api/store/**`, `src/app/api/admin/**`, `src/app/api/cron/monthly-credits/route.ts` — rotas de concessão/cron.
- `src/app/api/campaign/generate-image/route.ts`, `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — consumidores de saldo (gate/reserve/refund).
- `src/components/credit/**` (balance-card, balance-display, credit-cta), `src/components/landing/access-request-form.tsx` — UI.
- `src/lib/store-identity-service.ts`, `src/lib/visual-signature/persistence.ts` — consumidores de `getPublicUrl`.
- `vercel.json` — cron mensal (a estender com `demo-credits`).

### Tracking
- `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md` — F50 registrada no planejamento (2026-09-20).
- `AGENTS.md` — workflow GSD e skills do projeto.

</canonical_refs>

<specifics>
## Specific Ideas

- **Constantes de demonstração (fail-closed):** `demoCreditsEnabled` default `false`; `demoCreditsAmount` default `10`; `demoCreditsTtlHours` default `168`; `emailEnabled` default `false`; `monthlyCreditsEnabled` default `true` (até o corte). Env vars: `VENDEO_DEMO_CREDITS_ENABLED`, `VENDEO_DEMO_CREDITS_AMOUNT`, `VENDEO_DEMO_CREDITS_TTL_HOURS`, `VENDEO_EMAIL_ENABLED`, `VENDEO_EMAIL_FROM`, `RESEND_API_KEY`, `VENDEO_MONTHLY_CREDITS_ENABLED`, `VENDEO_PUBLIC_SIGNUP_ENABLED` (false no beta).
- **Dedup keys:** concessão = `grant_tx_id`; 24h = `demo_expires_at` truncado à hora (nunca só `YYYY-MM-DD`); encerramento = `expiration_tx_id`; esgotamento = `deduction_tx_id`; suporte = `operationId`.
- **Estados de status (getDemoStatus):** `none` (`origin_demo_grant_tx_id IS NULL`); `expired` (grant presente e `expires_at <= now()` ou NULL pós-materialização); `exhausted` (`expires_at > now()` e `balance=0`); `expiring_soon` (`0 < até ≤24h` e `balance>0`); `active` (`>24h` e `balance>0`).
- **Flags legais:** Termos v1.5, Privacidade v1.4, AUP v1.2; `effective_at` coordenado com o corte.
- **Ordem de execução (tasks.md):** trackings/baseline → migration estrutural → RPCs → serviços → rotas → cron/suporte → notificações/telemetria → UI/legal/beta/storage → testes → regressão → verificação/corte (com backup como gate de convite).

</specifics>

<deferred>
## Deferred Ideas

- Checkout/Stripe/preço público/venda de créditos/assinatura/cobrança automática/emissão fiscal/landing-SEO (F51).
- Crédito bônus com prazo excepcional (follow-up).
- Modelagem de lote/parcela (lots) por expiração.
- Migração de storage para Cloudflare/R2.
- Autosserviço completo de direitos de titular.
- Plataforma nova de convites; redesign geral.
- `credit_conversion` (telemetria reservada, não emitida na F50).

</deferred>

<scope_fence>
## Scope Fences (não-mudança)

- **Proibido alterar:** prompts (`prompts/**`), `src/lib/ai/**` (gateway/modelos/adapters), snapshot `campaign_brief_v1`, domínio, contrato de geração (rotas mantêm `402 saldo_insuficiente`), `requireLegalClearance` (mantido). Copy Director e fallback OpenAI intactos.
- **Fora de escopo:** checkout/Stripe/preço público/assinatura/cobrança automática/emissão fiscal/landing-SEO; migração de storage para R2; autosserviço de direitos; plataforma de convites.
- **Bônus sempre não-expirável na F50** (prazo excepcional = follow-up).
- `src/lib/ai/gateway.ts` e contratos de geração **intocados**.
- Tracking/roadmap: atualização normal do GSD **autorizada** (D1/tasks reinterpretado — precedente F49).

</scope_fence>

<risk_summary>
## Risk Summary

| Risco | Mitigação |
|---|---|
| Regressão do ledger sob concorrência (demo→bônus→comprado + expiração) | `SELECT ... FOR UPDATE`; materialização no mesmo lock; testes de concorrência/idempotência (D4/D5) |
| Estorno na borda do prazo + múltiplos estornos | Episódios de graça com `origin_demo_grant_tx_id` + `GREATEST(demo_expires_at, now()+24h)` (D6/D25) |
| Expiração materializada "apagar" telemetria/notificação | `expiration` como evidência durável; reconcilador deriva/repara (D5) |
| Saldo inflado por expiração não materializada | `balance` bruto ≠ disponível; saldo autoritativo + reconcilador (D4/D5) |
| Consumidor lendo `balance` bruto exibir créditos expirados | Inventário global + migração para saldo disponível (D1, 50-01/50-04) |
| Email duplicado / dois workers | Outbox + `dedup_key` + claim/lease + estados (D10) |
| Backlog de email tardio ao ligar a flag | Supressão (flag off / janela perdida — só demo) (D10) |
| `email_sent_at` confundido com entrega | `sent`=aceito; `delivered` exige webhook (reservado) (D10) |
| Ativação antes da validação jurídica / janela de vácuo | Ordem: migration estrutural → deploy (demo off) → validação → migration legal → corte (D13/D15) |
| Loja aprovada sem grant por falha entre chamadas | `p_demo_grant_enabled` obrigatório dentro da RPC atômica (D16) |
| Identificação do fornecedor com placeholder | Bloqueante jurídico (D13) |
| Notificação/telemetria bloqueando geração | Best-effort, fail-open (D10/D14/D15) |
| `expiration` quebrar invariante linear do ledger | `balance_before/after` refletem `balance` bruto; trigger sync (D1/D2) |
| Grant demo duplicado sob corrida | `try_grant_demo_entitlement` ON CONFLICT + idempotency key (D3/D7) |
| Buckets legados públicos | Hardening + URL assinada (D20) |
| Cron horário rejeitado no Hobby | Cron diário + lookahead 48h (D23) |
| Refund pós-expiração inconsistente | Episódios de graça + no máx. uma `expiration` por episódio (D6/D25) |
| Backup inexistente no go-live | Gate de convite: backup restaurável com teste real (D26) |

</risk_summary>

<divergences_resolved>
## Divergências resolvidas

- **D1/tasks × tracking GSD:** `tasks.md`/`design.md` dizem "trackings/roadmap não são atualizados durante a elaboração/execução; a atualização normal no fechamento autorizado segue o workflow do projeto". Interpretado como restrição **apenas** da geração inicial dos artefatos OpenSpec (idêntico ao precedente F49, confirmado pelo usuário em 2026-09-18). O tracking GSD (planejamento/execução/fechamento) é **obrigatório** — e foi explicitamente solicitado pelo usuário nesta fase.
- **Sem divergências substantivas** entre `design.md`/`specs/` e a decomposição de `tasks.md`. A base OpenSpec é autossuficiente e consistente. Âncoras de código (`credit_balances`, `reserve_credit`, consumidores de `balance`, `getPublicUrl`) serão **verificadas em execução** (50-01 baseline), como no precedente F49 — não no planejamento.
- **Research:** dispensado (`research=false`); `proposal.md`/`design.md`/`specs/` são a fonte técnica. `RESEARCH.md`/`VALIDATION.md` (Nyquist) dispensados, conforme precedente F48.1/F49; verificações por tarefa, plan-check, 4 gates e UAT humana **mantidos**.
- **UI-SPEC:** consolidado a partir dos artefatos OpenSpec (`50-UI-SPEC.md`), sem novas decisões de produto, para satisfazer o `ui_safety_gate`.
- **Waves × dependências (corrigido na revisão):** o `tasks.md` decompõe em 9 waves com dependências same-wave (50-02 em wave 1 dependendo de 50-01; 50-14 em wave 9 dependendo de 50-13/50-17). Como waves são paralelizáveis, o DAG GSD foi reordenado para **10 waves estritamente crescentes** (50-16 na wave 3, alinhada ao DAG); 50-10 (legal) foi antecipado para a wave 2 (pacote jurídico preparado cedo); 50-07 (notificações/email) e 50-08 (telemetria) foram para a wave 3 (infraestrutura), com 50-06 (cron) passando a depender de 50-07/50-08; 50-16 passou a depender de 50-10 (eliminando a colisão de edição dos Termos v1.5).
- **Legal não bloqueia a execução técnica (corrigido na revisão):** a identificação definitiva da PJ e a validação jurídica formal são **gates de corte (50-14)** — não pré-requisitos do 50-10 nem das waves 2/3. O 50-10 entrega apenas a preparação técnica (documentos consolidados com placeholders marcados + migration de publicação não aplicada + verificação de reaceite/ciência). A emissão de `demo_granted` na RPC foi explicitada como **INSERT SQL protegido por bloco EXCEPTION** (best-effort, nunca reverte a concessão) com reparo pelo reconciliador (50-06) — o `ProductEventService.record` (TS) é usado pelos callers TypeScript (50-05/50-06), não pela RPC. Checkpoints convertidos para `checkpoint:human-verify`/`checkpoint:human-action` (sintaxe reconhecida pelo executor).
- **Caminhos reais de concessão (corrigido na revisão):** os wrappers SQL (`create_store_with_cnpj`, `update_store_cnpj`, `admin_approve_store_verification`, `admin_exception_store_verification`) são redefinidos na migration (50-03 task 3.8) com `p_demo_grant_enabled`; as rotas reais (`store/route.ts`, `store/update-cnpj/route.ts`, `admin/reviews/[id]/approve/route.ts`, `admin/reviews/[id]/exception/route.ts`) apenas repassam a flag. O 50-14 ganhou a sequência jurídica explícita do corte (identidade da PJ → preenchimento → verificação sem placeholder → aprovação final → publicação) e o 50-17 virou runbook-only (o teste de restauração + gates de go-live migraram para o 50-14, sem bloquear a execução técnica).

</divergences_resolved>

---

*Phase: 50-demonstracao-gratuita-validade-creditos*
*Context gathered: 2026-09-20 via OpenSpec source of truth*
