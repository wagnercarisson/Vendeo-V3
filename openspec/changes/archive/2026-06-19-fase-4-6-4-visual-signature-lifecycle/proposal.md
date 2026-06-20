## Why

O lifecycle da assinatura visual (visual_signature) está incompleto: o approve não seta `identity_state`, não há rota de remoção nem de restore, a geração não persiste `content_used` + `input_snapshot` para validação de drift, e as transições entre estados visuais (text_only, logo, visual_signature) não reconciliam `store_brand_profiles` corretamente. Sem estas peças, o sistema não consegue gerenciar o ciclo de vida completo de uma assinatura visual — gerar, aprovar, rejeitar com feedback, alterar, remover, restaurar e detectar drift crítico.

## What Changes

- **POST /api/store/[id]/visual-signature/approve**: Adicionar `identity_state = 'visual_signature'` e `logo_status = 'generated'` na store. Atualmente o approve não seta estes campos, deixando a UI inconsistente.
- **POST /api/store/[id]/visual-signature/generate-without-logo**: Extrair JSON do `response.output.message` (content_used, visual_direction, intended_palette) e persistir em `metadata.artDirectorOutput`. Salvar `input_snapshot` dos dados da store no momento da geração. Em retry (prompt simplificado sem JSON), inferir content_used por heurística conservadora (todos os campos como usados).
- **DELETE /api/store/[id]/visual-signature** (NOVO): Arquiva signature ativa (status → 'archived'), seta `identity_state = 'text_only'`, `logo_status = 'explicit_none'`. Preserva `visual_signature_attempts`. Mantém o brand profile `without_logo` da assinatura como `synced` — é um fallback intencional de direção visual em text_only. O profile só vira `outdated` quando uma nova identidade/direção assumir (upload de novo logo ou aprovação de nova VS).
- **GET /api/store/[id]/visual-signature** (Evoluído): Serve como listagem/histórico de assinaturas visuais — adiciona `approved_at`, `art_direction` (com `content_used`), metadados de geração ao response.
- **POST /api/store/[id]/visual-signature/restore** (NOVO): Restaura signature archived como active com validação de drift crítico (input_snapshot + content_used vs store atual). Se houver drift, bloqueia restore e orienta nova geração. Reconcilia brand_profiles (marca synced incompatíveis como outdated antes de ativar o profile da assinatura restaurada).
- **POST /api/store/[id]/logo** (Alterado): Recusar upload quando `identity_state = 'visual_signature'`. Usuário deve remover a assinatura visual ativa antes de enviar logo. Reconciliar brand_profiles incompatíveis ao ativar logo_analysis como synced.
- **DELETE /api/store/[id]/logo**: Validar que o comportamento da fase 4.6.3 está correto — assets arquivados, `logo_analysis` mantido como `synced` fallback em text_only, `active_logo_asset_id` preservado. Ajustar apenas se o comportamento atual divergir do especificado.
- **UI Step 2**: Usar `identity_state` como fonte primária de estado visual. Quando `identity_state = 'visual_signature'`: exibir preview da assinatura, botões "Alterar" e "Remover", ocultar drop zone, upload, "Não tenho logo" e "Continuar sem logo". Quando `identity_state ≠ 'visual_signature'`: exibir "Assinaturas anteriores" se houver signatures archived.
- **Cores com VS ativa**: Alterações em `brand_colors_chosen` continuam permitidas com VS ativa. Cores não invalidam a assinatura nem disparam drift/regeneração — são contexto leve em campanhas, não na assinatura em si.
- **Rejeição com feedback**: Garantir que `rejectionContext` coletado na fase "feedback" do modal de aprovação seja propagado para o `generate()` na fase "review".
- **Transições de estado**: Ao ativar uma nova identidade (aprovar VS, upload de logo), profiles incompatíveis viram `outdated`. Ao remover logo ou VS para `text_only`, o profile anterior **permanece** `synced` como fallback de direção visual — ele só vira `outdated` quando uma nova identidade assumir. Use `stores.identity_state` como fonte primária para todas as validações de transição, não o status de brand profiles.
- **Nomenclatura de estado**: Para evitar ambiguidade, adotar a terminologia do alinhamento: `identity_state` (estado da loja em `stores`), `store_visual_signatures.status` (ativo da assinatura visual), `store_brand_profiles.status` (profile que governa a direção das campanhas), `source='without_logo' + visual_signature_id` (profile derivado de VS). A validação de `POST /logo` usa `stores.identity_state` — não o status do profile.

## Capabilities

### New Capabilities
- `visual-signature-remove`: DELETE /api/store/[id]/visual-signature — arquiva signature ativa, transiciona identity_state para text_only, reconcilia brand_profiles, preserva contador de tentativas
- `visual-signature-restore`: POST /api/store/[id]/visual-signature/restore — restaura signature archived como active com validação de drift (input_snapshot + content_used), reconciliação de brand_profiles, sem consumir geração

### Modified Capabilities
- `visual-signature-approval`: approve agora seta `identity_state = 'visual_signature'` e `logo_status = 'generated'` na store, corrigindo UI inconsistente. RejectionContext deve ser propagado da fase feedback para generate na fase review.
- `store-visual-signature`: GET evoluído para servir como histórico/listagem com approved_at, art_direction, content_used. Geração persiste content_used + input_snapshot no metadata. Metadata enriquecido com input_snapshot e artDirectorOutput.
- `store-identity-state`: Transições de estado — ao ativar nova identidade (aprovar VS, upload de logo), marcar synced incompatíveis como outdated. Ao remover para text_only, o profile anterior permanece synced como fallback de direção visual até nova identidade assumir. identity_state='visual_signature' como estado canônico governa UI e validações.
- `store-identity-ui`: Step 2 adaptado para o cenário visual_signature ativo (preview + Alterar/Remover, ocultar drop zone/upload), estado pós-archivar (drop zone + "Assinaturas anteriores"), e modal de restore separado do de logo. Alterações de cor (`brand_colors_chosen`) continuam permitidas com VS ativa — não disparam drift nem regeneração.
- `logo-upload`: POST /logo recusa upload quando identity_state='visual_signature'. Reconciliar brand_profiles incompatíveis ao ativar logo_analysis como synced.
- `logo-restore`: Restore de logo permitido apenas quando `identity_state = 'text_only'`. Bloqueado se `identity_state = 'visual_signature'` (requer remover VS) ou `identity_state = 'logo'` (requer remover logo ativo). A regra usa `stores.identity_state` como fonte primária — toda transição passa por text_only.

## Impact

- **Routes**: `src/app/api/store/[id]/visual-signature/approve/route.ts` — +identity_state sync. `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — +content_used + input_snapshot. `visual-signature/route.ts` — evoluir para adicionar DELETE ao handler existente. Novo arquivo `visual-signature/restore/route.ts` (POST). `src/app/api/store/[id]/logo/route.ts` — validação identity_state no POST.
- **Services**: StoreIdentityArtDirectorService — extrair JSON do response.output. BrandProfilerWithoutLogoService — inalterado (já executa análise pós-aprovação).
- **UI Components**: `store-identity-form.tsx` (Step 2) — novos estados condicionais para visual_signature ativo. Modal de restore de assinatura visual (separado de logo-restore-modal.tsx).
- **Types**: `VisualSignatureMetadata` — input_snapshot + artDirectorOutput.content_used. `StoreBrandProfileStatus` — transições de outdated/synced conforme identity_state.
- **Database**: Nenhuma migration nova. `store_visual_signatures.metadata` já existe e é jsonb. `stores.identity_state` e `stores.logo_status` já existem.
- **Delta specs**: `visual-signature-approval`, `store-visual-signature`, `store-identity-state`, `store-identity-ui`, `logo-upload`, `logo-restore`, `visual-signature-remove` (novo), `visual-signature-restore` (novo).
