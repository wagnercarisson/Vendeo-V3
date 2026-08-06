---
quick_id: 260806-fsl-feedback-aceite-legal
type: fix
wave: 1
depends_on:
  - change: fase-36-onboarding-navegacao-por-abas
    provides: handleStep1Submit/tab state/D16 blockedNotice + reason-text
files_modified:
  - src/components/flow/store-identity-form.tsx
  - src/components/flow/legal-acceptance-panel.tsx
  - openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-identity-ui/spec.md
autonomous: true
---

# Fix: Feedback explícito ao salvar/continuar sem aceitar os termos (F36)

## Objective

Na aba Dados, com os dados mínimos preenchidos mas sem aceite legal, clicar em "Salvar e continuar" falha **silenciosamente** no desktop (e no botão de submit do form no mobile): não salva, não navega e não mostra nada. No mobile, o botão "Continue" (barra fixa do `StoreTabs`) já orienta com o motivo visível no próprio botão.

**Purpose:** Ao tentar salvar/continuar sem aceite legal obrigatório, exibir feedback claro e imediato ("Para continuar, leia e aceite os termos de uso."), não salvar, não navegar e focar/rolar até o card lateral de aceite — coerente com as mensagens de bloqueio D16 já existentes.

**Output:**
- `handleStep1Submit` com feedback explícito (modal de erro existente) no branch `legalBlocked`
- `LegalAcceptancePanel` focável (`panelId` + `tabIndex={-1}`) para foco/scroll ao card
- Remoção do estado morto `acceptedTermsError`
- Spec `store-identity-ui/spec.md` com cenário novo + planning quick (PLAN + SUMMARY)

## Context

@.planning/STATE.md

### Causa raiz (cadeia confirmada)

1. `handleStep1Submit` (`src/components/flow/store-identity-form.tsx:1104-1170`) é o handler do botão "Salvar e continuar". Em `legalBlocked` (`:1134`) chama `setAcceptedTermsError("Você precisa aceitar os Termos de Uso e a Política de Uso Aceitável.")` (`:1136`) e `return`.
2. `acceptedTermsError` é **estado morto**: declarado em `:133`, só possui setters (`:1106`/`:1136`), **nunca é renderizado** → falha silenciosa no submit explícito.
3. Os caminhos de **aba já têm feedback D16**: clicar na aba "Posicionamento" → `setActiveTab` → `computeTabUnlock` retorna `needs_legal_acceptance` → `blockedNotice` inline (`role="status"`, renderizado em `:1387-1403`) + permanece em Dados.
4. **Mobile "Continue"** (`src/components/flow/store-tabs.tsx:339-359`) fica `disabled` quando a próxima aba está bloqueada e exibe o microcopy do motivo (`tabBlockReasonText`) — por isso mobile "orienta melhor".
5. O padrão de feedback de submit já existente é o `FeedbackOverlay` tipo `error` (modal `role="alertdialog"`), usado em "Verifique os campos obrigatórios" (`:1129`) e "CNPJ já registrado" (`:1168`, com `focusSelector: '#cnpj'`). O `focusSelector` é focado **ao fechar** o modal (`feedback-overlay.tsx:27-35`).

### Decisões aprovadas (usuário)

1. Mensagem curta: **"Para continuar, leia e aceite os termos de uso."**
2. Feedback funciona em desktop e mobile; destacar/focar o card de aceite ("se possível").
3. Não criar bloqueio novo para CNPJ; não mexer em drift nem autosave fiscal.

## Tasks

### Task 1: Feedback explícito no submit sem aceite + card focável

<task type="auto">
  <name>handleStep1Submit legalBlocked → feedbackOverlay + foco ao card</name>
  <files>
    - Edit: src/components/flow/store-identity-form.tsx
    - Edit: src/components/flow/legal-acceptance-panel.tsx
  </files>
  <action>
    **store-identity-form.tsx**
    - No branch `legalBlocked` de `handleStep1Submit` (`:1134-1138`), substituir `setAcceptedTermsError(...)` por:
      `setFeedbackOverlay({ message: "Para continuar, leia e aceite os termos de uso.", type: "error", focusSelector: isMobile ? "#aceite-legal-mobile" : "#aceite-legal" })`.
    - Remover o estado morto `acceptedTermsError` (declaração `:133`) e o `setAcceptedTermsError(null)` no topo do handler (`:1106`).
    - Passar `panelId="aceite-legal-mobile"` ao `LegalAcceptancePanel` mobile (`:1382`) e `panelId="aceite-legal"` ao desktop (`:2457`).

    **legal-acceptance-panel.tsx**
    - Adicionar prop opcional `panelId?: string`.
    - No `<section>` principal (`:87`), aplicar `id={panelId}` e `tabIndex={-1}` (focável programaticamente, fora da tab order).
  </action>
  <verify>
    <automated>cd C:\Projetos\Vendeo V3 && npx tsc -p tsconfig.typecheck.json --noEmit 2>&1</automated>
  </verify>
  <done>
    Submit sem aceite mostra modal de erro com a mensagem curta e, ao fechar, foca o card de aceite (desktop ou mobile conforme o viewport); sem salvar e sem navegar.
  </done>
</task>

### Task 2: Testes

<task type="auto">
  <name>Testes do feedback de aceite + bloqueio por aba</name>
  <files>
    - Create: src/components/flow/__tests__/store-identity-form.aceite-legal.test.tsx (render do form em create mode com mocks de fetch/matchMedia/localStorage)
    - Edit: src/hooks/__tests__/use-onboarding-tabs.test.ts
  </files>
  <action>
    **Componente (create mode, mocks: fetch para /api/legal/current-versions, matchMedia, localStorage/restoreDraft):**
    - Sem aceite + preencher nome/segmento + clicar "Salvar e continuar" → modal com "Para continuar, leia e aceite os termos de uso."; `fetch` para POST /api/store NÃO chamado; ao fechar o modal, o foco vai para `#aceite-legal-mobile`/`#aceite-legal`.
    - Positivo (edit mode, mock de /legal-status → hasValidAcceptance:true): "Salvar e continuar" chama PATCH e navega para Posicionamento.
    - CNPJ/autosave fiscal e drift: não tocar — regressões cobrem.

    **useOnboardingTabs:**
    - Novo caso D16: `legalAccepted:false` + `setActiveTab("posicionamento")` → `blockedNotice { tab: "posicionamento", reason: "needs_legal_acceptance" }`, `activeTab` permanece `"dados"`, autoSave NÃO chamado (motivo visível/coerente com D16).
  </action>
  <verify>
    <automated>cd C:\Projetos\Vendeo V3 && npx vitest run src/components/flow/__tests__/store-identity-form.aceite-legal.test.tsx src/hooks/__tests__/use-onboarding-tabs.test.ts 2>&1</automated>
  </verify>
  <done>
    Cenários do checklist do usuário cobertos + regressões de CNPJ autosave e drift verdes.
  </done>
</task>

### Task 3: Spec + planning

<task type="auto">
  <name>Spec store-identity-ui + planning quick</name>
  <files>
    - Edit: openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-identity-ui/spec.md
  </files>
  <action>
    - Em `store-identity-ui/spec.md`, sob o requirement "Store identity form UI" (junto aos cenários D16), ADICIONAR cenário:
      - **Scenario: "Salvar e continuar" sem aceite legal mostra feedback explícito e foca o card** — WHEN dados mínimos válidos + sem aceite legal; THEN não salva; THEN não navega; THEN exibe mensagem curta ("Para continuar, leia e aceite os termos de uso."); THEN o foco/scroll vai ao card de aceite ao fechar; AND comportamento igual em desktop e mobile.
    - Escrever `.planning/quick/260806-fsl-feedback-aceite-legal-q/260806-fsl-feedback-aceite-legal-PLAN.md` (este) e `260806-fsl-feedback-aceite-legal-SUMMARY.md` ao final.
  </action>
  <verify>
    <automated>Manual: conferir que o cenário cita mensagem curta, não-salvar, não-navegar e foco ao card.</automated>
  </verify>
  <done>
    Spec e planning refletem o feedback de aceite no submit.
  </done>
</task>

## Verification

```bash
cd C:\Projetos\Vendeo V3
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run
npm run lint
```

## Success Criteria

- Sem aceite + "Salvar e continuar" → feedback claro e imediato, sem salvar e sem navegar
- Foco/scroll ao card de aceite ao fechar o feedback (desktop e mobile)
- Tentar avançar por aba/CTA sem aceite → motivo visível/coerente (D16 já cobre; teste de `needs_legal_acceptance` adicionado)
- Após aceitar → save/navegação funcionam
- Mobile "Continue" mantém mensagem útil (inalterado)
- Regressões de CNPJ autosave e drift verdes + suíte completa + lint + typecheck
