# Tasks — Fase 47: Catálogo e Seleção de Modelos (Admin)

> Divide a implementação em **plans pequenos (47-01..47-08)** por ondas. Executar somente após aprovação dos artefatos. Depende do Change A (`openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`) estar concluído. Cada plano mantém os 4 gates verdes (vitest/typecheck/lint/build). Specs: `specs/ai-model-catalog`, `specs/ai-model-selection`, `specs/admin-ai-model-selection`, `specs/ai-model-registry`, `specs/ai-model-pricing`. Design: `design.md`.
>
> **Ordem de migration (D6/D-Migration):** criar e testar a migration **localmente** (47-01) → implementar e rodar **UAT local** (47-02..47-08) → **aplicar no remoto** → **deploy do código** → **ajustar env-vars remotas somente se ainda existirem**. Nenhuma task desta fase aplica a migration no remoto antes do UAT local.

## 1. Plan 47-01 — Trackings e migration local (onda 1)

- [ ] 1.1 Registrar F47 nos runbooks de trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `AGENTS.md`); grep-verificação de nomenclatura com zero resíduos; confirmar que as referências da F46 apontam para o caminho arquivado (`openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`)
- [ ] 1.2 Criar migration **local**: tabela `ai_model_catalog` (`capability`, `segment`, `provider`, `model`, `protocol`, `label`, `status`, `source_note`, `validated_at`, timestamps; `UNIQUE (capability, provider, model, protocol)`; RLS service_role) — design D1
- [ ] 1.3 Criar migration **local**: tabela `ai_model_selection` (`capability` único, `provider`/`model`/`protocol` NOT NULL, `fallback_provider`/`fallback_model`/`fallback_protocol` opcionais, `reason`, `updated_by`, `updated_at`) com CHECKs de completude do fallback e de primary ≠ fallback — design D1/D3
- [ ] 1.4 Seeds idempotentes do catálogo: materializar exatamente a matriz inicial completa registrada em `design.md` (11 capacidades + fallback default de `campaign_copy`), sem produto cartesiano; manter alternativas sem evidência fora do catálogo; usar provider `gemini` (nunca `google`) e `segment = CAPABILITY_SEGMENTS[capability]` — design D1/Matriz inicial
- [ ] 1.5 Criar RPC `admin_set_ai_model_selection` (SECURITY DEFINER, `search_path=''`): valida primary e fallback contra o catálogo ativo, permite fallback somente em `campaign_copy`, rejeita novas seleções `deprecated`, valida completude e distinção, exige motivo, idempotência por `operation_id`, UPSERT + auditoria atômica (`ai_model_selection_update`/`ai_model_selection`); REVOKE/GRANT service_role — design D4
- [ ] 1.6 Criar RPC `admin_reset_ai_model_selection` (SECURITY DEFINER, `search_path=''`): captura o id da linha, DELETE + auditoria atômica (`ai_model_selection_reset`/`ai_model_selection`), idempotência por `operation_id`, no-op sem mutação quando não há linha; REVOKE/GRANT service_role — design D5
- [ ] 1.7 Estender CHECKs de `admin_audit_log` (DROP/ADD preservando valores) para `action ∈ {ai_model_selection_update, ai_model_selection_reset}` e `target_type = ai_model_selection`; registrar bloco REVERT
- [ ] 1.8 Testar a migration **localmente**: reaplicação idempotente (seeds sem duplicar); CHECKs de fallback incompleto e primary=fallback rejeitam; RPCs rejeitam motivo ausente, modelo fora do catálogo, fallback incompleto e fallback em capacidade diferente de `campaign_copy`; novas seleções deprecated são rejeitadas; `operation_id` repetido é idempotente — **não aplicar no remoto nesta task**

## 2. Plan 47-02 — Serviços de catálogo e seleção (onda 1)

- [ ] 2.1 Criar `AiModelCatalogService` que carrega/cacheia em bulk o mapa das combinações necessárias à validação, incluindo linhas `deprecated` referenciadas por seleções vigentes; expor listagem ativa para a UI sem lookup por capacidade/invoke + testes
- [ ] 2.2 Criar `AiModelSelectionService` que carrega e mantém em cache o **mapa completo** de seleções em uma única consulta, com TTL de 30s e `invalidateModelSelectionCache()`; não implementar `resolve` nem fallback ao registry neste serviço — design D6 + testes de cache/invalidação e propagação entre instâncias conforme o mecanismo disponível
- [ ] 2.3 Teste de paridade registry × catálogo: validar a matriz inicial completa; todo default do registry (primary + fallback) existe no catálogo; provider/protocolo respeita o pareamento (`openai` → `chat-completions|responses|images`, `gemini` → `gemini`); protocolo é compatível com a capacidade; `segment` = segmento canônico

## 3. Plan 47-03 — Integração com o gateway (onda 2)

- [ ] 3.1 Criar `PersistedModelResolver` implementando `AiModelResolver` (F46) como único dono de `resolve(capability)`, validação e fallback ao registry: seleção persistida → mapas bulk do catálogo + provider/protocolo pareado suportado pelo código + segmento canônico + primary ≠ fallback; linha ausente/parcial/incompatível → default; linha de catálogo `deprecated` ainda vigente → continua executável; **nunca lança**. `MODEL_ALLOWLIST` valida apenas defaults da F46 e não bloqueia modelos adicionais aprovados no catálogo — design D6/D7
- [ ] 3.2 Injetar o `PersistedModelResolver` na composição de `src/lib/ai/index.ts` (gateway padrão) sem alterar `gateway.ts`
- [ ] 3.3 Testes: override persistido válido tem precedência; seleção `deprecated` ainda presente resolve normalmente; `missing`/parcial/incompatível cai no default; pareamento provider/protocolo inválido cai no default; seleção igual ao default não altera comportamento; fallback com três campos nulos desabilita o fallback (`hasFallback` falso)
- [ ] 3.4 Garantir que retry/timeout/prompts/contratos externos permanecem inalterados (regressão)

## 4. Plan 47-04 — API administrativa (onda 2)

- [ ] 4.1 Schemas Zod em `src/lib/admin/schemas.ts`: update da seleção (capability, primary `provider/model/protocol`, fallback opcional completo somente para `campaign_copy`, reason obrigatório) e reset (capability, reason obrigatório)
- [ ] 4.2 Rota `GET/PUT/DELETE /api/admin/ai-model-selection` (`apiHandler` + `requireAdmin`): `GET` retorna catálogo ativo + seleções vigentes + defaults do registry e, em cada alvo efetivo (`primary`/`fallback`), `catalogStatus: active | deprecated | missing`; `PUT` chama `admin_set_ai_model_selection`; `DELETE` chama `admin_reset_ai_model_selection`; invalidar o cache após `PUT`/`DELETE`
- [ ] 4.3 Adicionar labels de auditoria em `src/lib/admin/labels.ts` (`ai_model_selection_update`, `ai_model_selection_reset`, `ai_model_selection`)
- [ ] 4.4 Testes de rota: 403 não-admin; 400 payload inválido (fallback incompleto, fallback fora de `campaign_copy`, primary=fallback, motivo ausente); GET catálogo+seleções+defaults com `catalogStatus` em `active`, `deprecated` e `missing`; PUT sucesso (auditoria + invalidação de cache); DELETE reset sucesso; idempotência por `operationId`

## 5. Plan 47-05 — Tela administrativa (onda 3)

- [ ] 5.1 Criar `src/app/(app)/admin/ai-model-selection/page.tsx` + `form.tsx` agrupados por Texto/Visual/Imagem, com modelo atual, default do registry, origem e seletor do catálogo ativo para primary; exibir seletor de fallback genérico somente em `campaign_copy` (opção "sem fallback") e explicar `campaign_image_edit` como capacidade primária independente
- [ ] 5.2 Exibir `campaign_image_edit` como **capacidade própria** (não como fallback genérico de `campaign_image`) — design D2
- [ ] 5.3 Motivo obrigatório na UI + feedback de auditoria; ação "Restaurar padrão" (reset auditado)
- [ ] 5.4 Adicionar link "Modelos de IA" na nav do admin (`layout.tsx`)
- [ ] 5.5 Seguir `openspec/design-system/MASTER.md` (dark OLED, Poppins/Open Sans, lucide-react, sem emojis/light mode)
- [ ] 5.6 Testes de componente/página: agrupamento, acesso admin, motivo obrigatório, seletor de fallback, restaurar padrão

## 6. Plan 47-06 — Consistência catálogo × pricing (onda 3)

- [ ] 6.1 Sinalizar, por capacidade, o pricing faltante (design D8): tokens para texto/visão; modelo + componente `responses:image_generation` para `campaign_image`/`visual_signature_image`; unidade de imagem para `campaign_image_edit`; na API/tela (tabela ou bootstrap)
- [ ] 6.2 Testes: modelo sem pricing é sinalizado por componente da capacidade; com pricing não; `campaign_image`/`visual_signature_image` exigem o componente da tool; `campaign_image_edit` exige unidade de imagem; `resolveAiCost` inalterado

## 7. Plan 47-07 — Rótulos diagnósticos e regressão (onda 4)

- [ ] 7.1 Migrar `DEFAULT_IMAGE_MODEL` em `src/lib/image-generation/services/image-generation-service.ts` para o modelo efetivamente retornado/alvo resolvido (design D10)
- [ ] 7.2 Migrar `VISUAL_SIGNATURE_IMAGE_MODEL` em `src/lib/visual-signature/server-actions.ts` para o modelo efetivo/resolvido
- [ ] 7.3 Migrar `scripts/benchmark.ts` (`MODEL_REGISTRY.campaign_image.primary`) para resolver via `AiModelResolver`/gateway
- [ ] 7.4 Rodar regressão completa (vitest) e corrigir resíduos
- [ ] 7.5 Rodar typecheck, lint e build; verificar UI do lojista/form/schema público/snapshot/domínio/prompts intactos
- [ ] 7.6 Verificar que o gateway cai no default do registry quando não há seleção (fail-open)

## 8. Plan 47-08 — UAT local, remoto, deploy e verificação final (onda 5)

- [ ] 8.1 Executar **UAT local** (com a migration local aplicada): trocar realmente o modelo em `campaign_copy`; trocar e desabilitar o fallback de `campaign_copy`; persistir o próprio default como override em uma capacidade de visão e em uma de imagem, validando origem, resolução, telemetria, custo e reset; validar alternância real de visão/imagem somente quando houver modelos homologados adicionais no catálogo; validar edição de imagem via `campaign_image_edit`, depreciação sinalizada, rótulos diagnósticos e a tela
- [ ] 8.2 Aplicar a migration no **remoto** — **[BLOCKING]** antes do deploy que lê a seleção
- [ ] 8.3 Fazer o **deploy do código** (leitura da seleção + gateway + tela admin)
- [ ] 8.4 Ajustar **env-vars remotas somente se ainda existirem** (a F46 removeu as env-vars de modelo/provider; restam chaves e operacionais)
- [ ] 8.5 Gerar `47-VERIFICATION.md` (goal-backward) e `47-UAT.md` (roteiro humano)
- [ ] 8.6 Confirmar 4 gates verdes e os critérios da proposta (catálogo por capacidade, seleção primary+fallback, RPCs de set/reset auditadas, fallback fail-open, tela por segmento, consistência pricing por capacidade, rótulos efetivos)
- [ ] 8.7 Atualizar registros (AGENTS.md/STATE/ROADMAP) e preparar arquivamento após aprovação
