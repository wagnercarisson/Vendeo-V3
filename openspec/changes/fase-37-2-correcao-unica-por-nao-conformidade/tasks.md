## 1. Trackings — renumeração/registro F37.2 realinhada (D10 / padrão fases anteriores)

- [ ] 1.1 **Pré-requisito:** confirmar F37.1 arquivada (fonte da verdade `openspec/changes/archive/2026-09-02-fase-37-1-approval-gate-candidata-unica`) e F45 concluída nos trackings (`.planning/STATE.md`, `ROADMAP.md` raiz); F37 em execução com fatias 37.1 ✓ / **37.2 realinhada (Correção Única por Não Conformidade)** em execução; F37.3 e antiga 37.2 abandonadas (backup `backup/fase-37-antes-realignment`) — D10/D11/D12
- [ ] 1.2 `.planning/ROADMAP.md`: atualizar a seção Fase 37 com a F37.2 realinhada (goal/success criteria/dependencies; source of truth `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`); rodapé "Last updated" — D10
- [ ] 1.3 `.planning/STATE.md`: `current_phase: 37` (F37.2 em execução); seção Fase 37 com 37.1 ✓ → 37.2 realinhada; "Last updated" — D10
- [ ] 1.4 `.planning/PROJECT.md`/`MILESTONES.md`/`REQUIREMENTS.md`: F37.2 realinhada em execução; confirmar F38–F43/F45 concluídas e Stripe/F44 fora da numeração — D10
- [ ] 1.5 Verificação de consistência: grep nos trackings por "37.2" (realinhada, sem referência à antiga 37.2/37.3 em execução) e zero resíduos de "37.3"/antiga 37.2 ativos — padrão F43-01 — D10

## 2. Migrations — tabelas pai + filha + troca do CHECK de asset_status (R5/§6.3)

- [ ] 2.1 Migration idempotente `..._f37_2_create_campaign_correction_tables.sql` (prefixo > `20260905000001`): tabela pai `campaign_correction_reports` (`id` PK, `campaign_id` FK CASCADE + **UNIQUE(campaign_id)**, `store_id` FK stores, `reported_version_id` FK campaign_art_versions NOT NULL, `generated_version_id` FK nullable, `status` CHECK `open|generation_started|v2_generated|failed_no_v2` default 'open', `generation_started_at`, `operation_run_id`, `reviewed_by_support_at`/`reviewed_by_support_user`, `created_at`/`updated_at`) + RLS service_role (padrão `feature_flags`) — R5
- [ ] 2.2 Tabela filha `campaign_correction_submissions` na mesma migration: `id` PK, `report_id` FK CASCADE, **`attempt_number` smallint NOT NULL + `UNIQUE(report_id, attempt_number)`** (ordenação determinística da submissão vigente — achado 3), `text` NOT NULL, `analysis_state` CHECK `analyzing|eligible|blocked|unclear|analysis_failed` default 'analyzing', `category`, `normalized_instruction`, `analysis_expires_at` NOT NULL, `created_at` default now(), `completed_at` — **sem `campaign_id`** (campanha via `report_id`) — R5
- [ ] 2.3 **CHECKs semânticos da filha** (defesa em profundidade — revisão 4, achado 2): (a) `completed_at` só quando `analysis_state <> 'analyzing'`; (b) `eligible` exige `category IS NOT NULL` e `normalized_instruction IS NOT NULL` com `trim <> ''`; (c) `blocked|unclear|analysis_failed` exigem `category IS NULL` e `normalized_instruction IS NULL` — via bloco idempotente `DO $$` (padrão do repositório) — R5
- [ ] 2.4 **Troca transacional e idempotente do CHECK de `asset_status`** em `campaign_art_versions`: `CHECK (asset_status IN ('active','discarded'))` → `CHECK (asset_status IN ('active','discarded','superseded'))` via bloco `DO $$ ... IF EXISTS (pg_constraint) THEN DROP ... END IF; ADD CONSTRAINT ...` (preservando `active|discarded`; padrão do CHECK `campaigns_approved_requires_version`) — R5/§6.3
- [ ] 2.5 RLS/policies service_role nas duas tabelas novas; REVOKE anon/authenticated; seção REVERT; **sem backfill**; **sem** tocar nas RPCs dormentes (`20260905000001_f37_2_correction_rpcs.sql`) — §6
- [ ] 2.6 **db push [BLOCKING]** ao remoto após aprovação da revisão (padrão fases anteriores; usuário aplica manualmente) — §6.3

## 3. Migrations — RPCs próprias do fluxo (R2/R3/R5/R8 + achados 1–3)

- [ ] 3.1 Migration `..._f37_2_correction_rpcs.sql` (nomes próprios; `SECURITY DEFINER`, `SET search_path=''`, service_role; **sem `CREATE OR REPLACE` sobre RPCs existentes**): RPC `begin_campaign_correction_submission(p_campaign_id uuid, p_text text)` — **locks candidata v1 → campanha → relato** (FOR UPDATE nessa ordem); valida no banco campanha `ready`/`pending_approval`/sem `approved_version_id`/`rejection_count=0`, candidata v1 `pending`/`active`, **ausência de v2** (fecha corrida com a aprovação); cria/localiza o relato pai → trava o relato → finaliza `analyzing` **expiradas** como `analysis_failed` (com `completed_at`) → **recusa `analyzing` ainda válida (`409 analysis_in_progress`)** → valida caso sem consumo → rate limit R3.1 (≤ 3 tentativas/30min por `report_id`+`created_at`; **4ª bloqueada mesmo após `analysis_failed`**) → **atribui `attempt_number` (`MAX+1` por `report_id`, sob o lock — achado 3)** → insere tentativa `analyzing` com `analysis_expires_at = now() + interval '2 minutes'`; retorna `{report_id, submission_id, attempt_number}` — R2/R3.1/R5 + achados 1/3
- [ ] 3.2 RPC `consume_campaign_correction_opportunity(p_campaign_id uuid, p_report_id uuid, p_submission_id uuid)`: locks **candidata → campanha → relato** (FOR UPDATE, nessa ordem); valida campanha `ready`/pendente/`rejection_count=0`, relato da campanha, `reported_version_id` = candidata travada, `status='open'`, submissão vigente `eligible` **e a mais recente por `attempt_number`** (`submission_stale` se houver `attempt_number` maior — achado 3); grava `rejection_count=1` + `correction_in_progress=true` + `status='generation_started'` + `generation_started_at=now()` — R3/R8 + achado 3
- [ ] 3.3 RPC **`complete_campaign_correction_v2(p_campaign_id, p_report_id, p_submission_id, p_storage_path, p_mime_type, p_generation_metadata, p_render_snapshot)`** (contrato fechado — achado 1): atômica com locks candidata → campanha → relato — valida `report.status='generation_started'` + `correction_in_progress=true` + `rejection_count=1` + `submission_id` mais recente por `attempt_number` + ausência de v2; **`brief_snapshot` copiado da v1 travada no banco (nunca do cliente)**; insere v2 (`version_number=2`, `pending`, `active`, `storage_path`/`mime_type` do asset gerado) → demove v1 para `superseded` (**path preservado**, `correction_in_progress=false`) → `report.status='v2_generated'`/`generated_version_id`; **sem incrementar `rejection_count`** (já é 1); dupla conclusão → 409 — R5 + achado 1
- [ ] 3.4 RPC **`fail_campaign_correction_v2(p_campaign_id, p_report_id)`** (nova, achado 2): atômica com locks candidata → campanha → relato — valida `report.status='generation_started'` + `correction_in_progress=true` (senão 409); **mantém `rejection_count=1`**, libera `correction_in_progress=false`, grava `report.status='failed_no_v2'`; v1 continua aprovável — R3/R5
- [ ] 3.5 RPC **`complete_campaign_correction_analysis(p_report_id, p_submission_id, p_attempt_number, p_analysis_state, p_category, p_normalized_instruction)`** (nova, achados 2/3 + revisões 4/5): **validação semântica** — estado final ∈ `eligible|blocked|unclear|analysis_failed` (nunca `analyzing`); `eligible` exige categoria permitida + instrução não vazia; `blocked|unclear|analysis_failed` **rejeitam** categoria/instrução não-nulas com `non_eligible_must_not_have_generation_fields` (**regra única**); violação → `invalid_analysis_state`/`eligible_requires_category_and_instruction`; `UPDATE ... WHERE id=p_submission_id AND report_id=p_report_id AND attempt_number=p_attempt_number AND analysis_state='analyzing' AND analysis_expires_at >= now() AND attempt_number = (SELECT MAX(attempt_number) ...)`; `rowcount=0` → `409` (`submission_not_analyzing`/`analysis_lease_expired`/`submission_stale`); grava `completed_at` — R2/R5
- [ ] 3.6 RPC **`recover_campaign_correction_generation(p_campaign_id uuid, p_stale_before timestamptz DEFAULT NULL)`** (nova, revisão 4 achado 1 + revisão 5 achados 1/2 — recuperação preguiçosa pós-consumo, sem cron): locks candidata → campanha → relato; teto executável `generation_started_at < COALESCE(p_stale_before, now() - interval '330 seconds')` (backend passa `CORRECTION_GENERATION_STALE_AFTER_MS = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30s`; default normativo 330s quando NULL — **SQL não lê env**); se `report.status='generation_started'` + `correction_in_progress=true` + preso além do teto → mantém `rejection_count=1`, grava `failed_no_v2`, libera `correction_in_progress=false` (v1 volta a ser candidata/aprovável, **porém download/copy seguem bloqueados até aprovação explícita**), retorna `{recovered:true}`; senão no-op `{recovered:false}` — R3/R5
- [ ] 3.7 RPC `approve_campaign_candidate(p_campaign_id uuid, p_version_id uuid)`: trava a candidata primeiro (FOR UPDATE); valida pertence à campanha, `status='pending'`, `asset_status='active'` e `correction_in_progress=false` (senão → `409`); **chama a RPC F37.1 `approve_campaign_art_version` intacta na mesma transação** (re-trava a mesma linha — lock já mantido, sem deadlock) — R8
- [ ] 3.8 Migration `..._f37_2_generation_events_type.sql` (**achado 4**): evolução idempotente do CHECK `chk_generation_events_type` (bloco `DROP CONSTRAINT IF EXISTS`/`ADD CONSTRAINT` no padrão F38.1/F44.1) acrescentando o novo tipo call-level da análise (`campaign_correction_analysis`) — aditiva e retrocompatível; seção REVERT
- [ ] 3.9 **Delta MODIFIED da capability `ai-cost-tracker`** (fonte normativa do `generationType`/`AiCostEvent`/CHECK): registrar o novo literal `campaign_correction_analysis`, a evolução do CHECK e o registro de eventos da análise no mesmo `operation_run_id` com `attemptNumber` = `attempt_number` da submissão (specs/ai-cost-tracker/spec.md) — achado 4
- [ ] 3.10 REVOKE/GRANT service_role em todas as RPCs; seção REVERT; **sem alterar** `approve_campaign_art_version` nem as RPCs dormentes — §6
- [ ] 3.11 **db push [BLOCKING]** ao remoto após aprovação da revisão — §6.3

## 4. Persistência — correção (R5): tipos + funções do caso/tentativas

- [ ] 4.1 `src/lib/campaign/types.ts` (ou módulo próprio): tipos do caso de correção — `CorrectionReportStatus`, `CorrectionAnalysisState`, `CorrectionReport`, `CorrectionSubmission` (com `report_id`, **`attempt_number`**, `text`, `analysis_state`, `category`, `normalized_instruction`, `analysis_expires_at`, `completed_at`) — R5
- [ ] 4.2 `src/lib/campaign/types.ts`: `ArtAssetStatus`/union `"active" | "discarded" | "superseded"` no `CampaignArtVersion.asset_status` (troca do tipo na 37.2) — R5
- [ ] 4.3 `src/lib/campaign/persistence.ts` ou `correction-reports.ts`: `getCorrectionReport(campaignId)`, `listCorrectionSubmissions(reportId)` (ordenadas por `attempt_number`), `createCorrectionReport` (se necessário p/ testes), **`completeCorrectionAnalysis`/`finalizeSubmission`** (chama a RPC `complete_campaign_correction_analysis` com `attempt_number` — não update TS direto), `listCorrectionReports({ filters, page })` (admin), `getCorrectionReportDetail(reportId)` (admin; com v1/v2 paths + submissions), `markReportReviewedBySupport(reportId, actorId)` — R5/R6
- [ ] 4.4 Invariantes: filha **sem `campaign_id`**; decisão corrente derivada da tentativa de **maior `attempt_number`**; aprovação **não espelhada** no relato (derivada de `campaigns`) — R5 + achado 3

## 5. Análise textual — CorrectionIntentService (R2)

- [ ] 5.1 `src/lib/campaign/correction-intent-service.ts`: `analyzeReport(text): Promise<CorrectionAnalysisResult>` via `createTextProvider()` — system prompt JSON estrito → `JSON.parse` defensivo → validação Zod (`eligible|blocked|unclear` + `category` + `normalizedInstruction` + `guidance`) — R2
- [ ] 5.2 Taxonomia da política (§4): categorias elegíveis (cortado, ilegível, divergente do brief, inventado, duplicado, deformado, composição impeditiva) e motivos bloqueados (mudança de dados por preferência, "outra opção", rebriefing/estética) no prompt e no schema — R2
- [ ] 5.3 Conteúdo não confiável: `text` do lojista e `normalizedInstruction` delimitados/saneados (`sanitizePromptText`, padrão F45); **nunca** sobrescrevem o briefing — R2/R4
- [ ] 5.4 Tratamento de saída fora do contrato: JSON inválido/fora do schema → `unclear`; timeout/transporte/vazio → `analysis_failed` — R2
- [ ] 5.5 `analysis_failed` conta como tentativa; reformulação imediata permitida **enquanto houver tentativas**; **após a 3ª tentativa a 4ª é bloqueada mesmo que a anterior tenha terminado em `analysis_failed`** — R3.1
- [ ] 5.6 **Custo da análise (achado 4):** registrar evento call-level via `AiCostTracker.record` no mesmo `operation_run_id` da campanha com novo `generationType` (`campaign_correction_analysis`), **`provider` = `textProvider.name`** (`TextProviderResult` só devolve `model`/`usage`), `model`/`usage` do `TextProviderResult`, `durationMs`, `status`, custo por `resolveAiCost`, `attemptNumber` = `attempt_number` da submissão; **sem** `credit_transactions`/`operation_key` novas — R4
- [ ] 5.7 Adicionar o literal novo no union `GenerationEventType` (`src/lib/visual-signature/types.ts`) + delta `ai-cost-tracker` (specs/ai-cost-tracker/spec.md) + garantir que a migration do CHECK `chk_generation_events_type` (task 3.7) foi aplicada antes (banco → código) — achado 4

## 6. Rota problem-report (R1/R2/R3)

- [ ] 6.1 Rota `src/app/api/campaign/[id]/problem-report/route.ts`: guards `requireSameOrigin` → `requireApiUser` → UUID v4 → `getCampaign` (404) → `requireOwnership` (404) → `isCampaignApprovalEnabled()` (flag off → 403) → `campaign.status === 'ready'` (senão 409) → zod `{ text }` strict → texto vazio/só pontuação → **400** (sem caso, sem IA) → caso sem consumo (relato inexistente ou `open`; consumido → 409) → rate limit R3.1 (após 3ª tentativa/30min → 409) — R1/R2
- [ ] 6.2 Envio válido → `rpc("begin_campaign_correction_submission", ...)` (locks candidata → campanha → relato; caso + 1ª tentativa `analyzing` nascem juntos **antes da IA**; corrida com a aprovação fechada no banco) → chama `CorrectionIntentService.analyzeReport(text)` — R2 + achado 1
- [ ] 6.3 `blocked`/`unclear` → `200 { analysisState, guidance }` (sem gerar/consumir; pode reformular); `analysis_failed` registrado; `eligible` → dispara o fluxo corretivo (R4/R7) — R2
- [ ] 6.4 Conclusão da análise: **`rpc("complete_campaign_correction_analysis", { report_id, submission_id, attempt_number, analysis_state, category, normalized_instruction })`** (guarda `analysis_state='analyzing'` + **lease `analysis_expires_at >= now()`** + **submissão mais recente por `attempt_number`** + **validação semântica do estado final**; resposta tardia → `409 analysis_lease_expired`/`submission_stale`/`submission_not_analyzing`, não sobrescreve; `eligible` sem categoria/instrução → erro; grava `completed_at`) — R2/R3.1 + achados 2/3 + revisão 4 achado 2
- [ ] 6.5 **NDJSON stream** no caminho `eligible` (padrão generate-image): fase `input_validation` (`skipped` via `brief_review_confirmed`) → `image_generation` (com consumo via hook no ponto do provider) → `done`/`error`; erro pré-provider → caso `open`; **erro pós-provider → `rpc("fail_campaign_correction_v2", ...)`** (atômico: mantém `rejection_count=1`, libera `correction_in_progress`, `failed_no_v2`; v1 aprovável) + remoção best-effort de asset órfão se o upload já tiver ocorrido — R3/R5 + achado 2
- [ ] 6.6 Sem reserva de crédito; eventos (análise + v2) sob `campaign.operation_run_id` (via `AiCostTracker.record`) — R4 + achado 4

## 7. Geração da v2 (R4) — pipeline + hook + bloco de não conformidade

- [ ] 7.1 `ImageGenerationService`: hook **aditivo opcional `onBeforeImageProviderCall`** (fire-once, imediatamente antes da 1ª chamada ao provider em `generateWithRetry`, iteração `attempt===0`); ausência = comportamento atual — R3/R4
- [ ] 7.2 Montagem do prompt da v2: diretor por intent (do snapshot `commercial.intent`) + **bloco único de não conformidade** acrescentado em tempo de montagem (preâmbulo fixo + `normalizedInstruction` saneada/delimitada) — **sem `candidateArtDataUrl`, sem editar os 4 `.md`** — R4
- [ ] 7.3 A v2 reutiliza: mesmo snapshot `campaign_brief_v1`, imagens F41 (`media.images[].storagePath` → data URLs) e identidade vigente; **sem copy director**; revisor automático intocado; `input_validation` `skipped` via `brief_review_confirmed` — R4
- [ ] 7.4 Fluxo corretivo dispara a RPC de consumo (`consume_campaign_correction_opportunity`) no hook (imediatamente antes do provider); sucesso → upload da v2 (storage próprio `{storeId}/{campaignId}/v2.jpg`) → RPC `complete_campaign_correction_v2` — R3/R5
- [ ] 7.5 Falha pré-provider → RPC de consumo NÃO roda (reenviar); falha pós-provider → `failed_no_v2`, v1 aprovável; **sem v3** — R3/R5

## 8. Aprovação protegida — rota approve chama approve_campaign_candidate (R8)

- [ ] 8.1 `src/app/api/campaign/[id]/approve/route.ts`: **chamar a recuperação lazy (`recover_campaign_correction_generation`, best-effort) antes** de trocar o alvo do RPC para `rpc("approve_campaign_candidate", { p_campaign_id, p_version_id })` — mantendo guards, mapeamento 404/409 e resposta `200` — R8 + revisão 4 achado 1
- [ ] 8.2 Mapear novos erros: `correction_in_progress` → 409 (regenerating — processo ainda vivo); v1 `superseded`/não `active` → `version_not_active` → 409 — R8/R5
- [ ] 8.3 Verificar ordem de locks consistente (candidata → campanha; consumo segue candidata → campanha → relato; recuperação lazy usa a mesma ordem) e ausência de deadlock; RPC F37.1 intacta dentro do wrapper — R8

## 9. UI — revisão com dois botões + modal (R1)

- [ ] 9.1 `src/components/campaign/campaign-problem-modal.tsx` (novo, client): preview da candidata ativa (signed URL), orientação corrigível × não corrigível, campo textarea obrigatório "Descreva o problema na arte", botões **[Enviar para análise]/[Cancelar]** — R1
- [ ] 9.2 Fechamentos sem efeito: **[Cancelar]**, X, ESC, backdrop — sem aprovar/enviar/criar caso — R1
- [ ] 9.3 Validação **no clique**: vazio/pontuação → erro amigável, **sem caso e sem IA** — R1/R2
- [ ] 9.4 `src/components/campaign/campaign-approval-view.tsx`: botão primário **[Aprovar arte]** + botão secundário **[Informar problema]** (abre o modal) no estado `pending` (v1); guarda de UX desabilita [Aprovar arte] com caso em processamento (reforço) — R1/R8
- [ ] 9.5 Estado pós-envio: processamento da análise/geração (não fecha o modal), orientação `blocked`/`unclear`/`analysis_failed` com reformulação, transição para `regenerating`/`pending`(v2) via `router.refresh()`; estados loading/erro PT-BR — R1/R2
- [ ] 9.6 A11y/mobile/tema: touch ≥ 44px, `label`/`aria`, `role="dialog"`, `aria-modal`, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`) — design-system

## 10. Página da campanha — estados regenerating / pending v2 / modal (R1/R7)

- [ ] 10.1 `src/app/(app)/campanhas/[id]/page.tsx`: para `ready`, **se o estado deriva `regenerating`, chamar a recuperação lazy (`recover_campaign_correction_generation`, best-effort); quando `recovered:true`, RECARREGAR campanha/versões do banco (nova leitura) antes de recalcular o estado** — nunca re-derivar sobre os mesmos objetos em memória; passar props para `pending` (v1 e v2) e `regenerating` — base F37.1 estendida — R1/R7 + revisão 4 achado 1 + revisão 6 achado 1
- [ ] 10.2 `client.tsx`: `regenerating` → estado de **progresso da v2** (sem download/copy/approve; **sem cair no `ReadyView`**); `pending` (v2) → [Aprovar arte] aprova a v2 (sem voltar à v1, sem [Informar problema]) — R7/R5
- [ ] 10.3 `CampaignApprovalView` recebe props/estado para exibir [Informar problema] apenas quando candidata v1 + oportunidade disponível — R1
- [ ] 10.4 Microcopy PT-BR de processamento ("Corrigindo a arte..."), a11y, tema dark — design-system

## 11. Admin — fila de relatos (R6)

- [ ] 11.1 Serviço interno admin: `listCorrectionReports({ filters, page })` e `getCorrectionReportDetail(reportId)` (com decisão corrente = tentativa de maior `attempt_number`; v1/v2 paths; status/consumo; `operation_run_id`; aprovação derivada de `campaigns`) — R6
- [ ] 11.2 `src/app/(app)/admin/campaign-reports/page.tsx` (server, `requireAdmin`): listagem com filtros (status do caso, `analysis_state` da tentativa vigente (maior `attempt_number`), revisado×não revisado) + paginação (padrão admin) — R6
- [ ] 11.3 `src/app/(app)/admin/campaign-reports/[reportId]/page.tsx` (server): detalhe com **v1 × v2 lado a lado** (signed URLs service_role — inclui v1 `superseded` preservada), **histórico de tentativas**, status/consumo, `operation_run_id` linkável ao painel F38.2, timestamps — R6/R5
- [ ] 11.4 Ação "marcar como revisado" (serviço interno/admin; ortogonal — não interfere no fluxo/oportunidade) — R6
- [ ] 11.5 Link `/admin/campaign-reports` no `src/app/(app)/admin/layout.tsx` — R6

## 12. Testes — análise/classificação (alinhamento §8.1)

- [ ] 12.1 Teste: texto vazio/pontuação → 400 **sem caso e sem chamada de IA** — R1/R2
- [ ] 12.2 Teste: caso + primeira tentativa (`analyzing`) nascem juntos **antes** da IA; tentativas posteriores = novas linhas da filha — R2/R5
- [ ] 12.3 Teste: cada categoria elegível (§4) classificada `eligible` com `category`/`normalizedInstruction` — R2
- [ ] 12.4 Teste: exemplos `blocked` (mudança de dados por preferência, "outra opção", rebriefing) → orientação, sem gerar/consumir — R2
- [ ] 12.5 Teste: `unclear` → orientação com exemplo, sem gerar/consumir; reformulação imediata não consome — R2
- [ ] 12.6 Teste: **JSON inválido/fora do schema → `unclear`** — R2
- [ ] 12.7 Teste: **timeout/transporte/vazio → `analysis_failed`** (registrada com `completed_at`, não consome) — R2
- [ ] 12.8 Teste: conteúdo não confiável não sobrescreve o briefing (anti-invenção) — R2/R4
- [ ] 12.9 Teste (achado 4): evento `campaign_correction_analysis` registrado no mesmo `operation_run_id` com `provider`/`model`/`usage`; falha registra `status: "failed"`; sem `credit_transactions`/`operation_key` novas — R4

## 13. Testes — lifecycle da tentativa (begin RPC) (alinhamento §8.2 + achados 1/3)

- [ ] 13.1 Teste: begin trava **candidata → campanha → relato** (mesma ordem das demais RPCs; serializa a criação do pai na 1ª submissão; `UNIQUE(campaign_id)` como defesa final) — R3.1 + achado 1
- [ ] 13.2 Teste: begin valida **no banco** pendência/candidata v1/ausência de v2 — **aprovação vencida antes do begin → 409 e nenhum caso/IA** (corrida fechada) — R3.1 + achado 1
- [ ] 13.3 Teste: tentativa `analyzing` expirada é finalizada como `analysis_failed` (com `completed_at`) no **próximo begin** (recuperação sem cron) — R3.1
- [ ] 13.4 Teste: linha sempre conclui com estado final + `completed_at`; janela ≤ 3 tentativas/30min por `report_id` + `created_at` — R3.1
- [ ] 13.5 Teste: **após a 3ª tentativa, a 4ª é bloqueada (409) mesmo que a anterior tenha terminado em `analysis_failed`** — R3.1 (limite absoluto)
- [ ] 13.6 Teste: serialização de tentativas simultâneas (sem perder atualização, sem > 3 análises concorrentes) — R3.1
- [ ] 13.7 Teste: **tentativa `analyzing` ainda válida → `409 analysis_in_progress`** (impede análise simultânea) — achado 3
- [ ] 13.8 Teste: **conclusão da análise condicionada a `analyzing` + lease (`analysis_expires_at >= now()`) + submissão mais recente por `attempt_number`** — resposta tardia para tentativa expirada/que não é a mais recente → `409 analysis_lease_expired`/`submission_stale`/`submission_not_analyzing` e nada é sobrescrito — achados 2/3
- [ ] 13.9 Teste: **validação semântica do estado final da análise (revisão 4 achado 2 + revisão 5 achado 3)** — `analyzing` rejeitado como estado final; `eligible` sem categoria permitida/instrução → erro; `blocked|unclear|analysis_failed` com categoria/instrução → **rejeitados** com `non_eligible_must_not_have_generation_fields` (regra única); CHECKs de tabela mantêm os invariantes (conclusão nunca deixa `analyzing` com `completed_at`)
- [ ] 13.10 Teste: **`attempt_number` sequencial por relato (`MAX+1`) com `UNIQUE(report_id, attempt_number)`**; ordenação determinística sem empate de `created_at` — achado 3

## 14. Testes — consumo e serialização aprovar × consumir (alinhamento §8.3/§8.4 + achados 1/2/3)

- [ ] 14.1 Teste: falha pré-provider **não chama a RPC de consumo** (caso `open`, pode reenviar) — R3
- [ ] 14.2 Teste: a RPC valida pendência + `rejection_count=0` + relato da campanha + `reported_version_id` = candidata travada + submissão vigente `eligible` **e mais recente por `attempt_number`** (`submission_stale` → 409); grava atomicamente `rejection_count=1` + `generation_started_at` + `status='generation_started'` — R3 + achado 3
- [ ] 14.3 Teste: **falha pós-provider → RPC `fail_campaign_correction_v2`** mantém `rejection_count=1`, libera `correction_in_progress`, grava `failed_no_v2`, v1 aprovável — R3 + achado 2
- [ ] 14.4 Teste: falha sem consumo (relato não `generation_started`) → `fail_campaign_correction_v2` responde 409 e nada altera — achado 2
- [ ] 14.5 Teste: sucesso não incrementa `rejection_count` de novo (conclusão da v2) — R3/R5
- [ ] 14.6 Teste: segunda tentativa após consumo → 409 (independentemente da janela) — R3.1
- [ ] 14.7 Teste serialização: consumo vence → aprovação protegida falha `409` (`correction_in_progress`); aprovação vence → **begin**/consumo falham na pendência e a geração é abortada **antes do provider** (sem custo, sem caso criado) — R8 + achado 1
- [ ] 14.8 Teste: RPC F37.1 chamada intacta dentro do wrapper `approve_campaign_candidate`; ordem de locks (candidata → campanha → relato) sem deadlock — R8
- [ ] 14.9 Teste recuperação preguiçosa (revisão 4 achado 1 + revisão 5 achados 1/2 + revisão 6 achado 1): consumo preso além do teto (`generation_started_at` < `p_stale_before` ou default 330s) → `recover_campaign_correction_generation` mantém `rejection_count=1`, grava `failed_no_v2`, libera `correction_in_progress` (v1 volta a ser candidata/aprovável — **download/copy continuam 403 até aprovação explícita**); consumo recente/`open`/`failed_no_v2`/`v2_generated` → no-op `{recovered:false}`; timeout executável: sem `p_stale_before` usa default normativo 330s (sem env no SQL); rota `approve` dispara a recuperação antes de aprovar e prossegue quando liberado; **no caller da página, quando `recovered:true` o estado é recalculado apenas após nova leitura de campanha/versões** — R3/R5

## 15. Testes — única v2, geração e persistência (alinhamento §8.5/§8.6/§8.7)

- [ ] 15.1 Teste: sem v3; UI sem galeria/retorno à v1; aprovar a v1 durante a análise nunca deixa geração paga rodando após a aprovação — R3/R5
- [ ] 15.2 Teste: geração v2 com brief idêntico (snapshot imutável), imagens F41 + identidade, **sem v1 como referência**, diretor por intent + bloco único — R4
- [ ] 15.3 Teste: prompts `.md` atuais com **diff vazio** (montagem em tempo de execução, sem editar arquivos) — R4
- [ ] 15.4 Teste: revisor intocado; `input_validation` `skipped`; eventos no mesmo `operation_run_id`; sem `credit_transactions`/`operation_key` novas — R4
- [ ] 15.5 Teste persistência: v1 preservada com path após sucesso (`superseded` via troca do CHECK preservando `active|discarded`); v2 candidata única; v1 não aprovável pela API depois da v2 — R5
- [ ] 15.6 Teste contrato da conclusão (achado 1): `complete_campaign_correction_v2` exige `campaign_id`/`report_id`/`submission_id` + dados do asset (`storage_path`/`mime_type`) + `generation_metadata`/`render_snapshot`; **`brief_snapshot` da v2 é copiado da v1 travada no banco** (nenhum parâmetro de snapshot aceito); validações derivadas do banco (submissão mais recente, `rejection_count=1`, ausência de v2, path distinto) — R5
- [ ] 15.7 Teste (achado 4): evento `campaign_correction_analysis` registrado no mesmo `operation_run_id` com `provider`/`model`/`usage` e `attempt_number` da submissão; falha registra `status: "failed"`; CHECK `chk_generation_events_type` aceita o novo literal; sem `credit_transactions`/`operation_key` novas — R4
- [ ] 15.8 Teste: relato sem colunas de aprovação espelhadas (fila deriva de `campaigns`); decisão corrente = tentativa de maior `attempt_number` da filha — R5/R6

## 16. Testes — UI, gates/legado e admin (alinhamento §8.8)

- [ ] 16.1 Teste: flag off e legacy intactos (entrega imediata); UI dos novos botões só em `pending` — R7
- [ ] 16.2 Teste: download/copy `regenerating` → 403 (inalterado) — R7
- [ ] 16.3 Teste: `pending` v1 exibe [Aprovar arte] + [Informar problema]; modal valida vazio/pontuação no clique; Cancelar/X/ESC/backdrop sem efeito — R1
- [ ] 16.4 Teste: `regenerating` exibe progresso da v2 sem actions de entrega/approve — R7
- [ ] 16.5 Teste: `pending` v2 exibe [Aprovar arte] (aprova a v2) sem [Informar problema]/volta à v1 — R5/R7
- [ ] 16.6 Teste admin: listagem com filtros (decisão da tentativa de maior `attempt_number`), detalhe v1×v2 lado a lado com **histórico de tentativas ordenado por `attempt_number`**, marcação revisado (ortogonal), aprovação por derivação — R6
- [ ] 16.7 Teste rota problem-report: guards (CSRF, auth, ownership, flag off → 403, não-ready → 409, consumido → 409, 4ª tentativa → 409) — R1/R3.1
- [ ] 16.8 Teste gates pós-recuperação (revisão 5 achado 1): após `recover_campaign_correction_generation` liberar a v1 (deriva `pending`), **download e copy continuam 403** até a aprovação explícita (`isDeliveryReleased` false para `pending`) — R7

## 17. Regressão e co-migração de fixtures

- [ ] 17.1 Co-migrar `route.test.ts` do `generate-image` (fluxo normal inalterado; sem hook — comportamento atual) — R4
- [ ] 17.2 Co-migrar suites F37.1: approve route (alvo do RPC → `approve_campaign_candidate`), display/approval states, download/publication-copy gates, página da campanha, admin feature-flags — R8/R7
- [ ] 17.3 Co-migrar fixtures de `campaign-art-versions` (asset_status `superseded`), `campaign-art-version` types e `display-approval` — R5
- [ ] 17.4 Novos testes unitários de persistência (pai/filha, RPCs por fonte — leitura da migration SQL do disco, padrão `campaign-approve-route.test.ts`) incluindo as RPCs novas (`begin` com locks candidata→campanha→relato, `complete_campaign_correction_analysis` com validação semântica, `fail_campaign_correction_v2`, `recover_campaign_correction_generation` com `p_stale_before`/default 330s, `consume` com submissão mais recente) — R5 + achados 1/2/3 + revisões 4/5
- [ ] 17.5 Regressão completa: `npx vitest run` — zero falhas (novos + co-migrados) — §8.9
- [ ] 17.6 Co-migrar testes do union `GenerationEventType`/tracker (novo literal `campaign_correction_analysis`; eventos call-level) — achado 4

## 18. Verificação (gates + UAT) (alinhamento §8.9/§12)

- [ ] 18.1 `npx vitest run` — zero falhas — §8.9
- [ ] 18.2 `npm run typecheck` — zero erros — §8.9
- [ ] 18.3 `npm run lint` — zero erros — §8.9
- [ ] 18.4 `npm run build` — build bem-sucedido — §8.9
- [ ] 18.5 UAT (flag ligada): gerar campanha nova → revisão `pending` (v1) com [Aprovar arte] + [Informar problema]; aprovar → entrega liberada — R1
- [ ] 18.6 UAT: modal — cancelar/X/ESC/backdrop sem efeito; texto vazio/pontuação → erro amigável (sem caso/IA); relato claro elegível → v2 gerada e vira candidata (v1 preservada) — R1/R5
- [ ] 18.7 UAT: relato `blocked`/`unclear` → orientação e reformulação imediata; 3 tentativas esgotadas → 4ª bloqueada — R2/R3.1
- [ ] 18.8 UAT: geração corretiva em andamento → estado `regenerating` (progresso, sem download/copy/approve); v2 → aprovar libera a entrega; sem galeria/volta à v1 — R7
- [ ] 18.9 UAT: corrida aprovar × consumir — aprovar durante processamento → 409; consumo vencido impede aprovação; aprovação vencida aborta geração antes do provider — R8
- [ ] 18.10 UAT: flag desligada e campanha legada → fluxo atual intacto (fail-closed) — R7
- [ ] 18.11 UAT admin: listagem/filtros, detalhe v1×v2 lado a lado com histórico de tentativas, marcação revisado (ortogonal), `operation_run_id` linkável — R6
- [ ] 18.12 UAT: mobile real/estreito (320px/375px) na revisão/modal — imagem sem recorte, touch ≥ 44px, sem scroll horizontal

## 19. Verificação final e registros

- [ ] 19.1 Verificação de artefatos (padrão fases anteriores): `43/45-VERIFICATION`-style — gates verdes + UAT aprovado + registro em `.planning/STATE.md`/`.planning/ROADMAP.md` — D10
- [ ] 19.2 Revisão humana da base técnica desta mudança (proposal/design/specs/tasks) antes de iniciar a implementação — ponto de controle (conforme orientação "aguardar revisão")
