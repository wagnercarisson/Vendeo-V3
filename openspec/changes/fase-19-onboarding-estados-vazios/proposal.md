## Why

O dashboard da F18 é um placeholder genérico ("Em breve"). Usuário sem loja é barrado com redirect seco em páginas que poderiam mostrar orientação na UI (`/campanhas`). Não há onboarding — o novo usuário chega ao dashboard e não sabe qual é o próximo passo. A milestone v1.4 (Experiência SaaS) decidiu que "sem loja não é bloqueio" e deve virar guidance visual. `/campanhas/[id]` também redireciona para `/loja` quando sem loja — deve parar de redirecionar e retornar 404.

## What Changes

- **Criar helper centralizado de onboarding** (`getUserOnboardingState`): detecta `no_store | has_store_no_campaigns | has_store_with_campaigns` em um único lugar, com `"server-only"` e enum tipado
- **Criar `countCampaigns(storeId)`**: `SELECT COUNT(*)` com `head:true`, sem signed URLs, usado como boolean em F19 e reutilizável em F20
- **Centralizar microcopy** de estados vazios em `src/lib/onboarding/microcopy.ts`: tipada via `EmptyStateCopy`, um arquivo único para todas as strings visíveis
- **Transformar dashboard** de placeholder em server component async com 3 estados: `no_store` → "Configure sua loja" + CTA `/loja`; `has_store_no_campaigns` → "Crie sua primeira campanha" + CTA `/campanhas/nova`; `has_store_with_campaigns` → placeholder neutro (sem métricas)
- **Remover redirect de `/campanhas`** quando sem loja — substituir por empty state contextual com CTA `/loja`
- **Trocar redirect de `/campanhas/[id]`** de `/loja` para `notFound()` quando sem loja
- **Manter redirect em `/campanhas/nova`** (funcionalmente depende de loja para operar)
- **Referenciar microcopy centralizada** no empty state existente de "sem campanhas" em `/campanhas`
- **15+ testes**: helper (state 3 estados, count, microcopy), dashboard (3 estados), campanhas (sem loja, vazia, detail sem loja, nova redirect)

## Capabilities

### New Capabilities

- `onboarding-helper`: Helper centralizado de detecção de onboarding (`getUserOnboardingState`, `countCampaigns`, tipos, microcopy) em `src/lib/onboarding/`
- `dashboard-inteligente`: Dashboard page como server component async com renderização condicional de 3 empty states baseados no estado de onboarding

### Modified Capabilities

- `campaign-list-ui`: Substituir redirect para `/loja` por empty state contextual quando `no_store`; referenciar microcopy centralizada para empty state de "sem campanhas" existente
- `campaign-page-ui`: Substituir redirect para `/loja` por `notFound()` quando `no_store` em `/campanhas/[id]`; verificar que redirect em `/campanhas/nova` permanece inalterado

## Impact

- **Novos**: `src/lib/onboarding/types.ts`, `state.ts`, `count.ts`, `microcopy.ts` (4 arquivos)
- **Modificados**: `src/app/(app)/dashboard/page.tsx` (de placeholder para server component async com 3 estados), `src/app/(app)/campanhas/page.tsx` (remove redirect, adiciona empty state), `src/app/(app)/campanhas/[id]/page.tsx` (redirect → notFound)
- **Verificados (inalterados)**: `src/app/(app)/campanhas/nova/page.tsx` (redirect mantido), `src/app/(app)/loja/page.tsx` (fora de escopo), `src/components/ui/empty-state.tsx` (reutilizado), `src/lib/auth/store-ownership.ts` (inalterado)
- **Novos testes**: state (3 cenários), count (com/sem resultados), microcopy (integridade), dashboard (3 estados + PageHeader), campanhas (sem loja, vazia, detail, nova)
- **Nenhuma alteração**: banco de dados, storage, middleware, next.config, design tokens, shell, componentes de UI além do EmptyState já existente
