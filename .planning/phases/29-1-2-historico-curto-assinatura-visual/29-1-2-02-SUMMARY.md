## 29-1-2-02: Frontend — Summary

**Objective:** Reescrever o `VisualSignatureHistoryModal` com paginação, filtro client-side e ações condicionais. Adicionar prop `onOpenGallery` no `ApprovalModal` e bridge nos dois parents.

### Tasks Executed

- **2.1** — Props atualizadas: `onRestore` removido, `identityState` + `onApplied` adicionados
- **2.2** — Carregamento com paginação: `?limit=6&offset=0`, loading, error e empty states
- **2.3** — Filtro client-side: `visibleSignatures = rawSignatures.filter(s => s.restore_eligibility?.reason === "ok")`
- **2.4** — Grid 3 colunas com preview, status badge ("Ativa"/"Arquivada"/"Rascunho") e ação
- **2.5** — Ações condicionais: `text_only` → "Aplicar"; `visual_signature`/`logo` → "Indisponível" com tooltip
- **2.6** — `handleApply` via `POST /approve` (sem `reserveCredit`)
- **2.7** — Paginação "Ver versões anteriores": máximo 12 raw, botão some após segundo lote
- **2.8** — `onOpenGallery` prop adicionada ao ApprovalModal + link condicional "Ver versões recentes"
- **2.9** — Bridge no `store-visual-signature-section.tsx`
- **2.10** — Bridge no `store-identity-form.tsx`

### Key Files

**Modified:**
- `src/components/flow/visual-signature-history-modal.tsx` — Reescreito completo (240→272 linhas)
- `src/components/flow/visual-signature-approval-modal.tsx` — +onOpenGallery prop
- `src/components/flow/store-visual-signature-section.tsx` — Bridge + novos props
- `src/components/flow/store-identity-form.tsx` — Bridge + state + HistoryModal render

### Decisions (from CONTEXT.md)

- D1: HistoryModal substituído, não fase gallery no ApprovalModal
- D2: Filtro client-side de critical_drift e missing_metadata
- D3: Ações condicionais ao estado de identidade
- D4: Paginação "Ver versões anteriores" simples (max 12)
- D5: Sem consumo de crédito
- D6: ApprovalModal ganha prop onOpenGallery
- D7: Bridge em dois parents (section + identity-form)

### Verification

- Typecheck: ✓
- Build: ✓
- Lint: ✓
- Tests: ✓ (943 passing)

### Commits

- `720ac8c` — 29-1-2-02: Frontend — HistoryModal rewrite + ApprovalModal bridge + pagination
- `17a893f` — fix(29-1-2): resolve test issues
