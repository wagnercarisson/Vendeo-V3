---
status: in-progress
date: 2026-10-22
slug: f50-3-parser-migration-fix
---

# Quick Task: correção de compatibilidade do parser na migration F50.3

## Objetivo

Corrigir a falha de `supabase db push` causada pelo parser do CLI 2.75.0, preservando o SQL funcional, o nome real da constraint e o preflight.

## Tarefas

1. Substituir as três referências executáveis a `chk_stores_cnpj_atomic` pelo identificador `U&"chk_stores_cnpj_atom\0069c"`.
2. Adicionar comentário curto sobre o workaround do CLI 2.75.0.
3. Preservar preflight, regex, atomicidade, comentários e nome real.
4. Registrar que produção permanece sem a migration aplicada.
5. Registrar reprodução e validação via `supabase db push` em PostgreSQL descartável.
6. Conferir o verificador e rodar as checagens pertinentes.
7. Criar commit da correção.

## Restrições

- Não alterar o archive; não atualizar o CLI; não reparar o container isolado.
- Não executar `db push` remoto, `migration repair`, merge ou deploy.