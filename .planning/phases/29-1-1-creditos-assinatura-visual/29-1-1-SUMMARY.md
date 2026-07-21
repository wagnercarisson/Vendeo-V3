---
phase: 29-1-1
name: "Créditos na Assinatura Visual"
status: Planned
plans: 3/3
milestone: v1.5
---

# Phase 29.1.1 — Créditos na Assinatura Visual

**Objetivo:** VS passa a consumir créditos como o resto do produto, removendo cota fixa de 3 tentativas.

## Plans

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-1-1-01 | 1 | △ | Backend Foundation — Types, CreditService, Routes (6 tasks) |
| 29-1-1-02 | 2 | △ | Frontend — Modal UI + Ocultar Modal Antigo (6 tasks) |
| 29-1-1-03 | 3 | △ | Testes e Verificação — 20+ testes, typecheck, lint, build |

## Key Decisions

| Decision | Summary |
|----------|---------|
| D1 | Reserva de crédito ANTES da IA, estorno apenas em falha técnica |
| D2 | `campaignId: null` + `metadata.feature: "visual_signature"` para VS |
| D3 | Lock com try/finally para garantir liberação |
| D4 | Launch config respeitado (`v15Enabled`, `creditsChargingEnabled`, `generationPaused`) |
| D5 | Review limita a 6 VS no modal |
| D6 | VisualSignatureModal ocultado da UI |
| D7 | Sem migration — coluna `visual_signature_attempts` mantida |
