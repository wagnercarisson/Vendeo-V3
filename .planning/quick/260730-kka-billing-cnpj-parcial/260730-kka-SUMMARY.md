---
status: complete
quick_id: 260730-kka
slug: billing-cnpj-parcial
date: 2026-07-30
---

## Summary: billing-cnpj-parcial

**Objetivo:** Corrigir UX/robustez no card de billing do onboarding para tolerar dados parciais de CNPJ.

### O que foi feito

**Backend** (`src/app/api/store/[id]/reconsult-cnpj/route.ts`):
- Adicionada validação de `situacao_cadastral` antes de qualquer persistência — CNPJ não ativo retorna 422 e não preenche nada
- Adicionado campo `billing_completeness` no response: `"complete"` (street+number+city+state), `"partial"` (alguns ausentes), `"empty"` (todos null)

**Frontend** (`src/components/flow/store-identity-form.tsx`):
- Path A (`handleReconsultCnpj`): corrigido `setBillingData` sem fallback `|| ''` que causava "undefined" nos inputs
- Path B (card billing "Atualizar dados pelo CNPJ"): adicionado mapeamento de 422 com mensagem específica
- Ambos os paths: setam `billingCompleteness`, ativam formulário via `setBillingManualActive(true)` para `partial`/`empty`
- Aviso amarelo de dados parciais renderizado para `partial` e `empty`
- Estado limpo em erros e ao clicar "Preencher manualmente"

### Arquivos alterados
- `src/app/api/store/[id]/reconsult-cnpj/route.ts`
- `src/components/flow/store-identity-form.tsx`

### Testes
- `npx tsc --noEmit` — limpo
- `npx vitest run src/lib/billing/` — 16/16 passando (3 suites)
