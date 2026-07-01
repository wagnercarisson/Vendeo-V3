## Why

A fase 4.6.2 implementou detecção de drift com política única de 4 campos (`segment`, `subsegment`, `tone_of_voice`, `name`), válida para todos os estados de identidade. A fase 4.6.2.1 expandiu o snapshot para 7 campos e preparou o terreno deixando `positioning`, `short_description` e `slogan` capturados mas inertes. Esta fase define **políticas de drift diferentes por estado de identidade**, introduzindo a distinção entre campos críticos (exigem nova assinatura visual) e campos sensíveis (exigem re-inferência do brand profile apenas), além do fluxo de substituição excepcional de VS para drift crítico com dois tiers de safety.

## What Changes

- `DRIFT_FIELDS` vira função `getDriftPolicy(identityState, contentUsed?)` que retorna `{ sensitive: string[], critical: string[] }` — três matrizes diferentes (text_only: 7 campos drift simples; logo: 6 campos, `name` excluído; visual_signature: 4 sensíveis + N críticos condicionais)
- Novos tipos: `DriftCategory = 'critical' | 'sensitive' | 'none'`, `evaluateCriticalDrift()`, `evaluateSensitiveDrift()` como funções independentes em `src/lib/drift.ts`
- VS snapshot (11 campos) passa a ser fonte canônica para TODOS os campos críticos (name, segment, slogan, city, state) — eliminando ambiguidade com o BP snapshot (7 campos, usado apenas para drift sensível)
- **NOVO:** Fluxo de substituição excepcional de VS para drift crítico: DriftCriticalModal → ApprovalModal com `mode: 'substitution'` → geração via `/generate-without-logo` com revalidação server-side → aprovação com dois tiers de safety:
  - **Tier 1 (archive/activate):** VS ativa marcada como `archived` ANTES de ativar a nova (`draft → active`); se a ativação falhar, VS anterior restaurada para `active` — compensação testada. **Nunca podem existir duas VS com status `active` simultaneamente.**
  - **Tier 2 (BP generation):** gerado após ativação da nova VS; se falhar, nova VS PERMANECE ativa e BP anterior continua como fallback. UI exibe warning/retry do BP. Falha no Tier 2 não desfaz a nova VS.
- **NOVO:** `POST /api/store/[id]/visual-signature/dismiss-critical-drift` — persiste `visual_signature_drift_dismissed_snapshot` no metadata da VS ativa com valores atuais da loja (name, segment, slogan, city, state). Retorna 204.
- `POST /api/store/[id]/brand-profile/realign` passa a decidir estratégia por `identity_state`: text_only → inferência textual; logo → Brand Director; visual_signature → profiler VS modo `regenerate` (preserva `content_used`, re-infere todos os campos brand)
- `src/lib/visual-signature/brand-profiler.ts`: adicionar `mode: 'reuse' | 'regenerate'` — modo `regenerate` ignora cache de perfil
- **NOVO:** `src/lib/visual-signature/drift-revalidator.ts` — revalidação server-side de drift crítico usando VS snapshot canônico
- `GET /api/store/[id]/visual-signature` retorna `critical_drift: { status: 'none' | 'new' | 'dismissed', fields: string[], reason: 'ok' | 'critical_drift' | 'missing_metadata' }`
- `GET /api/store/[id]/brand-profile` aceita parâmetro opcional `?status=synced` para o hook obter o perfil ativo
- Preview no Step 2 recebe badge "desalinhado" com tooltip quando `effectiveStatus === 'new'`
- Bifurcação do `handleStep2Submit` por `driftCategory`: critical → DriftCriticalModal, sensitive → DriftDecisionModal existente
- `src/components/flow/visual-signature-approval-modal.tsx`: adicionar prop `mode: 'standard' | 'substitution'`
- **NOVO:** `src/components/flow/drift-critical-modal.tsx` — modal para drift crítico VS:
  - **Com crédito** (< 3 assinaturas geradas com sucesso): abre ApprovalModal com `mode: 'substitution'`. Tentativas com falha não contam para o limite. O backend é a autoridade (`generate-without-logo/route.ts` guarda o limite).
  - **Sem crédito** (>= 3 assinaturas geradas com sucesso): alerta "Você já utilizou as 3 gerações disponíveis. Se remover esta assinatura, não será possível gerar uma nova até que a compra de créditos esteja disponível." Botões: [Manter direção atual] primário (persiste dismiss), [Remover mesmo assim] destrutivo, [Comprar créditos — Em breve] desabilitado (informativo). Compra de créditos e billing estão **fora do escopo** desta fase.
- Compensação no backend do realinhamento (POST /brand-profile/realign): inferência executada ANTES de qualquer mutação no banco. A regra de persistência varia por identity_state:
  - **text_only/logo:** perfil anterior marcado como `outdated` APÓS inferência bem-sucedida; novo perfil inserido com `status = 'synced'`; se o insert falhar, perfil anterior restaurado para `synced`
  - **VS sensível:** 3 ramos conforme estado do BP:
    - Ramo A (BP synced): UPDATE direto; falha mantém anterior intacto
    - Ramo B (BP failed/outdated + fallback synced): fallback outdated → UPDATE target para synced; falha restaura fallback
    - Ramo C (BP não existe / Tier 2 nunca gerou BP): fallback outdated → INSERT novo; falha restaura fallback
  - **Substituição crítica (nova VS):** INSERT normal de novo BP com novo visual_signature_id (índice único não conflita)
  - **Nunca podem existir dois registros `synced` simultâneos.** Inferência falha: perfil anterior NÃO marcado como outdated (permanece `synced`)
- **Alteração incompatível de contrato interno:** `computeDriftStatus` atualizado para aceitar `readonly string[]` de campos a comparar (em vez de fixo em 4)
- **Alteração incompatível de contrato interno:** `use-drift-detection.ts` retorna `driftCategory` separado de `driftStatus`. `hasCriticalDrift` substituído por `driftCategory === 'critical'`. Aceita `activeVsSummary: ActiveVisualSignatureSummary | null`.
- Nenhuma alteração no schema do banco — todos os dados vivem em JSONB existente
- **Não alterados:** `identity-transitions.ts` (contrato atual se mantém — a substituição excepcional não é uma transição de estado genérica, é tratada como fluxo específico documentado em `store-visual-signature` e `visual-signature-approval`), contrato de aprovação padrão (`text_only → visual_signature`), matriz `useIdentityActions`
- **Ondas obrigatórias de implementação:** A implementação será dividida em 7 ondas sequenciais com gates automáticos (TypeScript, lint, build, testes) e smoke test manual por onda antes de avançar: (1) congelamento e testes de regressão dos contratos existentes, (2) fundação do diagnóstico (evaluateCriticalDrift, evaluateSensitiveDrift), (3) diagnóstico no frontend com activeVsSummary, (4) realinhamento sensível por identity_state com compensação, (5) backend da substituição crítica, (6) UI e integração completa, (7) UAT formal único ao final cobrindo todos os cenários da matriz de drift

## Capabilities

### New Capabilities

<!-- Nenhuma capability nova — todas as alterações recaem sobre specs existentes -->

### Modified Capabilities

- `visual-direction-drift-detection`: `DRIFT_FIELDS` substituído por política por estado; `DriftCategory` adicionado; `evaluateCriticalDrift`/`evaluateSensitiveDrift` como funções independentes; propriedades ausentes em snapshots antigos tratadas como "não comparar"
- `store-brand-profile`: Estratégia de realinhamento por identity_state no endpoint realign; `GET ?status=synced`; compensação nos três caminhos de realinhamento (text_only, logo, visual_signature); profiler mode 'regenerate'
- `store-brand-profiler-without-logo`: Adicionar `mode: 'reuse' | 'regenerate'` — modo `regenerate` ignora cache de perfil existente, re-infere todos os campos brand preservando `content_used`, `visual_signature_id` e metadados da VS no BP
- `store-visual-signature`: `POST /generate-without-logo` aceita `mode: 'standard' | 'substitution'`; `POST /dismiss-critical-drift`; GET retorna `critical_drift.status` + `critical_drift.fields` + `critical_drift.reason`; VS snapshot como fonte canônica para campos críticos; guardas do backend (lock de geração, revalidação de drift, limite de assinaturas)
- `visual-signature-approval`: `POST /approve` com mode:'substitution' e dois tiers de safety (Tier 1: archive/activate com compensação; Tier 2: BP com fallback sem desfazer ativação); `VisualSignatureApprovalModal` com prop `mode: 'standard' | 'substitution'` — em modo substitution, modal sempre começa em checking e chama `/generate-without-logo` com `mode: 'substitution'`
- `store-identity-ui`: Badge "desalinhado" na preview (apenas quando `effectiveStatus === 'new'`); bifurcação do save por driftCategory; DriftCriticalModal novo (com/sem crédito); `use-drift-detection` retorna `driftCategory` + aceita `activeVsSummary`; DriftDecisionModal com estado de erro/retry

## Impact

- **Core**: `src/lib/drift.ts` (getDriftPolicy, DriftCategory, evaluateCriticalDrift, evaluateSensitiveDrift, computeDriftStatus com campos parametrizáveis)
- **NOVO**: `src/lib/visual-signature/drift-revalidator.ts` (revalidação server-side VS)
- **NOVO**: `src/app/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts` (POST, 204)
- **NOVO**: `src/components/flow/drift-critical-modal.tsx` (modal de drift crítico VS)
- **Modificado**: `src/lib/visual-signature/drift-validator.ts` (props ausentes), `src/lib/visual-signature/brand-profiler.ts` (mode regenerate), `src/lib/snapshot.ts` (sem mudanças — já captura 7 campos)
- **Backend**: `generate-without-logo/route.ts` (mode + revalidação), `approve/route.ts` (mode substitution, dois tiers), `realign/route.ts` (estratégia por identity_state + compensação), `brand-profile/route.ts` (GET ?status=synced), `visual-signature/route.ts` (GET critical_drift.status)
- **Frontend**: `use-drift-detection.ts` (driftCategory + activeVsSummary), `store-identity-form.tsx` (bifurcação handleStep2Submit), `store-preview.tsx` (badge), `drift-decision-modal.tsx` (error/retry), `visual-signature-approval-modal.tsx` (mode prop)
- **Testes**: Compensação nos três caminhos de realinhamento (text_only, logo, visual_signature); evaluateCriticalDrift/evaluateSensitiveDrift; revalidação server-side; fluxo completo de substituição com e sem crédito; UAT formal ao final cobrindo todos os cenários da matriz de drift
- **Nenhuma migration** necessária
- **Nenhuma alteração** em storage, prompts de IA, ou design system tokens
