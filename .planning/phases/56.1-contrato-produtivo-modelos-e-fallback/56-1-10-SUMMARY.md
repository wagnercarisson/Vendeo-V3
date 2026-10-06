---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 10
subsystem: ui
tags: [ui, admin, next-app-router, react, image-generation, model-pair, fallback, pricing-coverage, lucide-react]

# Dependency graph
requires:
  - phase: 56.1 (Plano 08)
    provides: buildImageModelPairConfigView (catálogo elegível, par vigente, origem, versão, cobertura por par), serviço server-only de leitura/cache e rota admin GET/PUT auditada
  - phase: 56.1 (Plano 01)
    provides: contrato do par (INITIAL_IMAGE_MODEL_PAIR, listas elegíveis fechadas) e modelo/qualidades elegíveis
provides:
  - "Tela admin única do par de modelos do novo fluxo (page server force-dynamic + form cliente) com aviso permanente de não-ativa, catálogo elegível, par vigente/origem/versão e cobertura de pricing por par"
  - "Formulário auditável restrito ao catálogo elegível (modelo+qualidade), motivo obrigatório, idempotência por operationId e cobertura warn-not-block"
  - "Link de navegação aditivo 'Par de modelos (novo fluxo)' em (app)/admin/layout.tsx"
  - "Suíte de UI (9 testes) com API mockada provando banner permanente, catálogo, motivo, cobertura e feedback"
affects: [56.1-11, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Região B (aviso permanente de não-ativa) exportada como componente próprio em form.tsx e composta pela página como irmã do formulário, garantindo uma única instância presente em todos os estados (D-23/T-56.1-32)"
    - "Formulário cliente espelhando o padrão do analog ai-model-selection: fingerprint de payload → operationId estável, edição limpa idempotência/sucesso/erro, aviso âmbar warn-not-block"
    - "Seletores de par (modelo+qualidade) em fieldset/legend restritos às listas elegíveis fechadas (3 modelos × low/medium)"

key-files:
  created:
    - src/app/(app)/admin/image-model-pair/page.tsx
    - src/app/(app)/admin/image-model-pair/form.tsx
    - src/app/(app)/admin/image-model-pair/__tests__/image-model-pair.test.tsx
  modified:
    - src/app/(app)/admin/layout.tsx

key-decisions:
  - "O aviso âmbar de não-ativa (região B) é um componente exportado em form.tsx e renderizado pela página como irmão do formulário (antes das regiões C/D), mantendo uma única instância não-dismissível presente no estado vazio e no sucesso — provado por teste."
  - "A página server (force-dynamic) chama buildImageModelPairConfigView() e renderiza regiões A/B/C/D; o formulário cliente (região E) recebe a view para pré-preenchimento, restrição e cobertura. Nenhum controle destrutivo/reset é renderizado (origem default não existe, D-12)."
  - "Cobertura de pricing partial/missing é exibida como aviso âmbar e NÃO desabilita 'Salvar configuração' (D-24); a renderização da cobertura usa view.pricing (na carga), sem recomputação client-side (o resolvedor é server-only)."
  - "region B owned by the client form but composed by the page: o page.tsx importa ImageModelPairInactiveBanner e o renderiza explicitamente, de modo que o aviso fica presente em todos os estados e testável isoladamente."

patterns-established:
  - "Tela admin F56.1: aviso permanente de não-ativa + catálogo somente leitura + par vigente + formulário auditável warn-not-block"

requirements-completed: [REQ-56.1-01, REQ-56.1-02, REQ-56.1-03, REQ-56.1-07, REQ-56.1-26]

# Metrics
duration: 4 min
completed: 2026-10-06
---

# Phase 56.1 Plan 10: Tela admin do par de modelos do novo fluxo Summary

**Tela admin única do par principal/fallback (modelo+qualidade) com aviso permanente de não-ativa em produção, catálogo elegível somente leitura, par vigente/origem/versão, cobertura de pricing warn-not-block e formulário auditável com idempotência por operationId**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-06T17:22:50Z
- **Completed:** 2026-10-06T17:27:42Z
- **Tasks:** 3
- **Files modified:** 4 (3 criados, 1 modificado)

## Accomplishments

- `page.tsx` server com `export const dynamic = "force-dynamic"` chamando `buildImageModelPairConfigView()`: header (região A), aviso âmbar não-dismissível (região B), par vigente com origem/versão/autor/timestamps/motivo e cobertura por par (região C, com Empty State quando não há configuração e ErrorState na falha de leitura), catálogo elegível somente leitura (região D) e o formulário cliente (região E).
- `form.tsx` client com seletores de modelo+qualidade para par principal e fallback restritos ao catálogo elegível (3 modelos × `low`/`medium`), motivo obrigatório com erro inline `role="alert"` (`Motivo obrigatório`), idempotência por fingerprint (`operationId` estável no retry, renovado ao editar), PUT para `/api/admin/image-model-pair`, aviso âmbar de cobertura `partial`/`missing` que não desabilita o Salvar e feedback de sucesso `Configuração salva com auditoria.` com ícone `Check`.
- `layout.tsx` recebeu exatamente UM link aditivo (`Par de modelos (novo fluxo)` → `/admin/image-model-pair`), sem reordenar/remover links existentes nem alterar `requireAdmin`/redirect.
- Suíte de UI com 9 testes (API mockada via `vi.fn`, nenhuma chamada real) provando: banner permanente no estado vazio e após o sucesso, restrição ao catálogo nos dois pares, bloqueio por motivo vazio, cobertura parcial/ausente sem bloquear o Salvar, erro inline `role="alert"` e ausência de controles destrutivos.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Página server e link de navegação aditivo** - `1492143b` (feat)
2. **Task 2: Formulário cliente com seletores, motivo e cobertura** - `1d3874d2` (feat)
3. **Task 3: Testes de UI (seleção, motivo, catálogo, aviso)** - `1d57b6b3` (test)

**Plan metadata:** (docs: complete plan) — commit final do SUMMARY/STATE/ROADMAP.

## Files Created/Modified

- `src/app/(app)/admin/image-model-pair/page.tsx` - Página server (`force-dynamic`) que monta a view e renderiza header/aviso/cartões/catálogo/form.
- `src/app/(app)/admin/image-model-pair/form.tsx` - Componente cliente com o aviso permanente (região B) e o formulário auditável (região E) restrito ao catálogo elegível.
- `src/app/(app)/admin/image-model-pair/__tests__/image-model-pair.test.tsx` - Suíte de UI (9 testes) com API mockada.
- `src/app/(app)/admin/layout.tsx` - Link de navegação aditivo para a tela do par.

## Decisions Made

- **Aviso não-ativa (região B):** componente `ImageModelPairInactiveBanner` exportado de `form.tsx` e renderizado pela página como irmão do formulário (posição correta entre A e C/D). Uma única instância, não-dismissível, presente no estado vazio e no sucesso — coberto por testes.
- **Regiões C/D na página, E no formulário:** a página server renderiza o par vigente, o Empty State e o catálogo; o formulário cliente recebe a view para pré-preencher (par vigente ou `INITIAL_IMAGE_MODEL_PAIR`) e restringir opções.
- **Warn-not-block:** cobertura `partial`/`missing` é aviso âmbar que não desabilita `Salvar configuração` (D-24); a cobertura exibida vem de `view.pricing` na carga (o resolvedor de pricing é server-only).
- **Sem controles destrutivos:** nenhuma ação de reset/delete/ativação é renderizada (origem `default` não existe — D-12).

## Deviations from Plan

None - plan executed exactly as written.

*Nota interna:* para permitir `npm run typecheck` verde na Task 1, `form.tsx` foi criado nessa task com o componente do aviso (região B) e um placeholder mínimo do formulário, completado integralmente na Task 2. Não houve alteração de escopo, arquivos, interfaces ou critérios de aceite.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração externa. Nenhuma chamada a provider, nenhuma operação de banco/Supabase, nenhuma migration e nenhuma ativação. Testes com API mockada.

## Next Phase Readiness

- Tela admin do par entregue e testável offline; `buildImageModelPairConfigView` (Plano 08) e o contrato do par (Plano 01) são consumidos sem duplicar validação.
- Fronteira legada intocada: `layout.tsx` recebeu apenas um link aditivo; `requireAdmin`/redirect inalterados; nenhum controle destrutivo.
- Pronto para o Plano 11 (fechamento da F56.1) e para a integração transacional da F56.2.

## Self-Check: PASSED

- Arquivos criados verificados em disco: `image-model-pair/page.tsx`, `image-model-pair/form.tsx`, `image-model-pair/__tests__/image-model-pair.test.tsx` — todos FOUND.
- Commits verificados em `git log`: `1492143b`, `1d3874d2`, `1d57b6b3` — todos presentes.
- `npm test -- "src/app/(app)/admin/image-model-pair/__tests__/image-model-pair.test.tsx"` = 1 arquivo / 9 testes verdes.
- `npm run typecheck` e `npm run lint` = exit 0.
- `git diff` de `layout.tsx` limitado ao link aditivo.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*

## Correção pós-revisão humana

Revisão humana encontrou uma divergência entre o formulário entregue e a UI-SPEC: o aviso âmbar usava `const coverage = view.pricing;` — a cobertura do par **vigente** (estático) —, portanto **não** acompanhava o par sendo **rascunhado**. A UI-SPEC L165 ("Live pricing coverage for each drafted pair (warn only)") e L322 ("recompute coverage per drafted pair as selects change") exigem que o aviso reflita o rascunho (principal + fallback) e seja recomputado ao vivo quando um seletor muda, sem bloquear o Save (D-24).

### Causa raiz

`view.pricing` é a cobertura agregada do par **persistido**. Ao trocar modelo/qualidade nos seletores, o estado local (`draft`) muda mas o aviso permanecia com a cobertura do par vigente — um aviso desatualizado e potencialmente enganoso (ex.: mostrar "Completa" para um par em rascunho sem cobertura, ou alertar para um par já corrigido).

### Suporte aditivo na view (`src/lib/ai/image-model-pair-config-view.ts`, plano 08)

- Novo campo `targetCoverageByPair: Record<string, ImagePairTargetPricingStatus>` em `ImageModelPairConfigView`, chaveado por `${model}|${quality}` e computado server-side para **todos** os pares elegíveis (3 modelos × 2 qualidades = 6 combinações).
- Resolvedor injetável `ImageModelPairTargetCoverageResolver` (novo), com default `getImagePairPricingService().resolveTargetCoverage({ model, quality })` (método já público em `image-pair-pricing.ts`) — espelhando o padrão do `pricingResolver` existente, permitindo fakes em testes.
- Estado vazio → `{}`; leitura falha de um par omite a chave (o cliente trata "desconhecido" sem inferir `complete`).
- **Estritamente aditivo**: `pricing`, `pricingCoverage`, `resolveImagePairCoverage`/`resolveImagePairConfig` e o comportamento do serviço do plano 08 ficaram inalterados. Nenhuma chamada adicional de rede no cliente — o mapa vem pronto do servidor.

### Mudança no formulário (`src/app/(app)/admin/image-model-pair/form.tsx`)

- Nova função pura `draftedCoverage(view, draft)` que deriva a cobertura do par em rascunho a partir de `view.targetCoverageByPair`: `complete` somente quando **ambos** (principal e fallback) estão completos; `missing` somente quando ambos estão ausentes; caso contrário `partial`; `missingComponents` = união deduplicada. Par desconhecido → `null` (nunca renderiza `complete` falso).
- `const coverage = view.pricing;` → `const coverage = draftedCoverage(view, draft);`; a copy exata da UI-SPEC foi preservada (`Cobertura de pricing {status}: faltam {componentes}. Você pode salvar, mas a execução exige cobertura completa para principal e fallback.`).
- O aviso é recomputado a cada `onChange` de seletor (o mesmo `edit()` que já reseta idempotência) e **não** desabilita `Salvar configuração` (D-24). Banner, motivo, `operationId`/fingerprint, sucesso/erro intactos.

### Teste novo (`src/app/(app)/admin/image-model-pair/__tests__/image-model-pair.test.tsx`)

- `atualiza o aviso de cobertura conforme o par em rascunho muda nos seletores`: semeia `targetCoverageByPair` com o par inicial completo (sem aviso) e `gpt-image-2.5-flare|low` `missing`; muda o par principal para esse par → aviso "Parcial" + "faltam image_unit"; volta ao par completo → aviso desaparece; em todos os passos `Salvar configuração` permanece habilitado.
- Testes de cobertura `partial`/`missing` migrados de `view.pricing` para `view.targetCoverageByPair`; `EMPTY_VIEW`/`CONFIGURED_VIEW` receberam o novo campo.
- View do plano 08: asserção `targetCoverageByPair === {}` no estado vazio e novo teste "expõe o mapa de cobertura de TODOS os pares elegíveis (aditivo)" (6 chaves, resolvedor chamado 6×).

### Verificação

- `npx vitest run image-model-pair` → 4 arquivos / **62 testes verdes** (UI 10, serviço/view 20, rota 21, demais).
- `npm run typecheck` → OK (exit 0); `npm run lint` → OK (exit 0).
- Nenhuma chamada real de provider/rede/banco; nenhum comando Supabase; nenhuma ativação.

### Commits da correção

| Commit | Tipo | Conteúdo |
|---|---|---|
| `fec6e328` | fix | Correção atômica: view aditiva + form (cobertura ao vivo) + testes + wording do PLAN |
| docs | docs | Registro desta seção no SUMMARY (hash no relatório de execução) |

---
