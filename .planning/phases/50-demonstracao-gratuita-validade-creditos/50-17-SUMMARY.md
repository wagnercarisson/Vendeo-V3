---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 17
subsystem: operations
tags: [backup, continuity, runbook, supabase]
completed: 2026-09-23
---

# Phase 50 Plan 17 Summary

## Accomplishments

- Criado `docs/operations/backup-runbook.md`.
- Documentado dump lógico, objetos de todos os buckets, criptografia, destino externo privado, retenção rotativa de 30 dias e checksums.
- Documentado teste real de restauração de banco, metadados e objetos, incluindo leitura assinada de arquivo restaurado.
- Segredos e artefatos permanecem fora do Git; decisões de destino, custódia da chave e ambiente de restore ficaram explicitamente pendentes para o corte.
- Task 17.4 sincronizada entre o plano GSD e o OpenSpec; `.gitignore` agora protege `.backup-work/`, `backups/`, `storage-backup/` e nomes de dump/manifesto sem ignorar migrations SQL.
- `git check-ignore -v --no-index` validou todos os exemplos de artefatos de backup e confirmou que migrations SQL continuam versionáveis.
- Executado o teste real de restauração da F50 a partir de `C:\Vendeo-Backups\f50-post-migration-20260923-clean`: **RESTORE VALIDADO**.
- O restore ocorreu no ambiente isolado `f50_restore_20260923`, com API/banco/Studio/Inbucket/analytics nas portas `55431`/`55432`/`55433`/`55434`/`55437`; o ambiente Vendeo original permaneceu preservado.
- Hashes do backup: zero divergências; banco, roles, schema, dados e estruturas F50 restaurados; ledger sem inconsistências.
- Storage: 5 buckets privados e `419/419` objetos restaurados, baixados e validados por SHA-256; URL assinada e download com checksum confirmado.
- Compatibilidade local registrada: `restore_objects_bucket_name_compat`, criado somente no banco isolado para o runtime local; não pertence ao backup e não deve virar migration de produção.
- Nenhuma escrita remota foi executada.
- Task 17.3 concluída: gates técnicos do beta fechado confirmados sem ativação, convite ou corte. A produção tinha 2 emails aprovados, 2 solicitações pendentes e 4 solicitações totais; signup público permaneceu desativado.
- A migration `20260924000003_f50_access_request_limit.sql` está presente e sincronizada local/remoto; a RPC preserva `SECURITY DEFINER`, `search_path=''`, advisory lock, contagem distinta case-insensitive e erro estável `access_limit_reached`.
- Suporte, buckets privados, telemetria e backup restaurável possuem evidências PASS registradas em `50-VERIFICATION.md`.

## Scope Boundary

O teste real de restauração e a task 17.3 foram validados e registrados acima.
Os seis registros FOLLOW-UP PÓS-PJ foram transferidos para escopo futuro e
serão executados somente após a constituição da PJ; a quick pós-PJ ainda não
foi criada. Este registro não arquiva a F50 e não autoriza convite, ativação,
corte ou publicação jurídica.
