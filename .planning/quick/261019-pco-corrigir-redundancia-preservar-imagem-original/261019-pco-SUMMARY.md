---
id: 261019-pco
title: Corrigir redundância da checkbox "Preservar imagem original" no formulário de campanhas
status: done
workflow: none (escopo aprovado no pedido; implementação sem invocação de /gsd-quick)
scope: campaign-form-preserve-image-checkbox-legacy-only
process:
  command_invoked: false
  command: /gsd-quick (não invocado)
  artifacts: preparados manualmente e revisados posteriormente
  retroactive_execution_claimed: false
gates:
  automated_tests:
    new_regression: pass (8/8) — checkbox 6/6 + ordem no DOM 2/2 — `npx vitest run src/components/flow/__tests__/campaign-input-form.preserve-context.test.tsx`
    affected_form_suite: pass (26/26) — `npx vitest run src/components/flow/__tests__/campaign-input-form.test.tsx src/components/flow/__tests__/campaign-input-form.orientation.test.tsx src/components/flow/__tests__/campaign-input-form.preserve-context.test.tsx src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx src/components/flow/__tests__/campaign-input-form.unknown.test.tsx`
  typecheck: pass — `npm run typecheck`
  lint: pass — `npm run lint`
  build: pass — `npm run build`
  git_diff_check: pass — `git diff --check`
  visual_validation:
    status: partial
    checkbox_inspection: pass (inspeção local autenticada via HTML/DOM; seletor presente e checkbox ausente)
    order_and_keyboard: pending (sequência visual e navegação por teclado do complemento de ordem deixadas para conferência do responsável; não executadas)
  paid_calls: none
  provider: none
  commit_push_deploy: none
---

# Quick — 261019-pco — checkbox "Preservar imagem original" — SUMMARY

## Proveniência do workflow

- O **escopo foi aprovado no pedido do usuário**; o diagnóstico já estava
  conferido e o recorte definido.
- A implementação ocorreu **sem invocação do `/gsd-quick`**.
- Os artefatos desta quick foram **preparados manualmente e revisados
  posteriormente**.
- **Não houve execução retroativa fictícia** do comando: este registro reflete o
  processo real, sem alegar que o workflow foi executado.

## O que mudou

- `src/components/flow/campaign-input-form.tsx`
  - A checkbox passou de `fields.campaignIntent !== "offer"` para
    `!eligible && fields.campaignIntent !== "offer"`.
  - Novo fluxo elegível: o seletor de cenários (`backgroundDirection`) é o único
    controle de Estúdio/Ambientado/Original; a checkbox não é montada.
  - Legado (`eligible=false`): comportamento inalterado, inclusive em
    Destaque/Exclusivo; ausente em Oferta.
- `src/components/flow/__tests__/campaign-input-form.preserve-context.test.tsx` (novo)
  - Novo fluxo elegível (`spotlight`, `exclusive`, `offer`): seletor presente,
    checkbox ausente.
  - Legado (`spotlight`, `exclusive`): checkbox presente, seletor ausente.
  - Legado (`offer`): checkbox ausente.
  - Complemento: ordem no DOM — preços → intenção → selo; no novo fluxo, selo
    antes da direção de fundo.

## Complemento autorizado — ordem visual

- `IntentSelector` passou para antes do bloco completo de "Selo promocional" em
  `campaign-input-form.tsx`.
- Ordem resultante nos dois fluxos: **Preços → Intenção → Selo → Direção de fundo**
  (direção só quando elegível).
- Nenhum label, opção, obrigatoriedade, erro, handler, `disabled`, ID ou atributo
  de acessibilidade foi alterado; a checkbox permanece exclusiva do legado.

## Diff

```diff
-      {fields.campaignIntent !== "offer" && (
+      {/* F56.2b1b (B1B-D1): a checkbox legada só existe fora do novo fluxo.
+          Sob elegibilidade, `backgroundDirection` (Estúdio/Ambientado/Original)
+          é o ÚNICO controle dessa escolha — a checkbox seria redundante e
+          poderia contradizê-lo. Em `off`, o comportamento legado é preservado. */}
+      {!eligible && fields.campaignIntent !== "offer" && (
         <label className="flex items-start gap-3 cursor-pointer">
           <input
             type="checkbox"
```

Complemento de ordem: o bloco `<div>` de "Selo promocional" foi movido, sem
alteração de conteúdo, para depois do `<IntentSelector />` e antes do
`BackgroundDirectionSelector`.

## Resultados

### Testes automatizados (executados)

| Verificação | Comando | Resultado |
|---|---|---|
| Regressão nova | `npx vitest run src/components/flow/__tests__/campaign-input-form.preserve-context.test.tsx` | **8/8 pass** (checkbox 6/6 + ordem 2/2) |
| Suíte afetada do formulário (5 arquivos) | `npx vitest run src/components/flow/__tests__/campaign-input-form.test.tsx src/components/flow/__tests__/campaign-input-form.orientation.test.tsx src/components/flow/__tests__/campaign-input-form.preserve-context.test.tsx src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx src/components/flow/__tests__/campaign-input-form.unknown.test.tsx` | **26/26 pass** |
| Typecheck | `npm run typecheck` | **pass** |
| Lint | `npm run lint` | **pass** |
| Build | `npm run build` | **pass** |
| Whitespace do diff | `git diff --check` | **pass** |

### Validação visual (inspeção local executada)

- **Checkbox:** inspeção local autenticada executada via HTML/DOM — seletor de
  cenários presente e "Preservar imagem original" ausente.
- **Complemento de ordem:** sequência visual e navegação por teclado **não
  executadas**; ficam para conferência do responsável. Os testes de ordem cobrem
  apenas o DOM, não substituem a inspeção visual/teclado.
- Os resultados automatizados não substituem a UAT visual humana.

- `.dev.log` e demais mudanças preexistentes preservados; nenhuma flag, schema,
  hook, backend ou chamada paga alterada.

## Homologação local (2026-10-19)

- Destino exclusivo: `G:\Vendeo-Homolog` / `vendeo-homolog` (API 57781, DB 57782).
  **Sem produção, `--linked`, reset ou repair.**
- Backup pré-aplicação: `recovery/homolog-pre-261019-pco-20261019-222711.dump`
  (`A856F88F26EDAA8C9D6CC1E661391F3C2428F011673EE48B5F294C41ACB79742`).
- Pendentes aplicadas via `npx --no-install supabase --workdir "G:\Vendeo-Homolog" migration up --local`:
  - `20261019000001` — `92C722AB3CECF1DCAD81EE7286336A1E0B5B02D85ADDF94E14985D616752BB29`
  - `20261019000002` — `1F20FE4E5FF5FFA010615AA0FBE0B68810EE2105857DFFD79A38E219F2A5C759`
  - `20261019000003` — `FE44DB868D1281692C2BF55E1961034A808C79C5F7355F940CE869821ACE3557`
  - `20261019000004` — `FEB29D6302260BE478D17F30AB7DD72C2E9C21134099FDDE174DE10E1D702099`
- Ledger: **129 → 133** versões; dados preservados (`stores=2`, `campaigns=69`).
- Ativação via ação do painel `/admin/feature-flags`: modo **Somente lojas de teste**
  (`test_stores=true`, `all_stores=false`; autorização `test_stores` vigente).
  `VENDEO_GENERATION_PAUSED=true` mantido; nenhuma campanha gerada e nenhum
  provider chamado.
- Inspeção local autenticada de `/campanhas/nova`: seletor **Direção de fundo**
  presente (3 opções), `backgroundDirection` renderizado e **checkbox
  "Preservar imagem original" ausente** (0 ocorrências).

## Guardas

- Nenhum teste/guarda exigiu ajuste; a proteção existente do legado foi mantida
  sem afrouxamento.

## Regularização documental

- Sem novas mudanças funcionais, **sem commit, push ou deploy**.
- Contadores globais não recalculados; fase 56.2.7 e monitoramento beta não
  reabertos/alterados.
- Inspeção local da checkbox executada via página autenticada; **sequência visual
  e navegação por teclado do complemento de ordem pendentes do responsável**.
