# Phase 61 — OPSX Verify (implementation vs OpenSpec)

**Change:** `padronizar-chips-formatos-campanhas`
**Data:** 2026-11-22
**Implementação final:** `61-05` (aceito técnico e visual/funcionalmente por declaração do responsável)
**Status:** **PASS COM RESSALVAS — nenhum blocker; sync/archive executados em 2026-11-22; publicação não executada.**

## Summary

| Dimension | Status |
|---|---|
| Completeness | **72/72 tasks**; 1 capability nova (`campaign-format-presentation`) + 3 capabilities modificadas |
| Correctness | Requisitos e cenários cobertos pelo componente compartilhado, três superfícies e testes dirigidos |
| Coherence | Decisões do design seguidas; sem alteração de modelo/entrega/financeiro/consultas |

## Evidência de completude

- `openspec validate --strict`: **válido**.
- `openspec list --json`: **72/72 tasks; status complete**.
- Deltas: 12 ADDED em `campaign-format-presentation`, 2 MODIFIED em `campaign-list-ui`, 1 ADDED + 2 MODIFIED em `campaign-page-ui`, 1 MODIFIED em `dashboard-operational-composition`.
- Implementação final: `src/components/campaign/campaign-format-chips.tsx`, `src/app/(app)/campanhas/client.tsx`, `src/app/(app)/campanhas/[id]/client.tsx`, `src/components/dashboard/available-campaign-card.tsx`, `src/components/dashboard/dashboard-campaigns.tsx`, `src/app/(app)/dashboard/page.tsx`.
- Testes/evidências: revisão do responsável **12 arquivos/168 testes PASS** (167 afetados + baseline); verificador **16 arquivos/204 testes PASS**; baseline em leitura antes/depois; JSON original preservado.
- Evidência anterior do executor: typecheck/lint/build exit 0; suíte global **844 arquivos/10.488 testes PASS, 10 skipped**; `git diff --check c971d631..HEAD` limpo; árvore limpa.

## Correctness — requisitos principais

| Requisito | Evidência |
|---|---|
| Dois formatos sempre presentes, nomes compactos | componente compartilhado; testes de componente/lista/dashboard/detalhe |
| Sem “?” separado; chip é o único controle | `campaign-format-chips.tsx` sem `HELP_BUTTON_CLASS`/botão dedicado; `<a>` só entregue com `href`, `<button type="button">` nos demais |
| Detalhe entregue seleciona no primeiro toque | link `<a href>` sem interceptação/`preventDefault`; teste dedicado |
| Chip não entregue/excepcional só explica | `<button type="button">` sem navegação/geração; testes de detalhe |
| Lista/dashboard só explicam | `<button>` sem `href`; testes de lista/dashboard |
| Estado acessível completo | `aria-label` nome + estado + “Selecionado”; descrição `hidden` + `aria-describedby`; `aria-current` no link ativo |
| Entregue × ausente não só cor | entregue `border-2`/preenchimento; ausente borda simples/cinza; ativo anel/fundo; excepcionais indicador pequeno |
| Ajuda flutuante sem deslocamento | portal pós-mount, `position: fixed`, ancorada no chip, clamp viewport/overflow, `lang={helpLang}`, um popover por instância |
| Fechamento/foco/listeners | hover/foco/click, fora/Escape, foco devolvido com supressão, cleanup de scroll/resize/pointerdown |
| Preservação | `?format=` estrito, preview/download, gates, polling, recuperação, abrir/baixar, miniaturas, contagens, pt-BR/es-419 e zero consultas |
| Sem alteração de autoridade | `src/lib/product-two-format/**` e `format-resolution.ts` fora do diff; builders/read model intocados |

## Coherence — design

- Chips compactos e ajuda ancorada no chip seguem `design.md` §4/§9.
- Sem nova dependência: `createPortal`/hooks existentes.
- Sem consulta/efeito novo: builders e DTOs reutilizados; baseline comparativa sem recaptura.
- `61-03` aceito no resultado final; `61-04` superseded sem aprovação retroativa; `61-05` é a correção final.

## Issues

**CRITICAL:** nenhum.

**WARNING:**
1. O aceite visual/funcional é **declaração do responsável** em 2026-11-22, sem capturas, medições ou viewports fornecidos. `61-05-VISUAL-CHECK.md` registra isso explicitamente; nenhuma medição foi inventada.
2. “Um popover por vez” é garantido por instância do componente; lista/dashboard com múltiplos cards podem, em teoria, manter popovers pinned em cards distintos. Risco baixo; não é requisito bloqueante desta fatia.
3. Build e suíte global são evidência do executor, não reexecutados na revisão do responsável.

**SUGGESTION:**
- Se o produto quiser exclusividade global de popover entre cards, tratar em fatia futura; não altera o contrato atual.

## Final assessment

**Nenhum blocker OpenSpec.** Implementação coerente com specs/design e tasks 72/72. As quatro capabilities foram sincronizadas e validadas individualmente com `--strict`; a change foi arquivada em `openspec/changes/archive/2026-11-22-padronizar-chips-formatos-campanhas/` com `--skip-specs` (sync manual prévio). **Nenhum merge/push/deploy ou publicação foi executado.**
