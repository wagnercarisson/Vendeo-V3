> Synced from `fase-26-admin-operacional` (ADDED).

## Purpose

Permitir que administradores criem lojas para usuários sem loja (convite beta) via RPC atômica `admin_create_store_for_user` que encapsula criação da loja + grant inicial + audit log na mesma transação.

## Requirements

### Requirement: admin_create_store_for_user RPC function

O sistema SHALL criar a SQL function `public.admin_create_store_for_user(p_admin_id UUID, p_user_id UUID, p_name TEXT, p_segment TEXT) RETURNS JSONB`.

A função SHALL ser atômica — criação da loja + audit log na mesma transação.

- Passo 1: Verifica se usuário já possui loja via SELECT em `stores WHERE user_id = p_user_id`. Se existir, lança exceção `usuario_ja_possui_loja`
- Passo 2: Chama RPC existente `create_store_with_initial_grant(p_name := p_name, p_segment := p_segment, p_user_id := p_user_id)` e captura dados da loja criada
- Passo 3: INSERT em `admin_audit_log` com actor_id=p_admin_id, action='store_create_invite', target_type='user', target_id=p_user_id, reason='Criação de loja via admin (convite beta)', metadata contendo storeId e storeName
- Passo 4: Se qualquer passo falhar → ROLLBACK (atomicidade real)
- SECURITY DEFINER com SET search_path = ''

#### Scenario: admin_create_store_for_user creates store + audit log

- **WHEN** `admin_create_store_for_user` é chamado com parâmetros válidos para usuário sem loja
- **THEN** executa `create_store_with_initial_grant` criando loja com grant inicial
- **AND** insere entry em `admin_audit_log` com `action='store_create_invite'`
- **AND** retorna JSON com dados da loja criada

#### Scenario: admin_create_store_for_user rejects user with existing store

- **WHEN** `admin_create_store_for_user` é chamado para usuário que já possui loja
- **THEN** lança exceção `usuario_ja_possui_loja` sem criar nova loja nem audit log

#### Scenario: admin_create_store_for_user rollback on audit failure

- **WHEN** INSERT em `admin_audit_log` falha
- **THEN** ROLLBACK desfaz a criação da loja (atomicidade)

### Requirement: POST /api/admin/stores

O sistema SHALL expor `POST /api/admin/stores` para criação de loja para um usuário sem loja (convite beta).

- Requer `requireAdmin()`
- Valida body com Zod schema (userId UUID, storeName string, segment string)
- Chama RPC `admin_create_store_for_user(p_admin_id, p_user_id, p_name, p_segment)` (wrapper atômico)
- Retorna 201 com dados da loja criada
- Em caso de conflito (usuário já tem loja), RPC lança exceção → handler retorna 409

#### Scenario: Admin creates store for user without store

- **WHEN** admin POST `/api/admin/stores` com `{ userId, storeName: "Padaria do João", segment: "alimentacao" }`
- **THEN** retorna 201 com dados da loja criada
- **AND** loja é criada com grant inicial de créditos
- **AND** audit log registra ação `store_create_invite`

#### Scenario: Admin creates store for user that already has store

- **WHEN** admin POST `/api/admin/stores` para usuário que já possui loja
- **THEN** retorna 409 Conflict com mensagem "Usuário já possui uma loja"

#### Scenario: Store creation without auth returns 401

- **WHEN** usuário não autenticado POST `/api/admin/stores`
- **THEN** retorna 401

#### Scenario: Store creation by non-admin returns 403

- **WHEN** usuário não admin POST `/api/admin/stores`
- **THEN** retorna 403

### Requirement: Store creation UI

O sistema SHALL exibir botão/ação "Criar loja" na página `/admin/users/[id]` quando o usuário não possui loja.

- Client Component inline
- Modal ou formulário inline com campos: storeName, segment
- Ao criar, faz POST para `/api/admin/stores` com userId extraído da URL
- Toast de sucesso + recarrega dados da página após criação
- Após criação, exibe dados da loja e habilita formulário de grant

#### Scenario: Admin creates store via UI

- **WHEN** admin acessa `/admin/users/[id]` de usuário sem loja
- **THEN** exibe botão "Criar loja"
- **AND** ao clicar, exibe formulário com storeName e segment
- **AND** após submit bem-sucedido, exibe toast e dados da loja
