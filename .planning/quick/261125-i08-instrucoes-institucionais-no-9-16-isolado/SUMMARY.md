---
quick_id: 261125-i08
title: Instruções institucionais existentes na base 1:1 do 9:16 isolado
date: 2026-11-25
status: completed
entrypoint: /gsd-quick
scope: product-1-1-prompt-composition
branch: feat/apenas-duas-imagens-de-entrada
subsystem: prompt-composition
tags: [product-9-16, identity-context, text-only, logo, prompt, openspec]
supersedes: plano anterior (não materializado; escopo amplo revogado)

# Dependency graph
requires:
  - quick: 261125-i06
    provides: redação de identificação institucional em texto e tipografia persistida
  - quick: 261125-i07
    provides: redação do logotipo oficial e versão v4
provides:
  - ativação das duas instruções institucionais existentes na base 1:1 do 9:16 isolado
affects: [product-1-1-prompt-composition, product-9-16-two-stage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Ativação por formato na rota, reutilizando helpers e redações congeladas
    - Diretiva institucional transportada pelo identityDirective já congelado

key-files:
  modified:
    - src/app/api/campaign/generate-image/route.ts
    - src/lib/product-1-1/identity-context.ts
    - src/app/api/campaign/generate-image/__tests__/route.test.ts
    - src/lib/product-9-16-two-stage/orchestration/__tests__/base-step.contract.test.ts
    - src/lib/product-1-1/__tests__/identity-context.contract.test.ts
    - openspec/specs/product-1-1-prompt-composition/spec.md

key-decisions:
  - "Somente a ativação na rota muda; helpers, redações e versão 48.2.6-identity-context-v4 permanecem"
  - "Assinatura visual, orientação comum de contraste e fluxo conjunto não foram tocados"
  - "Nenhum campo de snapshot, persistência ou reconstrução foi criado"
  - "Teste com productName contendo o nome da loja comprova coexistência com o nome do produto, não título promocional"
---

# Summary

## Resultado

A base 1:1 do **9:16 isolado** passou a receber as instruções institucionais
existentes e aprovadas para `text_only` e `logo`, reutilizando integralmente os
helpers `buildTextOnlyInstruction` e `buildLogoInstruction`.

A alteração funcional ficou restrita a
`src/app/api/campaign/generate-image/route.ts`: as opções
`textOnlyInstitutionalIdentity` e `logoInstitutionalIdentity`, antes ativas
apenas em `requestedFormat === "1:1"`, agora também são ativadas em
`requestedFormat === "9:16"`.

## O que permaneceu intacto

- `48.2.6-identity-context-v4`, helpers, redações e baseline;
- assinatura visual (`i05`) e sua implementação;
- orientação comum de contraste, inclusive a referência a logo/assinatura no
  9:16 `text_only` (divergência conscientemente aceita);
- 1:1 isolado e fluxo conjunto 1:1+9:16;
- compositor compartilhado, prompt-base, ordem dos blocos e cenário;
- congelamento, snapshot, persistência, reconstrução e retomada;
- expansão vertical e etapas posteriores;
- anexos, modelo, qualidade, cobrança e entrega;
- legado, Laboratório e campanhas existentes.

## Congelamento e transporte

A diretiva continua sendo transportada pelos mecanismos existentes:
`identityDirective` no `input_snapshot` e no `resumeContext`, restaurada
verbatim pela reconstrução e encaminhada ao `SquareBaseInput`. Nenhum campo novo
foi criado.

## Testes executados

| Arquivo | Resultado |
|---|---|
| `src/app/api/campaign/generate-image/__tests__/route.test.ts` | **121 PASS** |
| `src/lib/product-9-16-two-stage/orchestration/__tests__/base-step.contract.test.ts` | **10 PASS** |
| `src/lib/product-1-1/__tests__/identity-context.contract.test.ts` | **PASS** (parte dos 66) |
| `src/lib/campaign/square-base/__tests__/prompt.contract.test.ts` | **PASS** (parte dos 66) |
| `src/lib/product-1-1/__tests__/prompt-composition.contract.test.ts` | **PASS** (parte dos 66) |
| `src/lib/product-two-format/orchestration/__tests__/handle-joint-generate.contract.test.ts` | **7 PASS** |

Total focado: **6 arquivos, 204 testes PASS**. Nenhum teste novo de harness de
jornada foi criado.

Cobertura relevante:

- 9:16 `text_only` recebe nome institucional e tipografia uma única vez, sem o
  texto antigo; o nome do produto contendo o nome da loja coexiste com a
  identificação institucional (não é evidência sobre título promocional);
- 9:16 `logo` com ativo recebe a redação oficial uma única vez, sem tipografia;
- 9:16 `logo` sem ativo preserva o fallback anterior;
- 9:16 `visual_signature` permanece com a instrução aprovada;
- snapshot e `resumeContext` carregam a mesma diretiva;
- a diretiva congelada chega verbatim ao input da base;
- 1:1 isolado e joint permanecem preservados.

## Gates

| Gate | Resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `npx openspec validate product-1-1-prompt-composition --type spec --strict` | válido |
| `git diff --check` | limpo |

A falha preexistente do `legacy-frontier.guard` (`form-rules.ts`, quick
261125-eo7) não foi executada nem corrigida nesta quick; permanece fora do
escopo.

## Evidências apenas revisadas

- Caminho de reconstrução e composição da base (revisão de código e testes
  existentes);
- aderência visual geral da IA: **não comprovada** por testes.

## Aceite visual do caso observado

- **Geração aprovada:** `C:/Users/wagne/Downloads/caixa_multiuso_fishbox-2026-11-25.jpg`.
- **Resultado observado:** resultado 9:16 com logotipo institucional "LOJA MEGA
  VALE" presente e legível; identificação institucional distinta do título
  promocional "Natal Mega Vale"; textos apresentados legíveis. O usuário
  confirmou a preservação do texto de detalhe e do logotipo.
- **Escopo do aceite:** cobre **somente** essa geração com logotipo. Não valida
  manualmente `text_only`, `visual_signature`, outras lojas ou todas as gerações.
- **Limite da evidência:** não houve comparação independente de fidelidade ao
  ativo nem inspeção separada da base quadrada. Os testes automatizados provam
  montagem, isolamento e transporte do prompt, **não** a aderência visual geral
  da IA.
- **Fora desta quick:** o pouco destaque visual do tema natalino em estúdio
  permanece reservado ao escopo futuro de temas/cenários.

**Cobertura manual não realizada:** `text_only`, `visual_signature`, outras lojas
e todas as gerações permanecem sem validação visual nesta quick.

## Publicação

Implementação **local**. Publicação **não executada**: sem push, merge, deploy,
ativação, migrations, banco/Storage ou chamadas pagas de IA. `.f62-check/`
preservada integralmente.

## Ressalva de reenvio

Campanha 9:16 persistida **sem operação existente**, reenviada com a mesma
`campaignId` e diretiva divergente, pode retornar `409 operation_identity_conflict`
pelo contrato determinístico existente. Snapshots não são reescritos.

## Próxima quick separada

O fluxo conjunto **1:1+9:16** permanece reservado para uma quick separada,
**ainda não implementada**. Esta quick não alterou o joint nem suas instruções.

## Commit

`60bfa6b4` — `feat(261125-i08): ativar instrucoes institucionais no 9:16 isolado`.
