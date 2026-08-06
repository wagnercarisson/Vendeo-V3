# Summary: Feedback explícito ao salvar/continuar sem aceitar os termos (F36)

- **Quick:** 260806-fsl-feedback-aceite-legal
- **Type:** fix
- **Branch:** `feature/fase-36-onboarding-navegacao-por-abas` (push é responsabilidade do usuário)
- **Status:** Implementado + verificação completa verde (typecheck, 1546 testes, lint).

## Causa raiz

`handleStep1Submit` (`src/components/flow/store-identity-form.tsx`) validava `legalBlocked` e chamava `setAcceptedTermsError(...)` — estado **morto**, nunca renderizado. Resultado: com dados mínimos válidos mas sem aceite legal, clicar em "Salvar e continuar" não salvava, não navegava e não mostrava NADA (silêncio total). Os caminhos de **aba** já tinham feedback D16 (`blockedNotice` com `needs_legal_acceptance`), e o **"Continue" mobile** mostrava o motivo no próprio botão (desabilitado). Só o submit explícito era silencioso.

## O que foi feito

### `src/components/flow/store-identity-form.tsx`
- Branch `legalBlocked` do `handleStep1Submit` agora usa o `FeedbackOverlay` existente (modal `role="alertdialog"` — mesmo padrão de "Verifique os campos obrigatórios" / "CNPJ já registrado"):
  - Mensagem curta: **"Para continuar, leia e aceite os termos de uso."**
  - `focusSelector`: `#aceite-legal` (desktop) ou `#aceite-legal-mobile` (mobile), conforme `isMobile` — ao fechar o modal, o foco/scroll vai ao card de aceite **visível** no viewport atual (ids únicos por variante; a variante oculta fica `display:none`).
  - Nada muda em save/navegação: sem aceite → `return` antes do `save()` (não salva, não navega).
- Removido o estado morto `acceptedTermsError` (declaração + reset no topo do handler).
- `LegalAcceptancePanel` recebe `panelId="aceite-legal"` (desktop) e `panelId="aceite-legal-mobile"` (mobile).

### `src/components/flow/legal-acceptance-panel.tsx`
- Novo prop opcional `panelId?: string`; `<section id={panelId} tabIndex={-1} aria-label=...>` — focável programaticamente (fora da tab order) para foco/scroll.

### Fora de escopo (intocado)
- Drift, autosave fiscal, CNPJ e bloqueios de aba D16 permanecem intactos.

## Testes

- **Novo** `src/components/flow/__tests__/store-identity-form.aceite-legal.test.tsx` (render do `StoreIdentityForm` real em create mode, mocks de fetch/matchMedia/next-navigation):
  1. Sem aceite + "Salvar e continuar" → modal com a mensagem curta + NENHUMA chamada a `/api/store` (não salva).
  2. Ao fechar o modal → foco vai para `#aceite-legal` (desktop; `#aceite-legal-mobile` presente no DOM).
  3. Com aceite válido (edit mode, `legal-status` → `hasValidAcceptance:true`) → PATCH + navega para Posicionamento.
- **`src/hooks/__tests__/use-onboarding-tabs.test.ts`** — novo describe "bloqueio legal na troca de aba":
  - `legalAccepted:false` + `setActiveTab("posicionamento")` → `blockedNotice { tab, reason: "needs_legal_acceptance" }`, permanece em `dados`, autoSave NÃO chamado.
  - Com `legalAccepted:true` → autoSave chamado + navega + `blockedNotice` null.

## Verificação

```bash
cd C:\Projetos\Vendeo V3
npx tsc -p tsconfig.typecheck.json --noEmit   # limpo
npx vitest run                                # 182 arquivos / 1546 testes pass
npm run lint                                  # limpo
```

## Specs / planning

- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-identity-ui/spec.md`: 2 cenários novos sob o requirement "Store identity form UI" — "Salvar e continuar sem aceite legal mostra feedback explícito e foca o card" e "Tentar avançar por aba sem aceite legal mostra o motivo D16".
- Planning quick: `260806-fsl-feedback-aceite-legal-PLAN.md` + este `SUMMARY.md`.
- Sem mudança em `store-onboarding-autosave` (o bloqueio é do save explícito, não do autosave).

## Success Criteria (status)

- [x] Sem aceite + "Salvar e continuar" → feedback claro e imediato, sem salvar e sem navegar
- [x] Foco/scroll ao card de aceite ao fechar o feedback (desktop e mobile)
- [x] Tentar avançar por aba/CTA sem aceite → motivo visível/coerente (D16)
- [x] Após aceitar → save/navegação funcionam
- [x] Mobile "Continue" mantém mensagem útil (inalterado)
- [x] Regressões de CNPJ autosave e drift verdes + suíte completa + lint + typecheck
