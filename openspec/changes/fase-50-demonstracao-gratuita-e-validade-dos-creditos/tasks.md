# Tasks — F50 Demonstração Gratuita e Validade dos Créditos

> Fonte da verdade: `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/` (proposal.md, design.md, specs/). Restrições de execução: **fora de escopo** checkout/Stripe/preço público/assinatura/cobrança automática/emissão fiscal/landing-SEO; **sem** alteração de prompts, gateway de IA, snapshot, domínio ou contrato de geração; bônus é **sempre não-expirável** na F50 (prazo excepcional = follow-up); **loja draft elegível** deve receber a demo quando aprovada. Trackings/roadmap **não** são atualizados durante a elaboração/execução; a atualização normal no **fechamento autorizado** segue o workflow do projeto.

## Decomposição em planos e ondas

| Plan | Wave | Escopo | Decisões |
|------|------|--------|----------|
| 50-01 | 1 | Trackings D1 + baseline/fences + inventário de consumidores de `balance` | D1 |
| 50-02 | 1 | Migration **estrutural** (demo columns/cycle/contrib, tipos, `benefit_type` demo, tabelas) — **sem documentos legais** | D1/D2/D7 |
| 50-03 | 2 | RPCs SQL (`grant_demo_credits`+flag, `materialize_demo_expiration`, `try_grant_demo_entitlement`, rewrite `reserve`/`refund`/`grant`) | D3/D4/D5/D6/D16 |
| 50-04 | 3 | Serviços (`credit-service` disponível/demo, `checkDemoEligibility`, `launch-config`, labels/types, inventário de consumidores) | D4/D7/D9/D15 |
| 50-05 | 4 | Rotas (switch onboarding→demo com flag; `update_store_cnpj` concede demo; mensal preservado até corte) | D3/D8/D9/D16 |
| 50-06 | 5 | Reconcilier cron `demo-credits` (deriva de evidência durável + repara) + endpoint `support/credit-request` | D5/D12/D14 |
| 50-07 | 6 | Notificações (outbox + claim/lease + email Resend) | D10 |
| 50-08 | 6 | Telemetria `product_events` | D14 |
| 50-09 | 7 | UI (status da demo, prazo local/relativo, sem SLA, bell) | D11/D12 |
| 50-10 | 7 | Legal (três documentos + migration de publicação separada + reaceite + fornecedor) | D13 |
| 50-11 | 8 | Testes: unidade + banco/RPC + concorrência + idempotência | — |
| 50-12 | 8 | Testes: integração + rotas + UI + notificações + legal + telemetria | — |
| 50-13 | 9 | Regressão + co-migração + 4 gates | — |
| 50-14 | 9 | Verificação: migration remota, reconciliação, UAT, revisão jurídica, **corte** | D15 |
| 50-15 | 6 | Storage privacy (buckets privados + URL assinada; sem R2) | D20 |
| 50-16 | 7 | Beta/access + retenção (WhatsApp opcional, aviso versionado, maioridade, conta/30 dias, órfãos) | D17/D18/D19/D21 |
| 50-17 | 9 | Backup externo + gates de go-live do beta | D26/D15 |

**Dependências explícitas:** a **regressão** (50-13) roda **depois** de 50-15/50-16; o **rollout/corte** (50-14) roda **depois** de 50-17 (backup restaurado), da **PJ constituída/identificada** e da **validação jurídica formal** das três minutas.

---

## 50-01 — Trackings, baseline e fences (D1)

- [x] 1.1 Registrar o estado inicial do repositório e preservar alterações pré-existentes (sem exigir árvore limpa)
- [x] 1.2 Renumerar trackings: **F50 = Demonstração gratuita e validade dos créditos**; confirmar **Stripe/Monetização fora da numeração** (grep-consistência; zero resíduos F49→F50)
- [x] 1.3 Inventariar consumidores reais de saldo/reserva/estorno/concessão: `generate-image/route.ts`, `generate-without-logo/route.ts`, `create_store_with_cnpj`/`update_store_cnpj`/`admin_approve`/`admin_exception`, `grant_monthly_credits`, `admin_get_users_summary`, `credit-service`
- [x] 1.4 **Inventário global de consumidores de `credit_balances.balance`** (bruto): toda leitura direta de `.from("credit_balances").select("balance")` / `cb.balance` (dashboard, conta, admin users summary, `admin_get_metrics` wallet, `ai-cost/admin-service`, gate de geração) — mapear quais precisam migrar para saldo disponível
- [x] 1.5 Registrar baseline de não-mudança (hashes): `prompts/**`, `src/lib/ai/**`, `src/lib/campaign/**`, snapshot `campaign_brief_v1`, domínio, rotas de geração (contrato 402), `requireLegalClearance`

## 50-02 — Migration estrutural (D1/D2/D7) — SEM v1.5

- [x] 2.1 `credit_balances`: adicionar `demo_balance INTEGER NOT NULL DEFAULT 0 CHECK (demo_balance >= 0)`, `demo_expires_at TIMESTAMPTZ NULL`, `demo_cycle_id UUID NULL` (episódio corrente), `origin_demo_grant_tx_id UUID NULL` (grant original, estável), `demo_contributing_tx_ids UUID[] NOT NULL DEFAULT '{}'`; **CHECK composto**: `demo_balance > 0` implica `demo_expires_at`, `demo_cycle_id` e `origin_demo_grant_tx_id` não nulos; backfill default (sem expiração retroativa)
- [x] 2.2 `credit_transactions`: estender `chk_credit_transactions_type` (9 tipos, +`demo`+`expiration`) e `chk_credit_transactions_amount_sign` (`demo > 0`, `expiration < 0`); trigger imutável preservado
- [x] 2.3 `trg_credit_balances_sync_total`: `balance = demo_balance + bonus_balance + purchased_balance`
- [x] 2.4 `freemium_entitlements`: estender CHECK de `benefit_type` com `demo`; **sem** conversão de `onboarding`→`demo`
- [x] 2.5 Criar tabelas `credit_notifications` (índice único `(store_id, kind, dedup_key)`, colunas de claim/lease: `email_status`, `attempt_count`, `next_attempt_at`, `lease_expires_at`, `last_error`, `provider_message_id`, `email_sent_at`), `product_events` (índice único `(event_type, dedup_key)`), `support_credit_requests` (`operation_id UNIQUE`, `protocol` legível, `store_id`, `user_id`, `requested_email`, snapshots, `status`, `received_at`, `acknowledged_at`, `response_due_at`, `responded_at`, `closed_at`) e `data_subject_requests` (`operation_id UUID UNIQUE`, `protocol` legível, `type` ∈ `access`/`export`/`correction`/`deletion`/`closure`, `user_id`, `store_id`, `contact`, `details`, `status` (∈ `received`/`in_progress`/`completed`/`cancelled`), `requested_at`, `acknowledged_at`, `due_at`, `completed_at`, `cancelled_at`, `closure_requested_at`, `deletion_due_at`, `deletion_inventory`, `legal_hold`) + RLS/grants (service_role escrita/leitura; owner lê os próprios) e índices (`operation_id`, `user_id`, `store_id`)
- [x] 2.6 `access_requests`: adicionar `privacy_notice_version TEXT` (aviso de privacidade apresentado, auditável); preservar anti-enumeração/idempotência (`uq_access_requests_email_active`)
- [x] 2.7 **NÃO publicar documentos legais aqui**; reverter comentado em ordem reversa; migration local aplicada e verificada (Docker/Supabase)

## 50-03 — RPCs SQL (D3/D4/D5/D6/D16)

- [ ] 3.1 `try_grant_demo_entitlement(p_store_id, p_root_hash)` (INSERT ON CONFLICT DO NOTHING, `benefit_type='demo'`)
- [ ] 3.2 `grant_demo_credits(p_store_id, p_root_hash, p_amount, p_demo_grant_enabled BOOLEAN, ...)` — flag **obrigatória, posicionada antes dos parâmetros com DEFAULT** (válida no PostgreSQL); gating interno: `false` → `{ granted:false, reason:'disabled' }`; **checagem de `onboarding` ANTES do INSERT**; grant `p_type='demo'` com `demo_expires_at`/`demo_cycle_id`
- [ ] 3.3 `grant_credits` com `p_type='demo'` — insere tx `demo` (id `G`); define `demo_expires_at`, `demo_cycle_id = G`, `origin_demo_grant_tx_id = G`, `demo_contributing_tx_ids = ARRAY[G]`; incrementa `demo_balance`
- [ ] 3.4 `materialize_demo_expiration(p_store_id)` — atômica/idempotente; escreve `expiration` (`reference=demo_cycle_id`, `metadata = { cycle_id, origin_demo_grant_tx_id, contributing_tx_ids }`); zera **exatamente** `demo_balance`, `demo_expires_at`, `demo_cycle_id`, `demo_contributing_tx_ids` — **`origin_demo_grant_tx_id` NÃO é zerado**
- [ ] 3.5 `reserve_credit` — materializa expiração antes do lock; ordem demo→bônus→comprado; metadata `demo_amount`/`bonus_amount`/`purchased_amount` + snapshot `demo_expires_at` + evidência de esgotamento (`demo_before`/`demo_after`)
- [ ] 3.6 `refund_credit` — **regra temporal**: episódio original válido → restaura sem estender; episódio de graça ativo → `GREATEST(demo_expires_at, now()+24h)`; nenhum episódio ativo (`demo_expires_at <= now()` ou `NULL`) → materializa saldo vencido remanescente (se houver) e abre novo `demo_cycle_id`; **gatilho da graça é só o tempo vencido**; preserva `origin_demo_grant_tx_id` (nunca zerado); **no máximo uma `expiration` por episódio**; acumula `demo_contributing_tx_ids`; bônus/comprado como antes
- [ ] 3.7 REVOKE/GRANT `service_role` nas novas RPCs (paridade F47/F48.1)
- [ ] 3.8 **Redefinir os 4 wrappers SQL de concessão** (`create_store_with_cnpj`, `update_store_cnpj`, `admin_approve_store_verification`, `admin_exception_store_verification`) — dropar a assinatura antiga antes de criar a nova com `p_demo_grant_enabled BOOLEAN DEFAULT false`; substituir `bonus_onboarding` por `grant_demo_credits`; privilégios mínimos (service_role)
- [ ] 3.9 **Neutralizar a concessão legada sem CNPJ** — redefinir `create_store_with_initial_grant`/`admin_create_store_for_user` para **não** conceder créditos na criação administrativa (`admin/stores/route.ts` → `admin_create_store_for_user`); a demo é concedida posteriormente via `update-cnpj` quando aprovado (irrepetibilidade por raiz, substituição do onboarding por demo, exigência de CNPJ, encerramento do freemium contínuo)
- [ ] 3.10 Reaplicar a migration completa via `supabase db reset --local` (banco local descartável) e verificar integralmente as RPCs/estruturas

## 50-04 — Serviços (D4/D7/D9/D15/D24)

- [ ] 4.1 `credit-service.ts`: `getBalance` → saldo disponível **sem materializar** (leitura RLS/`authenticated`); `getBalanceBreakdown` inclui `demoBalance`/`demoExpiresAt`/`availableBalance`
- [ ] 4.2 `credit/types.ts` + `labels.ts`: `demo` ("Demonstração") e `expiration` ("Expiração")
- [ ] 4.3 `freemium/entitlement-service.ts`: `checkDemoEligibility` (ausência de `onboarding` e `demo`) + `grantDemoEntitlement`
- [ ] 4.4 `launch-config/config.ts`: `demoCreditsEnabled`/`demoCreditsAmount`/`demoCreditsTtlHours`/`emailEnabled` (defaults fail-closed); **`monthlyCreditsEnabled` default `true` (preservado até o corte)**
- [ ] 4.5 Migrar os consumidores de `credit_balances.balance` mapeados em 1.4 para saldo disponível
- [ ] 4.6 Novo `src/lib/credit/demo-status.ts` (helper puro `getDemoStatus`) + `formatRelativeExpiry`

## 50-05 — Rotas (D3/D8/D9/D16)

- [ ] 5.1 `create_store_with_cnpj` / `admin_approve_store_verification` / `admin_exception_store_verification`: receber e repassar `p_demo_grant_enabled` (do `getLaunchConfig().demoCreditsEnabled`); substituir `bonus_onboarding` por `grant_demo_credits`
- [ ] 5.2 `update_store_cnpj`: **conceder demo** quando verificação `approved` + flag ativa + raiz sem benefício anterior; **só** criar marcador `legacy_pre_f32_onboarding_consumed` quando houver evidência real de benefício anterior (`bonus_onboarding` na loja ou entitlement `onboarding` na raiz)
- [ ] 5.3 **Manter mensal ativo até o corte** (cron + botão continuam); preparar desligamento coordenado no corte (50-14)
- [ ] 5.4 `generate-image/route.ts` e `generate-without-logo/route.ts`: gate usa saldo disponível (sem mudança de contrato 402); confirmar refunds preservados
- [ ] 5.5 `admin/credits/grant` e `admin/freemium/exception`: semântica de **bônus** não-expirável (labels); remover botão mensal somente no corte
- [ ] 5.6 `admin/stores/route.ts` — criação administrativa sem CNPJ **não** concede créditos (RPC redefinida em 3.8); demo só via `update-cnpj`

## 50-06 — Reconcilier e suporte (D5/D12/D14/D22/D23)

- [ ] 6.1 Criar `GET /api/cron/demo-credits` (CRON_SECRET bearer, middleware passthrough): (a) materializa expirações de contas inativas; (b) **deriva** `demo_granted` (da transação `demo`), `demo_expired` (da `expiration`), `demo_exhausted` (da deduction de esgotamento) e `demo_expiring_24h`, **reparando** outbox/eventos ausentes (dedup por `grant_tx_id`/`expiration_tx_id`/`deduction_tx_id`); (c) dispara envio de email pendente (claim/lease + reclaim por lease vencido)
- [ ] 6.2 Adicionar entrada do cron em `vercel.json` com **cadência conforme o plano Vercel real** (D23): Hobby → **diário** ("aproximadamente 24 horas"); Pro → horária (pré-requisito explícito)
- [ ] 6.3 Criar `POST /api/support/credit-request` — **solicitação durável e idempotente** (por `operationId`) que grava `support_credit_requests` (canônica, com `protocol`/timestamps) + `support_ack` (ao usuário) + `support_notice` (ao suporte) **atomicamente**; **resposta retorna `protocol` + `receivedAt`** (confirmação durável no próprio canal); **se não gravar, falha explicitamente**; telemetria best-effort **separada**
- [ ] 6.4 Criar `GET /api/admin/support-credit-requests` (requireAdmin) + página admin para o suporte consumir/marcar a solicitação (`received`→`forwarded`/`responded`/`closed`) e **reconsiderar manualmente a elegibilidade** (sem sistema formal de recurso)

## 50-07 — Notificações (D10)

- [ ] 7.1 `src/lib/notifications`: escrita de outbox com dedup lógico por `(store_id, kind, dedup_key)`; **notificações de demonstração best-effort**; **`support_ack` e `support_notice` duráveis e atômicos com a solicitação** (exceção)
- [ ] 7.2 `src/lib/email`: serviço Resend gated por `VENDEO_EMAIL_ENABLED`; **claim atômico** (`pending` → `processing` + `lease_expires_at`) com **reclaim por lease vencido**; **máquina de estados** `pending → processing → sent | failed | suppressed` com **falha retryable voltando a `pending` + `next_attempt_at`** (backoff) e **`failed` terminal/dead-letter visível no admin**; `attempt_count`/`max attempts`/`last_error`/`provider_message_id`/`email_sent_at`; **política de supressão** (flag off → `suppressed` **apenas demo**; janela temporal perdida → `suppressed` **apenas demo**; `support_ack`/`support_notice` NUNCA suprimidos — permanecem `pending`/retry, falha permanente visível no admin); `delivered_at` reservado (webhook, fora do escopo)
- [ ] 7.3 Superfície in-app: bell/badge na nav + lista (`/conta`), marcação de leitura idempotente

## 50-08 — Telemetria (D14)

- [ ] 8.1 `src/lib/product-events`: serviço `record` (best-effort, fail-open) com dedup por `(event_type, dedup_key)`
- [ ] 8.2 Emitir `demo_granted` (dedup grant_tx_id), `first_generation` (**primeira geração após o grant**, dedup grant_tx_id), `demo_exhausted` (dedup deduction_tx_id), `demo_expired` (dedup expiration_tx_id), `support_credit_request` (**múltiplo**, dedup operationId)

## 50-09 — UI (D11/D12)

- [ ] 9.1 `balance-card`/`balance-display`: status da demo + prazo (data/hora local + relativo) + saldo disponível; estados ativa/próxima/exaurida/expirada/saldo insuficiente/bônus pós-demo
- [ ] 9.2 `conta/page.tsx` + `dashboard`: seção de demonstração + notificações; usar saldo disponível
- [ ] 9.3 Remover SLA "24h" de `credit-cta`/`balance-card`; manter "solicitar créditos" sem promessa; confirmar ausência de "Comprar/Adquirir créditos"

## 50-10 — Legal (D13) — três documentos

- [ ] 10.1 **Preparar o pacote jurídico cedo (em paralelo à implementação):** montar os documentos consolidados a partir das minutas de alteração (`legal-drafts/terms-of-service-v1-5.md`, `legal-drafts/privacy-policy-v1-4.md`, `legal-drafts/acceptable-use-v1-2.md`), consolidando com as cláusulas inalteradas das versões vigentes (`terms-of-service-v1-4.md`, `privacy-policy-v1-3.md`, `acceptable-use-v1-1.md`) e **comparando (diff)**; publicar em `public/docs/legal/` + catálogo `document-content.ts`; montar o `legal-package.md` (deltas + consolidados + perguntas) para revisão preliminar do advogado
- [ ] 10.2 **Migration de publicação separada** das três versões (`terms_of_service v1.5`, `privacy_policy v1.4`, `acceptable_use v1.2`), após validação jurídica, `effective_at` coordenado com o corte
- [ ] 10.3 Confirmar reaceite **contratual** (Terms v1.5 + AUP v1.2) via `requireLegalClearance` (`legal_acceptances`, gate 403 → `/legal/reaccept`) e **ciência** de privacidade v1.4 via `PrivacyGate`/`privacy_acknowledgements` — ambos sem bloquear histórico/downloads
- [ ] 10.4 **Fornecedor responsável** (identificação/endereço, Decreto 7.962/2013) definido com advogado — **sem placeholder** na cláusula de identificação
- [ ] 10.5 **Confirmação de recebimento (obrigatória):** implementar auto-ack das solicitações de suporte para cumprir a cláusula 12.3 dos Termos (a revisão jurídica pode remover a promessa e o auto-ack em conjunto)
- [ ] 10.6 Registrar **validação jurídica formal das três minutas** (gate de corte)

## 50-11 — Testes: unidade + banco/RPC + concorrência (D1–D8, D16)

- [ ] 11.1 Unidade: `getDemoStatus`, `formatRelativeExpiry`, `checkDemoEligibility`, labels/types, defaults de launch-config
- [ ] 11.2 Banco/RPC: `grant_demo_credits` (grant único, `disabled`, `onboarding_consumed`, `already_granted`, TTL 168h, `demo_cycle_id`); `materialize_demo_expiration` (materializa uma vez, no-op, `expiration` reference/metadata)
- [ ] 11.3 `reserve_credit`: ordem demo→bônus→comprado; demo vencido não consumível; `saldo_insuficiente`; metadata de origem + snapshot + evidência de esgotamento
- [ ] 11.4 `refund_credit`: **regra temporal** — episódio original válido restaura sem estender; episódio de graça ativo `GREATEST(ativo, now()+24h)`; **demo esgotada antes do prazo → prazo passa sem `expiration` → refund abre graça de 24h**; saldo vencido não materializado é materializado antes da graça; `origin_demo_grant_tx_id` preservado; `demo_contributing_tx_ids` acumula; idempotência/duplicidade
- [ ] 11.5 Concorrência: grant demo sob corrida (1 transação); materialização concorrente (1 `expiration`); reserva concorrente (sem saldo negativo)
- [ ] 11.6 Idempotência: concessão, expiração, refund, notificações e eventos por dedup key; **atomicidade solicitação + `support_ack` + `support_notice`** (falha de gravação → endpoint falha, sem afirmar recebimento)
- [ ] 11.7 Wrappers SQL + **criação admin sem CNPJ**: assinatura única/zero assinaturas legadas (incl. `create_store_with_initial_grant`/`admin_create_store_for_user`), privilégios mínimos, fail-closed; `admin_create_store_for_user` cria loja **sem** créditos

## 50-12 — Testes: integração + rotas + UI + notificações + legal + telemetria

- [ ] 12.1 Rotas: `create_store`/`update-cnpj` (demo × onboarding, **loja draft elegível**)/admin approve/exception; **criação admin sem CNPJ → zero créditos**; cron `demo-credits` (CRON_SECRET, derivação/reparo); `support/credit-request`
- [ ] 12.2 Geração: gate 402 usa saldo disponível; reserve/refund preservam contrato; **evidência durável**: `reserve_credit`/reconciliador materializam, a **leitura não materializa**, e `demo_expired` não é suprimido
- [ ] 12.3 UI: estados da demo (incl. **`expired` após materialização** — `demo_expires_at NULL` com `origin_demo_grant_tx_id` setado), prazo local/relativo, sem SLA, sem linguagem de compra
- [ ] 12.4 Notificações: dedup lógico, flag email off/on, **claim/lease (dois workers não duplicam)**, **supressão (flag off / fora de janela — apenas demo)**, **`support_ack`/`support_notice` duráveis/atômicos, nunca suprimidos, retry preservado**, `sent`≠`delivered`, in-app leitura
- [ ] 12.5 Legal: três versões publicadas em migration separada; **reaceite contratual (Terms v1.5 + AUP v1.2) e ciência de privacidade (v1.4) testados separadamente**; histórico/downloads não bloqueados; fornecedor sem placeholder
- [ ] 12.6 Telemetria: eventos com dedup correto (`first_generation` por grant, `support_credit_request` múltiplo), fail-open
- [ ] 12.7 Regressão do ledger: invariantes `balance_before/after` lineares preservadas
- [ ] 12.8 Storage/privacy: buckets `store-brand-assets`/`visual-signatures`/`store-logos` **privados**; consumidores migrados para URL assinada; nenhum `getPublicUrl` em produção
- [ ] 12.9 Saldo/RLS: leitura `authenticated` do saldo disponível sem RPC service_role; acesso cruzado negado; leitura não materializa
- [ ] 12.10 Suporte: protocolo/timestamps (`received_at`/`acknowledged_at`/`response_due_at`/`responded_at`/`closed_at`); confirmação durável com `protocol`+`receivedAt`; reconsideração manual
- [ ] 12.11 Outbox: retry/lease (dois workers), reclaim por lease vencido, `failed` terminal, cron compatível com o plano (diário/horário)
- [ ] 12.12 Refund pós-expiração: novo episódio de graça com `origin_demo_grant_tx_id`, **no máximo uma `expiration` por episódio (zero se esgotado)**, rastreabilidade ao grant
- [ ] 12.13 Beta/access: WhatsApp opcional/rotulado (sem marketing), aviso de privacidade versionado, maioridade/autoridade via aceite (sem nascimento), conta/histórico preservados

## 50-15 — Storage privacy (D20)

- [ ] 15.1 Inventariar buckets (`campaign-images`, `lab-artifacts`, `store-brand-assets`, `visual-signatures`, `store-logos`) com `public`/policies/consumidores
- [ ] 15.2 Tornar **privados** `store-brand-assets`/`visual-signatures`/`store-logos` (dropar `*_public_read`, `public=false`, preservar policies `service_role` + leitura autenticada do owner)
- [ ] 15.3 Migrar consumidores de `getPublicUrl` para `createSignedUrl` (TTL): `store-identity-service.ts`, `visual-signature/persistence.ts`; **inventariar TODOS os consumidores** de `asset_url`/`logo_url` e URLs públicas manuais (types/routes/UI/restore/approve/realign, incl. `store-identity-form.tsx`); tornar `store_visual_signatures.asset_url` **nullable/deprecated** com `storage_path` canônico
- [ ] 15.4 Testar: acesso público negado + URL assinada funcional; **ausência de URLs públicas construídas manualmente**; `asset_url` **nullable/deprecated** com `storage_path` canônico; **renovação de URL assinada após expiração**; fluxos **restore/approve/realign**; **sem** migração para R2

## 50-16 — Beta/access + retenção (D17/D18/D19/D21)

- [ ] 16.1 Landing: manter solicitação de acesso; `publicSignupEnabled=false`; gate operacional do limite de 50 participantes (contagem, sem plataforma de convites)
- [ ] 16.2 `access-request-form.tsx`: rotular WhatsApp como **opcional** + explicar finalidade; exibir aviso de privacidade + links; registrar `privacy_notice_version`
- [ ] 16.3 Maioridade/autoridade via aceite dos Termos (cláusula), sem coleta de data de nascimento
- [ ] 16.4 Aviso curto próximo aos uploads de imagem (direitos/consentimentos/menores), sem checkbox repetido; proibições nos Termos/AUP
- [ ] 16.5 Retenção/anonimização de `product_events`/`credit_notifications`/`support_credit_requests` e descarte do WhatsApp; distinção de uploads temporários/órfãos; janela de 30 dias no encerramento
- [ ] 16.6 `data_subject_requests`: página/endpoint admin (`GET/POST /api/admin/data-subject-requests`, requireAdmin) para gerenciar o ciclo completo do pedido — registrar (`received`), **atualizar para `in_progress`** (que, para `closure`/`deletion`, **marca o início da exclusão**), **cancelar com `cancelled_at` somente enquanto `status = received`** (após `in_progress`, rejeitar a tentativa), **concluir com `completed_at`**, e **auditar (`admin_audit_log`) todas as transições e tentativas de cancelamento** (com `operation_id`/`protocol`/`type`/`user_id`/`store_id`/`contact`/`details`/`deletion_inventory`/`legal_hold`); `due_at` **nullable** até aprovação dos prazos; runbook manual para exportar/excluir/anonimizar (incl. objetos do storage); owner lê os próprios pedidos (RLS)
- [ ] 16.7 Direitos de titular via suporte com protocolo (sem autosserviço)

## 50-17 — Backup externo + gates de go-live (D26/D15)

- [ ] 17.1 Runbook de backup externo: dump lógico + objetos de todos os buckets, criptografia, destino externo privado, retenção 30 dias, checksum; **decisões a fechar**: destino, criptografia/custódia da chave, procedimento/ambiente de restauração
- [ ] 17.2 **Teste real de restauração** (banco + metadados + objetos): contagem de linhas/objetos, checksum e **leitura assinada de um arquivo restaurado** — evidência (gate do primeiro convite)
- [ ] 17.3 Confirmar gates de go-live: PJ constituída/identificada; docs aprovados; signup off; limite controlado; suporte operante; email validado; MFA registrada; buckets privados; backup restaurável
- [ ] 17.4 Segredos/backups fora do Git

## 50-13 — Regressão e co-migração + 4 gates

- [ ] 13.1 Co-migrar fixtures/asserções que consultam saldo/tipos (`credit-service.test.ts`, `monthly-credits.test.ts`, rotas de geração, admin users summary, consumidores de `balance` de 1.4)
- [ ] 13.2 Suíte completa `npx vitest run`
- [ ] 13.3 `npm run typecheck`
- [ ] 13.4 `npm run lint`
- [ ] 13.5 `npm run build`
- [ ] 13.6 Revisar diff contra baseline (sem mudança em prompts/gateway/snapshot/domínio/contrato de geração)

## 50-14 — Verificação, rollout (corte) e gates finais

- [ ] 14.1 Migration **estrutural** remota aplicada e verificada (`db diff --linked` sem divergência em `demo_*`/novas tabelas/RPCs)
- [ ] 14.2 Reconciliação financeira do ledger (soma de `demo`+`bonus`+`purchase` = `balance`; `expiration` compensa `demo`; estornos conferem; `demo_cycle_id`/`contributing_tx_ids` íntegros)
- [ ] 14.3 Validação jurídica formal das **três** minutas registrada (Termos v1.5, Privacidade v1.4, Uso Aceitável v1.2)
- [ ] 14.4 **UAT completa ANTES do corte** (ambiente controlado, demo habilitada) dos estados da demonstração (ativa/próxima/exaurida/expirada/insuficiente/bônus pós-demo) desktop + mobile
- [ ] 14.5 Confirmação de que nenhum fluxo promete compra/cobrança
- [ ] 14.6 **Corte (ordem):** migration de publicação legal (três versões, effective_at) → `monthlyCreditsEnabled=false` → `demoCreditsEnabled=true` → **`emailEnabled=true` com `RESEND_API_KEY`/`VENDEO_EMAIL_FROM` validados**; rollback documentado (congela demo, **não** reativa mensal)
- [ ] 14.7 **Smoke test pós-corte** (produção, **sem** nova concessão artificial) dos estados da demonstração e da ausência de cobrança

## Matriz de testes (resumo)

| Camada | Cobertura | Fonte |
|--------|-----------|-------|
| Unidade | `getDemoStatus`, `formatRelativeExpiry`, `checkDemoEligibility`, labels/types, defaults de launch-config | 11.1 |
| Banco/RPC | `grant_demo_credits` (incl. `disabled`), `materialize_demo_expiration`, `reserve_credit`, `refund_credit` | 11.2–11.4 |
| Concorrência | grant, materialização, reserva | 11.5 |
| Idempotência | concessão, expiração, refund, notificação, eventos | 11.6 |
| Integração/rotas | store creation (draft elegível), update-cnpj, admin, cron (derivação/reparo), support | 12.1 |
| Geração | gate 402 (saldo disponível), reserve/refund, evidência durável | 12.2 |
| UI | estados da demo, prazo, sem SLA/compra | 12.3 |
| Notificações | dedup lógico, email flag, claim/lease, supressão (só demo), `support_ack`/`support_notice` duráveis/não-suprimidos, `sent`≠`delivered`, in-app | 12.4 |
| Legal | três versões em migration separada, reaceite | 12.5 |
| Telemetria | eventos + dedup correto + fail-open | 12.6 |
| Regressão ledger | invariantes lineares | 12.7 |
| Storage/privacy | buckets privados, URL assinada, sem getPublicUrl | 12.8 |
| Saldo/RLS | leitura authenticated sem service_role, acesso cruzado negado | 12.9 |
| Suporte | protocolo/timestamps, confirmação durável, reconsideração | 12.10 |
| Outbox | retry/lease, reclaim, failed terminal, cron do plano | 12.11 |
| Refund pós-expiração | episódios de graça + origin_demo_grant_tx_id | 12.12 |
| Beta/access | WhatsApp opcional, aviso versionado, maioridade, retenção | 12.13 |
| Backup | restauração testada (gate de convite) | 17.2 |
| UAT manual (pré-corte) + smoke (pós-corte) | estados da demonstração | 14.4 / 14.7 |
