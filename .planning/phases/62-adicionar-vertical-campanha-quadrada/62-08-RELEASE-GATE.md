# F62 — Gate remoto e liberação para integração

**Data:** 2026-11-24. **Veredito:** migration remota aplicada e verificada; branch liberada para merge/push pelo responsável. Deploy e aceite funcional pós-deploy ainda pendentes. A funcionalidade NÃO foi ativada.

## Autorização e versão

- Retomada do gate de release do plano `62-08`, após fechamento local e archive. Contexto GSD carregado com `gsd-tools.cjs init execute-phase 62`; nenhuma fase funcional nova.
- Autorização do responsável: executar os procedimentos e validar antes de liberá-lo para merge, push e validação pós-deploy. Registro estruturado: `62-08-REMOTE-AUTHORIZATION.md`.
- Branch `feat/campaign-add-vertical`, código/base documental verificados em `cf17c630e809c7c645fed3fe2c345363fc38dcd5`.
- Alvo confirmado na Management API e no vínculo local: **Vendeo-V3**, `gvbzwihwgzujwsviufgy`, `sa-east-1`, `ACTIVE_HEALTHY`, PostgreSQL 17.6.
- Uma única migration: `20261123130252_campaign_format_addition.sql`.
- SHA-256 do arquivo e do SQL gravado no ledger remoto: **`56dc3423c9be5d7363bd663a694a7e20f9bb9faed3569eb3e1c9574a76b9272a`**.
- `main` remota conferida em `241815fa831ceb6db85fbc8747a9599c83fb66bc`; nenhuma branch F62 remota no preflight. Sem merge, push ou deploy pelo revisor.

## Backup e ensaio

Backup privado fora do Git: `C:\vendeo-backups\vendeo-v3-20261124T194908Z`.

| Verificação | Resultado |
|---|---|
| Dump lógico | 2.261.949 bytes; SHA-256 `5cd354ce433d55eb466f6190562c649dd29adde00d5754206e25548532de6666` |
| Restore-list / leitura do arquivo | PASS |
| Storage copiado | 6 buckets; 870 objetos; 159.957.441 bytes |
| Tamanhos / SHA-256 dos objetos | Todos conferidos; inventário antes/depois estável |
| Restauração do banco | PASS em base `template0`, owners/ACLs preservados, contêiner sem rede/portas |
| Conteúdo restaurado | 11 fingerprints iguais aos do remoto |
| Ensaio da migration | Transação exata executada sobre a cópia restaurada; PASS |
| Descarte do ambiente de ensaio | Somente contêiner temporário removido após validar ID/label/rede; backup e homolog preservados |

Limitações: backup lógico não é PITR nem cópia de configuração externa; cópia privada com ACL local, sem declaração de criptografia/upload externo nesta rodada. Os bytes de Storage foram integralmente verificados no backup, mas não restaurados em outro servidor de Storage. Duas tentativas iniciais na base bootstrap do contêiner foram recusadas por permissão/schema existente; a restauração final em base vazia terminou com exit 0.

## Aplicação remota

Aplicação pela Management API, exclusivamente o SQL do arquivo final e sua **nova** entrada no ledger, em uma transação com `lock_timeout=5s`, `statement_timeout=120s`, trava do ledger e verificações antes do COMMIT. Sem `db push`, reset, repair, reaplicação de outras migrations ou nova migration corretiva.

- Ledger **158 → 159**; versão `20261123130252` **uma vez**, nome `campaign_format_addition`.
- Campo `statements` armazena o SQL aplicado; SHA-256 coincide exatamente com o arquivo. Não houve alteração de entradas históricas.
- Conjunto de versões conferido após aplicação: **159 arquivos locais / 159 versões remotas**, igualdade exata e nenhum prefixo duplicado. Não há migration adicional pendente neste conjunto.
- Tabela de adições vazia; flag dedicada semeada `false`; flag do motor vertical permaneceu `true`.
- 6 FKs, 9 CHECKs validados, 7 índices, trigger ativo, RLS habilitada e policy SELECT para `service_role`.
- `service_role`: somente SELECT direto na tabela e EXECUTE nas RPCs; `anon`/`authenticated` sem SELECT/EXECUTE nas RPCs da adição.
- RPCs `SECURITY DEFINER`, `search_path=''`, grants conferidos.
- Resultados do leitor primário em todas as 291 campanhas iguais antes/depois, comprovados dentro da transação.

### Conteúdo preservado

Os 11 fingerprints (contagem + hash de todas as linhas) foram comparados dentro da transação e novamente após o COMMIT:

| Conjunto | Linhas antes/depois |
|---|---:|
| campaigns | 291 |
| stores | 11 |
| operações de crédito | 60 |
| transações de crédito | 408 |
| saldos | 11 |
| artefatos de composição | 23 |
| artefatos primários | 50 |
| operações two-stage | 8 |
| etapas two-stage | 16 |
| objetos de Storage | 870 |
| flags preexistentes | 10 |

Nenhuma geração, cobrança, estorno ou alteração de campanha/artefato preexistente.

### Ocorrência controlada

A primeira tentativa remota abortou pela conferência estrita de hashes. A leitura seguinte comprovou rollback integral: ledger 158, F62 ausente e tabela ausente. A referência vinha de duas funções da homologação cujos comentários antigos têm acentuação corrompida. Comparação linha a linha, excluindo somente linhas de comentário, confirmou código executável idêntico. Ajustou-se apenas a referência dos hashes para as definições UTF-8 do arquivo final ensaiado; a migration NÃO mudou. A verificação completa foi executada na cópia isolada antes da nova aplicação autorizada.

| Função | MD5 remoto da definição final |
|---|---|
| `trg_cfa_guard_fn` | `c821c994f246dce4b06897d5158930e6` |
| `campaign_format_add_open` | `4e3fd785528bd56705f17a55613f26ab` |
| `campaign_format_add_deliver` | `974223bfe312bbce8b089cadff081b8e` |
| `campaign_format_add_refund` | `f13ec8349e571a89db7fee61d88098c6` |
| `product_1_1_get_campaign_operation_by_campaign` | `01763f8b90925b1437bf5b6088df6fc7` |

## Vercel

- Projeto confirmado: `vendeo-v3`, `prj_Z001CZf0ChbczzwV7JEgAIlZVbGe`, produção `https://vendeo.tech`.
- `FORMAT_ADDITION_CONFIRMATION_SECRET` estava ausente. Cadastrado exclusivamente em **Production**, tipo **Sensitive**, com 32 bytes aleatórios criptográficos (hex), enviado por stdin. Valor não exibido, não persistido no workspace nem reutilizado da homologação.
- Presença/nome/tipo/destino conferidos pela CLI; disponibilidade no runtime será comprovada apenas após novo deploy.
- Nenhuma outra variável alterada. Nenhum deploy disparado. `campaign_format_addition_enabled=false` permanece até publicação do código compatível.

## Handoff ao responsável

1. Integrar a branch validada em `main` e fazer push; não aplicar novamente a migration, pois ela já está no ledger remoto com o hash correto.
2. Aguardar deploy READY e conferir o commit publicado.
3. Smoke de login, lista/dashboard, detalhe 1:1, 9:16 existente e downloads; conferir logs sem 500. Sem geração automática.
4. Ativar a flag dedicada pelo controle administrativo existente, após o código novo estar publicado, para validar a ação de expansão. A flag do motor não substitui essa chave. Nenhuma geração paga foi autorizada/executada pelo revisor nesta rodada.
5. Registrar o aceite pós-deploy; não converter o aceite local em comprovação remota antecipada.

As evidências locais de testes/global/build e os aceites Jarra/Vellora permanecem válidos e separados das verificações de banco remoto. P1–P3, variantes manuais não reexercitadas e fixtures locais seguem como ressalvas conhecidas. Nenhum código de produto ou arquivo de migration foi alterado neste gate.

## Verificações finais desta rodada

- Guard F60.4 + contratos de migration/RPC/filtro primário: **4 arquivos / 61 testes PASS**, exit 0.
- Script operacional PowerShell: parse sintático sem erros; preflight, restauração comparada, ensaio, aplicação e verificação executados conforme descrito. Caminho fixo de projeto, hash fixo, autorização com janela, parada por drift e sem retry automático.
- A suíte global, typecheck/lint e build de produto não foram repetidos por este adendo operacional/documental; as evidências anteriores são **867 arquivos / 10.805 testes PASS**, typecheck/lint/build 0. Não houve build concorrente com o app 3100.
- Somente documentação e script de operação versionáveis; dumps, credenciais, tokens e valores de variáveis não entram no Git.
