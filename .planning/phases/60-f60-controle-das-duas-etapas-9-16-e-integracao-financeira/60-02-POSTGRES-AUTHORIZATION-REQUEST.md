# F60 / Plano 60-02 — Pedido de autorização para a suíte Postgres

**Status:** aguardando autorização. **Nenhuma execução Postgres foi feita.**
**Escopo:** executar **somente** `src/lib/product-9-16-two-stage/__tests__/two-stage-control.postgres.test.ts` pelo perfil `f60`. Não repetir o harness 60-01, não aplicar migration, não executar 60-03.

## Estado aprovado

- Implementação e revisão **offline** do 60-02: **aprovadas**.
- Testes offline: **25/25** módulo + **8/8** janela.
- Validação Postgres: **pendente — não executada nem aprovada**.
- `60-03`: **bloqueado**.

## Alvo

| Campo | Valor |
|---|---|
| Alvo proposto | homolog `supabase_db_vendeo-homolog` — `127.0.0.1:57782/postgres` |
| Alternativa | PostgreSQL local/isolado que já contenha a migration F60 aplicada |
| Identidade | host/porta/banco conferidos pelo runner; `localhost`/`::1` são reconhecidos como o mesmo homolog |
| Migration | **nenhuma** será aplicada nesta execução |
| Escrita | somente dentro de transações com `ROLLBACK`; sem fixtures persistentes |

O alvo homolog é o único com o schema F60 aplicado e conhecido. A execução não altera schema nem dados permanentes.

## Janela vigente

A janela do 60-01 **terminou** e não pode ser reutilizada.

Formato obrigatório:

```text
<início ISO> / <fim ISO> / <responsável>
```

**Proposta (sujeita a confirmação):**

```text
2026-11-10T09:00:00-03:00 / 2026-11-10T10:00:00-03:00 / responsavel-sessao
```

O gate `f60GateStatus` exige `active`; recusa `invalid`, `closed` e `future`. Se a janela não estiver ativa no momento da execução, o runner não executa a suíte.

## Autorização

| ID | Autorização | Concedida? | Responsável/data |
|---|---|---|---|
| P1 | Executar a suíte Postgres do 60-02 no alvo acima, dentro da janela | **CONCEDIDA E EXECUTADA — 7/8 FAIL** | Responsável (2026-11-09) |
| P1-R2 | Reexecutar somente a suíte Postgres após corrigir a asserção para `search_path=""` | **EXECUTADA — 8/8 PASS; ACEITE APROVADO** | Responsável (2026-11-09) |

**P1-R2:** alvo `127.0.0.1:57782/postgres`; janela `2026-11-09T16:35:00-03:00 / 2026-11-09T17:35:00-03:00 / responsavel-sessao`; somente suíte Postgres do 60-02; sem migration/60-01/60-03. Resultado: **8/8 PASS, exit 0**; aceite em `60-02-POSTGRES-RESULT.md`.

## Regras de execução (ao conceder P1)

- Executar **somente** `two-stage-control.postgres.test.ts` pelo perfil `f60`.
- Confirmar alvo e janela efetiva antes do comando; a janela precisa estar `active`.
- Parar ao concluir ou diante de qualquer falha.
- Não ajustar expectativas, testes ou código para obter aprovação.
- Não repetir o harness 60-01, não aplicar migration e não iniciar 60-03.
- Reportar: resultado individual dos **8 testes**, exit code e evidência de `ROLLBACK`/ausência de fixtures persistentes.
- `60-03` permanece bloqueado até o aceite formal desses resultados.

## Pré-condições

- [x] Revisão offline do 60-02 aprovada.
- [x] Janela do 60-01 encerrada e reconhecida como não reutilizável.
- [ ] Janela proposta/confirmada para esta execução.
- [ ] Alvo confirmado (`127.0.0.1:57782/postgres` ou local isolado com F60).
- [ ] Nenhuma outra execução concorrente usando as RPCs compartilhadas durante a janela.
- [ ] Ciente de que o resultado é validação local/homolog, **não** aceitação produtiva.

## Comando

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:<senha>@127.0.0.1:57782/postgres"
$env:F60_HOMOLOG_AUTHORIZED = "1"
$env:F60_EXCLUSIVITY_WINDOW = "2026-11-10T09:00:00-03:00 / 2026-11-10T10:00:00-03:00 / responsavel-sessao"
$env:F60_TEST_ALLOW_WRITES = "1"
node scripts/testing/run-integration.mjs f60
```

Para alvo local/isolado, omitir `F60_HOMOLOG_AUTHORIZED`/`F60_EXCLUSIVITY_WINDOW` e usar o `TEST_DATABASE_URL` local que já tenha a migration F60.

## Testes esperados (8)

1. RLS/grants: `service_role` lê, não escreve; helper de abandono é interno.
2. Funções são `SECURITY DEFINER` com `search_path` vazio.
3. Abertura idempotente; base concluída mantém crédito `reserved`.
4. CAS rejeita token divergente e transição após conclusão.
5. Índice parcial impede segunda tentativa ativa.
6. `request_id` é idempotente e conflita se o alvo divergir.
7. Desfecho é idempotente e divergência é conflito.
8. Escrita direta como `service_role` é recusada com `42501`.

## Evidências esperadas

- saída do Vitest com **8/8 testes PASS** e exit code 0;
- confirmação de que o perfil `f60` usou a janela ativa;
- contagem read-only de `p916test-%@f60.test` e lojas de teste **igual antes/depois** (transações revertidas);
- diff zero em `supabase/migrations/` e em `src/lib/product-1-1/`;
- confirmação de que 60-01 não foi reexecutado e 60-03 não foi iniciado.

### Verificação de fixtures persistentes

Executar antes e depois, somente leitura:

```sql
select count(*) from auth.users where email like 'p916test-%@f60.test';
select count(*) from public.stores where name like 'p916test-%';
```

Resultado esperado: **mesma contagem antes/depois** (idealmente zero). Cada teste usa `inTransaction` com `ROLLBACK`; nenhuma fixture deve permanecer.

## Condições de parada

- janela inválida/encerrada/futura ou alvo divergente;
- qualquer teste falhar;
- qualquer fixture persistente remanescente;
- qualquer tentativa de aplicar migration ou alterar código;
- qualquer escrita fora de transação.

Em qualquer parada: registrar falha, não corrigir durante a execução e retornar para revisão.
