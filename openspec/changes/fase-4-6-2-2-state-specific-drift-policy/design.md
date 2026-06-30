## Context

O drift detection atual (4.6.2) usa `DRIFT_FIELDS = ['segment', 'subsegment', 'tone_of_voice', 'name']` para todos os estados de identidade. A 4.6.2.1 expandiu o snapshot para 7 campos mas manteve a política de 4. Esta fase introduz políticas de drift distintas por `identity_state`, diagnóstico independente de critical vs sensitive drift, e o fluxo de substituição excepcional de VS para drift crítico.

### Estado atual relevante

- `src/lib/drift.ts`: `DRIFT_FIELDS` fixo (4 campos), `computeDriftStatus` usa apenas 4 campos. Sem `DriftCategory`, sem `evaluateCriticalDrift`/`evaluateSensitiveDrift`.
- `src/lib/visual-signature/drift-validator.ts`: Validates 5 campos (name, segment, city, state, slogan) para restore_eligibility. Usado pelo GET /visual-signature. Não tem critical_drift.status nem tratamento de dismiss.
- `src/lib/visual-signature/brand-profiler.ts`: `generate()` busca perfil existente por `visual_signature_id` e reusa se encontrar (`mode: 'reuse'` apenas). `markPreviousSyncedOutdated` chamado antes do insert — sem compensação se insert falhar.
- `src/app/api/store/[id]/brand-profile/realign/route.ts`: Endpoint único que infere + persiste. Marca perfil anterior como outdated ANTES de inserir o novo. Se insert falhar, perfil anterior não é restaurado (compensação ausente).
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`: Geração VS padrão. Tem lock por loja (Map em memória). Limite de 3 signatures. Não aceita `mode` parameter. Não revalida drift.
- `src/app/api/store/[id]/visual-signature/approve/route.ts`: Fluxo `text_only → visual_signature`. Valida transição via `assertCanTransition`. Não trata `mode: 'substitution'`.
- `src/app/api/store/[id]/visual-signature/route.ts` (GET): Retorna `restore_eligibility` com reason `'ok' | 'critical_drift' | 'missing_metadata'`. Não retorna `critical_drift.status` nem `visual_signature_drift_dismissed_snapshot`.
- `src/components/flow/use-drift-detection.ts`: Retorna `driftStatus`, `hasCriticalDrift` (driftedFields.some → criticalFields). Sem `driftCategory`, sem `activeVsSummary`.
- `src/components/flow/store-identity-form.tsx`: `handleStep2Submit` chama `computeDriftStatus` com 4 campos. Exibe DriftDecisionModal quando drift === 'new'. Sem bifurcação por estado.
- `src/components/flow/store-preview.tsx`: Sem badge de drift.

## Goals / Non-Goals

**Goals:**
- Política de drift por identity_state com três matrizes (text_only, logo, visual_signature)
- Diagnóstico independente: evaluateCriticalDrift (VS snapshot) e evaluateSensitiveDrift (BP snapshot)
- Fluxo de substituição excepcional de VS para drift crítico com dois tiers de safety
- Compensação em todos os caminhos de realinhamento (inferir antes de mutar)
- Badge "desalinhado" na preview apenas quando effectiveStatus === 'new'
- Dismiss crítico via POST dedicado, persistido no metadata da VS
- Brand profiler mode 'regenerate' para realinhamento VS sensível
- Backend revalida drift crítico antes de aceitar substituição

**Non-Goals:**
- Sistema de créditos/planos ou compra de créditos (billing fora de escopo)
- Transição genérica visual_signature → visual_signature (contrato identity-transitions preservado)
- Unificação drift-validator (VS restore) com o sistema de drift do brand profile
- Histórico de drift ou auditoria
- Notificações em dashboard ou superfícies globais
- Versionamento de snapshot (input_snapshot_version)

## Decisions

### Decisão: getDriftPolicy como função pura em drift.ts

`DRIFT_FIELDS` constante vira `getDriftPolicy(identityState, contentUsed?)` retornando `{ sensitive: readonly string[], critical: readonly string[] }`.

```typescript
const DRIFT_POLICY: Record<string, {
  sensitive: readonly string[],
  critical: readonly string[],
}> = {
  text_only: {
    sensitive: ['name', 'segment', 'subsegment', 'tone_of_voice', 'positioning', 'short_description', 'slogan'],
    critical: [],
  },
  logo: {
    sensitive: ['segment', 'subsegment', 'tone_of_voice', 'positioning', 'short_description', 'slogan'],
    critical: [],
  },
  visual_signature: {
    sensitive: ['subsegment', 'tone_of_voice', 'positioning', 'short_description'],
    critical: ['name', 'segment'],
  },
};

export function getDriftPolicy(
  identityState: string,
  contentUsed?: { slogan?: boolean; city?: boolean; state?: boolean }
): { sensitive: readonly string[]; critical: readonly string[] } {
  const policy = DRIFT_POLICY[identityState] ?? DRIFT_POLICY['text_only'];
  const critical = [...policy.critical];
  if (identityState === 'visual_signature' && contentUsed) {
    if (contentUsed.slogan) critical.push('slogan');
    if (contentUsed.city) critical.push('city');
    if (contentUsed.state) critical.push('state');
  }
  return { sensitive: policy.sensitive, critical };
}
```

**Alternativa rejeitada:** política inline em cada caller — dispersão de lógica, dificulta teste e auditoria.

### Decisão: evaluateCriticalDrift e evaluateSensitiveDrift independentes

Para estado `visual_signature`, o diagnóstico é bifurcado:

- `evaluateCriticalDrift(vsSnapshot, contentUsed, store)` — compara store atual (name, segment, slogan, city, state) contra VS input_snapshot (11 campos). VS snapshot é fonte canônica para campos críticos. Retorna `{ hasDrift: boolean, fields: string[] }`.
- `evaluateSensitiveDrift(bpSnapshot, store)` — comparável ao computeDriftStatus atual, mas parametrizável por campos. Compara store atual contra BP input_snapshot (7 campos).

O frontend **não** executa evaluateCriticalDrift localmente — não recebe o snapshot bruto da VS. O backend calcula critical_drift.status no GET /visual-signature e o frontend consome exclusivamente `activeVsSummary.critical_drift.status`. O frontend calcula localmente apenas o drift sensível do BP (via `evaluateSensitiveDrift`). Para text_only/logo, apenas evaluateSensitiveDrift é necessário.

### Decisão: computeDriftStatus com campos parametrizáveis

`computeDriftStatus` atual é fixo em 4 campos. Passa a aceitar `fields: readonly string[]`:

```typescript
export function computeDriftStatus(
  current: DriftSnapshot,
  inputSnapshot: Partial<StoreProfileInputSnapshot> | null | undefined,
  dismissedSnapshot: Partial<StoreProfileInputSnapshot> | null | undefined,
  fields: readonly string[],
): DriftStatus
```

`fields` é obrigatório. `DRIFT_FIELDS` é removido. Todos os callers são migrados explicitamente para `getDriftPolicy(state).sensitive`. Sem fallback oculto para a política antiga.

### Decisão: VS snapshot como fonte canônica para campos críticos

O VS `input_snapshot` (11 campos: name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state, brand_color, accent_color) armazenado em `store_visual_signatures.metadata.input_snapshot` é a fonte única para `evaluateCriticalDrift`. O BP snapshot (7 campos) é usado exclusivamente para `evaluateSensitiveDrift`.

Propriedades ausentes em snapshots antigos são tratadas como "não comparar" (skip no campo).

### Decisão: Compensação — inferir antes de mutar

A regra de persistência varia por caminho. O princípio comum é: inferir ANTES de mutar. O que muda é o tipo de operação no banco:

**text_only/logo (realinhamento):**
1. Executar inferência primeiro
2. SOMENTE após sucesso: marcar perfil anterior como outdated
3. INSERIR novo perfil com status synced
4. Se o insert falhar: restaurar anterior para synced
5. Inferência falha: anterior NÃO marcado como outdated

**VS sensível (realinhamento com mesmo visual_signature_id):**
3 ramos conforme estado do BP:

**Ramo A (BP synced):**
1. Executar inferência (mode:'regenerate') primeiro
2. UPDATE do BP existente (mesmo visual_signature_id)
3. Se update falhar: registro anterior permanece synced e intacto

**Ramo B (BP failed/outdated + fallback synced):**
1. Executar inferência (mode:'regenerate') primeiro
2. Marcar BP fallback synced como outdated
3. UPDATE do BP alvo (failed/outdated) para synced com novos valores
4. Se update falhar: restaurar BP fallback para synced

**Ramo C (BP não existe / Tier 2 nunca gerou):**
1. Executar inferência (mode:'regenerate') primeiro
2. Se existir outro BP synced como fallback: marcar como outdated
3. INSERT novo BP com status synced
4. Se insert falhar: restaurar fallback para synced

**Substituição crítica (nova visual_signature_id):**
1. Gerar nova VS
2. Archive/activate conforme fluxo de aprovação (Tier 1)
3. INSERIR novo BP com status synced (novo visual_signature_id, índice único não conflita)
4. Se BP falhar: nova VS permanece ativa, BP anterior como fallback

Isto resolve o bug atual do `realign/route.ts` (marca outdated antes do insert, sem rollback) e respeita o índice único `idx_store_brand_profiles_unique_per_signature` em (store_id, visual_signature_id, source).

### Decisão: DriftCriticalModal com bifurcação crédito/sem crédito

O modal verifica `canGenerateNewSignature` (loja com < 3 assinaturas geradas com sucesso).
- Com crédito: botão "Atualizar assinatura visual" abre ApprovalModal com `mode: 'substitution'`
- Sem crédito: alerta + "Manter direção atual" (persiste dismiss, primário) + "Remover mesmo assim" (destrutivo → DELETE VS → text_only) + "Comprar créditos — Em breve" (desabilitado)

O botão "Manter" persiste `visual_signature_drift_dismissed_snapshot` via POST /dismiss-critical-drift.

### Decisão: GET /visual-signature com critical_drift.status

O GET existente retorna `restore_eligibility`. Expande para retornar:

```typescript
critical_drift: {
  status: 'none' | 'new' | 'dismissed'
  fields: string[]
  reason: 'ok' | 'critical_drift' | 'missing_metadata'
}
```

Cálculo:
- `reason = restore_eligibility.reason`
- Se `reason === 'ok'` → `status = 'none'`
- Se `reason === 'critical_drift' | 'missing_metadata'`: compara `visual_signature_drift_dismissed_snapshot` (se existir) com valores atuais da loja. Se bater → `status = 'dismissed'`. Se não bater ou snapshot ausente → `status = 'new'`

### Decisão: use-drift-detection com DriftCategory

O hook passa a retornar:
```typescript
{
  driftStatus: DriftStatus
  driftCategory: 'critical' | 'sensitive' | 'none'
  criticalDrift: CriticalDriftInfo | null  // { status, fields, reason }
  currentSnapshot: StoreProfileInputSnapshot | null
  realinhar: () => Promise<void>
  ignorar: () => Promise<void>
  dismissCriticalDrift: () => Promise<void>
  isRealinhando: boolean
}
```

Aceita `activeVsSummary: ActiveVisualSignatureSummary | null` como parâmetro opcional. Quando presente (estado VS), lê `activeVsSummary.critical_drift.status` para diagnóstico canônico.

### Decisão: Bifurcação do save no Step 2

`handleStep2Submit`:
```typescript
if (criticalStatus === 'new') → DriftCriticalModal
else if (sensitiveStatus === 'new') → DriftDecisionModal
else → salva direto
```

Isso cobre corretamente o cenário onde crítico foi dismissado mas sensível está `new` — abre DriftDecisionModal. E quando crítico está `new`, tem precedência sobre sensível.

Non-blocking em todos os cenários: "Manter"/"Cancelar" sempre disponíveis.

### Decisão: brand-profiler mode 'regenerate'

```typescript
type ProfilerMode = 'reuse' | 'regenerate';
```

Modo `reuse` (atual, default): busca perfil existente por visual_signature_id e retorna se encontrar. Comportamento atual inalterado.
Modo `regenerate`: ignora cache, re-infere todos os campos. Preserva `content_used`, `visual_signature_id` e metadados existentes da VS no BP. Usado exclusivamente pelo realinhamento VS-sensível (`realign/route.ts` quando `identity_state === 'visual_signature'`).

### Decisão: ApprovalModal com mode prop

`VisualSignatureApprovalModal` recebe `mode: 'standard' | 'substitution'`:
- `standard` (atual): fluxo de criação `text_only → visual_signature`. Approval → approve route standard.
- `substitution`: fluxo de substituição `visual_signature → visual_signature` (excepcional). Modal sempre começa em `checking`. Chama `/generate-without-logo` com `mode:'substitution'` no body. Approval envia `POST /approve` com `mode:'substitution'`.

### Decisão: Guardas do backend no generate-without-logo (mode: substitution)

Antes de gerar, o endpoint valida:
1. Loja existe e está ativa
2. Lock de geração por loja (lock em memória existente, process-local/best effort)
3. `identity_state === 'visual_signature'` e existe VS ativa
4. Drift crítico confirmado (revalida via `drift-revalidator.ts`)
5. Limite de assinaturas respeitado (< 3)
6. A existência de drafts históricos NÃO bloqueia uma substituição — eles podem ser alternativas geradas anteriormente. Somente o lock da operação em andamento (item 2) deve bloquear.

Falha de guarda → 4xx com `code` e `userMessage` específicos.

### Decisão: Guardas do approve mode: substitution

O archive/activate da VS (Tier 1) acontece no endpoint `/approve`, não no generate. O approve em modo `substitution` deve revalidar o drift crítico novamente (fecha a janela entre geração e aprovação):

1. Revalidar drift crítico via `drift-revalidator.ts`
2. Confirmar `identity_state === 'visual_signature'` e VS ativa
3. Arquivar VS anterior (`active → archived`) e verificar o resultado
4. Ativar a nova VS (`draft → active`)
5. Se a ativação falhar: restaurar VS anterior para `active`
6. **Não chamar `identity-transitions`** — o estado permanece `visual_signature`

O Tier 2 (BP generation) ocorre após a ativação. Se falhar, a nova VS permanece ativa e o BP anterior continua como fallback.

### Decisão: Novos endpoints

- `POST /api/store/[id]/visual-signature/dismiss-critical-drift`:
  Body vazio. Lê valores atuais da loja (`store.name`, `store.segment`, `store.slogan`, `store.city`, `store.state`), faz merge no `metadata` preservando campos existentes, persiste `visual_signature_drift_dismissed_snapshot`. Retorna 204.
- Brand profile GET aceita `?status=synced` para filtrar o perfil ativo sem perder acesso ao mais recente.

### Alternativas consideradas e rejeitadas

| Alternativa | Motivo da rejeição |
|---|---|
| DriftCategory como enum em vez de union type | Union type `'critical' \| 'sensitive' \| 'none'` é mais idiomático em TypeScript |
| Dismiss crítico no BP em vez da VS | VS metadata acompanha naturalmente a VS. Quando VS é substituída, dismiss expira automaticamente. |
| Substituição como transição no identity-transitions.ts | Contrato de transições é explícito: VS→VS não é transição genérica. Fluxo excepcional tratado fora do orchestrator. |
| Remover VS antes de gerar nova (em vez de archive/activate) | Risco de perder VS ativa se geração falhar. Archive/activate com compensação é mais seguro. |

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Lock de geração em memória não escala com múltiplas instâncias | O lock atual é process-local/best effort — não é confiável entre instâncias. O índice único do banco (`store_id` + `status = 'active'`) impede duas VS active. Ainda existe risco residual de geração duplicada/custo em concorrência cross-instance. Lock distribuído fica como evolução futura. |
| Double submit: dois cliques em "Salvar" disparam dois saves | Botão desabilitado + loading state no frontend reduzem risco. Lock de geração reduz concorrência local. Índice único (`store_id` + `status = 'active'`) impede duas VS active. Revalidação garante validade do drift, não exclusão mútua. |
| Caller do computeDriftStatus existente quebra com assinatura nova | Todos os callers revisados e migrados explicitamente para `getDriftPolicy(state).sensitive`. `fields` é obrigatório — sem fallback para política antiga. |
| VS snapshot antigo sem campos city/state | `drift-validator.ts` trata props ausentes como "não comparar". Drift revalidator mesmo comportamento. |
| Falha no profiler mode 'regenerate' vs modo 'reuse' | 'regenerate' é chamado apenas em realinhamento VS-sensível. Se falhar, alerta + retry + "Continuar por agora" (VS mantida). |
| Superfície de regressão: 3+ endpoints modificados simultaneamente | Ondas sequenciais com smoke test por onda. Onda 5 (backend substituição) só começa após Onda 4 (realinhamento sensível) verde. |

## Migration Plan

**Onda 1** — Congelamento: registrar contratos existentes, testes de regressão para cada contrato que não pode quebrar.

**Onda 2** — Fundação do diagnóstico:
1. `src/lib/drift.ts`: `getDriftPolicy`, `DriftCategory`, `evaluateCriticalDrift`, `evaluateSensitiveDrift`, `computeDriftStatus` com fields param
2. `src/lib/visual-signature/drift-validator.ts`: expandir com props ausentes
3. `src/lib/visual-signature/drift-revalidator.ts`: NOVO

**Onda 3** — Diagnóstico no frontend:
1. `use-drift-detection.ts`: driftCategory + activeVsSummary
2. GET /brand-profile?status=synced
3. GET /visual-signature: critical_drift.status

**Onda 4** — Realinhamento sensível:
1. `realign/route.ts`: estratégia por identity_state + compensação
2. `brand-profiler.ts`: mode 'regenerate'
3. Smoke test: VS + drift sensível → realinhar → VS preservada + BP atualizado

**Onda 5** — Backend substituição crítica:
1. `generate-without-logo/route.ts`: mode + revalidação
2. `approve/route.ts`: mode:'substitution' com dois tiers
3. `dismiss-critical-drift/route.ts`: NOVO
4. Guards: lock, identity_state, drift, limite, compensação

**Onda 6** — UI e integração:
1. `drift-critical-modal.tsx`: NOVO
2. `visual-signature-approval-modal.tsx`: mode prop
3. `store-identity-form.tsx`: bifurcação por driftCategory
4. `store-preview.tsx`: badge + effectiveStatus
5. `drift-decision-modal.tsx`: error/retry state

**Onda 7** — UAT formal único ao final.

## Open Questions

Nenhuma. O alignment artifact está completo e todas as decisões arquiteturais foram validadas.
