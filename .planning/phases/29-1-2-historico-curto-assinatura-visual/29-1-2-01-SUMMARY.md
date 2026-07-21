## 29-1-2-01: Backend Foundation — Summary

**Objective:** Corrigir a condição de drift validation no approve route para cobrir também `draft`, e atualizar o spec `visual-signature-restore` para refletir o bloqueio de `identity_state = 'visual_signature'`.

### Tasks Executed

- **1.1** — Alterada condição de drift validation de `status === 'archived'` para `status !== 'active'` em `approve/route.ts:406`
- **1.2** — Atualizado spec `visual-signature-restore/spec.md`: `identity_state = 'visual_signature'` passa de PERMITIDO para REJEITADO com `requires_vs_removal: true`; adicionada seção REMOVED Requirements documentando a migração

### Key Files

**Modified:**
- `src/app/api/store/[id]/visual-signature/approve/route.ts` — Linha 406: condição alterada
- `openspec/specs/visual-signature-restore/spec.md` — identity_state bloqueado, REMOVED Requirements adicionada

### Verification

- Typecheck: ✓
- Build: ✓
- Lint: ✓
- Tests: ✓ (943 passing)

### Commits

- `f0e0af2` — 29-1-2-01: Backend Foundation — approve drift fix + spec update
