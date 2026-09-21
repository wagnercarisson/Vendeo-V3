## Context

A F50 substitui o freemium contínuo por uma demonstração gratuita limitada e transparente, antes de ampliar aquisição pela landing (F51). Decisões de produto já fechadas no alinhamento (`docs/alinhamento-roadmap-pos-f48-1.md`, seção F50) — **não reabertas aqui**. Este design cobre as decisões técnicas e os quatro pontos aprovados em revisão: (1) notificações in-app + email via Resend com flag `VENDEO_EMAIL_ENABLED`; (2) expiração materializada com **autoridade temporal híbrida** (`demo_expires_at` autoritativo + materialização atômica/idempotente + reconciliador); (3) bônus sempre não-expirável na F50 (prazo excepcional = follow-up); (4) irrepetibilidade via novo `benefit_type = 'demo'`.

**Estado real em código (explorado nesta fase):**

- **Ledger/buckets** (`supabase/migrations/20260716000001_create_credit_tables.sql`, `20260722000002_creditos_mensais_automaticos.sql`): `credit_balances` com `balance = bonus_balance + purchased_balance` (trigger `trg_credit_balances_sync_total`) e `last_monthly_grant_at` (deprecated F32). `credit_transactions` append-only com 7 tipos (`bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase`, `deduction`, `refund`, `adjustment`) e CHECK de sinal por tipo. RPCs atômicas `grant_credits` (p_type), `reserve_credit` (bônus→comprado, metadata `bonus_amount`/`purchased_amount`), `refund_credit` (restaura buckets), `admin_grant_credits` (audit+idempotência).
- **Concessão atual**: onboarding 10 créditos (`bonus_onboarding`) via `create_store_with_cnpj` / `admin_approve_store_verification`; exceção administrativa de verificação 10 créditos (`admin_grant`, bônus não-expirável) via `admin_exception_store_verification`; mensal 5 (`bonus_monthly`) via `grant_monthly_credits` (por raiz, `20260815000001_grant_monthly_credits_por_raiz.sql`). Irrepetibilidade em `freemium_entitlements` (`root_hash, benefit_type, COALESCE(cycle)`), tipos `onboarding/monthly/admin_exception`. Motor `evaluateFreemiumEligibility` (F42).
- **Expiração**: inexistente.
- **Notificações/email**: nenhum email de app (só GoTrue: signup/recovery); nenhuma notificação in-app (só changelog F35 em localStorage). **Não há Edge Function no projeto** — o precedente real é Resend como SMTP do Supabase Auth (`noreply@vendeo.tech`), não uma Edge Function. Suporte = `mailto:SUPPORT_EMAIL`; SLA "até 24h" em `credit-cta.tsx`/`balance-card.tsx`.
- **Legal**: Terms v1.4 / Privacy v1.3 / AUP v1.1; `legal_document_versions` + `legal_acceptances`; reaceite via `requireLegalClearance` (gate 403 nas rotas de geração). `getCurrentVersion()` resolve a versão vigente por `effective_at <= now()`.
- **Telemetria**: `generation_events` (custo IA) + `pipeline-logger`; sem eventos de produto/funil.
- **Cron**: único `GET /api/cron/monthly-credits` (`vercel.json` 06:00 UTC, `CRON_SECRET` bearer, middleware passthrough).
- **Admin**: `admin_get_users_summary` (bonus/purchased), grant form, freemium exception, botão mensal.
- **Consumidores de saldo**: `generate-image/route.ts` (gate `getBalance` → `reserveCredit`; refunds em 4 pontos) e `generate-without-logo/route.ts` (gate + reserve + refund).

## Goals / Non-Goals

**Goals:**
- Bucket de demonstração com validade e tipo de transação próprio (D1/D2/D3)
- Regra autoritativa de saldo disponível + ordem demo→bônus→comprado atômica (D4)
- Expiração efetiva com autoridade híbrida e materialização idempotente (D5)
- Estorno na borda do prazo com episódios de graça rastreáveis (D6/D25)
- Irrepetibilidade da demonstração por raiz de CNPJ (D7)
- Transição dos dados legados sem expiração retroativa e loja draft elegível (D8)
- Encerramento do freemium mensal coordenado com o corte (D9)
- Notificações in-app + email idempotentes e não-bloqueantes, com máquina de estados robusta (D10/D23)
- Estados de prazo na UI com data/hora local + relativo (D11)
- Suporte honesto com protocolo e timestamps (D12/D22)
- Três documentos legais + reaceite + validação jurídica (D13)
- Telemetria de produto para a F51 (D14)
- Fail-closed/fail-open explícitos e rollout/rollback com gates de beta (D15)
- Fronteira de gating da flag nos grants SQL (D16)
- Operação do beta fechado (Brasil, ≤50, PJ antes de convite, maioridade via aceite) (D17)
- Solicitação pública de acesso com WhatsApp opcional e aviso versionado (D18)
- Política de imagens, pessoas e menores (D19)
- Privacidade real dos arquivos (buckets privados) (D20)
- Conta, retenção e direitos do titular (D21)
- Saldo disponível com leitura autorizada por RLS (D24)
- Continuidade e backup externo restaurável (D26)

**Non-Goals:**
- Checkout, Stripe, preço público, venda de créditos, assinatura, cobrança automática, emissão fiscal, landing/SEO (F51)
- Crédito bônus com prazo excepcional (follow-up; todo bônus é não-expirável na F50)
- Modelagem de lote/parcela (lots) por expiração (a graça usa episódios, não lots completos)
- Migração de storage para Cloudflare/R2 nesta fase (hardening do Supabase atual apenas)
- Autosserviço completo de direitos de titular (via suporte com protocolo durante o beta)
- Plataforma nova de convites; redesign geral da experiência; concessões promocionais complexas
- Alteração de prompts, gateway de IA, snapshot, domínio ou contrato de geração

## Decisions

### D1 — Representação dos três buckets

`DECIDIDO` (menor migração: colunas em `credit_balances`; sem tabela de lots)

- `demo_balance INTEGER NOT NULL DEFAULT 0 CHECK (demo_balance >= 0)` — créditos de demonstração, expiráveis.
- `demo_expires_at TIMESTAMPTZ NULL` — instante canônico de expiração (NULL = sem demonstração ativa). **Autoritativo**.
- `demo_cycle_id UUID NULL` — **identificador do episódio corrente** (id da transação `demo` do grant OU do `refund` de graça que abriu o episódio). **Muda a cada episódio de graça**; zera na expiração materializada.
- `origin_demo_grant_tx_id UUID NULL` — **id do grant `demo` original**, estável através de todos os episódios de graça; é a rastreabilidade canônica até a concessão. Também é gravada na metadata das deductions para reconstrução.
- `demo_contributing_tx_ids UUID[] NOT NULL DEFAULT '{}'` — transações contribuintes do saldo do episódio atual (grant + `refund`s de graça). Usadas na metadata da `expiration` (D6).
- `bonus_balance` (não-expirável na F50) e `purchased_balance` (futuro) permanecem.
- `balance` (materializado) passa a `demo_balance + bonus_balance + purchased_balance` via `trg_credit_balances_sync_total` — **mas `balance` NÃO é o saldo disponível**; é a soma bruta para reconciliação linear do ledger. O **saldo disponível** é derivado (D4). **Todo consumidor que lê `balance` diretamente deve migrar para o saldo disponível** (inventário em 50-01/50-04), para não exibir créditos expirados.
- Há no máximo **uma** demonstração por loja/raiz (um único `origin_demo_grant_tx_id`); os **episódios de graça** (D6/D25) reutilizam `demo_cycle_id` por episódio, sem lots.

### D2 — Tipos de transação `demo` e `expiration`

`DECIDIDO`

- `demo` (concessão, `amount > 0`) — incrementa `demo_balance`, define `demo_expires_at`, `demo_cycle_id` e `origin_demo_grant_tx_id`, e inicia `demo_contributing_tx_ids`.
- `expiration` (expiração, `amount < 0`) — materializa o vencimento: `amount = -demo_balance` no momento da expiração, `reference = demo_cycle_id` (episódio), `metadata = { bucket: 'demo', expired_amount, cycle_id, origin_demo_grant_tx_id, contributing_tx_ids }`. Reduz `demo_balance` a 0 e zera `demo_expires_at`/`demo_cycle_id`/`demo_contributing_tx_ids` — **`origin_demo_grant_tx_id` NÃO é zerado**.
- CHECK `chk_credit_transactions_type` passa a 9 tipos; `chk_credit_transactions_amount_sign` inclui `demo > 0` e `expiration < 0`.
- **No máximo uma transação `expiration` por episódio** (não por grant; **zero quando o episódio termina já esgotado**): guard `demo_balance > 0 AND demo_expires_at <= now()` garante idempotência (após materializar, `demo_balance = 0` → re-execução é no-op). A transação `expiration` é a **evidência durável do encerramento** (D5).

### D3 — Concessão da demonstração (RPC `grant_demo_credits`)

`DECIDIDO`

- Nova RPC `public.grant_demo_credits(p_store_id UUID, p_root_hash TEXT, p_amount INTEGER, p_demo_grant_enabled BOOLEAN, p_ttl_hours INTEGER DEFAULT 168, p_idempotency_key TEXT DEFAULT NULL, p_granted_by UUID DEFAULT NULL) RETURNS JSONB`. **`p_demo_grant_enabled` é obrigatório e posicionado ANTES dos parâmetros com DEFAULT** — o PostgreSQL não aceita parâmetro obrigatório depois de parâmetro com default; esta ordem é válida e mantém a flag fail-closed (todo caller decide explicitamente).
- **Gating explícito dentro da operação atômica (D16):** `p_demo_grant_enabled` é passado pelo caller/rota a partir de `getLaunchConfig().demoCreditsEnabled`. Quando `false`, a RPC retorna `{ granted: false, reason: 'disabled' }` **sem** criar entitlement nem transação — evitando loja aprovada sem grant por falha entre duas chamadas (a concessão e a aprovação são uma única transação).
- Fluxo atômico (transação única, `SECURITY DEFINER`, `search_path=''`), **na ordem que impede entitlement `demo` órfão**:
  1. Se `p_demo_grant_enabled = false` → `{ granted: false, reason: 'disabled' }` (nenhum INSERT).
  2. **Elegibilidade raiz (ANTES do INSERT):** se existir entitlement `onboarding` para a raiz → `{ granted: false, reason: 'onboarding_consumed' }` (sem INSERT de `demo`).
  3. **Irrepetibilidade**: `INSERT ... ON CONFLICT DO NOTHING` em `freemium_entitlements (store_id, root_hash, 'demo')` via `try_grant_demo_entitlement`; se retornar NULL (já existe `demo`) → no-op, retorna `{ granted: false, reason: 'already_granted' }`.
  4. **Grant**: `grant_credits(..., p_type='demo')` incrementa `demo_balance`, define `demo_expires_at = now() + make_interval(hours => p_ttl_hours)` e `demo_cycle_id`.
  5. Vincula `grant_transaction_id` no entitlement; auditoria `admin_audit_log` (`credit_grant`, metadata `grant_type='demo'`) quando `p_granted_by` informado.
  6. Emite `product_events.demo_granted` e enfileira notificação de concessão (D10) — **best-effort, não-bloqueante**.
- `demo_expires_at` é computado em UTC (`now()` do banco = UTC) + 168h; exibição local é responsabilidade do client (D11).
- Substitui a concessão `bonus_onboarding` nos pontos: `create_store_with_cnpj` e `admin_approve_store_verification` — ambos recebem `p_demo_grant_enabled` do caller. `update_store_cnpj` **passa a conceder a demo** quando a verificação resulta em `approved`, a flag está ativa e a raiz não tem benefício anterior (D8), e **só** cria o marcador legado quando há evidência real de benefício anterior. **`admin_exception_store_verification` NÃO é convertido** — continua concedendo bônus `admin_grant` não-expirável (ver D8).

### D4 — Regra autoritativa de saldo disponível e ordem de consumo

`DECIDIDO`

- **Saldo disponível** = `demo_ativo + bonus_balance + purchased_balance`, onde `demo_ativo = (demo_expires_at > now()) ? demo_balance : 0`. **`demo_expires_at IS NULL` NUNCA conta como ativo** (NULL = sem demonstração ativa). **Invariante (CHECK):** `demo_balance > 0` implica `demo_expires_at`, `demo_cycle_id` e `origin_demo_grant_tx_id` não nulos.
- **A leitura é PURA (não materializa):** o saldo disponível é derivado de `demo_expires_at` por leitura RLS/`authenticated` (D24), **sem escrever** transação de expiração. A materialização contábil é responsabilidade exclusiva de `reserve_credit` e do **reconciliador**.
- **Ordem de consumo** em `reserve_credit`: demonstração ativa → bônus → comprado. `reserve_credit` **materializa** a expiração pendente (se houver) antes do `SELECT ... FOR UPDATE` (mesmo lock de linha), garantindo que saldo vencido nunca seja consumível.
- **Saldo insuficiente após materialização:** quando a materialização deixa o saldo disponível insuficiente, `reserve_credit` retorna `NULL` em vez de lançar exceção, permitindo confirmar a transação `expiration`; `CreditService.reserveCredit` traduz esse retorno nulo para `saldo_insuficiente`. O contrato externo permanece HTTP 402.
- Metadata da deduction registra a origem exata: `demo_amount`, `bonus_amount`, `purchased_amount` + snapshot `demo_expires_at` (usado no estorno, D6).
- `credit_balances.balance` (bruto) continua sendo a soma materializada; `balance_before/after` das transações preservam a invariante linear.
- **Autorização de leitura (D24):** a leitura do saldo disponível por páginas autenticadas **não** usa RPC exclusiva de service_role — usa leitura RLS (ou RPC `SECURITY DEFINER` com `auth.uid()` + propriedade da loja), derivando `available` de `demo_expires_at` **sem mutar**. A materialização contábil é responsabilidade exclusiva de `reserve_credit`/reconciliador.

### D5 — Expiração efetiva com autoridade temporal híbrida

`DECIDIDO`

- **`demo_expires_at` é a única fonte de verdade de validade** — nunca um estado derivado de cron.
- **Materialização é limpeza idempotente**, não decisão de validade: quando `demo_balance > 0 AND demo_expires_at <= now()`, escrever transação `expiration` (D2) e zerar `demo_balance`/`demo_expires_at`/`demo_cycle_id`/`demo_contributing_tx_ids`. Disparada **somente** por:
  1. `reserve_credit` (antes de consumir — mesma transação, sob `FOR UPDATE`);
  2. **reconciliador** (cron) para contas inativas que não acessam o produto.
- **Leitura NÃO materializa** (D24): páginas autenticadas leem o saldo disponível por RLS sem escrever `expiration`.
- **Evidência durável:** a transação `expiration` é o registro canônico do encerramento, produzida por `reserve_credit`/reconciliador. A telemetria `demo_expired` e a notificação de encerramento são **derivadas da transação `expiration`** (dedup key = `expiration_tx_id`), nunca da existência residual de `demo_balance > 0`. O reconciliador repara outbox/eventos ausentes varrendo transações `expiration` sem notificação/evento correspondente.
- **`demo_exhausted` nasce na transição** `demo_balance > 0 → 0` por consumo (reserva), não do cron: a deduction registra `demo_after = 0` (com `demo_before > 0` e demo ativa) como evidência de esgotamento; a notificação/evento são derivados dessa deduction (dedup key = deduction_tx_id), com o reconciliador reparando ausências.
- **`demo_granted` também é reparável:** a concessão pode gravar a transação `demo` sem conseguir enfileirar a notificação/evento (best-effort). O reconciliador SHALL derivar e reparar a notificação `demo_granted` e o evento `demo_granted` **a partir da transação `demo`** (dedup key = `grant_tx_id`), garantindo que uma falha da outbox no grant não silencie a concessão.
- Atomicidade + idempotência: guard em `demo_balance > 0`; após materializar, re-execução é no-op; sob concorrência, o `SELECT ... FOR UPDATE` na linha de `credit_balances` serializa. A materialização **zera** `demo_balance`/`demo_expires_at`/`demo_cycle_id`/`demo_contributing_tx_ids` — **`origin_demo_grant_tx_id` NÃO é zerado**.
- `reserve_credit` **nunca** usa `balance` bruto; usa `available` pós-materialização.
- Cron reconciliador `GET /api/cron/demo-credits` (**cadência conforme o plano Vercel** — D23: Hobby diário + lookahead 48h "aproximadamente 24 horas"; Pro horário + janela 24h): materializa expirações de contas inativas, deriva `demo_expired`/`demo_exhausted`/`demo_expiring_24h` das transações duráveis e **repara** outbox/eventos ausentes. Tudo idempotente por dedup key.

### D6 — Estorno na borda do prazo (regra temporal)

`DECIDIDO` (revisado — ver D25)

- `refund_credit` passa a ler `metadata.demo_amount`/`bonus_amount`/`purchased_amount` (e o snapshot `demo_expires_at`) da deduction. A decisão é **temporal** (baseada em `demo_expires_at`), **não** em "houve materialização".
- Restauração de `demo_amount > 0` (após `SELECT ... FOR UPDATE` na linha de `credit_balances`):
  1. **Episódio original ainda válido** (`demo_expires_at > now()` e `demo_cycle_id = origin_demo_grant_tx_id`): restaura `demo_amount` no episódio corrente **sem estender** o prazo.
  2. **Episódio de graça ainda ativo** (`demo_expires_at > now()` e `demo_cycle_id != origin_demo_grant_tx_id`): restaura `demo_amount` e aplica `demo_expires_at = GREATEST(demo_expires_at, now() + 24h)`.
  3. **Nenhum episódio ativo** (`demo_expires_at <= now()` **ou** `demo_expires_at IS NULL` — i.e., **tempo vencido**, independentemente de saldo): se houver saldo vencido **não materializado** (`demo_balance > 0 AND demo_expires_at <= now()`), **materializa-o atomicamente primeiro**; depois **abre um novo episódio de graça** (`demo_cycle_id` novo, `demo_expires_at = now() + 24h`), preservando `origin_demo_grant_tx_id`.
- **`origin_demo_grant_tx_id` nunca é zerado pela expiração** — permanece o grant original através de todos os episódios/materializações.
- **No máximo uma `expiration` por episódio** (zero quando o episódio termina já esgotado), idempotência, múltiplos refunds e rastreabilidade até o grant original (`origin_demo_grant_tx_id` + `demo_contributing_tx_ids`).
- **Localização canônica:** `origin_demo_grant_tx_id` é **coluna em `credit_balances`** (estável) **e** gravada na metadata das deductions/refunds para reconstrução.
- **Reserva válida antes do vencimento conclui normalmente**: o gate e o `reserve_credit` usam o estado no instante da reserva; não há cancelamento retroativo.

### D7 — Irrepetibilidade por raiz de CNPJ (`benefit_type = 'demo'`)

`DECIDIDO`

- Novo valor `demo` no CHECK de `freemium_entitlements.benefit_type` (tipos: `onboarding`, `monthly`, `admin_exception`, `demo`).
- **Elegibilidade da demonstração** = raiz **sem** entitlement `onboarding` **e sem** entitlement `demo`.
- `FreemiumEntitlementService.checkDemoEligibility(rootHash)` e `grantDemoEntitlement` (INSERT ON CONFLICT DO NOTHING sobre o índice único `(root_hash, benefit_type, COALESCE(cycle))`).
- **Sem conversão**: registros `onboarding` históricos permanecem como estão (não viram `demo`). A unicidade no banco é garantida pelo índice único + ON CONFLICT; concorrência segura e idempotência seguem o padrão entitlement-first existente.

### D8 — Transição dos dados legados

`DECIDIDO`

- Backfill: `demo_balance = 0`, `demo_expires_at = NULL`, `demo_cycle_id = NULL`, `demo_contributing_tx_ids = '{}'` para todas as lojas (DEFAULT das novas colunas). Saldos `bonus_balance`/`purchased_balance` **intocados**.
- Entitlements e transações `bonus_*` antigos permanecem como histórico (append-only). **Sem expiração retroativa.**
- Concessão pós-vigência para conta antiga sem benefício → demo elegível (D7, ausência de `onboarding` e `demo`).
- Raiz que já consumiu `onboarding` → **não** recebe segunda demo (bloqueada pelo entitlement `onboarding` existente).
- **Loja draft que informa CNPJ depois (`update_store_cnpj`):** quando a verificação resulta em `approved`, a flag está ativa e a raiz não tem benefício anterior, o fluxo **concede a demo** (via `grant_demo_credits`, com `p_demo_grant_enabled`). O marcador legado `legacy_pre_f32_onboarding_consumed` **só** é criado quando há **evidência real de benefício anterior** (a loja já possui transação `bonus_onboarding`, ou a raiz já possui entitlement `onboarding`) — nunca indiscriminadamente. Isso preserva a elegibilidade de contas antigas que nunca receberam benefício.
- Créditos administrativos pós-mudança = **bônus** não-expirável (`admin_grant`/`admin_exception`), sem prazo informativo em metadata.
- **`admin_exception_store_verification` permanece bônus não-expirável** (`admin_grant`, `benefit_type='admin_exception'`): não recebe `p_demo_grant_enabled` nem chama `grant_demo_credits`. Hardening: raiz sintética **por loja** (`admin_exception_no_cnpj:<store_id>`), idempotência (retry não duplica o bônus) e auditoria. A exceção de verificação **conta como benefício gratuito inicial já consumido** — a elegibilidade da demo bloqueia `onboarding` na raiz, `demo` na raiz, `admin_exception` na raiz e `admin_exception` anterior da própria loja (inclusive com raiz sintética), sem afetar concessões administrativas comuns posteriores.

### D9 — Encerramento do freemium mensal (coordenado com o corte)

`DECIDIDO`

- `VENDEO_MONTHLY_CREDITS_ENABLED` **permanece default `true`** até o corte (D15): o deploy não desliga o mensal antes da demo estar ativa. O desligamento ocorre **no corte**, junto com a ativação da demo e a vigência da v1.5.
- No corte: cron `/api/cron/monthly-credits` e botão admin `POST /api/admin/monthly-credits/grant` são desativados (flag `monthlyCreditsEnabled=false`).
- `grant_monthly_credits` e `try_grant_monthly_entitlement` mantidas como legado/deprecadas (rollback estrutural). `bonus_monthly` permanece um tipo histórico válido (não é removido do CHECK). **Rollback de ativação não reativa o mensal** (ele já saiu dos Termos v1.5).

### D10 — Notificações in-app + email transacional

`DECIDIDO` (email = Resend; sem Edge Function)

- **Encaixe de email**: o projeto **não possui Edge Functions**; o precedente real de Resend é como SMTP do GoTrue (`noreply@vendeo.tech`), não uma Edge Function. O encaixe correto e coerente com o stack é um **módulo server-side `src/lib/email`** (Resend API via SDK/HTTP) chamado por um **cron de envio** (outbox), nunca inline no request de concessão/consumo/expiração.
- **Outbox + dedup lógico**: tabela `credit_notifications` (`id, store_id, user_id, kind, dedup_key UNIQUE(store_id, kind, dedup_key), payload, inapp_delivered_at, inapp_read_at, email_status, attempt_count, next_attempt_at, lease_expires_at, last_error, provider_message_id, email_sent_at, created_at`). `dedup_key` impede duplicidade lógica: concessão = grant_tx_id; 24h = **ciclo/instante de expiração** (`demo_expires_at` truncado à hora, nunca só `YYYY-MM-DD`); encerramento = `expiration_tx_id`/`deduction_tx_id`; esgotamento = `deduction_tx_id`.
- **Kinds**: `demo_granted`, `demo_expiring_24h`, `demo_expired`, `demo_exhausted`, `support_ack`, `support_notice`.
- **Envio assíncrono, não-bloqueante e seguro contra duplicidade operacional**: a inserção do registro é best-effort e nunca interrompe grant/consumo/expiração **para as notificações de demonstração**; **`support_ack`/`support_notice` são exceções** — gravados **atomicamente com a solicitação** (duráveis), nunca interrompidos. O destinatário é `payload.recipient_email` (email do usuário no `support_ack`; `SUPPORT_EMAIL` no `support_notice`). O worker de envio faz **claim atômico** (`UPDATE ... WHERE email_status='pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now()) AND (lease_expires_at IS NULL OR lease_expires_at <= now())` com `FOR UPDATE SKIP LOCKED`/linha travada, marcando `processing` + `lease_expires_at`) — dois workers não enviam o mesmo email simultaneamente.
- **Máquina de estados (D23):** `pending → processing → sent | failed | suppressed`, com **falha retryable voltando a `pending` + `next_attempt_at`** (não a `failed`); **`failed` é terminal/dead-letter**; **reclaim de `processing`** quando `lease_expires_at` venceu; `max attempts` + backoff + alerta operacional definidos. **Cadência do cron conforme o plano Vercel real** (Hobby → diário, aviso "aproximadamente 24 horas"; Pro → horária) — ver D23.
- **Política de supressão (sem backlog tardio):** o worker SHALL marcar `suppressed` quando `VENDEO_EMAIL_ENABLED=false` **para notificações de demonstração** (evita que registros acumulados sejam enviados muito depois de a flag ser ligada) e SHALL suprimir mensagens cuja **janela temporal já passou** (ex.: `demo_expiring_24h`). **Exceção:** `support_ack` e `support_notice` NUNCA são suprimidos — permanecem `pending`/retry; **falha permanente fica visível no admin** (dead-letter listável).
- **Semântica de entrega**: `email_sent_at` marca quando o provedor **aceitou** a mensagem (a API aceitar ≠ entregue). `email_delivered_at` só existe se houver **webhook de entrega do provedor** (fora do escopo da F50 — campo reservado/documentado). Não afirmar "entregue" sem webhook.
- **Email**: `VENDEO_EMAIL_ENABLED` (default `false`, fail-closed), `RESEND_API_KEY`, `VENDEO_EMAIL_FROM` (default `noreply@vendeo.tech`); templates próprios; sem envio quando desabilitado (registro permanece `inapp` apenas). **Natureza jurídica**: esses emails são **comunicações operacionais** (marcos do contrato de demonstração), **separadas** do consentimento de marketing (`commercial_communications`) — recomendação a ser validada na revisão jurídica.
- **In-app**: badge/bell na nav + lista de notificações lidas a partir de `credit_notifications`; marcação de leitura idempotente.

### D11 — Estados de prazo na UI

`DECIDIDO`

- `getDemoStatus(store)` → `active` | `expiring_soon` (≤24h) | `exhausted` (demo ativa mas `demo_balance = 0`) | `expired` (`demo_expires_at <= now()`) | `none`.
- Distinções adicionais derivadas: **saldo total insuficiente** (disponível < custo) vs **existência de bônus/comprado após o encerramento da demo**.
- **Exibição**: data/hora **local do usuário** (`Intl.DateTimeFormat` com timezone do client) + texto relativo ("expira em X dias/horas").
- Aplicado em `balance-card`, `balance-display`, `conta` e `dashboard`.

### D12 — Suporte honesto

`DECIDIDO`

- Remover "O time do Vendeo responderá em até 24h" / "Responderemos em até 24h" de `credit-cta.tsx` e `balance-card.tsx`.
- Canal: `mailto:SUPPORT_EMAIL` (existente) **complementar**; nenhuma operação fictícia. Orientação: "Entre em contato com o time do Vendeo para solicitar mais créditos."
- **Registro canônico, protocolo e timestamps (D22):** a solicitação tem **fonte canônica** na tabela `support_credit_requests` (`operation_id UNIQUE`, `protocol` legível, `store_id`, `user_id`, `requested_email`, snapshots de loja/segmento, `status`, e timestamps `received_at`, `acknowledged_at`, `response_due_at`, `responded_at`, `closed_at`), gravada **atomicamente** com o `support_ack` (ao usuário) e o `support_notice` (aviso ao suporte, para `SUPPORT_EMAIL`) na mesma transação. Se qualquer gravação durável falhar, o endpoint **falha explicitamente**. O **time de suporte consome** via superfície admin (`GET /api/admin/support-credit-requests` + página) e pode **reconsiderar manualmente a elegibilidade** (sem sistema formal de recurso, sem revelar regras antifraude).
- **Solicitação durável e idempotente:** `POST /api/support/credit-request` (idempotente por `operationId`) **retorna confirmação durável no próprio canal** com `protocol` + `receivedAt`; o email é confirmação **adicional**. A **telemetria** `support_credit_request` é **best-effort e separada** — nunca bloqueia a solicitação, o auto-ack ou o aviso. O `mailto:` é canal complementar.
- **Confirmação de recebimento (obrigatória):** o auto-ack (`support_ack`) é **gravado atomicamente com a solicitação** e **nunca é suprimido** pela flag de email (permanece `pending`/retry) — para cumprir a promessa da cláusula 12.3 dos Termos ("O recebimento da solicitação será confirmado pelo meio disponível"). **Se não for possível gravar a solicitação + auto-ack de forma durável, o endpoint falha explicitamente** (não afirma ter recebido). A revisão jurídica pode remover a promessa **e** o auto-ack em conjunto; não se publica a promessa sem implementar seu cumprimento.
- **Sem** "Comprar créditos"/"Adquirir créditos" (já ausente; manter).
- Registrar (não implementar sem revisão) a obrigação legal de atendimento eletrônico para revisão jurídica.

### D13 — Três documentos legais, reaceite e validação jurídica

`DECIDIDO` (Termos v1.5 + Privacidade v1.4 + Uso Aceitável v1.2)

- **Três documentos** (mudança substancial, não só os Termos):
  - **Termos de Uso v1.5** — redefine Crédito (unidade interna, sem valor financeiro, intransferível), define Crédito de Demonstração/Bônus/Comprado e Saldo Disponível, explica concessão/elegibilidade/irrepetibilidade/validade (168h)/expiração/ordem de consumo/acesso pós-demo/suporte/ausência de cobrança automática/preservação dos saldos antigos e a janela de graça de 24h no estorno.
  - **Política de Privacidade v1.4** — esclarece o tratamento do email para **comunicações operacionais** (concessão/prazo/esgotamento/expiração/segurança/respostas de suporte) e os **eventos de produto**, distintos do consentimento de marketing (base legal documentada: execução contratual/obrigação legal/legítimo interesse, conforme o caso).
  - **Política de Uso Aceitável v1.2** — substitui a terminologia "freemium" por "demonstração" e alinha as proibições de burla de elegibilidade/validade/expiração e de criação de múltiplas contas/CNPJs para multiplicar benefícios.
- As **minutas de alteração (delta)** vivem em `legal-drafts/` (Termos v1.5, Privacidade v1.4, Uso Aceitável v1.2) — **não são os documentos integrais**: as cláusulas inalteradas da versão anterior permanecem e devem ser consolidadas na montagem. A task 10.1 monta os documentos consolidados e compara (diff) com as versões anteriores. O **pacote jurídico** (`legal-package.md`) — deltas + consolidados + perguntas ao advogado — é preparado **cedo, em paralelo à implementação** (não ao final), para revisão preliminar. Não substituem revisão de advogado.
- Migration **separada** publica as três versões em `legal_document_versions` com `effective_at` coordenado com o corte; conteúdo em `public/docs/legal/` + catálogo `document-content.ts`.
- **Reaceite — dois mecanismos distintos (conforme o código real):**
  - **Termos v1.5 + AUP v1.2** (contratuais, por loja): reaceite via `requireLegalClearance` (`CAPABILITY_DOCUMENTS.content_generation = ["terms_of_service", "acceptable_use"]`, `clearance.ts:11`) — a versão vigente sobe → `getAcceptanceStatus` = `outdated` → gate 403 nas rotas de geração → `/legal/reaccept`. Grava em `legal_acceptances`.
  - **Privacidade v1.4** (ciência por usuário): **não** usa `legal_acceptances`; usa `privacy_acknowledgements` (`privacy_policy_version` por usuário) via `PrivacyGate`/`has_valid_privacy_acknowledgement` (`src/components/legal/privacy-gate.tsx`, montado em `(app)/layout.tsx`) — a versão sobe → gate exibe a ciência de privacidade. Terminologia: **"ciência"** (não "aceite") para privacidade, salvo orientação jurídica diferente.
  - **Garantia transversal:** nenhum dos gates bloqueia histórico, campanhas ou downloads existentes.
  - **Testes:** reaceite dos dois contratos (Terms+AUP) e da ciência de privacidade (v1.4) devem ser cobertos separadamente.
- **Fornecedor responsável (bloqueante jurídico):** a cláusula de identificação (12.4) **não pode ser publicada com placeholders**. O responsável pela oferta é **exclusivamente a PJ constituída** (razão social + CNPJ + endereço profissional), definida com o contador antes do corte — não ocultar nem inventar identificação. **A mesma identidade deve constar (ou ser referenciada inequivocamente) na seção "Controlador e Contato" da Política de Privacidade** — a confirmar com o advogado.
- **Confirmação de recebimento de suporte (obrigatória):** auto-ack **obrigatório** para cumprir a cláusula 12.3 dos Termos (ver D12). A revisão jurídica pode remover a promessa e o auto-ack em conjunto — nunca publicar a promessa sem o cumprimento.
- **Validação jurídica formal das três minutas é gate de corte**, registrada na verificação.

### D14 — Telemetria de produto

`DECIDIDO`

- Tabela `product_events` (`id, store_id, user_id, event_type, dedup_key UNIQUE, properties JSONB, created_at`), append-only, escrita via `ProductEventService.record` (best-effort, fail-open).
- Eventos e **semântica de dedup**:
  - `demo_granted` — na concessão; dedup por `grant_tx_id`.
  - `first_generation` — a **primeira geração concluída com sucesso após o grant da demo**, deduplicada por `grant_tx_id` (não "primeira por loja"); mede ativação pós-demonstração.
  - `demo_exhausted` — transição `demo_balance > 0 → 0` por consumo (dedup por `deduction_tx_id`).
  - `demo_expired` — materialização da expiração (dedup por `expiration_tx_id`).
  - `support_credit_request` — **múltiplas por loja são permitidas**; dedup por `operationId` (UUID por solicitação), nunca deduplicado para sempre por loja.
  - `credit_conversion` reservado, não emitido na F50.
- Identidade/propriedades suficientes para a F51 montar o funil (store_id, user_id, segment, timestamps, valores de saldo/prazo no momento). A F51 é **apenas consumidora**.

### D15 — Fail-closed / fail-open, rollout e rollback

`DECIDIDO`

- **Fail-closed**: validade/expiração e saldo disponível — se `demo_expires_at` estiver presente e no passado, o demo é tratado como indisponível (nunca se concede uso gratuito por falha de leitura); `demoCreditsEnabled` default `false` (concessão só após ativação explícita); `emailEnabled` default `false`.
- **Fail-open**: telemetria e notificações **de demonstração** são best-effort (nunca bloqueiam grant/consumo/expiração). **Exceção:** `support_ack`/`support_notice` são duráveis (gravados atomicamente com a solicitação) e nunca suprimidos.
- **Rollout (ordem corrigida — sem janela de vácuo, com dois momentos de teste):**
  1. **Migration estrutural** (colunas/tipos/RPCs/tabelas; backward-compatível) — **sem** publicar documentos legais.
  2. **Deploy** com demo **desligada** (`demoCreditsEnabled=false`) e **mensal explicitamente preservado** (`monthlyCreditsEnabled` permanece `true`).
  3. **Finalização e validação jurídica formal** das três minutas (registrada).
  4. **Migration separada** publicando `terms_of_service v1.5`, `privacy_policy v1.4` e `acceptable_use v1.2` com `effective_at` coordenado.
  5. **UAT completa** (ambiente controlado, demo habilitada) dos estados da demonstração.
  6. **Corte** (na data de vigência das três versões): vigência → `monthlyCreditsEnabled=false` → `demoCreditsEnabled=true` → **`emailEnabled=true` com `RESEND_API_KEY` e `VENDEO_EMAIL_FROM` validados** (o auto-ack obrigatório exige email operacional ativo no corte).
  7. **Reaceite** automático no próximo acesso às capacidades de geração.
  8. **Smoke test pós-corte** (produção, sem nova concessão artificial).
- **Gates de go-live do beta (bloqueiam o primeiro convite, não a conclusão técnica da fase):** PJ constituída e identificada (sem placeholder); três documentos consolidados e aprovados pelo advogado; `publicSignupEnabled=false` (beta fechado); limite de 50 participantes controlado; suporte operante (formulário + email + protocolo); email configurado e validado; MFA registrada; **buckets auditados e privados** (D20); **backup externo restaurável** (D26).
- **Rollback**: `demoCreditsEnabled=false` congela novas concessões (usuários legados mantêm saldos). **Não** reativa automaticamente o benefício mensal (já removido dos Termos v1.5); a reativação do mensal exigiria reverter também a publicação das versões legais. Reversão de migration documentada (colunas/índices/RPCs), sem perda de dados (append-only preservado).

### D16 — Gating da flag nos grants SQL (fronteira explícita)

`DECIDIDO` (parâmetro explícito dentro da operação atômica)

- `demoCreditsEnabled` é configuração do processo Next.js; o banco não enxerga env vars. Portanto, o caller/rota lê `getLaunchConfig().demoCreditsEnabled` e passa **`p_demo_grant_enabled`** para as RPCs de concessão.
- **Fail-closed**: `grant_demo_credits.p_demo_grant_enabled` é **obrigatório (sem default)**; os wrappers (`create_store_with_cnpj`, `update_store_cnpj`, `admin_approve_store_verification`, `admin_exception_store_verification`) recebem `p_demo_grant_enabled BOOLEAN DEFAULT false` — omitir a flag nunca concede demo.
- A decisão de conceder ou não é tomada **dentro da mesma transação** que aprova/cria a loja — evitando loja aprovada sem grant por falha entre duas chamadas separadas (criação/aprovação em um passo e concessão em outro).

### D17 — Operação do beta (fechado, Brasil, ≤50, PJ antes de convite)

`DECIDIDO` (fonte: roadmap "Operação, conformidade e segurança do beta")

- **Landing pública só para solicitação de acesso**: o beta permanece **fechado**, **restrito ao Brasil** (critério de **elegibilidade**, não geobloqueio por IP) e limitado a **até 50 participantes**. Nenhum convite antes da **constituição da PJ** (gate operacional de lançamento — não cláusula permanente dos Termos).
- **`VENDEO_PUBLIC_SIGNUP_ENABLED` permanece `false`** durante o beta fechado — `/signup` continua fechado; a entrada é via solicitação de acesso revisada (F42).
- **Gate de limite de participantes**: métrica canônica = **`COUNT DISTINCT email_normalizado` das solicitações `approved`** (não "lojas ativas"). Controle operacional do teto de 50, **sem** plataforma nova de convites — o convite é decisão manual do suporte/admin.
- **Maioridade e representação**: o serviço é destinado a representantes de CNPJ/MEI **maiores de 18 anos** e autorizados a agir em nome da empresa. **Sem coletar data de nascimento apenas para isso** — a declaração de idade/autoridade é materializada no **aceite dos Termos** (substituindo a cláusula vigente de maioridade), não num campo de nascimento.

### D18 — Solicitação pública de acesso (WhatsApp opcional e aviso de privacidade)

`DECIDIDO`

- **WhatsApp permanece opcional** no formulário de solicitação de acesso; a UI deve **rotulá-lo explicitamente como opcional** e explicar que será usado **somente para contato sobre a solicitação** (não para marketing).
- **Sem vínculo** do WhatsApp ao consentimento de marketing (`commercial_communications`).
- **Aviso de privacidade + links** para os documentos aplicáveis exibidos no formulário; **registrar de forma auditável a versão do aviso apresentada** (campo próprio em `access_requests`, ex.: `privacy_notice_version`).
- **Descarte do WhatsApp**: quando terminar a necessidade operacional (solicitação concluída/recusada), o dado é removido/anonimizado conforme retenção (D21).
- **Preservar anti-enumeração e idempotência existentes** (`uq_access_requests_email_active`, resposta idêntica novo/duplicado).

### D19 — Imagens, pessoas e menores

`DECIDIDO`

- **Permitir imagens de adultos, crianças e bebês** quando o lojista possuir direitos, consentimentos e autorizações aplicáveis e observar o **melhor interesse do menor**. **Não exigir upload dos documentos de autorização.**
- **Formalização via aceite contratual + aviso curto próximo aos uploads** (não checkbox repetido por imagem): o lojista declara possuir direitos/consentimentos sobre as imagens enviadas.
- **Proibir** conteúdo ilegal, abusivo, exploratório e o envio desnecessário de documentos, listas de clientes ou **dados pessoais/sensíveis**.
- **Papéis**: os documentos formalizam a responsabilidade do lojista pelo conteúdo enviado e pela publicação externa, e os **papéis próprios do Vendeo** como fornecedor e agente de tratamento — **sem cláusula de isenção absoluta**.
- **Sanções proporcionais**: prever bloqueio, remoção e suspensão proporcionais (alinhado às sanções dos Termos/AUP).

### D20 — Privacidade real dos arquivos (hardening do Supabase atual)

`DECIDIDO`

- **Inventário**: `campaign-images` (privado ✓), `lab-artifacts` (privado ✓), `store-brand-assets` (**public**), `visual-signatures` (**public**), `store-logos` (**public**).
- **Correção antes do go-live**: tornar **privados** os buckets que contêm ativos do usuário (`store-brand-assets`, `visual-signatures`, `store-logos`) e **migrar consumidores** de `getPublicUrl` para **URL assinada** ou acesso autenticado. Consumidores conhecidos: `src/lib/store-identity-service.ts:63` (store-brand-assets) e `src/lib/visual-signature/persistence.ts:54` (visual-signatures).
- **URL assinada nunca é persistida como endereço canônico:** `storage_path` é a referência durável; a URL assinada é criada **somente no momento da leitura/geração** e nunca gravada em `asset_url`/`logo_url`. **`store_visual_signatures.asset_url` hoje é `NOT NULL`** → decisão: tornar `asset_url` **nullable/deprecated** e usar `storage_path` como canônico (backfill preserva `asset_url` legado; novas leituras derivam URL no read-time). **Inventariar TODOS os consumidores** de `asset_url`/`logo_url` e das URLs públicas montadas manualmente (`store-identity-form.tsx` e outros) e migrá-los. O **TTL** cobre toda a operação de IA/renderização; **testar renovação** após a expiração da URL.
- **Sem migração de provider** para Cloudflare/R2 nesta fase — é hardening do Supabase atual (não acoplar storage à F50). A abstração/piloto de storage fica para fase posterior (roadmap "Storage").

### D21 — Conta, retenção e direitos

`DECIDIDO`

- **Conta sem créditos, compra, assinatura ou atividade permanece ativa**; **não** apagar automaticamente produtos, imagens, campanhas, histórico ou downloads por inatividade durante o beta.
- **Cancelamento comercial ≠ encerramento de conta** (não há cobrança na F50; a distinção é registrada para o futuro).
- **Encerramento e direitos (procedimento verificável, manual no beta):** registro canônico em **`data_subject_requests`** (tipo ∈ `access`/`export`/`correction`/`deletion`/`closure`, `protocol`, `status`, e timestamps `requested_at`, `acknowledged_at`, `due_at`, `completed_at`), além de `closure_requested_at` e `deletion_due_at` para encerramento. **`support_credit_requests` não serve para pedidos LGPD/encerramento** — é específica de solicitação de créditos. Runbook formalizado para execução manual, com **inventário** do que exportar/excluir/anonimizar, **exclusão dos objetos do storage** e **registro de conclusão**; **cancelamento do encerramento permitido somente antes do início da exclusão** (`status`/`cancelled_at` próprios). Janela de **30 dias** para recuperação/exportação; depois, **excluir/anonimizar**, preservando a retenção legal mínima segregada.
- **Durante o beta**, exportação, correção e exclusão são processadas **pelo suporte com protocolo** — **não prometer autosserviço** ainda.
- **Diferenciar ativos salvos** de **uploads temporários/órfãos** (limpeza técnica própria, documentada).
- **Minimização/retenção/anonimização** de `product_events`, `credit_notifications`, `support_credit_requests` e `data_subject_requests` definidas; **prazos jurídicos a confirmar pelo advogado** (registrados como gate, não codificados).

### D22 — Suporte e protocolo

`DECIDIDO`

- Manter **formulário in-app** e **`suporte@vendeo.tech`**.
- `support_credit_requests` ganha **identificador de protocolo legível** e timestamps: `received_at`, `acknowledged_at`, `response_due_at`, `responded_at`, `closed_at` (além de `status`). **`response_due_at` permanece `NULL`** até a validação jurídica da regra de cinco dias.
- `POST /api/support/credit-request` retorna **confirmação durável no próprio canal** com `protocol` + `receivedAt`; o email é **confirmação adicional** (não a única).
- Manter **idempotência por `operationId`** e **atomicidade** da solicitação + `support_ack` + `support_notice`.
- **Reconsideração manual de elegibilidade via suporte**, sem sistema formal de recurso e sem revelar regras antifraude.
- **Não codificar interpretação de dias úteis/corridos sem validação**; registrar a **meta operacional de primeira resposta útil em até 5 dias** e submetê-la ao advogado (Decreto 7.962/2013).

### D23 — Outbox e cron (plano Vercel real)

`DECIDIDO`

- **Confirmar o plano real da Vercel** antes de definir a cadência. **Se Hobby, não usar cron horário** (não aceito).
- **Beta usa cron diário**, com aviso de prazo **"aproximadamente 24 horas"** (janela segura para a imprecisão de agendamento) — ou registrar **upgrade para Pro como pré-requisito explícito**.
- A **confirmação in-app com protocolo não depende do cron** (é síncrona no `POST`).
- **Máquina de estados corrigida**: falha **retryable** volta a `pending` com `next_attempt_at` (não vai direto a `failed`); `failed` é **terminal/dead-letter**. **Reclaim de `processing`** quando `lease_expires_at` venceu.
- Definir **max attempts**, **backoff**, **alerta operacional** e **teste de dois workers**.
- `support_ack`/`support_notice` **nunca são suprimidos**, mas **falha permanente fica visível no admin** (dead-letter listável).

### D24 — Saldo disponível e autorização (leitura RLS)

`DECIDIDO`

- **Páginas autenticadas NÃO chamam RPC exclusiva de service_role**.
- **Separar leitura pura do saldo disponível da materialização contábil**: a leitura deriva `available` de `demo_expires_at` (sem mutar); `reserve_credit` e o **reconciliador** continuam responsáveis pela materialização autoritativa.
- Alternativa aceita: RPC `SECURITY DEFINER` acessível a `authenticated` com validação explícita de `auth.uid()` e propriedade da loja.
- **Testes**: clientes `service_role`, `authenticated` e **acesso cruzado negado**.

### D25 — Estorno e ciclos da demonstração (regra temporal)

`DECIDIDO`

- **Regra temporal** (não "materializada"): o refund decide por `demo_expires_at`, nunca pela existência de `expiration`. **Episódio original válido → restaura sem estender**; **episódio de graça ativo → restaura + `GREATEST(demo_expires_at, now()+24h)`**; **nenhum episódio ativo (`demo_expires_at <= now()` ou `NULL`) → materializa saldo vencido remanescente (se houver) e abre novo episódio de graça** (`demo_cycle_id` novo, `demo_expires_at = now()+24h`). O gatilho da graça é **somente o tempo vencido**, nunca "esgotado" (uma demo esgotada ainda dentro dos 7 dias restaura no episódio original, sem graça antecipada).
- **`origin_demo_grant_tx_id` nunca é zerado pela expiração** e é a rastreabilidade canônica até o grant.
- **Localização canônica de `origin_demo_grant_tx_id`:** coluna em `credit_balances` **e** metadata obrigatória das deductions/refunds. `demo_cycle_id` = episódio corrente.
- Registrar `demo_cycle_id`/`origin_demo_grant_tx_id` na deduction para reconstrução.
- **No máximo uma `expiration` por episódio** (zero quando o episódio termina já esgotado), idempotência, múltiplos refunds e rastreabilidade até o grant original.
- **Corrigir a assinatura/ordem de parâmetros de `grant_demo_credits`** (D3/D16): flag obrigatória antes dos defaults.

### D26 — Continuidade e backup (gate de convite)

`DECIDIDO`

- **Supabase continua sendo banco, autenticação e storage** da F50/beta. **Sem migração para R2 nesta fase.**
- **Gate e runbook de backup externo temporário antes do primeiro convite**: dump lógico do banco + cópia dos objetos de **todos os buckets**, criptografia, destino externo privado, retenção rotativa de 30 dias, checksum e **teste real de restauração**.
- **Decisões operacionais a fechar antes do primeiro convite:** **destino externo** do backup; **criptografia e custódia da chave**; **procedimento e ambiente de restauração**. O teste de restore cobre **banco + metadados + objetos do storage**, com contagem/checksum e **leitura assinada de um arquivo restaurado**.
- **Segredos e backups não entram no Git.** A fase pode ser tecnicamente concluída antes do convite, mas o **rollout permanece bloqueado** até existir evidência de restauração.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Regressão do ledger sob concorrência (demo→bônus→comprado + expiração) | `SELECT ... FOR UPDATE` em `credit_balances`; materialização dentro do mesmo lock; testes de concorrência/idempotência (D4/D5) |
| Estorno na borda do prazo (demo já vencido) + múltiplos estornos | Episódios de graça com `origin_demo_grant_tx_id` + `GREATEST(demo_expires_at, now()+24h)` (D6/D25) |
| Expiração materializada por reserve/reconciliador "apagar" telemetria/notificação | Transação `expiration` como evidência durável; reconcilador deriva/repara outbox+eventos (D5) |
| Saldo inflado por expiração não materializada | `balance` bruto NÃO é o disponível; saldo disponível autoritativo derivado de `demo_expires_at` + reconcilador (D4/D5) |
| Consumidor lendo `balance` bruto exibir créditos expirados | Inventário global de consumidores de `credit_balances.balance` e migração para saldo disponível (D1, 50-01/50-04) |
| Email duplicado / enviado por dois workers | Outbox com `dedup_key` + claim atômico/lease + estados `processing/sent/failed/suppressed` (D10) |
| Backlog de email enviado tardiamente ao ligar a flag | Política de supressão: flag off → `suppressed`; janela temporal perdida → `suppressed` (D10) |
| `email_sent_at` confundido com entrega | `sent` = provedor aceitou; `delivered` exige webhook (reservado) (D10) |
| Ativação antes da validação jurídica / janela de vácuo (mensal parado, demo não ativa) | Ordem: migration estrutural → deploy (demo off, mensal on) → validação das três minutas → migration legal → corte (D13/D15) |
| Loja aprovada sem grant por falha entre chamadas | `p_demo_grant_enabled` obrigatório dentro da RPC atômica (D16) |
| Identificação do fornecedor publicada com placeholder | Bloqueante jurídico: definição do responsável com advogado antes do corte (D13) |
| Notificação/telemetria bloqueando geração | Best-effort, fail-open; nunca no caminho crítico (D10/D14/D15) |
| Nova superfície de notificação poluir a UI | Escopo mínimo: bell/badge + lista; sem redesign (D10) |
| `expiration` quebrar a invariante linear do ledger | `balance_before/after` refletem `balance` bruto; `expiration` reduz `demo_balance` e `balance` juntos via trigger de sync (D1/D2) |
| Grant demo duplicado sob corrida | `try_grant_demo_entitlement` ON CONFLICT (entitlement-first) + idempotency key (D3/D7) |
| Buckets legados públicos expondo ativos do lojista | Hardening: tornar privados `store-brand-assets`/`visual-signatures`/`store-logos` + URL assinada (D20) |
| Cron horário rejeitado no plano Vercel Hobby | Usar cron diário ("aproximadamente 24 horas") ou Pro como pré-requisito (D23) |
| Retenção/exclusão de dados fora da base legal | Prazos submetidos ao advogado; retenção mínima segregada; sem autosserviço no beta (D21) |
| Refund pós-expiração inconsistente | Episódios de graça com `origin_demo_grant_tx_id`, no máximo uma `expiration` por episódio (D6/D25) |
| Backup inexistente no go-live | Gate de convite: backup externo restaurável com teste real (D26) |

## Migration Plan

- **Migration estrutural (uma migration, timestamp da fase):** ALTER `credit_balances` (+`demo_balance`, +`demo_expires_at`, +`demo_cycle_id`, +`origin_demo_grant_tx_id`, +`demo_contributing_tx_ids`), ALTER `credit_transactions` (dropar/recriar CHECK type + amount_sign com `demo`/`expiration`; trigger imutável dropado temporariamente apenas se necessário — backfill de tipos **não** é necessário), ALTER `freemium_entitlements` (CHECK +`demo`), novas RPCs `try_grant_demo_entitlement`, `grant_demo_credits`, `materialize_demo_expiration`, reescrita `reserve_credit`/`refund_credit`/`grant_credits` (bucket demo + ordem + episódios de graça + `origin_demo_grant_tx_id`), novas tabelas `credit_notifications`, `product_events`, `support_credit_requests` (com `protocol`/timestamps) e `data_subject_requests` (encerramento/direitos) (RLS/grants + índices únicos de dedup). **Não publica documentos legais.** Revert comentado em ordem reversa.
- **Migration de privacidade de buckets (hardening):** tornar privados `store-brand-assets`, `visual-signatures` e `store-logos` (dropar policy `*_public_read`, `public=false`), migrando consumidores de `getPublicUrl` para URL assinada/autenticada (D20). **Sem** migração de provider (R2 fica fora desta fase).
- **Migration de publicação legal (separada):** `legal_document_versions` para **três documentos** — `terms_of_service v1.5`, `privacy_policy v1.4`, `acceptable_use v1.2` — com `effective_at` coordenado — executada somente após a validação jurídica formal, no passo imediatamente anterior ao corte.
- **Deploy**: backend/frontend juntos (Vercel); `demoCreditsEnabled=false`, `emailEnabled=false`, `monthlyCreditsEnabled=true` (preservado), `publicSignupEnabled=false` até o corte.
- **Ordem de ativação (sem janela de vácuo, com dois momentos de teste):** migration estrutural local → verificação → migration estrutural remota → migration de privacidade de buckets → deploy (demo off, mensal on) → validação jurídica formal das três minutas → migration de publicação legal → **UAT completa** (ambiente controlado, demo habilitada) → **corte** (`monthlyCreditsEnabled=false` + `demoCreditsEnabled=true` + **`emailEnabled=true` com credenciais/remetente validados**, na vigência das três versões) → **smoke test pós-corte** (sem nova concessão artificial em produção) → rollback possível (congela demo, não reativa mensal).
- **Backup externo temporário (gate de convite, D26):** runbook + execução **antes do primeiro convite** — dump lógico do banco + objetos de todos os buckets, criptografia, destino externo privado, retenção rotativa 30 dias, checksum e **teste de restauração**; segredos/backups fora do Git.
- **Reconciliador**: cron `demo-credits` (`CRON_SECRET`, middleware passthrough) **adicionado** a `vercel.json`; o cron mensal é desativado no corte. **Cadência conforme o plano Vercel** (D23): Hobby → diário ("aproximadamente 24 horas"); Pro → horária.

## Open Questions

- **Bloqueantes de go-live (não de conclusão técnica):** constituição da **PJ** e identificação/endereço do fornecedor (Decreto nº 7.962/2013); validação jurídica formal das três minutas; confirmação da aplicação do Decreto 7.962/2013 (confirmação imediata + resposta em até 5 dias); **prazos jurídicos de retenção/anonimização** de `product_events`/`credit_notifications`/`support_credit_requests` e do WhatsApp — a confirmar pelo advogado.
- **Plano Vercel (confirmar antes da execução):** se Hobby, usar cron **diário** (não horário) com aviso "aproximadamente 24 horas"; Pro como pré-requisito para horária.
- **Natureza jurídica do email:** confirmar na revisão jurídica que as mensagens de demonstração são comunicações **operacionais** (não de marketing), separadas do consentimento `commercial_communications`, com base legal documentada (LGPD).
- **Itens de execução (não-bloqueantes):** redação final das mensagens de notificação e das três minutas (sujeita à validação jurídica); provedor/remetente final do email (Resend, `noreply@vendeo.tech` default); localização dos componentes de notificação (`src/components/notifications/`) e de email (`src/lib/email/`); inventário global de consumidores de `credit_balances.balance` (D1).

## Anexo A — Minutas de alteração (delta) dos documentos legais

As minutas de **alteração** (delta sobre as versões vigentes) vivem em três arquivos próprios dentro deste change:

- `legal-drafts/terms-of-service-v1-5.md` — Termos de Uso v1.5 (definições, seções 1/3/5/6/8/9/10/11/12, diff v1.4→v1.5).
- `legal-drafts/privacy-policy-v1-4.md` — Política de Privacidade v1.4 (cláusulas 3.5 operacional + 3.6 eventos de produto, diff v1.3→v1.4).
- `legal-drafts/acceptable-use-v1-2.md` — Política de Uso Aceitável v1.2 (cláusulas 4.2/4.5/7.2, diff v1.1→v1.2).

**Não são documentos integrais**: as cláusulas inalteradas da versão anterior permanecem. A task 10.1 **monta os documentos consolidados** (delta + cláusulas inalteradas) e **compara** com a versão anterior, produzindo o texto pronto para publicação.

**Placeholders permitidos (marcação inequívoca, `[ … ]`):** apenas `[DATA DO CORTE]`, `[DATA E HORA DO CORTE]` e a identificação da **PJ** (`[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO FÍSICO]`) — todos nos Termos v1.5. A cláusula 12.4 **não pode ser publicada com placeholders** (Decreto nº 7.962/2013); a mesma identidade deve constar na seção "Controlador e Contato" da Privacidade. Nenhum outro placeholder é permitido; cada arquivo traz a tabela de correspondência (diff) com a versão anterior.
