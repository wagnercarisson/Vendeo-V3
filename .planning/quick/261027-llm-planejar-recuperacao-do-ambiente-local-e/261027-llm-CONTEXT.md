# Quick Task 261027-llm: Recuperação do ambiente local e dos gates - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning
**Scope:** planejamento apenas — nenhuma instalação, correção ou execução nesta etapa

<domain>
## Task Boundary

Planejar a recuperação **reprodutível** do ambiente local do Vendeo V3 e a correção dos dois
testes que impedem o typecheck global, antes de qualquer push. Push dispara deploy: não fazer
push, merge ou deploy.

Esta quick é **separada** da `261027-k4d` (fundação multimercado, já aprovada e versionada).
Não altera `src/lib/market-context/**` nem regras de geração, cobrança, créditos ou campanhas.

Entrada observada: branch `feature/fase-57-localizacao-e-expansao-multimercado`, HEAD
`0d7e89b4`, worktree limpo no início do planejamento.

</domain>

<decisions>
## Decisões de planejamento

### 1. Causa raiz do ambiente: `npm` quebrado no PATH + `node_modules` parcial
- `where npm` → `C:\Windows\System32\npm` (arquivo de **0 byte**) antes de
  `C:\Program Files\nodejs\npm.cmd`. Por isso `npm` "não existe"/falha silenciosamente.
- O npm real é **11.8.0** (`C:\Program Files\nodejs\npm.cmd`); Node é **v24.13.1**.
- `node_modules` é diretório real (atributo `Directory`, sem reparse point; **nenhum** junction
  sob ele), mas **incompleto**: 385 diretórios de topo, **sem `.bin`**, **sem
  `node_modules/.package-lock.json`** e sem módulos exigidos.
- `package-lock.json` é `lockfileVersion: 3`, com **580 entradas** `node_modules/*` e
  **581** entradas totais (14 deps + 16 dev deps na raiz). `package.json` e lock estão coerentes.
- `npx` **não** está sombreado (`C:\Program Files\nodejs\npx.cmd`), mas sem `.bin` ele tentaria
  baixar pacotes da rede; usar sempre caminho absoluto/`node node_modules/...`.
- Espaço livre em `C:` no momento: ~15,6 GB. Cache npm: `C:\Users\wagne\AppData\Local\npm-cache`.

### 2. Instalação reproduzível com `npm ci`
- `npm ci` **substitui integralmente** `node_modules` e instala a partir do lockfile, sem
  atualizar versões; é o procedimento escolhido.
- Executar pelo caminho absoluto do npm real (ou prepend de PATH **apenas na sessão**). Não
  alterar PATH global, `.npmrc` (não existe) nem configuração de usuário.
- Preservar `package.json`, `package-lock.json` e lockfile. `npm ci` não deve reescrevê-los;
  qualquer diff nesses arquivos é condição de parada.
- Antes do passo destrutivo, `npm ci --dry-run` valida a sincronia do lock sem tocar o disco.
- Arquivos bloqueados: identificar **somente** processos cujo `CommandLine` aponte para
  `C:\Projetos\Vendeo V3`; pedir confirmação antes de encerrar. Proibido `taskkill /IM node.exe`
  ou finalização ampla. Se o bloqueio persistir, parar e reportar.
- Não usar `npm install` para "consertar" parcialmente, nem `npm audit fix`, nem `--force`/`--legacy-peer-deps`.

### 3. Dois erros de teste são pré-existentes e independentes da F57
- Já existiam no commit `2d42c512`; a comparação com/sem `market-context` produziu os mesmos 29
  diagnósticos. Corrigi-los é necessário porque `tsconfig.typecheck.json` inclui `**/*.ts`.
- Correção mínima, sem `any`, `@ts-ignore`, exclusão de testes, `strict: false` ou
  `ignoreBuildErrors`, e sem alterar contratos produtivos.

### 4. Lint: executar, mas não superdeclarar
- `eslint.config.mjs` não declara parser/plugin TypeScript nem alvo `**/*.ts`; logo `eslint .`
  **não cobre** os arquivos TS. Restaurar a execução não cria cobertura TS.
- A configuração global **não** será corrigida nesta quick (proibido ampliar). A limitação fica
  registrada para avaliação explícita do Codex/usuário.

### 5. Escopo de validação
- Rodar apenas os dois arquivos corrigidos + `src/lib/market-context` (72 testes).
- `npm run typecheck`, `npm run lint`, `npm run build` são gates globais obrigatórios.
- Suíte completa `npm test` **não** roda por padrão: há testes `*.postgres.test.ts` e de
  integração que podem exigir banco/provider. Se forem executados, identificar efeitos e
  condições antes.
- Nenhum banco, migration, env, flag, chamada paga, push, merge ou deploy.

### 6. the agent's Discretion
- Ordem interna dos comandos de verificação e formato do SUMMARY, desde que: instalação
  preceda correções, paradas sejam explícitas, manifestos/lockfile sejam auditados por hash e
  nenhum gate falho seja declarado como sucesso.

</decisions>

<specifics>
## Specific Ideas

- Correção 1 (`src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts`): tipar a fixture com o
  contrato real que inclui o campo pré-chamada — `ModelPricing` (extends `UsageTokenPricing`,
  adiciona `imageUnitCostUsd?`) — em vez de adicionar a propriedade a um literal
  `UsageTokenPricing`. O teste "image_unit_usd do pré-chamada não é usado no pós-chamada" deve
  permanecer com as asserções `0.029762` e `not.toBe(0.041)`.
- Correção 2 (`src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts`): tipar os 5
  mocks `vi.fn(async () => {})` com `AiCostEvent` (`@/lib/ai-cost/types`), de modo que
  `record.mock.calls[0][0]` seja o evento real; ajustar o tipo do parâmetro `tracker` em
  `telemetryWith` para `{ record: (event: AiCostEvent) => Promise<void> }`; substituir o cast
  `as never` do boundary do sink por cast estrutural explícito e tipado. Preservar todas as
  asserções de custo, tokens, tentativas e metadata.
- Nunca usar `as any`; o único cast aceitável é o estrutural no boundary do sink, documentado.

</specifics>

<canonical_refs>
## Canonical References

- `AGENTS.md` — validação obrigatória de fase (typecheck, lint, build, manual).
- `docs/fluxo-de-desenvolvimento.md` — validação local ≠ produção; gates distintos.
- `.planning/STATE.md` — posição atual e histórico de `261027-k4d`.
- `.planning/quick/261027-k4d-planejar-primeira-fatia-da-fundacao-mult/261027-k4d-SUMMARY.md` —
  origem dos 29 diagnósticos e das limitações de ambiente.
- `package.json`, `package-lock.json` — scripts e lockfile v3 (580 entradas `node_modules/*`).
- `tsconfig.typecheck.json` / `tsconfig.json` — `**/*.ts` inclui testes.
- `eslint.config.mjs` — sem parser/plugin TS (limitação reconhecida, não corrigir aqui).
- `src/lib/ai-cost/types.ts` (`UsageTokenPricing`, `AiCostEvent`),
  `src/lib/ai-cost/ai-model-pricing.ts` (`ModelPricing`),
  `src/lib/ai/telemetry-sink.ts` (`DefaultAiTelemetrySink`).

</canonical_refs>
