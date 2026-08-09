# Fechamento real do Supabase Auth — Beta fechado

> Quick 260808-rqw — Landing pública + acesso fechado beta
> O que esta quick **faz** e o que **NÃO faz** em termos de fechamento de acesso.

## O que esta entrega cobre

- **Landing pública** em `/` com formulário de solicitação de acesso free
  (persistido em `public.access_requests` via `POST /api/access-requests`,
  escrita exclusivamente com `service_role` — RLS não expõe nada a `anon`).
- **`/signup` neutralizado no fluxo visual**: a tela mostra "Beta fechado" e
  orienta a solicitar acesso. Não há mais formulário de cadastro aberto.
- **Login mantido**: usuários liberados entram por `/login` e caem em
  `/dashboard`; o link de login aponta para "Solicitar acesso free".
- **Admin**: `/admin/access-requests` lista solicitações e aprova/recusa via
  RPC atômico `admin_review_access_request` (status + trilha em
  `admin_audit_log` na mesma transação).

## O que esta entrega NÃO cobre (operação manual obrigatória)

A neutralização em `/signup` é **visual/de rotas**. O Supabase Auth continua
aceitando cadastros de quem chamar o endpoint de signup diretamente (ou o SDK
client). Para **fechar de verdade** o acesso, é preciso aplicar UMA das opções
abaixo no Supabase Dashboard.

---

## Opção A — Desabilitar novos cadastros (recomendado para começar)

1. Abra o **Supabase Dashboard** do projeto Vendeo.
2. Vá em **Authentication → Sign In / Up**.
3. Desative a opção **"Allow new users to sign up"**.
4. Salve.

Efeito: nenhum usuário novo consegue criar conta; usuários existentes
continuam logando normalmente. Para liberar alguém, crie o usuário
manualmente (fluxo abaixo).

## Opção B — Before User Created Hook (allowlist de emails liberados)

Quando precisar de mais controle (liberar só emails aprovados, com convite
automatizado):

1. Crie uma **Edge Function** `allowlist-hook` que:
   - Recebe o payload do hook `user.created` (antes da criação).
   - Consulta `public.access_requests` (via `service_role`) por
     `lower(email)` com `status = 'approved'`.
   - Retorna `{ user_metadata: { ... } }` para permitir, ou
     `{ error: "Acesso não liberado" }` para bloquear.
2. Em **Authentication → Hooks**, associe o evento **Before User Created**
   à Edge Function `allowlist-hook`.
3. Publique a função (`supabase functions deploy allowlist-hook`).

Nota: `access_requests` é a fonte das aprovações — o admin aprova em
`/admin/access-requests` e a trilha fica em `admin_audit_log`
(`access_request_approve`).

---

## Fluxo manual de convite (após aprovar em /admin/access-requests)

1. O visitante solicita acesso na landing → linha em `access_requests`
   (`status = 'pending'`).
2. O admin aprova em **/admin/access-requests** → status `approved` +
   `reviewed_by`/`reviewed_at` + entrada em `admin_audit_log`.
3. Para liberar o login da pessoa (enquanto a Opção A estiver ativa), crie o
   usuário manualmente em **Authentication → Users → Add user** com o email
   aprovado, OU implemente a Opção B para automatizar.
4. A pessoa faz login em `/login` com a senha enviada por email (fluxo
   normal de confirmação/definição de senha).

> Envio real de convite por email está **fora do escopo** desta quick — a
> mudança de status + este procedimento manual cobrem o beta controlado.
