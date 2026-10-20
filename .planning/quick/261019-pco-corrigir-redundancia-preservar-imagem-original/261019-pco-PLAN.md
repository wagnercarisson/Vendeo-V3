---
id: 261019-pco
title: Corrigir redundância da checkbox "Preservar imagem original" no formulário de campanhas
status: done
workflow: none (escopo aprovado no pedido; implementação sem invocação de /gsd-quick)
scope: campaign-form-preserve-image-checkbox-legacy-only
approval:
  by: usuário
  date: 2026-10-19
  origin: diagnóstico conferido no formulário de campanhas (novo fluxo Produto 1:1 vs legado)
  scope_approved_in_request: true
process:
  command_invoked: false
  command: /gsd-quick (não invocado)
  artifacts: preparados manualmente e revisados posteriormente
  retroactive_execution_claimed: false
files_modified:
  - src/components/flow/campaign-input-form.tsx
  - src/components/flow/__tests__/campaign-input-form.preserve-context.test.tsx
---

# Quick Plan — 261019-pco — checkbox "Preservar imagem original" só no legado

## Diagnóstico

- `BackgroundDirectionSelector` é montado apenas com `eligible=true` (novo fluxo)
  e já define Estúdio/Ambientado/Original.
- A checkbox "Preservar imagem original" aparecia em Destaque/Exclusivo
  independentemente de `eligible`, permitindo escolha contraditória com
  `backgroundDirection`.

## Proveniência do workflow

- O **escopo foi aprovado no pedido do usuário** (diagnóstico e recorte já
  conferidos).
- A implementação ocorreu **sem invocação do `/gsd-quick`**.
- Este PLAN/SUMMARY foi **preparado manualmente e revisado posteriormente**.
- **Não houve execução retroativa fictícia** do comando; o registro descreve o
  processo real.

## Implementação

1. Renderizar a checkbox somente em `!eligible && fields.campaignIntent !== "offer"`.
2. No novo fluxo elegível, manter apenas o seletor de cenários como controle da
   escolha (inclusive em Destaque/Exclusivo).
3. Preservar integralmente o comportamento legado da checkbox, incluindo o fluxo
   com a flag desligada (`eligible=false`), e sua ausência em Oferta.

## Complemento autorizado — ordem visual

- **Objetivo:** mostrar "Intenção da campanha" antes de "Selo promocional", pois a
  intenção determina as opções de selo.
- **Ordem:** Preços → Intenção da campanha → Selo promocional → Direção de fundo
  (quando elegível).
- **Implementação:** bloco completo do selo movido para imediatamente após o
  `IntentSelector`, nos fluxos novo e legado.
- **Preservado:** labels, opções, obrigatoriedade, mensagens de erro, handlers,
  `disabled`, IDs e atributos de acessibilidade.
- **Checkbox:** mantida a correção anterior — "Preservar imagem original" somente
  no legado.
- **Não alterado:** regras de intenção/selo, hook, payloads, schemas, prompts,
  backend, banco, flags, configuração, provider e geração paga.

## Fora do escopo (não tocado)

- `preserveImageContext` global, hook, payloads, schemas, prompts, snapshots,
  recuperação, backend, flags, autorizações, modelos, pricing, créditos, banco.
- Fase 56.2.7 e acompanhamento beta.

## Validação

- **Automatizada** (executada): testes da checkbox + ordem no DOM, testes afetados,
  `typecheck`, `lint`, `build` e `git diff --check`, com os comandos registrados no
  SUMMARY.
- **Visual/manual**: inspeção local autenticada executada em `/campanhas/nova`
  para a checkbox (seletor presente, checkbox ausente). **Sequência visual e
  navegação por teclado do complemento de ordem permanecem para conferência do
  responsável — não executadas.**
- Sem provider, sem geração paga.

## Parada

Sem novas mudanças funcionais, commit, push ou deploy nesta regularização.
Sequência visual e navegação por teclado pendentes de conferência do responsável.
