---
status: planned
date: 2026-10-27
slug: planejar-recuperacao-do-ambiente-local-e
quick_id: 261027-llm
initiative: F57
phase: quick
plan: 261027-llm
type: plan-only
wave: 1
depends_on: []
approval: pending
execution_status: not_started
files_modified:
  - src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts
  - src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts
environment_paths:
  - C:\Projetos\Vendeo V3\node_modules (substituído integralmente por npm ci; não versionado)
  - C:\Users\wagne\AppData\Local\npm-cache (pode receber cache; não versionado)
autonomous: false
requirements: []
user_setup: []
must_haves:
  truths:
    - "O npm real (C:\\Program Files\\nodejs\\npm.cmd, 11.8.0) é usado explicitamente; o shim de 0 byte em C:\\Windows\\System32\\npm não é invocado nem alterado"
    - "node_modules é reconstruído a partir do lockfile (npm ci), com .bin e todas as dependências do projeto, sem mudar package.json ou package-lock.json"
    - "Sharp, @google/generative-ai e as ferramentas (tsx, tsc, vitest, eslint) carregam após a instalação"
    - "Os dois testes pré-existentes são corrigidos com tipagem real dos contratos, sem any, @ts-ignore, exclusão, strict relaxado ou ignoreBuildErrors"
    - "Os 72 testes de market-context continuam passando e a biblioteca não é alterada"
    - "npm run typecheck passa com 0 erros; npm run build passa; npm run lint executa com a limitação de cobertura TS registrada, sem superdeclarar lint TypeScript"
    - "Apenas os dois arquivos de teste aparecem no diff; manifests/lockfile permanecem idênticos; nenhum push, merge ou deploy"
  artifacts:
    - path: "src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts"
      provides: "Fixture tipada com o contrato que inclui imageUnitCostUsd, preservando a prova de que ele não entra no pós-chamada"
      contains: "imageUnitCostUsd"
    - path: "src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts"
      provides: "Mocks de record tipados com AiCostEvent, preservando custo/tokens/tentativas/metadata"
      contains: "AiCostEvent"
    - path: ".planning/quick/261027-llm-planejar-recuperacao-do-ambiente-local-e/261027-llm-SUMMARY.md"
      provides: "Evidência literal de instalação, gates e limitações"
  key_links:
    - from: "src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts"
      to: "src/lib/ai-cost/types.ts"
      via: "tipo do evento gravado pelo tracker"
      pattern: "AiCostEvent"
    - from: "src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts"
      to: "src/lib/ai-cost/ai-model-pricing.ts"
      via: "ModelPricing inclui imageUnitCostUsd"
      pattern: "ModelPricing"
---

<objective>
Planejar a recuperação reprodutível do ambiente local (npm + `node_modules`) e a correção mínima
dos dois testes que impedem o `typecheck` global, antes de qualquer push.

**Purpose:** devolver ao projeto gates globais confiáveis (`typecheck`, `lint`, `build`) sem
mascarar problemas e sem tocar em contratos produtivos. Push dispara deploy; nada será publicado.

**Output futuro:** `node_modules` reconstruído via `npm ci`, dois arquivos de teste corrigidos,
gates reexecutados com evidência literal e SUMMARY com limitações residuais.

**Fora de escopo:** `src/lib/market-context/**`; regras de geração/cobrança/créditos/campanhas;
banco, migrations, env, flags, chamadas pagas; configuração global de ESLint; `package.json`,
`package-lock.json`, `.npmrc`; push, merge, deploy.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./AGENTS.md
@docs/fluxo-de-desenvolvimento.md
@.planning/quick/261027-llm-planejar-recuperacao-do-ambiente-local-e/261027-llm-CONTEXT.md
@package.json
@tsconfig.typecheck.json

<facts>
- Branch `feature/fase-57-localizacao-e-expansao-multimercado`, HEAD `0d7e89b4`, worktree limpo
  antes do planejamento.
- `npm` no PATH resolve para `C:\Windows\System32\npm` (0 byte) antes do npm real. Usar
  `& "C:\Program Files\nodejs\npm.cmd"` em todos os comandos.
- `node_modules`: diretório real, sem reparse points, 385 diretórios de topo, sem `.bin` e sem
  `.package-lock.json`. Lockfile v3 com 580 entradas `node_modules/*`.
- `sharp` falha em `@img/colour`; `@google/generative-ai` e `@eslint-community/eslint-utils`
  ausentes; `tsx` tem `dist/` mas não tem shim em `.bin`.
- Typecheck global: 29 erros = 1 módulo ausente (`src/lib/ai/adapters/gemini.ts`) + 28 erros em
  dois testes pré-existentes (`2d42c512`), nenhum em `market-context`.
- `tsserver`/`tsc` e `vitest` funcionam por caminho direto (`node node_modules/...`).
- Espaço livre ~15,6 GB; cache npm em `C:\Users\wagne\AppData\Local\npm-cache`.
- Nenhum processo Node do projeto em execução no momento do diagnóstico (apenas runtimes do
  agente).
</facts>
</context>

<diagnosis>
## Diagnóstico confirmado

| Categoria | Achado | Consequência |
|---|---|---|
| **Ambiente — PATH** | `C:\Windows\System32\npm` (0 byte) precede o npm real | `npm`/scripts falham sem mensagem útil; não é problema do projeto |
| **Ambiente — dependências** | `node_modules` parcial: sem `.bin`, sem hidden lockfile, 385 de 580 entradas | `tsx`, `eslint`, `sharp`, Gemini indisponíveis; build/typecheck/lint bloqueados |
| **Ambiente — Node/npm** | Node 24.13.1; npm real 11.8.0; lockfile v3 | `npm ci` é compatível e reproduzível |
| **Código dos testes** | 1 erro em `image-usage-token-cost.test.ts`: `imageUnitCostUsd` em literal `UsageTokenPricing` | erro de tipagem da fixture, não de produção |
| **Código dos testes** | 27 erros em `product-1-1-image-usage-integration.test.ts`: mocks `vi.fn(async () => {})` sem parâmetro | `record.mock.calls[0][0]` acessa tupla vazia |
| **Limitação de verificação** | `eslint.config.mjs` sem parser/plugin TS | lint executar ≠ lint TS validado |
| **Pertencimento** | 28 erros de teste existem desde `2d42c512`; F57 não os introduziu | corrigir é requisito para o gate, não regressão da F57 |

Total: **29** diagnósticos — 1 ambiente (módulo ausente) e 28 de tipagem em testes.
</diagnosis>

<procedure>
## Procedimento exato de recuperação

### Caminhos afetados
- `C:\Projetos\Vendeo V3\node_modules` — **substituído integralmente** por `npm ci` (não versionado).
- `C:\Users\wagne\AppData\Local\npm-cache` — pode receber cache (não versionado).
- Nada em `C:\Windows\System32`, PATH global, `.npmrc` (inexistente) ou config de usuário.
- Nenhum reparse point será criado ou removido; nenhuma limpeza ampla de diretórios.

### Passos
1. **Baseline (read-only):** `git status --porcelain`, `git rev-parse HEAD`,
   `git hash-object package.json package-lock.json`.
2. **Conferência de caminhos:** `Get-Item node_modules` (Directory, sem
   `ReparsePoint`), varredura de reparse points sob `node_modules`, espaço livre em `C:`.
3. **Conferência de processos:** listar `Win32_Process` e filtrar `CommandLine` contendo
   `C:\Projetos\Vendeo V3`. Nenhum processo do projeto deve estar ativo antes de substituir
   `node_modules`. **Não** encerrar processos de outros projetos/agentes.
4. **Ensaio do lockfile:** `& "C:\Program Files\nodejs\npm.cmd" ci --dry-run`. Divergência de
   lock ⇒ **parar** e reportar.
5. **Instalação:** `& "C:\Program Files\nodejs\npm.cmd" ci`. Efeito esperado: remoção e
   recriação de `node_modules`, instalação das 580 entradas, execução de scripts de instalação
   de dependências (ex.: binários do Sharp). O comando roda a partir da raiz do repositório.
6. **Verificação da instalação:**
   - `.bin` existe e contém `tsx`, `tsc`, `vitest`, `eslint`;
   - `node -e "require('sharp')"`, `node -e "require('@google/generative-ai')"`;
   - `node_modules/.bin/tsx --version`, `tsc -v`, `vitest --version`, `eslint --version`;
   - `git hash-object package.json package-lock.json` **idênticos** ao baseline;
   - `git status --porcelain` sem alterações inesperadas.
7. **Bloqueio de arquivo (se houver):** capturar `EPERM`/`EBUSY`, identificar o processo
   **cujo CommandLine pertence a este projeto** e pedir confirmação antes de encerrá-lo. Se não
   for possível isolar, parar. Proibido `taskkill /IM node.exe`, `rm -rf` manual ou apagar
   subpastas de `node_modules` "na mão".
8. **Falha de rede/registry/auth:** parar e reportar o erro literal; não trocar registry, não
   usar `--force`, não instalar versões avulsas.

Tempo estimado: 5–15 min de instalação, dependendo da rede.
</procedure>

<tasks>

<task type="auto">
  <name>Task 1: Preflight e reconstrução de node_modules via npm ci</name>
  <files>
  </files>
  <action>
    Executar o procedimento acima (passos 1–6) usando o npm real por caminho absoluto.
    Nenhum arquivo do repositório deve ser editado nesta task; apenas `node_modules` e o cache
    npm são afetados. Registrar no SUMMARY os hashes de `package.json`/`package-lock.json`
    antes/depois, as versões de node/npm, a contagem de pacotes e as saídas literais de carga de
    `sharp` e `@google/generative-ai`.
  </action>
  <verify>
    <automated>node -e "require('sharp'); require('@google/generative-ai'); console.log('modules ok')"</automated>
    <automated>node_modules/.bin/tsx --version</automated>
    <automated>git hash-object package.json package-lock.json</automated>
  </verify>
  <done>
    `.bin` restaurado; `sharp` e Gemini carregam; `tsx`, `tsc`, `vitest` e `eslint` respondem;
    manifests/lockfile com hashes inalterados; nenhum processo encerrado sem confirmação.
  </done>
</task>

<task type="auto">
  <name>Task 2: Corrigir tipagem dos dois testes pré-existentes</name>
  <files>
    src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts
    src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts
  </files>
  <action>
    (a) Em `image-usage-token-cost.test.ts`, tipar a fixture que inclui `imageUnitCostUsd` com
    `ModelPricing` (import type de `../ai-model-pricing`), sem `as any`; manter o teste e as
    asserções `estimatedCostUsd === 0.029762` e `not.toBe(0.041)`.
    (b) Em `product-1-1-image-usage-integration.test.ts`, importar `type { AiCostEvent }` de
    `@/lib/ai-cost/types` e tipar os cinco mocks `record` como recebendo `AiCostEvent`; ajustar o
    parâmetro `tracker` de `telemetryWith` para `{ record: (event: AiCostEvent) => Promise<void> }`;
    substituir `tracker as never` por cast estrutural explícito e tipado no boundary do sink
    (`as unknown as AiCostTracker`, import type). Preservar todas as asserções existentes de
    custo, tokens, tentativas e metadata — nenhuma deve ser removida ou afrouxada.
    Proibido: `any`, `@ts-ignore`, `@ts-expect-error`, exclusão de testes, `strict: false`,
    `ignoreBuildErrors`, alteração de contratos produtivos.
  </action>
  <verify>
    <automated>& "C:\Program Files\nodejs\npm.cmd" test -- src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts</automated>
    <automated>& "C:\Program Files\nodejs\npm.cmd" test -- src/lib/market-context</automated>
  </verify>
  <done>
    Os dois arquivos passam integralmente; os 72 testes de `market-context` continuam passando;
    nenhuma asserção removida; `git diff` restrito aos dois arquivos.
  </done>
</task>

<task type="auto">
  <name>Task 3: Gates globais e auditoria de diff</name>
  <files>
  </files>
  <action>
    Executar `npm run typecheck`, `npm run lint` e `npm run build` com o npm real. Registrar as
    saídas literais e a **cobertura efetiva** do lint (o config atual não cobre TS; não declarar
    lint TypeScript validado). Auditar `git status --porcelain`, `git diff --name-only`,
    `git hash-object package.json package-lock.json` e `git diff --check`. Não executar a suíte
    completa `npm test` (pode exigir banco/provider); se necessário, avaliar efeitos antes.
    Qualquer erro novo fora dos dois arquivos ⇒ parar e reportar, sem ampliar escopo.
  </action>
  <verify>
    <automated>& "C:\Program Files\nodejs\npm.cmd" run typecheck</automated>
    <automated>& "C:\Program Files\nodejs\npm.cmd" run build</automated>
    <automated>git status --porcelain; git diff --name-only</automated>
  </verify>
  <done>
    `typecheck` com 0 erros; `build` concluído; `lint` executado com limitação registrada; diff
    contém apenas os dois arquivos de teste (+ artefatos de tracking); manifests/lockfile
    inalterados; nenhum push/merge/deploy.
  </done>
</task>

</tasks>

<verification>
## Comandos de validação (execução futura)

Usar sempre o npm real: `& "C:\Program Files\nodejs\npm.cmd" ...`

1. `npm ci --dry-run` (preflight do lockfile).
2. `npm ci` (reconstrução).
3. `node -e "require('sharp'); require('@google/generative-ai')"`.
4. `npm test -- src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts`.
5. `npm test -- src/lib/market-context` (deve permanecer 72/72).
6. `npm run typecheck` (0 erros).
7. `npm run lint` (executa; cobertura TS limitada — registrar, não superdeclarar).
8. `npm run build` (inclui `check:cnae` via `tsx`).
9. `git status --porcelain` + `git diff --name-only` + `git diff --check`.
10. `git hash-object package.json package-lock.json` comparado ao baseline.

## Condições de parada (não negociáveis)

- `npm ci --dry-run` indica lock fora de sincronia.
- `npm ci` falha por EPERM/EBUSY e o processo bloqueador não pode ser isolado neste projeto.
- Falha de rede/registry/auth ou tentativa de alterar o lockfile.
- `package.json`/`package-lock.json` mudam (hash diferente).
- Aparecem erros de typecheck fora dos dois arquivos previstos.
- `build` falha por motivo não relacionado aos dois testes.
- Qualquer necessidade de banco, provider pago, env nova, push, merge ou deploy.

Em qualquer parada: registrar comando, saída literal e diagnóstico; devolver para revisão.
**Falha de gate não vira aceite automático.**
</verification>

<scope_and_sequence_notes>
## Sequência e por que ela importa

1. **Instalar antes de corrigir** — sem `node_modules` completo não há typecheck confiável; e
   `npm ci` substitui tudo, então qualquer edição feita antes poderia ser perdida/confundida.
2. **Corrigir só os dois testes** — os 28 erros são de fixtures/mocks, não de produção. Nenhum
   contrato produtivo muda.
3. **Validar globalmente depois** — typecheck/build só fazem sentido com dependências e testes
   corrigidos, e com a ressalva explícita do lint.

`node_modules` não é versionado: a recuperação não gera diff de código. As únicas mudanças
versionáveis previstas são os dois arquivos de teste.
</scope_and_sequence_notes>

<reconciliation>
## Relação com a quick 261027-k4d

- `261027-k4d` (fundação multimercado) está **aprovada e versionada** em `0d7e89b4`; esta quick
  **não** altera `src/lib/market-context/**` nem seus artefatos.
- Os 29 diagnósticos foram registrados no SUMMARY da `k4d` como limitação de ambiente/gates. Esta
  quick é a ação própria e controlada para resolvê-los.
- Nenhum artefato da `k4d` será reescrito; apenas referenciado.

## Pendências que exigem avaliação antes do encerramento

1. **Cobertura TypeScript do ESLint** — fora do escopo; decidir em quick/fase própria.
2. **Suíte completa `npm test`** — pode exigir PostgreSQL/provider; decidir escopo e condições
   antes de executar.
3. **Histórico de dano em dependências por junction/worktree** — esta quick não cria nem remove
   junctions; se o ambiente apresentar reparse points inesperados, parar.
4. **Push/deploy** — não fazem parte desta quick; push dispara deploy e exige decisão separada.
5. **Origem do `C:\Windows\System32\npm` de 0 byte** — não será corrigida aqui (ambiente global);
   registrar para avaliação do usuário.
</reconciliation>
