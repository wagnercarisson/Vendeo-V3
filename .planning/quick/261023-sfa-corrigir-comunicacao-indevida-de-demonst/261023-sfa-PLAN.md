---
mode: quick
task: 261023-sfa
description: Corrigir comunicação indevida de demonstração/teste gratuito no cartão de créditos de contas legadas.
phase: quick-261023-sfa
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/credit/trial-offer/status.ts
  - src/lib/credit/__tests__/trial-offer-status.test.ts
  - src/components/credit/balance-card.tsx
  - src/components/credit/balance-display.tsx
  - src/components/credit/__tests__/balance-card.test.tsx
  - src/components/credit/__tests__/balance-display.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Conta legada com loja, sem demo e sem elegibilidade autoritativa vê saldo, custos e extrato, sem 'Demonstração não iniciada' e sem promessa de teste gratuito."
    - "Contas com demo legada existente preservam status, validade e mensagens de estorno/graça exatamente como antes."
    - "Contas com inscrição de teste existente preservam status ativo, vencimento e próxima parcela."
    - "A mensagem 'Teste gratuito: começa ao concluir o onboarding' só aparece quando um chamador fornece sinal explícito de elegibilidade."
    - "Nenhuma elegibilidade é inferida de saldo, histórico de crédito manual ou flag de loja de teste."
  artifacts:
    - path: "src/lib/credit/trial-offer/status.ts"
      provides: "Status 'unknown' e input opcional eligibility"
      contains: "unknown"
    - path: "src/components/credit/balance-card.tsx"
      provides: "Renderização neutra quando o status do teste é desconhecido"
      contains: "trialOfferEligibility"
    - path: "src/components/credit/balance-display.tsx"
      provides: "Supressão do texto sr-only de demonstração quando não há demo"
      contains: "DemoSummary"
  key_links:
    - from: "src/components/credit/balance-card.tsx"
      to: "src/lib/credit/trial-offer/status.ts"
      via: "getTrialOfferStatus({ eligibility })"
      pattern: "eligibility"
    - from: "src/components/credit/balance-card.tsx"
      to: "src/lib/credit/demo-status.ts"
      via: "getDemoStatus"
      pattern: "demoStatus !== \"none\""
---

<objective>
Corrigir a comunicação indevida de demonstração/teste gratuito exibida no cartão de créditos para contas legadas que nunca tiveram demo nem inscrição no teste, sem alterar dados, banco, flags ou políticas.

Purpose: hoje `getTrialOfferStatus` trata ausência de inscrição como `not_started`, e `BalanceCard`/`BalanceDisplay` tratam `getDemoStatus() === "none"` como "Demonstração não iniciada". Ausência de inscrição não é prova de elegibilidade — contas legadas recebem promessas falsas de benefício.

Output: status `unknown` no helper, renderização neutra nas duas superfícies e testes comportamentais cobrindo legado, demo existente e teste existente.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./AGENTS.md
@src/lib/credit/trial-offer/status.ts
@src/lib/credit/demo-status.ts
@src/components/credit/balance-card.tsx
@src/components/credit/balance-display.tsx
@src/app/(app)/conta/page.tsx

<interfaces>
<!-- Contratos atuais que o executor deve respeitar. Extraídos do código. -->

De src/lib/credit/trial-offer/status.ts:
```typescript
export type TrialOfferStatus =
  | "not_started" | "active" | "expiring_soon"
  | "exhausted" | "expired" | "legacy_demo" | "none";

export interface TrialOfferEnrollmentView {
  id: string; startedAt: string; expiresAt: string;
  grantedTotal: number; lastGrantedSeq: number;
}

export function getTrialOfferStatus(input: TrialOfferStatusInput, now?: Date): TrialOfferStatus;
```

De src/lib/credit/demo-status.ts (NÃO ALTERAR):
```typescript
export type DemoStatus = "active" | "expiring_soon" | "exhausted" | "expired" | "none";
export function getDemoStatus(input: { demoBalance: number; demoExpiresAt: string | null; originDemoGrantTxId?: string | null }, now?: Date): DemoStatus;
```

Observação: `src/lib/credit/trial-offer/completion.ts` e `src/components/credit/trial-offer-retry.tsx` declaram tipos `TrialOfferStatus` PRÓPRIOS e independentes. Não importam de `status.ts` — não devem ser tocados.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Introduzir status "unknown" e elegibilidade explícita no helper de teste</name>
  <files>src/lib/credit/trial-offer/status.ts, src/lib/credit/__tests__/trial-offer-status.test.ts</files>
  <behavior>
    - Sem inscrição, sem demo legada, sem evidência de demo e sem elegibilidade → "unknown".
    - Sem inscrição, sem demo, com `eligibility: "eligible"` explícito → "not_started".
    - Sem inscrição, com `hasLegacyDemo: true` → "legacy_demo" (preservado).
    - Sem inscrição, com `demoBalance > 0` ou `demoExpiresAt` preenchido → "active" (preservado).
    - Inscrição válida → "active"/"expiring_soon"/"exhausted"/"expired" inalterados.
  </behavior>
  <action>Em `src/lib/credit/trial-offer/status.ts`: adicionar `"unknown"` à união `TrialOfferStatus` e adicionar campo opcional `eligibility?: "eligible" | "unknown"` a `TrialOfferStatusInput` (documentando que ausência de inscrição NÃO é prova de elegibilidade). No ramo `if (!enrollment)` de `getTrialOfferStatus`, manter a precedência atual — `hasLegacyDemo` → `"legacy_demo"`; `demoBalance > 0 || demoExpiresAt` → `"active"` — e trocar apenas o fallback final: retornar `"not_started"` SOMENTE quando `input.eligibility === "eligible"`; caso contrário retornar `"unknown"`. Não inferir elegibilidade de saldo, histórico manual, `hasStore` ou flag de loja de teste; não alterar `getNextTrialInstallment`, `isTrialOfferRefundGrace`, `getTrialOfferDurationMs` nem `src/lib/credit/demo-status.ts`.

Em `src/lib/credit/__tests__/trial-offer-status.test.ts`: atualizar a asserção existente que espera `"not_started"` para o cenário sem elegibilidade, passando a esperar `"unknown"` (renomear o caso para refletir o novo contrato). Adicionar casos: `eligibility: "eligible"` → `"not_started"`; `hasLegacyDemo` → `"legacy_demo"`; evidência de demo (`demoBalance: 5` sem `hasLegacyDemo`) → `"active"`. Manter os testes de inscrição existentes intactos.</action>
  <verify>
    <automated>npx --no-install vitest run src/lib/credit/__tests__/trial-offer-status.test.ts</automated>
  </verify>
  <done>Helper retorna "unknown" por padrão sem evidência autoritativa, "not_started" apenas com `eligibility: "eligible"`, e todos os casos de demo/teste existentes continuam verdes no arquivo de teste focado.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Renderização neutra no BalanceCard e supressão do texto de demo no BalanceDisplay</name>
  <files>src/components/credit/balance-card.tsx, src/components/credit/balance-display.tsx, src/components/credit/__tests__/balance-card.test.tsx, src/components/credit/__tests__/balance-display.test.tsx</files>
  <behavior>
    - Conta legada (saldo 5, sem demo, sem inscrição, sem elegibilidade): mostra saldo e linhas de custo, NÃO contém "Demonstração não iniciada", NÃO contém "Teste gratuito".
    - Com `trialOfferEligibility="eligible"` e sem inscrição: aparece "Teste gratuito: começa ao concluir o onboarding".
    - Demo legada ativa: mantém "Demonstração ativa" e a linha de validade relativa.
    - Inscrição de teste ativa: mantém "Teste gratuito de 28 dias ativo", vencimento e "Próxima parcela".
    - BalanceDisplay sem demo: não emite "Demonstração não iniciada" (nem em sr-only); com demo ativa mantém o rótulo.
  </behavior>
  <action>Em `src/components/credit/balance-card.tsx`: adicionar prop opcional `trialOfferEligibility?: "eligible" | "unknown"` a `BalanceCardProps` e repassá-la como `eligibility` na chamada de `getTrialOfferStatus` (default `"unknown"` quando ausente). Adicionar a chave `unknown` ao objeto `trialStatusLabel` para satisfazer o tipo, mas NÃO renderizar a linha do teste quando `trialStatus === "unknown"` (envolver o `<p>{trialStatusLabel}</p>` em condição). Na linha de demonstração, adicionar `demoStatus !== "none"` à condição existente, mantendo intactas as condições de inscrição/legacy_demo. Não alterar a renderização de vencimento, próxima parcela, graça de estorno nem o aviso "Há saldo utilizável além da demonstração."

Em `src/components/credit/balance-display.tsx`: em `DemoSummary`, retornar `null` quando `status === "none"` — sem `span` sr-only e sem rótulo — preservando integralmente os demais status (`active`, `expiring_soon`, `exhausted`, `expired`) e a linha de validade.

Em `src/components/credit/__tests__/balance-card.test.tsx`: adicionar casos comportamentais para legado sem benefício (sem mensagens de demo/teste), elegibilidade explícita (com mensagem de início), demo ativa preservada e inscrição ativa preservada (status, vencimento, "Próxima parcela" — usar `vi.useFakeTimers`/`vi.setSystemTime` para datas determinísticas no padrão já usado no arquivo). Em `src/components/credit/__tests__/balance-display.test.tsx`: adicionar caso sem demo que garanta ausência de "Demonstração não iniciada" e caso com demo ativa que garanta presença do rótulo.</action>
  <verify>
    <automated>npx --no-install vitest run src/components/credit/__tests__/balance-card.test.tsx src/components/credit/__tests__/balance-display.test.tsx</automated>
  </verify>
  <done>BalanceCard não anuncia demo pendente nem teste gratuito para conta legada sem elegibilidade, mantém todas as mensagens de demo/teste existentes, e BalanceDisplay não emite texto de demonstração quando não há demo; testes focados verdes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Escopo | Descrição |
|----------|--------|-----------|
| server → client props | `BalanceCard`/`BalanceDisplay` | Elegibilidade é decidida no servidor e passada como prop; o cliente não consulta nada. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261023SFA-01 | Spoofing | `getTrialOfferStatus` fallback | mitigate | Default fail-closed: sem evidência autoritativa o status é `unknown`; nunca inferir de saldo/histórico/flag. |
| T-261023SFA-02 | Information Disclosure | `BalanceCard` / `BalanceDisplay` | accept | Apenas rótulos de UI; nenhum dado sensível novo é exposto (supressão de texto, não adição). |
| T-261023SFA-03 | Tampering | Dados/banco/migrations | accept | Escopo proíbe alterações de schema, dados, flags e políticas; nenhuma escrita é introduzida. |
| T-261023SFA-SC | Tampering | Instalação de dependências | mitigate | Nenhuma dependência nova é instalada nesta tarefa. |
</threat_model>

<verification>
Executar, em sequência, a partir da raiz:

1. Testes focados:
   `npx --no-install vitest run src/lib/credit/__tests__/trial-offer-status.test.ts src/components/credit/__tests__/balance-card.test.tsx src/components/credit/__tests__/balance-display.test.tsx`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`

Todos devem sair com código 0. NÃO declarar a suíte completa (`npm test`) verde — o repositório tem falhas preexistentes registradas em `.planning/STATE.md`; executar apenas os arquivos focados acima.
</verification>

<success_criteria>
- `TrialOfferStatus` inclui `"unknown"` e `getTrialOfferStatus` retorna `"unknown"` sem evidência autoritativa.
- `"not_started"` só é produzido com `eligibility: "eligible"` explícito.
- `BalanceCard` não renderiza linha de demo quando `demoStatus === "none"` nem linha de teste quando o status é `"unknown"`.
- Demos legadas, testes ativos, vencimentos, próxima parcela e graça de estorno permanecem inalterados.
- `BalanceDisplay` não emite "Demonstração não iniciada" quando não há demo.
- Testes focados, typecheck, lint e build verdes.
- Nenhuma alteração em banco, migrations, dados, flags, políticas, `src/lib/credit/demo-status.ts` ou tipos homônimos em `completion.ts`/`trial-offer-retry.tsx`.
</success_criteria>

<output>
Create `.planning/quick/261023-sfa-corrigir-comunicacao-indevida-de-demonst/261023-sfa-SUMMARY.md` when done.
</output>
