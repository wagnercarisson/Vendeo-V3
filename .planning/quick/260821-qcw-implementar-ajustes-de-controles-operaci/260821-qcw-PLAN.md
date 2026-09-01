---
phase: 260821-qcw-ajustes-controles-operacionais
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260821000002_qcw_operational_flags.sql
  - src/lib/feature-flags/feature-flag-service.ts
  - src/lib/feature-flags/__tests__/feature-flag-service.test.ts
  - src/lib/launch-config/config.ts
  - src/lib/launch-config/__tests__/config.test.ts
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/signup/page.tsx
  - src/app/(auth)/forgot-password/page.tsx
  - src/app/(auth)/login/__tests__/login-page.test.tsx
  - src/__tests__/auth/signup-page.test.tsx
  - src/app/(auth)/forgot-password/__tests__/forgot-password-page.test.tsx
  - src/lib/credit/types.ts
  - src/lib/credit/operation-cost-service.ts
  - src/lib/credit/__tests__/operation-cost-service.test.ts
  - src/lib/admin/schemas.ts
  - src/app/api/admin/operation-costs/route.ts
  - src/app/api/admin/operation-costs/__tests__/route.test.ts
  - src/app/(app)/admin/operation-costs/operation-costs-form.tsx
  - src/app/(app)/admin/operation-costs/__tests__/page.test.tsx
  - src/app/api/admin/feature-flags/route.ts
  - src/app/api/admin/feature-flags/__tests__/route.test.ts
  - src/app/(app)/admin/feature-flags/page.tsx
  - src/app/(app)/admin/feature-flags/feature-flags-form.tsx
  - src/app/(app)/admin/feature-flags/__tests__/page.test.tsx
  - src/lib/admin/labels.ts
  - src/lib/admin/__tests__/labels.test.ts
autonomous: true
requirements:
  - QCW-CAPTCHA-FLAG
  - QCW-GEN-CONTROLS
  - QCW-LABELS
user_setup:
  - service: Supabase (remote)
    why: "Seeds das 3 novas flags em feature_flags precisam existir no banco remoto"
    env_vars: []
    dashboard_config:
      - task: "Aplicar migration 20260821000002_qcw_operational_flags.sql no remoto (supabase db push ou SQL editor) — seeds idempotentes ON CONFLICT DO NOTHING"
        location: "Supabase CLI (db push) ou dashboard -> SQL Editor"
  - service: Supabase Auth / Cloudflare Turnstile (previews/UAT)
    why: "A flag admin captcha_enabled controla apenas o app; para previews/UAT com domínio variável da Vercel, desligar também o CAPTCHA no Supabase Auth do ambiente correspondente, ou usar domínio autorizado no Turnstile"
    env_vars: []
    dashboard_config: []

must_haves:
  truths:
    - "Admin consegue ligar/desligar captcha (Turnstile) de login/cadastro/recuperação pela tela Controles operacionais, com motivo obrigatório + auditoria"
    - "Login, cadastro e recuperação de senha respeitam a flag captcha_enabled (fonte primária, seed `true`; em falha/not-found de leitura, fallback usa VENDEO_CAPTCHA_ENABLED se setada, senão `true` — nunca desliga captcha por acidente)"
    - "A flag captcha_enabled escopa o app: o Vendeo deixa de renderizar o Turnstile, exigir token no frontend e enviar captchaToken; ela NÃO altera a configuração de CAPTCHA do Supabase Auth — se habilitada lá, o Supabase continua exigindo token válido (limite informado na descrição da flag e na tela de Controles Operacionais)"
    - "Admin liga/desliga Geração de campanhas e Geração de assinatura visual na tela Controles operacionais (não mais em Configurações Econômicas)"
    - "Rotas de geração (generate-image / generate-without-logo) respeitam as novas flags: flag off → 503 operation_disabled; falha de leitura → enabled=true (F38 D5 fail-open)"
    - "Labels técnicos campaign_generation / visual_signature_generation humanizados (Geração de campanha / Geração de assinatura visual) em admin/costs"
    - "Histórico de auditoria humanizado: AUDIT_ACTION_LABELS.feature_flag_update = 'Atualização de controle operacional', AUDIT_ACTION_LABELS.operation_cost_update = 'Atualização de custo operacional', TARGET_TYPE_LABELS.feature_flag = 'Controle operacional', TARGET_TYPE_LABELS.operation_cost = 'Custo operacional'"
  artifacts:
    - path: "supabase/migrations/20260821000002_qcw_operational_flags.sql"
      provides: "Seeds idempotentes captcha_enabled, campaign_generation_enabled, visual_signature_generation_enabled"
      contains: "captcha_enabled"
    - path: "src/lib/feature-flags/feature-flag-service.ts"
      provides: "isCaptchaEnabled / isCampaignGenerationEnabled / isVisualSignatureGenerationEnabled + ALL_FEATURE_FLAG_KEYS"
      exports: ["isCaptchaEnabled", "isCampaignGenerationEnabled", "isVisualSignatureGenerationEnabled", "ALL_FEATURE_FLAG_KEYS"]
    - path: "src/lib/credit/operation-cost-service.ts"
      provides: "getCost/getAllCosts resolvem enabled das feature_flags (fallback true — F38 D5)"
      contains: "FeatureFlagService"
    - path: "src/app/(app)/admin/feature-flags/page.tsx"
      provides: "Tela Controles operacionais renderizando as 4 flags com labels humanizados"
      contains: "ALL_FEATURE_FLAG_KEYS"
    - path: "src/lib/admin/labels.ts"
      provides: "Labels humanizados de auditoria para feature_flag_update / operation_cost_update (AUDIT_ACTION_LABELS + TARGET_TYPE_LABELS)"
      contains: "feature_flag_update"
  key_links:
    - from: "src/app/(auth)/login/page.tsx"
      to: "src/lib/feature-flags/feature-flag-service.ts"
      via: "isCaptchaEnabled() substitui getLaunchConfig().captchaEnabled"
      pattern: "isCaptchaEnabled"
    - from: "src/lib/credit/operation-cost-service.ts"
      to: "src/lib/feature-flags/feature-flag-service.ts"
      via: "enabled resolvido das flags de geração"
      pattern: "isCampaignGenerationEnabled|isVisualSignatureGenerationEnabled"
---

<objective>
Ajustar os controles operacionais do admin: criar flag operacional de captcha (padrão F43
feature_flags/motivo/auditoria/fallback), mover os controles de habilitação de geração de
campanhas e de assinatura visual de "Configurações Econômicas" para "Controles operacionais",
e humanizar os labels técnicos das operações no admin/costs.

Purpose: Controles de operação (captcha on/off, geração on/off) ficam centralizados numa única
superfície administrativa com motivo obrigatório + auditoria atômica (RPC
admin_update_feature_flag já existente e genérico por key — sem mudança de RPC). Custos em
créditos permanecem em Configurações Econômicas. Fallbacks seguros preservam o comportamento
atual em falha de leitura (captcha ON por padrão — seed `true` + fallback `true`, nunca desliga o
envio de captchaToken por acidente; geração ON por padrão — F38 D5 fail-open).

Limite honesto da flag captcha_enabled: ela desliga o captcha no nível do APP — o Vendeo deixa
de renderizar o Turnstile, exigir token no frontend e enviar captchaToken ao Supabase Auth,
permitindo desligar sem redeploy (UAT/preview com domínio variável da Vercel). A flag NÃO altera
a configuração de CAPTCHA do Supabase Auth: se o CAPTCHA estiver habilitado lá, o Supabase
continua exigindo token válido. Para previews/UAT, o operador deve desligar também o CAPTCHA no
Supabase Auth do ambiente correspondente ou usar domínio autorizado no Turnstile. Esse limite
deve ficar visível na descrição da flag (seed) e na tela de Controles Operacionais.
Output: Migration de seeds + FeatureFlagService estendido + telas/rotas atualizadas + labels de
auditoria + testes.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

# Padrão F43 (feature_flags) — fonte da verdade a reutilizar:
@supabase/migrations/20260821000001_f43_create_feature_flags.sql
@src/lib/feature-flags/feature-flag-service.ts
@src/app/api/admin/feature-flags/route.ts
@src/app/(app)/admin/feature-flags/page.tsx
@src/app/(app)/admin/feature-flags/feature-flags-form.tsx

# Custos por operação (F38) — origem dos controles de habilitação a mover:
@src/lib/credit/operation-cost-service.ts
@src/app/(app)/admin/operation-costs/operation-costs-form.tsx
@src/lib/admin/schemas.ts

# Estado atual do captcha (env var VENDEO_CAPTCHA_ENABLED, default false → vira fallback/override
# no FeatureFlagService: em falha de leitura, env se setada; senão true):
@src/lib/launch-config/config.ts
@src/app/(auth)/login/page.tsx
@src/app/(auth)/signup/page.tsx
@src/app/(auth)/forgot-password/page.tsx

<interfaces>
<!-- Contratos existentes que o executor NÃO deve renegociar -->

From src/lib/feature-flags/feature-flag-service.ts (padrão a estender):
export const FORCE_BRIEF_VISION_CHECK_KEY = "force_brief_vision_check";
export class FeatureFlagService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}
  async isForceBriefVisionCheckEnabled(): Promise<boolean>; // fallback false + env VENDEO_FORCE_BRIEF_VISION_CHECK
}
export async function isForceBriefVisionCheckEnabled(): Promise<boolean>;

From src/lib/credit/types.ts (sem server-only, importável por UI):
export const OPERATION_KEYS = ["campaign_generation", "visual_signature_generation"] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];
export interface OperationCostResolution {
  operationKey: OperationKey; costCredits: number; enabled: boolean; source: "table" | "fallback";
}

From src/lib/credit/operation-cost-service.ts:
export const DEFAULT_OPERATION_COSTS: Record<OperationKey, { costCredits: number; enabled: boolean }>;
export class OperationCostService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin);
  async getCost(operationKey: OperationKey): Promise<OperationCostResolution>;
  async getAllCosts(): Promise<AdminOperationCost[]>; // { operationKey, costCredits, enabled, updatedByUserId, updatedAt, source }
}

From src/lib/admin/schemas.ts (PUT /api/admin/operation-costs):
export const UpdateOperationCostRequestSchema = z.object({
  operationKey: z.enum(OPERATION_KEYS),
  costCredits: z.number().int().min(1).optional(), // vira obrigatório nesta task
  enabled: z.boolean().optional(),                 // remover nesta task
  reason: z.string().min(1),
  operationId: z.string().uuid().optional(),
}).refine((v) => (v.costCredits === undefined) !== (v.enabled === undefined), { ... }); // refine XOR remover

RPC admin_update_feature_flag(p_key, p_enabled, p_reason, p_actor_id, p_operation_id) → genérico
por key (flag_not_found se key ausente); auditoria atômica action=feature_flag_update,
target_type=feature_flag, metadata { key, old_value, new_value, reason }. Sem mudanças no RPC.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Flag operacional de captcha (migration + serviço + páginas + testes)</name>
  <files>
    supabase/migrations/20260821000002_qcw_operational_flags.sql (novo)
    src/lib/feature-flags/feature-flag-service.ts
    src/lib/feature-flags/__tests__/feature-flag-service.test.ts
    src/lib/launch-config/config.ts
    src/lib/launch-config/__tests__/config.test.ts
    src/app/(auth)/login/page.tsx
    src/app/(auth)/signup/page.tsx
    src/app/(auth)/forgot-password/page.tsx
    src/app/(auth)/login/__tests__/login-page.test.tsx
    src/__tests__/auth/signup-page.test.tsx
    src/app/(auth)/forgot-password/__tests__/forgot-password-page.test.tsx
  </files>
  <action>
    **Migration (QCW-CAPTCHA-FLAG):** criar `supabase/migrations/20260821000002_qcw_operational_flags.sql`
    com APENAS seeds idempotentes na tabela `feature_flags` existente (ON CONFLICT (key) DO NOTHING,
    padrão da migration F43) — sem mudança de schema nem de RPC. Seeds:
    1. `('captcha_enabled', true, 'Controla se o Vendeo exibe o Turnstile e envia captchaToken nos fluxos de login, cadastro e recuperacao de senha. Nao altera a configuracao de CAPTCHA do Supabase Auth; se ela estiver ligada no Supabase, o Auth continuara exigindo token valido.')`
    2. `('campaign_generation_enabled', true, 'Habilita a geracao de campanhas (POST /api/campaign/generate-image). Quando desligada, a operacao fica indisponivel (503).')`
    3. `('visual_signature_generation_enabled', true, 'Habilita a geracao de assinatura visual (generate-without-logo). Quando desligada, a operacao fica indisponivel (503).')`
    Incluir bloco REVERT comentado (DELETE das 3 keys). NÃO alterar CHECKs do admin_audit_log.

    **Serviço (QCW-CAPTCHA-FLAG):** em `src/lib/feature-flags/feature-flag-service.ts`, refatorar para
    helper privado genérico `readFlag(key: string, fallback: boolean, envOverride?: string): Promise<boolean>`
    preservando o comportamento EXATO atual: try/catch na cadeia
    `from("feature_flags").select("enabled").eq("key", key).maybeSingle()`; erro ou not-found →
    console.warn operacional; se `envOverride` presente e `process.env[envOverride] === "true"` → `true`;
    senão → `fallback`. Adicionar helper local `envVarBool(key: string, defaultValue: boolean): boolean`
    (mesma semântica do `envBool` do launch-config: retorna o valor da env se setada como true/false,
    senão `defaultValue`). Adicionar constantes exportadas `CAPTCHA_ENABLED_KEY = "captcha_enabled"`,
    `CAMPAIGN_GENERATION_ENABLED_KEY = "campaign_generation_enabled"`,
    `VISUAL_SIGNATURE_GENERATION_ENABLED_KEY = "visual_signature_generation_enabled"` e
    `ALL_FEATURE_FLAG_KEYS = [FORCE_BRIEF_VISION_CHECK_KEY, CAPTCHA_ENABLED_KEY, CAMPAIGN_GENERATION_ENABLED_KEY, VISUAL_SIGNATURE_GENERATION_ENABLED_KEY]`.
    NESTA TASK implementar apenas: `isForceBriefVisionCheckEnabled()` =
    `readFlag(FORCE_BRIEF_VISION_CHECK_KEY, false, "VENDEO_FORCE_BRIEF_VISION_CHECK")` (comportamento
    idêntico) e `isCaptchaEnabled()` =
    `readFlag(CAPTCHA_ENABLED_KEY, envVarBool("VENDEO_CAPTCHA_ENABLED", true))`. Fallback do captcha —
    fail-safe operacional: em falha/not-found de leitura, usa `VENDEO_CAPTCHA_ENABLED` se estiver setada
    (respeita true E false); se ausente, fallback `true`. Motivo: com seed `true` + fallback `true`, a
    migration e a falha de leitura NUNCA desligam o envio de captchaToken por acidente — preserva o
    comportamento de produção e evita quebrar login/signup/recuperação quando o Supabase Auth está com
    CAPTCHA habilitado. Os métodos de geração (`isCampaignGenerationEnabled()` /
    `isVisualSignatureGenerationEnabled()`) e as funções standalone correspondentes ficam para a Task 2
    (aqui, além de `isCaptchaEnabled`, exportar as constantes necessárias para a Task 2).

    **Launch config (QCW-CAPTCHA-FLAG):** remover o campo `captchaEnabled` de `LaunchConfig` e dos dois
    retornos de `getLaunchConfig()` em `src/lib/launch-config/config.ts` (fonte única passa a ser a flag;
    a env var `VENDEO_CAPTCHA_ENABLED` continua viva como fallback/override emergencial no
    FeatureFlagService — não remover do .env.example). Remover o bloco `describe("captchaEnabled (quick NVF-260818)")` de
    `src/lib/launch-config/__tests__/config.test.ts`.

    **Páginas (QCW-CAPTCHA-FLAG):** trocar a origem do prop `captchaEnabled` nas três páginas auth:
    - `src/app/(auth)/login/page.tsx`: manter `publicSignupEnabled` de `getLaunchConfig()`; `captchaEnabled` = `await isCaptchaEnabled()` (import de `@/lib/feature-flags/feature-flag-service`).
    - `src/app/(auth)/signup/page.tsx`: idem (publicSignupEnabled do getLaunchConfig; captchaEnabled via serviço).
    - `src/app/(auth)/forgot-password/page.tsx`: `const { captchaEnabled } = await getLaunchConfig()` → `const captchaEnabled = await isCaptchaEnabled()` (remover import de getLaunchConfig se não houver outro uso).

    **Testes (QCW-CAPTCHA-FLAG):**
    - `feature-flag-service.test.ts`: adicionar casos para `isCaptchaEnabled` (flag true → true; flag false → false;
      erro de leitura sem env → true (fail-safe); erro + `process.env.VENDEO_CAPTCHA_ENABLED="true"` → true;
      erro + `process.env.VENDEO_CAPTCHA_ENABLED="false"` → false) e manter os casos existentes passando (mesmo mock chain do `mockFrom`).
    - `login-page.test.tsx` / `signup-page.test.tsx` (em `src/__tests__/auth/signup-page.test.tsx`) / `forgot-password-page.test.tsx`: substituir o mock de
      `getLaunchConfig().captchaEnabled` por `vi.mock("@/lib/feature-flags/feature-flag-service", () => ({ isCaptchaEnabled: vi.fn(() => Promise.resolve(flagMock.captchaEnabled)) }))`
      — `data-captcha-enabled` agora vem do serviço. Em login/signup, manter o mock de getLaunchConfig apenas para
      `publicSignupEnabled` (remover a chave captchaEnabled do mock).
  </action>
  <verify>
    <automated>npx vitest run src/lib/feature-flags/__tests__/feature-flag-service.test.ts src/lib/launch-config/__tests__/config.test.ts; npx vitest run "src/app/(auth)" src/__tests__/auth/signup-page.test.tsx --reporter=verbose</automated>
  </verify>
  <done>
    - Migration com os 3 seeds idempotentes: `Select-String "ON CONFLICT" supabase/migrations/20260821000002_qcw_operational_flags.sql` → 3 ocorrências (excluindo comentários) e `captcha_enabled` presente com seed `true`
    - `isCaptchaEnabled()` exportado e usado em login/signup/forgot-password (grep: `isCaptchaEnabled` nos 3 pages + no serviço) com fallback `envVarBool("VENDEO_CAPTCHA_ENABLED", true)` (env se setada, senão true)
    - `LaunchConfig` sem `captchaEnabled`; testes de launch-config e das 3 páginas auth verdes
  </done>
</task>

<task type="auto">
  <name>Task 2: Controles de geração para Controles Operacionais + labels humanizados</name>
  <files>
    src/lib/credit/types.ts
    src/lib/credit/operation-cost-service.ts
    src/lib/credit/__tests__/operation-cost-service.test.ts
    src/lib/feature-flags/feature-flag-service.ts
    src/lib/admin/schemas.ts
    src/app/api/admin/operation-costs/route.ts
    src/app/api/admin/operation-costs/__tests__/route.test.ts
    src/app/(app)/admin/operation-costs/operation-costs-form.tsx
    src/app/(app)/admin/operation-costs/__tests__/page.test.tsx
    src/app/api/admin/feature-flags/route.ts
    src/app/api/admin/feature-flags/__tests__/route.test.ts
    src/app/(app)/admin/feature-flags/page.tsx
    src/app/(app)/admin/feature-flags/feature-flags-form.tsx
    src/app/(app)/admin/feature-flags/__tests__/page.test.tsx
    src/lib/admin/labels.ts
    src/lib/admin/__tests__/labels.test.ts
  </files>
  <action>
    **Labels humanizados (QCW-LABELS):** em `src/lib/credit/types.ts` (sem server-only), adicionar
    `export const OPERATION_LABELS: Record&lt;OperationKey, string&gt; = { campaign_generation: "Geração de campanha", visual_signature_generation: "Geração de assinatura visual" };`

    **Enabled vira flag (QCW-GEN-CONTROLS):**
    - Em `src/lib/feature-flags/feature-flag-service.ts`: implementar `isCampaignGenerationEnabled()` e
      `isVisualSignatureGenerationEnabled()` via `readFlag` com fallback `true` (F38 D5 fail-open — falha
      de leitura NUNCA desliga geração) + funções standalone exportadas (constantes já criadas na Task 1).
    - Em `src/lib/credit/operation-cost-service.ts`: `getCost` passa a resolver `enabled` via FeatureFlagService
      (instância com o mesmo client injetado): `campaign_generation` → `isCampaignGenerationEnabled()`,
      `visual_signature_generation` → `isVisualSignatureGenerationEnabled()`. `source` continua refletindo
      APENAS o custo ("table" | "fallback") — não mudar o contrato de `OperationCostResolution`.
      `getAllCosts`: resolver as duas flags UMA vez (evitar N+1) e mapear por operationKey.
      Coluna `credit_operation_costs.enabled` fica legada (sem migration destrutiva).

    **API admin (QCW-GEN-CONTROLS):**
    - `src/lib/admin/schemas.ts`: `UpdateOperationCostRequestSchema` remove `enabled` e o refine XOR;
      `costCredits` vira obrigatório (`z.number().int().min(1)`).
    - `src/app/api/admin/operation-costs/route.ts` PUT: parar de aceitar/enviar `enabled` — chamar o RPC
      `admin_update_operation_cost` com `p_enabled: null` e `p_cost_credits: body.costCredits` (XOR do RPC
      continua satisfeito). GET inalterado (shape com `enabled` permanece — reflete o estado da flag).

    **Form de custos (QCW-LABELS + QCW-GEN-CONTROLS):** em `operation-costs-form.tsx`:
    - Remover coluna "Habilitada" (button Sim/Não), botão "Salvar habilitação" (`saveEnabled`), campo `enabled`
      de `RowState`/`OperationCostRow` e ajustar helper text ("uma mutação por vez: custo OU habilitação" → custo).
    - Coluna "Operação": exibir `OPERATION_LABELS[row.operationKey]` como texto visível + `row.operationKey`
      como subtexto `font-mono text-[10px] text-muted-foreground` (key técnica preservada como referência).
    - `operation-costs/page.tsx`: parar de mapear/passar `enabled` nas rows do form.

    **Labels de auditoria (QCW-AUDIT-LABELS):** em `src/lib/admin/labels.ts`, adicionar:
    - `AUDIT_ACTION_LABELS.feature_flag_update = "Atualização de controle operacional"`
    - `AUDIT_ACTION_LABELS.operation_cost_update = "Atualização de custo operacional"`
    - `TARGET_TYPE_LABELS.feature_flag = "Controle operacional"`
    - `TARGET_TYPE_LABELS.operation_cost = "Custo operacional"`
    Ajustar `src/lib/admin/__tests__/labels.test.ts` para cobrir essas labels (propriedade + `getLabel` retorna
    texto PT-BR), seguindo o padrão dos casos existentes.

    **Página Controles operacionais multi-flags (QCW-GEN-CONTROLS + QCW-CAPTCHA-FLAG):**
    - `src/app/api/admin/feature-flags/route.ts` GET: trocar `.eq("key", FORCE_BRIEF_VISION_CHECK_KEY).maybeSingle()`
      por `.in("key", ALL_FEATURE_FLAG_KEYS)` retornando `{ flags: data }` (lista) — PUT inalterado.
    - `src/app/(app)/admin/feature-flags/page.tsx`: consultar as 4 flags via `.in("key", ALL_FEATURE_FLAG_KEYS)`;
      montar rows na ordem canônica `ALL_FEATURE_FLAG_KEYS` com `label` humanizado (mapa local):
      force_brief_vision_check → "Validação IA do brief (produto × imagem)", captcha_enabled → "Captcha
      (Turnstile) em login, cadastro e recuperação de senha", campaign_generation_enabled → "Geração de
      campanhas", visual_signature_generation_enabled → "Geração de assinatura visual"; `description` do banco
      (para captcha_enabled, o seed traz o limite honesto sobre o Supabase Auth — exibir a description
      integralmente); emails de `updated_by` via consulta única `.in("id", [...userIds])` (padrão
      operation-costs page); se alguma key esperada faltar, exibir aviso (migration não aplicada) mantendo as
      encontradas.
    - `feature-flags-form.tsx`: `FeatureFlagRow` ganha `label: string`; renderizar `row.label` como título +
      `row.key` como subtexto mono; Badge genérico `s.enabled ? "Ligada" : "Desligada"` (remover texto específico
      da vision); manter descrição (`row.description ?? default`), motivo obrigatório, PUT e reload.

    **Testes (QCW-GEN-CONTROLS + QCW-LABELS):**
    - `operation-cost-service.test.ts`: mock do `mockFrom` passa a tratar também `table === "feature_flags"`
      (retornar `{ enabled: true|false }` controlável); casos: getCost com flag true → enabled true; flag false →
      enabled false; erro de leitura da flag → enabled true (fail-open); getAllCosts mapeia flags por key.
    - `operation-costs route.test.ts`: PUT com `enabled` → 400 (schema); PUT com `costCredits` → 200 e RPC com
      `p_enabled: null`; ajustar casos existentes que usavam XOR.
    - `operation-costs page.test.tsx`: assertions trocam `campaign_generation`/`visual_signature_generation` por
      "Geração de campanha"/"Geração de assinatura visual"; remover `enabled` dos fixtures de rows do form.
    - `feature-flags route.test.ts`: GET passa a usar `.in(...)` → mock com array; body agora `{ flags: [...] }`.
    - `feature-flags page.test.tsx`: renderizar as 4 flags (labels humanizados + keys mono presentes); caso de
      migration não aplicada com aviso mantendo as encontradas.
    - `labels.test.ts`: cobrir as 4 novas labels de auditoria (ação + target type).
  </action>
  <verify>
    <automated>npx vitest run src/lib/credit src/lib/feature-flags src/lib/admin/__tests__/labels.test.ts src/app/api/admin/operation-costs src/app/api/admin/feature-flags "src/app/(app)/admin/operation-costs" "src/app/(app)/admin/feature-flags" --reporter=verbose</automated>
  </verify>
  <done>
    - `OPERATION_LABELS` em types.ts; form de custos exibe labels humanizados e não tem mais coluna Habilitada
    - getCost/getAllCosts resolvem enabled das flags (grep: `FeatureFlagService` em operation-cost-service.ts)
    - PUT /api/admin/operation-costs rejeita `enabled` (schema sem o campo; teste 400)
    - GET /api/admin/feature-flags retorna lista; tela Controles operacionais com 4 flags e labels humanizados
    - `labels.ts` com `feature_flag_update`/`operation_cost_update`/`feature_flag`/`operation_cost`; labels.test.ts cobre os 4
    - Testes dos 7 arquivos de teste acima verdes
  </done>
</task>

<task type="auto">
  <name>Task 3: Gates TypeScript / lint / testes / build + regressão</name>
  <files>
    (sem arquivos novos — correções pontuais em testes que assertem comportamento antigo, ex.: mock de
    getLaunchConfig().captchaEnabled ou enabled no form de custos, se o fallout aparecer)
  </files>
  <action>
    Rodar os 4 gates na ordem e corrigir todo fallout:
    1. `npm run typecheck` (tsc -p tsconfig.typecheck.json --noEmit)
    2. `npm run lint`
    3. `npm test` (vitest run completo — base atual 2315 testes; o esperado é suite completa verde com os
       novos casos das Tasks 1-2)
    4. `npm run build` (next build + check:cnae)
    Fallout conhecido a caçar: qualquer teste que ainda mocke `captchaEnabled` vindo de getLaunchConfig, que
    chame PUT /api/admin/operation-costs com `enabled`, que asserte `campaign_generation`/`visual_signature_generation`
    como label primário em admin/costs, ou que espere coluna "Habilitada"/botão "Salvar habilitação" no form.
    Ajustar esses testes para o novo contrato (labels humanizados; enabled via flags). NÃO alterar o contrato
    público de `GET /api/operation-costs` (shape com enabled permanece).
  </action>
  <verify>
    <automated>npm run typecheck; npm run lint; npm test; npm run build</automated>
  </verify>
  <done>
    - 4 gates verdes: typecheck clean, lint clean, `npm test` 100% passando (suite completa), build ok
    - Zero referências a `getLaunchConfig().captchaEnabled` (grep) e zero `saveEnabled`/coluna Habilitada no form de custos
    - Migration aplicada localmente (`supabase db push` se CLI disponível; remoto fica para confirmação do usuário — user_setup)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| admin UI → PUT /api/admin/feature-flags | Input não validado do browser admin cruza aqui (key/enabled/reason) |
| admin UI → PUT /api/admin/operation-costs | Input não validado do browser admin cruza aqui (operationKey/costCredits/reason) |
| feature_flags table → rotas públicas (login/signup/forgot-password, generate-image, generate-without-logo) | Estado operacional lido server-side; falha de leitura não pode derrubar fluxo |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-QCW-01 | Tampering | PUT /api/admin/feature-flags | mitigate | key/enabled/reason validados na rota (400); escrita delegada ao RPC SECURITY DEFINER com motivo obrigatório + auditoria atômica (feature_flag_update); requireAdmin no topo |
| T-QCW-02 | Tampering | PUT /api/admin/operation-costs | mitigate | schema zod sem `enabled` (costCredits obrigatório); RPC admin_update_operation_cost com XOR + auditoria; requireAdmin |
| T-QCW-03 | DoS | flag captcha_enabled=false | accept | Decisão operacional legítima do admin (desligar captcha reduz anti-bot em login); mitigado por trilha de auditoria com motivo obrigatório e por ser superfície autenticada de admin |
| T-QCW-04 | DoS | leitura feature_flags falha (geração) | mitigate | readFlag com fallback `true` para as flags de geração (F38 D5 fail-open) — falha de leitura NUNCA desliga geração |
| T-QCW-05 | DoS | leitura feature_flags falha (captcha) | mitigate | readFlag com fallback `envVarBool("VENDEO_CAPTCHA_ENABLED", true)` (env se setada, senão true — fail-safe de infra) — falha de leitura nunca desliga captcha por acidente, evitando quebrar login/signup/recuperação quando o Supabase Auth exige token |
| T-QCW-06 | Spoofing | flag key arbitrária no PUT | mitigate | RPC retorna flag_not_found para key inexistente (404); seeds idempotentes garantem as 3 novas keys |
</threat_model>

<verification>
- Grep-consistência: zero resíduos de `captchaEnabled` em launch-config; zero `saveEnabled`/"Salvar habilitação"/coluna "Habilitada" em operation-costs-form; `getLaunchConfig().captchaEnabled` não existe em nenhum arquivo
- `AUDIT_ACTION_LABELS.feature_flag_update`/`operation_cost_update` e `TARGET_TYPE_LABELS.feature_flag`/`operation_cost` presentes (labels.ts)
- 4 gates verdes (typecheck / lint / vitest / build)
- Migration de seeds aplicada (local via supabase db push; remoto a confirmar — user_setup)
</verification>

<success_criteria>
- Captcha default ON: seed `captcha_enabled = true` e fallback de leitura `envVarBool("VENDEO_CAPTCHA_ENABLED", true)` — aplicar a migration ou falhar a leitura NUNCA desliga o captcha por acidente
- Admin liga/desliga captcha em Controles operacionais (motivo obrigatório + auditoria + fallback)
- Desligar captcha no admin remove a exigência no app: widget não é renderizado, token não é exigido e captchaToken não é enviado (sem redeploy)
- A tela e a descrição da flag informam o limite: previews/UAT também dependem da configuração de CAPTCHA do Supabase Auth quando ela estiver habilitada (domínio autorizado no Turnstile ou desligar no Auth do ambiente)
- Admin liga/desliga Geração de campanhas e Geração de assinatura visual em Controles operacionais; Configurações Econômicas exibe apenas custos
- Rotas de geração respeitam as flags (503 operation_disabled com flag off; fail-open em erro de leitura)
- Labels humanizados "Geração de campanha"/"Geração de assinatura visual" em admin/costs (key técnica como subtexto)
- Histórico de auditoria humanizado para feature_flag_update ("Atualização de controle operacional") e operation_cost_update ("Atualização de custo operacional")
- Testes novos + suite completa verdes; nenhum comportamento de fallback regrediu (F38 D5 / F43)
</success_criteria>

<output>
Create `.planning/quick/260821-qcw-implementar-ajustes-de-controles-operaci/260821-qcw-SUMMARY.md` when done
</output>