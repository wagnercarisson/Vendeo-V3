## 1. Migration — Freemium Anti-Abuso CNPJ

- [ ] 1.1 Criar `supabase/migrations/20260728000001_freemium_anti_abuso_cnpj.sql`: ALTER TABLE stores (cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia, cnpj_validation_score) + índices parciais + CREATE TABLE freemium_entitlements (store_id UUID REFERENCES stores ON DELETE SET NULL) + índices + RLS
- [ ] 1.2 Adicionar RPC `create_store_with_cnpj(p_cnpj_normalized, ...)` na migration: RECEBE cnpj_normalized (já validado), calcula cnpj_root_hash internamente via HMAC-SHA256(pepper), INSERT store + legal_acceptances + entitlement-first (INSERT ... ON CONFLICT DO NOTHING) + grant-second + monta response com onboardingGranted — NÃO aceita root_hash do caller (service_role only)
- [ ] 1.3 Adicionar RPC `update_store_cnpj(p_cnpj_normalized, ...)` na migration: valida store existe, valida CNPJ não sobrescrito, calcula root_hash internamente, atualiza colunas, insere entitlement `onboarding` com `grant_transaction_id=NULL, reason='legacy_pre_f32_onboarding_consumed'` (ON CONFLICT DO NOTHING), retorna dados mascarados (NÃO concede créditos)
- [ ] 1.4 Modificar `grant_monthly_credits` (mesma migration): entitlement-aware — lê cnpj_root_hash, INSERT em freemium_entitlements, só concede se INSERT venceu
- [ ] 1.5 Publicar versões legais na migration: INSERT legal_document_versions para privacy_policy v1.1 e terms_of_service v1.2
- [ ] 1.6 Executar migrations localmente e verificar schema: colunas, constraints, RLS, RPCs compilam, índices únicos

## 2. Core Library — Módulo CNPJ

- [ ] 2.1 Criar `src/lib/cnpj/types.ts`: tipos CnpjInput, CnpjOutput, CnpjValidationResult, CnpjValidationScore
- [ ] 2.2 Criar `src/lib/cnpj/validate.ts`: `validateCnpj(raw)` — normaliza, valida comprimento=14, checkDigits (algoritmo oficial), isKnownInvalid (sequências), retorna { normalized } ou Error. O root_hash NÃO faz parte do retorno — o hash é calculado apenas dentro da RPC (service_role) ou via hashCnpjRoot() em contexto de servidor/teste
- [ ] 2.3 Criar `src/lib/cnpj/normalize.ts`: `normalizeCnpj(raw)` — remove tudo que não é dígito
- [ ] 2.4 Criar `src/lib/cnpj/hash.ts`: `hashCnpjRoot(root)` — HMAC-SHA256 com pepper de `process.env.CNPJ_PEPPER`
- [ ] 2.5 Criar `src/lib/cnpj/mask.ts`: `maskCnpj(normalized)` — retorna `**.***.***/YYYY-**` (primeiros 8 dígitos e verificadores mascarados, sufixo YYYY preservado)
- [ ] 2.6 Criar `src/lib/cnpj/similarity.ts`: `compareBusinessName(name, razaoSocial, nomeFantasia?)` — similaridade textual (Levenshtein/Jaro-Winkler), retorna score JSONB

## 3. Core Library — Módulo Freemium

- [ ] 3.1 Criar `src/lib/freemium/types.ts`: Zod schemas para FreemiumEntitlement, BenefitType, FreemiumHistoryQuery
- [ ] 3.2 Criar `src/lib/freemium/entitlement-service.ts`: `checkOnboardingEligibility(rootHash)`, `grantOnboardingEntitlement(storeId, rootHash, txId?)`, `checkMonthlyEligibility(rootHash, cycle)`, `grantMonthlyEntitlement(storeId, rootHash, cycle, txId?)`, `getHistoryByStore(storeId)`, `getHistoryByRoot(rootHash)` — todos usando supabaseAdmin com INSERT ... ON CONFLICT DO NOTHING

## 4. Store Route — POST /api/store

- [ ] 4.1 Modificar `src/app/api/store/route.ts`: aceitar `cnpj` (obrigatório), `razaoSocial?`, `nomeFantasia?` no body
- [ ] 4.2 Adicionar validação de CNPJ via `validateCnpj()` antes de chamar RPC — CNPJ inválido → 400
- [ ] 4.3 Verificar duplicidade de `cnpj_normalized` antes da RPC — CNPJ já cadastrado → 409
- [ ] 4.4 Substituir chamada de `create_store_with_legal_acceptance` por `create_store_with_cnpj` com apenas `cnpj_normalized` — NÃO passar `cnpj_root_hash` (a RPC calcula internamente)
- [ ] 4.5 Response inclui `cnpjMasked` e `onboardingGranted: boolean`; mensagem informativa quando raiz já usou freemium

## 5. Store Identity Form — CNPJ Fields

- [ ] 5.1 Modificar `src/components/flow/store-identity-form.tsx`: adicionar campo CNPJ com máscara `XX.XXX.XXX/YYYY-ZZ` (visível apenas em modo criação, required)
- [ ] 5.2 Adicionar campos Razão Social e Nome Fantasia (visíveis apenas em modo criação, optional)
- [ ] 5.3 Adicionar validação de formato de CNPJ no frontend (feedback imediato)
- [ ] 5.4 Enviar cnpj, razaoSocial, nomeFantasia no POST /api/store

## 6. Admin — CNPJ + Freemium Status

- [ ] 6.1 Modificar `src/app/(app)/admin/users/[id]/page.tsx`: exibir CNPJ mascarado, badge de status freemium (ativo/usado/esgotado/sem CNPJ), histórico de entitlements
- [ ] 6.2 Adicionar botão "Conceder exceção" na página de detalhe — grant manual com reason obrigatório, registra em admin_audit_log
- [ ] 6.3 Modificar `src/app/(app)/admin/users/page.tsx`: adicionar coluna CNPJ mascarado e filtro de status freemium
- [ ] 6.4 Estender AdminUserSummary com cnpjMasked e freemiumStatus

## 7. Lojas Legadas — Atualização Cadastral

- [ ] 7.1 Criar banner de atualização cadastral no dashboard para lojas com `cnpj_normalized IS NULL`
- [ ] 7.2 Criar formulário de atualização cadastral (CNPJ + razão social + nome fantasia) — chama RPC `update_store_cnpj()`
- [ ] 7.3 Implementar RPC `update_store_cnpj()`: valida loja existe, CNPJ não sobrescrito, calcula root_hash internamente, atualiza colunas, insere entitlement `onboarding` com `grant_transaction_id=NULL, reason='legacy_pre_f32_onboarding_consumed'` (ON CONFLICT DO NOTHING), NÃO concede créditos

## 8. Documentos Legais — v1.2 e v1.1

- [ ] 8.1 Criar `public/docs/legal/terms-of-service-v1-2.md`: cláusulas de CNPJ obrigatório, freemium por raiz, sanções, compra permitida
- [ ] 8.2 Criar `public/docs/legal/privacy-policy-v1-1.md`: finalidades documentadas do CNPJ, base legal (contrato + legítimo interesse)
- [ ] 8.3 Atualizar `document-content.ts`: `privacy_policy` → v1.1, `terms_of_service` → v1.2
- [ ] 8.4 Verificar AUP v1.0 cobre novos cenários (não requer nova versão)

## 9. Testes — Validação de CNPJ

- [ ] 9.1 Criar `src/lib/cnpj/__tests__/validate.test.ts`: 7+ testes — válido com pontuação, válido dígitos, dígitos inválidos, comprimento inválido, sequência conhecida, vazio, letras
- [ ] 9.2 Criar `src/lib/cnpj/__tests__/normalize.test.ts`: 2+ testes
- [ ] 9.3 Criar `src/lib/cnpj/__tests__/hash.test.ts`: 2+ testes — HMAC-SHA256 com pepper, root_hash calculado corretamente a partir da raiz
- [ ] 9.4 Criar `src/lib/cnpj/__tests__/mask.test.ts`: 2+ testes
- [ ] 9.5 Criar `src/lib/cnpj/__tests__/similarity.test.ts`: 2+ testes

## 10. Testes — FreemiumEntitlementService

- [ ] 10.1 Criar `src/lib/freemium/__tests__/entitlement-service.test.ts`: 8+ testes — checkOnboardingEligibility true/false, grantOnboardingEntitlement idempotente, checkMonthlyEligibility true/false, grantMonthlyEntitlement idempotente, getHistoryByStore, getHistoryByRoot

## 11. Testes — Store Route + Integração

- [ ] 11.1 Criar testes de store route: 7+ testes — CNPJ válido → 201 + grant, mesma raiz → 201 sem grant, CNPJ inválido → 400, sem CNPJ → 400, CNPJ duplicado → 409, filial → 201 sem grant, mesmo CNPJ outro user → 409
- [ ] 11.2 Criar testes de lojas legadas: 4+ testes — atualização CNPJ sem grant mas com entitlement inserido, cron ignora sem CNPJ, tentativa sobrescrever CNPJ, mesma raiz em duas lojas legacy diferentes
- [ ] 11.3 Criar testes de integração: cron mensal 1x por raiz (3 filiais + 1 matriz = 1 grant), admin exception bypassa verificação, loja deletada + recriada mesma raiz → sem novo onboarding (antifraude ON DELETE SET NULL)

## 12. Verificação Final

- [ ] 12.1 Executar `npx vitest run src/lib/cnpj/__tests__/` — 10+ testes passando
- [ ] 12.2 Executar `npx vitest run src/lib/freemium/__tests__/` — 8+ testes passando
- [ ] 12.3 Executar `npm run typecheck` — zero erros
- [ ] 12.4 Executar `npm run lint` — zero erros
- [ ] 12.5 Executar `npx vitest run` — novos + ~1071 existentes passando
- [ ] 12.6 Executar `npm run build` — build bem-sucedido
- [ ] 12.7 Verificar: CNPJ não aparece cru em nenhum log, URL, response pública ou client-side
- [ ] 12.8 Verificar: Root hash usa HMAC-SHA256 com pepper server-side
- [ ] 12.9 Verificar: Exceção admin funciona e fica registrada em admin_audit_log