## 1. Migration SQL

- [x] 1.1 Criar `supabase/migrations/20260729000001_f34_store_readiness.sql`: CREATE TABLE `store_billing_info` com todos os campos (id, store_id FK UNIQUE, billing_email, billing_phone, billing_address_country DEFAULT 'BR', billing_address_street, billing_address_number, billing_address_complement, billing_address_neighborhood, billing_address_city, billing_address_state, billing_address_zipcode, billing_city_ibge_code, billing_data_source, billing_data_last_prefilled_from, billing_data_confirmed_at, created_at, updated_at)
- [x] 1.2 Adicionar RLS em `store_billing_info`: policy `owner_select` (SELECT para authenticated com store pertencente ao user), policy `service_role_manage` (ALL para service_role)
- [x] 1.3 Criar índice único `idx_store_billing_info_store_id` em `store_billing_info(store_id)`
- [x] 1.4 Criar função `update_store_billing_info_updated_at()` e trigger `trg_store_billing_info_updated_at`
- [x] 1.5 Criar RPC `check_store_readiness(p_store_id UUID) RETURNS JSONB` — verifica cadastro fiscal (cnpj_normalized, razao_social, nome_fantasia não nulos) + brand profile synced (EXISTS store_brand_profiles WHERE status = 'synced')
- [ ] 1.6 Executar migration localmente e verificar schema (manual — não verificável por código)

## 2. Core Library — Store Readiness

- [x] 2.1 Criar `src/lib/store-readiness.ts` com `import "server-only"`, tipos `MissingItem` e `StoreReadinessResult`
- [x] 2.2 Implementar `getStoreReadiness(storeId)` — chama RPC `check_store_readiness`, trata erro com fallback seguro
- [x] 2.3 Adicionar comentário de documentação: critérios de readiness (cadastro fiscal + brand profile synced), o que NÃO é verificado, prioridade de resolução

## 3. Core Library — Store Billing Info

- [x] 3.1 Criar `src/lib/billing/store-billing-info.ts` com interface `StoreBillingInfo` e tipo composto `StoreWithBillingInfo` (getPreFillFromCnpj está em cnpj-address-mapper.ts separado)
- [x] 3.2 Implementar `getStoreBillingInfo(storeId, userId)` — valida ownership (store pertence ao userId) ANTES de retornar dados; busca via supabaseAdmin; retorna `StoreBillingInfo | null`
- [x] 3.3 Implementar `upsertStoreBillingInfo(storeId, userId, data)` — verifica ownership (store pertence ao userId) ANTES de escrever via service_role; upsert na tabela `store_billing_info`; reseta `billing_data_confirmed_at` se dados alterados após confirmação
- [x] 3.4 Implementar `getPreFillFromCnpj(cnpjData)` — mapeia dados oficiais do CNPJ para `Partial<StoreBillingInfo>` (endereço)

## 4. Store Type — CNPJ Fields Typados

- [x] 4.1 Adicionar campos CNPJ em `src/lib/store.ts`: `cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`, `cnpj_validation_score`, `verification_status`, `verification_data`, `cnpj_official_data`, `cnpj_lookup_hash`, `verification_requested_at`, `verification_decided_at`, `verification_reasons`, `is_test_store`
- [x] 4.2 Substituir casts `(store as unknown as Record<string, unknown>).campo` em `src/app/(app)/dashboard/page.tsx` pelo acesso tipado
- [x] 4.3 Substituir casts em `src/app/(app)/cadastro/cnpj/page.tsx`
- [x] 4.4 Substituir casts em `src/components/legacy/cnpj-update-banner.tsx`
- [x] 4.5 Substituir casts em `src/components/verification/verification-banners.tsx`
- [x] 4.6 Substituir casts em `src/lib/store-identity-service.ts`
- [x] 4.7 Verificar `npm run typecheck` — zero erros após substituições

## 5. Guarda Dupla — Página + API

- [x] 5.1 Adicionar `getStoreReadiness(store.id)` em `src/app/(app)/campanhas/nova/page.tsx` após verificação de store existente: se `!ready`, redirect conforme primeira pendência (cadastro_fiscal → `/cadastro/cnpj?returnTo=/campanhas/nova`, brand_profile → `/loja?required=visual-direction`)
- [x] 5.2 Adicionar `getStoreReadiness(storeId)` em `src/app/api/campaign/generate-image/route.ts` após ownership/autenticação e antes de rate limit/saldo: se `!ready`, retorna 412 com `{ error: { message, reasons, missing } }`

## 6. Fluxo Legacy — Bloqueio + Redirect Encadeado

- [x] 6.1 Modificar `src/app/(app)/cadastro/cnpj/page.tsx`: substituir cast por acesso tipado; após `update_store_cnpj()` bem-sucedido, ler `returnTo` dos query params
- [x] 6.2 Implementar lógica de pós-atualização: verificar readiness da store; se brand profile ausente, redirect para `/loja?required=visual-direction`; senão, redirect para `returnTo` (ou `/dashboard` se ausente)
- [x] 6.3 Garantir fallback `nome_fantasia = razao_social` no cadastro de lojas (criação e fluxo legacy): quando CNPJ consultado não tem nome_fantasia oficial, preencher automaticamente com razao_social, nunca deixar null
- [x] 6.4 Adicionar mensagens de contexto nos redirects: "Sua loja precisa do CNPJ..." em cadastro/cnpj/page.tsx + "Sua loja precisa de uma direção visual..." em store-identity-form (message=needs-visual-direction) + "Dados atualizados! Agora configure..." em store-identity-form (message=cnpj-updated)

## 7. Step 2 — UX Mínima

- [x] 7.1 Renomear "Logo e Cores" para "Direção Visual" no `StoreIdentityForm`
- [x] 7.2 Adicionar badge "Necessário" no Step 2 do stepper
- [x] 7.3 Alterar mensagem pós-Step 1 de "Loja criada com sucesso!" para "Loja salva. Agora configure a direção visual."
- [x] 7.4 Modificar `src/components/flow/store-page-client.tsx` para aceitar e passar query param `?required=visual-direction` para `StoreIdentityForm`
- [x] 7.5 Garantir que `?required=visual-direction` faz o formulário abrir direto no Step 2

## 8. Card Colapsável de Billing no Step 1

- [x] 8.1 Adicionar card colapsável "Dados para faturamento (opcional)" no Step 1 do `StoreIdentityForm`
- [x] 8.2 Implementar campos: email, telefone, endereço (rua, número, complemento, bairro, cidade, estado, CEP) com layout responsivo (IBGE code field não incluso no UI)
- [ ] 8.3 Implementar comportamento expandido/colapsado: expandido por padrão se dados BrasilAPI/CNPJá disponíveis; colapsado se vazio (auto-expand quando dados carregados não implementado)
- [x] 8.4 Implementar pré-preenchimento automático via `getPreFillFromCnpj()` quando dados de CNPJ são resolvidos
- [x] 8.5 Implementar `billing_data_source`: iniciar como origem da consulta (brasilapi), mudar para `'manual'` se usuário editar qualquer campo (handleBillingChange no frontend + upsertStoreBillingInfo no backend)
- [x] 8.6 Implementar botão "Confirmar dados de faturamento": seta `billing_data_confirmed_at`, desabilitado se card colapsado ou campos obrigatórios vazios
- [x] 8.7 Implementar reset de `billing_data_confirmed_at` se usuário editar campos após confirmação (upsertStoreBillingInfo centraliza a regra, confirm route delega para ela)
- [x] 8.8 Integrar com `upsertStoreBillingInfo(storeId, userId, data)` no save (preserva billing mesmo sem confirmação)

## 9. Dashboard — Banner de Prontidão

- [x] 9.1 Adicionar `getStoreReadiness()` no dashboard server component: se `ready: false`, renderizar banner de prontidão
- [x] 9.2 Implementar banner com checklist das pendências de readiness: ❌ CNPJ (link `/cadastro/cnpj?returnTo=/dashboard`), ❌ Direção visual (link `/loja?required=visual-direction`); legal clearance e saldo são verificados nos guards de geração, fora do banner
- [x] 9.3 Botão "Configurar agora" apontando para a primeira pendência
- [x] 9.4 Banner não aparece quando loja não existe (no_store) nem quando ready: true

## 10. Testes

### 10.1 StoreReadiness (4+ testes)

- [x] 10.1.1 `getStoreReadiness()` com cadastro fiscal completo + brand profile synced → `{ ready: true }`
- [x] 10.1.2 `getStoreReadiness()` com store sem cadastro fiscal → `{ ready: false, missing: ["cadastro_fiscal"] }`
- [x] 10.1.3 `getStoreReadiness()` sem brand profile → `{ ready: false, missing: ["brand_profile"] }`
- [x] 10.1.4 `getStoreReadiness()` sem cadastro e sem brand profile → `{ ready: false, missing: ["cadastro_fiscal", "brand_profile"] }`

### 10.2 RPC check_store_readiness (2 testes)

- [ ] 10.2.1 RPC com store completa → JSON correto (database-dependent — não implementável em unit test)
- [ ] 10.2.2 RPC com store sem cadastro → missing inclui cadastro_fiscal (database-dependent)

### 10.3 Guarda na página (2 testes)

- [ ] 10.3.1 Store sem cadastro fiscal → redirect para `/cadastro/cnpj?returnTo=/campanhas/nova` (requer E2E/integration)
- [ ] 10.3.2 Store sem brand profile → redirect para `/loja?required=visual-direction` (requer E2E/integration)

### 10.4 Guarda na API (2 testes)

- [x] 10.4.1 Store sem cadastro fiscal → 412 com reasons (coberto pelo route test com ownership OK + store readiness mock)
- [x] 10.4.2 Store completa → pipeline prossegue

### 10.5 TypeScript (1 teste)

- [x] 10.5.1 `Store` type tem todos os campos CNPJ tipados — `npm run typecheck` passa

### 10.6 Billing Info (4 testes)

- [x] 10.6.1 `upsertStoreBillingInfo()` com dados completos → billing info salvo
- [x] 10.6.2 `upsertStoreBillingInfo()` com ownership violado → erro (store não pertence ao userId)
- [x] 10.6.3 `getStoreBillingInfo()` com ownership OK → retorna dados; com ownership violado → erro
- [x] 10.6.4 `getPreFillFromCnpj()` com dados da BrasilAPI → mapeamento correto (3 testes em cnpj-address-mapper.test.ts)
- [ ] 10.6.5 Store pode gerar campanha sem billing info → não bloqueia (sem teste específico)

### 10.7 Fluxo Legacy (2 testes)

- [ ] 10.7.1 Loja legacy sem cadastro fiscal → bloqueio de geração (requer E2E/integration)
- [ ] 10.7.2 Após atualizar cadastro sem brand profile → redirect para direção visual (requer E2E/integration)

### 10.8 Dashboard Banner (1 teste)

- [ ] 10.8.1 Banner de prontidão aparece para loja com pendências, não aparece para loja pronta (mock sempre retorna ready:true)

## 11. Verificação Final

- [x] 11.1 Executar `npx vitest run src/lib/store-readiness/__tests__/` — 6/6 passed
- [x] 11.2 Executar `npx vitest run src/lib/billing/__tests__/` — 8/8 passed
- [x] 11.3 Executar `npm run typecheck` — zero erros ✅
- [x] 11.4 Executar `npm run lint` — zero erros ✅
- [x] 11.5 Executar `npx vitest run` — 1201/1201 passed
- [x] 11.6 Executar `npm run build` — build bem-sucedido ✅
- [x] 11.7 Verificar: Nenhum cast `as unknown as Record<string, unknown>` sobreviveu nos 5 arquivos do escopo (dashboard, cadastro/cnpj, cnpj-update-banner, verification-banners, store-identity-service) — limpos ✅ (8 casts sobrevivem em outros arquivos fora do escopo)
- [x] 11.8 Verificar: `upsertStoreBillingInfo()` faz ownership check antes de escrever (valida store pertence ao userId) — implementado em store-billing-info.ts ✅
- [x] 11.9 Verificar: Billing info não bloqueia geração de campanhas — billing não está no RPC check_store_readiness ✅
- [x] 11.10 Verificar: Lojas legacy sem cadastro fiscal são bloqueadas na geração com mensagem clara — guarda dupla em campanhas/nova e generate-image ✅
