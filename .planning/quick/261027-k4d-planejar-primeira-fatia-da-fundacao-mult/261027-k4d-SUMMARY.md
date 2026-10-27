---
status: complete
implementation_status: implemented
gate_status: partial_environment
acceptance: approved
accepted_on: 2026-10-27
date: 2026-10-27
quick_id: 261027-k4d
initiative: F57
branch: feature/fase-57-localizacao-e-expansao-multimercado
commits:
  - b545bc98
  - 35a1c5f4
  - 00c95b1b
  - beec4e67
  - 7d029eb0
verification:
  tests: "PASS — 6 files / 72 tests (node node_modules/vitest/vitest.mjs run src/lib/market-context). `npx vitest` is unavailable in this environment because node_modules/.bin is missing."
  typecheck: "FAIL (pre-existing/environmental) — `npm run typecheck` cannot find `tsc` for the same missing node_modules/.bin; running tsc directly reports 29 errors in untouched files (1 in src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts, 27 in src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts, 1 in src/lib/ai/adapters/gemini.ts: Cannot find module '@google/generative-ai'). Zero errors in src/lib/market-context. Targeted tsc over the new TS files exited 0."
  build: "FAIL (environmental) — `npm run build` aborts in check:cnae because `tsx` is not found (node_modules/.bin missing); @google/generative-ai is also absent from node_modules. Build was NOT validated."
  lint: "NOT RUN — ESLint 10.4.0 crashes with Cannot find module '@eslint-community/eslint-utils' (incomplete node_modules). Independently, eslint.config.mjs does not target **/*.ts, so exit 0 would not prove TypeScript lint coverage."
  import_guard: "PASS — `rg -n \"market-context\" src --glob \"!src/lib/market-context/**\"` returned no matches (exit 1)."
---

# Quick 261027-k4d — Primeira fatia da fundação multimercado (F57)

## Resultado resumido

Implementação pura da biblioteca `src/lib/market-context/**`, sem consumidor produtivo,
sem persistência, sem dependência nova e sem alterar arquivo existente. Foram criados
**14 arquivos** (13 TypeScript + 1 README) em 3 commits atômicos, mais **1 commit corretivo**
(`beec4e67`) e **1 commit documental** (`7d029eb0`) após a revisão Codex.

**Aceite:** aprovado pelo usuário em **2026-10-27**, após revisão do código e reprodução das
verificações. A suíte nova passa integralmente (72/72) e o typecheck direcionado dos arquivos
novos passa. Os gates globais `npm run typecheck` e `npm run build` não puderam ser executados
neste ambiente por `node_modules` incompleto (`.bin` ausente e `@google/generative-ai` ausente),
além de 29 erros preexistentes em arquivos não tocados. A aprovação considera essas limitações
conhecidas; a recuperação das dependências e a revalidação dos gates globais ficam como ação
própria e controlada, fora desta quick. Ver "Limitações" e "Evidências".

## Entregue por task

### Task 1 — Tipos, perfis versionados e validação pura (`b545bc98`)

- `types.ts`: seis dimensões como contratos separados; entradas de configuração
  (`StoreMarketConfigInput`, parcial) vs valores versionados (`StoreMarketContext`,
  `CampaignMarketContext`, completos); proveniências; fontes por campo; resultados
  discriminados; erros tipados (`MarketContextError`) com `field`/`reason`/`received`.
- `market-profiles.ts`: `MARKET_PROFILES` com BR (`pt-BR`/`BRL`/`America/Sao_Paulo`) e PY
  (`es-PY`/`PYG`/`America/Asuncion`), `profileVersion: 1`, registry e perfis congelados.
- `validation.ts`: guards puros (`isSupportedMarket`, `isSupportedLocale`,
  `isSupportedCurrency`, `isSupportedTimeZone`, `getMarketProfile`) que aceitam `unknown` e
  não lançam; `checkMarketProfileRegistry()` para consistência estática; helpers de erro,
  objeto plano e sanitização de `received` (nunca expõe referência à entrada).
- `index.ts`: barrel com exports explícitos (valores e tipos).
- Testes: `market-profiles.test.ts` (valores, congelamento recursivo, mutação bloqueada,
  registry consistente) e `validation.test.ts` (aceita BR/PY/pt-BR/es-PY/BRL/PYG/Sao_Paulo/
  Asuncion; rejeita AR/es-AR/USD/Mexico_City/malformados).

### Task 2 — Contexto da loja e idioma do aplicativo (`35a1c5f4`)

- `store-context.ts`:
  - `resolveStoreMarketContext`: idioma e moeda padrão derivam do **mercado padrão das
    campanhas**; fuso deriva do **país cadastral**; overrides explícitos vencem; `kind:
    "legacy"` só resolve quando declarado e produz BR com proveniência `legacy_br`;
    `configured` sem país retorna `missing_country` (nunca cai em BR).
  - `parseStoreMarketContext`: estrito, sem defaults; rejeita não-objeto, vazio, incompleto,
    campo desconhecido e versão ≠ 1 com erro tipado.
- `user-preference.ts`: `resolveUiLocale` aceita apenas `explicit | legacy`; não recebe loja,
  país ou mercado; `legacy` ⇒ `pt-BR`/`legacy_br`.
- `index.ts` estendido com os novos exports.
- Testes: `store-context.test.ts` (BR→PY e PY→BR na loja, overrides, fontes por campo,
  ausência de país, valores não suportados, legado explícito, parsers, independência de
  entradas) e `user-preference.test.ts` (explicit, legacy, locale não suportado, indiferença
  a `market`/`country`).

### Task 3 — Campanha, cruzamento e leitura de entregues (`00c95b1b`)

- `campaign-context.ts`:
  - `resolveCampaignMarketContext`: precedência `override → padrão da loja (destino = mercado
    padrão) → padrão do perfil do destino`; `sources` por campo com
    `campaign_override | store_default | market_profile_default | legacy_br`.
  - `parseCampaignMarketContext`: estrito, sem defaults/backfill.
  - `readCampaignMarketContext`: `null`/`undefined` ⇒ `missing_legacy`; `{}`/incompleto/
    versão desconhecida/campo desconhecido/não-objeto ⇒ `invalid` com `reason`; completo ⇒
    `present` com cópia **nova e congelada**. Nunca consulta loja/usuário.
- `index.ts` final e `README.md` com as invariantes, o aviso de que `PY` é referência (não
  habilitação operacional) e o registro de que a proteção produtiva de campanhas entregues
  ainda não existe.
- Testes: `campaign-context.test.ts` (defaults, troca de destino, overrides por campo,
  moeda independente de mercado, legado, overrides inválidos, store inválido, parsers,
  `missing_legacy`/`invalid`/`present`, imutabilidade e independência) e `cross-market.test.ts`
  (BR→PY e PY→BR, padrões do destino, idioma do app independente do conteúdo, leitura estável
  após mudança de preferências, proveniência legada).

## Decisões de implementação relevantes

- **`storeIsLegacy` explícito** em `CampaignMarketConfig`: o valor versionado da loja não
  carrega proveniência, e `legacy` nunca pode ser inferido. O flag apenas propaga
  `legacy_br` para `sources`, sem alterar valores.
- **Config parcial vs valor estrito**: resolvedores aceitam `unknown` (não lançam); parsers
  exigem todos os campos. Ausência de país é `missing_country`, não default.
- **Saídas congeladas**: contextos, fontes, resultados e erros são `Object.freeze`; `received`
  nos erros é sanitizado (string/número/booleano/null/"array"/"object") para não vazar
  referência à entrada.
- **`index.ts` incremental**: o barrel foi construído task a task para que cada commit seja
  auto-consistente (sem imports de arquivos ainda inexistentes).
- **Sem `Intl`, sem I/O, sem env**: valores suportados são listas estáticas congeladas.

## Correção pós-revisão Codex (2026-10-27) — legado com campos mistos

**Achado [Média]:** `resolveStoreMarketContext` e `resolveUiLocale` retornavam padrões
brasileiros para qualquer entrada com `kind: "legacy"`, descartando campos contraditórios
(`country: "PY"`, `defaultCurrency: "PYG"`, `uiLocale: "es-PY"`). Isso contrariava a regra
aprovada de que legado representa **ausência total de configuração**.

**Correção (commit `beec4e67`):**

- `findUnexpectedKey` adicionado a `validation.ts`: retorna a primeira chave própria fora da
  lista permitida.
- No modo `legacy`, ambos os resolvedores agora rejeitam **qualquer** campo adicional com
  `invalid_input` / `reason: "invalid_field"`, preenchendo `field` e `received`. Nenhum valor é
  descartado nem substituído por BR/pt-BR.
- `{ kind: "legacy" }` puro continua válido e inalterado (BR, `pt-BR`, proveniência `legacy_br`).
- A presença da chave com valor `undefined` também é rejeitada: a checagem é por chave própria,
  não por valor — coerente com "ausência total".
- Sem refatoração dos parsers e sem alteração de contrato fora do modo `legacy`.

**Testes de regressão adicionados (2, suíte 70 → 72):**

- loja: `country: "PY"`, `defaultCurrency: "PYG"`, `country: "BR"` (valor brasileiro explícito
  também contradiz legado) e `country: undefined`;
- app: `uiLocale: "es-PY"` e `country: "PY"`.

Resultado reexecutado: **6 arquivos / 72 testes passaram**; tsc direcionado aos arquivos novos
**exit 0**. As limitações de ambiente dos gates globais permanecem as mesmas da seção abaixo.

## Evidências de verificação (saídas reais)

| Comando | Resultado |
|---|---|
| `node node_modules/vitest/vitest.mjs run src/lib/market-context` | **PASS** — `Test Files 6 passed (6)`, `Tests 72 passed (72)` (após a correção do legado misto) |
| `npx vitest run src/lib/market-context` | **NÃO EXECUTA** — `vitest` não reconhecido (sem `node_modules/.bin`) |
| `npm run typecheck` | **FAIL** — `tsc` não reconhecido (sem `node_modules/.bin`) |
| `node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit` | **FAIL (pré-existente/ambiente)** — **29 erros**, todos em arquivos não tocados: 1 em `src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts`, 27 em `src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts` e 1 em `src/lib/ai/adapters/gemini.ts` (`Cannot find module '@google/generative-ai'`). **0 erros em `src/lib/market-context`.** |
| tsc direcionado aos 13 arquivos TS novos (mesmas flags do projeto) | **PASS** — exit 0 |
| `npm run build` | **FAIL (ambiente)** — aborta em `check:cnae`: `'tsx' não é reconhecido`; `@google/generative-ai` ausente de `node_modules` impede o compile |
| ESLint (`node node_modules/eslint/bin/eslint.js src/lib/market-context`) | **NÃO EXECUTA** — `Cannot find module '@eslint-community/eslint-utils'` |
| `rg -n "market-context" src --glob "!src/lib/market-context/**"` | **PASS** — sem ocorrências (exit 1) |
| `git diff --check` | **PASS** — exit 0 |
| `git ls-files src/lib/market-context` | **14 arquivos**, exatamente os previstos |

Estado do worktree após os commits: apenas `M .planning/STATE.md` (pré-existente, não
commitado) e o diretório não rastreado desta quick. Nenhum `package.json`/lockfile,
`supabase/**`, `src/app/**`, `src/components/**`, `src/lib/formatters.ts`, `src/lib/store*.ts`,
`src/lib/campaign-intelligence/**`, config global ou env foi alterado.

## Limitações

1. **Typecheck global não validável neste ambiente.** `node_modules/.bin` está ausente e
   `@google/generative-ai` não está instalado; os **29** erros do `tsc -p tsconfig.typecheck.json`
   estão em arquivos que esta quick não tocou (contagem reexecutada após a implementação: 1 em
   `ai-cost`, 27 em `ai/__tests__`, 1 em `ai/adapters/gemini.ts`). Nenhum erro em
   `src/lib/market-context`. Os arquivos TS novos passam em tsc direcionado. Não instalei
   dependências nem alterei configuração global.
2. **Build não validado.** `npm run build` falha antes do Next por `tsx` ausente e, mesmo
   contornando, o compile falharia pela dependência ausente acima. Registrado como limitação
   de ambiente, não como sucesso.
3. **Lint não cobre TypeScript.** Além de o ESLint não executar por módulo ausente, o
   `eslint.config.mjs` não declara parser/plugin TS nem alvo `**/*.ts`; exit 0 não provaria
   lint efetivo. Configuração global preservada.
4. **Sem UAT visual** (não há tela) e **sem validação de banco/produção**. Evidência de
   laboratório ≠ prontidão de produção.

## O que NÃO foi feito

- Persistência do contexto por loja (colunas, migrations, backfill, RLS, DTOs, RPC).
- Snapshot obrigatório/imutável por campanha entregue e decisão sobre campanhas legadas.
- Integração produtiva: nenhum caminho de `src/app`, `src/components`, Store, formatters,
  IA, prompts, geração ou renderização importa `market-context`.
- Seletores/configurações de idioma, mercado e moeda; catálogos de tradução.
- `MoneyV1`, parsers/formatação monetária, datas civis, moeda de cobrança da assinatura.
- Habilitação operacional do Paraguai (RUC/legal/pagamentos). O perfil `PY` é apenas
  referência.
- Alterações de dependências, env, flags, banco remoto, push, merge ou deploy.

## Pendências futuras

1. Persistência por loja com legado distinguível + RLS/DTO/RPC.
2. Snapshot obrigatório e imutável por campanha entregue; política explícita para legado.
3. UI de seleção de idioma/mercado/moeda e tradução de telas.
4. Formatadores monetários/datas e catálogos de mensagens.
5. Prompt/IA/renderização e contrato comercial de moeda de cobrança.
6. Registro formal da F57 (fase, requisitos, specs) no fluxo OpenSpec/GSD.

## Self-Check: PASSED

- 14 arquivos existem e estão rastreados (`git ls-files`).
- Commits `b545bc98`, `35a1c5f4`, `00c95b1b`, a correção `beec4e67` e a documentação
  `7d029eb0` existem no histórico da branch.
- Suíte `src/lib/market-context`: 72/72.
- Guard de importação produtiva: vazio.
