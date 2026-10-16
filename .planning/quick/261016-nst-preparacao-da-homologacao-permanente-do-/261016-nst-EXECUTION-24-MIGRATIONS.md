---
id: 261016-nst
part: execution-24-migrations
status: executed
date: 2026-10-16
---

# Execução das 24 migrations em `vendeo-homolog` (A→G)

Autorização única concedida. Execução **exclusivamente local** (`migration up --local`),
em grupos, com verificação por grupo e parada em falha. **Nenhum arquivo de migration
versionado foi editado**; **sem** retry/reparo automático de migration.

## Pré-voo
- Destino revalidado: `project_id="vendeo-homolog"`, container `running`, `.env.local → 127.0.0.1:57781`, DB acessível.
- Hashes das 24 em `pending-24\` conferidos contra `pending-24-migrations.json` → **OK**.

## Grupos (resultado)
| Grupo | Versões | `up` exit | ledger | verificação | OK |
|---|---|---|---|---|---|
| A F48.2.1 | 2 | 0 | 101 | `lab_prompt_programs` | ✅ |
| B F56.1 | 3 | 0 | 104 | pair config/snapshots/failure diagnoses + `ai_model_pricing.quality` | ✅ |
| C F56.2a | 2 | 0 | 106 | flags `product_1_1_*` + `image_generation_operations` | ✅ |
| D F56.2b1a | 5 | 0 | 111 | `product_flow_stage_authorizations` + `...campaign_credit_operations` | ✅ |
| E F56.2b1b | 5 | 0 | 116 | claims/artifacts/copy_state | ✅ |
| F F56.2b2a | 3 | 0 | 119 | `copy_state.attempt_seq` | ✅ |
| G F56.2b2b | 4 | 0 | 123 | (ledger) | ✅ |

## Comprovação final
- **123 versões exatas registradas, nenhuma pendente local:** `migration list --local` = 123/123 (applied 123, pending 0); ledger = 123.
- **Dados preservados:** `stores=2`, `campaigns=59`, `users=2`.
- **Policies preservadas:** `storage.objects` = **15** (as reproduzidas do remoto seguem); `objects` = **116**.
- **Flags novas desligadas:** `product_1_1_all_stores_enabled=false`, `product_1_1_test_stores_enabled=false` (total de flags = 8).
- **Geração ainda pausada:** `.env.local` `VENDEO_GENERATION_PAUSED=true`; **nenhuma geração paga** executada.
- **Aplicação acessível:** Next em `127.0.0.1:3000` (loopback) → `/` = 200, `/login` = 200. Sem redefinir senhas.

## Incidentes (somente do meu harness; nenhuma falha de migration)
1. **1ª execução:** o wrapper de invocação do CLI quebrou o *quoting* de `--prefix "C:\Projetos\Vendeo V3"` → **nenhuma migration aplicada** (ledger permaneceu 99). Corrigido o wrapper.
2. **2ª execução:** grupo A aplicou de fato (ledger 101, `up` exit 0, "Local database is up to date."), mas **meu verificador** reportou falso negativo porque o Postgres serializa boolean como `t`/`f` (eu comparava com `true`). **Nenhum arquivo de migration foi tocado**; corrigido o verificador; grupo A é idempotente.
3. **3ª execução:** A→G completos, todos os grupos verdes.

Regra de parada honrada: a execução parou nos pontos acima e só prosseguiu após **diagnóstico** (sem retry/reparo de migration).

## Recuperação
- Não foi necessária. Ponto de recuperação preservado: `recovery\homolog-pre24mig-20261016-182920.dump` (`-Fc`, sha256 `360F6E…`) + snapshot.

## Teste LAN humano (registrado, sem repetição)
- **Relato do usuário:** `http://192.168.1.8:57781/rest/v1/` e `http://192.168.1.8:57783/` deram **timeout** no **celular, no Wi-Fi principal**.
- Interpretação: **favorável** (sem resposta HTTP = sem alcance aparente), porém **não conclusivo** isoladamente (não confirmado que o dispositivo está na mesma rede sem isolamento de clientes).
- **Porta 57782 não foi coberta** (Postgres não fala HTTP) — não declarar cobertura.
- Pendência LAN permanece **aberta**; não solicitar repetição.
