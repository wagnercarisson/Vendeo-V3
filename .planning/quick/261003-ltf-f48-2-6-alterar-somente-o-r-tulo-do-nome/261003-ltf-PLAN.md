---
id: 261003-ltf
title: F48.2.6 — alterar somente o rótulo do nome no prompt compilado
status: completed
scope: narrow-bug-fix
files_modified:
  - src/lib/lab/bench/domain/prompt-composer.ts
  - src/lib/lab/bench/domain/policies/produto.ts
  - src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts
  - src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx
  - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/proposal.md
  - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/specs/lab-bench-prompt-policy/spec.md
  - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/design.md
  - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/tasks.md
  - .planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT.md
  - .planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT-MANIFEST.md
  - .planning/STATE.md
  - .planning/HANDOFF.json
  - .planning/quick/261003-ltf-f48-2-6-alterar-somente-o-r-tulo-do-nome/261003-ltf-PLAN.md
  - .planning/quick/261003-ltf-f48-2-6-alterar-somente-o-r-tulo-do-nome/261003-ltf-SUMMARY.md
---

# Quick Plan — 261003-ltf

## Objetivo

Aplicar somente a correção aprovada na política do nome: o texto serializado pelo composer passa de `Produto: {nome}` para `Nome do produto obrigatório: {nome}`. Preservar literalmente, sem nenhuma alteração, a frase `Nome: completo, sem alterar palavras; capitalização, quebras de linha e arranjo livres.` Não adicionar regra alguma e não alterar prompt-base. Versionar somente a política Produto como `48.2.6-produto-v2`; manter `COMPOSER_VERSION` inalterada conforme o contrato ativo, que distingue versões de políticas e do compositor.

## Contexto inspecionado

- `docs/fluxo-de-desenvolvimento.md`, `AGENTS.md` e `.planning/STATE.md`: F48.2.6 está em execução, Planos 01–09 concluídos, Plano 10 ainda não iniciado e CHECKPOINT B não iniciado. O fluxo distingue OpenSpec como fonte normativa e GSD como execução/tracking.
- Plano `48-2-6-10-PLAN.md`: reserva avaliação humana de CHECKPOINT B e closeout para etapa posterior; este quick task para nos gates e encaminha para revisão humana, sem iniciar o plano.
- OpenSpec ativo: `proposal.md`, `lab-bench-prompt-policy/spec.md`, `design.md` e `tasks.md` definem política e versionamento. Ajustar somente o rótulo como comportamento da política e refletir o relato do usuário no registro UAT; a avaliação observada não altera a capability normativa `lab-bench-intent-uat`. Não executar lifecycle OpenSpec.
- `src/lib/lab/bench/domain/prompt-composer.ts` serializa a linha de dados do nome. `policies/produto.ts` fornece a frase de preservação e a versão da política. Não mudar o composer version.
- `prompt-policy.contract.test.ts` contém asserções de texto da política e do prompt compilado, incluindo o golden esperado. `bench-ui.contract.test.tsx` contém mocks ativos com a versão Produto v1, que devem acompanhar a v2. `bench-execution.contract.test.ts` contém fixture manual de prompt aprovado (`Produto: Coca-Cola 2 L`) pertencente a outro contrato e deve permanecer intocado; não ampliar teste compositor sem assertion afetada direta.
- UAT atual e manifesto não possuem evidência desta primeira geração relatada agora. Registrar somente relato do usuário: primeira geração NovaTek/Oferta precisa de ajuste porque omitiu “Mouse sem fio”; usuário confirma imagem do mouse fiel e aceita frases criativas genéricas; preço, selo, validade e textos obrigatórios presentes. Run ID, custo, latência, snapshot, preset/modelo/metadata e demais evidências não fornecidos permanecem unspecified/pending.

## Escopo e limites

- Mudança funcional limitada ao rótulo serializado e à versão v2 da política Produto; frase de preservação do nome é byte a byte idêntica.
- Atualizar somente as assertions/fixtures de texto e versão afetadas, delta OpenSpec ativo correspondente, UAT/manifesto documental e tracking GSD.
- Registrar o UAT como observação do usuário com decisão “requer ajuste”; não inferir qualquer metadado desconhecido.
- Não alterar prompt-base, políticas diferentes de Produto, adapters, provider, runtime, pricing, banco/migrations, produção, API ou contratos de evidência não relacionados.
- Nenhum provider, imagem, run ou geração. Não iniciar CHECKPOINT B nem Plano 10, não marcar B aprovado e não executar `/opsx-verify`, `/opsx-sync` ou `/opsx-archive`.
- Após testes e gates, deixar HANDOFF/STATE indicando espera por revisão humana do ajuste; Plano 10 e CHECKPOINT B permanecem não iniciados.

## Tarefas

### 1. Ajustar serialização e versionar somente Produto

**Arquivos:** `src/lib/lab/bench/domain/prompt-composer.ts`, `src/lib/lab/bench/domain/policies/produto.ts`

Alterar o label do campo de nome produzido por `productLines` para que o prompt compilado contenha exatamente `Nome do produto obrigatório: {nome}`. Alterar `PRODUTO_POLICY_VERSION` de `48.2.6-produto-v1` para `48.2.6-produto-v2`. Manter `COMPOSER_VERSION` exatamente `48.2.4-prompt-composer-v1`. Preservar intacta a frase de política `Nome: completo, sem alterar palavras; capitalização, quebras de linha e arranjo livres.`; não acrescentar nem retirar outras regras e não tocar no conteúdo/versionamento do prompt-base.

**Verificação automatizada:** teste focado da tarefa 2 deve provar novo label, frase exata e versões corretas; revisar diff dos dois arquivos para confirmar ausência de alterações fora desses valores.

### 2. Alinhar testes afetados e delta OpenSpec ao contrato aprovado

**Arquivos:** `src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts`, `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`, `openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/proposal.md`, `openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/specs/lab-bench-prompt-policy/spec.md`, `openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/design.md`, `openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/tasks.md`

Em `prompt-policy.contract.test.ts`, atualizar somente o prompt compilado golden/expected para `Nome do produto obrigatório: ...`, afirmar a frase de preservação literalmente e esperar `48.2.6-produto-v2`. Em `bench-ui.contract.test.tsx`, alterar somente as fixtures/mocks ativas da versão Produto de v1 para v2. Não editar `bench-execution.contract.test.ts`: seu prompt manual `Produto: Coca-Cola 2 L` é dado aprovado de outro contrato e permanece igual. Não editar `prompt-composer.contract.test.ts` sem assertion diretamente afetada. Atualizar `proposal.md`, a requirement/scenario em `lab-bench-prompt-policy/spec.md` e os trechos correspondentes de `design.md`/`tasks.md` para registrar exatamente o novo rótulo e versão da política, sem nova regra. Não alterar `lab-bench-intent-uat/spec.md`; o relato do usuário pertence ao UAT documental. Preservar composer version, demais políticas e prompt-base. Executar testes direcionados e `openspec validate --strict` para a change ativa.

**Verificação automatizada:** `npx vitest run src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"` e `npx openspec validate fase-48-2-6-validacao-experimental-produto-intencoes-1-1 --strict`.

### 3. Registrar relato UAT, parar para revisão humana e atualizar tracking

**Arquivos:** `.planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT.md`, `.planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT-MANIFEST.md`, `.planning/STATE.md`, `.planning/HANDOFF.json`, `.planning/quick/261003-ltf-f48-2-6-alterar-somente-o-r-tulo-do-nome/261003-ltf-PLAN.md`, `.planning/quick/261003-ltf-f48-2-6-alterar-somente-o-r-tulo-do-nome/261003-ltf-SUMMARY.md`

No UAT, identificar claramente como relato manual do usuário sobre a primeira geração NovaTek/Oferta: precisa de ajuste pela omissão de “Mouse sem fio”; imagem do mouse foi considerada fiel; frases criativas genéricas são aceitas; preço, selo, validade e textos obrigatórios estão presentes. Registrar decisão como ajuste solicitado, sem declarar CHECKPOINT B aprovado. Não atribuir Run ID, custo, latência, snapshot, preset/modelo ou metadados: mantê-los `pending`/não informados; atualizar manifesto apenas com referência documental à política Produto v2 e estado de evidência desconhecida. Atualizar tracking GSD para este quick task concluído e HANDOFF indicando aguardar revisão humana da correção, mantendo Plan 10 não iniciado e CHECKPOINT B `not_started`. Summary registra os gates reais. Não criar artefato de closeout nem alterar ROADMAP sem necessidade normativa.

**Verificação automatizada:** `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`; inspeção JSON (`node -e "JSON.parse(require('fs').readFileSync('.planning/HANDOFF.json','utf8'))"`) e auditoria de diff confirmando ausência de prompt-base, provider/imagem/geração, produção, adapters, pricing, banco e migrations. Se build exigir serviço externo, registrar resultado sem contornar nem invocar serviço.

## Critérios de aceite

- Prompt compilado usa exatamente `Nome do produto obrigatório: {nome}` no campo serializado do nome.
- Frase `Nome: completo, sem alterar palavras; capitalização, quebras de linha e arranjo livres.` permanece exatamente igual.
- Política Produto tem versão `48.2.6-produto-v2`; `COMPOSER_VERSION` continua `48.2.4-prompt-composer-v1`; prompt-base não muda.
- Nenhuma regra, política não relacionada, adapter, provider, pricing, banco/migration ou código produtivo externo à bancada é alterado.
- Testes relevantes, validação OpenSpec e gates TypeScript/lint/build/diff check têm resultado documentado sem inventar sucesso.
- Relato NovaTek/Oferta corresponde somente aos fatos fornecidos pelo usuário; evidências e metadados desconhecidos continuam pending.
- Sem provider, imagem, run ou geração; CHECKPOINT B não aprovado e Plano 10 não iniciado. Trabalho para em espera por revisão humana.
