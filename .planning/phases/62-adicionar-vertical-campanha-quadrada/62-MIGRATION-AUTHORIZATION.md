# F62 — Pacote de autorização da migration

**Status:** **NÃO APLICADA EM PRODUÇÃO/REMOTO; APLICADA SOMENTE NA HOMOLOGAÇÃO LOCAL.** Este documento **prepara** a autorização remota; **não a concede** e não executa banco, Storage ou provider. A aplicação local está em `62-08-MIGRATION-APPLY.md`; após a correção de integração, o hash do arquivo evoluiu de `61c72719…` para `56dc3423…` e somente a definição da RPC foi reaplicada seletivamente.
**Migration:** `supabase/migrations/20261123130252_campaign_format_addition.sql`
**Timestamp UTC:** `2026-11-23 13:02:52`
**SHA-256 atual da migration:** `56dc3423c9be5d7363bd663a694a7e20f9bb9faed3569eb3e1c9574a76b9272a` (a aplicação local inicial usou `61c72719…`; após a correção da RPC, somente a função foi reaplicada)
**Tamanho:** 43.009 bytes
**Branch de integração:** `feat/campaign-add-vertical`
**HEAD de referência:** `5572378b` (antes deste pacote documental)

## 1. Unicidade e inventário

- Prefixo `20261123130252` verificado sem outra ocorrência em `supabase/migrations` na worktree atual.
- Antes de aplicar, reconferir unicidade no conjunto integrado (worktree + branches paralelas + destino). Colisão exige novo timestamp e nova conferência; não renumerar migration já aplicada.
- Estado no inventário: **não aplicada**; nenhum ledger local/produção foi tocado.

## 2. Alvo e identidade (a preencher no gate)

| Campo | Valor exigido |
|---|---|
| Ambiente-alvo | definido explicitamente pelo responsável; **não presumido** |
| Host/porta | loopback ou host autorizado, registrado antes da conexão |
| Banco | nome exato do banco-alvo |
| Fingerprint/identidade | conferida por host + porta + banco + ledger |
| Credencial | fornecida no gate; nunca versionada neste arquivo |
| Janela | aprovada pelo responsável |

## 3. Ledger esperado

- Capturar o ledger **antes** da aplicação em leitura somente (`schema_migrations` / versão/hash).
- Ledger esperado após aplicação = **baseline capturado + 1**, contendo exatamente a versão `20261123130252`.
- **Não presumir** contagem histórica. Se o baseline divergir do esperado, parar.
- Registrar contagem e fingerprint antes/depois; qualquer drift bloqueia.

## 4. Backup e restore-list

- Exigir backup verificável **antes** da migration, conforme `docs/operations/backup-runbook.md`.
- Backup do banco: dump lógico com schema, dados, funções, policies e metadados.
- Backup/lista de restore: objetos de Storage, buckets, paths, mime types, bytes e checksums `sha256`.
- Manifesto imutável com timestamps, contagens e checksums.
- Sem evidência de backup restaurável e restore-list, **não aplicar**.

## 5. Schema esperado

### Pré

- `public.campaign_format_additions` ausente.
- `product_9_16_two_stage_operations`, `product_1_1_campaign_credit_operations`, `campaign_composition_artifacts` e views de outcome existentes.
- Flag `campaign_format_addition_enabled` ausente ou desligada.
- Nenhuma função `campaign_format_add_*` da adição.

### Pós

- Tabela `campaign_format_additions` com PK, FKs, checks, índice ativo único por campanha/target e demais índices.
- Trigger `trg_cfa_guard`/`trg_cfa_guard_fn` ativo.
- RLS habilitada; SELECT somente `service_role`; `anon`/`authenticated` sem acesso; grants revisados.
- RPCs `campaign_format_add_open`, `campaign_format_add_deliver`,
  `campaign_format_add_refund`; `product_1_1_get_campaign_operation_by_campaign`
  recriada sem regressão. A publicação usa a RPC existente
  `product_9_16_begin_publication` (não é criada por esta migration).
- Grants esperados revisados.
- Flag dedicada semeada **desligada** (fail-closed).
- Nenhuma alteração em `campaigns.storage_path`, operação original, copy ou snapshot.

## 6. Guards de host/porta/banco

- Recusar host remoto/produção não autorizado.
- Recusar porta/banco diferentes do alvo registrado.
- Recusar execução se `TEST_DATABASE_URL`/alvo estiver ausente ou ambíguo.
- Recusar se o ledger/fingerprint não corresponder ao baseline.
- Recusar se backup/restore-list não estiver comprovado.
- Toda checagem é read-only até o comando autorizado de migration.

## 7. Comandos permitidos (somente após autorização explícita)

1. Preflight read-only: identidade, ledger, schema, flags, contagens.
2. `migrate up` **exclusivamente** da migration `20261123130252` (sem outras pendentes).
3. Verificação pós: schema/RLS/grants/trigger/RPCs/flag.
4. Suítes PostgreSQL/Storage autorizadas e cenários abaixo.
5. Registro de evidência e limpeza de fixtures.

**Nada acima foi executado neste pacote.**

## 8. Cenários obrigatórios no gate real

- Concorrência de abertura/replay: um crédito, uma operação ativa.
- Reserva + outcome `unknown`: sem estorno/regeneração; acompanhamento.
- Falha definitiva: estorno uma vez; operação original/copy/quadrado intactos.
- Arte órfã íntegra: entrega sem nova chamada paga.
- Download `1:1`/`9:16`: formato estrito, sem fallback.
- Legado 1024 e 1080 incompatível.
- Adição fora da pendência 1:1 (fila e resolução direta).
- Lista/dashboard: 1 card/linha, miniatura quadrada, sem ação/modal.
- Flag dedicada desligada: bloqueia novas aberturas, não apaga estado existente.
- Busca por `request_id` antes da operação ativa (R1 × R2).

## 9. Fixtures, cleanup e evidência

- Usar somente fixtures autorizadas e identificáveis; cleanup por IDs/timestamps.
- Não usar dados reais de lojistas.
- Guardar dumps, manifests e evidências fora do Git.
- Registrar IDs de execução, contagens, checksums, exit codes e resultado.
- Remover fixtures e segredos temporários ao final; confirmar `git status` limpo.

## 10. Critérios de parada

Parar imediatamente se:

- host/porta/banco/ledger não conferirem;
- backup/restore-list não estiver comprovado;
- schema pré divergir;
- qualquer migration adicional aparecer na fila;
- RLS/grant/trigger/RPC pós divergirem;
- cenário financeiro duplicar crédito ou estornar `unknown`;
- operação original, copy, quadrado ou snapshot mudarem;
- houver erro de permissão/leitura não classificado.

## 11. Rollback operacional

- Rollback de código: reverter o deploy para o commit anterior; não usar a flag compartilhada como rollback da adição.
- Rollback de banco: seguir o bloco REVERT da migration somente com autorização específica e backup verificado; preservar evidência e ledger.
- Se a migration já estiver aplicada, não renumerar/reescrever silenciosamente; registrar incidente e seguir o procedimento aprovado.
- Objetos de Storage/artefatos não são apagados por rollback automático.

## 12. Autorização

Este pacote está **pronto para revisão**, mas **não autoriza** execução. A aplicação exige aprovação explícita do responsável, janela, alvo e backup verificados. Até lá, a migration permanece **não aplicada**.
