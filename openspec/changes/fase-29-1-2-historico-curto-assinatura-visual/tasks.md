## 1. visual-signature-history-modal.tsx — Reescrever componente

- [ ] 1.1 Atualizar interface Props: `{ isOpen, onClose, storeId, identityState: string | null, onApplied?: () => void }`
- [ ] 1.2 Implementar carregamento via `GET /api/store/[id]/visual-signature?limit=6&offset=0` com estados loading, error, empty
- [ ] 1.3 Implementar filtro client-side: `signatures.filter(s => s.restore_eligibility?.reason === "ok")`
- [ ] 1.4 Implementar grid 3 colunas (mesmo layout do review phase) com card por VS: preview, badge de status ("Ativa", "Arquivada", "Rascunho"), botão de ação
- [ ] 1.5 Implementar ação condicional: `canApply(identityState)` — se `text_only` → "Aplicar" habilitado (chama POST /approve); senão → bloqueado com tooltip/mensagem (D3)
- [ ] 1.6 Implementar caso especial: `sig.status === "active"` → sem botão de ação, apenas badge "Ativa"
- [ ] 1.7 Implementar paginação: botão "Ver versões anteriores" quando `apiTotal > rawSignaturesLoaded` e segundo lote ainda não foi carregado; some após carregar segundo lote (máx. 12 raw) (D4)
- [ ] 1.8 Implementar `handleApply(signatureId)` → POST /approve sem reserva de crédito (D5), com tratamento de erro por drift
- [ ] 1.9 Chamar `onApplied()` após sucesso do approve para que parent recarregue estado

## 2. visual-signature-approval-modal.tsx — Adicionar onOpenGallery

- [ ] 2.1 [ADICIONAR] Prop opcional `onOpenGallery?: () => void` na interface Props do componente
- [ ] 2.2 [MODIFICAR] Placeholder "Galeria completa em breve" (linha ~545-549): quando `onOpenGallery` presente E `totalSignatures > 6`, exibir `<button type="button">Ver versões recentes</button>` que chama `onOpenGallery()` com estilo `text-accent-blue hover:text-accent-blue/80 underline font-body transition-colors duration-200`
- [ ] 2.3 Manter placeholder não clicável original quando `onOpenGallery` não for passada (backward compatibility)

## 3. store-visual-signature-section.tsx — Bridge ApprovalModal → HistoryModal

- [ ] 3.1 [ADICIONAR] Callback `handleOpenGallery`: `() => { setShowApprovalModal(false); setShowHistoryModal(true); }` usando `useCallback`
- [ ] 3.2 [ADICIONAR] Passar `onOpenGallery={handleOpenGallery}` ao `VisualSignatureApprovalModal`
- [ ] 3.3 Manter botão "Assinaturas anteriores" existente (já abre HistoryModal diretamente)
- [ ] 3.4 Passar `identityState` ao `VisualSignatureHistoryModal`

## 4. store-identity-form.tsx — Bridge ApprovalModal → HistoryModal

- [ ] 4.1 [ADICIONAR] State `showHistoryModal` (boolean) + render condicional do `VisualSignatureHistoryModal`
- [ ] 4.2 [ADICIONAR] Callback `handleOpenGallery` similar ao section: fecha ApprovalModal, abre HistoryModal
- [ ] 4.3 [ADICIONAR] Passar `onOpenGallery={handleOpenGallery}` ao `VisualSignatureApprovalModal`
- [ ] 4.4 [ADICIONAR] Passar `identityState` ao `VisualSignatureHistoryModal`
- [ ] 4.5 [ADICIONAR] `onApplied` callback no HistoryModal que recarrega estado da loja

## 5. approve/route.ts — Validar drift também para draft

- [ ] 5.1 [ALTERAR] Condição de drift validation: `if (signature.status === 'archived')` → `if (signature.status !== 'active')` (aproximadamente linha 406)
- [ ] 5.2 Garantir que o fluxo de aprovação normal (imediatamente após geração, draft recém-criado) continua passando sem bloqueio — snapshot acabou de ser salvo, validação de drift retorna `has_drift = false`

## 6. Atualizar spec — visual-signature-restore

- [ ] 6.1 [ATUALIZAR] `openspec/specs/visual-signature-restore/spec.md` — linha 20: `'visual_signature'` passa de PERMITIDO para BLOQUEADO com `requires_vs_removal: true` e mensagem "Remova a assinatura ativa antes de aplicar outra versão."

## 7. Testes

- [ ] 7.1 Testar filtro e exibição (5 testes): API retorna 8 VS (6 ok, 2 critical_drift) → exibe 6; API retorna 8 VS (todas ok) → exibe 8; API retorna 0 VS → empty state; API retorna erro → error state; Loading → spinner
- [ ] 7.2 Testar ações por identidade (6 testes): `identity_state = visual_signature` → bloqueado com tooltip; `text_only` → habilitado; VS active → sem ação, badge "Ativa"; clicar "Aplicar" em archived → chama POST /approve; clicar "Aplicar" em draft → chama POST /approve; POST /approve com draft sem drift → ativa com sucesso
- [ ] 7.3 Testar backend — revalidação de drift em draft (4 testes): draft recém-gerado (snapshot = current) → 200; draft sem drift → 200; draft COM drift → 409; draft sem input_snapshot → 409 missing_metadata
- [ ] 7.4 Testar paginação (4 testes): total = 6 → sem "Ver mais"; total = 7 → "Ver versões anteriores" visível; clicar → carrega +6, total = 12, botão some; total = 20 → botão some após 12 itens
- [ ] 7.5 Testar integração com ApprovalModal (3 testes): `onOpenGallery` não passada → placeholder não aparece; `onOpenGallery` passada + total > 6 → link visível; clicar link → `onOpenGallery` é chamado
- [ ] 7.6 Testes de regressão (4+ testes): build, typecheck, lint, vitest run

## 8. Verificação final

- [ ] 8.1 Rodar `npm run build`
- [ ] 8.2 Rodar `npm run typecheck`
- [ ] 8.3 Rodar `npm run lint`
- [ ] 8.4 Rodar `npx vitest run`
- [ ] 8.5 UAT: fluxo ApprovalModal → "Ver versões recentes" → HistoryModal → aplicar VS com text_only → sucesso
- [ ] 8.6 UAT: fluxo HistoryModal com VS ativa → botão bloqueado → instrução "Remova a assinatura ativa" visível
- [ ] 8.7 UAT: aprovar VS recém-gerada (fluxo normal no ApprovalModal com draft) → drift não bloqueia (regressão do backend fix)
