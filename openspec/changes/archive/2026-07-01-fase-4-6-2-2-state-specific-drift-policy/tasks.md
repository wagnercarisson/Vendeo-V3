## Tasks

### Onda 1 — Congelamento e regressão

- [x] 1.1 Adicionar/confirmar testes de regressão para `src/lib/drift.ts` (DRIFT_FIELDS, computeDriftStatus, DriftStatus)
- [x] 1.2 Adicionar/confirmar testes de regressão para `src/lib/visual-signature/drift-validator.ts`
- [x] 1.3 Adicionar/confirmar testes de regressão para `src/lib/visual-signature/brand-profiler.ts`
- [x] 1.4 Adicionar/confirmar testes de regressão para endpoints modificados (realign, generate-without-logo, approve, visual-signature GET)
- [x] 1.5 Adicionar/confirmar testes de regressão para frontend (use-drift-detection, handleStep2Submit, store-preview, drift-decision-modal)
- [x] 1.6 Executar TypeScript build e lint — linha de base limpa antes de qualquer alteração
- [x] 1.7 Smoke test manual: fluxo text_only + logo + VS sem drift funciona como antes
- [x] **Gate:** TypeScript, lint, build, testes automatizados, smoke test manual — todos verdes. Bloquear avanço se algum falhar.

### Onda 2 — Fundação do diagnóstico

- [x] 2.1 `src/lib/drift.ts`: substituir `DRIFT_FIELDS` por `getDriftPolicy(identityState, contentUsed?)` com as 3 matrizes (text_only: 7 sensíveis; logo: 6 sensíveis; visual_signature: 4 sensíveis + N críticos condicionais)
- [x] 2.2 `src/lib/drift.ts`: adicionar type `DriftCategory = 'critical' | 'sensitive' | 'none'`
- [x] 2.3 `src/lib/drift.ts`: implementar `evaluateCriticalDrift(vsSnapshot, contentUsed, store)` server-side — compara VS input_snapshot (11 campos) com store atual, respeita content_used
- [x] 2.4 `src/lib/drift.ts`: implementar `evaluateSensitiveDrift(bpSnapshot, store, fields)` — compara BP input_snapshot (7 campos) com store atual usando field list fornecida
- [x] 2.5 `src/lib/drift.ts`: atualizar `computeDriftStatus` para aceitar `fields: readonly string[]` obrigatório (quebrar compatibilidade — todos os callers migrados explicitamente)
- [x] 2.6 `src/lib/drift.ts`: props ausentes em snapshots antigos tratadas como "não comparar" (skip)
- [x] 2.7 `src/lib/visual-signature/drift-validator.ts`: expandir `validateDrift` para tratar props ausentes sem lançar erro (consistente com evaluateCriticalDrift)
- [x] 2.8 `src/lib/visual-signature/drift-revalidator.ts`: NOVO — revalidação server-side de drift crítico usando VS snapshot canônico
- [x] 2.9 TypeScript check + testes unitários de getDriftPolicy, evaluateCriticalDrift, evaluateSensitiveDrift, computeDriftStatus
- [x] 2.10 Smoke test: todas as 3 políticas retornam fields corretos; props ausentes não disparam falso drift
- [x] **Gate:** TypeScript, lint, build, testes automatizados, smoke test manual — todos verdes. Bloquear avanço se algum falhar.

### Onda 3 — Diagnóstico no frontend

- [x] 3.1 `src/components/flow/use-drift-detection.ts`: adicionar `driftCategory`, `activeVsSummary` ao retorno; remover `hasCriticalDrift`
- [x] 3.2 `src/components/flow/use-drift-detection.ts`: consumir GET /visual-signature para obter `activeVsSummary.critical_drift` (apenas critical — sensitive permanece local)
- [x] 3.3 `src/app/api/store/[id]/brand-profile/route.ts` (GET): aceitar `?status=synced` — retorna perfil ativo ou null
- [x] 3.4 `src/app/api/store/[id]/visual-signature/route.ts` (GET): expandir resposta com `critical_drift: { status, fields, reason } | null` por assinatura (não-nulo apenas no item active)
- [x] 3.5 TypeScript check + testes: GET /brand-profile?status=synced retorna filtrado corretamente; GET /visual-signature retorna critical_drift apenas no active
- [x] 3.6 Smoke test: abrir Step 2 com VS ativa → hook retorna driftCategory e activeVsSummary; sem VS → activeVsSummary null
- [x] **Gate:** TypeScript, lint, build, testes automatizados, smoke test manual — todos verdes. Bloquear avanço se algum falhar.

### Onda 4 — Realinhamento sensível por identity_state com compensação

- [x] 4.1 `src/app/api/store/[id]/brand-profile/realign/route.ts`: implementar estratégia por identity_state (text_only → BrandTextOnlyInferenceService; logo → BrandDirectorService; visual_signature → BrandProfilerWithoutLogoService)
- [x] 4.2 `src/app/api/store/[id]/brand-profile/realign/route.ts`: implementar compensação heterogênea:
  - text_only/logo: inferir ANTES de mutar; marcar outdated APÓS inferência; INSERT novo; restaurar synced se insert falhar
  - VS sensível: inferir (mode:'regenerate') ANTES de mutar; 3 ramos de persistência:
    - Ramo A (BP synced): UPDATE direto; falha mantém anterior intacto
    - Ramo B (BP failed/outdated + fallback synced): fallback outdated → UPDATE target para synced; falha restaura fallback
    - Ramo C (BP não existe / Tier 2 nunca gerou): fallback outdated → INSERT novo; falha restaura fallback
- [x] 4.3 `src/app/api/store/[id]/brand-profile/realign/route.ts`: no caminho visual_signature, ler content_used da VS metadata (não do perfil anterior)
- [x] 4.4 `src/lib/visual-signature/brand-profiler.ts`: adicionar `mode: 'reuse' | 'regenerate'`; 'regenerate' ignora cache, re-infere todos os campos, persiste em 3 ramos: Ramo A (UPDATE do BP synced); Ramo B (UPDATE de failed/outdated com compensação do fallback); Ramo C (INSERT quando BP não existe). Preserva content_used + visual_signature_id
- [x] 4.5 TypeScript check + testes: compensação nos 3 caminhos (text_only: INSERT; logo: INSERT; VS: 3 ramos A/B/C); mode regenerate re-infere sem cache; falha não marca outdated; Ramo A: UPDATE sem duplicata; Ramo B: update falha restaura fallback; Ramo C: insert falha restaura fallback
- [x] 4.6 Smoke test: VS + drift sensível → realinhar → 3 ramos: A (BP synced: UPDATE), B (BP failed + fallback: fallback outdated → UPDATE target), C (BP inexistente: INSERT); falha em cada ramo → anterior/fallback restaurado
- [x] **Gate:** TypeScript, lint, build, testes automatizados, smoke test manual — todos verdes. Bloquear avanço se algum falhar.

### Onda 5 — Backend substituição crítica

- [x] 5.1 `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`: aceitar `mode: 'standard' | 'substitution'` no body
- [x] 5.2 `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`: implementar guardas p/substitution (lock, identity_state, VS ativa, drift revalidado via drift-revalidator.ts, limite de 3 signatures — conta apenas `ai_generated` e `automatic_generated`, tentativas falhas NÃO contam, drafts históricos não bloqueiam)
- [x] 5.3 `src/app/api/store/[id]/visual-signature/approve/route.ts`: aceitar `mode: 'substitution'` com payload `{ signatureId, mode }` (camelCase)
- [x] 5.4 `src/app/api/store/[id]/visual-signature/approve/route.ts`: implementar fluxo substitution — revalidar drift (VS ativa, não nova), arquivar VS anterior, ativar nova, restaurar se falhar
- [x] 5.5 `src/app/api/store/[id]/visual-signature/approve/route.ts`: executar BP generation (fluxo normal, NÃO mode:'regenerate') apenas se Tier 1 ok; cobrir falha de inferência/profiler e falha de insert — em ambos: nova VS permanece ativa, BP anterior permanece synced, HTTP 200 com warning/retry
- [x] 5.6 `src/app/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts`: NOVO endpoint POST 204 — persiste `visual_signature_drift_dismissed_snapshot` no metadata da VS ativa com valores atuais de name, segment, slogan, city, state; merge preserva toda metadata existente
- [x] 5.7 TypeScript check + testes: guardas de substitution (cada falha → 4xx específico); approve substitution archive/activate com compensação; dismiss persiste snapshot
- [x] 5.8 Smoke test: gerar VS substitution → aprovar → VS anterior arquivada + nova ativa + BP gerado; ativação falha → VS anterior restaurada; BP falha → nova VS ativa + BP anterior synced
- [x] **Gate:** TypeScript, lint, build, testes automatizados, smoke test manual — todos verdes. Bloquear avanço se algum falhar.

### Onda 6 — UI e integração completa

- [x] 6.1 `src/components/flow/drift-critical-modal.tsx`: NOVO modal com textos alinhados ("Assinatura visual desatualizada"); bifurcação com/sem crédito; dismiss + save via POST /dismiss-critical-drift
- [x] 6.2 `src/components/flow/visual-signature-approval-modal.tsx`: adicionar prop `mode: 'standard' | 'substitution'`; em substitution, começa em checking e chama /generate-without-logo uma vez; após aprovação, se Tier 2 falhar (bp_status:'failed'), exibir warning + botão "Tentar novamente" que chama POST /brand-profile/realign
- [x] 6.3 `src/components/flow/store-identity-form.tsx`: handleStep2Submit com precedência — se criticalStatus === 'new' → DriftCriticalModal; senão se sensitiveStatus === 'new' → DriftDecisionModal (expandido); senão → salvar. Incluir critical dismissed + sensitive new → DriftDecisionModal
- [x] 6.4 `src/components/flow/store-identity-form.tsx`: dispatcher de realinhamento muda de POST /infer para POST /realign
- [x] 6.5 `src/components/flow/store-preview.tsx`: adicionar badge "Desalinhado" quando effectiveStatus === 'new' (nenhum badge quando dismissed)
- [x] 6.6 `src/components/flow/drift-decision-modal.tsx`: adicionar estado de erro/retry — "Tentar novamente" (retry), "Continuar por agora" (salva sem dismiss), "Manter e salvar" (persiste dismiss)
- [x] 6.7 TypeScript check + testes: modais abrem com condição correta; fluxos com/sem crédito; badge aparece só quando new
- [x] 6.8 Smoke test: drift crítico com crédito → substitution → geração → aprovação; drift crítico sem crédito → dismiss → save; drift sensível → realinhar → BP atualizado; erro → "Tentar novamente"/"Continuar por agora"
- [x] **Gate:** TypeScript, lint, build, testes automatizados, smoke test manual — todos verdes. Bloquear avanço se algum falhar.

### Onda 7 — UAT formal

- [x] 7.1 Cenários aplicáveis por identity_state (NÃO produto cartesiano):
  - text_only: drift sensível → realinhar; drift sensível → manter; sem drift → salvar
  - logo: drift sensível → realinhar; drift sensível → manter; sem drift → salvar
  - visual_signature: drift crítico com crédito → substitution; drift crítico sem crédito → dismiss; drift crítico sem crédito → remover VS → text_only; drift sensível → realinhar; drift sensível → manter; critical dismissed + sensitive new → DriftDecisionModal; sem drift → salvar
- [x] 7.2 Falha Tier 1 (archive → activate → restore)
- [x] 7.3 Falha Tier 2 (profiler fail + insert fail — nova VS ativa, BP anterior synced)
- [x] 7.4 Limite de 3 gerações (bloqueia substitution, falhas não contam)
- [x] 7.5 Compra de créditos desabilitada (botão "Comprar créditos — Em breve" inativo)
- [x] 7.6 Aprovação standard sem regressão (text_only → visual_signature inalterado)
- [x] 7.7 Fluxo normal de remoção VS → text_only
- [x] 7.8 Verificar badge "Desalinhado" apenas quando effectiveStatus === 'new'
- [x] 7.9 Verificar que drafts históricos não bloqueiam substituição
- [x] 7.10 Verificar que identity-transitions NÃO é chamado na substituição
- [x] 7.11 Verificar que o save nunca é bloqueado (apenas orientado)
- [x] 7.12 Verificar backward compatibility: snapshots antigos sem campos não disparam falso drift
- [x] 7.13 Retry BP pós-Tier 2 via POST /realign → Ramo C: INSERT novo BP, fallback outdated
- [x] 7.14 Retry BP com BP failed existente → Ramo B: fallback outdated, UPDATE target para synced
- [x] 7.15 Retry BP: falha no Ramo B ou C → fallback restaurado para synced
