# F60 / 60-04 — Separação de estágios

**Status:** **TECNICAMENTE ACEITO — encerramento formal pendente de `/gsd-verify-work` e `/opsx-verify`.**

## 1. Local

Validado localmente nesta execução:

- testes offline focados 60-03: **42/42 PASS**;
- `f60-window`: **10/10 PASS**;
- inventário `test-status`: válido;
- typecheck: **exit 0**;
- lint: **exit 0**;
- build: **exit 0**;
- `git diff --check`: **exit 0**;
- OpenSpec strict: **válido**;
- migrations: 155 arquivos, 155 prefixos únicos na worktree; branches locais sem prefixos duplicados.

**Limite:** validação local **não prova produção**. A suíte global tem **quatro falhas conhecidas** (`landing-page`: 1; `legacy-frontier`: 3), em acompanhamento separado; não é declarada verde.

## 2. Homolog (evidência REUTILIZADA)

Nenhuma conexão foi aberta nesta fase. Evidência aceita:

| Prova | Resultado | Observação |
|---|---|---|
| 60-01 — prova transacional | **13/13 PASS / APPROVED** | S01–S13; integridade/delta/ledger conferidos no aceite |
| 60-02 — Postgres | **8/8 PASS** | contrato do controle de duas etapas |
| 60-03 — RUN 2 | **26/26 PASS, exit 0** | quatro suítes `f60`; contagens e fixtures inalteradas antes/depois; sem nova persistência |

A presença de `TEST_DATABASE_URL` **não autoriza** nova conexão. Qualquer reexecução exige autorização específica e janela vigente.

**Limite:** homolog **não é aceitação produtiva**, mesmo com `APPROVED`.

## 3. Produção

Fora desta fatia. Pendências antes de ativação, sem data prometida:

| Item | Estado |
|---|---|
| Implementação completa de geração/expansão real | **PENDENTE** |
| Armazenamento/entrega real de artefatos | **PENDENTE** |
| UI do novo fluxo | **PENDENTE** |
| Flag/ativação | **PENDENTE** |
| Migration em produção | **PENDENTE** |
| Deploy | **PENDENTE** |
| Smoke em produção | **PENDENTE** |
| Rollback operacional | **PENDENTE** |

## O que esta fase NÃO entrega

UI, flag, rota pública, cron/fila/worker, geração real, expansão real, exportação, deploy, push, merge ou ativação.

## Confirmações finais

- Nenhum deploy, push ou merge.
- Nenhuma flag ou ativação.
- Nenhuma escrita em produção.
- Nenhuma chamada paga/provider.
- Nenhuma migration aplicada, renomeada ou reparada.
- Nenhuma conexão Postgres nesta fase; evidência homolog reutilizada.
- Nenhum código alterado para fazer gate passar.
