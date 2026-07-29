---
status: diagnosed
phase: 34-store-readiness
source: 01/SUMMARY.md, 02/SUMMARY.md, 03/SUMMARY.md, 04/SUMMARY.md, 05/SUMMARY.md
started: 2026-07-29T17:49:00.000Z
updated: 2026-07-29T18:03:00.000Z
---

## Current Test

[testing complete — 1 gap diagnosed, fix applied]

## Tests

### 1. Migration SQL — store_billing_info table + RPC
expected: Arquivo de migration existe com todos os elementos (CREATE TABLE, RLS, INDEX, TRIGGER, RPC, REVOKE/GRANT, REVERT)
result: blocked
blocked_by: server
reason: "Supabase local não disponível — migration não aplicada. Código verificado por inspeção."

### 2. Core Library — getStoreReadiness()
expected: src/lib/store-readiness.ts exporta getStoreReadiness(), StoreReadinessResult, MissingItem. Chama RPC check_store_readiness. Tem fallback em erro.
result: pass

### 3. Core Library — StoreBillingInfo (server-only)
expected: src/lib/billing/store-billing-info.ts exporta StoreBillingInfo, StoreWithBillingInfo, getStoreBillingInfo(), upsertStoreBillingInfo(). Ownership check obrigatório. import "server-only".
result: pass

### 4. Pure Module — CNPJ Address Mapper
expected: src/lib/billing/cnpj-address-mapper.ts exporta getPreFillFromCnpj(). Sem supabaseAdmin/sem server-only/sem side effects. Mapeia 7 campos.
result: pass

### 5. Store Type — CNPJ Fields Tipados
expected: src/lib/store.ts contém 13 campos CNPJ tipados. Nenhum cast as unknown as Record sobrevive no código de produção.
result: pass

### 6. Guarda Página — /campanhas/nova
expected: Server component chama getStoreReadiness() após store-exists check. Se cadastro_fiscal ausente → redirect /cadastro/cnpj?returnTo=/campanhas/nova. Se brand_profile ausente → redirect /loja?required=visual-direction. Se ready → renderiza formulário.
result: pass

### 7. Guarda API — generate-image 412
expected: API route chama getStoreReadiness() após auth/ownership, antes de rate limit + saldo. Se !ready → HTTP 412 com { error: { message, reasons, missing } }.
result: pass

### 8. Fluxo Legacy — Redirect Encadeado
expected: Após atualizar CNPJ sem brand profile → redirect /loja?required=visual-direction. Com brand profile + returnTo → redirect returnTo. Com brand profile sem returnTo → /dashboard. nome_fantasia nunca null (fallback razao_social).
result: pass

### 9. Mensagens de Contexto nos Redirects
expected: /cadastro/cnpj exibe banner contextual quando redirecionado do guard. /loja?required=visual-direction exibe mensagem específica. Mensagem pós-atualização indica dados salvos.
result: pass

### 10. Step 2 Renomeado + Badge
expected: Step 2 no StoreIdentityForm exibe "Direção Visual" (não "Logo e Cores"). Badge "Necessário" visível ao lado do label.
result: pass

### 11. Mensagem Pós-Step 1
expected: Submit Step 1 com APPROVE → toast "Loja salva. Agora configure a direção visual."
result: pass

### 12. Query Param ?required=visual-direction
expected: Acessar /loja?required=visual-direction abre formulário no Step 2. Sem query param mantém Step 1.
result: pass

### 13. Billing Card Colapsável
expected: Card "Dados para faturamento (opcional)" no Step 1. Expande se CNPJ disponível. Colapsa se vazio com mensagem contextual. 10 campos.
result: pass

### 14. Botão Confirmar dados de faturamento
expected: Botão separado de "Salvar e continuar". Desabilitado se card colapsado ou sem dados mínimos. Chama POST /api/store/billing/confirm com ownership check.
result: pass

### 15. Editar após Confirmar — Reset
expected: Editar campo billing após confirmation → billing_data_confirmed_at null, billing_data_source muda para 'manual'.
result: pass

### 16. Dashboard Readiness Banner
expected: Dashboard renderiza banner com checklist quando !ready. Mostra ❌ CNPJ cadastral (link) e ❌ Direção visual (link). Botão "Configurar agora". Não aparece se ready:true ou no_store.
result: pass

### 17. Testes — 1201 passando
expected: npm run typecheck → zero erros. npx vitest run → 1201 tests, 154 files, 0 failures.
result: pass

### 18. Três Caminhos de Direção Visual
expected: Step 2 oferece 3 caminhos (upload logo, gerar VS, text-only). Todos produzem brand profile com status 'synced'. Botão "Confirmar" só libera quando synced.
result: pass

### 19. Persistência de Aceitação Legal
expected: Aceitação de termos legais é persistida após fechar modal — ao reacessar conta ou refazer Step 1, estado mantém-se como aceito.
result: issue
reported: "clico no botão, abro a modal, clico no box de aceitação dos termos e clico em aceitar - modal fecha corretamente e step 2 está acessível mas a aceitação não foi persistida - quando acesso conta ou refaço step 1, ainda mostra como pendente"
severity: major

## Summary

total: 19
passed: 15
issues: 1 (diagnosed)
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "Aceitação de termos legais é persistida após fechar modal — ao reacessar conta, estado mantém-se como aceito"
  status: failed
  reason: "User reported: clico no botão, abro a modal, clico no box de aceitação dos termos e clico em aceitar - modal fecha corretamente e step 2 está acessível mas a aceitação não foi persistida - quando acesso conta ou refaço step 1, ainda mostra como pendente"
  severity: major
  test: 19
  root_cause: "store-identity-form.tsx:2335 — onConfirm handler do ContractAcceptanceModal só executa setAcceptedTerms(true) localmente, sem chamar POST /api/legal/accept para persistir. Aceitação só é persistida quando usuário clica em 'Salvar' (linha 913), não quando fecha modal."
  artifacts:
    - path: "src/components/flow/store-identity-form.tsx"
      issue: "Line 2335: onConfirm={async () => { setAcceptedTerms(true); return true; }} — não persiste aceitação no servidor"
    - path: "src/app/api/legal/accept/route.ts"
      reference: "API route existente POST /api/legal/accept — deve ser chamada com storeId + source:'onboarding'"
  missing:
    - "Chamar fetch POST /api/legal/accept no onConfirm para persistir aceitação imediatamente"
    - "Manter setAcceptedTerms(true) como fallback local para new stores (sem storeId)"
  debug_session: ""
