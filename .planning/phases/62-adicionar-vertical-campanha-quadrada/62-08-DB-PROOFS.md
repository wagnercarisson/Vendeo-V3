# 62-08 — Provas PostgreSQL reais da F62 (homologação local)

**Status:** **PROVAS POSTGRESQL REAIS EXECUTADAS; 12/12 CENÁRIOS PASS; CLEANUP BLOQUEADO POR GUARDS INTENCIONAIS; `62-08` NÃO CONCLUÍDO NO MOMENTO DESTA EVIDÊNCIA; REVIEW STOP.**
> **Atualização 2026-11-24:** o `62-08` foi consolidado e aceito localmente em `62-ACCEPTANCE.md`/`62-08-SUMMARY.md`; ressalvas de cleanup/artefatos sintéticos preservadas.
**Data:** 2026-11-23 (UTC).
**Produção, provider pago, geração, Storage, flags, migrations, merge, push, deploy, sync e archive:** não acionados.
**Validação visual:** não executada.

## Aceite da rodada PostgreSQL (2026-11-23)

A rodada PostgreSQL é **aceita com ressalvas**:

- **12/12 cenários PASS**, incluindo a concorrência real com duas sessões.
- **Ressalva 1 — cleanup bloqueado:** `campaign_composition_artifacts` é
  imutável e `credit_transactions` é append-only. O resíduo sintético da
  concorrência permanece identificado e **não** foi removido; guards não foram
  desativados.
- **Ressalva 2 — S11 é prova de predicado:** o cenário comprovou o predicado SQL
  usado pelo repositório para excluir a adição da fila/resolução. Não foi um teste
  completo da jornada administrativa; a RPC administrativa não tem guard de banco.
- **Ressalva 3 — artefatos sintéticos:** S05/S09 usaram metadados sintéticos; não
  provam bytes, integridade, Storage ou provider.
- **Achados preservados:** `credit_reservation_missing_tx` no saldo insuficiente;
  refund sem `campaign_id`; ausência de guard de banco na RPC administrativa.
- **Resíduo não reutilizado:** a rodada Storage/download cria fixtures novas e
  não referencia `6208…003`.

> Esta rodada é **separada** dos gates offline anteriores (`62-OFFLINE-GATES.md`).
> Ela exercita SQL/RPCs reais no banco de homologação, mas **não** prova bytes,
> integridade de imagem, download, Storage, provider ou jornada visual completa.

## Alvo e identidade

| Campo | Valor |
|---|---|
| Container | `supabase_db_vendeo-homolog` (running) |
| Host/porta | `127.0.0.1:57782` → container `5432` |
| Banco | `postgres` (PostgreSQL 17.6) |
| Branch / HEAD de partida | `feat/campaign-add-vertical` / `0595d458ed56783176203487937d45b65f7ec1ca` |
| Migration aplicada | `20261123130252`, 1×, SHA-256 `61c727198f8ad7519e6cb3b9c79dba6fd1d9bbb9f948b9600d37bc43c7f5b878` |
| Flag | `campaign_format_addition_enabled=false`, intocada |

### Baseline reconfirmado antes das provas

`ledger=158`, `campaigns=140`, `credit_operations=100`, `artifacts=44`,
`stores=39`, `additions=0`, `flags=11`, flag `false`.

Fingerprints de conteúdo (não apenas contagens):

| Tabela | Fingerprint |
|---|---|
| `campaigns` | `074905a92bb4de8a802235f1dfb116ca` |
| `product_1_1_campaign_credit_operations` | `1f5e459b1f524b78fb3f5f2b5bf95bdd` |
| `campaign_composition_artifacts` | `c1885dca825346a85d4afc32c5913c68` |
| `stores` | `5be3054b1355228eab46f96524d13979` |
| `credit_balances` | `451ba3878e45428f1c582f0a362e4e4e` |
| `credit_transactions` | `b93f4efc3ffd032ef150f6797ea415ff` |

## Método e artefatos

- **Suíte transacional (S01, S02, S04–S12):** um único `BEGIN` com fixtures
  exclusivas por UUID e `ROLLBACK` integral ao final. Qualquer asserção falha
  aborta e reverte tudo.
- **Concorrência (S03):** duas sessões `psql` reais, com commits, fixtures
  exclusivas e cleanup explícito por IDs.
- Todos os `psql` rodaram dentro do container alvo com `ON_ERROR_STOP=1` e
  `lock_timeout`/`statement_timeout` explícitos.
- Nenhuma função financeira foi simulada; as RPCs reais foram chamadas.
- Artefatos sintéticos (prepared/vertical) foram criados **apenas** para
  satisfazer os contratos SQL de `deliver`; não representam bytes reais.
- Nenhuma credencial, dump ou dado pessoal foi versionado. O UUID de usuário
  usado como dono das lojas-fixture foi redigido neste documento.

| Artefato temporário (fora do Git) | SHA-256 |
|---|---|
| `f62-db-proofs-rollback-20261123.sql` | `322452e188b541aeff99c3e1212b57704a20ff3b80af41bd1ea260c3a2163400` |
| `f62-db-proofs-rollback-20261123.log` | `097c7f347521d3e6ac20985d33d674152910dc5e636b734d3d7772065aac878f` |
| `f62-concurrency-setup-20261123.sql` | `a1eb11c6febd142f99627ee50839ce108769058a1c148de2498cb5abed300983` |
| `f62-concurrency-session-a-20261123.sql` | `24f2de18759b28719ab59a42bca616693a6226f04a7102bd2ee6630d6421b261` |
| `f62-concurrency-session-b-20261123.sql` | `2e62cccb9d0f9d3baf3d365971ba442db81744629a711e2b84bc3e30a2f51e7c` |
| `f62-concurrency-verify-20261123.sql` | `c36d507c368988ba490063858e1fdbaf8225794e9a6253af482a89831a187fea` |
| `f62-concurrency-verify-residue-20261123.log` | `73050bedff769d9091aa9ae3e2faf3d7d1753ff5bf2ea3913d51bbfebc695a7c` |
| `f62-concurrency-cleanup-20261123.sql` | `d2f6722e7ede56a4f82aec9dca328226d04ba38dfdb6ba6d035fd35de8ab85d7` |

## Resultados das provas

| ID | Cenário | Esperado | Obtido | Veredito |
|---|---|---|---|---|
| S01 | Abertura válida | 1 crédito, 1 adição `open`, base `done`, expansion `pending` | Exatamente isso; `bonus 5→4`; 1 dedução de `-1` | **PASS** |
| S02 | Saldo insuficiente | Recusa atômica | Exceção real `credit_reservation_missing_tx`; 0 adição, 0 operação, 0 steps, 0 tx, saldo 0 | **PASS** |
| S03 | Duas sessões reais | 1 adição ativa, 1 reserva, 1 débito | 1 adição; 1 reserva; 1 dedução; `bonus=4`; loser sem resíduo | **PASS** |
| S04a | Replay do mesmo `request_id` | Sem nova cobrança | `idempotent=true`, `state=open`, 1 dedução, saldo inalterado | **PASS** |
| S04b | Outro request com adição ativa | Convergir para a ativa | `idempotent=true`, `operationId` da vencedora, 0 operação do perdedor | **PASS** |
| S05 | Saldo zero após reserva | Continuar sem outro crédito | `deliver` concluiu com `bonus=0`, 1 única dedução | **PASS** |
| S06 | `unknown` | Impedir estorno | `success=false`, `reason=operation_unknown`; crédito `reserved`, 0 refund | **PASS** |
| S07 | Falha definitiva | Estorno único | `refunded`; 1 refund `+1`; saldo restaurado; repetição `idempotent=true` | **PASS** |
| S08 | Replay de R1 estornado com R2 | Retornar R1 sem nova cobrança | R1 `refunded`; R2 `open`; replay R1 não alterou saldo (2 deduções, 1 refund) | **PASS** |
| S09 | Original 1:1/copy/snapshot/path | Intactos | `row_to_json` antes = depois para campanha, operação primária e artefato-fonte | **PASS** |
| S10 | Leitura primária | Retornar a original | Antes e depois retornou a operação primária; adição não vazou | **PASS** |
| S11 | Fila/resolução legada | Excluir a adição | Adição classificada e filtrada; linha legada preservada | **PASS** |
| S12 | Permissões/RLS | Papéis reais | `service_role` lê/executa; INSERT direto negado; `authenticated`/`anon` negados | **PASS** |

### Evidência da concorrência (S03)

Duas conexões reais, com sobreposição temporal e PIDs distintos:

| Sessão | PID | Início | Fim | Resultado |
|---|---|---|---|---|
| A | **18744** | `2026-11-23 19:38:31.18109+00` | `19:38:31.656931+00` | `success=true`, `idempotent=false`, `operationId=6208d0a3…0a3` |
| B | **18751** | `2026-11-23 19:38:31.224803+00` | `19:38:31.676847+00` | `success=true`, `idempotent=true`, `operationId=6208d0a3…0a3` (convergiu para a vencedora) |

Verificação pós-commit:

```text
addition_count=1
addition_row=6208d0a3-...-0000000000a3|status=open|request=6208e0a3-...-0000000000a3
reserved_ops=6208d0a3-...-0000000000a3
bonus_balance=4
deduction_count=1
deduction_balance_after=4
loser_op_residue=0
```

Exit code das duas sessões e da verificação: **0**.

## Preservação antes/depois

### Suíte transacional

Após o `ROLLBACK`, as contagens e os **seis fingerprints de conteúdo**
retornaram exatamente aos valores do baseline. Portanto, S01/S02/S04–S12 não
deixaram qualquer alteração.

### Concorrência (commits)

Os fingerprints globais mudaram apenas pelas fixtures desta execução. Ao
**excluir os IDs/fixtures do teste**, os seis fingerprints voltaram exatamente ao
baseline:

| Fingerprint com exclusão das fixtures | Valor | Igual ao baseline |
|---|---|---|
| `campaigns` | `074905a92bb4de8a802235f1dfb116ca` | sim |
| `credit_operations` | `1f5e459b1f524b78fb3f5f2b5bf95bdd` | sim |
| `artifacts` | `c1885dca825346a85d4afc32c5913c68` | sim |
| `stores` | `5be3054b1355228eab46f96524d13979` | sim |
| `credit_balances` | `451ba3878e45428f1c582f0a362e4e4e` | sim |
| `credit_transactions` | `b93f4efc3ffd032ef150f6797ea415ff` | sim |

Isso prova que **nenhuma linha preexistente** foi alterada; o único delta são
as fixtures identificadas abaixo.

## Cleanup — BLOQUEADO POR GUARDS INTENCIONAIS

A limpeza integral das fixtures commitadas da concorrência **não é possível por
DML normal** neste banco, por dois guards intencionais:

1. `public.campaign_composition_artifacts`:
   `BEFORE UPDATE OR DELETE` → `campaign_composition_artifacts_immutable`.
2. `public.credit_transactions`:
   `BEFORE UPDATE OR DELETE` → `credit_transactions é append-only`.

Tentativas (ambas abortadas e **integralmente revertidas**, sem remoção parcial):

| Tentativa | Comando | Resultado |
|---|---|---|
| 1 | DELETE das fixtures, incluindo o artefato | `ERROR: campaign_composition_artifacts_immutable`; transação revertida |
| 2 | DELETE sem o artefato, incluindo o ledger | `ERROR: credit_transactions é append-only`; transação revertida |

**Nenhum guard foi desativado; nenhum objeto compartilhado foi alterado;
nenhum `session_replication_role`, `ALTER TABLE ... DISABLE TRIGGER`,
`TRUNCATE` ou restauração foi executado.**

### Resíduo exato (fixtures sintéticas identificadas)

| Objeto | ID / referência | Estado |
|---|---|---|
| Loja | `6208f003-0000-4000-8000-000000000003` (`F62 Concurrency Store`) | presente |
| Saldo | store acima | `bonus=4`, `balance=4` |
| Campanha | `6208c003-0000-4000-8000-000000000003` | `ready`, `storage_path` sintético |
| Operação primária | `6208a003-0000-4000-8000-000000000003` | `delivered`, `credit_tx_id` sintético |
| Adição | `6208d0a3-0000-4000-8000-0000000000a3` | `open` |
| Operação da adição | `6208d0a3-0000-4000-8000-0000000000a3` | `reserved`, 1 crédito |
| Ledger | dedução `11ed46de-cc16-4939-8837-981314d59c77` | `-1`, `balance_after=4` |
| Two-stage | 1 operação + 2 steps (`base=done`, `expansion=pending`) | presentes |
| Artefato-fonte | `6208b003-0000-4000-8000-000000000003` | `square_original`, `delivered_campaign_reuse`, 1024×1024 |

Contagens globais no Review Stop: `ledger=158`, `campaigns=141`,
`credit_operations=102`, `artifacts=45`, `stores=40`, `additions=1`.
O delta é **exatamente** o resíduo acima; as linhas preexistentes permanecem
idênticas ao baseline (fingerprints com exclusão iguais).

## Achados e limitações

1. **Saldo insuficiente:** o caminho real levanta
   `credit_reservation_missing_tx` (helper interno), não
   `credit_reservation_failed`. A recusa é atômica, mas o nome do erro é menos
   específico. Não corrigido nesta rodada.
2. **Ledger de estorno sem `campaign_id`:** `refund_credit_at` insere o refund
   sem `campaign_id` (NULL). A reconciliação deve usar `reference` (id da
   dedução) ou `idempotency_key`, não `campaign_id`. As asserções foram
   ajustadas para isso.
3. **Resolução administrativa legada:** `admin_resolve_product_1_1_pending` não
   tem guard de adição no banco. A exclusão é feita no repositório
   (`findPendingOperation` retorna `null` antes da RPC). A prova validou o
   predicado SQL usado pelo repositório; um chamador direto da RPC não está
   coberto por guard de banco.
4. **Artefatos sintéticos:** S05/S09 usaram metadados sintéticos para satisfazer
   os contratos de `deliver`; não há prova de bytes, assinatura, integridade,
   download ou Storage.
5. **Cleanup:** bloqueado pelos guards acima. O resíduo é conhecido e
   identificado; não foi contornado.
6. **Não executado:** provider pago, geração, Storage, validação visual,
   release, backup/restore completo, merge/push/deploy/sync/archive.

## Próximas opções (exigem autorização separada)

1. **Aceitar o resíduo identificado** em homologação e seguir com a matriz de
   Storage/provider/visual, registrando-o como fixture sintética permanente.
2. **Cleanup administrativo isolado:** somente em ambiente descartável/clone, com
   autorização específica para desativar temporariamente os guards; **não** no
   homolog compartilhado e **não** sob a autorização atual.
3. **Restaurar homolog** de um backup/snapshot anterior às provas, após o gate de
   backup/restore ser satisfeito; operação separada e mais ampla.
4. **Repetir a concorrência em banco/container descartável**, onde o banco
   inteiro pode ser descartado, evitando o problema de imutabilidade.

## Review Stop

**Parar aqui.** As 12 provas PostgreSQL reais passaram; o cleanup não pôde ser
concluído sem violar guards intencionais. O `62-08` **não está concluído** e não
há autorização para Storage, provider, validação visual, release, merge, push ou
deploy. Aguardar decisão sobre o resíduo e a próxima matriz.
