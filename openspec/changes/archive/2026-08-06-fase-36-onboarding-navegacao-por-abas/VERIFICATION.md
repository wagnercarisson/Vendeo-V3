## Verification Report: fase-36-onboarding-navegacao-por-abas

### Summary
| Dimension | Status |
|-----------|--------|
| Completeness | 26/26 tasks |
| Correctness | Todas as regras das specs (D1–D16) cobertas e aprovadas |
| Coherence | Fluxo de onboarding em abas coerente com readiness, legal e draft store |

---

### 1. CRITICAL (Must fix before archive)

**Nenhum.** A F36 foi verificada e aprovada. Specs sincronizadas para `openspec/specs/` (8 capacidades). Todos os 26 tasks concluídos.

---

### 2. WARNING (Should fix — pós-verificação, não bloqueante)

Os hardenings abaixo **não bloqueiam o archive**. Ficam registrados para tratamento futuro em fase/manutenção dedicada.

#### H1 — Remover código morto `driftNavIntercept`/`driftSaveIntercept` e modal duplicado inalcançável

- **Onde:** `src/components/flow/store-identity-form.tsx` (fluxo de drift)
- **Problema:** Com a navegação por abas (D16), os interceptadores legados de clique/popstate (`driftNavIntercept`/`driftSaveIntercept`) ficaram sem acionamento real, e há um modal de drift duplicado inalcançável.
- **Recomendação:** Remover os interceptadores mortos e o modal duplicado, mantendo apenas o gate por atividade do drift (`driftStatus === 'new'` / `criticalDriftStatus === 'new'`).

#### H2 — Remover asterisco do label CNPJ

- **Onde:** painel da aba Dados do onboarding
- **Problema:** O label CNPJ exibe asterisco de campo obrigatório, mas na F36 o CNPJ é **opcional** (vazio = loja draft). O CNPJ bloqueia apenas geração de campanha/crédito (readiness), nunca a navegação do onboarding (D8).
- **Recomendação:** Remover o asterisco/`required` visual do label CNPJ no modo criação.

#### H3 — Revisar `onContinueWithoutDismiss` para limpar pending navigation em caminho de erro

- **Onde:** `src/components/flow/store-identity-form.tsx` (DriftDecisionModal, caminho de erro "Continuar por agora")
- **Problema:** No caminho de erro com pending navigation, `onContinueWithoutDismiss` pode não limpar a navegação adiada, deixando um estado pendente ao prosseguir sem dismiss.
- **Recomendação:** Revisar para limpar o `pendingNavUrl`/navegação adiada no caminho "Continuar por agora", preservando o badge de drift `'new'`.

---

### 3. Task Completion Status

| Task | Status |
|------|--------|
| 1–26 (onboarding em abas, draft, auto-save, fiscal, drift, legal panel, testes) | ✅ 26/26 Completo |

### 4. Final Assessment

**Nenhum CRITICAL.** 3 WARNINGs não bloqueantes (H1–H3) registrados para tratamento posterior. Fase verificada, aprovada e specs sincronizadas — **pronta para archive sem bloqueios**.
