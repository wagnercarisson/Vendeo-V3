## Context

A geração de Assinatura Visual (VS) é o único fluxo no Vendeo que ainda usa cota fixa de 3 tentativas como autoridade de limite. Campanhas já consomem créditos via pipeline transacional (F24-F27). Com a abertura de compra de créditos (F30), a VS precisa usar o mesmo modelo: saldo de créditos como única autoridade, sem limite artificial.

O fluxo principal de VS é `VisualSignatureApprovalModal` → `POST /generate-without-logo` → Art Director → persistência. Existe um fluxo paralelo (`VisualSignatureModal` com `generateVariations`/`generateAutomatic`) que será descontinuado (D2). O `CreditService` já implementa `reserveCredit`, `refundCredit` e `getBalance` — reutilizados sem mudanças estruturais.

## Goals / Non-Goals

**Goals:**
- VS passa a consumir 1 crédito por geração, com reserva antes da IA e estorno em falha técnica
- Remover toda lógica de cota fixa de 3 tentativas do backend (routes) e frontend (modal)
- Tratar saldo insuficiente (402) na UI do modal de aprovação, sem erro de sistema
- Manter histórico de versões com review limitado a 6 VS no modal
- `VisualSignatureModal` (modal antigo) ocultado da UI
- Nenhuma migration de schema (D7)
- Respeitar launch config (`creditsChargingEnabled`, `generationPaused`, `v15Enabled`)

**Non-Goals:**
- Galeria/histórico completo de VS (página dedicada) — fase futura
- Stripe Checkout / compra de créditos — F30
- Créditos mensais freemium ou onboarding — fases futuras
- Remoção da coluna `visual_signature_attempts` — mantida sem migration
- Redesenho do `VisualSignatureModal` — apenas ocultar
- UI de saldo restante no modal de VS — não obrigatório nesta fase
- Notificações de crédito baixo
- Modificação no extrato da página `/conta` para traduzir `metadata.feature: "visual_signature"`

## Decisions

### D1 — Reserva de crédito ANTES da IA, estorno apenas em falha técnica

Ordem no handler `generate-without-logo`: generationPaused guard → validações/auth → lock → launch config → balance check → reserveCredit → IA → persistência. Se a IA falha (timeout, erro, storage), `refundCredit` é chamado no catch. Se o usuário rejeita depois, o crédito já foi consumido (a reserva já deduziu). Rejeição é escolha criativa, não falha técnica.

**Alternativa considerada:** Reservar depois da IA. Rejeitado porque expõe o sistema a risco de geração sem saldo (race condition entre chamadas concorrentes).

**Alternativa considerada:** Reservar no approve (pós-rejeição). Rejeitado porque o custo da geração já foi incorrido (chamada de IA paga).

### D2 — `campaignId: null` + `metadata.feature` para VS no ledger

`reserveCredit` é chamado com `campaignId: null` e `metadata: { feature: "visual_signature", mode, operationId }`. O `credit_tx_id` retornado é gravado no `metadata` da `store_visual_signatures` para rastreabilidade.

**Alternativa considerada:** Reutilizar `campaignId` com um ID fictício. Rejeitado porque polui a semântica do ledger. O campo `campaign_id` deve referenciar apenas campanhas reais.

### D3 — Lock com try/finally

O `generationLocks` existente é envolto em `try/finally` para garantir liberação em qualquer cenário de falha (crédito, IA, storage, persistência). O timeout também é limpo no `finally`.

### D4 — `v15Enabled=false` e `creditsChargingEnabled=false` pulam verificação

Se `v15Enabled=false`, o fluxo de VS gera sem consumir crédito (compatibilidade v1.4). Se `creditsChargingEnabled=false`, gera sem verificar saldo (útil para testes). `generationPaused=true` retorna 503 antes de qualquer operação.

### D5 — Review limita a 6 VS no modal

API `GET /api/store/[id]/visual-signature` ganha parâmetros opcionais `?limit=N&offset=0`. O modal chama com `limit=6`. Se houver mais, exibe indicador não clicável "Há mais versões no histórico." Sem link — não há página de galeria nesta fase.

### D6 — `VisualSignatureModal` ocultado (D2)

`generateVariations()` e `generateAutomatic()` em `server-actions.ts` não recebem integração de crédito. O `VisualSignatureModal` é ocultado da UI. Todo esforço de crédito na VS fica concentrado no `VisualSignatureApprovalModal` + `generate-without-logo/route.ts`.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Usuário gera dezenas de VS sem aprovar — gasta créditos sem benefício | Experiência esperada (crédito = consumo). Review permite reaproveitar. Galeria em fase futura |
| Modal fica pesado com muitas VS no histórico | Review não carrega tudo — `limit=6`. Histórico completo é fase futura |
| `VisualSignatureModal` ainda acessível — geração sem crédito | D2 descontinua. Verificar na implementação que nenhuma UI chama o modal antigo |
| Lock de concorrência com crédito — dois requests simultâneos reservam 2 créditos | Lock mantido. Balance + reserve DENTRO do lock. Ordem: lock → balance → reserve → geração |
| Refund em falha não executado — crédito preso | `try/finally` no handler. Refund no catch de qualquer erro após reserve |
