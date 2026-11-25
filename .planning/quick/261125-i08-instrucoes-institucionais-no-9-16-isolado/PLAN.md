---
quick_id: 261125-i08
title: Instruções institucionais existentes na base 1:1 do 9:16 isolado
date: 2026-11-25
status: completed
entrypoint: /gsd-quick
scope: product-1-1-prompt-composition
plan_type: execute
wave: 1
depends_on: [261125-i05, 261125-i06, 261125-i07]
autonomous: true
branch: feat/apenas-duas-imagens-de-entrada
worktree_isolation: false
supersedes: plano anterior (não materializado; escopo amplo revogado)
approval:
  status: approved
  note: Aprovado com duas correções documentais — productName comprova coexistência com o nome do produto (não título promocional); ressalva de 409 restrita a campanha persistida sem operação existente.
files_modified:
  - src/app/api/campaign/generate-image/route.ts
  - src/lib/product-1-1/identity-context.ts
  - src/app/api/campaign/generate-image/__tests__/route.test.ts
  - src/lib/product-9-16-two-stage/orchestration/__tests__/base-step.contract.test.ts
  - src/lib/product-1-1/__tests__/identity-context.contract.test.ts
  - openspec/specs/product-1-1-prompt-composition/spec.md
---

# Plano

## Substituição de plano

Este plano substitui integralmente o plano anterior da mesma quick, apresentado
apenas em conversa e não materializado em `.planning/`. O escopo anterior
(confirmação de assinatura visual, decisão de versionamento e captura no harness
de jornada) está revogado. Nenhuma tarefa herdada foi ou será executada.

O item 1 de `deferred-items.md` da quick 261125-i07 é atendido **somente para o
9:16 isolado**; o fluxo conjunto 1:1+9:16 continua reservado para outra quick.

## Objetivo

Evitar que o compositor omita a identificação institucional da loja na base 1:1
do 9:16 isolado por interpretar o título promocional como substituto dela,
reutilizando as redações aprovadas existentes.

## Alteração funcional

Em `src/app/api/campaign/generate-image/route.ts`, estender ao 9:16 isolado a
ativação das duas opções já existentes:

```ts
textOnlyInstitutionalIdentity:
  requestedFormat === "1:1" || requestedFormat === "9:16",
logoInstitutionalIdentity:
  requestedFormat === "1:1" || requestedFormat === "9:16",
```

Nada mais muda na produção:

- `identityState`, `hasIdentityAsset` e `typographyDirection` permanecem;
- assinatura visual (`i05`) não é modificada;
- o joint 1:1+9:16 sai antes deste bloco;
- congelamento, snapshot, persistência, reconstrução e retomada são os existentes;
- `48.2.6-identity-context-v4` permanece; helpers e redações não mudam.

Apenas comentários diretamente afetados em `route.ts` e `identity-context.ts`
são atualizados para não afirmar que o 9:16 isolado fica fora dessas ativações.

## Testes

- `route.test.ts` (describe 9:16): atualizar os dois testes que exigiam exclusão
  (`text_only` e `logo` com ativo); adicionar fallback de `logo` sem ativo e
  regressão de `visual_signature` com ativo. O teste com `productName` contendo
  o nome da loja comprova **coexistência com o nome do produto**, não é evidência
  de título promocional.
- `base-step.contract.test.ts`: um caso reutilizando `durableRow` para provar que
  a diretiva congelada chega verbatim ao `SquareBaseInput`.
- `identity-context.contract.test.ts`: somente comentários de fronteira
  (joint/9:16 → joint).
- Reutilizar sem alteração: prompt compartilhado, reconstrução, 1:1 isolado e
  joint. Não ampliar o harness de jornada.

## Documentação

- `openspec/specs/product-1-1-prompt-composition/spec.md`: incluir o 9:16
  isolado nos dois requisitos existentes, remover sua exclusão dos cenários e
  acrescentar cenário da base 1:1 do 9:16 isolado.
- Artefatos desta quick e registro no `.planning/STATE.md` ao encerrar.

## Limites

Orientação comum de contraste (incluindo a referência a logo/assinatura no 9:16
`text_only`), fluxo conjunto, 1:1 isolado, compositor, prompt-base, anexos,
modelo, qualidade, cobrança, entrega, expansão, legado e Laboratório permanecem
intactos. A divergência de contraste é conscientemente aceita.

Campanha 9:16 persistida **sem operação existente**, reenviada com a mesma
`campaignId` e diretiva divergente, pode retornar `409 operation_identity_conflict`
pelo contrato determinístico existente; snapshots não são reescritos.

## Validação

Testes focados, `typecheck`, `lint`, `build`, `openspec validate` strict da spec
afetada e `git diff --check`. Falhas preexistentes são separadas. `.f62-check/`
preservada. Sem push, merge, deploy, migrations, banco/Storage ou chamadas pagas.

## Encerramento local e aceite visual (2026-11-25)

- **Implementação e testes locais concluídos.** Implementação em `60bfa6b4`;
  tracking documental em commit local de fechamento.
- **Aceite visual registrado (caso observado):**
  `C:/Users/wagne/Downloads/caixa_multiuso_fishbox-2026-11-25.jpg` — resultado
  9:16 com logotipo institucional "LOJA MEGA VALE" presente e legível;
  identificação institucional distinta do título promocional "Natal Mega Vale";
  textos apresentados legíveis. O usuário confirmou a preservação do texto de
  detalhe e do logotipo.
- **Escopo do aceite:** cobre **somente** essa geração com logotipo. Não valida
  manualmente `text_only`, `visual_signature`, outras lojas ou todas as gerações.
  Não houve comparação independente de fidelidade ao ativo nem inspeção separada
  da base quadrada.
- **Cobertura manual não realizada:** `text_only`, `visual_signature`, outras
  lojas e todas as gerações permanecem sem validação visual nesta quick.
- **Fora desta quick:** o pouco destaque visual do tema natalino em estúdio
  permanece reservado ao escopo futuro de temas/cenários.
- **Publicação não executada:** sem push, merge, deploy, ativação, migrations,
  banco/Storage ou chamadas pagas de IA. `.f62-check/` preservada.
- **Próxima quick separada:** fluxo conjunto 1:1+9:16, ainda **não implementado**.
