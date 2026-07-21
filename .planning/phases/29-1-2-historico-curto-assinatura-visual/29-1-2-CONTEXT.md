# Phase 29.1.2: Histórico Curto + Assinatura Visual — Context

**Gathered:** 2026-07-21
**Status:** Ready for planning
**Source:** OpenSpec Change (`openspec/changes/fase-29-1-2-historico-curto-assinatura-visual/`)

<domain>
## Phase Boundary

A F29.1.1 removeu o limite fixo de 3 gerações e introduziu consumo de crédito na VS. Como consequência, o usuário pode acumular dezenas de versões. O `VisualSignatureHistoryModal` atual (240 linhas) foi feito antes do sistema de drift e antes do review phase: carrega todas as VS sem paginação, mostra versões com critical_drift como "restauráveis" (só bloqueia no server), não distingue visualmente versões aplicáveis de bloqueadas, e está desconectado do `ApprovalModal` — sem ponte entre "Há mais versões" e o histórico.

**O que esta fase entrega:**
- Substituir o `VisualSignatureHistoryModal` por uma lista curta e segura de VS recentes (máximo 12 itens), exibindo `draft`, `archived` e `active` conforme regras de aplicabilidade
- Ocultar visualmente versões com `critical_drift` ou `missing_metadata` — filtro client-side
- Ações condicionais ao estado de identidade: `text_only` permite aplicar VS; `visual_signature`, `logo` e `null` bloqueiam com instrução clara
- Incluir `draft` na listagem com revalidação de drift obrigatória
- Integrar com `ApprovalModal` via prop `onOpenGallery`
- Paginação simples — botão "Ver versões anteriores" quando total > 6, máximo 12 itens
- Alterar backend: condição de drift validation no POST /approve de `status === 'archived'` para `status !== 'active'`
- Atualizar spec `visual-signature-restore` para refletir que `identity_state = 'visual_signature'` agora é BLOQUEADO
- Nenhuma nova API route, migration, schema change, ou consumo de crédito
</domain>

<decisions>
## Implementation Decisions

### D1 — HistoryModal substituído, não fase gallery no ApprovalModal
`DECIDIDO`

A lista de VS é gestão de histórico, não parte do ciclo de geração/aprovação. Fluxo: ApprovalModal → clica "Ver versões recentes" → chama `onOpenGallery()` → parent fecha ApprovalModal e abre HistoryModal → ao concluir, retorna ao contexto anterior.

### D2 — Filtro client-side de critical_drift e missing_metadata
`DECIDIDO`

API continua retornando todas as VS sem filtro novo. Componente filtra `signatures.filter(s => s.restore_eligibility?.reason === "ok")`. Ação final nunca confia no filtro client-side — POST /approve sempre revalida drift no servidor.

| `restore_eligibility.reason` | Aparece na lista? |
|---|---|
| `ok` | Sim |
| `critical_drift` | **Não** |
| `missing_metadata` | **Não** |

### D3 — Ações condicionais ao estado de identidade
`DECIDIDO`

```
identity_state = "visual_signature" (VS ativa existe)
  └── VS archived: ❌ Bloqueado — "Remova a assinatura ativa antes de aplicar outra versão"
  └── VS draft:     ❌ Bloqueado
  └── VS active:    ✅ "Em uso" (info, sem ação)

identity_state = "text_only" (nenhuma VS ativa)
  └── VS archived:  ✅ "Aplicar" → POST /approve (com revalidação)
  └── VS draft:     ✅ "Aplicar" → POST /approve (com revalidação)
  └── VS active:    ❌ Não deveria existir (consistência)
```

`canApply(identityState) => identityState === "text_only"`. Backend: mudar condição de `status === 'archived'` para `status !== 'active'`.

### D4 — Paginação "Ver versões anteriores" simples
`DECIDIDO`

Carga inicial: `limit=6`, `offset=0`. Botão "Ver versões anteriores" quando `apiTotal > rawSignaturesLoaded` E segundo lote ainda não carregado. Máximo 12 raw. Botão some permanentemente após carregar segundo lote.

### D5 — Sem consumo de crédito
`DECIDIDO`

Visualizar ou reativar VS anterior nunca consome crédito. POST /approve para VS archived/draft não chama `reserveCredit`. Drift validation é gratuita.

### D6 — ApprovalModal ganha prop `onOpenGallery`
`DECIDIDO`

`VisualSignatureApprovalModal` recebe prop opcional `onOpenGallery?: () => void`. Placeholder "Galeria completa em breve" vira link "Ver versões recentes" quando `onOpenGallery` presente E `totalSignatures > 6`.

### D7 — Bridge em dois parents (section + identity-form)
`DECIDIDO`

Tanto `store-visual-signature-section.tsx` quanto `store-identity-form.tsx` precisam do bridge: callback `handleOpenGallery` que fecha ApprovalModal e abre HistoryModal, passagem de `identityState` e `onApplied`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend
- `src/components/flow/visual-signature-history-modal.tsx` — [REESCREVER] Componente atual (240 linhas) sem paginação, sem filtro, sem ações condicionais
- `src/components/flow/visual-signature-approval-modal.tsx` — [MODIFICAR] Adicionar prop `onOpenGallery`, modificar placeholder
- `src/components/flow/store-visual-signature-section.tsx` — [ADICIONAR] Bridge ApprovalModal → HistoryModal
- `src/components/flow/store-identity-form.tsx` — [ADICIONAR] State + bridge ApprovalModal → HistoryModal

### Backend
- `src/app/api/store/[id]/visual-signature/approve/route.ts` — [ALTERAR] Condição ~linha 406: `status === 'archived'` → `status !== 'active'`

### Specs
- `openspec/specs/visual-signature-restore/spec.md` — [ATUALIZAR] Linha 20: `'visual_signature'` passa de PERMITIDO para BLOQUEADO

### OpenSpec Artifacts (source of truth)
- `openspec/changes/fase-29-1-2-historico-curto-assinatura-visual/proposal.md` — Proposta de mudança
- `openspec/changes/fase-29-1-2-historico-curto-assinatura-visual/design.md` — Decisões de design (D1–D7)
- `openspec/changes/fase-29-1-2-historico-curto-assinatura-visual/tasks.md` — Lista de tarefas detalhada
- `openspec/changes/fase-29-1-2-historico-curto-assinatura-visual/specs/visual-signature-restore/spec.md` — Spec delta: identity_state bloqueado
- `openspec/changes/fase-29-1-2-historico-curto-assinatura-visual/specs/visual-signature-approval/spec.md` — Spec delta: onOpenGallery + draft drift
- `openspec/changes/fase-29-1-2-historico-curto-assinatura-visual/specs/store-visual-signature/spec.md` — Spec delta: HistoryModal completo

</canonical_refs>

<specifics>
## Specific References

### Props do novo HistoryModal
```typescript
interface VisualSignatureHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  identityState: string | null;
  onApplied?: () => void;
}
```

### Lógica de aplicabilidade
```typescript
function canApply(identityState: string | null): boolean {
  return identityState === "text_only";
}
```

### Condição de drift no backend (antes/depois)
```
ANTES:  if (signature.status === 'archived') { validateDrift(...) }
DEPOIS: if (signature.status !== 'active') { validateDrift(...) }
```

### Spec visual-signature-restore — mudança
Linha 20 do spec atual: `'visual_signature'` → permitted
Mudar para: `'visual_signature'` → **REJECTED** com `requires_vs_removal: true`

### Paginação
- Carga inicial: `limit=6`, `offset=0`
- Segundo lote: `limit=6`, `offset=6`
- Máximo: 12 raw signatures carregadas
- Gatilho: `apiTotal > rawSignaturesLoaded` && segundo lote não carregado
- Botão some após carregar segundo lote

### Estados do HistoryModal
- Loading → spinner
- Error → mensagem de erro descritiva
- Empty → "Nenhuma assinatura anterior"
- Grid 3 colunas com preview, badge ("Ativa" / "Arquivada" / "Rascunho"), ação condicional
- Contagem: "6 de 12" ou "4 assinaturas" (nunca total filtrado global)
</specifics>

<deferred>
## Deferred Ideas

- Galeria gigante com paginação completa, filtros combinados, busca — fase futura
- Substituição de VS ativa (substitution mode no HistoryModal) — usuário remove ativa primeiro
- Server-side filtering (`?filter=applicable`) — client-side suficiente
- Modal stack (HistoryModal dentro do ApprovalModal) — parent fecha um e abre outro
- Consumo de crédito para visualizar ou reativar VS — sempre gratuito
- Redesenho do ApprovalModal — apenas adicionar prop + link
- Exibição de VS com critical_drift ou missing_metadata — ocultas da lista

</deferred>

---

*Phase: 29-1-2-historico-curto-assinatura-visual*
*Context gathered: 2026-07-21 via OpenSpec Change artifacts*
