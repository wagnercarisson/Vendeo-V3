# Phase 29.1.1: Créditos na Assinatura Visual — Context

**Gathered:** 2026-07-21
**Status:** Ready for planning
**Source:** OpenSpec Change (`openspec/changes/fase-29-1-1-creditos-assinatura-visual/`)

<domain>
## Phase Boundary

A geração de Assinatura Visual (VS) ainda usa o modelo antigo de cota fixa de 3 tentativas, enquanto as campanhas já consomem créditos via pipeline transacional (F24-F27). Com a abertura de compra de créditos (F30), a VS precisa usar o mesmo modelo econômico: cada geração custa 1 crédito, sem limite artificial de tentativas.

**O que esta fase entrega:**
- VS passa a consumir 1 crédito por geração, com reserva antes da IA e estorno em falha técnica
- Toda lógica de cota fixa de 3 tentativas removida do backend (routes) e frontend (modal)
- Saldo insuficiente (402) tratado na UI do modal de aprovação, sem erro de sistema
- Histórico de versões mantido com review limitado a 6 VS no modal
- `VisualSignatureModal` (modal antigo) ocultado da UI
- Nenhuma migration de schema
- Launch config respeitado (`creditsChargingEnabled`, `generationPaused`, `v15Enabled`)
</domain>

<decisions>
## Implementation Decisions

### D1 — Reserva de crédito ANTES da IA, estorno apenas em falha técnica
Ordem no handler `generate-without-logo`: generationPaused guard → validações/auth → lock → launch config → balance check → reserveCredit → IA → persistência. Se a IA falha (timeout, erro, storage), `refundCredit` é chamado no catch. Se o usuário rejeita depois, o crédito já foi consumido (a reserva já deduziu). Rejeição é escolha criativa, não falha técnica.

### D2 — `campaignId: null` + `metadata.feature` para VS no ledger
`reserveCredit` chamado com `campaignId: null` e `metadata: { feature: "visual_signature", mode, operationId }`. O `credit_tx_id` retornado é gravado no `metadata` da `store_visual_signatures`.

### D3 — Lock com try/finally
`generationLocks` envolto em `try/finally` para garantir liberação em qualquer cenário de falha. Timeout também limpo no `finally`.

### D4 — `v15Enabled=false` e `creditsChargingEnabled=false` pulam verificação
Se `v15Enabled=false`, fluxo de VS gera sem consumir crédito (compatibilidade v1.4). Se `creditsChargingEnabled=false`, gera sem verificar saldo. `generationPaused=true` retorna 503 antes de qualquer operação.

### D5 — Review limita a 6 VS no modal
API `GET /api/store/[id]/visual-signature` ganha parâmetros opcionais `?limit=N&offset=0`. Modal chama com `limit=6`. Se houver mais, exibe indicador não clicável "Há mais versões no histórico."

### D6 — `VisualSignatureModal` ocultado
`generateVariations()` e `generateAutomatic()` em `server-actions.ts` não recebem integração de crédito. `VisualSignatureModal` ocultado da UI.

### D7 — Migration não necessária
Coluna `visual_signature_attempts` mantida sem migration. Apenas não é mais incrementada, resetada ou consultada como regra de negócio.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Routes
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — Handler que gera VS sem logo (PRINCIPAL — recebe integração de crédito)
- `src/app/api/store/[id]/visual-signature/reject/route.ts` — Handler de rejeição (remove exhausted)
- `src/app/api/store/[id]/visual-signature/approve/route.ts` — Handler de aprovação (remove reset attempts)
- `src/app/api/store/[id]/visual-signature/route.ts` — GET list (adicionar limit/offset)

### Frontend
- `src/components/flow/visual-signature-approval-modal.tsx` — Modal de aprovação VS (PRINCIPAL — adicionar insufficient_credits, remover exhausted)
- `src/components/flow/store-visual-signature-section.tsx` — Seção que orquestra modais (ocultar modal antigo)

### Types e Serviços
- `src/lib/visual-signature/types.ts` — Tipos VS (adicionar `credit_tx_id` em `VisualSignatureMetadata`)
- `src/lib/credit/types.ts` — `CreditOperationOptions` (campaignId aceita null)
- `src/lib/credit/credit-service.ts` — `reserveCredit()`, `refundCredit()`, `getBalance()`
- `src/lib/launch-config/config.ts` — `getLaunchConfig()` com flags

### OpenSpec Artifacts (source of truth)
- `openspec/changes/fase-29-1-1-creditos-assinatura-visual/proposal.md` — Proposta de mudança
- `openspec/changes/fase-29-1-1-creditos-assinatura-visual/design.md` — Decisões de design
- `openspec/changes/fase-29-1-1-creditos-assinatura-visual/tasks.md` — Lista de tarefas detalhada
- `openspec/changes/fase-29-1-1-creditos-assinatura-visual/specs/credit-service/spec.md` — Spec do CreditService para VS
- `openspec/changes/fase-29-1-1-creditos-assinatura-visual/specs/launch-config/spec.md` — Spec de launch config para VS
- `openspec/changes/fase-29-1-1-creditos-assinatura-visual/specs/store-visual-signature/spec.md` — Spec de store VS (credit_tx_id, limit/offset)
- `openspec/changes/fase-29-1-1-creditos-assinatura-visual/specs/visual-signature-approval/spec.md` — Spec do modal de aprovação

### Testes
- `src/lib/credit/__tests__/credit-service.test.ts` — Testes existentes do CreditService
- `src/lib/launch-config/__tests__/config.test.ts` — Testes existentes do launch config

</canonical_refs>

<specifics>
## Specific References

### Fluxo de crédito no generate-without-logo

```typescript
// Ordem exata no handler:
// 1. generationPaused guard → 503
// 2. v15Enabled check → skip credit if false
// 3. creditsChargingEnabled check → skip balance/reserve if false
// 4. Balance check (getBalance < 1 → 402)
// 5. reserveCredit(campaignId: null, metadata: { feature: "visual_signature", mode, operationId })
// 6. IA generation (inside try)
// 7. On success: persist + credit_tx_id in metadata
// 8. On catch (tech failure): refundCredit
// 9. finally: generationLocks.delete + clearTimeout
```

### IdempotencyKey pattern for VS
`vs_reserve_${storeId}_${operationId}`

### CreditOperationOptions modificado
`campaignId?: string | null` (aceita null explicitamente)

### Review/checking phase changes
- Modal checking phase carrega `GET /api/store/[id]/visual-signature?limit=6`
- Sempre mostra review se houver signatures (nunca exhausted)
- Review mostra "Gerar nova versão" — NÃO faz check proativo de saldo. Tenta gerar; se backend retornar 402, entra em `insufficient_credits`
- Se total > 6, indicador "Há mais versões no histórico. Galeria completa em breve."

</specifics>

<deferred>
## Deferred Ideas

- Galeria/histórico completo de VS (página dedicada) — fase futura
- Stripe Checkout / compra de créditos — F30
- Créditos mensais freemium ou onboarding — fases futuras
- Remoção da coluna `visual_signature_attempts` — mantida sem migration
- Redesenho do `VisualSignatureModal` — apenas ocultar
- UI de saldo restante no modal de VS — não obrigatório nesta fase
- Notificações de crédito baixo
- Modificação no extrato da página `/conta` para traduzir `metadata.feature: "visual_signature"`

</deferred>

---

*Phase: 29-1-1-creditos-assinatura-visual*
*Context gathered: 2026-07-21 via OpenSpec Change artifacts*
