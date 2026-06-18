## 1. Tipos e Metadata

- [ ] 1.1 Expandir `VisualSignatureMetadata` em `src/lib/visual-signature/types.ts` — adicionar `input_snapshot` (10 campos) e `artDirectorOutput` com `content_used`, `visual_elements`, `intended_palette`, `color_usage`
- [ ] 1.2 Criar tipo `RestoreEligibility` com `can_restore`, `drift_fields`, `requires_regeneration`, `reason` (`'ok' | 'critical_drift' | 'missing_metadata'`)

## 2. Geração — content_used + input_snapshot

- [ ] 2.1 No handler `generate-without-logo/route.ts`, após sucesso do `AiImageGenerator.generate()`, extrair JSON do `response.output.message` (content_used, visual_direction, intended_palette) e persistir em `metadata.artDirectorOutput`
- [ ] 2.2 Capturar `input_snapshot` da store no momento da geração (10 campos) e persistir em `metadata.input_snapshot`
- [ ] 2.3 Em retry (prompt simplificado que não retorna JSON), inferir `content_used` por heurística conservadora — todos os campos como `true`

## 3. Approve — identity_state sync

- [ ] 3.1 Em `approve/route.ts`, adicionar `UPDATE stores SET identity_state = 'visual_signature', logo_status = 'generated'` no approval flow
- [ ] 3.2 Garantir que o update ocorra na mesma ordem: arquivar active anterior → ativar nova → setar identity_state → reconciliar profiles

## 4. Profile Reconciliation — função centralizada

- [ ] 4.1 Criar `src/lib/brand-assets/profile-reconciliation.ts` com função `reconcileProfiles(storeId, options)` conforme design D7
- [ ] 4.2 Implementar matriz de compatibilidade: target `without_logo` (VS) marca qualquer outro synced como outdated; target `logo_analysis` marca qualquer outro synced como outdated
- [ ] 4.3 Implementar preservação de fallback: ao remover para `text_only`, profile atual permanece synced
- [ ] 4.4 Implementar edge case: se target já é o synced atual (pós-remove), não marcar como outdated
- [ ] 4.5 Substituir lógicas manuais de outdated/synced no approve handler, POST /logo, DELETE /logo e restore handlers pela chamada a `reconcileProfiles`

## 5. DELETE /visual-signature

- [ ] 5.1 Adicionar handler DELETE em `visual-signature/route.ts`: carregar signature ativa → setar archived → atualizar store (identity_state='text_only', logo_status='explicit_none', preservar attempts) → preservar profile como synced fallback
- [ ] 5.2 Retornar 404 se não houver signature ativa

## 6. GET /visual-signature — histórico

- [ ] 6.1 Evoluir GET `visual-signature/route.ts` para incluir no response: `approved_at` (null se archived ou nunca active), `art_direction`, `restore_eligibility` computado server-side
- [ ] 6.2 Implementar lógica de `restore_eligibility`: comparar `input_snapshot` vs store atual usando `content_used`, retornar `reason` apropriado

## 7. POST /visual-signature/restore

- [ ] 7.1 Criar `visual-signature/restore/route.ts`: validar signature pertence à store, validar identity_state (rejeitar se 'logo'), validar drift
- [ ] 7.2 Implementar drift validation: comparar `input_snapshot` vs current usando `content_used` com as regras da tabela de decisão (name/segment sempre críticos, city/state/slogan condicionais)
- [ ] 7.3 Implementar fluxo sem drift: arquivar active atual → ativar signature → identity_state sync → reconciliar profiles
- [ ] 7.4 Implementar fluxo com profile ausente (draft nunca aprovada): executar `BrandProfilerWithoutLogoService.generate()` antes de ativar
- [ ] 7.5 Garantir que restore não consuma geração (não incrementa visual_signature_attempts)

## 8. POST /logo — validação identity_state

- [ ] 8.1 No início do handler POST em `logo/route.ts`, adicionar validação: se `identity_state = 'visual_signature'`, retornar 409 com `requires_identity_removal`
- [ ] 8.2 Usar `stores.identity_state` como fonte — não o status de assets ou profiles

## 9. POST /logo/restore — validação identity_state

- [ ] 9.1 No handler `logo/restore/route.ts`, adicionar validação: se `identity_state = 'visual_signature'`, retornar 409 com `requires_identity_removal`
- [ ] 9.2 Se `identity_state = 'logo'`, retornar 409 com `requires_logo_removal`
- [ ] 9.3 Só permitir restore quando `identity_state = 'text_only'`

## 10. RejectionContext — propagação

- [ ] 10.1 Em `VisualSignatureApprovalModal`, armazenar `rejectionContext` no estado do modal
- [ ] 10.2 Garantir que ao gerar nova versão da fase "review" (attempts < 3), o `rejectionContext` armazenado seja passado para `generate-without-logo`

## 11. UI Step 2 — identity_state como fonte primária

- [ ] 11.1 Em `store-identity-form.tsx`, refatorar o bloco de identidade visual para usar `identity_state` como fonte primária (não logo_status)
- [ ] 11.2 Implementar estado `visual_signature`: preview da assinatura + botões "Alterar" e "Remover"
- [ ] 11.3 Ocultar drop zone, upload, "Não tenho logo" e "Continuar sem logo" quando identity_state = 'visual_signature'
- [ ] 11.4 Exibir "Assinaturas anteriores" quando houver signatures archived e identity_state ≠ 'visual_signature'
- [ ] 11.5 Garantir que alterações de cor (brand_colors_chosen) sejam permitidas com VS ativa sem disparar drift

## 12. UI — StoreVisualSignatureSection (Remover)

- [ ] 12.1 Em `store-visual-signature-section.tsx`, adicionar botão "Remover" que chama DELETE /visual-signature
- [ ] 12.2 Após remoção bem-sucedida, atualizar estado local para text_only (drop zone, botões de upload/assinatura reaparecem)

## 13. UI — Modal de Histórico/Restore de VS

- [ ] 13.1 Criar `visual-signature-history-modal.tsx` (separado de `logo-restore-modal.tsx`)
- [ ] 13.2 Listar signatures archived via GET /visual-signature, exibindo thumbnail, data, direção visual, paleta
- [ ] 13.3 Usar `restore_eligibility.reason` para habilitar/desabilitar botão "Restaurar" com tooltips apropriados
- [ ] 13.4 Implementar fluxo "Alterar": chamar generate-without-logo → abrir VisualSignatureApprovalModal → se aprovar, trocar active

## 14. Validação

- [ ] 14.1 Executar `npm run typecheck` e `npm run lint` — sem erros
- [ ] 14.2 Validar approve: aprovar VS → `stores.identity_state` = `'visual_signature'`, `logo_status` = `'generated'`
- [ ] 14.3 Validar remove VS: DELETE /visual-signature → signature archived, identity_state = `'text_only'`, profile preservado como synced
- [ ] 14.4 Validar restore VS sem drift: signature archived → active, identity_state = `'visual_signature'`, profiles reconciliados
- [ ] 14.5 Validar restore VS com drift: bloqueado com `requires_regeneration: true`, `reason: 'critical_drift'`
- [ ] 14.6 Validar restore VS sem metadata (pré-feature): bloqueado com `reason: 'missing_metadata'`
- [ ] 14.7 Validar POST /logo bloqueado com VS ativa: 409 + `requires_identity_removal`
- [ ] 14.8 Validar POST /logo/restore bloqueado em `identity_state = 'logo'`: 409 + `requires_logo_removal`
- [ ] 14.9 Validar POST /logo/restore bloqueado em `identity_state = 'visual_signature'`: 409 + `requires_identity_removal`
- [ ] 14.10 Validar UI Step 2: visual_signature mostra preview + Alterar/Remover, oculta drop zone/upload; text_only mostra drop zone + botões; logo mostra preview + Remover
- [ ] 14.11 Validar restore_eligibility no GET: signature sem drift → `reason: 'ok'`; com drift → `reason: 'critical_drift'`; sem metadata → `reason: 'missing_metadata'`
- [ ] 14.12 Validar rejectionContext propagado da fase feedback para generate na fase review
