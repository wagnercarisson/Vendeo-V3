# F58-05 — Evidência de gates automatizados, regressões e inspeção de escopo

- **Fase:** 58 — Composição operacional do dashboard
- **Plano:** 58-05 (Task 1 — gates automatizados, regressões e medição de payload)
- **Data da execução:** 2026-11-02 (UTC `2026-11-02T16:25:17Z`, medido ao final da rodada)
- **Ambiente:** Windows / PowerShell, Node `v24.13.1`, npm `11.8.0`, working tree atual (sem worktree/branch paralela)
- **Escopo:** somente validação local. Nenhum push, merge, deploy, migration, alteração de banco, provider pago ou smoke de produção foi executado.
- **Regra de registro:** cada linha abaixo tem comando exato e exit code real observado. Nenhum resultado foi presumido.

## 1. Resultado consolidado

| # | Gate | Comando | Exit code | Resultado |
|---|------|---------|-----------|-----------|
| 1 | Suítes focadas (dashboard + crédito + i18n + changelog + verificações + readiness) | `npx vitest run src/lib/dashboard src/lib/credit/__tests__/credit-service-throw-on-error.test.ts src/lib/i18n/dashboard src/lib/changelog src/components/dashboard src/components/changelog src/components/verification src/components/readiness src/__tests__/app/dashboard` | **0** | **PASS** — 28 arquivos / **174 testes** passed, 0 failed |
| 2 | Regressão de contratos (campanha/onboarding) | `npx vitest run src/__tests__/lib/campaign/list.test.ts src/__tests__/lib/onboarding/state.test.ts src/__tests__/lib/onboarding/microcopy.test.ts` | **0** | **PASS** — 3 arquivos / **38 testes** passed |
| 3 | Regressão de shell/admin/localização | `npx vitest run src/__tests__/components/shell src/__tests__/app/layout-i18n.test.tsx src/__tests__/app/configuracoes "src/app/(app)/admin"` | **0** | **PASS** — 37 arquivos / **396 testes** passed |
| 4 | Typecheck | `npm.cmd run typecheck` | **0** | **PASS** — sem saída de erro |
| 5 | Lint | `npm.cmd run lint` | **0** | **PASS com limitação conhecida** — ESLint executa sem achados, mas **não cobre TypeScript** (ver §6) |
| 6 | Build | `npm.cmd run build` | **0** | **PASS** — 95/95 páginas geradas, `/dashboard` 4,27 kB / 110 kB |
| 7 | Diff check | `git diff --check` | **0** | **PASS** — nenhum erro de whitespace/conflito |
| 8 | OpenSpec strict | `npx openspec validate fase-58-composicao-operacional-do-dashboard --strict` | **0** | **PASS** — “Change 'fase-58-composicao-operacional-do-dashboard' is valid” |

Nenhum gate falhou. Nenhum gate foi registrado como “verde por presunção”.

## 2. Detalhe por gate

### 2.1 Suítes focadas (com teste de crédito incluído)

```
npx vitest run src/lib/dashboard src/lib/credit/__tests__/credit-service-throw-on-error.test.ts src/lib/i18n/dashboard src/lib/changelog src/components/dashboard src/components/changelog src/components/verification src/components/readiness src/__tests__/app/dashboard
```

Saída resumida real:

```
 Test Files  28 passed (28)
      Tests  174 passed (174)
   Duration  4.49s
```

Exit code: **0**. Inclui `src/lib/credit/__tests__/credit-service-throw-on-error.test.ts` (5 testes, ver §4).

### 2.2 Regressão de contratos preservados

```
npx vitest run src/__tests__/lib/campaign/list.test.ts src/__tests__/lib/onboarding/state.test.ts src/__tests__/lib/onboarding/microcopy.test.ts
```

```
 Test Files  3 passed (3)
      Tests  38 passed (38)
```

Exit code: **0**.

### 2.3 Regressão de shell, admin e localização

```
npx vitest run src/__tests__/components/shell src/__tests__/app/layout-i18n.test.tsx src/__tests__/app/configuracoes "src/app/(app)/admin"
```

```
 Test Files  37 passed (37)
      Tests  396 passed (396)
```

Exit code: **0**. Observação: o stderr contém mensagens jsdom `Not implemented: navigation to another Document` emitidas por testes de navegação já existentes; não são falhas e não alteram o exit code.

### 2.4 Typecheck

```
npm.cmd run typecheck
> tsc -p tsconfig.typecheck.json --noEmit
```

Exit code: **0**, sem diagnósticos.

### 2.5 Lint

```
npm.cmd run lint
> eslint .
```

Exit code: **0**, sem achados. **Limitação registrada (não corrigida nesta fase):** `eslint.config.mjs` configura apenas `languageOptions`/`rules` genéricas, sem parser/plugin TypeScript nem `files` para `.ts/.tsx`; portanto `.ts/.tsx` não são analisados. O exit 0 **não** é evidência de lint sobre TypeScript. Limitação preexistente e já aceita pelo responsável em fases anteriores.

### 2.6 Build

```
npm.cmd run build
> npm run check:cnae && next build
check:cnae OK — no contradictions in CNAE_SEGMENT_MAP
 ✓ Compiled successfully in 19.0s
 ✓ Generating static pages (95/95)
```

Trecho relevante do relatório de rotas:

```
├ ƒ /dashboard                                               4.27 kB         110 kB
+ First Load JS shared by all                                 102 kB
```

Exit code: **0**. Build de referência da medição de payload (§ `58-05-payload-measurement.md`).

### 2.7 Diff check

```
git diff --check
```

Exit code: **0**. Saída apenas com avisos de normalização LF→CRLF em `.planning/STATE.md` e `.planning/config.json` (arquivos de planejamento pré-existentes, sem conteúdo alterado por esta execução).

### 2.8 OpenSpec strict

```
npx openspec validate fase-58-composicao-operacional-do-dashboard --strict
Change 'fase-58-composicao-operacional-do-dashboard' is valid
```

Exit code: **0**.

## 3. Inspeção estática de escopo

Baseline de comparação: `77cc9413` = `6a0bfe66^` (commit imediatamente anterior ao primeiro commit da F58). Intervalo auditado: `77cc9413..HEAD` (todos os commits 58-01 → 58-04).

### 3.1 `git status --porcelain`

```
 M .planning/STATE.md
 M .planning/config.json
```

Somente arquivos de planejamento pré-existentes na árvore (marcação de estado/CRLF). **Nenhum arquivo de código, teste, migration, dependência ou configuração de app modificado/não rastreado** no início desta Task 1. Resultado: **PASS**.

### 3.2 Arquivos alterados no intervalo F58

```
git diff --stat 77cc9413..HEAD -- src supabase package.json package-lock.json
 44 files changed, 3756 insertions(+), 726 deletions(-)
```

Todos os 44 arquivos estão sob `src/` (páginas do dashboard, componentes do dashboard, `src/lib/dashboard/**`, `src/lib/i18n/dashboard/**`, `src/lib/changelog/excerpt.ts`, banners de readiness/verification, testes correspondentes e `src/lib/credit/credit-service.ts`). Resultado: **PASS**.

### 3.3 Migrations

```
git diff --name-only 77cc9413..HEAD -- supabase/migrations
```

Saída: **vazia**. Zero migrations criadas ou alteradas. Resultado: **PASS**.

### 3.4 Rotas de API

```
git diff --name-only 77cc9413..HEAD -- src/app/api
```

Saída: **vazia**. Zero rotas novas ou alteradas. Resultado: **PASS**.

### 3.5 Dependências

```
git diff --name-only 77cc9413..HEAD -- package.json package-lock.json
```

Saída: **vazia**. Zero alteração de dependências; nenhum `npm install`/`npm ci` executado nesta Task 1. Resultado: **PASS**.

### 3.6 Caminhos proibidos

```
git diff --name-only 77cc9413..HEAD -- "src/app/(app)/admin" "src/components/shell" "src/app/(app)/layout.tsx" "src/lib/campaign/metrics.ts" "src/lib/campaign/list.ts" "src/lib/onboarding/state.ts" "src/components/credit/balance-display.tsx"
```

Saída: **vazia**. Nenhuma alteração em shell, layout do grupo `(app)`, admin, contratos de campanha/onboarding ou `BalanceDisplay`. Resultado: **PASS**.

### 3.7 Exceção autorizada — `src/lib/credit/credit-service.ts`

Única alteração em serviço compartilhado. Diff completo:

```diff
-  async getBalanceBreakdown(storeId: string): Promise<CreditBalanceBreakdown> {
-    const { data } = await this.client
+  /**
+   * Lê o breakdown de crédito da loja.
+   *
+   * Extensão aditiva (F58/D-04): `opts.throwOnError` permite ao consumidor que
+   * precisa distinguir falha de leitura de saldo zero (dashboard) receber o erro
+   * do Supabase. O default (`false`) preserva byte a byte o comportamento de
+   * todos os chamadores existentes. `PGRST116` (nenhuma linha) continua sendo
+   * tratado como zeros mesmo com `throwOnError: true`.
+   */
+  async getBalanceBreakdown(
+    storeId: string,
+    opts?: { throwOnError?: boolean },
+  ): Promise<CreditBalanceBreakdown> {
+    const { data, error } = await this.client
       .from("credit_balances")
       .select("balance, demo_balance, demo_expires_at, origin_demo_grant_tx_id, bonus_balance, purchased_balance")
       .eq("store_id", storeId)
       .single();

+    if (error && opts?.throwOnError === true && error.code !== "PGRST116") {
+      throw error;
+    }
+
     return {
```

Verificação item a item:

| Item | Evidência | Resultado |
|------|-----------|-----------|
| Somente a opção aditiva `throwOnError` em `getBalanceBreakdown` | diff acima; nenhuma outra assinatura/corpo alterado | **PASS** |
| Default `false` (sem opção, comportamento preservado) | `if (error && opts?.throwOnError === true && ...)`; teste (a)/(b) | **PASS** |
| `PGRST116` (nenhuma linha) continua zero mesmo em modo estrito | `error.code !== "PGRST116"`; teste (d) | **PASS** |
| Teste do modo estrito propaga o erro | teste (c) `rejeita o erro do Supabase` | **PASS** |
| Nenhum outro chamador alterado | diff de escopo §3.6 vazio; chamadores fora do intervalo F58 | **PASS** |

### 3.8 Testes do serviço de crédito (incluídos na suíte focada)

```
npx vitest run src/lib/credit/__tests__/credit-service-throw-on-error.test.ts   # executado dentro do gate 1
 Test Files  1 passed (1)  (5 testes no arquivo)
```

Casos cobertos no arquivo:

1. `(a)` sem opção — erro do Supabase retorna breakdown com zeros.
2. `(b)` `{ throwOnError: false }` — mantém retorno de zeros.
3. `(c)` `{ throwOnError: true }` — rejeita o erro do Supabase.
4. `(d)` `PGRST116` (nenhuma linha) — continua retornando zeros com `throwOnError: true`.
5. leitura com sucesso — mantém o breakdown normal.

Resultado: **PASS**.

## 4. Limitações e itens fora de escopo

- **Lint sem cobertura TypeScript** (preexistente): registrado em §2.5; não corrigido por estar fora do escopo da F58.
- **Testes de integração de crédito que exigem banco real** (`credit-concurrency`, `credit-f50-11-integration`, `credit-idempotency`, `operation-cost-service.integration`) não foram executados: dependem de `NEXT_PUBLIC_SUPABASE_URL`/banco, e esta Task 1 não acessa banco. Já documentados como limitação em `58-01-SUMMARY.md`.
- **Media queries não são avaliadas pelo jsdom**: comportamento responsivo real (mobile/tablet) depende da Task 2 (validação visual humana).
- **Payload numérico é evidência manual**; a prova determinística de isolamento é o teste estático `src/lib/i18n/dashboard/__tests__/isolation.test.ts` (ver `58-05-payload-measurement.md`).
- Nenhuma validação visual humana foi executada nesta Task 1.

## 5. Conclusão da Task 1

Todos os gates automatizados da Task 1 foram executados com resultado real e **PASS**. A inspeção estática confirma escopo preservado: zero migration/API/dependência/schema novos e zero alteração em shell/admin/`BalanceDisplay`/serviços compartilhados, exceto a opção aditiva autorizada `throwOnError` em `getBalanceBreakdown`, coberta por testes de default, modo estrito e `PGRST116`.

## 6. Revalidação pós-revisão (2026-11-02)

Ajustes aplicados após a revisão técnica: (a) o anúncio compacto passou a receber apenas `frontmatter` e trecho, sem `body`/`slug`; (b) a evidência de payload foi corrigida para separar JavaScript de payload RSC; (c) whitespace de `58-01-SUMMARY.md` e deste arquivo foi limpo.

| Verificação | Comando | Exit | Resultado |
|---|---|---|---|
| Suítes focadas | `npx vitest run src/lib/dashboard src/lib/credit/__tests__/credit-service-throw-on-error.test.ts src/lib/i18n/dashboard src/lib/changelog src/components/dashboard src/components/changelog src/components/verification src/components/readiness src/__tests__/app/dashboard` | **0** | **29 arquivos / 176 testes PASS** |
| Fronteira do anúncio compacto | incluída acima (`dashboard-news-boundary.test.tsx`) | **0** | envia somente `frontmatter` e trecho; sem `body`/`slug` |
| Typecheck | `npm.cmd run typecheck` | **0** | PASS |
| Build | `npm.cmd run build` | **0** | **95/95 páginas**; `/dashboard` **4,29 kB / 110 kB**; shared **102 kB** |

O payload RSC continua **não medido**; a conclusão segura permanece restrita ao JavaScript e ao isolamento estático do namespace. Nenhum push, merge, deploy, migration ou alteração de produção foi executado nesta revalidação.

## 7. Correção visual pós-checkpoint (2026-11-02)

Ajustes visuais solicitados: lista compacta de três campanhas com miniaturas pequenas, créditos destacados, novidades na lateral, atalho fixo “Que tal criar sua próxima campanha?” e orientação “Abra uma campanha para visualizar o conteúdo completo e baixá-lo para publicar.”, com mensagens em pt-BR/es-419.

| Verificação | Comando | Exit | Resultado |
|---|---|---|---|
| Suítes focadas | `npx vitest run src/lib/dashboard src/lib/credit/__tests__/credit-service-throw-on-error.test.ts src/lib/i18n/dashboard src/lib/changelog src/components/dashboard src/components/changelog src/components/verification src/components/readiness src/__tests__/app/dashboard` | **0** | **30 arquivos / 177 testes PASS** |
| Typecheck | `npm.cmd run typecheck` | **0** | PASS |
| Build | `npm.cmd run build` | **0** | **95/95 páginas**; `/dashboard` **4,36 kB / 110 kB**; shared **102 kB** |
| OpenSpec strict | `openspec validate fase-58-composi-o-operacional-do-dashboard --strict` | **0** | valid |

Capturas reais em produção local (`next build` + `next start`): `evidence/58-05-visual-desktop.png` e `evidence/58-05-visual-mobile.png`, com metadados em `evidence/58-05-visual-captures.md`. Nenhum deploy, push, merge, migration ou alteração de produção. As capturas aguardam aceite humano.