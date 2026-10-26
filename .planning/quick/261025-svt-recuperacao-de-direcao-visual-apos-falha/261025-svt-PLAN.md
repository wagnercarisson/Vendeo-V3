---
plan: 261025-svt
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: ["SV-DIR-RECOVERY"]
files_modified:
  - src/lib/visual-signature/direction-pending.ts
  - src/lib/visual-signature/types.ts
  - src/lib/visual-signature/brand-profiler.ts
  - src/app/api/store/[id]/visual-signature/approve/route.ts
  - src/app/api/store/[id]/brand-profile/realign/route.ts
  - src/app/api/store/[id]/brand-profile/route.ts
  - src/components/flow/direction-pending-banner.tsx
  - src/components/flow/visual-signature-approval-modal.tsx
  - src/components/flow/store-identity-form.tsx
  - src/lib/visual-signature/__tests__/direction-pending.test.ts
  - src/lib/visual-signature/__tests__/brand-profiler.test.ts
  - src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts
  - src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts
  - src/app/api/store/[id]/brand-profile/__tests__/route.test.ts
  - src/components/flow/__tests__/visual-signature-approval-modal.test.tsx
  - src/components/flow/__tests__/direction-pending-banner.test.tsx
  - src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx
  - src/app/api/campaign/generate-image/__tests__/route.test.ts
user_setup: []

must_haves:
  truths:
    - "Quando o brand_profile_vision falha após a aprovação, a assinatura visual permanece ativa e nenhum perfil antigo volta a status 'synced'."
    - "A falha fica registrada na metadata JSONB da assinatura ativa (status/reference/at/code), sem tabela, coluna, status novo ou migration."
    - "A direção anterior é invalidada (synced → outdated) preservando conteúdo/histórico, nunca restaurada."
    - "Ao carregar a loja, a pendência é detectada server-side e a UI mostra aviso persistente com referência e botão 'Realinhar direção visual', sem tratar o caso como ausência/legado."
    - "O realinhamento existente recupera a direção, limpa a marcação de falha e reabilita readiness/campanhas; nova falha grava nova referência e mantém o bloqueio."
    - "Uma resposta atrasada de uma tentativa de assinatura substituída não escreve perfil nem metadata (guard antes de qualquer persistência; 409 seguro)."
    - "Mensagens de erro de provider/SQL/URL nunca vazam para o cliente; apenas códigos seguros são devolvidos."
  artifacts:
    - path: "src/lib/visual-signature/direction-pending.ts"
      provides: "Estado de pendência, invalidação fail-closed, marcação/limpeza de metadata, guard de assinatura ativa e sanitização"
      exports: ["VisualDirectionState", "loadVisualDirectionState", "markSyncedProfilesOutdatedExceptActive", "recordVisualDirectionFailure", "clearVisualDirectionFailure", "isVisualSignatureActive", "sanitizeDirectionDiagnostic"]
    - path: "src/components/flow/direction-pending-banner.tsx"
      provides: "Aviso persistente role=alert com referência e CTA de realinhamento"
      contains: "Realinhar direção visual"
    - path: "src/app/api/store/[id]/brand-profile/route.ts"
      provides: "GET ?status=direction-state"
      contains: "direction-state"
    - path: "src/app/api/store/[id]/visual-signature/approve/route.ts"
      provides: "Fail-closed pós-falha do profiler em standard e substitution"
      contains: "bp_status: 'failed'"
    - path: "src/app/api/store/[id]/brand-profile/realign/route.ts"
      provides: "Recuperação por realinhamento com referência nova e preservação da política normal"
      contains: "brand_profile_vision_failed"
  key_links:
    - from: "src/app/api/store/[id]/visual-signature/approve/route.ts"
      to: "src/lib/visual-signature/direction-pending.ts"
      via: "markSyncedProfilesOutdatedExceptActive + recordVisualDirectionFailure + isVisualSignatureActive"
      pattern: "recordVisualDirectionFailure|markSyncedProfilesOutdatedExceptActive"
    - from: "src/lib/visual-signature/brand-profiler.ts"
      to: "src/lib/visual-signature/types.ts"
      via: "input.assertActiveVisualSignature antes de qualquer update/insert"
      pattern: "assertActiveVisualSignature"
    - from: "src/components/flow/store-identity-form.tsx"
      to: "/api/store/[id]/brand-profile?status=direction-state"
      via: "fetch no load + fetch POST /realign no banner"
      pattern: "direction-state"
    - from: "src/components/flow/direction-pending-banner.tsx"
      to: "src/components/flow/store-identity-form.tsx"
      via: "onRealign"
      pattern: "onRealign"
    - from: "src/app/api/store/[id]/brand-profile/realign/route.ts"
      to: "src/lib/visual-signature/direction-pending.ts"
      via: "loadVisualDirectionState + clear/record + guard"
      pattern: "loadVisualDirectionState"
---

<objective>
Corrigir a recuperação após falha do `brand_profile_vision` na aprovação de uma nova Assinatura Visual: manter a assinatura ativa, invalidar a direção anterior sem restaurá-la, persistir uma referência de falha na metadata JSONB existente, detectar a pendência no carregamento e permitir recuperar pelo endpoint de realinhamento existente.

Purpose: impedir que uma falha de visão deixe a loja em estado ambíguo — sem perfil `synced`, com perfil antigo ressuscitado, sem diagnóstico e sem caminho de recuperação. A campanha deve continuar bloqueada por readiness até a direção ser concluída.
Output: módulo server-only de estado de direção, guard de persistência no profiler, respostas fail-closed em approve/realign, endpoint `?status=direction-state`, banner persistente + realinhamento na UI, e suíte offline cobrindo os caminhos de falha, corrida e recuperação.

**Não implementar neste passo.** Este artefato é o plano.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./AGENTS.md
@docs/fluxo-de-desenvolvimento.md
@src/lib/store-readiness.ts
@src/lib/visual-signature/brand-profiler.ts
@src/lib/visual-signature/types.ts
@src/app/api/store/[id]/visual-signature/approve/route.ts
@src/app/api/store/[id]/brand-profile/realign/route.ts
@src/app/api/store/[id]/brand-profile/route.ts
@src/components/flow/visual-signature-approval-modal.tsx
@src/components/flow/store-identity-form.tsx
@src/components/flow/use-drift-detection.ts

<verified_contracts>
- `store_brand_profiles.status` aceita `processing|synced|outdated|failed|archived`. NÃO criar status novo.
- `store_visual_signatures.metadata` é JSONB retornado/consumido. NÃO criar tabela/coluna/migration.
- `check_store_readiness` retorna `ready=false` sem nenhum perfil `synced`. NÃO alterar a RPC.
- `generate-image` já chama `getStoreReadiness` antes de crédito/provider (legado ~L1034; novo fluxo ~L584).
- Approve standard hoje: falha do profiler → 200 `success:true` com `brandProfileData:null`, `brandProfile:{status:'failed'}`, sem `bp_status`, sem invalidar antigos.
- Approve substitution hoje: catch RESTAURA `outdated` (`source='without_logo'`) para `synced` — remover.
- Modal só trata `bp_status==='failed'` em `mode==='substitution'`.
- `store-identity-form` carrega `?status=synced`; se não houver, apenas loga `latest.metadata?.error` cru no console.
- Realign VS devolve `error: message` cru do provider e não grava referência; em sucesso não limpa metadata.
- `BrandProfilerWithoutLogoService` persiste no fim da inferência e no caminho de reuso (`generate()` atualiza `outdated→synced`). O guard precisa cobrir AMBOS.
- `AiTelemetryContext.operationRunId` é o identificador preferencial de `failure_reference`.
- Proibido importar `@/lib/product-1-1/**` em arquivos novos/alterados.

<interfaces>
De `src/lib/visual-signature/types.ts` (adicionar ao `BrandProfilerInput`):
```ts
/** Guard opcional chamado ANTES de qualquer persistência do perfil.
 * false = assinatura substituída; não gravar nada. */
assertActiveVisualSignature?: () => Promise<boolean>;
```

De `src/lib/visual-signature/brand-profiler.ts`:
```ts
export class BrandProfilerWithoutLogoError extends Error {
  metadata: { provider: string; model: string; elapsedMs: number; errorType: string };
}
```

Contrato do novo módulo (decisão A):
```ts
export interface VisualDirectionState {
  pending: boolean;
  active_signature_id: string | null;
  synced_profile_id: string | null;
  reference: string | null;
  failure_at: string | null;
}
export async function loadVisualDirectionState(storeId: string, client?: SupabaseLike): Promise<VisualDirectionState>;
export async function markSyncedProfilesOutdatedExceptActive(storeId: string, client?: SupabaseLike): Promise<{ ok: true } | { ok: false; error: string }>;
export async function recordVisualDirectionFailure(args: { storeId: string; signatureId: string; reference: string | null; failureCode: string; client?: SupabaseLike }): Promise<{ status: 'ok' } | { status: 'superseded' } | { status: 'error'; error: string }>;
export async function clearVisualDirectionFailure(args: { storeId: string; signatureId: string; client?: SupabaseLike }): Promise<{ status: 'ok' } | { status: 'superseded' } | { status: 'error'; error: string }>;
export async function isVisualSignatureActive(storeId: string, signatureId: string, client?: SupabaseLike): Promise<boolean>;
export function sanitizeDirectionDiagnostic(message: string): string;
```
Chaves de metadata (mesmas do JSONB existente):
`brand_profile_status`, `brand_profile_failure_reference`, `brand_profile_failure_at`, `brand_profile_failure_code`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Módulo server-only de estado da direção visual + testes unitários</name>
  <files>src/lib/visual-signature/direction-pending.ts, src/lib/visual-signature/__tests__/direction-pending.test.ts</files>
  <behavior>
    - loadVisualDirectionState: sem assinatura ativa → pending=false, active=null, reference=null.
    - loadVisualDirectionState: ativa + nenhum perfil synced → pending=true.
    - loadVisualDirectionState: ativa + synced com visual_signature_id diferente → pending=true.
    - loadVisualDirectionState: ativa + synced com visual_signature_id igual → pending=false.
    - loadVisualDirectionState: reference/failure_at vêm de metadata quando presentes; fallback reference = active.id.
    - loadVisualDirectionState: erro de leitura lança (não vira ausência).
    - markSyncedProfilesOutdatedExceptActive: exclui o perfil da assinatura ativa, inclui `visual_signature_id IS NULL` (legado) e ids diferentes; sem ativa invalida todos os synced; erro propaga `{ok:false,error}`; nunca grava `synced`.
    - recordVisualDirectionFailure: só grava se `id=signatureId AND store_id AND status='active'`; merge preserva outras chaves; sem linha atualizada → superseded; erro → error.
    - clearVisualDirectionFailure: grava `brand_profile_status:'synced'` e os três campos de falha null; condicional a active; sem linha → superseded.
    - isVisualSignatureActive: true só quando existe assinatura active com o id; erro de leitura → false (fail-closed).
    - sanitizeDirectionDiagnostic: remove `sk-*`, `Bearer ...`, URLs, colapsa espaços e trunca.
  </behavior>
  <action>
Criar `src/lib/visual-signature/direction-pending.ts` com `import "server-only";` e client injetável (parâmetro opcional `client`, default `supabaseAdmin` importado de `@/lib/supabase/server`). Implementar exatamente o contrato de `<interfaces>` da decisão A.

Detalhes de implementação:
- `loadVisualDirectionState`: assinatura ativa mais recente com `.select('id, metadata').eq('store_id', storeId).eq('status','active').order('updated_at',{ascending:false}).limit(1).maybeSingle()`; perfil vigente com `.select('id, visual_signature_id').eq('store_id', storeId).eq('status','synced').order('updated_at',{ascending:false}).limit(1).maybeSingle()`. Checar `error` dos dois e lançar `new Error('direction_state_read_failed')` (sem mensagem crua). `pending = !!active && (!synced || synced.visual_signature_id !== active.id)`.
- `markSyncedProfilesOutdatedExceptActive`: ler id da assinatura ativa; se houver, executar DUAS atualizações com `.update({status:'outdated', updated_at: now}).eq('store_id', storeId).eq('status','synced')` + `.is('visual_signature_id', null)` e + `.neq('visual_signature_id', activeId)`. Sem assinatura ativa, uma atualização de todos os `.eq('status','synced')`. Verificar `error` de cada uma e retornar fail-closed sem restaurar nada.
- `recordVisualDirectionFailure`: ler metadata da assinatura com `.select('metadata').eq('id',signatureId).eq('store_id',storeId).eq('status','active').maybeSingle()`; ausente/erro de leitura → `superseded`/`error`. Merge `{...existing, brand_profile_status:'failed', brand_profile_failure_reference: reference, brand_profile_failure_at: new Date().toISOString(), brand_profile_failure_code: failureCode}`. Update `.eq('id',signatureId).eq('store_id',storeId).eq('status','active').select('id')`; `data` vazio → `superseded`; `error` → `error`.
- `clearVisualDirectionFailure`: mesmo padrão, merge `brand_profile_status:'synced'` e os três campos de falha `null`; update condicional a `status='active'` com `.select('id')`.
- `isVisualSignatureActive`: `.select('id').eq('id',signatureId).eq('store_id',storeId).eq('status','active').maybeSingle()`; erro → `false` + `console.error('[direction-pending] active_check_failed', { code:'active_check_failed' })` (nunca erro bruto).
- `sanitizeDirectionDiagnostic`: regex para `sk-[A-Za-z0-9_-]+`, `Bearer\s+\S+`, `https?://\S+`; substituir por `[redacted]`/`[url]`; colapsar whitespace; truncar em 160 chars.
- Logs do módulo: apenas códigos (`direction_state_read_failed`, `cleanup_failed`, `reference_failed`, `active_check_failed`).
- NÃO importar `@/lib/product-1-1/**`.

Testes em `src/lib/visual-signature/__tests__/direction-pending.test.ts`: `vi.mock('server-only', () => ({}))`; fakes de chain que suportam `select/eq/is/neq/order/limit/maybeSingle/update` e gravam updates. Cobrir todos os casos do `<behavior>` e asserção de que nenhuma chamada de update grava `synced` em `markSyncedProfilesOutdatedExceptActive`.
  </action>
  <verify>
    <automated>npx --no-install vitest run src/lib/visual-signature/__tests__/direction-pending.test.ts</automated>
  </verify>
  <done>Todos os testes do módulo passam; nenhum update do módulo grava `synced`; leitura com erro lança em `loadVisualDirectionState` e `isVisualSignatureActive` é fail-closed; arquivo não importa `product-1-1`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Guard de assinatura ativa no profiler + tipo de entrada + testes</name>
  <files>src/lib/visual-signature/types.ts, src/lib/visual-signature/brand-profiler.ts, src/lib/visual-signature/__tests__/brand-profiler.test.ts</files>
  <behavior>
    - Guard `assertActiveVisualSignature=false` → `BrandProfilerWithoutLogoError` com `metadata.errorType==='visual_signature_superseded'` e ZERO update/insert em `store_brand_profiles`.
    - Guard false também bloqueia o caminho de reuso (`generate()` com perfil existente/outdated) antes do update `outdated→synced`.
    - Guard true → fluxo atual inalterado (update/insert ocorre e retorna perfil).
    - Sem guard → comportamento atual, sem erro novo.
    - Guard chamado antes de `persistProfile`, `persistWithRegenerate` e `persistFailedProfile`.
  </behavior>
  <action>
Em `src/lib/visual-signature/types.ts`, adicionar ao `BrandProfilerInput` o campo opcional `assertActiveVisualSignature?: () => Promise<boolean>;` com o comentário da decisão B (chamado ANTES de qualquer persistência; `false` = assinatura substituída, não gravar nada).

Em `src/lib/visual-signature/brand-profiler.ts`, adicionar helper privado:
`private async assertStillActive(input: BrandProfilerInput): Promise<void>` que, se `input.assertActiveVisualSignature` existir, chama o guard; se retornar `false`, lança `new BrandProfilerWithoutLogoError('visual_signature_superseded', { provider:'openai', model: DEFAULT_VISION_MODEL, elapsedMs: 0, errorType:'visual_signature_superseded' })`. Sem guard, retorna sem efeito.

Chamar `await this.assertStillActive(input)`:
1. no início de `generate()` (antes da consulta de reuso e antes do update `outdated→synced` do caminho de cache — obrigatório para satisfazer "NENHUM update/insert");
2. no início de `persistProfile` (antes do branch `regenerate` e de qualquer leitura/update/insert);
3. no início de `persistWithRegenerate` (antes de qualquer update/insert);
4. no início de `persistFailedProfile` (antes do update/insert de falha).

Não alterar o comportamento quando o guard não é fornecido. Importar `BrandProfilerInput` já existente no arquivo (tipo). NÃO importar `product-1-1`.

Em `src/lib/visual-signature/__tests__/brand-profiler.test.ts`, adicionar testes:
- guard false com perfil existente synced → rejeita com `errorType='visual_signature_superseded'` e `mockSupabaseFrom` não recebe `update`/`insert`;
- guard false sem perfil → rejeita antes de qualquer insert;
- guard true → perfil é retornado e update/insert ocorre;
- sem guard → comportamento atual preservado.
Usar os helpers `makeChain`/`makeInvoker` existentes; contar chamadas de `update`/`insert` no fake.
  </action>
  <verify>
    <automated>npx --no-install vitest run src/lib/visual-signature/__tests__/brand-profiler.test.ts && npm run typecheck</automated>
  </verify>
  <done>Guard false impede qualquer persistência (inclusive reuso) e lança superseded; guard true e ausência de guard preservam o fluxo atual; typecheck passa.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: APPROVE fail-closed em standard e substitution + testes de rota</name>
  <files>src/app/api/store/[id]/visual-signature/approve/route.ts, src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts</files>
  <behavior>
    - Standard: falha do profiler → assinatura active, perfil antigo synced vira outdated, NENHUM restore para synced, metadata da assinatura com `brand_profile_status:'failed'`/reference/at/code, resposta 200 com `bp_status:'failed'`, `brandProfileData:null`, `brandProfile:{id:'',status:'failed'}`, sem cores de fallback.
    - Substitution: mesmo comportamento; remover integralmente o bloco que restaura `outdated` (`source='without_logo'`) para `synced`.
    - Cleanup falhando ou gravação de referência falhando → 500 sem `success:true`.
    - Guard retorna false (outra aprovação assumiu) → 409 `visual_signature_superseded`, sem cleanup e sem metadata.
    - Resposta atrasada: assinatura B ativa e perfil B synced → cleanup não toca B e metadata de A não é gravada.
    - Sucesso (standard, substitution e reuso) limpa metadata de falha e devolve `brand_profile_status:'synced'`/`failure_reference:null`.
    - Reuso de perfil checa `isVisualSignatureActive` antes de `reconcileProfiles` e antes de responder.
    - `failureCode` e logs nunca contêm mensagem crua do provider/SQL/URL.
  </behavior>
  <action>
Importar de `@/lib/visual-signature/direction-pending`: `isVisualSignatureActive`, `markSyncedProfilesOutdatedExceptActive`, `recordVisualDirectionFailure`, `clearVisualDirectionFailure`, `sanitizeDirectionDiagnostic`; e `BrandProfilerWithoutLogoError` de `brand-profiler`.

Criar helper local `handleProfilerFailure({ storeId, signatureId, reqId, err, failureReference, risk })` que devolve `NextResponse` e implementa a decisão C:
1. `const superseded = err instanceof BrandProfilerWithoutLogoError && err.metadata.errorType === 'visual_signature_superseded'`; se true → 409 `{ success:false, error:'visual_signature_superseded', message:'A assinatura visual foi substituída por outra aprovação. Recarregue a página.' }` sem cleanup nem metadata.
2. `const cleanup = await markSyncedProfilesOutdatedExceptActive(storeId)`; se `!cleanup.ok` → 500 `{ success:false, error:'brand_profile_cleanup_failed', message:'Não foi possível concluir a transição com segurança. Tente novamente.' }`.
3. `const safeErrorType = err instanceof BrandProfilerWithoutLogoError ? err.metadata.errorType : 'unexpected_error'`; `const recorded = await recordVisualDirectionFailure({ storeId, signatureId, reference: failureReference, failureCode: safeErrorType })`; `superseded` → 409 igual ao passo 1; `error` → 500 `{ success:false, error:'brand_profile_reference_failed', message:'Não foi possível concluir a transição com segurança. Tente novamente.' }`.
4. Retornar 200 com exatamente: `{ success:true, signature:{ id: signature.id, assetUrl: signedAssetUrl, status:'active' }, brandProfile:{ id:'', status:'failed' }, brandProfileData:null, bp_status:'failed', brand_profile_status:'failed', failure_reference: failureReference, visual_signature_id: signatureId, message: 'Sua assinatura foi aprovada, mas não conseguimos concluir a direção visual. A geração de campanhas ficará indisponível até a conclusão. Informe ao suporte o código ' + failureReference + '. Após a orientação do suporte, clique em Realinhar direção visual.', logoStatus:'generated', inferredPrimaryColor:null, inferredAccentColor:null, logoColorsDetected:[] }`.
Log de falha: `console.error('[approve][req-x] brand_profile_failed', { code: safeErrorType, ...(sanitizeDirectionDiagnostic(msg) ? { detail: sanitizeDirectionDiagnostic(msg) } : {}) })` — nunca o objeto de erro bruto.

Em ambos os modos (standard e substitution), antes de chamar o profiler:
`const telemetry = await createBrandProfileTelemetry(id, signatureId); const failureReference = telemetry.operationRunId;` e passar `assertActiveVisualSignature: () => isVisualSignatureActive(id, signatureId)` no objeto de input do `generate`. Não usar mais a chamada inline `await createBrandProfileTelemetry(...)`.

Substituir os dois `catch` de falha do profiler (standard ~L700 e substitution ~L298) por chamadas ao helper; remover o bloco de restore da substituição (~L301-311) e remover o cálculo de cores de fallback.

Caminhos de sucesso:
- Reuso (standard, ~L538): antes de `reconcileProfiles` e antes do retorno, `if (!(await isVisualSignatureActive(id, body.signatureId))) return 409 superseded`. Após o sucesso, `const clear = await clearVisualDirectionFailure({ storeId: id, signatureId: body.signatureId })`; se `clear.status === 'superseded'` → 409; se `error` → `warning:'direction_metadata_cleanup_failed'` (não falhar). Resposta inclui `brand_profile_status:'synced'`, `failure_reference:null`.
- Profiler novo (standard ~L677 e substitution ~L273): após sucesso, mesma limpeza (`superseded` → 409; `error` → warning). Resposta inclui `brand_profile_status:'synced'`, `failure_reference:null`.

Atualizar `src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts`:
- Mockar `@/lib/visual-signature/direction-pending` com spies (`isVisualSignatureActive` default `true`, `markSyncedProfilesOutdatedExceptActive` default `{ok:true}`, `recordVisualDirectionFailure` default `{status:'ok'}`, `clearVisualDirectionFailure` default `{status:'ok'}`, `sanitizeDirectionDiagnostic: (s:string)=>s`).
- Mockar o módulo do profiler exportando `BrandProfilerWithoutLogoError` (classe com `metadata.errorType`).
- Atualizar 12.10 e SUB-5 para o novo contrato (incl. `bp_status:'failed'`, `brand_profile_status`, `failure_reference`, sem cores de fallback).
- Adicionar: standard e substitution com falha → synced antigo vira outdated, `markSyncedProfilesOutdatedExceptActive` chamado, `recordVisualDirectionFailure` com reference/código, nenhum update `status='synced'`; cleanup falhando → 500; reference falhando → 500; guard superseded → 409 e sem cleanup/metadata; reuso quando `isVisualSignatureActive=false` → 409; sucesso limpa metadata (`clearVisualDirectionFailure` chamado) e retorna `brand_profile_status:'synced'`/`failure_reference:null`.
- Corrida: configurar `load`/`isVisualSignatureActive` de modo que B seja a ativa e verificar que o cleanup/mark recebe o store e não grava metadata de A (`recordVisualDirectionFailure` retornando `superseded` → 409).
  </action>
  <verify>
    <automated>npx --no-install vitest run "src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts" && npm run typecheck</automated>
  </verify>
  <done>Falha do profiler em standard e substitution retorna 200 `bp_status:'failed'` com metadata gravada, assinatura ativa e nenhum restore; guard/cleanup/reference e reuso cobrem os 409/500; sucesso limpa metadata e reporta `synced`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: REALIGN VS + GET direction-state + endurecimento do teste de readiness</name>
  <files>src/app/api/store/[id]/brand-profile/realign/route.ts, src/app/api/store/[id]/brand-profile/route.ts, src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts, src/app/api/store/[id]/brand-profile/__tests__/route.test.ts, src/app/api/campaign/generate-image/__tests__/route.test.ts</files>
  <behavior>
    - Realign VS pendente: falha grava referência nova (`run.operationRunId`), marca synced antigos outdated, não restaura, retorna 200 `success:false`, `brand_profile_status:'failed'`, `failure_reference`.
    - Realign VS sem pendência (synced matching ativo): falha preserva o perfil e a mensagem "... A direção visual anterior foi mantida."; não marca nada outdated.
    - Realign VS superseded → 409 seguro, sem cleanup/metadata.
    - Realign VS sucesso → limpa metadata, `brand_profile_status:'synced'`, `failure_reference:null`; warning se limpeza falhar.
    - Nenhuma resposta devolve mensagem crua de provider/SQL/URL.
    - `GET ?status=direction-state` retorna o estado para pendente/completo/sem ativa; erro de leitura → 500 `direction_state_unavailable` (nunca ausência/legado).
    - `GET ?status=synced` e GET padrão permanecem intactos.
    - `generate-image`: readiness sem `brand_profile` → 412 com `reserveCredit` e provider não chamados (legado + novo fluxo quando o mock permitir).
  </behavior>
  <action>
Em `src/app/api/store/[id]/brand-profile/realign/route.ts` (somente path VS):
- Importar `loadVisualDirectionState`, `markSyncedProfilesOutdatedExceptActive`, `recordVisualDirectionFailure`, `clearVisualDirectionFailure`, `isVisualSignatureActive`, `sanitizeDirectionDiagnostic`.
- Em `handleVSRealign`, declarar `let pendingBefore = true;` antes do `try`. Dentro do `try`, antes de instanciar o profiler: `const directionState = await loadVisualDirectionState(id); pendingBefore = directionState.pending;` (se lançar, tratar como falha de leitura: `locks.delete(id)` e 500 `{ success:false, error:'direction_state_unavailable', message:'Não foi possível verificar a direção visual agora. Tente novamente.' }`).
- Passar `assertActiveVisualSignature: () => isVisualSignatureActive(id, vsRecord.id)` no input de `profiler.generate`.
- Sucesso: `const clear = await clearVisualDirectionFailure({ storeId: id, signatureId: vsRecord.id });` se `superseded` → 409 seguro; se `error` → incluir `warning:'direction_metadata_cleanup_failed'` (não falhar). Resposta: `{ success:true, profile:{...}, brand_profile_status:'synced', failure_reference:null }` (+ warning quando aplicável).
- Falha (`catch (err)`):
  1. superseded (BrandProfilerWithoutLogoError com `errorType==='visual_signature_superseded'`) → 409 `{ success:false, error:'visual_signature_superseded', message:'A assinatura visual foi substituída por outra aprovação. Recarregue a página.' }`.
  2. `!pendingBefore` → `{ success:false, message:'Não foi possível regenerar o perfil de marca. A direção visual anterior foi mantida.', error:'brand_profile_vision_failed' }` (HTTP 200), sem marcar outdated.
  3. `pendingBefore` → `markSyncedProfilesOutdatedExceptActive(id)`; `!ok` → 500 `{success:false,error:'brand_profile_cleanup_failed',message:'Não foi possível concluir a transição com segurança. Tente novamente.'}`; `recordVisualDirectionFailure({storeId:id, signatureId:vsRecord.id, reference: run.operationRunId, failureCode: safeErrorType})`; `superseded` → 409; `error` → 500 `{success:false,error:'brand_profile_reference_failed'}`; senão 200 `{ success:false, message:'Não foi possível concluir a direção visual. A geração de campanhas ficará indisponível até a conclusão. Informe ao suporte o código ' + run.operationRunId + '. Após a orientação do suporte, clique em Realinhar direção visual.', error:'brand_profile_vision_failed', brand_profile_status:'failed', failure_reference: run.operationRunId }`.
  `safeErrorType = err instanceof BrandProfilerWithoutLogoError ? err.metadata.errorType : 'unexpected_error'`. Logar apenas código/sanitizado. Declarar `run` fora do try para uso no catch (ou capturar `let failureReference: string | null = null` ao criar o run).
- Não alterar paths `text_only`/`logo`; não gerar imagem; manter o lock e a leitura de assinatura ativa + dados atuais.

Em `src/app/api/store/[id]/brand-profile/route.ts`:
- Importar `loadVisualDirectionState` de `@/lib/visual-signature/direction-pending`.
- No `GET`, após `statusParam`, adicionar branch `if (statusParam === 'direction-state')`: `try { return NextResponse.json(await loadVisualDirectionState(id), { status:200 }); } catch { console.error('[brand-profile] direction_state_unavailable'); return NextResponse.json({ error:'direction_state_unavailable' }, { status:500 }); }`.
- Manter `?status=synced` e o GET padrão sem mudanças.

Testes:
- `realign-route.test.ts`: mockar `direction-pending` (defaults: `loadVisualDirectionState → {pending:true,...}`, `mark... → {ok:true}`, `record... → {status:'ok'}`, `clear... → {status:'ok'}`, `isVisualSignatureActive → true`). Ajustar o mock do profiler para exportar `BrandProfilerWithoutLogoError` com `metadata`. Adicionar casos do `<behavior>` (pendente/sem pendência/superseded/sucesso/erro de leitura), assertando `error` é sempre código (`brand_profile_vision_failed`, `visual_signature_superseded`, `direction_state_unavailable`) e nunca a mensagem crua.
- `brand-profile/__tests__/route.test.ts`: mockar `direction-pending` e adicionar `?status=direction-state` pendente/completo/sem ativa + erro de leitura → 500; garantir que `?status=synced` e padrão continuam verdes.
- `generate-image/__tests__/route.test.ts`: no teste F2 de readiness, asserir explicitamente `mockReserveCredit` não chamado e o provider (`mockRunProductOneToOneGeneration` e, se existir, o invocador legado) não chamado; adicionar o equivalente no caminho legado se o harness existente permitir sem novas dependências.
  </action>
  <verify>
    <automated>npx --no-install vitest run "src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts" "src/app/api/store/[id]/brand-profile/__tests__/route.test.ts" src/app/api/campaign/generate-image/__tests__/route.test.ts && npm run typecheck</automated>
  </verify>
  <done>Realign distingue pendência de realinhamento comum, grava nova referência só quando pendente, nunca restaura nem vaza mensagem crua; `?status=direction-state` responde estado ou 500 seguro; readiness 412 comprova ausência de reserva/provider.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: UI — banner persistente, modal em ambos os modos e detecção no formulário</name>
  <files>src/components/flow/direction-pending-banner.tsx, src/components/flow/visual-signature-approval-modal.tsx, src/components/flow/store-identity-form.tsx, src/components/flow/__tests__/direction-pending-banner.test.tsx, src/components/flow/__tests__/visual-signature-approval-modal.test.tsx, src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx</files>
  <behavior>
    - Modal standard e substitution: `data.bp_status==='failed'` entra em `bp_failed` mostrando `data.message` seguro, a referência e o botão "Realinhar direção visual".
    - `handleRetryBP` sucesso → `onComplete({ logoStatus:'generated', signatureUrl, brandProfileData:<profile do realign> })` e fecha; falha → mantém `bp_failed`, atualiza `message` e `failureReference` com `data.message`/`data.failure_reference`.
    - `onDirectionPending` é chamado ao entrar em `bp_failed`.
    - Formulário: load com `pending=true` limpa `inferredProfile`, `brandColorsChosen`, `detectedColors` e `accentColor`, não aplica `?status=synced`, mostra banner com referência/aviso e botão; sem pendência mantém o perfil; erro de leitura mostra erro explícito e não legado.
    - Botão do banner chama `POST /realign`; sucesso aplica `data.profile`, limpa pendência, incrementa `readinessRefreshKey` e `driftRefreshKey`; falha mantém pendência e atualiza referência/mensagem.
    - `handleApprovalComplete` incrementa `readinessRefreshKey` e limpa pendência ao receber perfil/assinatura.
    - Banner: `role="alert"`, título "Direção visual pendente", "Código de suporte: <reference>", botão "Realinhar direção visual"; sem opção de ignorar.
  </behavior>
  <action>
Criar `src/components/flow/direction-pending-banner.tsx` (client, sem import de product-1-1) com props `{ reference: string | null; message: string; onRealign: () => void; isRealinhando: boolean; error: boolean }`. Renderizar `<div role="alert">` com:
- `error` true → título "Não foi possível verificar a direção visual" e o `message` fornecido;
- `error` false → título "Direção visual pendente" e o `message` fornecido;
- se `reference` → `<p>Código de suporte: {reference}</p>`;
- botão `type="button"` com texto exato "Realinhar direção visual", `disabled={isRealinhando}` + `aria-disabled`.
Sem botão de ignorar/continuar.

Em `visual-signature-approval-modal.tsx`:
- `ApprovalState.bp_failed` ganha `failureReference?: string`.
- Adicionar prop opcional `onDirectionPending?: (info:{ message:string; reference?:string }) => void`.
- Nos dois handlers (`handleApprove` e `handleApproveFromReview`), trocar a condição `mode === 'substitution' && data.bp_status === 'failed'` por `data.bp_status === 'failed'`; montar estado com `message: data.message`, `failureReference: data.failure_reference`, `signatureUrl`, `brandProfileData:null`, `logoStatus:'generated'`; chamar `onDirectionPending?.({ message: data.message, reference: data.failure_reference })` ao entrar.
- `handleRetryBP`: em falha funcional, atualizar `message` e `failureReference` a partir de `data.message`/`data.failure_reference`; em sucesso, montar `brandProfileData` a partir de `data.profile` (`safe_color_tokens`, `visual_style`, `visual_tone`, `brand_personality`, `brand_colors_chosen`, `inferred_primary_color`, `inferred_accent_color`, `metadata`) e chamar `onComplete({ logoStatus:'generated', signatureUrl: state.signatureUrl, brandProfileData })` antes de `onClose()`. Manter `onTier2Retry` com precedência quando fornecida.
- Render de `bp_failed`: título "Direção visual pendente"; exibir `state.message`; se `failureReference`, exibir "Código de suporte: {failureReference}"; botão principal "Realinhar direção visual"; manter botão "Continuar" apenas como fechar (não é "ignorar e continuar" do fluxo de recuperação).

Em `store-identity-form.tsx`:
- Novo estado `directionPending: { pending:boolean; reference:string|null; error:boolean; message:string|null }` inicial `{pending:false,reference:null,error:false,message:null}` e `isRealinhandoDirection` (ou reutilizar `isRealinhando` do hook para o banner).
- No `load` (useEffect ~L570): incluir `fetch(\`/api/store/${storeId}/brand-profile?status=direction-state\`)` no `Promise.all`. Avaliar o estado antes de aplicar o perfil. Se read ok e `pending` true: `setDirectionPending({pending:true,reference,error:false,message:'Sua assinatura foi aprovada, mas não conseguimos concluir a direção visual. A geração de campanhas ficará indisponível até a conclusão. Informe ao suporte o código ' + (reference ?? '') + '. Após a orientação do suporte, clique em Realinhar direção visual.'})`; limpar `setInferredProfile(null)`, `setBrandColorsChosen([])`, `setDetectedColors([])`, `setAccentColor('')`; NÃO aplicar `profileRes` mesmo que venha synced; não executar o diagnóstico de `failed` como ausência. Se a leitura do direction-state falhar: `setDirectionPending({pending:true,reference:null,error:true,message:'Não foi possível verificar a direção visual. Recarregue a página. A geração de campanhas permanece bloqueada até a verificação.'})` + limpar os mesmos campos; nunca cair no ramo legado/ausência por causa dessa falha.
- Remover `latest.metadata?.error` do log de diagnóstico (usar apenas `latest.metadata?.errorType`).
- Adicionar `handleDirectionRealign`: `POST /api/store/${storeId}/brand-profile/realign`; em sucesso (`res.ok && data.success !== false`): aplicar `data.profile` em `inferredProfile`/`brandColorsChosen`/`accentColor`/`detectedColors` quando presentes, `setDirectionPending({pending:false,reference:null,error:false,message:null})`, `setReadinessRefreshKey(k=>k+1)`, `setDriftRefreshKey(k=>k+1)`; em falha: `setDirectionPending(prev => ({...prev, reference: data.failure_reference ?? prev.reference, message: data.message ?? 'Não foi possível realinhar a direção visual. Tente novamente.', error:false}))`.
- Em `handleApprovalComplete`: adicionar `setReadinessRefreshKey(k=>k+1)` e `setDirectionPending({pending:false,reference:null,error:false,message:null})`.
- Passar `onDirectionPending={({message,reference}) => setDirectionPending({pending:true,reference:reference ?? null,error:false,message})}` ao `VisualSignatureApprovalModal`.
- Renderizar `<DirectionPendingBanner ... />` quando `directionPending.pending`, em posição persistente do bloco de identidade (acima das ações de geração), sem alterar drift/layout dos demais blocos.
- NÃO importar `product-1-1`.

Testes:
- `direction-pending-banner.test.tsx`: renderiza título, mensagem, referência, botão exato, `role="alert"`, dispara `onRealign`, estado `error` mostra o título de erro, botão desabilitado com `isRealinhando`.
- `visual-signature-approval-modal.test.tsx`: atualizar o teste de função que afirmava "standard ignora bp_status" para o novo contrato; adicionar rendered tests standard e substitution com `bp_status:'failed'` (mensagem/referência/botão); sucesso do realign chama `onComplete` com `brandProfileData` do `data.profile`; nova falha mantém `bp_failed` e atualiza referência; `done` só quando não há falha.
- `store-identity-form.direction-pending.test.tsx` (novo, jsdom): mockar `fetch` para `store`, `logo`, `?status=synced`, `?status=direction-state` e `check-readiness`; cobrir load pendente (campos limpos, banner/referência, sem aplicar perfil), load sem pendência (perfil aplicado), erro de leitura (banner de erro e campos limpos), realign sucesso (aplica perfil, dispara novo `check-readiness`) e realign falha (mantém pendência/referência). Se o componente exigir muitos mocks, testar via Wrapper mínimo como nos testes existentes de `store-identity-form.*.test.tsx`.
  </action>
  <verify>
    <automated>npx --no-install vitest run src/components/flow/__tests__/direction-pending-banner.test.tsx src/components/flow/__tests__/visual-signature-approval-modal.test.tsx src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx && npm run typecheck</automated>
  </verify>
  <done>Banner persistente com referência e CTA; modal trata bp_failed nos dois modos e recupera via realign; formulário detecta pendência no load, limpa campos orientadores, nunca apresenta ausência/legado e reexecuta readiness após recuperar.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → API routes | Corpo/params não confiáveis; `requireAuthorizedStore`/`requireSameOrigin` já aplicados |
| API route → Supabase | Updates condicionais em JSONB e perfis; erro de leitura não pode virar ausência |
| API route → provider IA | Mensagens de erro externas não podem vazar ao cliente |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261025-01 | Tampering | `direction-pending` updates | mitigate | Updates sempre condicionais a `store_id` + `status='active'`/`'synced'`; `mark...` fail-closed em erro |
| T-261025-02 | Information Disclosure | approve/realign catch | mitigate | `error` sempre código seguro; `sanitizeDirectionDiagnostic` remove `sk-*`, Bearer e URLs; nunca logar objeto de erro bruto |
| T-261025-03 | Tampering | resposta atrasada de assinatura substituída | mitigate | `assertActiveVisualSignature` antes de qualquer update/insert; superseded → 409 sem cleanup/metadata |
| T-261025-04 | Denial of Service | leitura de estado falhando | mitigate | Falha de leitura → 500 `direction_state_unavailable`/bloqueio explícito, nunca tratar como "sem pendência" |
| T-261025-05 | Elevation of Privilege | `?status=direction-state` | mitigate | Mantém `requireAuthorizedStore(id)` antes da leitura |
| T-261025-SC | Tampering | instalação de pacotes | accept | Nenhuma dependência nova é instalada nesta quick task |
</threat_model>

<verification>
Executar, a partir da raiz do repositório, sem Docker/banco/Supabase CLI/psql/provider/rede:

```bash
npx --no-install vitest run \
  src/lib/visual-signature/__tests__/direction-pending.test.ts \
  src/lib/visual-signature/__tests__/brand-profiler.test.ts \
  "src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts" \
  "src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts" \
  "src/app/api/store/[id]/brand-profile/__tests__/route.test.ts" \
  src/components/flow/__tests__/direction-pending-banner.test.tsx \
  src/components/flow/__tests__/visual-signature-approval-modal.test.tsx \
  src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx \
  src/app/api/campaign/generate-image/__tests__/route.test.ts

npm run typecheck
npm run lint
git diff --check
```

Verificações estáticas adicionais:
```bash
# Proibição de importar product-1-1 nos arquivos alterados (esperado: nenhuma saída)
rg -n "@/lib/product-1-1" \
  src/lib/visual-signature/direction-pending.ts \
  src/app/api/store/[id]/visual-signature/approve/route.ts \
  src/app/api/store/[id]/brand-profile/realign/route.ts \
  src/app/api/store/[id]/brand-profile/route.ts \
  src/components/flow/direction-pending-banner.tsx \
  src/components/flow/visual-signature-approval-modal.tsx \
  src/components/flow/store-identity-form.tsx

# Sem migration/tabela/coluna/status novo nesta entrega (esperado: nenhuma saída)
git diff --name-only -- supabase/migrations
rg -n "processing.*synced.*outdated.*failed.*archived" src/lib/visual-signature/direction-pending.ts || true
```

Observações de escopo:
- NÃO executar Docker, banco, Supabase CLI, psql, provider ou rede.
- NÃO criar/alterar migrations, tabelas, colunas, status, pricing, prompts, modelos, flags ou env.
- Executor commita apenas código/testes; `.planning` permanece com o orquestrador.
- Se qualquer exigência se mostrar inviável sem mudança estrutural, parar e declarar o impedimento (não ampliar escopo).
</verification>

<success_criteria>
- [ ] `direction-pending.ts` implementa o contrato A com fail-closed e sanitização, sem `product-1-1`.
- [ ] `BrandProfilerInput.assertActiveVisualSignature` existe e o profiler o chama antes de `generate()` (reuso), `persistProfile`, `persistWithRegenerate` e `persistFailedProfile`.
- [ ] Approve standard e substitution padronizam a falha via helper, removem o restore e gravam metadata/reference, retornando `bp_status:'failed'` e `brand_profile_status:'failed'` sem cores de fallback.
- [ ] `GET ?status=direction-state` e o realinhamento recuperam/limparam o estado; realinhamento comum preserva o perfil.
- [ ] UI mostra banner persistente com referência e "Realinhar direção visual"; modal trata `bp_failed` nos dois modos; formulário não trata falha de leitura como ausência/legado.
- [ ] Suíte offline focada, typecheck, lint e `git diff --check` verdes.
- [ ] Nenhuma migration/tabela/coluna/status novo, nenhuma chamada externa.
</success_criteria>

<output>
Criar `.planning/quick/261025-svt-recuperacao-de-direcao-visual-apos-falha/261025-svt-SUMMARY.md` ao concluir
</output>
