---
phase: 261121-nru
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/__tests__/actions/store-identity-service.test.ts
  - src/__tests__/api/campaign-intent-guard.test.ts
  - src/__tests__/auth/check-email.test.tsx
  - src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts
  - src/components/admin/__tests__/review-actions.test.tsx
  - src/components/credit/__tests__/credit-cta.test.tsx
  - src/components/flow/__tests__/campaign-input-form-generation.test.tsx
  - src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx
  - src/components/flow/__tests__/use-campaign-form-review.test.ts
  - src/components/legal/__tests__/privacy-recovery.test.tsx
  - .planning/quick/261121-nru-limpeza-conservadora-de-imports-sem-uso-/261121-nru-SUMMARY.md
autonomous: false
requirements:
  - higiene-testes/remover-somente-importspecifier-sem-uso-em-10-arquivos-autorizados
  - higiene-testes/nenhuma-alteracao-em-codigo-de-producao-ou-suporte-compartilhado-de-testes
  - higiene-testes/testes-identicos-a-baseline-52-pass-0-fail
  - higiene-testes/gates-oficiais-typecheck-lint-build-e-suite-global
  - higiene-testes/reavaliacao-diagnostica-read-only-28-para-18
must_haves:
  truths:
    - "Exatamente 10 ImportSpecifier sem uso são removidos, um por arquivo de teste autorizado; nenhum outro símbolo do mesmo import muda, nenhum import inteiro é removido, nenhum import é consolidado ou reordenado."
    - "Os 10 arquivos continuam executando os mesmos 52 testes (52 PASS, 0 FAIL), com as contagens por arquivo idênticas à baseline registrada."
    - "Nenhum teste, asserção, cenário, hook, mock, fixture, tipo, variável ou chamada com efeito é removido, ignorado, renomeado ou enfraquecido."
    - "Código de produção, suporte compartilhado de testes, configuração de lint, supressões, dependências, lockfile, banco, Storage, providers, geração, créditos e ambientes permanecem intocados."
    - "A reavaliação diagnóstica somente leitura reduz os ImportSpecifier sem uso em testes de 28 para 18 (6 suporte compartilhado + 9 não utilitários adiados + 3 adiados por limite de lote), com redução total de warnings de 373 para 363 e nenhum aviso novo atribuível ao lote."
    - "typecheck, lint oficial, build, suíte global e `git diff --check` são executados e registrados com resultado real; qualquer falha ou divergência atribuível ao lote para a execução para revisão."
  artifacts:
    - path: "src/__tests__/actions/store-identity-service.test.ts"
      provides: "import de vitest sem `beforeEach`"
      contains: 'import { describe, it, expect, vi } from "vitest";'
    - path: "src/__tests__/api/campaign-intent-guard.test.ts"
      provides: "import de vitest sem `vi`"
      contains: 'import { describe, it, expect } from "vitest";'
    - path: "src/__tests__/auth/check-email.test.tsx"
      provides: "import de @testing-library/react sem `screen`"
      contains: 'import { render } from "@testing-library/react";'
    - path: "src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts"
      provides: "import de vitest sem `beforeAll` (aspas simples preservadas)"
      contains: "import { describe, it, expect, vi, beforeEach } from 'vitest';"
    - path: "src/components/admin/__tests__/review-actions.test.tsx"
      provides: "import de @testing-library/react sem `act`"
      contains: 'import { render, screen, fireEvent, waitFor } from "@testing-library/react";'
    - path: "src/components/credit/__tests__/credit-cta.test.tsx"
      provides: "import de vitest sem `vi`"
      contains: 'import { describe, it, expect } from "vitest";'
    - path: "src/components/flow/__tests__/campaign-input-form-generation.test.tsx"
      provides: "import de @testing-library/react sem `act`"
      contains: 'import { fireEvent, render, screen, waitFor } from "@testing-library/react";'
    - path: "src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx"
      provides: "import de @testing-library/react sem `act`"
      contains: 'import { render, screen, fireEvent, waitFor } from "@testing-library/react";'
    - path: "src/components/flow/__tests__/use-campaign-form-review.test.ts"
      provides: "import de @testing-library/react sem `waitFor`, com a linha 5 intocada"
      contains: 'import { renderHook, act } from "@testing-library/react";'
    - path: "src/components/legal/__tests__/privacy-recovery.test.tsx"
      provides: "import de @testing-library/react sem `act`"
      contains: 'import { render, screen, waitFor } from "@testing-library/react";'
    - path: ".planning/quick/261121-nru-limpeza-conservadora-de-imports-sem-uso-/261121-nru-SUMMARY.md"
      provides: "Registro honesto das 10 edições, da baseline e de cada gate executado"
      min_lines: 40
  key_links:
    - from: "src/__tests__/actions/store-identity-service.test.ts"
      to: "vitest"
      via: "import nomeado preservado sem `beforeEach`"
      pattern: 'import \{ describe, it, expect, vi \} from "vitest"'
    - from: "src/components/flow/__tests__/use-campaign-form-review.test.ts"
      to: "@testing-library/react"
      via: "linha 4 editada; linha 5 (`render, screen`) preservada sem alteração"
      pattern: 'import \{ renderHook, act \} from "@testing-library/react"'
    - from: "src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts"
      to: "vitest"
      via: "estilo de aspas simples do arquivo preservado"
      pattern: "from 'vitest'"
---

<objective>
Remover, em exatamente 10 arquivos de teste autorizados, um único ImportSpecifier sem uso por arquivo, preservando todo o restante do import e todo o comportamento dos testes.

**Natureza desta entrega: higiene de testes. NÃO é correção funcional do aplicativo.** Não há bug de produto, mudança de comportamento, alteração de produção ou ganho funcional prometido. O único efeito observável é a redução de 10 avisos `@typescript-eslint/no-unused-vars` em 10 arquivos de teste, sem qualquer mudança na quantidade ou no resultado dos testes.

Purpose: o diagnóstico de lint (quick `261121-k4g`) identificou 28 ImportSpecifier não usados em arquivos de teste/suporte. Deste universo, 13 são utilitários de teste; 10 cabem neste primeiro lote conservador e 3 ficam adiados pelo limite de 10 arquivos. O lote evita tocar em qualquer caso ambíguo, em suporte compartilhado e em símbolos que não sejam utilitários de teste.

Output: 10 linhas de import alteradas (1 remoção + 1 reinserção por arquivo), 0 arquivos de produção, 0 novos testes, 0 testes removidos, 1 SUMMARY com baseline e gates reais. A execução só começa após autorização explícita no **Review Stop**.

## Baseline real já coletada (não reexecutar para "conferir" antes da edição)

Comando: `node node_modules/vitest/vitest.mjs run <10 arquivos> --reporter=json`

| # | Arquivo | Testes |
|---|---------|--------|
| 1 | `src/__tests__/actions/store-identity-service.test.ts` | 4 |
| 2 | `src/__tests__/api/campaign-intent-guard.test.ts` | 6 |
| 3 | `src/__tests__/auth/check-email.test.tsx` | 4 |
| 4 | `src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts` | 9 |
| 5 | `src/components/admin/__tests__/review-actions.test.tsx` | 3 |
| 6 | `src/components/credit/__tests__/credit-cta.test.tsx` | 1 |
| 7 | `src/components/flow/__tests__/campaign-input-form-generation.test.tsx` | 7 |
| 8 | `src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx` | 2 |
| 9 | `src/components/flow/__tests__/use-campaign-form-review.test.ts` | 12 |
| 10 | `src/components/legal/__tests__/privacy-recovery.test.tsx` | 4 |
| | **Total** | **52 PASS / 0 FAIL** |

Contexto de diagnóstico no HEAD `1f876d61` (branch `chore/test-unused-imports`, worktree limpa): 1.965 arquivos, **373 warnings**, 0 erros, 0 fatais, 0 erros de configuração; **28 ImportSpecifier** não usados em testes/suporte, obtidos por AST TypeScript sobre os resultados do ESLint diagnóstico (não por busca textual).

## Lote autorizado (verificado nesta worktree: arquivo, linha e conteúdo do import conferem)

| # | Arquivo | Linha | Remover | Import final | Estilo |
|---|---------|-------|---------|--------------|--------|
| 1 | `src/__tests__/actions/store-identity-service.test.ts` | 2 | `beforeEach` | `import { describe, it, expect, vi } from "vitest";` | aspas duplas |
| 2 | `src/__tests__/api/campaign-intent-guard.test.ts` | 1 | `vi` | `import { describe, it, expect } from "vitest";` | aspas duplas |
| 3 | `src/__tests__/auth/check-email.test.tsx` | 3 | `screen` | `import { render } from "@testing-library/react";` | aspas duplas |
| 4 | `src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts` | 1 | `beforeAll` | `import { describe, it, expect, vi, beforeEach } from 'vitest';` | **aspas simples** |
| 5 | `src/components/admin/__tests__/review-actions.test.tsx` | 3 | `act` | `import { render, screen, fireEvent, waitFor } from "@testing-library/react";` | aspas duplas |
| 6 | `src/components/credit/__tests__/credit-cta.test.tsx` | 3 | `vi` | `import { describe, it, expect } from "vitest";` | aspas duplas |
| 7 | `src/components/flow/__tests__/campaign-input-form-generation.test.tsx` | 3 | `act` | `import { fireEvent, render, screen, waitFor } from "@testing-library/react";` | aspas duplas |
| 8 | `src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx` | 15 | `act` | `import { render, screen, fireEvent, waitFor } from "@testing-library/react";` | aspas duplas |
| 9 | `src/components/flow/__tests__/use-campaign-form-review.test.ts` | 4 | `waitFor` | `import { renderHook, act } from "@testing-library/react";` | aspas duplas |
| 10 | `src/components/legal/__tests__/privacy-recovery.test.tsx` | 3 | `act` | `import { render, screen, waitFor } from "@testing-library/react";` | aspas duplas |

Caso especial obrigatório: no arquivo 9, a **linha 5** (`import { render, screen } from "@testing-library/react";`) permanece intocada. No arquivo 4, preservar aspas simples.

## Fora deste lote (não tocar, não "aproveitar")

- `src/lib/product-two-format/orchestration/__tests__/support/joint-offline-world.ts` (6 símbolos) — suporte compartilhado de testes, fora do escopo.
- `src/lib/campaign/thumbnail/__tests__/thumbnail-generator.test.ts:2` (`vi`), `src/lib/product-1-1/__tests__/pending-resolution.contract.test.ts:4` (`beforeEach`), `src/lib/product-vertical-9-16/__tests__/telemetry.contract.test.ts:2` (`vi`) — adiados: limite de 10 arquivos.
- 9 imports de teste não utilitários (`Loader2`, `SupabaseClient`, `getBenchRun`, `AiInvocationRequest`, `reserveCredit`, `ProductOneToOneAttemptStartClient`, `OPERATION_ID`, `FormData`) — fora da prioridade deste lote.
- Qualquer caso ambíguo: fica fora do lote com justificativa no SUMMARY.
- `.planning/STATE.md`: não editado por esta quick, porque o gate final exige diff contendo somente as 10 linhas de import + documentação da quick. Atualização de tracking é decisão separada após a revisão.

## Regras invioláveis de execução

- Editar **somente** a lista de imports das 10 linhas indicadas, removendo apenas o símbolo listado.
- Não remover o import inteiro, não consolidar imports, não reordenar símbolos, não reformatar, não tocar em comentários.
- Não usar `eslint --fix` nem qualquer correção automática.
- Não remover/ignorar/enfraquecer testes, asserções, cenários, hooks, mocks, fixtures ou tipos.
- Nenhum merge, push, deploy, migration, banco, Storage, provider, geração paga ou acesso a ambiente.
</objective>

<execution_context>
Referências de workflow/template do runtime GSD são resolvidas pelo executor.
Caminhos pessoais não são fixados neste artefato versionado.
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@./AGENTS.md
@docs/fluxo-de-desenvolvimento.md
@docs/convencoes/lint-diagnostico.md
@src/__tests__/actions/store-identity-service.test.ts
@src/__tests__/api/campaign-intent-guard.test.ts
@src/__tests__/auth/check-email.test.tsx
@src/components/admin/__tests__/review-actions.test.tsx
@src/components/credit/__tests__/credit-cta.test.tsx
@src/components/flow/__tests__/campaign-input-form-generation.test.tsx
@src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx
@src/components/flow/__tests__/use-campaign-form-review.test.ts
@src/components/legal/__tests__/privacy-recovery.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remover exatamente 10 ImportSpecifier sem uso, um por arquivo de teste autorizado</name>
  <files>src/__tests__/actions/store-identity-service.test.ts, src/__tests__/api/campaign-intent-guard.test.ts, src/__tests__/auth/check-email.test.tsx, src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts, src/components/admin/__tests__/review-actions.test.tsx, src/components/credit/__tests__/credit-cta.test.tsx, src/components/flow/__tests__/campaign-input-form-generation.test.tsx, src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx, src/components/flow/__tests__/use-campaign-form-review.test.ts, src/components/legal/__tests__/privacy-recovery.test.tsx</files>
  <action>
**PRÉ-CONDIÇÃO (Review Stop):** só iniciar após autorização explícita do usuário a ESTE plano. A autorização cobre apenas as 10 edições de import e a escrita do SUMMARY do Task 2; não cobre produção, suporte compartilhado, lint config, dependências, banco, publicação ou qualquer outro arquivo.

Aplicar as 10 substituições da tabela "Lote autorizado" do `<objective>`, com Edit cirúrgico por arquivo (nunca `Write` do arquivo inteiro, nunca sed/script de substituição em massa):

1. `src/__tests__/actions/store-identity-service.test.ts`, linha 2: remover `beforeEach` da lista, mantendo `describe, it, expect, vi`.
2. `src/__tests__/api/campaign-intent-guard.test.ts`, linha 1: remover `vi`, mantendo `describe, it, expect`.
3. `src/__tests__/auth/check-email.test.tsx`, linha 3: remover `screen`, mantendo `render`.
4. `src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts`, linha 1: remover `beforeAll`, mantendo `describe, it, expect, vi, beforeEach` e as **aspas simples** originais.
5. `src/components/admin/__tests__/review-actions.test.tsx`, linha 3: remover `act`, mantendo `render, screen, fireEvent, waitFor`.
6. `src/components/credit/__tests__/credit-cta.test.tsx`, linha 3: remover `vi`, mantendo `describe, it, expect` (a linha 4, de `@testing-library/react`, não é tocada).
7. `src/components/flow/__tests__/campaign-input-form-generation.test.tsx`, linha 3: remover `act`, mantendo `fireEvent, render, screen, waitFor`.
8. `src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx`, linha 15: remover `act`, mantendo `render, screen, fireEvent, waitFor`.
9. `src/components/flow/__tests__/use-campaign-form-review.test.ts`, linha 4: remover `waitFor`, mantendo `renderHook, act`; a linha 5 (`render, screen`) permanece byte a byte igual.
10. `src/components/legal/__tests__/privacy-recovery.test.tsx`, linha 3: remover `act`, mantendo `render, screen, waitFor`.

Regras de edição:
- Preservar ordem dos símbolos restantes, aspas, espaçamento, ponto e vírgula e o especificador de módulo exatamente como estão.
- Não alterar nenhuma outra linha do arquivo (nem comentários, nem imports vizinhos).
- Não usar `eslint --fix`, `prettier`, `organizeImports`, regex de substituição em massa ou qualquer ferramenta que possa tocar em outros arquivos.
- Se qualquer linha não corresponder exatamente ao conteúdo da tabela (símbolo ausente, já removido, ordem diferente ou referência ao símbolo encontrada no corpo do arquivo), PARAR naquele arquivo, deixá-lo intocado e registrar a divergência no SUMMARY; nunca "resolver" por conta própria.

Ao final das 10 edições:
- Conferir que cada arquivo teve apenas 1 linha alterada (1 remoção + 1 inserção) via `git diff --numstat -- <10 arquivos>`: esperado `1	1	<arquivo>` em 10 linhas.
- Conferir que nenhum outro arquivo aparece em `git status --short` além dos 10 e da documentação da quick.
- Não executar a validação completa aqui: ela é o Task 2.

Commit desta tarefa (local, sem push): `chore(tests): remover imports sem uso em 10 arquivos de teste`.
  </action>
  <verify>
    <automated>git diff --numstat -- "src/__tests__/actions/store-identity-service.test.ts" "src/__tests__/api/campaign-intent-guard.test.ts" "src/__tests__/auth/check-email.test.tsx" "src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts" "src/components/admin/__tests__/review-actions.test.tsx" "src/components/credit/__tests__/credit-cta.test.tsx" "src/components/flow/__tests__/campaign-input-form-generation.test.tsx" "src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx" "src/components/flow/__tests__/use-campaign-form-review.test.ts" "src/components/legal/__tests__/privacy-recovery.test.tsx"</automated>
    Complementar e obrigatório: exatamente 10 linhas `1	1	<arquivo>` (nenhum arquivo com 0, 2+ ou contagem diferente); `git diff --name-only` contém somente os 10 arquivos (mais a documentação da quick, se já criada); `git diff --check` limpo; nenhuma ocorrência de `--fix` no histórico de comandos desta execução.
  </verify>
  <done>10 arquivos de teste com exatamente 1 linha de import alterada cada; símbolo removido conforme a tabela; ordem, aspas, estilo e demais símbolos preservados; linha 5 de `use-campaign-form-review.test.ts` e linha 4 de `credit-cta.test.tsx` intocadas; nenhum outro arquivo modificado; commit local `chore(tests)` criado.</done>
</task>

<task type="auto">
  <name>Task 2: Executar a matriz de validação, provar 28→18 por AST e registrar SUMMARY; parar para revisão</name>
  <files>.planning/quick/261121-nru-limpeza-conservadora-de-imports-sem-uso-/261121-nru-SUMMARY.md</files>
  <action>
Executar a sequência abaixo **na ordem**, registrando o resultado REAL de cada passo. Não mascarar exit code, não usar `|| true`, não "corrigir" nada para ficar verde, não rodar `eslint --fix`.

1) Testes focados dos 10 arquivos (mesmo comando da baseline, caminhos entre aspas simples por causa de `[id]`):
`node node_modules/vitest/vitest.mjs run 'src/__tests__/actions/store-identity-service.test.ts' 'src/__tests__/api/campaign-intent-guard.test.ts' 'src/__tests__/auth/check-email.test.tsx' 'src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts' 'src/components/admin/__tests__/review-actions.test.tsx' 'src/components/credit/__tests__/credit-cta.test.tsx' 'src/components/flow/__tests__/campaign-input-form-generation.test.tsx' 'src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx' 'src/components/flow/__tests__/use-campaign-form-review.test.ts' 'src/components/legal/__tests__/privacy-recovery.test.tsx' --reporter=json`
Esperado: 10 arquivos, 52 testes, 52 PASS, 0 FAIL, com as contagens por arquivo iguais à tabela de baseline (4/6/4/9/3/1/7/2/12/4). Qualquer teste skip, `todo`, contagem diferente ou falha ⇒ PARAR.

2) `npm.cmd run typecheck` ⇒ exit 0, 0 erros.

3) `npm.cmd run lint` (lint oficial; **não** usar `lint:diagnostic` como gate) ⇒ exit 0, 0 problemas.

4) `npm.cmd run build` ⇒ exit 0, rotas geradas como na baseline.

5) `npm.cmd test` ⇒ registrar o resultado real da suíte global. Comparar com a baseline conhecida mais recente no STATE: quick `261121-m97`, imediatamente anterior a este lote no HEAD `1f876d61`, registrou **835 arquivos / 10.324 testes PASS / 0 failed**. Se houver falha, verificar se é preexistente conhecida; se houver **qualquer ampliação atribuível ao lote** (novo arquivo falhando, contagem de PASS menor que a baseline, teste skip novo), PARAR e registrar.

6) Reavaliação diagnóstica **somente leitura**, sem `--fix`:
`node scripts/lint/build-inventory.mjs --out $env:TEMP\nru-inventory --baseline .planning/quick/261121-k4g-diagnostico-real-de-lint-para-typescript/baseline/lint-json.relative.json`
- Saída obrigatoriamente fora do repositório (nada de `.lint-diagnostic/` na worktree).
- Esperado: exit 0, `fatal` vazio, `configErrors` vazio, **warnings 373 → 363** (redução de exatamente 10).
- Extração AST dos ImportSpecifier em arquivos de teste, a partir do `inventory.json` e por script descartável no diretório temporário (TypeScript compiler API de `node_modules/typescript`, nunca commitado): filtrar mensagens `@typescript-eslint/no-unused-vars`, confirmar que o nó é `ImportSpecifier` e que o identificador tem 0 referências fora do import.
- Esperado: **28 → 18** achados. Decomposição obrigatória: 6 em `support/joint-offline-world.ts` + 9 não utilitários adiados + 3 utilitários adiados (`thumbnail-generator.test.ts`, `pending-resolution.contract.test.ts`, `telemetry.contract.test.ts`).
- Nenhum arquivo do lote pode permanecer na lista; nenhum aviso novo pode aparecer em arquivo do lote.

7) `git diff --check` ⇒ limpo. Revisar `git diff` integral: somente 10 linhas de import (10 remoções + 10 inserções) e a documentação da quick; nenhuma alteração em `src/app`, `src/lib`, `src/components` fora dos 10 testes, `eslint.config.mjs`, `eslint.diagnostic.config.mjs`, `package.json`, `package-lock.json`, `supabase/`, `vercel.json` ou `.planning/STATE.md`.

8) Qualquer falha, contagem divergente, aviso novo atribuível ao lote ou ampliação de escopo ⇒ diagnóstico e PARADA para revisão, sem contornar o gate.

9) Escrever `.planning/quick/261121-nru-limpeza-conservadora-de-imports-sem-uso-/261121-nru-SUMMARY.md` com: branch e HEAD de partida (`1f876d61`, `chore/test-unused-imports`); as 10 edições (arquivo, linha, símbolo, import final); baseline 52/52 e resultado real por arquivo; resultado real de typecheck/lint/build/`npm test` comparado à baseline conhecida; inventário 373→363 e AST 28→18 com a decomposição; lista explícita dos candidatos preservados e por quê; confirmação de que nenhum código de produção, suporte compartilhado, teste, asserção, configuração ou dependência foi alterado; e declaração de que esta quick é higiene de testes, **não** correção funcional, sem merge/push/deploy/banco/provider.

**PONTO DE PARADA:** encerrar no SUMMARY. Não abrir PR, não publicar, não atualizar STATE, não corrigir avisos restantes, não iniciar novo lote.

Commit desta tarefa (local, sem push): `docs(quick): registrar limpeza conservadora de imports sem uso`.
  </action>
  <verify>
    <automated>node node_modules/vitest/vitest.mjs run 'src/__tests__/actions/store-identity-service.test.ts' 'src/__tests__/api/campaign-intent-guard.test.ts' 'src/__tests__/auth/check-email.test.tsx' 'src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts' 'src/components/admin/__tests__/review-actions.test.tsx' 'src/components/credit/__tests__/credit-cta.test.tsx' 'src/components/flow/__tests__/campaign-input-form-generation.test.tsx' 'src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx' 'src/components/flow/__tests__/use-campaign-form-review.test.ts' 'src/components/legal/__tests__/privacy-recovery.test.tsx' --reporter=json</automated>
    Complementar e obrigatório, com resultado real registrado: `npm.cmd run typecheck` (0), `npm.cmd run lint` (0 problemas), `npm.cmd run build` (0), `npm.cmd test` (comparado à baseline, sem ampliação atribuível), `node scripts/lint/build-inventory.mjs --out $env:TEMP\nru-inventory --baseline <baseline k4g>` (warnings 363; fatal/configErrors vazios), extração AST (28→18 com decomposição 6+9+3), `git diff --check` (limpo), `git diff --numstat` (10 arquivos `1	1`), inspeção do diff sem arquivos fora do escopo.
  </verify>
  <done>52/52 testes PASS com contagens por arquivo idênticas; typecheck, lint oficial e build em exit 0; suíte global registrada e comparada sem ampliação atribuível; inventário read-only com 373→363 warnings e AST 28→18 (6+9+3); `git diff --check` limpo; diff contendo somente as 10 linhas de import e a documentação da quick; SUMMARY escrito com resultados reais; ponto de parada respeitado; commit local `docs(quick)` criado.</done>
</task>

</tasks>

<stop_points>
## Review Stop — autorização obrigatória antes de qualquer edição

1. **Este plano NÃO autoriza execução.** Ele termina em revisão. Nenhum dos 10 arquivos pode ser editado antes de uma autorização explícita e separada do usuário a este plano.
2. A autorização, quando dada, cobre **somente**: as 10 remoções de ImportSpecifier listadas e a escrita do SUMMARY da quick.
3. A autorização **não** cobre: código de produção, suporte compartilhado de testes (`joint-offline-world.ts`), os 3 candidatos adiados, os 9 imports não utilitários, configuração de lint, supressões, `eslint --fix`, dependências/lockfile, banco/Storage/providers/geração/créditos/ambientes, STATE.md, merge, push, deploy, PR ou publicação.
4. Aprovação do plano ≠ aprovação de execução. Se qualquer divergência aparecer no Task 1 ou em qualquer gate do Task 2, a execução para e retorna para revisão sem tentativa de contorno.
</stop_points>

<threat_model>
## Trust Boundaries

| Boundary | Descrição |
|----------|-----------|
| executor → código de produção | Uma edição ampla ou um "fix" automático pode atravessar de teste para aplicação |
| executor → suíte de testes | Remover símbolo errado, import inteiro ou trecho pode apagar cobertura silenciosamente |
| ferramenta de lint → repositório | `--fix` ou script de substituição em massa altera arquivos não autorizados |
| inventário temporário → worktree | Artefato de diagnóstico gravado dentro do repo vira ruído/untracked no gate de diff |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nru-01 | Tampering | 10 arquivos de teste / código de produção | mitigate | Somente Edit cirúrgico na linha indicada; `files_modified` fechado; `git diff --numstat` exige `1	1` por arquivo; diff inspecionado contra `src/app`, `src/lib`, `package*.json`, `supabase/`, configs e STATE |
| T-nru-02 | False assurance | testes que passam sem cobrir o mesmo comportamento | mitigate | Contagem por arquivo igual à baseline (4/6/4/9/3/1/7/2/12/4 = 52); proibido remover/ignorar/enfraquecer teste; qualquer skip novo ou contagem divergente = PARADA |
| T-nru-03 | Tampering | `eslint --fix` / script em massa | mitigate | `--fix` proibido; substituição manual por arquivo; revisão do diff; nenhuma ferramenta de formatação/import sorting |
| T-nru-04 | False assurance | reavaliação diagnóstica otimista | mitigate | Inventário read-only com baseline k4g; exigir 373→363 e AST 28→18 com decomposição 6+9+3; saída fora do repo; nenhum arquivo do lote pode restar |
| T-nru-05 | Repudiation | resultado de gate mascarado | mitigate | Registrar exit codes e contagens reais no SUMMARY; sem `|| true`; falha preexistente só é aceita se comparada à baseline conhecida e não ampliada |
| T-nru-SC | Tampering | npm/pip/cargo installs | accept | Nenhuma instalação, nenhuma mudança de dependência ou lockfile nesta quick; se algo exigir install, PARAR e escalar |
</threat_model>

<verification>
## Matriz de validação obrigatória (comando → resultado esperado)

| # | Comando | Resultado esperado |
|---|---------|--------------------|
| 1 | `node node_modules/vitest/vitest.mjs run <10 arquivos> --reporter=json` | 10 arquivos / 52 testes / 52 PASS / 0 FAIL; contagens 4/6/4/9/3/1/7/2/12/4 |
| 2 | `npm.cmd run typecheck` | exit 0, 0 erros |
| 3 | `npm.cmd run lint` | exit 0, 0 problemas (gate oficial) |
| 4 | `npm.cmd run build` | exit 0, build completo |
| 5 | `npm.cmd test` | resultado real registrado; comparado à baseline `261121-m97` no HEAD `1f876d61` (835 arquivos / 10.324 testes PASS / 0 failed); sem ampliação atribuível ao lote |
| 6 | `node scripts/lint/build-inventory.mjs --out $env:TEMP\nru-inventory --baseline <k4g>` + extração AST | warnings 373 → **363**; ImportSpecifier 28 → **18** (6 suporte + 9 não utilitários + 3 adiados); fatal/configErrors vazios; nenhum arquivo do lote remanescente |
| 7 | `git diff --check` | limpo |
| 8 | `git diff --numstat` / `git status --short` | 10 arquivos com `1	1`; somente as 10 linhas de import + documentação da quick |
| 9 | Inspeção do diff | nenhuma mudança em produção, suporte compartilhado, testes não listados, configs, dependências, lockfile, `supabase/`, `vercel.json` ou STATE |

Invariantes que NÃO podem mudar: quantidade e resultado dos testes; conteúdo de asserções, mocks, fixtures e tipos; ordem/aspas/estilo dos imports restantes; `eslint.config.mjs` e `eslint.diagnostic.config.mjs`; `package.json`/`package-lock.json`; qualquer arquivo fora dos 10; acesso a banco/Storage/provider/ambiente.
</verification>

<success_criteria>
- Exatamente 10 ImportSpecifier removidos, 1 por arquivo autorizado, sem remover import inteiro, consolidar, reordenar ou reformatar.
- Linha 5 de `use-campaign-form-review.test.ts` e linha 4 de `credit-cta.test.tsx` intocadas; aspas simples preservadas em `retry-route.test.ts`.
- 10 arquivos / 52 testes / 52 PASS / 0 FAIL, com contagens por arquivo idênticas à baseline.
- typecheck 0, lint oficial 0 problemas, build 0, suíte global registrada sem ampliação atribuível ao lote.
- Reavaliação read-only: 373 → 363 warnings e 28 → 18 ImportSpecifier (6+9+3), sem aviso novo em arquivo do lote.
- `git diff --check` limpo; diff restrito às 10 linhas de import + documentação da quick.
- Nenhum teste removido/enfraquecido; nenhuma alteração de produção, suporte compartilhado, config, dependência, banco, provider ou ambiente.
- SUMMARY honesto com baseline, 10 edições, gates reais, decomposição 28→18 e candidatos preservados.
- Declaração explícita de que a quick é higiene de testes, não correção funcional; Review Stop respeitado; sem merge/push/deploy.
</success_criteria>

<output>
Criar `.planning/quick/261121-nru-limpeza-conservadora-de-imports-sem-uso-/261121-nru-SUMMARY.md` ao concluir a execução autorizada, com: branch/HEAD de partida, tabela das 10 edições, baseline 52/52 e resultado por arquivo, exit codes reais de typecheck/lint/build/suíte global, inventário 373→363 e AST 28→18 (6+9+3), candidatos preservados e justificativas, prova de não-alteração fora do escopo e a declaração de higiene de testes sem publicação.
</output>

## Review Stop

**Nenhuma edição foi feita por este planejamento.** O plano está pronto para revisão. A execução — inclusive a primeira das 10 remoções — só começa após autorização explícita do usuário a este plano. Sem essa autorização, os 10 arquivos permanecem intocados e nenhum gate é executado.
