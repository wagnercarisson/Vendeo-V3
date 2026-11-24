# F62 — Autorização de aplicação remota

Registro da instrução do responsável nesta sessão: “vc faz os procedimentos então, valida e depois me libera para que eu faça o merge, push e validação pós deploy”. Escopo: preparar/verificar backup, aplicar exclusivamente a migration F62 final no projeto vinculado e conferir o resultado. Não autoriza merge, push, deploy, geração paga nem ativação da funcionalidade.

Preflight remoto: projeto `Vendeo-V3`, `gvbzwihwgzujwsviufgy`, região `sa-east-1`, `ACTIVE_HEALTHY`, PostgreSQL 17.6. F60.7 presente; F62 e tabela de adições ausentes; ledger 158. Transporte de operação: Management API do projeto identificado, via HTTPS; os campos abaixo identificam o banco lógico gerenciado (não um contêiner Docker local).

Backup privado concluído: 2.261.949 bytes de dump, 6 buckets, 870 objetos / 159.957.441 bytes, todos com tamanho e SHA-256 conferidos, inventário remoto estável. Restauração integral do dump em base `template0`, com owners/ACLs, concluída em contêiner sem rede. Os 11 fingerprints de conteúdo conferem com o remoto. Storage foi verificado por bytes/checksum do backup, sem upload de restauração para outro serviço de Storage.

```json
{
  "kind": "migration",
  "status": "authorized",
  "environment": {
    "host": "db.gvbzwihwgzujwsviufgy.supabase.co",
    "port": 5432,
    "database": "postgres",
    "container": "managed-project:gvbzwihwgzujwsviufgy"
  },
  "branch": "feat/campaign-add-vertical",
  "head": "cf17c630e809c7c645fed3fe2c345363fc38dcd5",
  "migration": {
    "file": "supabase/migrations/20261123130252_campaign_format_addition.sql",
    "version": "20261123130252",
    "sha256": "56dc3423c9be5d7363bd663a694a7e20f9bb9faed3569eb3e1c9574a76b9272a"
  },
  "ledger": { "before": 158, "expected_after": 159 },
  "backup": {
    "file": "C:\\vendeo-backups\\vendeo-v3-20261124T194908Z\\database.dump",
    "sha256": "5cd354ce433d55eb466f6190562c649dd29adde00d5754206e25548532de6666",
    "restore_list": ["archive-list.txt", "storage-files.json", "verification.json", "f62-restore-proof.json"]
  },
  "scope": "Uma transação: somente migration F62 final e sua entrada nova no ledger, com fingerprints de conteúdo e resultados do leitor primário preservados. Sem db push, outras migrations, geração ou ativação.",
  "window": { "start": "2026-11-24T19:40:00Z", "end": "2026-11-24T22:00:00Z" },
  "approver": "Responsável pelo produto — autorização explícita na conversa; registro operacional nesta sessão",
  "approved_at": "2026-11-24T20:07:00Z",
  "expires_at": "2026-11-24T22:00:00Z",
  "rollback_plan": "Qualquer falha antes do COMMIT aborta a transação. Em erro de transporte não repetir automaticamente: consultar ledger/schema antes. Após commit, manter flag dedicada desligada; não executar reversão estrutural destrutiva, repair ou restauração sobre produção sem autorização específica. Backup privado e prova de restauração preservados."
}
```

A janela acima limita operacionalmente esta execução; não é autorização para rodadas futuras. O valor de segredo de confirmação não é registrado nem alterado por este procedimento.
