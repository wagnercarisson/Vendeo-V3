---
id: 261018-jnf
title: Unificar a configuração administrativa de modelos em /admin/ai-model-selection
status: done
workflow: gsd-quick
scope: admin-model-config-ui-composition
approval:
  by: responsável (usuário)
  date: 2026-10-18
  origin: pedido do responsável em 2026-10-18 (escopo autorizado de UI e navegação)
  decision: approved
evidence:
  typecheck: pass
  lint: pass
  build: pass
  tests: pass
  visual: approved-by-owner (not-performed-by-agent)
related:
  - src/app/(app)/admin/ai-model-selection/page.tsx
  - src/app/(app)/admin/ai-model-selection/image-model-pair-section.tsx
  - src/app/(app)/admin/image-model-pair/page.tsx
  - src/app/(app)/admin/layout.tsx
files_modified:
  - src/app/(app)/admin/ai-model-selection/page.tsx
  - src/app/(app)/admin/ai-model-selection/form.tsx
  - src/app/(app)/admin/ai-model-selection/image-model-pair-section.tsx (novo)
  - src/app/(app)/admin/ai-model-selection/unified-model-config.test.tsx (novo)
  - src/app/(app)/admin/image-model-pair/page.tsx
  - src/app/(app)/admin/image-model-pair/form.tsx
  - src/app/(app)/admin/image-model-pair/__tests__/image-model-pair.test.tsx
  - src/app/(app)/admin/layout.tsx
  - src/app/(app)/admin/product-1-1-pending/__tests__/resolution-form.test.tsx
---

# Quick Summary — 261018-jnf — CONCLUÍDA (aprovada, commitada; sem push)

> Alteração de **interface e navegação**. Nenhum fluxo de IA, contrato de API,
> backend de geração ou persistência foi alterado. Aprovada pelo responsável em
> 2026-10-18 (UAT em `261018-jnf-UAT.md`); commit consolidado sem push, com
> `.dev.log` fora.

## O que foi feito

1. **Seção reutilizável do Produto 1:1** — `image-model-pair-section.tsx` (servidor)
   reutiliza `buildImageModelPairConfigView` e `ImageModelPairConfigForm` sem
   mudança de contrato; âncora `id="produto-1-1-imagem"`; título "Imagem de
   campanhas — Produto 1:1"; par vigente, cobertura de pricing, catálogo elegível,
   motivo obrigatório e tratamento de erro preservados.
2. **Explicação correta do escopo** — o banner absoluto "NÃO está ativa em
   produção" foi substituído por: "Esta configuração define os modelos do fluxo
   Produto 1:1. A habilitação do fluxo é controlada separadamente." Nenhuma
   afirmação de ativo/inativo é feita. Componente renomeado para
   `ImageModelPairScopeBanner`.
3. **Página única** — `ai-model-selection/page.tsx` compõe "Demais capacidades"
   (agrupamentos Texto/Visual/Imagem preservados) e a seção Produto 1:1. O grupo
   "Imagem" agora identifica explicitamente o **fluxo legado**.
4. **Navegação única** — `admin/layout.tsx` mantém apenas "Modelos de IA" →
   `/admin/ai-model-selection`; a entrada "Par de modelos (novo fluxo)" foi removida.
5. **Rota legada preservada** — `/admin/image-model-pair` redireciona para
   `/admin/ai-model-selection#produto-1-1-imagem`; a proteção administrativa
   continua pelo layout `requireAdmin`.
6. **Salvamentos independentes** — cada seção mantém seu endpoint
   (`/api/admin/image-model-pair` / `/api/admin/ai-model-selection`), validações,
   motivo obrigatório e RPCs; sem "salvar tudo".

## Gates

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (82/82 páginas; rota `/admin/image-model-pair` presente) |
| `git diff --check` | sem erros de whitespace |
| Vitest `src/app/(app)/admin` | 21 arquivos / **248/248** |
| Vitest rotas API afetadas (`image-model-pair`) | 19/19 |

## Evidência visual

- **Automatizada:** testes de composição em `unified-model-config.test.tsx`
  (seções coexistem, sem gravação no mount, salvamentos independentes por
  endpoint, motivo obrigatório, redirect, âncora e navegação única).
- **Inspeção visual humana:** **aprovada pelo responsável em 2026-10-18**; não
  executada pelo agente (o runtime não oferece navegador/captura de tela). Caminhos
  para conferência: `/admin/ai-model-selection` em desktop e largura móvel, e
  `/admin/image-model-pair` como redirect.

## Fora do escopo (não tocado)

Catálogo/allowlists/pricing/defaults/seleções, geração/prompts/adapters/retries/
fallback/créditos/autorização/controle de gasto, migrations, dados/env/flags,
produção/deploy/push, reabertura de fases. `.dev.log` e credenciais fora dos commits.
