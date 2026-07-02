## 1. Cancelar Button — VisualSignatureApprovalModal

- [x] 1.1 Renomear `handleContinueWithoutLogo` para `handleCancel` e substituir implementação: remover `fetch(PATCH /logo-status)`, `setState({ phase: "done", ... })`, `onComplete({ logoStatus })` — manter apenas `onClose()`
- [x] 1.2 Atualizar label do botão secundário na fase "error": de "Continuar sem logo/assinatura" para "Cancelar"
- [x] 1.3 Verificar/preservar que o label primário na fase "error" já usa `state.drift` como condição — se presente "Ajustar assinatura", senão "Tentar novamente"
- [x] 1.4 Verificar referências ao endpoint `/logo-status` e ao handler antigo dentro do `VisualSignatureApprovalModal` — **não** buscar zero ocorrências globais de `handleContinueWithoutLogo` (há outro no `StoreIdentityForm` relacionado à geração de direção visual, fora do escopo)
- [x] 1.5 Executar `rg -n 'logo-status' src` — **antes** da alteração, deve encontrar somente o caller no modal (fetch); **após** remover o fetch, deve retornar zero referências em conteúdo. A existência do arquivo de rota será verificada separadamente com `Test-Path -LiteralPath 'src/app/api/store/[id]/logo-status/route.ts'`

## 2. Proteger logo_status em Substitution Mode

- [x] 2.1 Em `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` (bloco de falha ~linhas 402-408): adicionar condicional — se `mode === 'substitution'` ou `isStorageError`, não alterar `logo_status`; caso contrário (`mode === 'standard'` + erro não-storage), manter `logo_status = 'failed'`

## 3. Remover Rota /logo-status

- [x] 3.1 Confirmar que o grep de consumidores (tarefa 1.5) não encontrou callers externos — se encontrados, documentar e avaliar migração ou adiamento
- [x] 3.2 Remover `src/app/api/store/[id]/logo-status/route.ts`
- [x] 3.3 Verificar que `npm run typecheck` passa sem erros após remoção
- [x] 3.4 Verificar que o endpoint não está mais acessível (GET/PATCH retorna 404)

## 4. Testes Automatizados

- [x] 4.1 Adicionar infraestrutura de teste comportamental: Testing Library + jsdom para renderizar o `VisualSignatureApprovalModal` com fase "error"
- [x] 4.2 Teste: "Cancelar" chama `onClose`, não chama `onComplete`, não inicia requisição — renderizar modal em fase "error", clicar "Cancelar", verificar chamadas
- [x] 4.3 Teste: "Tentar novamente" chama `generate()` — garantir que o botão primário não foi afetado
- [x] 4.4 Teste: erro com `state.drift` presente mostra label "Ajustar assinatura" no botão primário
- [x] 4.5 Teste parametrizado da rota `generate-without-logo`:
  - falha substitution (qualquer erro) → `logo_status` não alterado
  - falha standard + erro comum → `logo_status = 'failed'`
  - falha standard + storage error → `logo_status` não alterado

## 5. Verificação Automática

- [x] 5.1 `npm run typecheck` passa sem erros
- [x] 5.2 `npm run lint` passa sem erros
- [x] 5.3 `npm test` passa (275/275, 24 test files, todos os novos testes inclusos)
- [x] 5.4 `npm run build` passa

## 6. Validação Manual

- [x] 6.1 Fluxo standard: abrir modal, induzir erro de geração → "Cancelar" fecha sem nova requisição; Step 2 exibe estado anterior (requer ambiente dev + backend real)
- [x] 6.2 Fluxo substitution: VS ativa com drift → DriftCriticalModal → "Atualizar" → erro de geração → "Cancelar" fecha; VS ativa intacta; `logo_status` continua `'generated'` (requer ambiente dev + backend real)
- [x] 6.3 Confirmar que `PATCH /api/store/[id]/logo-status` retorna 404 após remoção da rota (requer ambiente dev + backend real)
