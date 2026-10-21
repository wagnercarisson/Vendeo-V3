---
id: 261021-jl9
title: Investigar as quatro falhas preexistentes da integração F51.3
status: complete
scope: diagnostico-somente
date: 2026-10-21
branch: integracao/landing-app-atual
head_start: b1b387c2
code_changes: none
process:
  command_invoked: true
  command: /gsd-quick
  artifacts: PLAN.md + SUMMARY.md + STATE.md
gates:
  reproduction:
    command: npx --no-install vitest run src/lib/product-1-1/__tests__/copy-recovery.contract.test.ts src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts
    result: 2 files failed; 4 failed | 128 passed (132); exit 1
  typecheck: not_run (diagnóstico somente)
  lint: not_run (diagnóstico somente)
  build: not_run (diagnóstico somente)
  paid_calls: none
  provider: none
  database: none
  migrations: none
  commit_push_deploy: docs commit local only
---

# Quick 261021-jl9 — Diagnóstico das quatro falhas preexistentes

## 0. Estado de entrada e reprodução

**Fatos confirmados**

- Branch: `integracao/landing-app-atual`.
- HEAD no início: `b1b387c2`.
- `git status --porcelain`: vazio (árvore limpa).
- Comando reproduzido exatamente como no baseline da F51.3:

```text
npx --no-install vitest run src/lib/product-1-1/__tests__/copy-recovery.contract.test.ts src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts
```

Resultado atual: **2 arquivos falhos, 4 testes falhos, 128 aprovados (132), exit 1**.

- `copy-recovery.contract.test.ts`: 3 falhas de 122 testes.
- `legacy-frontier.guard.test.ts`: 1 falha de 10 testes.

O baseline **permanece idêntico** ao registrado em `51.3-01-BASELINE.md:11-20` e
`51.3-03-VALIDATION.md:19-28`. Nenhuma das quatro falhas depende de rede, banco, env ou
provider pago: os dois arquivos usam dublês/`git` local.

### Resumo executivo

| # | Falha | Classificação | Defeito de produto? | Bloqueia publicação? |
|---|-------|---------------|---------------------|----------------------|
| 1 | VENCEDOR: uma tentativa → `acquired_failed` | Mock/fixture desatualizada (#2) | Não evidenciado | Não por si só; corrigir antes de usar a suíte como gate |
| 2 | Tentativa ativa → 0 chamadas ao gerador | Mesma causa da #1 (#2) | Não evidenciado | Idem |
| 3 | Corpo real mínimo → `acquired_failed` | Mesma causa da #1 (#2) | Não evidenciado | Idem |
| 4 | Guard: `credit-service.ts` fora da allowlist | Allowlist histórica desatualizada (#3) | Não (mudança aditiva) | Não funcional; reconciliar governança antes do gate |

---

## 1–3. Falhas de `copy-recovery.contract.test.ts`

### 1.1 Reprodução e evidência

**Fato 1 — teste “VENCEDOR: executa EXATAMENTE UMA tentativa”**

- Local: `src/lib/product-1-1/__tests__/copy-recovery.contract.test.ts:2879-2896`.
- Falha em `:2893`: esperado `"acquired_completed"`, recebido `"acquired_failed"`.
- `routeHarness.state.providerCalls` não chega a ser avaliado (asserção anterior falha).

**Fato 2 — teste “tentativa JÁ ativa ⇒ ACOMPANHAMENTO e contador == 1”**

- Local: `copy-recovery.contract.test.ts:2898-2925`.
- Falha em `:2910`: esperado `providerCalls === 1`, recebido `0`.
- A primeira resposta HTTP é 200 (asserção `:2909` passa), mas **nenhuma chamada ao gerador
  simulado ocorre**. Isso é **ausência de chamada**, não duplicação.

**Fato 3 — teste “corpo real mínimo NÃO retorna 400”**

- Local: `copy-recovery.contract.test.ts:3042-3058`.
- Falha em `:3056`: esperado `"acquired_completed"`, recebido `"acquired_failed"`.
- O corpo mínimo (`:3036-3040`) é aceito (status 200 em `:3051`), portanto **não é falha de
  schema nem 400**.

### 1.2 Cadeia causal confirmada

**Fato A — a rota arma o gate de gasto do piloto.**

- `src/app/api/campaign/[id]/copy-recovery/route.ts:323` chama `resolvePilotSpendGate({ store })`.
- O mock de autorização do teste devolve `{ allowed: true }` (`copy-recovery.contract.test.ts:275-280`
  e reset em `:2615`).
- `src/lib/product-1-1/pilot/resolve-pilot-spend-gate.ts:55-66`: decisão permitida ⇒
  `{ kind: "armed", gate: new ProductOneToOnePilotSpendControl() }`.
- A rota repassa esse gate em `runnerDeps.pilotSpend` (`route.ts:341-344`).

**Fato B — o contrato atual do runner exige `prepare`/`invokePrepared`.**

- `src/lib/product-1-1/copy/default-copy-runner.ts:231-246`:
  - `if (pilotSpend) {`
  - `if (!invoker.prepare || !invoker.invokePrepared) throw new Error("pilot_spend_blocked:preparation_unsupported");`
  - depois `prepare(...)`, leitura de pricing, `computeCopyEstimate`, `beginPaidCall`.

**Fato C — o provider simulado do teste não implementa esse contrato.**

- `copy-recovery.contract.test.ts:211-230` define apenas `invoke()` e `hasFallback()`.
- Não há `prepare` nem `invokePrepared`.
- Portanto o runner lança `pilot_spend_blocked:preparation_unsupported` **antes** de qualquer
  chamada ao provider. Isso explica exatamente `providerCalls === 0` e a ausência de
  `acquired_completed`.

**Fato D — o dreno converte a rejeição em `failed`.**

- `src/lib/product-1-1/copy/copy-state.ts:948-979` captura o erro da task e o classifica.
- `src/lib/product-1-1/copy/copy-recovery.ts:358-363` traduz `drain.state === "failed"` para
  `"acquired_failed"`.
- O erro lançado é um `Error` genérico (sem campo booleano `retryable`); `classifyCopyFailure`
  (`copy-recovery.ts:212-221`) cai em `isRetryableError` falso ⇒ `definitive` ⇒
  `settleFailTerminal` grava `failed` (`copy-state.ts:918-933`).

**Conclusão confirmada:** as três falhas têm **a mesma causa raiz**: o dublê do gateway não
satisfaz o contrato `prepare`/`invokePrepared` exigido quando o gate do piloto está armado.
Não há evidência de defeito funcional no aplicativo, de duplicação de chamada ou de problema
de ambiente.

### 1.3 Por que o teste ficou desatualizado (histórico)

**Fatos**

- O arquivo de teste foi alterado pela última vez em `7dee0866` (2026-10-15), antes da
  mudança do runner.
- O gate foi conectado à rota em `8e418d68`/`2ccf8944` (2026-10-16), e a F56.2.5-03 registrou
  a suíte `copy-recovery.contract` verde naquele momento
  (`.planning/phases/56.2.5-.../56.2.5-03-SUMMARY.md:30`).
- O commit `85d4e2eb` (2026-10-17) introduziu `prepare(invokePrepared)` + pricing no runner
  (`default-copy-runner.ts:235-246`), com a mensagem admitindo “13 copy-* pré-existentes” e
  “teste de cadeia unitário pendente”.
- O `copy-recovery.contract.test.ts` **não foi atualizado** depois disso.

**Hipótese não comprovada em runtime:** a mensagem exata `pilot_spend_blocked:preparation_unsupported`
não foi observada diretamente porque `drainCopyTask` engole o erro e persiste apenas a
classificação. A conclusão decorre de fluxo de controle determinístico e da ausência de
`prepare` no objeto mockado; instrumentar exigiria alterar teste/código, o que está fora do
escopo desta rodada.

### 1.4 Impacto

- **Funcional/produção:** nenhum defeito evidenciado. Em produção o gateway real implementa
  `prepare`/`invokePrepared`; com pricing configurado e gate armado, o caminho segue o contrato.
  Permanece uma dependência operacional real: **sem pricing válido, o runner bloqueia antes do
  provider por desenho** (`pricing_unavailable`).
- **Cobertura:** as três asserções mais importantes de anti-duplicação do caminho vencedor
  **não exercitam o provider** hoje. A suíte dá falsa impressão de regressão funcional e não
  protege o caminho que deveria proteger.

### 1.5 Correção mínima proposta (NÃO implementada)

Opção A (recomendada, menor e com precedente):

- No `copy-recovery.contract.test.ts`, mockar
  `@/lib/product-1-1/pilot/resolve-pilot-spend-gate` para devolver `{ kind: "inactive" }`,
  como já é feito em `src/app/api/campaign/generate-image/__tests__/route.integration.test.ts:36,69,452`.
- Justificativa: este contrato testa a rota de recuperação/anti-duplicação, não o gate de
  gasto; o gate tem suíte própria (`pilot-spend-control.behavioral.test.ts`).

Opção B (mais fiel, maior custo):

- Estender `providerGateway` com `prepare`/`invokePrepared` e injetar `readCopyPricing`
  determinístico, mantendo o gate armado.

Testes necessários após a correção: os dois arquivos devem voltar a **132/132**, com atenção
especial a `providerCalls === 1` no vencedor e `0` no perdedor.

**Recomendação de publicação:** não bloquear por defeito funcional; **não declarar a suíte
verde** e corrigir antes de usar esses contratos como gate de release.

---

## 4. Falha de `legacy-frontier.guard.test.ts`

### 4.1 Reprodução e evidência

- Teste: `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts:331-352`.
- Base de comparação: `BASE_SHA = "335bfb70"` (`:8`), registrado em
  `.planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-ISOLATED-INSTANCE.md:3`.
- Caminhos de fronteira: `LEGACY_FRONTIER_PATHS` (`:234-248`), que inclui
  `src/lib/credit/credit-service.ts` (`:240`).
- Allowlist: `AUTHORIZED_FRONTIER_CHANGES` (`:47-226`); **não há entrada** para
  `credit-service.ts`.
- Falha em `:349`: `extra = ["src/lib/credit/credit-service.ts"]`.

### 4.2 Causa confirmada

**Fatos**

- `git diff --name-only 335bfb70..HEAD` sobre os caminhos de fronteira retorna 32 arquivos;
  a allowlist tem 31. A diferença é exatamente `src/lib/credit/credit-service.ts`.
- O arquivo foi alterado por `05e81d90` — `feat(f50.2): add disabled 28-day trial offer`
  (2026-10-20).
- O diff `335bfb70..HEAD` é **somente aditivo**: 27 inserções, 0 remoções
  (novo método `getTrialOfferEnrollment` + interface `TrialOfferEnrollment`).
- O conteúdo atual é **idêntico** ao do commit `05e81d90` (sem alterações posteriores).
- A mudança está documentada e autorizada no planejamento da F50.2:
  - `.planning/phases/50.2-oferta-teste-gratuito-28-dias/50.2-02-PLAN.md:25` lista
    `src/lib/credit/credit-service.ts` entre os arquivos;
  - `50.2-02-SUMMARY.md:33` registra “leitura do enrollment”;
  - `openspec/changes/archive/2026-10-20-oferta-teste-gratuito-28-dias/tasks.md:28`
    (task 2.5) autoriza estender o `CreditService` com leitura de enrollment.
- A allowlist foi atualizada por último em `370cab5d` (2026-10-19, F56.2.7) — **antes** da
  F50.2 (2026-10-20) — e não foi reconciliada depois.
- `STATE.md` registra que a F50.2 está concluída/arquivada e que o deploy
  `dpl_3d7fiErdfikwyqA2wPDpUGay6toq` ficou READY no SHA `05e81d90`.

**Classificação:** **#3 — lista de autorização histórica desatualizada**. Não é defeito
funcional, não é mock/fixture e não é dependência de ambiente.

### 4.3 Por que “apenas atualizar a lista” não basta

O guard tem semântica de **conjunto exato** e compara **conteúdo** dos caminhos adicionais
contra o commit aprovado (`:228-232`, `:298-310`, `:354-364`). Para reconciliar com segurança:

1. Confirmar que a F50.2 foi aprovada/arquivada (fato: sim, conforme STATE e OpenSpec).
2. Confirmar que a mudança no `credit-service.ts` é **aditiva e read-only** (fato: 27
   inserções, 0 remoções; novo método apenas lê `trial_offer_enrollments`).
3. Só então adicionar uma entrada com `path`, `authorization` e `commit: "05e81d90"`.
   Como o caminho entra em `ADDITIONAL_AUTHORIZED_FILES`, o teste de conteúdo passa a exigir
   igualdade byte a byte com `05e81d90`, impedindo modificações futuras silenciosas.
4. Reexecutar os 10 testes do guard, incluindo os negativos (`:510-546`).

**Hipótese não comprovada:** se o processo de publicação trata esse guard como gate
obrigatório. O teste falha hoje e a F51.3 o registrou como falha externa aceita; não há
evidência nesta rodada de que o pipeline de deploy o execute como bloqueio.

### 4.4 Impacto

- **Funcional/produção:** nenhum impacto direto. O método adicionado é leitura de enrollment
  do teste gratuito; não altera `reserveCredit`, `confirmCredit`, `refundCredit` ou o fluxo
  legado. A mudança já está no SHA publicado da F50.2.
- **Governança/CI:** o guard está fazendo exatamente o que foi desenhado para fazer —
  sinalizar uma mudança de fronteira não registrada. Enquanto não reconciliado, o conjunto
  exato permanece quebrado e o valor do guard como controle regressivo fica reduzido.

### 4.5 Correção mínima proposta (NÃO implementada)

- Adicionar à `AUTHORIZED_FRONTIER_CHANGES`:
  - `path: "src/lib/credit/credit-service.ts"`
  - `authorization: "F50.2 (leitura de enrollment do teste gratuito — aditiva/read-only)"`
  - `commit: "05e81d90"`
- Nenhuma mudança em `BASE_SHA`, `LEGACY_FRONTIER_PATHS` ou nos testes negativos.
- Testes necessários: `legacy-frontier.guard.test.ts` **10/10**, com verificação de que o
  teste de conteúdo continua detectando alteração deliberada.

**Recomendação de publicação:** não é bloqueio funcional; é bloqueio de **governança** se o
guard fizer parte do gate de release. Reconciliar antes da publicação, com a autorização
acima registrada — sem tratar a lista como permissão permanente.

---

## 5. Fatos vs. hipóteses

**Fatos**

- As quatro falhas se reproduzem exatamente como no baseline (128/4).
- As três falhas de copy-recovery são explicadas pela combinação gate armado + provider mock
  sem `prepare`/`invokePrepared`; o dreno persiste `failed` e a rota devolve
  `acquired_failed`.
- A falha do guard é causada por `credit-service.ts` alterado em `05e81d90` (F50.2) e ausente
  da allowlist; a mudança é aditiva e documentada na F50.2, mas não registrada no guard.
- Não há dependência de ambiente, banco, provider ou configuração externa em nenhuma das
  quatro falhas.

**Hipóteses**

- A mensagem exata do bloqueio do runner não foi observada em runtime (o dreno a suprime).
- O comportamento em produção com gate armado depende de pricing válido configurado; não foi
  testado nesta rodada (e não deveria ser, por limite de escopo).
- O peso do guard no pipeline de publicação não foi verificado.

## 6. Parada

Diagnóstico concluído **sem alterar código de produto, testes, snapshots, allowlists ou
configuração**. Nenhum provider pago, banco, migration, flag, e-mail, merge, push, deploy, tag
ou lifecycle OpenSpec foi executado. **Parar para revisão conjunta antes de qualquer
correção.**
