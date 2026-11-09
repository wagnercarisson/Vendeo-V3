# 60-03 — Autorização para validação Postgres (PREPARADA, NÃO CONCEDIDA)

**Status:** preparado para revisão humana. **Nada foi executado.**
**Escopo:** somente as três suítes Postgres do `60-03`, no perfil `integration.f60`.
**Fora do escopo:** `60-04`, produção, deploy, push, flag, IA, migrations e qualquer alteração de código durante a execução.

> O aceite offline do `60-03` **não** aprova Postgres e **não** libera `60-04`. A execução exige autorização explícita com alvo, janela e responsável abaixo.

## 1. Autorização necessária

Preencher e aprovar ANTES de qualquer conexão:

| Campo | Valor exigido |
|---|---|
| Autorizado por | _nome do responsável_ |
| Data/hora (UTC) da autorização | _ISO-8601_ |
| Ambiente do alvo | `local-disposable` **ou** `homolog` |
| Alvo (`TEST_DATABASE_URL`) | _URL PostgreSQL loopback; nunca remota_ |
| Janela de exclusividade | _início ISO / fim ISO / responsável_ (obrigatória para homolog) |
| `F60_HOMOLOG_AUTHORIZED=1` | sim **somente** para homolog |
| `F60_TEST_ALLOW_WRITES=1` | sim (as suítes gravam fixtures e fazem `ROLLBACK`) |
| Operador da execução | _nome_ |
| Confirmação de não-produção | sim |

Alvos aceitos pelo preflight compartilhado:
- loopback (`127.0.0.1`, `localhost`, `::1`, `[::1]`);
- protocolo `postgresql:`/`postgres:`;
- homolog somente em `127.0.0.1:57782/postgres` (ou equivalente loopback) com autorização e janela vigentes;
- **qualquer host remoto é recusado antes do pool**.

## 2. Comando previsto

```powershell
# Variáveis definidas apenas na sessão de execução; nunca versionadas.
$env:TEST_DATABASE_URL = "<alvo loopback autorizado>"
$env:F60_TEST_ALLOW_WRITES = "1"
# Somente homolog:
$env:F60_HOMOLOG_AUTHORIZED = "1"
$env:F60_EXCLUSIVITY_WINDOW = "<início ISO> / <fim ISO> / <responsável>"

node scripts/testing/run-integration.mjs f60
```

`exit 0` = Vitest executou; `exit 2` = gate não executado/não aprovado; `exit 3` = perfil inválido. Nenhum segredo deve ser impresso.

## 3. Suítes e cobertura esperada

| Suíte | Cobertura principal | Resultado individual | Evidência |
|---|---|---|---|
| `financial-integration.integration.test.ts` | reserva única; base/expansão; entrega vertical e replay; estorno único; `delivered` recusa estorno; `unknown` + resolução; loja divergente; ausência de ledger paralelo | _pendente_ | _saída do Vitest + contagens_ |
| `shared-reading-compatibility.integration.test.ts` | `LegacyPendingReader` x repositório real; campos legados 1:1/9:16 direto; listagem; entre etapas; anti-join; ordem `source` | _pendente_ | _saída do Vitest_ |
| `origin-views.postgres.test.ts` | views por origem; anti-join; desfechos opcionais; histórico completo; `SECURITY DEFINER`/`search_path=""`; grants/RLS | _pendente_ | _saída do Vitest_ |
| `two-stage-control.postgres.test.ts` (60-02, preservada) | contrato Postgres do controle da operação | _pendente_ | _saída do Vitest_ |

Preencher a coluna “Resultado individual” com `PASS`/`FAIL` e a contagem exata por suíte. Não agregar como aprovado sem os quatro resultados.

## 4. Verificação de rollback e ausência de fixtures persistentes

As suítes usam transação com `ROLLBACK`. Após a execução, confirmar no MESMO alvo autorizado:

```sql
-- Nenhuma fixture dos prefixos das suítes deve permanecer.
select 'users' as kind, count(*)::int as n
  from auth.users where email like 'p916%@f60.test'
union all
select 'stores', count(*)::int from public.stores
 where name like 'p916%'
union all
select 'campaigns', count(*)::int from public.campaigns
 where product_name like 'p916%'
union all
select 'credit_ops', count(*)::int
  from public.product_1_1_campaign_credit_operations
 where campaign_id in (
   select id from public.campaigns where product_name like 'p916%'
 );
```

Critério: **todas as linhas com `n = 0`**. Se qualquer contagem for maior que zero, a execução NÃO está aprovada e o resíduo deve ser investigado/removido somente com autorização específica.

Conferir também que não existe tabela/coluna contábil paralela:

```sql
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name like 'product_9_16_%credit%';
```

Critério: **zero linhas**.

## 5. Condições de parada

Parar imediatamente e não “ajustar expectativa” se:
1. a reserva ocorrer duas vezes em qualquer caminho;
2. a confirmação ocorrer sem entrega vertical válida;
3. a compatibilidade 1:1/9:16 direto divergir;
4. houver necessidade de tabela contábil nova, migration ou alteração de assinatura compartilhada;
5. a resolução administrativa produzir mais de um efeito terminal;
6. houver resíduo de fixtures após o `ROLLBACK`;
7. for necessário iniciar `60-04`, UI, flag, rota nova ou deploy.

## 6. Registro de resultado

| Item | Valor |
|---|---|
| Autorização recebida em | _pendente_ |
| Alvo executado | _pendente_ |
| Janela | _pendente_ |
| `financial-integration` | _pendente_ |
| `shared-reading-compatibility` | _pendente_ |
| `origin-views` | _pendente_ |
| `two-stage-control` | _pendente_ |
| Rollback/fixtures | _pendente_ |
| Ledger paralelo | _pendente_ |
| Parecer final | _pendente_ |

**Enquanto este documento não estiver preenchido e aprovado, o estado permanece: Postgres NÃO EXECUTADO e NÃO APROVADO. `60-04` bloqueado.**
