# F60 / Plano 60-01 — Baseline do homolog, autorizações e execução

**Status:** A/B/C/D concedidas e executadas em 2026-11-09 (run `f60-20261109-02`). Prova 13/13 PASS; decisão **APPROVED**. Conferência final read-only em `evidence/f60-20261109-final/`.
**Fase:** 60 — Controle da operação 9:16 em duas etapas e integração financeira.
**Plano:** 60-01 — prova transacional bloqueante.

## Identidade do destino (reconfirmada no checkpoint)

| Campo | Valor esperado |
|---|---|
| Container | `supabase_db_vendeo-homolog` |
| Workdir | `G:\Vendeo-Homolog` |
| Host | `127.0.0.1` |
| Porta do banco | `57782` |
| Banco | `postgres` |
| Ledger esperado | **153** migrations excluindo F60 (`count_excluding_f60`) |
| SHA-256 do ledger (excluindo F60) | `3861f7a0a65717a07a2184554ecd11118e7662fb8c59f7573c2a6d5a78e59f6d` |
| Última migration esperada (antes de F60) | `20261105162052` |
| F60 aplicada no início da prova | **sim** (`20261109174110`); o precheck compara contagem/SHA **excluindo F60** |
| Ambiente | **não descartável**; nenhum container/ambiente é criado, reiniciado ou destruído |
| Backup pré-F60 | `G:\Vendeo-Homolog\recovery\homolog-pre-f60-20261109T152121Z.dump` — 1.611.412 B; SHA-256 `6C0E15AE1EE52C55E2D355D3364DC1D242FD9D62341A3180B5FFD430723738AC` |

> Os valores acima foram observados em leitura durante o planejamento e **devem ser reconfirmados** no Passo 0 do checkpoint. Divergência de identidade ⇒ PARAR.

## Autorizações (separadas; nenhuma presumida)

| ID | Autorização | Estado inicial | Observação |
|---|---|---|---|
| A | Aplicar a migration `20261109174110_f60_9_16_two_stage_control.sql` | `CONCEDIDA` (2026-11-09) | Somente após revisão registrada do SQL |
| B | Escrever dados de teste (UUIDs + rótulos `p916test-`) | `CONCEDIDA` (2026-11-09) | Somente IDs registrados no manifesto |
| C | Executar a prova S01..S13 | `CONCEDIDA` (2026-11-09) | Exige A e B concluídas |
| D | Limpar dados de teste (somente com `F60_CLEANUP_AUTHORIZED=1`) | `CONCEDIDA` (2026-11-09) | Política conservadora: retém origem canônica, pendentes, ledger, desfechos e auditoria |

Cada autorização é pedida separadamente no checkpoint. Este plano **não** assume nenhuma como pré-aprovada. O cleanup **não** roda automaticamente em `finally`; sem a autorização D, nada é apagado e a pendência é registrada.

## Execução e evidência

- Cada execução recebe um `run id` único e um diretório `evidence/<run-id>/`.
- Manifesto e evidência são validados contra o mesmo `run id`; manifesto ausente, inválido ou de outra execução ⇒ o cleanup aborta sem apagar.
- A comparação S0 confronta **esperado × observado**: adições fora do manifesto reprovam a prova; o ledger é validado por contagem/SHA excluindo F60.
- No `prove`, o preflight exige **`f60_applied === true`** antes do harness; o modo de conferência anterior à aplicação (`status`) exige **F60 ausente**.
- Há verificação pós-cleanup, com novo snapshot e nova comparação.

## Revisão pré-aplicação (obrigatória)

| Campo | Valor |
|---|---|
| Revisor | Revisão pré-aplicação do responsável (sessão de 2026-11-09) |
| Data | 2026-11-09 |
| SQL revisado | **SIM** |
| Scripts revisados | **SIM** |
| Veredito | **APROVADO** — sem bloqueadores; 12/12 testes offline e 14/14 guardas estáticas |

Escopo aprovado: código preparado do 60-01. **Não** aprova a prova, não autoriza escritas e não libera 60-02..60-04.
Referência: `60-01-PRE-APPLICATION-REVIEW.md` e `60-01-AUTHORIZATION-REQUEST.md`.

Itens mínimos: assinaturas preservadas, fence de publicação, frescor de epoch, grants RPC-only, helper de abandono sem execução direta, origem canônica, abertura atômica e recusa de adoção de operação antiga. Sem veredito `APROVADO`, nada é aplicado.

## Janela de exclusividade das RPCs compartilhadas

IDs exclusivos isolam **dados**, não as rotinas compartilhadas:

- `product_1_1_close_failed_operation`
- `admin_resolve_product_1_1_pending`
- `product_1_1_get_campaign_operation_by_campaign`

| Campo | Valor |
|---|---|
| Início | **2026-11-09T15:21:21-03:00** (após A, antes da migration) |
| Fim | **2026-11-09T15:31:00-03:00** (cleanup D concluído) |
| Responsável | responsável pela autorização (sessão de 2026-11-09) |
| Ausência de uso concorrente confirmada | **SIM** — nenhuma outra execução identificada nesta janela |
| Duração máxima | 2 horas |

## Regras da prova

- IDs de teste são **UUIDs válidos** criados pela prova e registrados em manifesto. O prefixo textual `p916test-` é aplicado apenas a campos textuais adequados (nome de loja/campanha, referência de suporte), nunca a colunas UUID.
- Snapshot S0 somente leitura antes/depois, com duas comparações separadas:
  1. **integridade preexistente** — contagem/hash por ID preexistente deve permanecer idêntica;
  2. **delta esperado** — novas linhas devem corresponder ao manifesto.
- `credit_transactions` é append-only: nunca apagada nem atualizada.
- Desfechos imutáveis, auditoria e linhas referenciadas podem permanecer; o cleanup classifica cada item como `deleted` ou `retained`, com motivo. Não se exige apagamento impossível nem igualdade global de fingerprint.
- Sem `session_replication_role=replica`; sem semear ou remover dados preexistentes.
- Nenhuma chamada a provider de IA; nenhuma geração real; nenhum custo externo.
- Encerramento/estorno administrativo prevalece sobre registro operacional atrasado.
- O resultado da prova **não é aceitação produtiva**.

## Arquivos da prova

| Arquivo | Papel |
|---|---|
| `supabase/migrations/20261109174110_f60_9_16_two_stage_control.sql` | Schema mínimo, RPCs e adaptações compartilhadas — **aplicado em 2026-11-09** (SHA-256 `4C50E9741FA1A6F236254CD64CBF54E8EFD7F1B05B6B712BAD5641A9FB3D6A3E`) |
| `scripts/f60/homolog-snapshot.mjs` | Snapshot/comparação S0 somente leitura |
| `scripts/f60/two-stage-proof-harness.mjs` | Harness determinístico S01..S13, sem IA |
| `scripts/f60/run-f60-proofs.ps1` | Orquestrador `status`/`prove` com guards |
| `scripts/f60/proof-cleanup.mjs` | Cleanup registry-driven `deleted`/`retained` |
| `60-01-PROOF-MATRIX.md` | Matriz dos 13 cenários |
| `evidence/` | Saídas JSON/MD da prova |

## STOP

Comandos de banco foram executados somente na janela autorizada de 2026-11-09, na run `f60-20261109-02`: migration, fixtures, prova S01–S13, cleanup e conferência final read-only. A exclusão de 13 usuários de teste órfãos da run 01 está registrada como delta autorizado em `evidence/f60-20261109-01/cleanup-manifest.json` e confirmada em `evidence/f60-20261109-final/f60-final-conference.json`.
