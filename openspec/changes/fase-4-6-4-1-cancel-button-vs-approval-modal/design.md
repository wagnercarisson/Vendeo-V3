## Context

O `VisualSignatureApprovalModal` exibe um botão "Continuar sem logo" / "Continuar sem assinatura" na fase `"error"` que persiste indevidamente `logo_status = 'explicit_none'` via PATCH. O modal persiste aprovação e rejeição (comportamento correto e existente), mas a ação secundária na fase error não deve persistir uma decisão de identidade — o formulário pai é o orquestrador de estado.

O bug em cascata: o PATCH altera `logo_status` no DB sem `identity_state` correspondente; `handleApprovalComplete` no formulário pai seta `identityState = 'visual_signature'` incondicionalmente, divergindo do DB até o próximo reload.

## Goals / Non-Goals

**Goals:**
- Substituir `handleContinueWithoutLogo` por `handleCancel` (apenas `onClose()`) no `VisualSignatureApprovalModal`
- Atualizar label do botão secundário na fase `"error"` para "Cancelar"
- Testar que o clique em "Cancelar" não chama `onComplete` nem inicia requisição

**Non-Goals:**
- Alterar comportamento de exhausted state ou approval standard
- Remover endpoints ou rotas de API
- Modificar specs não relacionadas ao botão da fase error ou substitution mode

## Decisions

### Decisão: Cancelar chama apenas onClose()

`handleCancel` chama exclusivamente `onClose()`. Nenhum fetch, nenhum `onComplete()`, nenhuma mutação de estado além do fechamento do modal. O formulário pai já retém o estado anterior — o modal foi aberto sem mutação de estado do formulário, então fechá-lo simplesmente restaura a UI ao estado anterior.

### Decisão: Label primário usa state.drift

O modal usa `state.drift` internamente (não a prop `hasActiveSignatureDrift`) para decidir o label primário. Quando `state.drift` está presente: "Ajustar assinatura". Caso contrário: "Tentar novamente". O botão secundário mantém "Cancelar" em todos os cenários de erro.

### Decisão: Falha em substitution mode não altera logo_status

Em substitution mode, o erro de geração não deve tocar `logo_status` porque a VS ativa continua existindo. A exceção já existente para storage errors também se aplica: se o erro é de storage, `logo_status` também é preservado. Em standard mode, `logo_status = 'failed'` (exceto storage error) continua correto — a tentativa de criação de VS falhou.

## Risks / Trade-offs

| Risco | Impacto | Mitigação |
|---|---|---|
| Timeout: cliente (190s) < backend (300s). Cancelar não cancela processamento anterior | Geração prévia pode completar depois, persistindo estado divergente | Documentado. O clique em Cancelar não inicia requisição; não há garantia sobre processamento já em andamento. |
| Testes do modal são unitários isolados — sem renderização | Cobertura de regressão insuficiente | Incluir infraestrutura de teste comportamental (Testing Library + jsdom) como parte das tasks. |
