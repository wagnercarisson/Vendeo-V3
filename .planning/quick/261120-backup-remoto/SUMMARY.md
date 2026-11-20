# Backup remoto — concluído e verificado

Pedido autorizado: banco e todos os objetos Storage de Vendeo-V3, sem migration/restore.

Destino privado: `C:\vendeo-backups\vendeo-v3-20261120T200232Z`.

- Banco: pg_dump 18.2 custom, PostgreSQL remoto 17.6, 2.202.240 bytes. Inclui schemas/dados, auth e ledger. Archive listado e integralmente lido por pg_restore sem executar restauração.
- Roles: exportadas com `--no-role-passwords`, exit 0.
- Storage: 6 buckets (incluindo vazios), 855 objetos; todos os tamanhos e SHA-256 conferidos novamente após o download. Inventários remotos antes/depois idênticos.
- `storage-files.json` mapeia bucket/path original para arquivo local por UUID; `storage-buckets.json` preserva configurações dos buckets.
- `manifest.json`, `verification.json` e `SHA256SUMS.txt` ficam no destino privado, não no Git.
- ACL do destino restrita ao operador Windows e SYSTEM.
- Autenticação existente do Supabase + login temporário oficial; senha postgres não redefinida. Sessões libpq com default_transaction_read_only=on e SET ROLE postgres conforme CLI oficial.

## Ocorrências

Tentativas anteriores foram preservadas como incompletas. Corrigidos argumento de arquivo no PowerShell, propagação do pooler e uso de ROLE postgres (perfil read-only não acessa auth). Após os 855 downloads e inventário final concluídos, o cálculo local do total falhou por adaptação de Hashtable no PowerShell; corrigido e finalizado localmente somente após verificar novamente cada arquivo e o archive. Ajustado também o tratamento de arrays JSON no verificador. Nenhum download foi repetido na finalização local.

Verificação final: `2026-11-20T20:16:07.9269983Z`; databaseHashMatches, databaseArchiveFullyRead, storageAllHashesMatch, storageAllSizesMatch e remoteInventoryStable = true; rolesExit = 0.

## Limites

Backup lógico, não físico/PITR. Não foi executado restore/rehearsal. Banco e Storage não têm snapshot atômico compartilhado; inventário de objetos permaneceu estável. Não equivale a exportação das credenciais/configurações externas da plataforma, providers ou infraestrutura. Não aplicar este archive automaticamente em um projeto Supabase gerenciado sem plano de restauração.

Nenhuma migration aplicada, dado existente modificado, restore, upload/exclusão Storage, deploy, merge, push ou commit executado. Arquivos vazios e tentativas incompletas anteriores não foram apagados. Alterações preexistentes de __pycache__ preservadas.

Rotinas: `scripts/backup-remote-supabase.ps1` e `scripts/verify-supabase-backup.ps1`. Não há credenciais no código. Backups contêm dados sensíveis e devem permanecer privados.
