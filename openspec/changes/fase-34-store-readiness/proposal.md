## Why

Dois problemas emergiram na operação controlada da v1.5: (1) o Step 2 do onboarding (logo/cores) é ignorável — o usuário cria a loja e vai direto para campanhas sem direção visual, e (2) lojas legacy (pré-F32) operam sem CNPJ, razão social ou nome fantasia, inviabilizando futura emissão de NFSe e comprometendo o controle de abuso por raiz. O problema raiz é a inexistência de um conceito de "loja pronta para gerar campanha" — os guards atuais verificam apenas existência da loja, clearance legal e saldo de créditos, ignorando completude cadastral e direção visual.

## What Changes

- **Store Readiness** — novo conceito verificável de prontidão: cadastro fiscal mínimo (CNPJ + razão social + nome fantasia) + ao menos um `store_brand_profiles` com `status = 'synced'`
- **`getStoreReadiness()`** — função server-side que retorna `{ ready, missing[] }`, implementada como RPC no banco (check_store_readiness)
- **Guarda dupla** — bloqueio em server component (`/campanhas/nova`) e API route (`generate-image/route.ts`) com redirect ou 412
- **Fluxo legacy bloqueante** — lojas sem cadastro fiscal são redirecionadas para `/cadastro/cnpj?returnTo=` ao tentar gerar. Após atualizar, encadeia para direção visual se necessário
- **Step 2 renomeado** — "Logo e Cores" → "Direção Visual" com badge "Necessário", mensagem pós-Step 1 alterada e query param `?required=visual-direction`
- **Três caminhos de direção visual** — upload de logo, geração de VS, ou text-only, todos convergindo para `store_brand_profiles` synced
- **Store type corrigido** — todos os campos CNPJ (`cnpj_normalized`, `razao_social`, `nome_fantasia`, etc.) tipados no TypeScript, eliminando casts `as unknown as Record<string, unknown>`
- **`StoreBillingInfo` type separado** — tabela `store_billing_info` com dados de NFSe/faturamento (não bloqueante, preparatório para F35)
- **Card colapsável de billing no Step 1** — pré-preenchido via BrasilAPI/CNPJá, com botão de confirmação próprio e campos de endereço fiscal
- **Indicador de completude no dashboard** — banner com checklist das pendências de readiness (cadastro_fiscal, brand_profile) quando `ready: false`
- **Migration SQL** — `store_billing_info` table + `check_store_readiness()` RPC

## Capabilities

### New Capabilities
- `store-readiness`: Função server-side `getStoreReadiness()` e RPC `check_store_readiness()` que verificam cadastro fiscal mínimo + brand profile synced. Contrato tipado `StoreReadinessResult` e `MissingItem`
- `store-billing-info`: Tipo `StoreBillingInfo` (tabela separada), funções `getStoreBillingInfo()`, `upsertStoreBillingInfo()`, `getPreFillFromCnpj()`, e tipo composto `StoreWithBillingInfo`

### Modified Capabilities
- `store-identity-ui`: Step 2 renomeado para "Direção Visual", badge "Necessário" no stepper, mensagem pós-Step 1 alterada, query param `?required=visual-direction`, card colapsável "Dados para faturamento (opcional)" com pré-preenchimento e confirmação
- `campaign-input-ui`: Guarda de readiness no server component (`/campanhas/nova/page.tsx`) — se `!ready`, redirect para `/cadastro/cnpj` ou `/loja?required=visual-direction`
- `ai-image-generation`: Guarda de readiness no handler da API (`generate-image/route.ts`) — se `!ready`, retorna 412 com `{ error: { message, reasons, missing } }`
- `legacy-store-cnpj-update`: Fluxo legacy passa de banner informativo para bloqueio de geração + redirect com `returnTo`; após atualizar cadastro, verifica readiness e encadeia para brand profile se necessário
- `store-brand-profile`: Três caminhos de direção visual (upload logo, gerar VS, text-only) convergem para `store_brand_profiles` synced; o Step 2 só libera "Confirmar" quando profile estiver synced
- `store-ownership-core`: Store type recebe campos CNPJ tipados (`cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`, `verification_status`, `verification_data`, `cnpj_official_data`, `is_test_store`)
- `dashboard-inteligente`: Banner de prontidão com checklist de pendências quando `getStoreReadiness()` retorna `ready: false`

## Impact

- **Migration**: 1 nova SQL (`20260729000001_f34_store_readiness.sql`) — tabela `store_billing_info` + RPC `check_store_readiness()` + triggers + índices
- **Novo módulo `src/lib/store-readiness.ts`**: `getStoreReadiness()`, tipos `StoreReadinessResult`, `MissingItem`
- **Novo módulo `src/lib/billing/store-billing-info.ts`**: `StoreBillingInfo`, `getStoreBillingInfo()`, `upsertStoreBillingInfo()`, `getPreFillFromCnpj()`, `StoreWithBillingInfo`
- **Server component modificado**: `src/app/(app)/campanhas/nova/page.tsx` — guarda de readiness antes de renderizar
- **API route modificada**: `src/app/api/campaign/generate-image/route.ts` — guarda de readiness no início do handler
- **Componente modificado**: `src/components/flow/store-identity-form.tsx` — Step 2 renomeado, badge, mensagens, query param, card billing
- **Componente modificado**: `src/components/flow/store-page-client.tsx` — passagem de query param
- **Dashboard modificado**: `src/app/(app)/dashboard/page.tsx` — casts substituídos, banner de prontidão
- **Componentes com casts corrigidos**: `cnpj-update-banner.tsx`, `verification-banners.tsx`, `cadastro/cnpj/page.tsx`, `store-identity-service.ts`
- **Dependências**: F32 (cnpj_normalized, cnpj_root_hash nas stores), F33 (store_brand_profiles, verification_status), F30 (legal clearance)
- **Nenhum prompt de IA alterado**
- **Nenhuma dependência externa nova**
