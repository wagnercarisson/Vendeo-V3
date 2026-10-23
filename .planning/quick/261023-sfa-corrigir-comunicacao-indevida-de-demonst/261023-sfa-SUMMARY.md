---
status: complete
task: 261023-sfa
plan: 01
type: execute
mode: quick
completed: 2026-10-23
commits:
  - 143a6e19
  - 7c5a03f4
files_modified:
  - src/lib/credit/trial-offer/status.ts
  - src/lib/credit/__tests__/trial-offer-status.test.ts
  - src/components/credit/balance-card.tsx
  - src/components/credit/balance-display.tsx
  - src/components/credit/__tests__/balance-card.test.tsx
  - src/components/credit/__tests__/balance-display.test.tsx
---

# Quick 261023-sfa — Corrigir comunicação indevida de demonstração/teste gratuito

## O que mudou

Contas legadas (com loja, sem demo e sem inscrição no teste) deixaram de receber promessa
de benefício no cartão de créditos. Ausência de inscrição passou a ser tratada como
**ausência de sinal**, não como inelegibilidade elegível: o default é `unknown` (fail-closed)
e nenhuma superfície renderiza mensagem de demo/teste gratuitos sem evidência.

### Task 1 — Helper com status `unknown` e elegibilidade explícita (commit `143a6e19`)

`src/lib/credit/trial-offer/status.ts`:
- `TrialOfferStatus` ganhou `"unknown"`.
- `TrialOfferStatusInput` ganhou `eligibility?: "eligible" | "unknown"`, documentado como
  sinal autoritativo do servidor (ausência de inscrição **não** é prova de elegibilidade).
- No ramo `if (!enrollment)` a precedência existente foi preservada — `hasLegacyDemo` →
  `"legacy_demo"`; `demoBalance > 0 || demoExpiresAt` → `"active"` — e apenas o fallback final
  mudou: `"not_started"` **somente** com `eligibility === "eligible"`; caso contrário `"unknown"`.
- `getNextTrialInstallment`, `getTrialOfferDurationMs` e `isTrialOfferRefundGrace` intocados.

Testes (`src/lib/credit/__tests__/trial-offer-status.test.ts`): a asserção que esperava
`"not_started"` sem evidência passou a esperar `"unknown"` (caso renomeado), com novos casos
para `eligibility: "eligible"` → `"not_started"`, `hasLegacyDemo` → `"legacy_demo"` e
evidência de demo (`demoBalance: 5` sem `hasLegacyDemo`, e `demoExpiresAt` sem saldo) → `"active"`.
Testes de inscrição existentes mantidos intactos.

### Task 2 — Superfícies neutras (commit `7c5a03f4`)

`src/components/credit/balance-card.tsx`:
- Nova prop opcional `trialOfferEligibility?: "eligible" | "unknown"`, repassada como
  `eligibility` a `getTrialOfferStatus` (default `"unknown"`).
- Linha de demonstração agora exige `demoStatus !== "none"` além da condição existente
  (`!trialOfferEnrollment || trialStatus === "legacy_demo"`).
- Linha do teste só é renderizada quando `trialStatus !== "unknown"`; a chave `unknown`
  existe no mapa de rótulos apenas para satisfazer o tipo.
- Vencimento, próxima parcela, graça de estorno e aviso "Há saldo utilizável além da
  demonstração." inalterados.

`src/components/credit/balance-display.tsx`:
- `DemoSummary` retorna `null` quando `status === "none"` — sem `span` sr-only e sem rótulo;
  demais status (`active`, `expiring_soon`, `exhausted`, `expired`) e a linha de validade
  preservados.

Testes: `balance-card.test.tsx` ganhou 4 casos (legado sem benefício; elegibilidade explícita
mostra "Teste gratuito: começa ao concluir o onboarding"; demo legada ativa com validade
relativa; inscrição ativa com status, vencimento e "Próxima parcela"; datas determinísticas
via `vi.useFakeTimers`/`vi.setSystemTime`, no padrão já usado no arquivo).
`balance-display.test.tsx` ganhou 2 casos (sem demo → ausência de "Demonstração não iniciada";
demo ativa → presença do rótulo).

## Comportamento resultante

| Cenário | Antes | Depois |
|---|---|---|
| Legado, saldo 5, sem demo/inscrição | "Demonstração não iniciada" + "Teste gratuito: começa ao concluir o onboarding" | nenhuma linha de demo/teste; saldo e custos normais |
| `trialOfferEligibility="eligible"`, sem inscrição | já mostrava a mensagem | mesma mensagem (única via) |
| Demo legada ativa | "Demonstração ativa" + validade | inalterado |
| Inscrição ativa | status, vencimento, próxima parcela | inalterado |
| `BalanceDisplay` sem demo | `span` sr-only "Demonstração não iniciada" | nada renderizado |

## Verificação

| Gate | Comando | Resultado |
|---|---|---|
| Testes focados (Task 1) | `npx --no-install vitest run src/lib/credit/__tests__/trial-offer-status.test.ts` | 9/9 passed, exit 0 |
| Testes focados (Task 2) | `npx --no-install vitest run src/components/credit/__tests__/balance-card.test.tsx src/components/credit/__tests__/balance-display.test.tsx` | 21/21 passed, exit 0 |
| Testes focados (agregado) | `npx --no-install vitest run <3 arquivos>` | 3 files, 30/30 passed, exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Limitações

- **A suíte completa (`npm test`) NÃO foi executada e NÃO é declarada verde.** O repositório
  tem falhas preexistentes registradas em `.planning/STATE.md` (22 falhas diagnosticadas no D2);
  apenas os três arquivos focados acima foram executados.
- Nenhum chamador passa `trialOfferEligibility` hoje (`src/app/(app)/conta/page.tsx` não foi
  alterado, por restrição de escopo). Efeito prático: a mensagem "Teste gratuito: começa ao
  concluir o onboarding" deixa de aparecer até que um sinal autoritativo de elegibilidade seja
  wired pelo servidor — que é o comportamento fail-closed pretendido.
- O contêiner `aria-label="Status da demonstração"` foi mantido como estava (pode renderizar
  vazio em contas sem demo). Não é uma promessa de benefício; alterá-lo estava fora do escopo.
- O label `none` permanece no mapa de `getDemoLabel` em `balance-display.tsx` apenas para
  satisfazer o `Record<DemoStatus, string>`; ficou inalcançável na renderização.

## Restrições respeitadas

- Sem push, merge, deploy ou ativação.
- Sem migrations, alterações de banco, dados, flags ou políticas.
- `src/lib/credit/demo-status.ts`, `src/lib/credit/trial-offer/completion.ts`,
  `src/components/credit/trial-offer-retry.tsx`, `ROADMAP.md` não foram modificados.
- Commits apenas de código + testes; SUMMARY.md não foi commitado (responsabilidade do orquestrador).
- Comportamento de demo/trial existente, expiração, parcelas e graça de estorno preservado.
