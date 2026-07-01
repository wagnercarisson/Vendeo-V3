## Why

O botão "Continuar sem logo" / "Continuar sem assinatura" na fase `"error"` do `VisualSignatureApprovalModal` persiste uma decisão de identidade (`PATCH /logo-status { logo_status: 'explicit_none' }`) sem transicionar `identity_state`, corrompendo a sincronização entre o campo canônico e o campo derivado. Um cancelamento na fase error deve apenas fechar o modal sem persistir decisão adicional de identidade — mutações já ocorridas em operações anteriores continuam valendo.

## What Changes

- Substitui `handleContinueWithoutLogo` por `handleCancel` que chama apenas `onClose()` — sem PATCH, sem `onComplete`, sem nova requisição iniciada pelo clique
- Texto do botão secundário na fase `"error"` muda de "Continuar sem logo/assinatura" para "Cancelar"
- Em falha de geração com `mode='substitution'`, não altera `logo_status` (VS ativa permanece ativa com status inalterado)

## Capabilities

### New Capabilities

_Nenhuma._

### Modified Capabilities

- `visual-signature-approval`: Ação secundária na fase error do modal — passa de "Continuar sem logo/assinatura" (com PATCH) para "Cancelar" (apenas fecha o modal)
- `store-visual-signature`: Geração com `mode='substitution'` em caso de falha não altera `logo_status`

## Impact

- **Código modificado**: ~15 linhas no modal + ~5 linhas em `generate-without-logo/route.ts`
- **Nenhuma migration**, alteração de storage, prompts de IA, ou design system tokens
- **Nenhum endpoint removido ou criado**
