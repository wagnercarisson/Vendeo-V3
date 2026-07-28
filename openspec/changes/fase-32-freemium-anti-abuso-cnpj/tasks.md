## 1. Migration — Freemium Anti-Abuso CNPJ

- [x] 1.1 Criar `supabase/migrations/20260727000001_freemium_anti_abuso_cnpj.sql`: ALTER TABLE stores (cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia, cnpj_validation_score) + índices parciais + CREATE TABLE freemium_entitlements (store_id UUID REFERENCES stores ON DELETE SET NULL) + índices + RLS
- [x] 1.2 Adicionar RPC `create_store_with_cnpj(p_cnpj_normalized, p_cnpj_root_hash, ...)` na migration: RECEBE cnpj_normalized + cnpj_root_hash (já calculado pela rota Next.js via HMAC-SHA256 com pepper server-side), INSERT store + legal_acceptances + entitlement-first (INSERT ... ON CONFLICT DO NOTHING) + grant-second + monta response com onboardingGranted — NÃO aceita root_hash do caller (service_role only, rota server-side que calcula)
- [x] 1.3 Adicionar RPC `update_store_cnpj(p_store_id, p_cnpj_normalized, p_cnpj_root_hash, ...)` na migration: valida store existe, valida CNPJ não sobrescrito, recebe root_hash já calculado pela rota, atualiza colunas, insere entitlement `onboarding` com `grant_transaction_id=NULL, reason='legacy_pre_f32_onboarding_consumed'` (ON CONFLICT DO NOTHING), retorna dados mascarados (NÃO concede créditos)
- [x] 1.4 Modificar `grant_monthly_credits` (mesma migration): entitlement-aware — lê cnpj_root_hash, INSERT em freemium_entitlements, só concede se INSERT venceu
- [x] 1.5 Publicar versões legais na migration: INSERT legal_document_versions para privacy_policy v1.1 e terms_of_service v1.2
- [x] 1.6 Executar migrations localmente e verificar schema: colunas, constraints, RLS, RPCs compilam, índices únicos

## 2. Core Library — Módulo CNPJ

- [x] 2.1 Criar `src/lib/cnpj/types.ts`: tipos CnpjInput, CnpjOutput, CnpjValidationResult, CnpjValidationScore
- [x] 2.2 Criar `src/lib/cnpj/validate.ts`: `validateCnpj(raw)` — normaliza, valida comprimento=14, checkDigits (algoritmo oficial), isKnownInvalid (sequências), retorna { normalized } ou Error. O root_hash NÃO faz parte do retorno — o hash é calculado apenas na rota server-side (Next.js) via hashCnpjRoot() que usa process.env.CNPJ_PEPPER
- [x] 2.3 Criar `src/lib/cnpj/normalize.ts`: `normalizeCnpj(raw)` — remove tudo que não é dígito
- [x] 2.4 Criar `src/lib/cnpj/hash.ts`: `hashCnpjRoot(root)` — HMAC-SHA256 com pepper de `process.env.CNPJ_PEPPER` (uso restrito: apenas em contexto server-side/teste)
- [x] 2.5 Criar `src/lib/cnpj/mask.ts`: `maskCnpj(normalized)` — retorna `**.***.***/YYYY-**` (primeiros 8 dígitos e verificadores mascarados, sufixo YYYY preservado)
- [x] 2.6 Criar `src/lib/cnpj/similarity.ts`: `compareBusinessName(name, razaoSocial, nomeFantasia?)` — similaridade textual (Levenshtein), retorna score JSONB

## 3. Core Library — Módulo Freemium

- [x] 3.1 Criar `src/lib/freemium/types.ts`: Zod schemas para FreemiumEntitlement, BenefitType, FreemiumHistoryQuery, FreemiumStatus
- [x] 3.2 Criar `src/lib/freemium/entitlement-service.ts`: `checkOnboardingEligibility(rootHash)`, `grantOnboardingEntitlement(storeId, rootHash, txId?)`, `checkMonthlyEligibility(rootHash, cycle)`, `grantMonthlyEntitlement(storeId, rootHash, cycle, txId?)`, `getHistoryByStore(storeId)`, `getHistoryByRoot(rootHash)` — todos usando supabaseAdmin com RPCs auxiliares (INSERT ... ON CONFLICT DO NOTHING)

## 4. Store Route — POST /api/store

- [x] 4.1 Modificar `src/app/api/store/route.ts`: aceitar `cnpj` (obrigatório), `razaoSocial?`, `nomeFantasia?` no body
- [x] 4.2 Adicionar validação de CNPJ via `validateCnpj()` antes de chamar RPC — CNPJ inválido → 400
- [x] 4.3 Verificar duplicidade de `cnpj_normalized` antes da RPC — CNPJ já cadastrado → 409
- [x] 4.4 Substituir chamada de `create_store_with_legal_acceptance` por `create_store_with_cnpj` com `cnpj_normalized` + `cnpj_root_hash` (calculado na rota via hashCnpjRoot, nunca exposto ao client)
- [x] 4.5 Response inclui `cnpjMasked` e `onboardingGranted: boolean`; mensagem informativa quando raiz já usou freemium
- [x] 4.6 Enviar `razaoSocial` e `nomeFantasia` para a RPC para persistência na criação

## 5. Store Identity Form — CNPJ Fields

- [x] 5.1 Modificar `src/components/flow/store-identity-form.tsx`: adicionar campo CNPJ com máscara `XX.XXX.XXX/YYYY-ZZ` (visível apenas em modo criação, required)
- [x] 5.2 Adicionar campos Razão Social e Nome Fantasia (visíveis apenas em modo criação, optional)
- [x] 5.3 Adicionar validação de formato de CNPJ no frontend (feedback imediato)
- [x] 5.4 Enviar cnpj, razaoSocial, nomeFantasia no POST /api/store

## 6. Admin — CNPJ + Freemium Status

- [x] 6.1 Modificar `src/app/(app)/admin/users/[id]/page.tsx`: exibir CNPJ mascarado, badge de status freemium (ativo/usado/esgotado/sem CNPJ), histórico de entitlements
- [x] 6.2 Adicionar botão "Conceder exceção" na página de detalhe — grant manual com reason obrigatório, registra em admin_audit_log (página em `/admin/users/[id]/grant-freemium-exception`)
- [x] 6.3 Modificar `src/app/(app)/admin/users/page.tsx`: adicionar coluna CNPJ mascarado e filtro de status freemium
- [x] 6.4 Estender AdminUserSummary com cnpjMasked e freemiumStatus

## 7. Lojas Legadas — Atualização Cadastral

- [x] 7.1 Criar banner de atualização cadastral no dashboard para lojas com `cnpj_normalized IS NULL`
- [x] 7.2 Criar formulário de atualização cadastral (CNPJ + razão social + nome fantasia) — chama RPC `update_store_cnpj()`
- [x] 7.3 Implementar RPC `update_store_cnpj()`: valida loja existe, CNPJ não sobrescrito, recebe root_hash já calculado pela rota, atualiza colunas, insere entitlement `onboarding` com `grant_transaction_id=NULL, reason='legacy_pre_f32_onboarding_consumed'` (ON CONFLICT DO NOTHING), NÃO concede créditos

## 8. Documentos Legais — v1.2 e v1.1

- [x] 8.1 Criar `public/docs/legal/terms-of-service-v1-2.md`: cláusulas de CNPJ obrigatório, freemium por raiz, sanções, compra permitida
- [x] 8.2 Criar `public/docs/legal/privacy-policy-v1-1.md`: finalidades documentadas do CNPJ, base legal (contrato + legítimo interesse)
- [x] 8.3 Atualizar `document-content.ts`: `privacy_policy` → v1.1, `terms_of_service` → v1.2
- [x] 8.4 Verificar AUP v1.0 cobre novos cenários (não requer nova versão)

## 9. Testes — Validação de CNPJ

- [x] 9.1 Criar `src/lib/cnpj/__tests__/validate.test.ts`: 8 testes — válido com pontuação, válido dígitos, dígitos inválidos, comprimento inválido, sequência conhecida 11, sequência conhecida 00, vazio, letras
- [x] 9.2 Criar `src/lib/cnpj/__tests__/normalize.test.ts`: 2+ testes
- [x] 9.3 Criar `src/lib/cnpj/__tests__/hash.test.ts`: 3 testes — HMAC-SHA256 com pepper, determinístico, muda com pepper diferente
- [x] 9.4 Criar `src/lib/cnpj/__tests__/mask.test.ts`: 2+ testes
- [x] 9.5 Criar `src/lib/cnpj/__tests__/similarity.test.ts`: 2+ testes

## 10. Testes — FreemiumEntitlementService

- [x] 10.1 Criar `src/lib/freemium/__tests__/entitlement-service.test.ts`: 8 testes — checkOnboardingEligibility true/false, grantOnboardingEntitlement idempotente, checkMonthlyEligibility true/false, grantMonthlyEntitlement idempotente, getHistoryByStore, getHistoryByRoot

## 11. Testes — Store Route + Integração

- [x] 11.1 Criar testes de store route: 7+ testes — CNPJ válido → 201 + grant, mesma raiz → 201 sem grant, CNPJ inválido → 400, sem CNPJ → 400, CNPJ duplicado → 409, erro RPC sem store → 500, sequência conhecida → 400
- [x] 11.2 Criar testes de lojas legadas: 5 testes — atualização CNPJ sem grant mas com entitlement inserido, cron ignora sem CNPJ, tentativa sobrescrever CNPJ → 409, CNPJ inválido → 400, store mismatch → 403
- [x] 11.3 Criar testes de integração: 5 testes — onboarding 1x por raiz, monthly 1x por raiz/ciclo, mesmo root em ciclo diferente permite novo monthly, admin exception após raiz usada, delete/recreate mesma raiz não reabre onboarding

## 12. Verificação Final

- [x] 12.1 Executar `npx vitest run src/lib/cnpj/__tests__/` — 17+ testes passando
- [x] 12.2 Executar `npx vitest run src/lib/freemium/__tests__/` — 8+ testes passando
- [x] 12.3 Executar `npm run typecheck` — zero erros
- [x] 12.4 Executar `npm run lint` — zero erros
- [x] 12.5 Executar `npx vitest run` — novos + ~1071 existentes passando
- [x] 12.6 Executar `npm run build` — build bem-sucedido
- [x] 12.7 Verificar: CNPJ não aparece cru em nenhum log, URL, response pública ou client-side
- [x] 12.8 Verificar: Root hash usa HMAC-SHA256 com pepper server-side
- [x] 12.9 Verificar: Exceção admin funciona e fica registrada em admin_audit_log
