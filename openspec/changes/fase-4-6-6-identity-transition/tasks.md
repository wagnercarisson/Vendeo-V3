## 1. Orquestrador Central de Transições

- [x] 1.1 Criar `src/lib/identity-transitions.ts` com o orquestrador central — `transition(storeId, type, payload?)` suportando os 4 tipos de transição
- [x] 1.2 Implementar validação de `identity_state` inicial — rejeitar se incompatível com a transição solicitada (I4)
- [x] 1.3 Implementar lifecycle de transição: validação → persistência crítica → atualização de `identity_state` → compensação em falha (I5, I6)
- [x] 1.4 Implementar dual-population de `logo_status` via `IDENTITY_TO_LOGO_STATUS` em toda atualização de `identity_state`
- [x] 1.5 Garantir que brand profile permanece `synced` após transições `logo → text_only` e `visual_signature → text_only`

## 2. Validação de Estado nas APIs

- [x] 2.1 Atualizar `POST /api/store/[id]/logo` — validar `identity_state` antes de ativar asset ou atualizar store; bloquear se `identity_state = 'logo'` (409: remova o logo ativo primeiro) ou `'visual_signature'` (409: remova a VS primeiro); permitir apenas de `text_only`
- [x] 2.2 Atualizar `DELETE /api/store/[id]/logo` — usar orquestrador `logo → text_only`, arquivar asset ativo, preservar profile `synced`
- [x] 2.3 Atualizar `POST /api/store/[id]/visual-signature/approve` — validar `identity_state` antes de ativar VS ou atualizar store; usar orquestrador `text_only → visual_signature`; ativar VS apenas após validação de estado
- [x] 2.4 Atualizar `DELETE /api/store/[id]/visual-signature` — usar orquestrador `visual_signature → text_only`, arquivar VS ativa, preservar profile `synced`
- [x] 2.5 Atualizar `POST /api/store/[id]/visual-signature/restore` — bloquear se `identity_state = 'logo'` (409); permitir apenas de `text_only`; sem drift/revalidação/realinhamento

## 3. UI por Estado de Identidade

- [x] 3.1 Implementar hook `useIdentityActions(identityState, storeData)` retornando ações disponíveis por estado
- [x] 3.2 Atualizar `store-identity-form.tsx` — aplicar matrix de ações: `text_only` exibe "Enviar logotipo" + "Gerar/Gerenciar VS"; `logo` exibe apenas "Remover logo"; `visual_signature` exibe apenas "Remover assinatura visual"
- [x] 3.3 Atualizar `store-visual-signature-section.tsx` — em `visual_signature` exibir apenas "Remover assinatura visual"; em `logo` ocultar ações de VS; em `text_only` exibir "Gerar assinatura visual" (ou "Gerenciar assinatura visual" se VS existir)
- [x] 3.4 Remover link "Continuar sem logo" do Step 2 — não deve aparecer em nenhum estado de identidade

## 4. Card de Orientação e Aviso de Remoção

- [x] 4.1 Implementar card informativo no Step 2 exibido quando `identity_state = 'text_only'` com texto: "Sem logo por enquanto? Você pode escolher as cores da loja, se quiser, e clicar em Salvar. O Vendeo vai gerar uma direção visual usando os dados básicos da loja."
- [x] 4.2 Implementar diálogo de confirmação antes de `DELETE /api/store/[id]/logo` com aviso: "Ao remover o logo, ele não ficará disponível para reaplicação pela interface. Você poderá enviar o arquivo novamente quando quiser."
- [x] 4.3 Garantir que o card de orientação e o aviso de remoção não são renderizados em estados incompatíveis (`logo`, `visual_signature`)

## 5. Testes e Validação

- [x] 5.1 Testar orquestrador: aceita apenas as 4 transições permitidas e rejeita `logo → logo`, `logo → VS`, `VS → logo`, `VS → VS`
- [x] 5.2 Testar rotas: `POST /logo`, `DELETE /logo`, `POST /visual-signature/approve`, `DELETE /visual-signature`, `POST /visual-signature/restore`
- [x] 5.3 Testar UI por estado: `text_only`, `logo`, `visual_signature`
- [x] 5.4 Validar manualmente: criar loja nova, salvar Step 2 sem logo/VS, upload logo, remover logo, gerar/aplicar VS, remover VS
