## Why

A geração de Assinatura Visual (VS) ainda usa o modelo antigo de cota fixa de 3 tentativas, enquanto as campanhas já consomem créditos via o pipeline transacional. Com a iminente abertura de compra de créditos (F30), a VS precisa usar o mesmo modelo econômico do resto do produto: cada geração custa 1 crédito, sem limite artificial de tentativas. Manter dois modelos gera inconsistência econômica e confusão para o usuário.

## What Changes

- **VS passa a consumir créditos** — cada geração custa 1 crédito, seguindo o mesmo padrão do pipeline de campanhas (`getBalance → reserveCredit → refund em falha técnica`). O crédito é reservado antes da chamada de IA, estornado apenas em falha técnica (timeout, erro de IA, falha de storage), e consumido quando a VS é persistida com sucesso. Rejeição é escolha criativa, não falha técnica, e não gera estorno.
- **Remover cota fixa de 3 tentativas** — `visual_signature_attempts` deixa de ser autoridade de produto. O usuário pode gerar quantas VS quiser, limitado apenas pelo saldo de créditos
- **Tratar saldo insuficiente na UI** — modal de aprovação (`VisualSignatureApprovalModal`) exibe estado "Créditos insuficientes" com CTA para `/conta`, sem tratá-lo como erro de sistema
- **Manter histórico de versões** — as VS geradas anteriormente continuam acessíveis para reativação via review, com validação de drift preservada e limite de 6 no modal
- **Não contabilizar tentativas fracassadas** — falhas técnicas estornam o crédito e não consomem saldo
- **Launch Config respeitado** — `creditsChargingEnabled`, `v15Enabled`, `generationPaused` controlam o comportamento
- **`VisualSignatureModal` descontinuado** — `generateVariations()` e `generateAutomatic()` não recebem integração de crédito. O modal antigo é ocultado da UI
- **Referência correta no ledger** — `reserveCredit` para VS usa `campaignId: null` + `metadata.feature: "visual_signature"` + `credit_tx_id` gravado no metadata da VS

## Capabilities

### New Capabilities

*(Nenhuma — todas as mudanças são modificações em capabilities existentes)*

### Modified Capabilities

- `visual-signature-approval`: Critério de autoridade muda de cota fixa (3 tentativas) para saldo de créditos. Remove fase `exhausted`. Remove badge "Tentativa X/3". Adiciona fase `insufficient_credits` com CTA. Review sempre habilitado se houver VS no histórico (sem bloqueio por limite). Review limita exibição a 6 VS.
- `store-visual-signature`: Metadata da `store_visual_signatures` ganha campo obrigatório `credit_tx_id` para rastreabilidade da transação de crédito.
- `credit-service`: `reserveCredit()` deve aceitar `campaignId: null` com `metadata.feature: "visual_signature"` para operações de VS. `refundCredit()` compatível com esse padrão.
- `launch-config`: VS deve respeitar `creditsChargingEnabled`, `generationPaused`, e `v15Enabled` no handler de geração.
- `store-identity-art-director`: Geração de VS deve incluir verificação de saldo + reserva de crédito antes da chamada de IA, e estorno em caso de falha técnica.

## Impact

| Área | Impacto |
|------|---------|
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` | Adicionar guards de launch config, balance check, reserveCredit, refundCredit, try/finally. Remover guard de limite 3 e incremento de attempts |
| `src/app/api/store/[id]/visual-signature/reject/route.ts` | Remover bloco exhausted (currentAttempts >= 3) |
| `src/app/api/store/[id]/visual-signature/approve/route.ts` | Remover reset de visual_signature_attempts |
| `src/components/flow/visual-signature-approval-modal.tsx` | Remover badge "Tentativa X/3", guards de limite, fase exhausted. Adicionar tratamento de 402, fase insufficient_credits, botão "Ver versões anteriores" |
| `src/components/flow/store-visual-signature-section.tsx` | Ocultar caminho que abre VisualSignatureModal (D2) |
| `src/lib/visual-signature/types.ts` | Adicionar campo opcional `credit_tx_id` em `VisualSignatureMetadata` |
| `src/lib/visual-signature/server-actions.ts` | Não modificado (descontinuado por D2) |
| `supabase/migrations/` | Nenhuma migration nesta fase (D7 — coluna mantida) |
| Testes | 20+ testes novos: fluxo de crédito (8), limite removido (5), UI de 402 (4), histórico/review (3), regressão (4+) |
