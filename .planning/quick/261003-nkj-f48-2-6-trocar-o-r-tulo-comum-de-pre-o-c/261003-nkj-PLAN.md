---
id: 261003-nkj
title: F48.2.6 — neutralizar rótulo comum do preço compilado
status: completed
scope: narrow-bug-fix
files_modified:
  - src/lib/lab/bench/domain/prompt-composer.ts
  - src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts
  - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
  - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/specs/lab-bench-prompt-policy/spec.md
  - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/design.md
  - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/tasks.md
  - .planning/STATE.md
  - .planning/HANDOFF.json
  - .planning/quick/261003-nkj-f48-2-6-trocar-o-r-tulo-comum-de-pre-o-c/261003-nkj-SUMMARY.md
---

# Quick Plan — 261003-nkj

## Objetivo

Alterar exclusivamente o rótulo comum do preço serializado no prompt compilado de `Preço promocional: {valor}` para `Preço de venda: {valor}`. O rótulo atual dá semântica promocional também a Destaque com um preço único; o rótulo neutro evita isso sem mudar nenhum valor numérico. A semântica de preço promocional continua responsabilidade exclusiva da política Oferta, com sua instrução existente de destacar o “preço por” quando aplicável.

## Contexto inspecionado

- `prompt-composer.ts` mantém `COMPOSER_VERSION = "48.2.4-prompt-composer-v1"`; o último ajuste de rótulo no núcleo em 261003-ltf preservou essa versão porque o contrato dizia versionar só a política Produto. Este ajuste é diferente: muda a serialização comum de dados, observável em prompts de todas as intenções e incorporada à evidência de preflight. Portanto, incrementar explicitamente para `48.2.4-prompt-composer-v2` nesta alteração é correto e necessário; não há restrição ativa dizendo que o compositor deve permanecer fixo. `produtoPolicy`, `ofertaPolicy` e demais políticas/versões permanecem intactas.
- `prompt-policy.contract.test.ts` contém o golden Oferta; `bench-api.contract.test.ts` já integra `POST /compose` com as políticas reais para as intenções. Estender o caso Destaque existente com um preço de 1999 centavos e sem preço original, e preservar/fortalecer a asserção Oferta existente.
- Active OpenSpec F48.2.6: `lab-bench-prompt-policy/spec.md`, `design.md` e `tasks.md` cobrem intenções e rótulos, mas não definem o rótulo comum de venda nem sua neutralidade semântica. Atualizar apenas documentação normativa relacionada, sem texto de políticas.
- `.planning/STATE.md`/`.planning/HANDOFF.json`: F48.2.6 Planos 01–09 completos, Plano 10 não iniciado; CHECKPOINT A aprovado para readiness local/documentos e B `not_started`. O prompt recomposto de Destaque ainda está aguardando revisão humana; esta quick task deverá atualizar tracking sem remover esse bloqueio e sem alterar esses estados.

## Escopo e limites

- Alterar só o rótulo da linha que serializa `discountedPriceText` e a versão do compositor; manter `priceCents`, `originalPriceCents` e qualquer outra linha de dados inalterados.
- Não modificar `ofertaPolicy`, qualquer texto/versão de política, `produtoPolicy`, label/versão do produto, adapters, APIs além de testes, runtime produtivo, prompt-base, banco/migrations, produção, UAT ou Plano 10/CHECKPOINT B.
- Sem provider, imagem, geração, run ou operação de banco.
- Documentar no summary o trecho real do prompt Destaque compilado e parar para revisão humana antes de geração.

## Tarefas

### 1. Neutralizar e versionar a serialização comum do preço

**Arquivos:** `src/lib/lab/bench/domain/prompt-composer.ts`, `src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts`

No `commercialLines`, trocar somente o label de `briefing.commercial.discountedPriceText` para `Preço de venda`, mantendo posição e dado de origem. Incrementar `COMPOSER_VERSION` para `48.2.4-prompt-composer-v2`, pois a serialização comum integra a evidência versionada do compositor. Atualizar golden Oferta apenas no label de preço e adicionar asserções no contrato de que o valor segue igual e a orientação literal existente da política Oferta continua exclusiva/inalterada; nenhuma string de `ofertaPolicy` deve ser editada. Provar explicitamente o composer version novo. Não ajustar outros labels, preços, policy versions ou prompt-base.

**Verificação automatizada:** `npm.cmd test -- --run src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts`.

### 2. Provar composição real em Destaque e retenção semântica de Oferta; alinhar OpenSpec

**Arquivos:** `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts`, `openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/specs/lab-bench-prompt-policy/spec.md`, `openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/design.md`, `openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/tasks.md`

No contrato integrado de `POST /compose`, use para Spotlight `campaignIntent="spotlight"`, `product={name:"Mouse sem fio",priceCents:1999}` sem propriedade `originalPriceCents`; confirme resposta 200, linha exata `Preço de venda: R$ 19,99`, ausência de `Preço promocional`, frase literal e versão `48.2.6-destaque-v1`, ausência da frase e versão `48.2.6-oferta-v1`, e `composerVersion="48.2.4-prompt-composer-v2"`. Mantenha caso Oferta com os dois valores já usados, afirmando label neutro, linha numérica preservada, frase Oferta literal e `48.2.6-oferta-v1`; nenhuma semântica Oferta deve ser emitida pelo rótulo comum. Revisar a origem da versão no composer real, sem fixture que substitua a composição integrada. Atualizar os cenários/requisito ativo da spec, decisão correspondente no design e item de teste em tasks para registrar que `Preço de venda` é campo neutro de dado e a semântica promocional pertence à política Oferta existente. Não reescrever nenhuma policy string nem mudar a baseline de políticas. Executar `npm.cmd test -- --run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` e `npx.cmd openspec validate fase-48-2-6-validacao-experimental-produto-intencoes-1-1 --strict`.

### 3. Validar gates, registrar trecho compilado e interromper para revisão humana

**Arquivos:** `.planning/STATE.md`, `.planning/HANDOFF.json`, `.planning/quick/261003-nkj-f48-2-6-trocar-o-r-tulo-comum-de-pre-o-c/261003-nkj-SUMMARY.md`

Executar `npm.cmd run typecheck`, `npm.cmd run lint`, `git diff --check` e validação JSON `node -e "JSON.parse(require('fs').readFileSync('.planning/HANDOFF.json','utf8'))"`; executar os testes direcionados das tarefas anteriores e OpenSpec strict. Atualizar somente o registro atual de STATE/HANDOFF para mencionar o label neutro, `COMPOSER_VERSION` v2, resultado de validação e trecho compilado real, mantendo fase ativa, Plans 01–09 completos, Plan10 não iniciado, CHECKPOINT A/B e todas as avaliações UAT exatamente no estado corrente; preservar o bloqueio que exige revisão humana antes de qualquer geração. Summary deve citar excerpt efetivamente produzido pelo teste/API: `Nome do produto obrigatório: Mouse sem fio` e `Preço de venda: R$ 19,99` junto à instrução/versão Destaque, confirmando ausência de Oferta/promotional phrase/version; registrar que não houve chamada externa, imagem, run ou banco. Se algum gate falhar, documentar literalmente como falho, sem contorno. Não iniciar tarefa humana aqui; encerrar indicando parada obrigatória para review humano do texto compilado antes de qualquer geração.

**Verificação automatizada:** `npm.cmd run typecheck`; `npm.cmd run lint`; `git diff --check`; `node -e "JSON.parse(require('fs').readFileSync('.planning/HANDOFF.json','utf8'))"`; testes das tarefas 1–2; `npx.cmd openspec validate fase-48-2-6-validacao-experimental-produto-intencoes-1-1 --strict`.

## Critérios de aceite

- Spotlight com preço único de R$ 19,99 compila o label neutro, não contém `Preço promocional` ou conteúdo/versão Oferta, e contém exatamente orientação/versão Destaque.
- Oferta ainda recebe `Preço de venda` com seus dados numéricos intactos e mantém a semântica promocional apenas por sua frase/policy inalterada.
- Compositor versionado como `48.2.4-prompt-composer-v2`; versões de políticas e os textos das políticas não mudam.
- Testes focados, typecheck, lint, OpenSpec strict e diff check executados e registrados com resultados reais.
- Prompt real compilado documentado; nenhuma geração é iniciada sem revisão humana explícita. Plan10 e CHECKPOINT B permanecem não iniciados.

## Limites de confiança

| Boundary | Risco | Mitigação |
|---|---|---|
| Dados comerciais → texto de prompt | Label atribui significado promocional indevido a preço comum | Label neutro comum; prova integrada separando apenas a semântica de intenção existente |
| Prompt compilado → evidência preflight | Versão não representa mudança serializada | Incrementar composer version e verificar contrato/version na resposta |
| Pacote de teste → ambiente externo | Execução acidental de provider, imagem ou dados | Apenas testes locais mocked; não rodar `/runs`, adapters, providers, storage ou banco |

## Saída

Criar `261003-nkj-SUMMARY.md` na execução. Após gates, aguardar revisão humana do trecho Destaque compilado antes de qualquer geração; não alterar status de fase/Plano 10/CHECKPOINT B.
