# Phase 32: Freemium Anti-Abuso CNPJ - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-32-freemium-anti-abuso-cnpj/`)

<domain>
## Phase Boundary

Trocar a unidade econômica do freemium de `store_id` para **raiz de CNPJ** (8 primeiros dígitos). O modelo atual permite que um mesmo grupo econômico crie N contas com N emails e multiplique o benefício gratuito (10 créditos onboarding + 5 créditos mensais). A F32 resolve isso com validação de CNPJ obrigatório, hash HMAC-SHA256 da raiz com pepper server-side, e tabela de entitlements com idempotência via INSERT ... ON CONFLICT.

**Dependências:** F30 (estrutura legal, reaceite), F24 (credit_transactions), F29.3 (monthly credits cron)
</domain>

<decisions>
## Implementation Decisions

### D1 — Dupla chave: CNPJ completo identifica o estabelecimento, raiz controla o freemium
- `stores.cnpj_normalized` — UNIQUE via índice parcial (`WHERE cnpj_normalized IS NOT NULL`)
- `stores.cnpj_root_hash` = HMAC-SHA256(cnpj_normalized[:8], server_pepper) — indexed
- Mesmo `cnpj_normalized` → bloqueado. Mesmo `cnpj_root_hash` (raiz igual, sufixo diferente) → permitido, sem freemium automático
- Onboarding: `entitlement_key = root_hash || '_onboarding'` — uma vez por raiz
- Mensal: `entitlement_key = root_hash || '_monthly_' || ciclo` — um grant por raiz por ciclo
- Compra de créditos: permitida para qualquer loja/filial cadastrada (sem restrição de raiz)

### D2 — CNPJ na loja: armazenamento e privacidade
- Colunas: `cnpj_normalized TEXT` (nullable, UNIQUE parcial), `cnpj_root_hash TEXT NOT NULL DEFAULT ''`, `razao_social TEXT`, `nome_fantasia TEXT`
- Exibição sempre mascarada: `**.***.***/0001-**`
- Logs: apenas root_hash

### D3 — Entitlement freemium: tabela de controle
- `freemium_entitlements (id, store_id, root_hash, benefit_type, cycle, grant_transaction_id, granted_by, reason, created_at)`
- `store_id` usa `ON DELETE SET NULL` (antifraude — registro permanente)
- Índice único: `(root_hash, benefit_type, COALESCE(cycle, '_nostring_'))`
- Fluxo race-condition free: entitlement-first com INSERT ... ON CONFLICT DO NOTHING

### D4 — Validação de CNPJ: duas camadas
- Frontend: máscara `XX.XXX.XXX/YYYY-ZZ`, feedback imediato
- Backend: validateCnpj() → normaliza, valida comprimento=14, checkDigits, rejeita sequências
- RPC `create_store_with_cnpj` calcula root_hash internamente (service_role) — caller nunca vê o hash

### D5 — Validação cadastral: similaridade textual como score (não bloqueio)
- `compareBusinessName(name, razaoSocial, nomeFantasia?)` — Levenshtein/Jaro-Winkler
- Score registrado em `stores.cnpj_validation_score` (JSONB). Nome ≠ razão social → fluxo normal

### D6 — Onboarding: CNPJ obrigatório, grant condicionado à raiz
- `POST /api/store` body: `{ ..., cnpj, razaoSocial?, nomeFantasia? }`
- RPC `create_store_with_cnpj()` substitui `create_store_with_legal_acceptance()`
- INSERT store + legal_acceptances + entitlement-first → grant-second
- Response: `{ ..., onboardingGranted: boolean, cnpjMasked }`

### D7 — Créditos mensais: condicionados à raiz
- Cron modificado: INSERT freemium_entitlements monthly → se ON CONFLICT não retornar id, pula
- Lojas sem `cnpj_root_hash` (vazio/nulo) são ignoradas

### D8 — Admin: CNPJ mascarado, badge, exceção manual
- `/admin/users/[id]`: CNPJ mascarado, badge status freemium (ativo/usado/esgotado/sem CNPJ), histórico entitlements
- Botão "Conceder exceção" com reason obrigatório + admin_audit_log
- `/admin/users`: coluna CNPJ mascarado + filtro por status freemium

### D9 — Privacidade v1.1 com finalidades do CNPJ
- Finalidades: identificar loja, habilitar freemium, prevenir abuso, cobranças/NF, obrigações legais, suporte/auditoria/segurança
- Base legal: Contrato + legítimo interesse

### D10 — Lojas legadas sem CNPJ: atualização cadastral obrigatória
- Banner "Atualize seus dados cadastrais" no dashboard
- RPC `update_store_cnpj()` — NÃO concede créditos, MAS insere entitlement `onboarding` sem grant (reason='legacy_pre_f32_onboarding_consumed')
- Cron mensal ignora lojas sem CNPJ

### D11 — Termos de Uso v1.2 + reaceite legal
- Cláusulas: CNPJ obrigatório (2.4+), freemium por raiz (seção nova), sanções (seção nova), compra permitida (seção nova)
- Reaceite via fluxo F30: badge no dashboard, pipeline guard
- AUP v1.0 cobre novos cenários (cláusulas 3.2 e 3.5) — sem nova versão

### Non-Goals
- Consulta automática à Receita Federal / API externa — fase futura
- Preenchimento automático de razão social
- Captcha no signup ou criação de loja
- Phone/SMS verification
- Blocklist de domínios de email
- Stripe Checkout / compra de créditos
- Alteração de prompts de IA — CNPJ não entra no pipeline de geração
- Suporte a CPF (MEI sem CNPJ)
</decisions>

<canonical_refs>
## Canonical References

### OpenSpec Change Artifacts (source of truth)
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/proposal.md` — Why, What Changes, Capabilities, Impact
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/design.md` — Architecture decisions D1-D11, Risks, Migration Plan
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/tasks.md` — 12 task groups with 87 items

### Specs
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/cnpj-validation/spec.md` — validateCnpj, hashCnpjRoot, maskCnpj, normalizeCnpj, compareBusinessName
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/freemium-entitlement/spec.md` — freemium_entitlements table, entitlement service, check/grant functions
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/store-ownership-api/spec.md` — POST /api/store with CNPJ, RPC create_store_with_cnpj
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/store-identity-ui/spec.md` — Form fields CNPJ, razão social, nome fantasia
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/admin-cnpj-display/spec.md` — Admin CNPJ masked, freemium badge, exception
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/admin-user-directory/spec.md` — AdminUserSummary ext, user detail page, list filter
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/legacy-store-cnpj-update/spec.md` — Legacy store update, banner, RPC, monthly cron ignore
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/legal-documents-v1-2/spec.md` — Terms v1.2, Privacy v1.1, document-content.ts, re-aceite
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/legal-acceptance-service/spec.md` — Re-aceite flow, getAcceptanceStatus
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/privacy-acknowledgement/spec.md` — Privacy v1.1 publication
- `openspec/changes/fase-32-freemium-anti-abuso-cnpj/specs/transactional-pipeline/spec.md` — Pipeline guard for v1.2 re-aceite

### Prior Phases (dependencies)
- `.planning/phases/30-legal-foundation/30-CONTEXT.md` — Legal clearance service, re-aceite flow, document versions
- `.planning/phases/24-creditos-schema-saldo-transacoes/24-CONTEXT.md` — Credit transactions, grant_credits function
- `.planning/phases/29-3-creditos-mensais-automaticos/29-3-CONTEXT.md` — Monthly credits cron, buckets

### Relevant Source Files
- `src/app/api/store/route.ts` — Store creation route (to be modified)
- `src/components/flow/store-identity-form.tsx` — Store identity form (to be modified)
- `src/app/(app)/admin/users/[id]/page.tsx` — Admin user detail (to be modified)
- `src/app/(app)/admin/users/page.tsx` — Admin user list (to be modified)
- `src/lib/legal/document-content.ts` — Legal document catalog (to be updated)
- `src/lib/legal/clearance.ts` — Legal clearance service (guard for v1.2)
- `public/docs/legal/terms-of-service-v1-1.md` — Current ToS v1.1
- `public/docs/legal/privacy-policy-v1-0.md` — Current Privacy v1.0

### New Files to Create
- `src/lib/cnpj/types.ts`, `validate.ts`, `normalize.ts`, `hash.ts`, `mask.ts`, `similarity.ts`
- `src/lib/freemium/types.ts`, `entitlement-service.ts`
- `supabase/migrations/20260728000001_freemium_anti_abuso_cnpj.sql`
- `public/docs/legal/terms-of-service-v1-2.md`
- `public/docs/legal/privacy-policy-v1-1.md`
</canonical_refs>

<specifics>
## Migration Plan (single SQL)

1. ALTER TABLE stores — adiciona `cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`, `cnpj_validation_score` + índices parciais
2. CREATE TABLE `freemium_entitlements` + índices + RLS
3. CREATE OR REPLACE RPC `create_store_with_cnpj` (substitui `create_store_with_legal_acceptance`)
4. CREATE OR REPLACE RPC `update_store_cnpj`
5. ALTER FUNCTION `grant_monthly_credits` — entitlement-aware
6. INSERT `legal_document_versions` — privacy_policy v1.1 + terms_of_service v1.2

**Rollback:** Reverter migration, restaurar RPC original, remover colunas CNPJ, dropar tabela, reverter versões legais.

### New Modules
- `src/lib/cnpj/`: validate.ts, normalize.ts, hash.ts, mask.ts, similarity.ts, types.ts + testes
- `src/lib/freemium/`: entitlement-service.ts, types.ts + testes

### Test Plan
- Validação CNPJ: 10+ testes (validate, normalize, hash, mask, similarity)
- Entitlement service: 8+ testes (check/grant onboarding/monthly, idempotência, histórico)
- Store route: 7+ testes (CNPJ válido, mesma raiz, inválido, duplicado, filial)
- Lojas legadas: 4+ testes (atualização sem grant, cron ignora, sobrescrita, mesma raiz)
- Integração: 2+ testes (cron 1x por raiz, admin exception, loja deletada+recriada)
</specifics>

<deferred>
## Deferred Ideas
- Consulta automática à Receita Federal / API externa — fase futura
- Preenchimento automático de razão social — depende da consulta externa
- Captcha no signup — mecanismo complementar independente
- Blocklist de domínios de email — mantido como sinal auxiliar
</deferred>

---

*Phase: 32-freemium-anti-abuso-cnpj*
*Context gathered: 2026-07-27 via OpenSpec change artifacts*
