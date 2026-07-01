## 1. Cancelar Button — VisualSignatureApprovalModal

- [ ] 1.1 Renomear `handleContinueWithoutLogo` para `handleCancel` e substituir implementação: remover `fetch(PATCH /logo-status)`, `setState({ phase: "done", ... })`, `onComplete({ logoStatus })` — manter apenas `onClose()`
- [ ] 1.2 Atualizar label do botão secundário na fase "error": de "Continuar sem logo/assinatura" para "Cancelar"
- [ ] 1.3 Verificar/preservar que o label primário na fase "error" já usa `state.drift` como condição — se presente "Ajustar assinatura", senão "Tentar novamente"
- [ ] 1.4 Verificar que não restam referências a `handleContinueWithoutLogo` no componente

## 2. Proteger logo_status em Substitution Mode

- [ ] 2.1 Em `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` (bloco de falha ~linhas 402-408): adicionar condicional — se `mode === 'substitution'` ou `isStorageError`, não alterar `logo_status`; caso contrário (`mode === 'standard'` + erro não-storage), manter `logo_status = 'failed'`

## 3. Testes Automatizados

- [ ] 3.1 Adicionar infraestrutura de teste comportamental: Testing Library + jsdom para renderizar o `VisualSignatureApprovalModal` com fase "error"
- [ ] 3.2 Teste: "Cancelar" chama `onClose`, não chama `onComplete`, não inicia requisição — renderizar modal em fase "error", clicar "Cancelar", verificar chamadas
- [ ] 3.3 Teste: "Tentar novamente" chama `generate()` — garantir que o botão primário não foi afetado
- [ ] 3.4 Teste: erro com `state.drift` presente mostra label "Ajustar assinatura" no botão primário
- [ ] 3.5 Teste parametrizado da rota `generate-without-logo`:
  - falha substitution (qualquer erro) → `logo_status` não alterado
  - falha standard + erro comum → `logo_status = 'failed'`
  - falha standard + storage error → `logo_status` não alterado

## 4. Verificação

- [ ] 4.1 `npm run typecheck` passa sem erros
- [ ] 4.2 `npm run lint` passa sem erros
- [ ] 4.3 `npm test` passa (incluindo os novos testes)
- [ ] 4.4 `npm run build` passa
