---
id: 261003-jet
title: Corrigir keys e testids do painel de políticas da bancada
status: planned
scope: narrow-bug-fix
files_modified:
  - src/app/(app)/admin/laboratorio/bancada/_components/bench-policies-panel.tsx
  - src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx
  - .planning/STATE.md
---

# Quick Plan — 261003-jet

## Objetivo

Corrigir a identidade de linhas no `BenchPoliciesPanel`: usar `policy.id` como key estável e única e garantir `data-testid` distinto por política. Cobrir a regressão com Oferta, Destaque e Exclusivo simultâneos.

## Contexto inspecionado

- `.planning/STATE.md`: posição aponta F48.2.6; políticas da bancada habilitam Oferta, Destaque e Exclusivo.
- `src/app/(app)/admin/laboratorio/bancada/_components/bench-policies-panel.tsx`: atualmente usa `key={policy.dimension}` e `data-testid={`bench-policy-${policy.dimension}`}`, o que conflita quando políticas compartilham dimensão.
- `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`: testes e fixture `POLICIES` do painel existentes; adicionar o caso simultâneo nesta suíte.
- Scripts existentes: `npm test`, `npm run typecheck`, `npm run lint`.

## Escopo e limites

- Alterar somente o painel e seus testes afetados, além do summary/tracking GSD quick após execução.
- Não editar definições/registries de políticas, compositor, pricing, APIs, nem qualquer caminho produtivo fora do componente presentacional explicitamente nomeado.
- Não gerar imagens, não executar geração da bancada e não chamar provedores externos.

## Tarefas

### 1. Atualizar identidade de linhas e seletores

**Arquivos:** `src/app/(app)/admin/laboratorio/bancada/_components/bench-policies-panel.tsx`

Trocar a key do `<li>` para `policy.id`. Alterar o `data-testid` para incorporar `policy.id` (distinto para cada política, estável e seguro para `getByTestId`, por exemplo `bench-policy-${policy.id}`). Não mudar dimensões/valores das políticas nem comportamento do painel.

**Verificação automatizada:** o teste de contrato focado da tarefa 2 valida testids únicos.

### 2. Ajustar teste existente e adicionar regressão de intenções simultâneas

**Arquivos:** `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`

Atualizar as asserções existentes para usar testids derivados do ID da política. Adicionar teste que renderiza três itens distintos com a mesma dimensão `intencao`: `policy.intencao.oferta`/Oferta, `policy.intencao.destaque`/Destaque e `policy.intencao.exclusivo`/Exclusivo. Capturar `console.error` durante o render e afirmar que as três linhas/testids/textos estão presentes, os seletores são únicos e nenhum aviso de duplicate key do React foi emitido; restaurar o spy em `finally`/cleanup.

**Verificação automatizada:** `npx vitest run "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"`.

### 3. Validar gates e atualizar tracking GSD quick

**Arquivos:** `.planning/quick/261003-jet-corrigir-bench-policies-panel-para-usar-/261003-jet-PLAN.md`, `.planning/STATE.md`, `.planning/quick/261003-jet-corrigir-bench-policies-panel-para-usar-/261003-jet-SUMMARY.md`

Rodar o teste focado, `npm run typecheck` e `npm run lint`; registrar comandos, resultados e escopo não tocado no summary. Atualizar a tabela `Quick Tasks Completed` e `Session Continuity` no STATE para registrar a conclusão. Se algum gate falhar, registrar resultado real e não declarar conclusão verde; não ampliar escopo.

**Verificação automatizada:** comandos focados acima, `npm run typecheck` e `npm run lint`.

## Critérios de aceite

- O `<li>` tem key `policy.id`; nenhum key baseado somente em `policy.dimension` permanece neste painel.
- Cada política renderizada tem `data-testid` derivado do ID completo e distinto.
- Regressão simultânea de Oferta, Destaque e Exclusivo atesta as três linhas e não detecta aviso React de key duplicada.
- Teste focado, typecheck e lint executados e resultados documentados.
- Escopo restrito; sem geração de imagem ou chamada externa.
- Summary e tracking quick atualizados na execução.
