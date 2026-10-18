---
id: 261018-jnf
title: Unificar a configuração administrativa de modelos em /admin/ai-model-selection
status: in-progress
workflow: gsd-quick
scope: admin-model-config-ui-composition
approval:
  by: usuário
  date: 2026-10-18
  origin: pedido do responsável em 2026-10-18 (escopo autorizado de UI e navegação)
evidence: null
related:
  - src/app/(app)/admin/ai-model-selection/page.tsx
  - src/app/(app)/admin/ai-model-selection/form.tsx
  - src/app/(app)/admin/image-model-pair/page.tsx
  - src/app/(app)/admin/image-model-pair/form.tsx
  - src/app/(app)/admin/layout.tsx
files_modified: []
---

# Quick Plan — 261018-jnf — PLANEJADO / EM EXECUÇÃO

> Quick pequena de **interface e navegação**. Não altera fluxos de IA, prompts,
> adapters, pricing, catálogo, allowlists, defaults, geração, créditos,
> autorização ou controle de gasto. Sem migrations, sem dados/env/flags, sem
> geração paga, sem produção/deploy/push, sem reabrir fases.

## 1. Leitura direcionada (feita)

- `/admin/ai-model-selection` (`page.tsx` + `form.tsx`): formulário cliente por
  capacidade (`/api/admin/ai-model-selection`), agrupado em Texto / Visual /
  Imagem; 11 capacidades legadas (`LEGACY_SELECTION_CAPABILITIES`).
- `/admin/image-model-pair` (`page.tsx` + `form.tsx`): par principal/fallback do
  Produto 1:1 (`buildImageModelPairConfigView`), banner de não-ativa,
  catálogo elegível, `ImageModelPairConfigForm` → `/api/admin/image-model-pair`.
- `admin/layout.tsx`: duas entradas de navegação de modelos ("Modelos de IA" e
  "Par de modelos (novo fluxo)").
- Teste de navegação em `product-1-1-pending/__tests__/resolution-form.test.tsx`
  afirma `href="/admin/image-model-pair"` no layout (asserção que muda com este
  escopo).

## 2. Conclusão da leitura

Basta **composição de UI + navegação**. Nenhum contrato de API, backend de
geração ou persistência precisa mudar: os dois formulários continuam chamando
os mesmos endpoints, validações, RPCs e serviços. Os salvamentos permanecem
independentes por seção (não existe "salvar tudo").

## 3. Tarefas

1. **Seção reutilizável do Produto 1:1** — extrair as regiões B–E da página
   atual para um componente servidor em
   `ai-model-selection/image-model-pair-section.tsx`, com âncora
   `id="produto-1-1-imagem"` e título de seção "Imagem de campanhas — Produto 1:1".
   Reutiliza `buildImageModelPairConfigView` + `ImageModelPairConfigForm` sem
   qualquer alteração de contrato.
2. **Aviso correto (Req. 6)** — substituir o banner absoluto "NÃO está ativa em
   produção" pela explicação correta: "Esta configuração define os modelos do
   fluxo Produto 1:1. A habilitação do fluxo é controlada separadamente." sem
   afirmar estado ativo/inativo.
3. **Página unificada** — `ai-model-selection/page.tsx` compõe as demais
   capacidades (preservando agrupamentos) e a seção Produto 1:1; identifica as
   capacidades de imagem do **fluxo legado** no grupo "Imagem".
4. **Navegação única** — `admin/layout.tsx` passa a ter uma única entrada de
   modelos ("Modelos de IA" → `/admin/ai-model-selection`).
5. **Redirect legado** — `image-model-pair/page.tsx` redireciona para
   `/admin/ai-model-selection#produto-1-1-imagem`, preservando links existentes e
   a proteção administrativa (layout `requireAdmin`).
6. **Testes** — atualizar asserções afetadas e adicionar cobertura da composição
   (salvamentos independentes, sem escrita no mount) e do redirect/navegação.

## 4. Gates

- `npm run typecheck`, `npm run lint`.
- Vitest das suítes afetadas (forms, navegação/redirect).
- Diff e arquivos listados; parada para revisão antes de commit/push.
- Inspeção visual (desktop + largura móvel) — distinguir de evidência
  automatizada.

## 5. Fora do escopo

Luna em outras capacidades, novos modelos de assinatura, catálogo/allowlists/
pricing/defaults/seleções, geração/prompts/adapters/retries/fallback/créditos/
autorização/controle de gasto, migrations, dados/env/flags, geração paga,
produção, deploy, push, reabrir fases e incrementar contadores.
