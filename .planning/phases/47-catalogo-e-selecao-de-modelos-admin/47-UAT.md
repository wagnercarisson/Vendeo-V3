# F47 UAT — Catálogo e Seleção de Modelos Admin

**Status:** LOCAL UAT APPROVED — sinal `approved` registrado em 2026-09-15 (migration remota e deploy BLOQUEADOS)
**Environment:** Supabase local (`API_URL` derivado de `npx supabase status -o env`, tipicamente `http://127.0.0.1:54321`)
**Remote migration/deploy:** BLOCKED and not executed

## Entrada oficial

`switch-env.ps1` é a única entrada de troca de ambiente. Nunca rode `npm run dev` direto neste UAT — o `.env.local` pode apontar para o projeto remoto.

```powershell
.\switch-env.ps1 local
```

O modo `local`:
- obtém `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` e `DB_URL` de `npx supabase status -o env` (nunca hardcoded);
- recusa API/DB que não sejam `localhost`/`127.0.0.1`;
- garante o Auth local com `captcha enabled`, `provider turnstile` e o **secret de teste** do Cloudflare (reiniciando o stack com volumes/dados preservados apenas se necessário);
- **alinha as duas camadas de captcha**: (a) `public.feature_flags.captcha_enabled = true` no banco local (a flag do banco tem precedência sobre `VENDEO_CAPTCHA_ENABLED`) e (b) o captcha Turnstile do Supabase Auth com o secret de teste. Sem o alinhamento da flag, o formulário ocultaria o captcha enquanto o Auth recusaria o login;
- escreve `.env.local` local sem as 14 env-vars de modelo/provider removidas pela F46;
- **não** executa `supabase db reset`;
- inicia o dev server oculto, controlado por PID do próprio workspace, e registra o caminho do log (`logs/dev-*.log`).

`scripts/uat/47-local-dev.ps1` é apenas um wrapper obsoleto que delega para `switch-env.ps1 local`.

## Ordem obrigatória do UAT

Execute exatamente nesta ordem:

1. **Trocar para local + Auth:** `.\switch-env.ps1 local`. Confirme a mensagem `Auth local OK: captcha=true provider=turnstile secret=test`.
2. **Bootstrap do admin:** `node scripts/uat/47-local-bootstrap.mjs`. O script comprova login local real (Auth + captcha de teste) e imprime as credenciais temporárias. Guarde-as apenas para esta sessão.
3. **Instalar fixtures:** `node scripts/uat/47-local-fixtures.mjs`. Cria seleção `campaign_copy` deprecated, seleção `campaign_image` missing e modelo ativo sem pricing.
4. **Reiniciar o Next:** rode `.\switch-env.ps1 local` novamente (ou reinicie o dev server) para evitar cache de módulo anterior.
5. **Validar deprecated e missing** (UAT-09, UAT-10).
6. **Validar pricing ausente** (UAT-11).
7. **Limpar fixtures e aguardar o TTL:** `node scripts/uat/47-local-fixtures.mjs --cleanup` e espere > 30s (ou reinicie o dev server) antes do próximo passo.
8. **Validar seleção primary, fallback, sem fallback e reset** (UAT-04..UAT-07).
9. **Validar geração normal e labels** (UAT-12 humano).
10. **Cleanup do admin e retorno opcional ao remoto:** `node scripts/uat/47-local-bootstrap.mjs --cleanup <userId>` e, se quiser, `.\switch-env.ps1 remote`.

## Fixtures e cleanup

- Setup e cleanup são idempotentes e restauram o estado anterior via snapshot em `%TEMP%\vendeo-f47-uat-fixtures.json`.
- Se o snapshot não existir e houver resíduo, o cleanup exige `npx supabase db reset` (local).
- O cleanup do admin remove `admin_users`, as linhas de `admin_audit_log` do actor e o usuário de Auth, e verifica ausência de resíduos.

## Preconditions

- [x] Local Supabase disponível (stack sobe via `switch-env.ps1 local`).
- [x] Migrations F47 locais aplicadas (`20260914000001`, `20260914000002`, `20260914000003`).
- [x] Verificador SQL local 23/23.
- [x] Nenhuma ação remota executada.
- [ ] Admin local criado pelo passo 2.

## Automated Evidence

| Evidence | Result |
|---|---|
| Full Vitest local regression | PASS — 287 files / 2782 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; one pre-existing non-blocking warning is outside F47 |
| `npm run build` | PASS |
| F47 migration verifier | PASS — 34/34 (inclui RLS/ownership de campaigns) |
| Frozen-surface verifier | PASS — 51 changed paths / 0 violations |

## Human Scenarios

Registre evidência, timestamp e resultado. Não marque PASS por inspeção de código.

| ID | Scenario | Evidence to collect | Result |
|---|---|---|---|
| UAT-01 | Open `/admin/ai-model-selection` as admin | Page loads; groups Texto, Visual, Imagem; desktop e celular sem sobreposição | PASS (humano) |
| UAT-02 | Inspect all capabilities | All 11 capabilities visible; `campaign_image_edit` is independent | PASS (humano) |
| UAT-03 | Inspect effective/default/origin | Current target, registry default and origin are distinct and readable | PASS (humano) |
| UAT-04 | Change `campaign_copy` primary | Select active catalog model, provide reason, save; audit feedback | PASS (humano) |
| UAT-05 | Change `campaign_copy` fallback | Select active fallback and save; fallback current/default/status visible | PASS (humano) |
| UAT-06 | Disable `campaign_copy` fallback | Select `Sem fallback`, save with reason; current shows no fallback | PASS (humano) |
| UAT-07 | Restore default | Click `Restaurar padrão` with reason; reset result and reload | PASS (humano) |
| UAT-08 | Retry/idempotency | **AUTOMATED:** route/form tests prove same operationId only for identical action+payload and new UUID after change | AUTOMATED PASS |
| UAT-09 | Deprecated configured target | Deprecated target remains `current` and is flagged | PASS (humano) |
| UAT-10 | Missing/invalid configured target | Default is `current`; configured diagnostic shows missing | PASS (humano) |
| UAT-11 | Pricing warning | No-pricing model shows warning without blocking save | PASS (humano) |
| UAT-12 | Telemetry/diagnostic labels | **AUTOMATED:** attempted image-edit model reaches `MetricsWriter`. **HUMAN:** effective labels visible in normal local generation | PASS (humano) + AUTOMATED PASS |

## Human UAT Result

**Aprovação:** sinal `approved` registrado em 2026-09-15. Encerra SOMENTE o checkpoint de UAT local; migration remota exige `authorize remote migration` e deploy exige `authorize deploy` (checkpoints separados).

UAT humano executado no ambiente local (2026-09-15). Resultado: UAT-01..07 PASS; UAT-08 AUTOMATED PASS; UAT-09..12 PASS. Seleção, reset, deprecated, missing, pricing warning e labels efetivos funcionaram. Campanha local concluída com a seleção efetiva:

| Capacidade | Alvo efetivo |
|---|---|
| `brand_profile_text` | openai/gpt-4o |
| `campaign_copy` | openai/gpt-4o |
| `campaign_image` | openai/gpt-5.5 |
| `campaign_image_review` | openai/gpt-4o |

Três problemas operacionais locais foram identificados e corrigidos neste ciclo (sem tocar `src/**`): alinhamento da flag `captcha_enabled` local, migration forward de SELECT em `campaigns` para `authenticated` e cleanup completo do UAT local.

## Remote Migration Result

Aplicada em 2026-09-15 (`authorize remote migration`) via `npx supabase db push`, sem deploy:

- `20260914000001_f47_ai_model_catalog_selection.sql`
- `20260914000002_f47_fix_admin_create_store_lint.sql`
- `20260914000003_f47_fix_admin_get_ai_costs_created_at.sql`
- `20260915000001_f47_fix_campaigns_authenticated_select.sql`

Verificação remota somente-leitura: 12 seeds exatos; RLS habilitado em `ai_model_catalog`/`ai_model_selection`/`campaigns`; RPCs `admin_set_ai_model_selection`/`admin_reset_ai_model_selection` presentes e validando motivo; `anon` negado; `authenticated` com SELECT em `campaigns`; CHECKs de fallback/distinção e de auditoria presentes. Nenhum deploy executado.

## Deploy Result

Deploy executado em 2026-09-15 (`authorize deploy`) via merge fast-forward para `main` e push (`2860115b..b892acb2`). Vercel Production deployment **Ready**; `https://vendeo-v3.vercel.app` → HTTP 200. Nenhuma env-var remota foi criada, removida ou alterada neste ciclo. Verificação de envs encontrou 11 env-vars obsoletas de modelo/provider ainda presentes na Vercel; remoção pendente de autorização explícita.

## Human Decision

**Não avance para migration remota ou deploy até todos os cenários terem evidência real.**

Resume signals são separados:
- `approved` encerra somente o checkpoint de UAT local.
- `authorize remote migration` é exigido antes de qualquer discussão/ação de `db push` remoto.
- `authorize deploy` só pode ser solicitado após a migration remota verificada.
