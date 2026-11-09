# F60 / Plano 60-01 — Pedido de autorizações A/B/C/D

**Status:** A/B/C/D concedidas em 2026-11-09 e executadas na run `f60-20261109-02`. Prova 13/13 PASS; decisão **APPROVED** em `60-01-PROOF-DECISION.md`.
**Base:** revisão pré-aplicação aprovada em `60-01-PRE-APPLICATION-REVIEW.md`.

## Alvo definido

| Campo | Valor |
|---|---|
| Container | `supabase_db_vendeo-homolog` |
| Workdir | `G:\Vendeo-Homolog` |
| Host | `127.0.0.1` |
| Porta | `57782` |
| Banco | `postgres` |
| Ambiente | **não descartável** |

## Ledger definido

| Campo | Valor |
|---|---|
| Contagem autorizada | **153** migrations excluindo F60 |
| Última migration antes de F60 | `20261105162052` |
| Migration a aplicar | `20261109174110_f60_9_16_two_stage_control.sql` |
| SHA-256 do ledger | `3861f7a0a65717a07a2184554ecd11118e7662fb8c59f7573c2a6d5a78e59f6d` (capturado em `f60-20261109-status`) |
| Após aplicação | ledger total 154; a checagem continua excluindo F60 |

> O `prove` exige `f60_applied === true` antes do harness. O `status` anterior à aplicação exige F60 ausente.

## Janela de exclusividade definida

| Campo | Regra |
|---|---|
| Início | imediatamente após a autorização A, registrado no baseline |
| Fim | após a autorização D, registrado no baseline |
| Duração máxima | **2 horas** |
| Responsável | a designar no preenchimento |
| Condição | confirmar ausência de uso concorrente das três RPCs compartilhadas |
| RPCs afetadas | `product_1_1_close_failed_operation`, `admin_resolve_product_1_1_pending`, `product_1_1_get_campaign_operation_by_campaign` |

IDs exclusivos isolam dados, **não** as rotinas compartilhadas. A janela cobre aplicação, prova e cleanup.

## Autorizações

| ID | Autorização | Concedida? | Responsável/data |
|---|---|---|---|
| A | Aplicar a migration | **CONCEDIDA** | Responsável (2026-11-09) |
| B | Escrever dados de teste (UUIDs + rótulos `p916test-`) | **CONCEDIDA** | Responsável (2026-11-09) |
| C | Executar a prova S01–S13 | **CONCEDIDA** | Responsável (2026-11-09) |
| D | Executar cleanup (conservador) | **CONCEDIDA** | Responsável (2026-11-09) |

### Pré-condições

- [x] Revisão pré-aplicação aprovada (`60-01-PRE-APPLICATION-REVIEW.md`).
- [x] Backup/dump de referência do homolog confirmado: `homolog-pre-f60-20261109T152121Z.dump` (SHA-256 `6C0E15AE...738AC`).
- [x] Janela de exclusividade preenchida e confirmada (início registrado; fim após D).
- [x] `F60_EXPECTED_LEDGER_COUNT=153` e `F60_EXPECTED_LEDGER_SHA256` capturados no `status`.
- [x] Nenhuma outra execução usando as RPCs compartilhadas durante a janela.

## Procedimento (somente após cada autorização)

### 0. Status read-only (sem escrita)

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres@127.0.0.1:57782/postgres"
$env:F60_EXPECTED_LEDGER_COUNT = "153"
$env:F60_EXPECTED_LEDGER_SHA256 = "<capturar do snapshot>"
.\scripts\f60\run-f60-proofs.ps1 -Action status -RunId "f60-<data>-status"
```

Confirma alvo, ledger e **F60 ausente**. Se divergir, parar.

### A. Aplicar a migration

```powershell
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 --single-transaction `
  -f supabase/migrations/20261109174110_f60_9_16_two_stage_control.sql
```

- Registrar SHA-256 do arquivo e ledger depois.
- Sem `db push`, reset ou outras migrations.
- Em caso de erro: `ON_ERROR_STOP` + transação única revertem tudo; não repetir às cegas.

### B + C. Dados de teste + prova S01–S13

Conceder B e C separadamente. O harness cria as fixtures e executa a prova.

```powershell
$env:F60_HOMOLOG_AUTHORIZED = "1"
$env:F60_EXCLUSIVITY_WINDOW = "<início/fim/responsável>"
$env:TEST_DATABASE_URL = "postgresql://postgres@127.0.0.1:57782/postgres"
$env:F60_EXPECTED_LEDGER_COUNT = "153"
$env:F60_EXPECTED_LEDGER_SHA256 = "<sha capturado>"
.\scripts\f60\run-f60-proofs.ps1 -Action prove -RunId "f60-<data>-<run>"
```

O `prove`:
1. snapshot antes;
2. valida ledger **e exige F60 aplicada** antes do harness;
3. executa S01–S13;
4. snapshot depois;
5. compara esperado × observado e ledger;
6. só limpa se D estiver autorizado.

### D. Cleanup

Com `F60_CLEANUP_AUTHORIZED=1`, o cleanup é conservador: **não apaga** origem canônica, operações pendentes, ledger, desfechos ou auditoria. Sem D, nada é apagado e a pendência é registrada.

## Evidências esperadas

`evidence/<run-id>/`:
- `f60-ledger-precheck.json`
- `f60-snapshot-before.json` / `f60-snapshot-after.json` / `f60-snapshot-after-cleanup.json`
- `f60-snapshot-compare.*`
- `f60-proof-evidence.json`
- `f60-expected-additions.json`
- `cleanup-manifest.json` / `.md`

## Condições de parada

- Identidade do alvo ou ledger divergente.
- F60 ausente no `prove`.
- Qualquer cenário S01–S13 falhar ou não puder ser executado.
- Adição fora do manifesto, remoção/alteração preexistente ou ledger divergente.
- Estorno duplo, execução dupla, entrega antecipada ou item não classificado.
- Qualquer escrita fora do alvo ou tentativa de apagar `credit_transactions`.

Em qualquer condição de parada: registrar `REJECTED`, não avançar para 60-02..60-04 e não corrigir o desenho durante o checkpoint.

## Limites

Esta aprovação de revisão **não** autoriza a prova nem escritas. Cada linha A/B/C/D precisa ser concedida explicitamente. A decisão da prova permanece em `60-01-PROOF-DECISION.md` e só pode ser `APPROVED` após leitura dos resultados.
