---
status: complete
date: 2026-10-25
slug: conectar-card-visual-signature-image-ao
plan: 261025-lh9
phase: quick
type: execute
commit: 8ab2d55d
branch: feature/fase-47-1-modelos-assinatura-visual
files_changed: 13
deviations: 0
---

# Quick 261025-lh9 — Card `visual_signature_image` conectado à configuração dedicada

## Resultado

O card `visual_signature_image` de `/admin/ai-model-selection` passou a ler, salvar e remover
exclusivamente a configuração dedicada da Assinatura Visual, com leitura server-side,
confirmação por releitura e nenhum recarregamento de página. Todos os demais cards, layout,
classes e handlers permaneceram intactos.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/visual-signature/admin-environment.ts` | Novo: `resolveVisualSignatureAdminEnvironment()` server-only, fail-closed, identidade derivada de `NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL` (sem `product-1-1`). |
| `src/lib/visual-signature/admin-config-view.ts` | Novo: view discriminada `dedicated \| legacy \| error`, `toVisualSignatureAdminConfigView`, `buildVisualSignatureAdminConfigView` sem cache; erro nunca vira `legacy`. |
| `src/lib/visual-signature/__tests__/admin-environment.test.ts` | Novo: 10 testes (local/homolog/produção/fallback/precedência/ausência/inválida/IPv6/estático). |
| `src/lib/visual-signature/__tests__/admin-config-view.test.ts` | Novo: 10 testes (dedicated/legacy/read_failed/invalid/genérico/sem cache/log sanitizado). |
| `src/lib/admin/schemas.ts` | Acrescentados `VisualSignatureModelConfigUpdateSchema` e `VisualSignatureModelConfigResetSchema` (`.strict()`, listas literais com paridade provada). Nenhum schema existente alterado. |
| `src/app/api/admin/visual-signature-model-config/route.ts` | Novo endpoint PUT/DELETE com `requireAdmin` → `requireSameOrigin` → Zod estrito → ambiente server-side → RPC dedicada → releitura/confirmação. |
| `src/app/api/admin/__tests__/visual-signature-model-config.test.ts` | Novo: 46 testes (auth/CSRF/schema/9 args/4 combinações/confirmação/erros/reset/invariantes estáticos/paridade). |
| `src/app/(app)/admin/ai-model-selection/visual-signature-model-card.tsx` | Novo card dedicado: vigente separada do rascunho, 3 estados, save/reset, sem reload. |
| `src/app/(app)/admin/ai-model-selection/visual-signature-model-card.test.tsx` | Novo: 19 testes RTL. |
| `src/app/(app)/admin/ai-model-selection/page.tsx` | Lê `buildVisualSignatureAdminConfigView()` server-side e repassa 3 props. |
| `src/app/(app)/admin/ai-model-selection/form.tsx` | Props novas e substituição exclusiva do card `visual_signature_image`; demais cards inalterados. |
| `src/app/(app)/admin/ai-model-selection/ai-model-selection.test.tsx` | Props padrão + caso do card dedicado. |
| `src/app/(app)/admin/ai-model-selection/unified-model-config.test.tsx` | Props padrão + caso de substituição + checagem estática de `page.tsx`. |

## Contratos RPC usados

**PUT** — SOMENTE `admin_set_visual_signature_model_config_v3`, exatamente 9 argumentos:
`p_actor_id` (de `requireAdmin`), `p_orchestrator_model`, `p_image_model`, `p_image_quality`,
`p_reasoning_effort: "low"`, `p_reason`, `p_operation_id`, `p_environment_scope` e
`p_instance_identity` (os dois últimos derivados server-side).

**DELETE** — SOMENTE `admin_reset_visual_signature_model_config`, exatamente 5 argumentos:
`p_actor_id`, `p_expected_config_version_id`, `p_reason`, `p_operation_id`,
`p_instance_identity` — **sem environment**.

Nenhuma chamada a `admin_set_ai_model_selection`/`admin_reset_ai_model_selection`, nenhuma
mutação via `.from("visual_signature_model_config")`, nenhum import de `@/lib/product-1-1/**`.

## Comportamento de UI

- **Dedicated:** "Configuração vigente" exibe GPT-5.5/GPT-6-Luna, Flare/Sunburst, Low/Medium
  com `title` do ID completo.
- **Legacy:** orquestrador herdado (seleção persistida/default do sistema), imagem "Padrão da
  API", qualidade "auto"; reset desabilitado.
- **Error:** alerta "Não foi possível ler a configuração dedicada. O estado atual não é exibido
  como ausência."; sem textos de legado; reset desabilitado.
- Alterar o formulário não altera a vigente. Save envia apenas
  `{ orchestratorModel, imageModel, imageQuality, reason, operationId }`; reset envia apenas
  `{ expectedConfigVersionId, reason, operationId }`.
- `confirmed:true` promove a view retornada pela releitura e sincroniza o draft; `confirmed:false`
  mostra aviso âmbar e **não** promove o draft. Motivo vazio bloqueia a operação no cliente.
- Reset usa a versão vigente e volta a legacy apenas após confirmação. Nenhum
  `window.location.reload`.

## Validação executada (offline)

| Comando | Resultado |
|---|---|
| `npx vitest run src/lib/visual-signature/__tests__/admin-environment.test.ts src/lib/visual-signature/__tests__/admin-config-view.test.ts` | 2 arquivos, **20 passed** |
| `npx vitest run src/app/api/admin/__tests__/visual-signature-model-config.test.ts` | 1 arquivo, **46 passed** |
| `npx vitest run "src/app/(app)/admin/ai-model-selection/visual-signature-model-card.test.tsx"` | 1 arquivo, **19 passed** |
| `npx vitest run "src/app/(app)/admin/ai-model-selection/ai-model-selection.test.tsx" "src/app/(app)/admin/ai-model-selection/unified-model-config.test.tsx"` | 2 arquivos, **17 passed** |
| Suíte focada completa (6 arquivos) | **102 passed**, 0 falhas |
| Regressão correlata (`model-config`, `generation-config-snapshot`, `image-model-pair`) | 3 arquivos, **45 passed** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (gate completo `eslint .`) |
| `git diff --check` | exit 0 |

## Complemento de revisão (2026-10-25)

Após a revisão do orquestrador, dois acabamentos foram aplicados sem ampliar o escopo:

1. O card passou a mapear erros de reset mais úteis e seguros
   (`config_version_mismatch`, `config_missing`, `instance_identity_mismatch`,
   `deactivate_required`, `missing_config_version_id`, `invalid_rpc_response`) e a rota
   incluiu `release_state_missing` na allowlist de conflito (409).
2. O texto da página foi corrigido para não afirmar que a Assinatura Visual pertence ao
   fluxo legado: a VS usa configuração dedicada no grupo Imagem; as demais capacidades de
   imagem seguem o legado.

Gates reexecutados: **102/102** testes focados; **725/725** na regressão ampliada
(`src/lib/visual-signature` + `src/app/api/admin` + `src/app/(app)/admin/ai-model-selection` +
guarda de não-ativação); `npm run typecheck`, `npm run lint` e `git diff --check` exit 0.
Commit do complemento: `04da0bb2`.

## Invariantes verificadas

- `git diff --name-only` do commit não contém `supabase/`, `openspec/` nem `.planning/`.
- Nenhum arquivo novo/alterado importa `@/lib/product-1-1/**`.
- A rota contém apenas as duas RPCs dedicadas e não contém `.from("visual_signature_model_config")`,
  `.insert(`, `.update(`, `.delete(` nem RPCs genéricas.
- O card não contém `window.location.reload`.
- Exatamente uma ocorrência de `visual_signature_image` renderizada (card dedicado), sem
  "Novo primary" para essa capacidade.

## Não executado

Nenhum Docker, Supabase CLI, psql, banco, migration, provider pago, rede, deploy, push, branch,
tag, merge ou worktree. Nenhum arquivo em `supabase/`, `openspec/` ou `.planning/` foi commitado.
Nenhuma variável de ambiente, credencial, flag ou pricing foi alterada.

## Deviations from Plan

None — plan executed as written. As únicas correções internas foram de teste durante o
desenvolvimento (uso de `vi.resetAllMocks()` para isolar implementações e restauração de uma
linha removida acidentalmente na suíte unificada); ambas dentro do próprio trabalho, sem
mudança de comportamento planejado.

## Self-Check: PASSED

- Arquivos criados existem no commit `8ab2d55d`.
- Commit contém 13 arquivos de código/teste; `.planning/` permanece fora do commit.
- Todos os comandos de validação retornaram exit 0.
