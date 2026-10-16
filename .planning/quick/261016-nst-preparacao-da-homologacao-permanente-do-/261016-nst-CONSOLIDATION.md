---
id: 261016-nst
part: consolidation
status: prepared
date: 2026-10-16
---

# Consolidação — homologação permanente do Vendeo no Docker

Quick `261016-nst` (histórico preservado nos artefatos abaixo). Homologação **não** recriada;
importação **não** repetida (99 versões e 116 objetos preservados).

## Estado atual (verificado)

- **Origem:** `Vendeo-V3` / `gvbzwihwgzujwsviufgy` — **99 aplicadas**, última `20260924000003`, **24 pendentes** (coluna REMOTE de `migration list --linked`).
- **Destino:** `vendeo-homolog` (permanente), workdir `G:\Vendeo-Homolog`, portas **57780–57789** (API 57781/DB 57782/Studio 57783), volumes Docker preservados.
- **Baseline local:** `supabase_migrations.schema_migrations` com **99** versões (Opção A); migrations dir do homolog = **99** arquivos (baseline). As **24 pendentes** estão em staging `G:\Vendeo-Homolog\pending-24\` (fora do dir de aplicação).
- **Dados:** 2 lojas (Adega 52 + NovaTek 7 = 59 campanhas), 2 usuários, 116 objetos de Storage.
- **Storage:** **15 policies** em `storage.objects` reproduzidas do remoto (RLA/tenant isolation ativos) + grants da base.
- **Rede:** regra `vendeo-homolog block 57780-57789` aplicada; **isolamento LAN pendente de comprovação externa** (teste em outro dispositivo: 57781/57783).
- **Login:** CAPTCHA **habilitado** (site key **de teste** `1x00000000000000000000AA` + segredo de teste); `VENDEO_CAPTCHA_ENABLED=true`; `VENDEO_GENERATION_PAUSED=true`; providers neutralizados.

## Credencial da Adega — correção registrada

- **Histórico:** a validação headless (rodadas 4–5) definiu senha temporária via Admin API e registrou `password_restored=true`. Aquele flag **não provava igualdade com a credencial remota**: o login manual apontou `invalid_credentials` e a comparação read-only mostrou que o hash local da Adega **ainda correspondia à senha temporária**.
- **Reparo (registro próprio):** `261016-nst-ADEGA-CREDENTIAL-REPAIR.md` — autorizado pelo usuário, copiou-se **somente o hash atual da Adega do remoto** para o local (leitura `READ ONLY` de uma credencial, sem exibir/persistir hash; `UPDATE` de uma linha/campo com verificação de identidade e nº de linhas; NovaTek e demais campos inalterados; exit 0 na repetição). Nenhuma senha remota alterada.
- **Confirmação (esta consolidação, read-only):** a senha temporária **não** é mais válida localmente (`crypt(temp)≠hash` → `false`); hash `$2a$`, e-mail confirmado, não banido. **Login manual da Adega confirmado pelo usuário**; NovaTek acessível.
- **Decisão registrada:** **não** substituir senhas para testar login novamente. `updated_at` do usuário mudou durante o processo (divergência menor).

## Artefatos (histórico preservado)

- `261016-nst-PLAN.md`, `261016-nst-SUMMARY.md`
- `261016-nst-BASELINE.md` (baseline de migrations, executado/verificado)
- `261016-nst-NETWORK-INTEGRATIONS.md` (admin, integrações, rede + teste LAN)
- `261016-nst-APPLY-VALIDATION.md` (apply, validação, Storage, login)
- `261016-nst-PLAN-24-MIGRATIONS.md` (plano de aplicação das 24 — **aguardando autorização**)
- Evidências fora do Git: `G:\Vendeo-Homolog\{MANIFEST.json, migration-baseline.json, pending-24-migrations.json, recovery\, _probe\, pending-24\}`.

## Fora de escopo / proibido

Sem produção, **sem reset** da homologação, sem limpeza de volumes, sem flags, sem provider pago, sem deploy/push. Nenhuma das 24 migrations aplicada até autorização.

## Atualização pós-execução (2026-10-16)

- As **24 migrations pendentes** foram **aplicadas** em grupos A→G em `vendeo-homolog` (`--local`): ledger **123**, pending **0**. Detalhe em `261016-nst-EXECUTION-24-MIGRATIONS.md`.
- Preservados: dados (`stores=2, campaigns=59, users=2`), policies de storage (**15**), objetos (**116**). Flags novas **desligadas**; `VENDEO_GENERATION_PAUSED=true`; app em `127.0.0.1:3000` (`/`=200, `/login`=200); **sem** geração paga; **sem** redefinir senhas.
- Teste LAN humano registrado (timeout em 57781/57783 no celular/Wi-Fi principal); pendência **aberta**.
