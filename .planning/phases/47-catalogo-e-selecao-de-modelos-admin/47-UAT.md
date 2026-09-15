# F47 UAT — Catálogo e Seleção de Modelos Admin

**Status:** PENDING HUMAN UAT (não iniciado)
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
| F47 migration verifier | PASS — 23/23 |
| Frozen-surface verifier | PASS — 51 changed paths / 0 violations |

## Human Scenarios

Registre evidência, timestamp e resultado. Não marque PASS por inspeção de código.

| ID | Scenario | Evidence to collect | Result |
|---|---|---|---|
| UAT-01 | Open `/admin/ai-model-selection` as admin | Page loads; groups Texto, Visual, Imagem; no layout overflow on desktop/mobile | PENDING |
| UAT-02 | Inspect all capabilities | All 11 capabilities visible; `campaign_image_edit` is independent | PENDING |
| UAT-03 | Inspect effective/default/origin | Current target, registry default and `selection/default` origin are distinct and readable | PENDING |
| UAT-04 | Change `campaign_copy` primary | Select active catalog model, provide reason, save; success/audit feedback appears | PENDING |
| UAT-05 | Change `campaign_copy` fallback | Select active fallback and save; fallback current/default/status are visible | PENDING |
| UAT-06 | Disable `campaign_copy` fallback | Select `Sem fallback`, save with reason; current explicitly shows no fallback | PENDING |
| UAT-07 | Restore default | Click `Restaurar padrão` with reason; verify reset result and reload | PENDING |
| UAT-08 | Retry/idempotency | **AUTOMATED:** route/form tests prove same operationId only for identical action+payload and new UUID after change | AUTOMATED PASS |
| UAT-09 | Deprecated configured target | Com fixtures instaladas, confirmar que o alvo deprecated permanece `current` e é sinalizado | PENDING |
| UAT-10 | Missing/invalid configured target | Com fixtures instaladas, confirmar que o default é `current` e o diagnóstico mostra missing | PENDING |
| UAT-11 | Pricing warning | Com fixtures instaladas, selecionar o modelo sem pricing e confirmar aviso sem bloquear save | PENDING |
| UAT-12 | Telemetry/diagnostic labels | **AUTOMATED:** provider/service tests provam que o modelo tentado de `campaign_image_edit` chega ao `MetricsWriter`. **HUMAN:** inspecionar labels de geração normal local | AUTOMATED PASS / HUMAN PENDING |

## Human Decision

**Não avance para migration remota ou deploy até todos os cenários terem evidência real.**

Resume signals são separados:
- `approved` encerra somente o checkpoint de UAT local.
- `authorize remote migration` é exigido antes de qualquer discussão/ação de `db push` remoto.
- `authorize deploy` só pode ser solicitado após a migration remota verificada.
