## 1. Trackings — Renumeração F42/F43 (D1 runbook) + pré-requisito

- [ ] 1.1 **Pré-requisito:** confirmar F42 concluída nos trackings (`openspec list` vazio, 20/20 plans, migration 42-12 aplicada) e que o rodapé de `.planning/ROADMAP.md` **não mantenha resíduo "F42 ... em PLANEJAMENTO"** — D1
- [ ] 1.2 `ROADMAP.md` (raiz): linha 42 → Signup **concluída**; linha 43 "Stripe / Monetização Pública" → **"Revisão do Brief Pré-Geração | v1.5 | 0/0 | ○ Pending"**; **remover linha numerada de Stripe** e registrar em seção "Deferred / Pós-beta / Monetização" como "Monetização pública / Stripe (v1.7+, iniciativa diferida não numerada)"; menções "F43 (Stripe)" → "Monetização/Stripe (diferida)"; bullet da F43 no `<details open>` do v1.5 — D1
- [ ] 1.3 `.planning/ROADMAP.md`: nota "Phase numbering" (F42 = Signup concluída v1.5; F43 = Revisão do Brief v1.5; Monetização/Stripe sai da numeração v1.7+ diferida); linha 43 "Stripe" → **"Revisão do Brief Pré-Geração | v1.5 | 0/0 | ○ Pending"**; remover linha de Stripe e registrar a iniciativa diferida; notas/menções "F43 (Stripe)" em Dependencies → "Monetização/Stripe (diferida)"; Dependency Graph; seção "### Phase 43 — Revisão do Brief Pré-Geração"; rodapé "Last updated" — D1
- [ ] 1.4 `.planning/STATE.md`: frontmatter `current_phase: 43`; "Next Phases" (F42 → ✓ Completed Signup v1.5; F43 → ○ In progress Revisão do Brief v1.5); **remover a linha "F43 = Stripe"** e registrar a iniciativa diferida fora da numeração; **marcar checkboxes UAT 20.5–20.15 da F42** (cenários validados); "Current Position" + "Last updated" — D1
- [ ] 1.5 `.planning/PROJECT.md`: "Stripe ... adiado para F43 (v1.7, pós-beta)" → "Monetização pública / Stripe: iniciativa diferida v1.7+ (sem fase numerada)"; adicionar linha da F43/Revisão do Brief; rodapé — D1
- [ ] 1.6 `.planning/REQUIREMENTS.md`: seção v1.7 "Stripe será implementada como F43/v1.7" → "Monetização pública / Stripe: iniciativa diferida v1.7+ (sem fase numerada)" — D1
- [ ] 1.7 `.planning/MILESTONES.md`: "Stripe / Monetização Pública diferido para v1.7 (F43)" → "Monetização pública / Stripe diferido para v1.7+ (sem fase numerada)" — D1
- [ ] 1.8 Verificação de consistência: grep-consistência "F43 (Stripe)"/"Phase 43 (Stripe)"/"Stripe ... F43" nos 6 trackings → zero resíduos (padrão F41-01/F42-01) — D1
- [ ] 1.9 Sequência atualizada nos trackings: F42 → F43 → **F44 (Temas)** → F37 → [catálogo] → Monetização/Stripe (diferida) — a linha F44 é criada pelo runbook da própria F44, NÃO por esta fase — D1

## 2. Helpers puros — prepareCampaignImages + buildCampaignGenerationBody (D3/D4)

- [ ] 2.1 `src/components/flow/use-campaign-form.ts`: tipo `PreparedCampaignImage` (id, role, source, mimeType: "image/jpeg", dataUrl) + helper puro `prepareCampaignImages(fields: CampaignFormFields): Promise<PreparedCampaignImage[]>` reutilizando `compressImage` (`:13-94`, HEIC/EXIF via `createImageBitmap`), normalizando `mimeType` para `image/jpeg`, preservando `role`/`source`, e cobrindo itens restaurados de draft com `dataUrl` (sem re-comprimir) — D3
- [ ] 2.2 Helper puro `buildCampaignGenerationBody(fields, preparedImages, storeId, options?: { inputValidationOverride?: { productImageCheck: "brief_review_confirmed" } }): Record<string, unknown>` — mesmo shape do body atual (`:891-917`) usando os mesmos derivados da revisão: `buildValidityDisplayText`, `buildMandatoryArtworkText`, `inferIntent`/badge/preços, `productImages[]` (sem id) ou `productImageDataUrl` legado, e `inputValidationOverride` via options — D4
- [ ] 2.3 Extrair do `handleSubmit` atual a lógica de compressão para reuso via `prepareCampaignImages` (o submit deixa de re-comprimir — D3); `handleSubmit` passa a receber/aceitar `preparedImages` no caminho da revisão — D2/D3/D4

## 3. Hook — estado reviewMode + snapshot travado (D2/D3/D4)

- [ ] 3.1 `use-campaign-form.ts`: novo estado `reviewMode` (ou `step: "form" | "review"`); exposição no retorno do hook (`enterReview`/`exitReview`/`confirmReview` ou equivalente) — D2
- [ ] 3.2 "Revisar e gerar": entrada em revisão **somente** com form válido (gate `isValid`/validação existente); roda `prepareCampaignImages` com estado "Preparando imagens..."; falha → volta ao form com erro claro (padrão `submitError`) — D2/D3
- [ ] 3.3 "Voltar e editar": retorna ao form preservando `fields`/`touched`/`fieldErrors` (nada perdido) — D2
- [ ] 3.4 "Confirmar e gerar campanha": **trava o snapshot revisado** (congela `fields` + `preparedImages`; body imutável; desabilita interação) e monta o body via `buildCampaignGenerationBody(frozenFields, frozenPrepared, storeId, { inputValidationOverride: { productImageCheck: "brief_review_confirmed" } })` e chama `consumeStream` — D2/D4/D5
- [ ] 3.5 Fluxo pós-confirmação inalterado: `isSubmitting` → `GenerationProgress`, 409 de conflito (com `user_confirmed_continue` via `handleConflictContinue`), navegação `/campanhas/[id]` — D2
- [ ] 3.6 Sem imagens utilizáveis (nem `file`, nem `dataUrl`, nem restaurada) → "Revisar e gerar" bloqueado com mensagem de imagem obrigatória — D2

## 4. UI — tela de revisão do brief (campaign-brief-review) (D6/D7)

- [ ] 4.1 `campaign-input-form.tsx`: botão principal vira **"Revisar e gerar"** (substitui "Criar Campanha"); `CampaignInputForm` renderiza a tela de revisão quando `reviewMode` ativo (mesmo padrão do `isSubmitting` → `GenerationProgress`) — D2
- [ ] 4.2 Componente de revisão (novo, no fluxo do form): **loja/marca ativa no topo** (`StoreIdentityBlock`) — D6
- [ ] 4.3 Seções visuais separadas: **Produto** (nome, descrição se houver), **Oferta** (intent via `inferIntent`, badge, preço original se houver, preço com desconto, validade formatada via `buildValidityDisplayText`) — D6
- [ ] 4.4 Seção **Imagens**: thumbnails do payload final (D3) com rótulos **"Principal"** (primary) e **"Referência"** (referências autorizadas); preview **sem recorte** (`object-contain`, célula `aspect-square`) — D6/D7
- [ ] 4.5 Seção **Avisos**: aviso "imagem meramente ilustrativa" (checkbox) + texto obrigatório (`buildMandatoryArtworkText`) — D6
- [ ] 4.6 Seção **Custo**: **"Vai consumir X crédito(s)"** + saldo; "Confirmar" bloqueado com custo off/indisponível/saldo insuficiente (mesma lógica `submitDisabled`) — D6
- [ ] 4.7 Seção **Tema**: **slot opcional reservado** — não renderiza enquanto `themeId` null (preparação F44) — D6
- [ ] 4.8 Ações: "Voltar e editar" e "Confirmar e gerar campanha" com touch ≥ 44px, `label`/`aria`, loading no confirmar; microcopy "Revise textos, preços e imagens antes de publicar: a IA pode cometer erros."; telas estreitas empilham sem scroll horizontal — D7
- [ ] 4.9 Estados: "Preparando imagens..." (D3), desabilitação durante a confirmação (snapshot travado), erro de preparação claro — D3/D7

## 5. Schema + serviço de validação — novo literal brief_review_confirmed (D5)

- [ ] 5.1 `src/lib/image-generation/schema.ts:59-63`: `inputValidationOverride.productImageCheck` → `z.union([z.literal("user_confirmed_continue"), z.literal("brief_review_confirmed")]).optional()` (`.strict()` preservado) — D5
- [ ] 5.2 `src/lib/image-generation/services/input-validation-service.ts:43`: tipo do override aceita o novo literal (`validate` já pula para override truthy, `:47-49` — sem mudança de lógica) — D5
- [ ] 5.3 `ValidationContext.overrides.productImageCheck` (`schema.ts:193`) aceita `"brief_review_confirmed" | "user_confirmed_continue"` — D5

## 6. Serviço — fase input_validation skipped (D5)

- [ ] 6.1 `image-generation-service.ts` Phase 1 (`:162-277`): quando o override (`brief_review_confirmed` OU `user_confirmed_continue`) pula a IA, emitir `input_validation` com **obrigatoriamente** `status: "skipped"` (precedente `emitSkipped` `:141`; detail opcional "Brief confirmado pelo usuário"/"Validação dispensada") — nunca `running → complete` nem `complete` com detail (`emitHuman` `:163`/`emitComplete` `:276` hoje incondicionais) — D5
- [ ] 6.2 `GenerationProgress`: tratar `status: "skipped"` na fase `input_validation` (indicador de skip, mensagem "Brief confirmado pelo usuário"/"Validação dispensada") — D5
- [ ] 6.3 Sem evento `campaign_input_validation` quando o override pula (já garantido por `validationCallMade` `:188-190`) — regressão coberta nos testes — D5

## 7. Migration — feature_flags + auditoria (D5)

> **Ordem de deploy (D5):** a migration (`feature_flags` + seed + CHECKs + RPC) deve ser aplicada **antes** do código que a consome (serviço de leitura, rota com normalização da flag, tela admin). Aplicar a migration primeiro; o fallback de leitura (`enabled=false`) segura a geração em ambientes ainda sem a tabela.

- [ ] 7.1 Migration idempotente: tabela `feature_flags` (`id` UUID PRIMARY KEY DEFAULT gen_random_uuid(), `key` TEXT UNIQUE NOT NULL, `enabled` BOOLEAN NOT NULL DEFAULT false, `description` TEXT, `updated_by` UUID NULL REFERENCES auth.users(id), `updated_at` TIMESTAMPTZ DEFAULT now()) — D5
- [ ] 7.2 Seed da flag `force_brief_vision_check` (`enabled=false`, descrição administrativa do alinhamento) — D5
- [ ] 7.3 RPC `admin_update_feature_flag` (ou equivalente) idempotente/atômico: valida `key`/`enabled`/`reason` obrigatório, atualiza `enabled`/`updated_by`/`updated_at` e registra auditoria na mesma transação — `target_id = feature_flags.id` (UUID NOT NULL existente) + `metadata.key` — D5
- [ ] 7.4 **Estender CHECKs de `admin_audit_log`** (padrão F33/F42): nova `action 'feature_flag_update'` e novo `target_type 'feature_flag'` — `ALTER TABLE ... DROP/ADD CONSTRAINT` preservando valores existentes — D5
- [ ] 7.5 Paridade `config.toml` inalterada (sem mudança de configuração do Supabase — a flag é em banco) — D5

## 8. Rota — skip + normalização ponta a ponta da flag (D5)

- [ ] 8.1 `route.ts:338`: regra atual (`if (!parsed.data.inputValidationOverride?.productImageCheck)`) já pula para qualquer override truthy — `brief_review_confirmed` coberto sem mudança de lógica — D5
- [ ] 8.2 Serviço de leitura da flag `force_brief_vision_check` (novo, server-only, padrão `OperationCostService`/`EconomicParameterService`): retorna `enabled` da `feature_flags` (por `key`); **fallback de leitura → `false`** (não derruba geração, log warning); env var `VENDEO_FORCE_BRIEF_VISION_CHECK=true` como fail-safe emergencial (pode forçar `true`) — D5
- [ ] 8.3 `route.ts`: com a flag **ligada**, **normalizar um `effectiveParsedData`/`effectiveCampaignInput`** (remover `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream (`:338`) e usar o **mesmo input normalizado** para a checagem, construir o brief e chamar `imageService.generateImage(...)`; `user_confirmed_continue` **nunca removido** — D5

## 9. Admin — tela "Controles operacionais" (D5)

> **Utilizável apenas após a migration aplicada** no ambiente (tabela/CHECKs/RPC) — até lá, o fallback de leitura (`enabled=false`) mantém o fluxo padrão.

- [ ] 9.1 Rota admin route de update (`PUT /api/admin/feature-flags` ou equivalente) protegida por `requireAdmin`, zod (key/enabled/reason ≥ 1), motivo obrigatório, auditoria + idempotência via operationId (padrão `operation-costs`/`economic-parameters`) — D5
- [ ] 9.2 Página admin "Controles operacionais" (seção "Validação IA do brief antes da geração"): exibe `force_brief_vision_check` com descrição, estados "Desligada — padrão recomendado"/"Ligada — força validação IA além da revisão humana", motivo obrigatório no form, persistência + reload — D5
- [ ] 9.3 Navegação admin (link/entrada na seção) — padrão do admin existente — D5

## 10. Testes — Hook / form (D2/D3/D4/D6) — 10 testes

- [ ] 10.1 Teste 1: "Revisar e gerar" com form inválido → não entra em revisão (erros exibidos) — D2
- [ ] 10.2 Teste 2: form válido → entra em revisão; "Voltar e editar" preserva fields/touched (nada perdido) — D2
- [ ] 10.3 Teste 3: entrada em revisão dispara `prepareCampaignImages` (compressão antes; estado "Preparando imagens...") — D3
- [ ] 10.4 Teste 4: revisão mostra o payload final — HEIC/EXIF/compressão aplicados (`mimeType: image/jpeg`, dataUrl) — D3
- [ ] 10.5 Teste 5: falha de compressão na revisão → volta ao form com erro claro — D3
- [ ] 10.6 Teste 6: "Confirmar e gerar campanha" trava o snapshot (body imutável; sem edição durante geração) — D2
- [ ] 10.7 Teste 7: body via `buildCampaignGenerationBody` — valores derivados idênticos ao exibido (validade, aviso, intent, badge, preços) — D4
- [ ] 10.8 Teste 8: body carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"` no caminho confirmado — D5
- [ ] 10.9 Teste 9: confirmar com custo desativado/indisponível/saldo insuficiente → bloqueado (mesma lógica do form) — D6
- [ ] 10.10 Teste 10: sem imagens utilizáveis / restauradas → revisão bloqueada com mensagem de imagem obrigatória — D2

## 11. Testes — UI do resumo (D6/D7/D3) — 6 testes

- [ ] 11.1 Teste 11: seções Produto/Oferta/Imagens/Avisos/Custo renderizam com os valores do brief — D6
- [ ] 11.2 Teste 12: loja/marca ativa no topo; rótulos "Principal"/"Referência" (referências autorizadas) nas thumbnails — D6
- [ ] 11.3 Teste 13: "Vai consumir X crédito(s)" + saldo exibidos; Tema não renderiza (themeId null) — slot reservado p/ F44 — D6
- [ ] 11.4 Teste 14: botões "Voltar e editar" e "Confirmar e gerar campanha" com touch ≥ 44px e a11y — D7
- [ ] 11.5 Teste 15: estados — "Preparando imagens...", loading no confirmar, erro de preparação — D3/D7
- [ ] 11.6 Teste 16: preview das imagens **sem recorte** (`object-contain`, célula aspect-square) em telas estreitas — D7

## 12. Testes — Backend / schema / rota / serviço (D5) — 7 testes

- [ ] 12.1 Teste 17: Zod aceita `brief_review_confirmed`; rejeita valor desconhecido (`.strict()`) — D5
- [ ] 12.2 Teste 18: rota com `brief_review_confirmed` → **pula** a IA de visão (sem `campaign_input_validation`) — D5
- [ ] 12.3 Teste 19: rota com `user_confirmed_continue` → pula (comportamento atual preservado) — D5
- [ ] 12.4 Teste 20: rota sem override → validação IA roda (rede de segurança) — D5
- [ ] 12.5 Teste 21: flag `force_brief_vision_check` **desligada** → `brief_review_confirmed` pula nos dois pontos (rota pré-stream + Phase 1) — D5
- [ ] 12.6 Teste 22: flag `force_brief_vision_check` **ligada** → rota **normaliza** o input (remove `brief_review_confirmed` **antes** da checagem pré-stream); **pré-stream e Phase 1 do serviço validam**; `user_confirmed_continue` não é removido — D5
- [ ] 12.7 Teste 23: `ImageGenerationService` com override (`brief_review_confirmed` ou `user_confirmed_continue`) → fase `input_validation` emitida com **obrigatoriamente** `status: "skipped"` (detail opcional "Brief confirmado pelo usuário"/"Validação dispensada"), sem chamada de IA real e sem "complete" falso — D5

## 13. Testes — Admin da flag (D5) — 3 testes

- [ ] 13.1 Teste 24: tela de admin ("Controles operacionais") exibe `force_brief_vision_check` (`feature_flags`) com descrição e estados; alteração com **motivo obrigatório** persistida (`enabled`, `updated_by`, `updated_at`) — D5
- [ ] 13.2 Teste 25: alteração da flag registra auditoria — `admin_audit_log` com `action: "feature_flag_update"`, `target_type: "feature_flag"`, `target_id` = `feature_flags.id` (UUID NOT NULL existente), `metadata { key, old_value, new_value, reason }` (respeita constraints/CHECK existentes) — D5
- [ ] 13.3 Teste 26: **fallback de leitura** — falha ao ler a flag **não bloqueia geração** → `enabled=false` (fluxo padrão pula vision), log de warning/erro; env var emergencial pode forçar `true` — D5

## 14. Regressão e co-migração de fixtures (D2–D7)

- [ ] 14.1 `use-campaign-form-submit-error.test.ts` co-migrado — submit agora passa pela revisão — D2
- [ ] 14.2 `use-campaign-form-navigation.test.ts` co-migrado — fluxo revisão → confirmação → `/campanhas/[id]` — D2
- [ ] 14.3 `use-campaign-form-product-images.test.ts` co-migrado — `prepareCampaignImages` antes da revisão — D3/D4
- [ ] 14.4 `use-campaign-form-validity.test.ts` / `use-campaign-form-notice.test.ts` co-migrados — derivados via `buildCampaignGenerationBody` — D4
- [ ] 14.5 Fixtures de `route.test.ts` atualizadas para o novo literal `brief_review_confirmed` — D5
- [ ] 14.6 `image-generation-service.test.ts` co-migrado — fase `input_validation` `skipped` quando override pula — D5
- [ ] 14.7 Regressão: fluxo de geração completo (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterado** para o payload sem override — D5
- [ ] 14.8 Verificar `npx vitest run` com suíte completa (novos + co-migrados passando) — D2–D7

## 15. Verificação (gates + UAT)

- [ ] 15.1 `npx vitest run` — zero falhas (novos + existentes + co-migrados) — D2–D7
- [ ] 15.2 `npm run typecheck` — zero erros
- [ ] 15.3 `npm run lint` — zero erros
- [ ] 15.4 `npm run build` — build bem-sucedido
- [ ] 15.5 UAT local: form → "Revisar e gerar" → resumo correto (produto/oferta/imagens/avisos/custo/loja) → "Voltar e editar" sem perda — D2/D6
- [ ] 15.6 UAT local: imagem HEIC (celular) → revisão mostra o JPEG final comprimido (mesma orientação) — D3
- [ ] 15.7 UAT local **mobile real/estreito (320px/375px)**: revisão sem scroll horizontal; botões "Confirmar"/"Voltar" sempre acessíveis; Topbar não cobre conteúdo; preview sem recorte; confortável no novo modelo de scroll/layout — D7
- [ ] 15.8 UAT local: "Confirmar e gerar campanha" → geração ocorre sem a etapa de validação vision; `GenerationProgress` mostra `input_validation` como `skipped`/"Brief confirmado pelo usuário" — D5
- [ ] 15.9 UAT local: flag administrativa `force_brief_vision_check` **ligada na tela de admin** → validação vision volta a rodar mesmo com confirmação (rota normaliza o input antes da checagem; rota e serviço validam); alteração com motivo, auditada e sem redeploy — D5
- [ ] 15.10 UAT local: **fallback de leitura** — banco/flag indisponível → geração segue sem bloquear (validação vision pulada), log de warning — D5
- [ ] 15.11 UAT local: sem override (ex.: requisição manual) → validação vision roda normalmente — D5
- [ ] 15.12 UAT local: saldo insuficiente / custo desativado → confirmar bloqueado com mensagem clara — D6
- [ ] 15.13 UAT local: geração bem-sucedida → `/campanhas/[id]` com arte e kit de publicação (fluxo atual) — D2