# DB Verify Phase 12

> Synced from `fase-12-fundacao-db-storage` (ADDED).

## Purpose

Script SQL de verificação (smoke tests) que valida a correta aplicação das duas migrations da Fase 12. Usa blocos `DO $$` com `RAISE EXCEPTION` para falha rápida em caso de inconsistência.

## ADDED Requirements

### Requirement: Smoke SQL script exists

O sistema SHALL fornecer o script `scripts/verify-phase12.sql` com blocos `DO $$` que verificam:

1. Tabela `public.campaigns` existe
2. RLS está ativa em `public.campaigns`
3. CHECK constraint `chk_campaigns_error_message` existe
4. Trigger `trg_campaigns_updated_at` existe
5. Bucket `campaign-images` existe e é privado
6. Policy `owner_select_campaign_images` existe
7. Policy `service_insert_campaign_images` existe
8. Policy `service_delete_campaign_images` existe
9. NENHUMA policy `service_update_campaign_*` existe (UPDATE ausente intencionalmente)

Cada bloco `DO $$` usa `RAISE EXCEPTION` em caso de falha e `RAISE NOTICE 'PASS: ...'` em caso de sucesso.

#### Scenario: All checks pass

- **WHEN** `scripts/verify-phase12.sql` é executado contra o banco com ambas as migrations aplicadas
- **THEN** todos os blocos produzem `RAISE NOTICE 'PASS: ...'` sem `RAISE EXCEPTION`

#### Scenario: Missing table fails early

- **WHEN** `scripts/verify-phase12.sql` é executado sem a migration 1
- **THEN** o primeiro bloco lança `RAISE EXCEPTION 'FAIL: campaigns table does not exist'`

### Requirement: UAT technical checklist

O sistema SHALL definir um checklist de 10 verificações, a serem executadas como UAT técnico manual (ou automatizado via Jest se o Supabase local estiver disponível):

| # | Verificação |
|---|-------------|
| 1 | Owner vê próprias campaigns via RLS |
| 2 | Outro tenant vê 0 resultados (sem vazamento) |
| 3 | `updated_at` muda no UPDATE |
| 4 | `status='error'` sem mensagem rejeita |
| 5 | Client-side INSERT em `campaigns` falha (sem policy de escrita) |
| 6 | Bucket `campaign-images` é privado (URL pública falha) |
| 7 | Upload client-side falha |
| 8 | Service_role consegue upload + delete |
| 9 | Signed URL permite leitura |
| 10 | URL pública não funciona |

#### Scenario: Manual UAT verifies all checks

- **WHEN** o revisor executa as 10 verificações manualmente ou via Jest
- **THEN** todas as verificações passam
