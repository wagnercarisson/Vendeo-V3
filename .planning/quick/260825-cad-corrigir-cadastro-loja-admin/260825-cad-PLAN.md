phase: quick-260825-cad
quick_id: 260825-cad
title: Corrigir cadastro de loja em /loja e admin
date: 2026-08-25

# Contexto

Dois erros pontuais foram identificados:

- `/loja`: o motor de elegibilidade retorna `reject`, mas `stores.verification_status`
  aceita `rejected`.
- Admin: a criacao normal de loja chama `admin_create_store_for_user`, que depende da
  RPC legada `create_store_with_initial_grant`.

# Decisao

Manter somente criacao de store de teste via admin. Loja de producao deve ser criada
pelo onboarding do usuario para preservar aceite legal, CNPJ e elegibilidade freemium.

# Escopo

1. Mapear decisao de elegibilidade `reject` para status persistido `rejected` em:
   - `src/app/api/store/route.ts`
   - `src/app/api/store/update-cnpj/route.ts`
2. Desativar `POST /api/admin/stores` com resposta explicita.
3. Remover o formulario de criacao normal da tela de detalhe admin e deixar o CTA de
   store de teste.
4. Atualizar testes focados.

# Fora de Escopo

- Suporte a CNPJ alfanumerico.
- Nova UX de convite admin para loja de producao.
- Migration destrutiva para remover RPC legada.

# Verificacao

- Testes focados de `/api/store`.
- Testes focados de `/api/store/update-cnpj`.
- Testes focados de `/api/admin/stores`.
