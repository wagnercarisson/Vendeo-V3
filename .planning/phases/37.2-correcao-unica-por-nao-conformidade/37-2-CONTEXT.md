# Phase 37.2: Correção Única por Não Conformidade — Context

**Gathered:** 2026-09-10
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`) — fonte da verdade (decisão do usuário 2026-09-10: usar a pasta real da fatia, padrão F37.1/F38.1). Complemento normativo: `docs/alinhamento-fase-37-revisao-aprovacao-arte.md` (§3 D37.2-R1…R8, §4 política, §5 estados UX, §6 cuidados arquiteturais, §7 contratos, §8 testes, §9 riscos, §10 fora de escopo, §12 checklist).

<domain>
## Phase Boundary

A **F37 — Revisão e Aprovação da Arte** (v1.5, beta controlado por flag) já entregou a **fatia 37.1 (Approval Gate + Candidata Única)** — concluída, validada e arquivada em `openspec/changes/archive/2026-09-02-fase-37-1-approval-gate-candidata-unica`. Com a flag `campaign_approval_enabled` ligada, a campanha nova entra em revisão (download e copy bloqueados), o lojista aprova a candidata e só então a entrega é liberada — mas a revisão **não tem segundo caminho**: se a primeira arte tem um defeito objetivo, o lojista só pode aprovar ou desistir (nova campanha = novo crédito).

Esta é a **F37.2 realinhada — Correção Única por Não Conformidade** (substitui a antiga 37.2 "Correção Visual Com Referência", abandonada, e elimina a 37.3): quando a geração tem um **defeito objetivo**, o lojista relata o problema e o sistema produz **no máximo uma v2** orientada a eliminar aquele defeito — **sem rebriefing, sem galeria de variações, sem referência da v1, sem novo custo/crédito ao lojista** (1 crédito = 1 campanha aprovada).

**O que esta fatia entrega (D37.2-R1…R8):**

- **Tela de revisão com dois caminhos (R1)** — no estado `pending` (v1), **[Aprovar arte]** (primário) + **[Informar problema]** (secundário) que abre um **modal de uma etapa** (`campaign-problem-modal.tsx`) com preview da candidata, orientação do corrigível × não corrigível, campo obrigatório e [Enviar para análise]/[Cancelar]. Cancelar/X/ESC/backdrop fecham sem efeito. Texto vazio/só pontuação → erro amigável **sem criar caso e sem chamar IA**.
- **Análise textual do relato (R2)** — `correction-intent-service.ts` via `createTextProvider`: entende o relato, tolera erros de escrita e **NÃO lê a imagem**. Saída JSON estrito + parse defensivo + Zod → `eligible|blocked|unclear` + `category` + `normalizedInstruction`. JSON inválido/fora do schema → `unclear`; timeout/transporte/vazio → `analysis_failed`. `unclear`/`blocked` não geram/consomem. Texto e `normalizedInstruction` são conteúdo **não confiável** (delimitados/saneados, incapazes de sobrescrever o briefing). **Custo da análise** registrado como evento call-level no mesmo `operation_run_id` (novo `generation_type` `campaign_correction_analysis`).
- **Caso + tentativas (R5)** — tabelas novas `campaign_correction_reports` (pai, 1/campanha, `UNIQUE(campaign_id)`, status `open → generation_started → v2_generated | failed_no_v2`) e `campaign_correction_submissions` (filha 1:N, sem `campaign_id` repetido, **`attempt_number` sequencial + `UNIQUE(report_id, attempt_number)`**, CHECKs semânticos). Caso e 1ª tentativa (`analyzing`) nascem juntos na 1ª submissão válida **antes da IA**. Decisão corrente = tentativa de maior `attempt_number`. Aprovação final **não espelhada** (derivada de `campaigns`).
- **Lifecycle da tentativa (RPC `begin_campaign_correction_submission`, R2/R3.1)** — locks **candidata → campanha → relato**; valida no banco pendência/candidata v1/ausência de v2 (fecha a corrida com a aprovação); finaliza `analyzing` expiradas como `analysis_failed` (recuperação sem cron); recusa `analyzing` válida (409 `analysis_in_progress`); rate limit ≤ 3 tentativas/30min por `report_id`+`created_at` com **teto absoluto** (4ª bloqueada mesmo após `analysis_failed`); atribui `attempt_number` sob o lock.
- **Conclusão da análise (RPC `complete_campaign_correction_analysis`)** — validação semântica do estado final (nunca `analyzing`; `eligible` exige categoria permitida + instrução não vazia; não-elegíveis **rejeitam** campos de geração com `non_eligible_must_not_have_generation_fields`) + condicionada a `analysis_state='analyzing'` + lease (`analysis_expires_at >= now()`) + submissão mais recente por `attempt_number`.
- **Consumo atômico da oportunidade (RPC `consume_campaign_correction_opportunity`, R3/R4)** — chamada por hook aditivo `onBeforeImageProviderCall` no `ImageGenerationService` imediatamente antes da 1ª chamada real ao provider. Locks candidata → campanha → relato; valida campanha pendente + `rejection_count=0` + relato da campanha + `reported_version_id` = candidata travada + submissão vigente `eligible` e mais recente; grava `rejection_count=1` + `generation_started_at` + `report.status='generation_started'`.
- **Falha pós-provider (RPC `fail_campaign_correction_v2`)** — atômica: mantém `rejection_count=1`, libera `correction_in_progress`, `failed_no_v2`; v1 continua aprovável; asset órfão removido best-effort.
- **Recuperação preguiçosa pós-consumo (RPC `recover_campaign_correction_generation`)** — acionada ao carregar a campanha (`regenerating`) e na rota `approve` antes de aprovar; se `generation_started_at` excedeu o teto (`p_stale_before` do backend ou default normativo `now() - interval '330 seconds'`), reverte o consumo mantendo `rejection_count=1`, `failed_no_v2`, libera `correction_in_progress` → v1 volta a ser candidata/aprovável, **mas download/copy permanecem bloqueados até aprovação explícita**. Sem cron.
- **Geração da v2 (R4)** — mesma entrega (sem nova reserva/crédito/`operation_key`; eventos no mesmo `operation_run_id`): snapshot `campaign_brief_v1` imutável, imagens F41 + identidade vigente, **sem v1 como referência** (`candidateArtDataUrl` proibido), diretor atual por intent + **um bloco único de não conformidade** acrescentado em tempo de montagem (sem duplicar os 3 prompts, sem editar os `.md`); revisor automático intocado; sem copy director; `input_validation` `skipped` via override `brief_review_confirmed` (F43).
- **Conclusão da v2 (RPC `complete_campaign_correction_v2`, contrato fechado)** — atômica: recebe identidade do caso/consumo + dados do asset; **`brief_snapshot` copiado da v1 travada no banco** (nunca do cliente); insere v2 (`version_number=2`, `pending`/`active`), **demove a v1 para `asset_status='superseded'`** (path preservado), `correction_in_progress=false`, `report.status='v2_generated'`/`generated_version_id`; **sem incrementar `rejection_count`**.
- **Aprovação protegida (RPC `approve_campaign_candidate`, R8)** — a rota `POST /api/campaign/[id]/approve` passa a chamar essa RPC: trava a candidata primeiro, valida `pending`/`active` + `correction_in_progress=false` (senão 409) e invoca a RPC F37.1 `approve_campaign_art_version` **intacta** na mesma transação. Serializa aprovar × consumir **no banco**.
- **Fila administrativa simples (R6)** — páginas server-side `/admin/campaign-reports` (listagem/filtros/paginação) + detalhe `[reportId]` (v1 × v2 lado a lado via signed URLs, histórico de tentativas por `attempt_number`, status/consumo, `operation_run_id`, aprovação derivada, marcação ortogonal "revisado pelo suporte") + link no layout admin.
- **Preservados (R7)** — flag off e legado intactos; download/copy gated (`pending`/`regenerating` → 403); `rejection_count` vira contador de consumo (0→1; CHECK 0..2 inalterado); estado `regenerating` passa a ser **exercitado**; RPCs dormentes intocadas; contratos novos com nomes próprios.

**Estado real verificado em código (2026-09-10, branch `feature/fase-37-realignment-simplificado`):**

- **Flag:** `CAMPAIGN_APPROVAL_ENABLED_KEY` em `src/lib/feature-flags/feature-flag-service.ts:14`, em `ALL_FEATURE_FLAG_KEYS` (`:17-23`), `isCampaignApprovalEnabled()` fail-closed (`:157-159`, wrapper `:178-180`).
- **Tabela `campaign_art_versions`:** migration `20260901000001_f37_1_create_campaign_art_versions.sql` (CHECK `asset_status IN ('active','discarded')`, `version_number 1..3`, `UNIQUE(campaign_id, version_number)`, índice único parcial 1-approved, `correction_in_progress`, RLS service_role). Colunas de aprovação em `campaigns` + CHECK `campaigns_approved_requires_version`. **Nada escreve `rejection_count` hoje.**
- **RPC F37.1 `approve_campaign_art_version`** (`20260901000002_...`) — transação atômica de aprovação, `FOR UPDATE`, descarte defensivo das outras `active`; **INTACTA na F37.2**.
- **Persistência** `src/lib/campaign/persistence.ts`: `createArtVersion` (`:229`), `listArtVersions` (`:254`), `createCampaign` (`:11`, grava `operation_run_id`), `uploadCampaignInputImage` (`:168`).
- **Display** `src/lib/campaign/display.ts`: `ApprovalDisplayState` (`:16`, inclui `regenerating`), `computeApprovalState` (`:140-166` — deriva `regenerating` de candidata ativa com `correction_in_progress=true`; hoje **inalcançável**), `isDeliveryReleased` (`:170-180`), `getActiveCandidateArtVersion` (`:185`), `generateSignedPreviewUrl`.
- **Rota approve** `src/app/api/campaign/[id]/approve/route.ts`: guards + `rpc approve_campaign_art_version`; erros `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active` → 409.
- **Página** `src/app/(app)/campanhas/[id]/page.tsx` (só `ready`, lê flag + `listArtVersions` → `computeApprovalState`; `pending` → `CampaignApprovalView`) e `client.tsx` (`regenerating` hoje cai no fallback — gap a preencher).
- **Componente** `src/components/campaign/campaign-approval-view.tsx`: só botão primário "Aprovar e liberar campanha"; comentário marca que o segundo botão é 37.2.
- **Gates:** `download/route.ts` e `publication-copy/route.ts` → 403 quando `!isDeliveryReleased`. Nada muda.
- **`generate-image`:** cria campanha + reserva crédito + stream NDJSON; insere v1 quando flag on; eventos call-level sob `operation_run_id` via `AiCostTracker.record`.
- **`ImageGenerationService`** `src/lib/image-generation/services/image-generation-service.ts`: `generateImage(brief, context, onPhaseChange?, signal?, onMetricsEvent?)`; fases `input_validation` (skip via override), `prompt_assembly`, loop `image_generation` via `generateWithRetry` (1ª chamada real ao provider na iteração 0), `quality_review`. `assemblePrompt(state, variables, previousIssues)` escolhe `campaign-image-director-${intent}` — padrão para o bloco único.
- **`art-director-briefing.ts`** (F45) em `src/lib/image-generation/services/art-director-briefing.ts` — blocos contextuais por presença, `sanitizePromptText`, `splitDirectorLegalText`. 4 `.md` por intent **intocados** (diff vazio é requisito).
- **TextProvider** `src/lib/text-provider/types.ts` — `generateText(prompt, { system, temperature, maxTokens, signal })`, **sem `jsonMode`**; factory `createTextProvider()`. Padrão JSON estrito + parse defensivo + Zod já usado no Copy Director, `image-review-service.ts`, `input-validation-service.ts`.
- **Overrides (F43):** `inputValidationOverride.productImageCheck = "brief_review_confirmed"` pula `input_validation`.
- **`GenerationEventType`** `src/lib/visual-signature/types.ts:101-113` — **12 valores**; `AiCostTracker` é o único caminho de escrita call-level.
- **RPCs dormentes** `20260905000001_f37_2_correction_rpcs.sql` (aplicada no remoto; mantida como histórico): `begin_campaign_correction`/`cancel_campaign_correction`/`complete_campaign_regeneration` — **nunca reutilizar/alterar**; contratos novos com nomes próprios. **Atenção:** o sufixo de nome `..._f37_2_correction_rpcs.sql` já está ocupado por essa migration dormente — as novas migrations devem usar prefixo de data > `20260905000001` e sufixo distinto.
- **Admin:** `src/app/(app)/admin/layout.tsx` com nav de links; server pages via serviços internos + `supabaseAdmin`; admin não chama a própria API.
- **Convenções:** migrations evolutivas **banco → código**, idempotentes, `DO $$` para CHECKs idempotentes, RLS service_role, RPCs `SECURITY DEFINER SET search_path=''`, seção REVERT comentada; testes vitest com mocks de guards e leitura da migration do disco para validar RPC por fonte.

**Divergência registrada (não bloqueante):** o `docs/alinhamento-...md` §8.2/§9/§12 descreve o begin travando "a linha da campanha primeiro". O **OpenSpec base (revisão hardening, achado 1)** é normativo e define **candidata → campanha → relato** — uniforme com consumo/aprovação protegida. Seguir o OpenSpec base.
</domain>

<decisions>
## Implementation Decisions

### D1 — Modal "Informar problema" de 1 etapa + entrada na revisão (R1)
`DECIDIDO`. `src/components/campaign/campaign-problem-modal.tsx` (novo, client, modal hand-rolled `role="dialog" aria-modal`, tema dark tokens `#020617`/`#F8FAFC`/`#22C55E`, touch ≥ 44px). Abertura: `CampaignApprovalView` renderiza dois botões no `pending` (v1) — primário **[Aprovar arte]** (fluxo R8) e secundário **[Informar problema]** (abre o modal sem sair da página). Guarda de UX desabilita [Aprovar arte] com caso em processamento (reforço; garantia é o banco). Conteúdo: preview da candidata ativa, orientação corrigível × não, textarea obrigatório "Descreva o problema na arte", [Enviar para análise]/[Cancelar]. Cancelar/X/ESC/backdrop fecham sem efeito. Validação **no clique**: vazio/só pontuação → erro amigável, **sem caso e sem IA**. Pós-envio: modal vira estado de processamento (não fecha sozinho); resultados (`blocked`/`unclear`/`analysis_failed`/transição `regenerating`) refletidos com `router.refresh()`. Loading/erro PT-BR. Rejeitados: modal 2 etapas (abandonado), validação a cada keystroke, página separada.

### D2 — Elegibilidade e análise textual (R2)
`DECIDIDO`. Novo `src/lib/campaign/correction-intent-service.ts` via `createTextProvider()`. **Sem `jsonMode`/`response_format` portável**: system prompt pedindo JSON estrito → `JSON.parse` defensivo → validação Zod (`CorrectionAnalysisResultSchema`: `analysisState: "eligible"|"blocked"|"unclear"`, `category?`, `normalizedInstruction?`, `guidance`; campos inesperados rejeitados). Prompt instrui: entender relato tolerando erros; **NÃO avaliar a imagem**; classificar pela taxonomia §4; quando elegível devolver categoria + `normalizedInstruction` objetiva. Conteúdo não confiável delimitado + `sanitizePromptText`, **nunca** altera briefing/identidade/valores. Erros: JSON inválido/fora do schema → `unclear`; timeout/transporte/vazio → `analysis_failed` (com `completed_at`, não consome). **Custo (achado 4):** cada `generateText` registra evento call-level via `AiCostTracker.record` no mesmo `operation_run_id` com `generationType` novo `campaign_correction_analysis`, **`provider` = `textProvider.name`** (o `TextProviderResult` só devolve `model`/`usage`), `model`/`usage`, `durationMs`, `status`, `attemptNumber` = `attempt_number` da submissão, custo por `resolveAiCost`. Exige novo literal no union `GenerationEventType` + evolução do CHECK `chk_generation_events_type` + delta MODIFIED na capability `ai-cost-tracker`. **Sem** telas/cálculos financeiros.

### D3 — Persistência: tabelas pai + filha e begin RPC (R2/R3.1/R5)
`DECIDIDO`. Migrations evolutivas (banco → código), padrão F37.1.

**Pai `campaign_correction_reports`** (sem colunas de decisão espelhadas): `id` PK, `campaign_id` FK CASCADE + **UNIQUE(campaign_id)**, `store_id` FK, `reported_version_id` FK NOT NULL (v1), `generated_version_id` FK nullable (v2), `status` CHECK `open|generation_started|v2_generated|failed_no_v2` default `open`, `generation_started_at`, `operation_run_id`, `reviewed_by_support_at`/`reviewed_by_support_user`, `created_at`/`updated_at`. RLS service_role.

**Filha `campaign_correction_submissions`** (1 linha/tentativa; **sem `campaign_id`**): `id` PK, `report_id` FK CASCADE, **`attempt_number smallint NOT NULL` + `UNIQUE(report_id, attempt_number)`** (`MAX+1` sob o lock), `text` NOT NULL, `analysis_state` CHECK `analyzing|eligible|blocked|unclear|analysis_failed` default `analyzing`, `category`, `normalized_instruction`, `analysis_expires_at` NOT NULL (`now() + 2 min`), `created_at` default now(), `completed_at`. **CHECKs semânticos:** (a) `completed_at` só quando `analysis_state <> 'analyzing'`; (b) `eligible` exige `category IS NOT NULL` e `normalized_instruction` não vazia (trim); (c) `blocked|unclear|analysis_failed` exigem `category IS NULL` e `normalized_instruction IS NULL`. Decisão corrente = maior `attempt_number`; janela do rate limit conta por `created_at`.

**RPC `begin_campaign_correction_submission(p_campaign_id uuid, p_text text)`** (`SECURITY DEFINER SET search_path=''`, service_role), transação única com **locks candidata → campanha → relato**:
1. Trava a candidata v1 (`version_number=1`, `status='pending'`, `asset_status='active'`, FOR UPDATE); ausente → `no_active_candidate` (409).
2. Trava a campanha (FOR UPDATE); ausente → `campaign_not_found`.
3. Valida no banco: `status='ready'` E `approval_status='pending_approval'` E `approved_version_id IS NULL` E `rejection_count=0` E ausência de v2 → senão 409 (`campaign_not_pending`/`already_consumed`).
4. Cria/localiza o relato pai (`reported_version_id` = candidata travada, `store_id` da campanha; `UNIQUE(campaign_id)` defesa final).
5. Trava o relato e abre a janela.
6. Finaliza tentativas `analyzing` **expiradas** (`analysis_expires_at < now()`) como `analysis_failed` (com `completed_at`) — recuperação sem cron.
7. Recusa `analyzing` ainda válida → 409 (`analysis_in_progress`).
8. Rate limit: linhas por `report_id` + `created_at >= now() - interval '30 minutes'`; se `>= 3` → 409 (`rate_limit_exceeded`) **mesmo que a última tenha terminado em `analysis_failed`** (teto absoluto).
9. `attempt_number = COALESCE(MAX(attempt_number),0)+1` sob o lock.
10. Insere tentativa (`analyzing`, `analysis_expires_at = now() + interval '2 minutes'`, `text`); retorna `{ report_id, submission_id, attempt_number, analysis_expires_at }`.

**RPC `complete_campaign_correction_analysis(p_report_id, p_submission_id, p_attempt_number, p_analysis_state, p_category, p_normalized_instruction)`** — validação semântica do estado final (∈ `eligible|blocked|unclear|analysis_failed`, nunca `analyzing`; `eligible` exige categoria permitida + instrução não vazia; não-elegíveis **rejeitam** categoria/instrução não-nulas com `non_eligible_must_not_have_generation_fields` — regra única). `UPDATE ... WHERE id AND report_id AND attempt_number AND analysis_state='analyzing' AND analysis_expires_at >= now() AND attempt_number = (SELECT MAX(...))`; `rowcount=0` → 409 (`submission_not_analyzing`/`analysis_lease_expired`/`submission_stale`); grava `completed_at`. Erros semânticos: `invalid_analysis_state`/`eligible_requires_category_and_instruction`/`non_eligible_must_not_have_generation_fields`. CHECKs de tabela como defesa em profundidade.

### D4 — Consumo da oportunidade (R3/R4/R8)
`DECIDIDO`. `consume_campaign_correction_opportunity(p_campaign_id, p_report_id, p_submission_id)` (`SECURITY DEFINER`, service_role), locks **candidata → campanha → relato**: valida campanha `ready`/pendente/`rejection_count=0`; relato da campanha (`report_campaign_mismatch` 404), `status='open'` (`report_not_open` 409), `reported_version_id` = candidata travada (`version_mismatch` 409); submissão vigente `eligible` **e mais recente por `attempt_number`** (`submission_stale`/`submission_not_eligible` 409); grava `rejection_count=1` + candidata `correction_in_progress=true` + `status='generation_started'` + `generation_started_at=now()`. Ponto de chamada: hook opcional/aditivo `onBeforeImageProviderCall?: () => Promise<void>` no `ImageGenerationService`, **fire-once**, imediatamente antes da 1ª tentativa real ao provider (iteração `attempt===0` em `generateWithRetry`). Ausência do hook = comportamento atual. Falha pré-provider não consome.

**Recuperação preguiçosa `recover_campaign_correction_generation(p_campaign_id uuid, p_stale_before timestamptz DEFAULT NULL)`** — locks candidata → campanha → relato; teto `report.generation_started_at < COALESCE(p_stale_before, now() - interval '330 seconds')`; backend passa `CORRECTION_GENERATION_STALE_AFTER_MS = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS (300s) + 30s`; SQL **não lê env**. Se `generation_started` + `correction_in_progress=true` + preso além do teto → mantém `rejection_count=1`, `failed_no_v2`, libera `correction_in_progress=false`, retorna `{recovered:true}`; senão no-op `{recovered:false}`. **Download/copy continuam bloqueados** até aprovação explícita. Acionamento lazy best-effort: (a) página ao carregar campanha que deriva `regenerating` — **quando `recovered:true`, o caller RECARREGA campanha/versões do banco (nova leitura) antes de recalcular**; (b) rota `approve` antes de `approve_campaign_candidate`.

**Falha pós-provider `fail_campaign_correction_v2(p_campaign_id, p_report_id)`** — atômica, locks candidata → campanha → relato; valida `report.status='generation_started'` + `correction_in_progress=true` (senão 409 `report_not_generation_started`); mantém `rejection_count=1`, libera `correction_in_progress=false`, `failed_no_v2`; v1 aprovável. Asset órfão removido best-effort pelo caller.

### D5 — Geração da v2 (R4)
`DECIDIDO`. Orquestrador em `correction-reports.ts` (ou serviço coeso): briefing imutável (`campaign_brief_v1` da v1/campanha + identidade vigente, nada re-montado); imagens F41 (`media.images[].storagePath` → data URLs) exatamente como na geração inicial; **sem `candidateArtDataUrl`**; **bloco único de não conformidade** acrescentado em tempo de montagem (padrão `assemblePrompt`): instrução normalizada delimitada/saneada + preâmbulo fixo anti-invenção e de fidelidade ao briefing — **sem duplicar os 3 prompts e sem editar os `.md`** (diff vazio verificado em teste); diretor por `commercial.intent` do snapshot; `input_validation` `skipped` via `brief_review_confirmed` (sem revalidar produto×imagem); revisor automático intocado; **sem copy director**; eventos call-level sob o mesmo `operation_run_id`; sem reserva de crédito/`credit_transactions`/`operation_key`.

### D6 — Conclusão da v2 (R5) + `superseded`
`DECIDIDO`. `complete_campaign_correction_v2(p_campaign_id, p_report_id, p_submission_id, p_storage_path, p_mime_type, p_generation_metadata, p_render_snapshot)` (`SECURITY DEFINER`, service_role), atômica, locks candidata → campanha → relato. **Contrato fechado:** recebe identidade do caso/consumo + dados do asset; **`brief_snapshot` NUNCA vem do cliente** — copiado da **v1 travada no banco**. Valida `report.status='generation_started'` + `correction_in_progress=true` + `rejection_count=1` + `submission_id` mais recente por `attempt_number` + ausência de v2 + `p_storage_path` distinto da v1. Insere v2 (`version_number=2`, `pending`, `active`, `storage_path = {storeId}/{campaignId}/v2.jpg`, `mime_type`, `brief_snapshot` cópia da v1, `generation_metadata` com `operation_run_id` + snapshots econômicos, `render_snapshot`, `correction_in_progress=false`); demove v1 para `asset_status='superseded'` (**path preservado**, `correction_in_progress=false`); `report.status='v2_generated'`/`generated_version_id`; **sem incrementar `rejection_count`**. Dupla conclusão → 409. **Troca do CHECK:** `asset_status IN ('active','discarded')` → `('active','discarded','superseded')` via bloco `DO $$` idempotente. RPC F37.1 intacta.

### D7 — Aprovação protegida `approve_campaign_candidate` (R8)
`DECIDIDO`. `approve_campaign_candidate(p_campaign_id, p_version_id)` (`SECURITY DEFINER`, service_role): trava a candidata primeiro (`id=p_version_id FOR UPDATE`); valida pertence à campanha, `status='pending'`, `asset_status='active'`, `correction_in_progress=false` (senão 409); chama a RPC F37.1 `approve_campaign_art_version` **intacta na mesma transação**. Rota approve: só troca o alvo do RPC, mantendo guards e mapeamento; novos códigos: `correction_in_progress` → 409; v1 `superseded`/não `active` → `version_not_active` → 409. Resposta 200 inalterada. Corrida: consumo vence → aprovação 409; aprovação vence → consumo falha na pendência e geração abortada antes do provider.

### D8 — Fila administrativa (R6)
`DECIDIDO`. Lista `src/app/(app)/admin/campaign-reports/page.tsx` (server, `requireAdmin`, serviços internos/supabaseAdmin): colunas campanha/loja/status do caso/**decisão corrente (tentativa de maior `attempt_number`)**/data; filtros status do caso, `analysis_state` da tentativa vigente, revisado×não revisado; paginação `<Link>`. Detalhe `[reportId]/page.tsx`: v1 × v2 lado a lado (signed URLs service_role, inclui v1 `superseded`), histórico de tentativas por `attempt_number`, status/consumo, `operation_run_id` linkável ao painel F38.2, aprovação **derivada** de `campaigns`. Ação "marcar como revisado" (`reviewed_by_support_at`/`_user`, ortogonal). Link em `src/app/(app)/admin/layout.tsx`. Server pages chamam serviços internos, sem chamar a própria API.

### D9 — Estados UX resultantes (R1/R7)
`DECIDIDO`. `computeApprovalState` permanece (já deriva `regenerating`). A F37.2 **exercita**: `not_enabled`/`legacy` → entrega imediata; `pending` (v1) → [Aprovar arte] + [Informar problema]; `regenerating` → bloqueia approve/download/copy, progresso da v2 (sem cair no `ReadyView`); `pending` (v2) → [Aprovar arte] aprova a v2, sem voltar à v1, sem novo relato; `approved` → entrega liberada.

### D10 — Nomeação e migrations
`DECIDIDO`. Pasta `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`; migrations com prefixo de data **> `20260905000001`** e sufixo distinto (o sufixo `_f37_2_correction_rpcs.sql` já é da migration dormente). Plano sugerido: **M1** tabelas + troca do CHECK `asset_status` + CHECKs semânticos; **M2** `begin` + `consume`; **M3** `complete_v2` + `fail` + `complete_analysis` + `recover` + `approve_candidate`; **M4** evolução do CHECK `chk_generation_events_type`. Nomes próprios novos; nunca as RPCs dormentes.

## Constraints

- **Não reutilizar/alterar** parser heurístico, `visual_adjustment`/`creative_remake`, `candidateArtDataUrl`, cap de 2, `prompts/regen/*`, modal 2 etapas, rota `/regenerate`, `briefPatch` — abandonados (backup `backup/fase-37-antes-realignment`).
- **Não alterar**: revisor (`image-review-service`/prompt), F45 (diretores/briefing — `.md` com diff vazio), F39 (brief/snapshot), F41 (persistência inputs), créditos F24/F25, copy director F17, rotas generate-image/download/publication-copy, RPCs dormentes, `approve_campaign_art_version`.
- **Sem** nova reserva de crédito/`credit_transactions`/`operation_key`; contabilidade F38/F38.2 sem alteração de telas/cálculo (apenas eventos call-level no mesmo run).
- **Sem** v3 / mais de uma geração corretiva; `rejection_count` nunca chega a 2 nesta fatia; CHECK 0..2 inalterado.
- **Sem** galeria de versões / retorno à v1 pela UX/API; v1 não aprovável após a v2.
- **Sem** `CREATE OR REPLACE` sobre RPCs existentes; troca do CHECK de `asset_status` é evolução de constraint declarada/idempotente.
- **Migrações idempotentes, não destrutivas, RLS service_role-only, seção REVERT**, ordem **banco → código**; flag default `false` (fail-closed).
- **Ordem de locks consistente** candidata → campanha → relato (anti-deadlock); aprovação protegida nunca toca o relato.
- **Conteúdo não confiável** (texto do lojista e `normalizedInstruction`) delimitado/saneado; incapaz de sobrescrever o briefing.
- **Aprovação não espelhada no relato**; fila admin deriva de `campaigns` + versões.
- **Renumeração/trackings:** F37.2 realinhada substitui a antiga 37.2 e elimina a 37.3; atualizar os trackings no plano 37-2-01 (deferido por decisão do usuário 2026-09-10).

## Dependencies

- F37.1 (Approval Gate + Candidata Única — base concluída: flag, tabela, display/gating, RPC F37.1, rota approve, UI de revisão)
- F39 (Brief Estruturado — `CampaignBrief`/snapshot `campaign_brief_v1`)
- F40 (Campos Comerciais e Avisos do Brief)
- F41 (Mídia de Campanha Mobile — multi-imagem, `storagePath` dos inputs, `campaignId` pré-gerado)
- F43 (Revisão do Brief Pré-Geração — infra `feature_flags` + override `brief_review_confirmed`)
- F45 (Briefing Contextual do Diretor de Arte — `art-director-briefing.ts`, `sanitizePromptText`, diretores por intent; `.md` intocados)
- F38.1/F38.2 (telemetria `AiCostTracker`/`operation_run_id`, painel de custos — evento call-level do novo tipo)
- F24/F25 (pipeline de créditos — intacto)
- F31.x (intents, prompts por intent, revisor — via pipeline, sem mudança)

## Key Requirements

Mapeados dos 8 specs OpenSpec + `tasks.md` (fonte: `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`). IDs de requisito para o campo `requirements` dos PLAN.md (1 por seção do tasks.md):

- **F37.2-01** (tasks §1) — Trackings: registrar a F37.2 realinhada nos 6 arquivos + ROADMAP raiz (substitui a antiga 37.2; elimina a 37.3); source of truth a pasta real da fatia; grep-verificação de resíduos.
- **F37.2-02** (tasks §2) — Migrations M1: `campaign_correction_reports` + `campaign_correction_submissions` (com `attempt_number` + `UNIQUE(report_id, attempt_number)` + CHECKs semânticos) + troca idempotente do CHECK de `asset_status` (`superseded`) + RLS/REVOKE/REVERT + db push [BLOCKING].
- **F37.2-03** (tasks §3) — Migrations M2/M3: RPCs `begin_campaign_correction_submission`, `consume_campaign_correction_opportunity`, `complete_campaign_correction_v2`, `fail_campaign_correction_v2`, `complete_campaign_correction_analysis`, `recover_campaign_correction_generation`, `approve_campaign_candidate`; REVOKE/GRANT; sem tocar RPCs dormentes/F37.1; db push [BLOCKING].
- **F37.2-04** (tasks §3.8-3.9) — Migrations M4 + tipos: evolução do CHECK `chk_generation_events_type` + union `GenerationEventType` (`campaign_correction_analysis`) + delta MODIFIED da capability `ai-cost-tracker`.
- **F37.2-05** (tasks §4) — Persistência `src/lib/campaign/correction-reports.ts` + tipos em `types.ts`: caso/tentativas, `ArtAssetStatus` + `superseded`, `getCorrectionReport`/`listCorrectionSubmissions`/`completeCorrectionAnalysis`/`listCorrectionReports`/`getCorrectionReportDetail`/`markReportReviewedBySupport`; invariantes (filha sem `campaign_id`; decisão corrente por `attempt_number`; aprovação não espelhada).
- **F37.2-06** (tasks §5) — `CorrectionIntentService` (`correction-intent-service.ts`): `analyzeReport(text)` JSON estrito + Zod + taxonomia §4 + conteúdo não confiável + tratamento de erros + custo call-level (`campaign_correction_analysis`, `provider = textProvider.name`).
- **F37.2-07** (tasks §6) — Rota `POST /api/campaign/[id]/problem-report/route.ts`: guards + zod strict + 400 vazio/pontuação + begin RPC + análise + conclusão via RPC + `200 {analysisState, guidance}` (blocked/unclear) + NDJSON stream (eligible) + `fail_campaign_correction_v2` pós-provider + sem reserva de crédito.
- **F37.2-08** (tasks §7) — Geração v2: hook `onBeforeImageProviderCall` + bloco único de não conformidade + reuso snapshot/imagens F41/identidade + sem `candidateArtDataUrl` + `input_validation` skipped + revisor intocado + consumo + conclusão.
- **F37.2-09** (tasks §8) — Aprovação protegida: rota approve chama `recover_campaign_correction_generation` (best-effort) e `approve_campaign_candidate`; mapeamento de erros; ordem de locks.
- **F37.2-10** (tasks §9) — UI: `campaign-problem-modal.tsx` + dois botões em `campaign-approval-view.tsx` + estados pós-envio + a11y/mobile/tema.
- **F37.2-11** (tasks §10) — Página `/campanhas/[id]`: `page.tsx` (recuperação lazy + reload + props `pending` v1/v2 e `regenerating`) + `client.tsx` (regenerating sem cair no `ReadyView`) + microcopy.
- **F37.2-12** (tasks §11) — Admin: serviços `listCorrectionReports`/`getCorrectionReportDetail` + páginas `admin/campaign-reports` (lista/detalhe) + marcação revisado + link no layout.
- **F37.2-13** (tasks §12) — Testes análise/classificação (12.1-12.9).
- **F37.2-14** (tasks §13) — Testes lifecycle da tentativa/begin RPC (13.1-13.10).
- **F37.2-15** (tasks §14) — Testes consumo/serialização aprovar×consumir/recuperação (14.1-14.9).
- **F37.2-16** (tasks §15) — Testes única v2/geração/persistência/contrato/custo (15.1-15.8).
- **F37.2-17** (tasks §16) — Testes UI/gates/legado/admin/rota (16.1-16.8).
- **F37.2-18** (tasks §17) — Regressão e co-migração de fixtures (17.1-17.6).
- **F37.2-19** (tasks §18-19) — Verificação final: 4 gates + UAT §12 + VERIFICATION.md + revisão humana da base.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec base da fatia (fonte da verdade)
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/proposal.md` — why/what changes, capabilities (novas + modificadas), impacto, migrations, sem mudança
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/design.md` — D1–D10 + estado real do código + Risks/Migration Plan/Open Questions
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/tasks.md` — 19 seções de tarefas executáveis
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/campaign-correction-reports/spec.md` — tabelas pai/filha, CHECKs, RPCs begin/complete_analysis/fail/recover/consume/complete_v2
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/campaign-correction-analysis/spec.md` — CorrectionIntentService, taxonomia, custo call-level
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/campaign-problem-report/spec.md` — modal/rota problem-report/NDJSON/sem v1 como referência
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/campaign-approval-gate/spec.md` — ApprovalDisplayState/tela revisão/rota approve protegida + REMOVED "nenhum fluxo de correção"
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/campaign-art-versions/spec.md` — `superseded`, tipos, persistência v2/demissão v1
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/ai-image-generation/spec.md` — hook + bloco único + skip input_validation + eventos mesmo run
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/ai-cost-tracker/spec.md` — novo `generation_type` + evolução do CHECK
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/admin-campaign-reports/spec.md` — fila admin
- `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/specs/campaign-page-ui/spec.md` — estados regenerating/pending v2 na página

### Alinhamento F37 (referência normativa complementar)
- `docs/alinhamento-fase-37-revisao-aprovacao-arte.md` — §3 D37.2-R1…R8, §4 política (taxonomia), §5 estados UX, §6 cuidados arquiteturais, §7 contratos, §8 testes, §9 riscos, §10 fora de escopo, §11 abandonado, §12 checklist

### Base concluída (F37.1) e padrões de planejamento
- `openspec/changes/archive/2026-09-02-fase-37-1-approval-gate-candidata-unica/` — base F37.1 (contrato preservado)
- `.planning/phases/37.1-approval-gate-candidata-unica/37-1-CONTEXT.md` + `37-1-01..15-PLAN.md` — formato de CONTEXT/PLAN da fase
- `supabase/migrations/20260905000001_f37_2_correction_rpcs.sql` — RPCs **dormentes** (histórico; NÃO reutilizar/alterar)

### Código fonte (para replicar padrões / pontos de mudança)
- `src/lib/feature-flags/feature-flag-service.ts` — flag `campaign_approval_enabled` (fail-closed)
- `src/lib/campaign/display.ts` — `ApprovalDisplayState`/`computeApprovalState`/`isDeliveryReleased`/`getActiveCandidateArtVersion`/`generateSignedPreviewUrl`
- `src/lib/campaign/persistence.ts` — `createArtVersion`/`listArtVersions`/`createCampaign`/`uploadCampaignInputImage`/`removeCampaignInputs`
- `src/lib/campaign/types.ts` — `CampaignArtVersion`/`ArtAssetStatus`/`CampaignRecord`
- `src/app/api/campaign/[id]/approve/route.ts` — ponto de troca do alvo do RPC
- `src/app/api/campaign/[id]/download/route.ts` e `publication-copy/route.ts` — gates preservados
- `src/app/(app)/campanhas/[id]/page.tsx` e `client.tsx` — estados da página
- `src/components/campaign/campaign-approval-view.tsx` — botão atual + ponto do segundo botão
- `src/app/api/campaign/generate-image/route.ts` — pipeline inicial (referência de NDJSON/stream/crédito/eventos)
- `src/lib/image-generation/services/image-generation-service.ts` — `generateImage`/`generateWithRetry`/`assemblePrompt`/fases
- `src/lib/image-generation/services/art-director-briefing.ts` — `sanitizePromptText`/`splitDirectorLegalText` (F45)
- `src/lib/text-provider/types.ts` + factory `createTextProvider` — `generateText`/`TextProviderResult`/`TextProvider.name`
- `src/lib/visual-signature/types.ts` — union `GenerationEventType` (12 valores) + contrato `AiCostTracker`
- `src/lib/visual-signature/generation-events.ts` — `AiCostTracker`/`resolveAiCost`
- `src/app/(app)/admin/layout.tsx` + `admin/feature-flags`/`admin/access-requests` — padrão de páginas admin
- `supabase/migrations/20260901000001_f37_1_create_campaign_art_versions.sql` e `20260901000002_f37_1_approve_campaign_art_version_rpc.sql` — schema/base F37.1
- `supabase/migrations/20260821000001_f43_create_feature_flags.sql` — padrão RLS/policy/RPC service_role
</canonical_refs>

<specifics>
## Specific Ideas

- **Migrations (prefixo > `20260905000001`, sufixo distinto do dormente):** M1 `campaign_correction_reports` + `campaign_correction_submissions` + troca do CHECK `asset_status` + CHECKs semânticos; M2 `begin_campaign_correction_submission` + `consume_campaign_correction_opportunity`; M3 `complete_campaign_correction_v2` + `fail_campaign_correction_v2` + `complete_campaign_correction_analysis` + `recover_campaign_correction_generation` + `approve_campaign_candidate`; M4 evolução do CHECK `chk_generation_events_type`.
- **Status/erros:** `problem-report` → 400 (vazio/pontuação) / 403 (flag off) / 409 (não-ready, consumido, rate limit, analysis_in_progress) / 200 JSON (blocked/unclear) / NDJSON (eligible). RPCs → `no_active_candidate`, `campaign_not_found`, `campaign_not_pending`, `already_consumed`, `analysis_in_progress`, `rate_limit_exceeded`, `report_campaign_mismatch` (404), `report_not_open`, `version_mismatch`, `submission_stale`, `submission_not_eligible`, `submission_not_analyzing`, `analysis_lease_expired`, `invalid_analysis_state`, `eligible_requires_category_and_instruction`, `non_eligible_must_not_have_generation_fields`, `report_not_generation_started`, `correction_in_progress`, `version_not_active`.
- **Constantes:** `CORRECTION_GENERATION_STALE_AFTER_MS = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30s`; SQL default `330 seconds`; `analysis_expires_at = now() + 2 minutes`; janela rate limit 30 min; teto absoluto 3 tentativas.
- **Novo `generation_type`:** `campaign_correction_analysis` (13º valor do union; `operationRunType: "campaign_delivery"`; `attemptNumber` = `attempt_number`).
- **Taxonomia §4:** elegível = elemento obrigatório cortado; logo/produto/texto gravemente cortados; texto ilegível/corrompido; dado divergente do briefing; informação inventada; texto/badge/elemento duplicado; produto deformado; falha grave de composição impeditiva. Bloqueado = alterar dado aprovado; mudar preço/validade/produto/badge/fundo/identidade por preferência; reposicionar/reestilizar sem defeito; "não gostei"/"outra opção"; rebriefing/estética. **Identificadores estáveis de `category`** são definidos na implementação (o spec dá o exemplo `truncated_element`) — verificar com o alinhamento §4 e manter estáveis no schema/prompt.
- **Testes:** grupos §12 (análise 12.1-12.9), §13 (begin 13.1-13.10), §14 (consumo/serialização/recuperação 14.1-14.9), §15 (v2/geração/persistência/contrato/custo 15.1-15.8), §16 (UI/gates/admin/rota 16.1-16.8), §17 (regressão/co-migração 17.1-17.6); RPCs validadas por leitura da migration do disco (padrão F37.1).
- **UAT §12:** flag ligada/desligada, legado, modal, elegível→v2, blocked/unclear, rate limit, regenerating, corrida aprovar×consumir, admin, mobile 320/375px.
- **Deploy:** migrations antes do código que as consome; flag default `false` (fail-closed).
</specifics>

<deferred>
## Deferred Ideas

- **Antiga 37.2 "Correção Visual Com Referência"** (parser heurístico, `visual_adjustment`/`creative_remake`, `candidateArtDataUrl`, cap 2, `prompts/regen/*`, modal 2 etapas, rota `/regenerate`) — abandonada; backup `backup/fase-37-antes-realignment`.
- **F37.3 "Correção Única por Não Conformidade" como fatia independente** — eliminada; consolidada nesta F37.2 realinhada.
- **Correção factual de briefing** (`briefPatch`/snapshot corrigido) — removida do escopo.
- **Refinamento financeiro amplo** (agregar/expor `campaign_correction_analysis` no painel F38.2, custo por tentativa) — fase futura.
- **Cron/reconciliador** — recuperação é lazy (na borda), sem cron nesta fase.
- **Galeria de versões, retorno à v1 pela UX, v3, multi-approver, notificações, i18n, Stripe/F44** — fora da fase.
</deferred>

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Context gathered: 2026-09-10 via OpenSpec base (fonte da verdade, decisão do usuário)*
