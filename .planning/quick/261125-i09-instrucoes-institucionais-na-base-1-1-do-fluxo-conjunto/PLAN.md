---
quick_id: 261125-i09
title: Instruções institucionais aprovadas na base 1:1 do fluxo conjunto 1:1+9:16
date: 2026-11-25
status: completed
entrypoint: /gsd-quick
scope: product-1-1-prompt-composition
plan_type: execute
wave: 1
depends_on: [261125-i05, 261125-i06, 261125-i07, 261125-i08]
autonomous: true
branch: feat/apenas-duas-imagens-de-entrada
worktree_isolation: false
approval:
  status: approved
  note: Aprovado sem achados bloqueantes. Correção solicitada — “sem alteração de identityDirective” deve ser lido como “sem alteração do mecanismo de transporte e congelamento de identityDirective”; o conteúdo da diretiva será ajustado intencionalmente.
files_modified:
  - src/lib/product-two-format/orchestration/joint-initial-snapshot.ts
  - src/lib/product-1-1/identity-context.ts
  - src/app/api/campaign/generate-image/route.ts
  - src/lib/product-two-format/orchestration/__tests__/handle-joint-generate.contract.test.ts
  - src/lib/product-1-1/__tests__/identity-context.contract.test.ts
  - src/app/api/campaign/generate-image/__tests__/route.test.ts
  - openspec/specs/product-1-1-prompt-composition/spec.md
---

# Plano

## Objetivo

Fazer a montagem inicial do fluxo conjunto 1:1+9:16 fornecer ao compositor da
base quadrada as mesmas instruções institucionais já aprovadas e usadas no 1:1
isolado e no 9:16 isolado (`visual_signature`, `text_only` e `logo`), sem alterar
o restante do processamento.

## Alteração funcional

Ponto único: a chamada existente de `buildNewFlowIdentityBlock` em
`src/lib/product-two-format/orchestration/joint-initial-snapshot.ts` passa a
receber:

```ts
identityState: effectiveIdentitySnapshot.identityState,
hasIdentityAsset: identityImage !== null,
typographyDirection:
  effectiveIdentitySnapshot.brandProfile?.typography_direction ?? null,
textOnlyInstitutionalIdentity: true,
logoInstitutionalIdentity: true,
```

Os dados já estão disponíveis no caminho:

- `effectiveIdentitySnapshot` é a identidade efetiva;
- `identityImage` é a prova de validação + conversão efetiva para `data URL`;
- o perfil já resolvido fornece `typography_direction` verbatim;
- os opt-ins são explícitos porque o módulo só atende o fluxo conjunto.

Nada mais muda na produção: helpers, redações, `48.2.6-identity-context-v4`,
compositor compartilhado, prompt-base, ordem dos blocos, cenário, congelamento,
snapshots, persistência, reconstrução, retomada, expansão, entrega, anexos,
modelo, qualidade, reservas, cobrança, legado, Laboratório e campanhas
existentes permanecem intactos.

Não há alteração do mecanismo de transporte e congelamento de `identityDirective`
(`resumeContext.identityDirective` + `inputSnapshot.identityDirective`); o
**conteúdo** da diretiva passa a incluir as redações aprovadas, como pretendido.

## Testes

- Atualizar o teste conjunto de `logo` com arquivo para exigir a instrução
  oficial do logotipo, uma única vez, no lugar da exclusão anterior.
- Acrescentar, no harness offline existente, casos de montagem inicial:
  `text_only` com e sem tipografia; `logo` sem arquivo; `visual_signature` sem
  arquivo; `visual_signature` com arquivo.
- Provar congelamento (`inputSnapshot.identityDirective ===
  resumeContext.identityDirective`).
- Reutilizar sem alteração `base-step.contract.test.ts` (repasse verbatim),
  `prompt.contract.test.ts` (entrada no prompt), `route.test.ts` (1:1 e 9:16
  isolados) e demais testes conjuntos.
- Renomear os rótulos “fronteira joint” do helper para “chamador sem opt-in”,
  sem alterar asserções.
- Não ampliar o harness de jornada nem criar infraestrutura de teste.

## Documentação

- `openspec/specs/product-1-1-prompt-composition/spec.md`: incluir a montagem
  inicial conjunta nos três modos, remover o joint das exclusões, ajustar o
  cenário de legado/Laboratório e acrescentar cenário da montagem conjunta.
- Comentários diretamente afetados em `identity-context.ts` e `route.ts`.
- Artefatos desta quick e registro no `.planning/STATE.md` ao encerrar.

## Limites

- 1:1 isolado e 9:16 isolado permanecem intactos.
- Orientação comum de contraste (inclusive no `text_only`) permanece intocada; a
  divergência já aceita não é reaberta.
- Temas, versionamento e arquitetura não são reabertos.
- O aceite visual é posterior e do usuário: uma geração conjunta avaliando a
  identificação institucional nos resultados 1:1 e 9:16. Testes de montagem e
  transporte não comprovam aderência visual da IA.
- Campanha conjunta persistida com diretiva antiga, reenviada sem operação
  existente, pode retornar `409 operation_identity_conflict` pelo contrato
  determinístico existente; snapshots não são reescritos.

## Validação

Testes focados, `typecheck`, `lint`, `build`, OpenSpec strict da spec afetada e
`git diff --check`. Falhas preexistentes são separadas. `.f62-check/` preservada.
Sem push, merge, deploy, migrations, banco/Storage ou chamadas pagas de IA.

## Encerramento local (2026-11-25)

- **Implementação local concluída** em `7ec6b868` (código e testes) e
  `dcdae5a0` (spec, plano e resumo). Sem publicação.
- **Correção pontual de typecheck autorizada** em `route.test.ts`: os 4 erros
  `TS18047` vinham dos testes da quick 261125-i08; o registro anterior de
  typecheck aprovado foi contradito pela verificação posterior da i09. Narrowing
  explícito antes de `split`, sem non-null assertion/coerção/supressão.
  `npm run typecheck` reexecutado: **exit 0**. `route.test.ts`: **121 testes
  PASS**.
- **Aceite visual registrado (restrito):** geração conjunta aprovada pelo
  usuário — 1:1 `C:/Users/wagne/Downloads/caixa_multiuso_fishbox-2026-11-25 (2).jpg`
  e 9:16 `C:/Users/wagne/Downloads/caixa_multiuso_fishbox-2026-11-25 (1).jpg`.
  Logotipo “LOJA MEGA VALE” presente e legível em ambos, distinto do título
  promocional “Natal Mega Vale”; detalhes textuais preservados e legíveis.
- **Escopo do aceite:** somente essa geração com logotipo. Não valida
  `text_only`, `visual_signature`, outras lojas ou todas as gerações; fidelidade
  ao ativo não medida independentemente; não implica publicação ou aprovação para
  produção.
- **Observação futura:** gerações ambientadas apresentaram maior elaboração
  temática natalina que exemplos em estúdio; hipótese sobre interação
  cenário×tema, sem comprovação de causa. Não investigado nesta quick.
- **Sem push, merge, deploy, migrations, banco/Storage ou IA paga.**
  `.f62-check/` preservada.
