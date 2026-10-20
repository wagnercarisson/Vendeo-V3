# Convite de acesso ao beta — operação e pré-checagem

Fluxo coberto: **solicitação → aprovação admin → e-mail de convite → definição de senha → onboarding**.

## Mecanismo

1. O admin aprova em `/admin/access-requests` (RPC `admin_review_access_request`, atômica: status + auditoria + limite F50.2).
2. O servidor chama `supabaseAdmin.auth.admin.generateLink({ type: "invite" })` e obtém um `hashed_token` de uso único.
3. O e-mail é enviado pelo Resend do app com link para `/convite?token_hash=…&type=invite`.
4. `/convite` **não consome** o token no GET. O consumo acontece no clique em “Aceitar convite”, que faz POST em `/auth/confirm` (`verifyOtp`).
5. Sessão criada → `/update-password` (mínimo 8 caracteres) → `/dashboard` → `PrivacyGate` → `/loja` (onboarding).

**Aceitar ≠ concluir:** aceitar o convite apenas cria a sessão. O cadastro só é considerado concluído quando a definição de senha é bem-sucedida e o app registra `access_requests.password_set_at` (POST autenticado `/api/auth/invite-completed`). Se a pessoa aceitar e fechar a página, o reenvio continua o cadastro com `magiclink`.

Reenvio: convite pendente → `generateLink({ type: "magiclink" })`; conta já ativa → e-mail de orientação para `/login`, sem forçar troca de senha. Reenviar nunca altera `auth.users.created_at`.

## Pré-checagem de produção (obrigatória antes de habilitar envio real)

| Item | Como conferir | Falha |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL pública do deploy, sem barra final | Convite não é gerado |
| `VENDEO_EMAIL_ENABLED=true` | Vercel → Environment Variables | `invite_status=failed` (`email_not_configured`) |
| `RESEND_API_KEY` | Vercel (secret) | idem |
| `VENDEO_EMAIL_FROM` | Remetente com domínio verificado | idem |
| Domínio no Resend | Domínio verificado (SPF/DKIM) | Provedor recusa (4xx) |
| Rastreamento de clique/abertura | **Desligado** para o domínio remetente | Defesa em profundidade; o GET de `/convite` já não consome o token |
| Deploy do código | `/convite` e `POST /auth/confirm` publicados | Link cai em 404/405 |
| Migration | `20261020000005_beta_access_invite.sql` aplicada | Admin não mostra/grava estado do convite |
| `RESEND_API_URL` | Apenas teste isolado; em produção usar o padrão oficial | Captura local de e-mail |

A pré-checagem roda no servidor (`getAccessInviteEmailConfig`) **antes** de criar usuário no Supabase Auth. Sem configuração, a aprovação é preservada e o convite fica `failed`, reenviável — nenhum usuário é criado sem possibilidade de envio.

## Coordenação com a F50.2 (oferta de teste de 28 dias)

`generateLink({type:"invite"})` cria `auth.users` **antes** de o convite ser aberto. A elegibilidade da F50.2 usa `auth.users.created_at >= trial_offer_settings.launch_at`.

- A **primeira** geração de convite da conta de teste deve ocorrer **depois** da ativação da oferta.
- Reenviar o link **não** muda `created_at`; não corrige uma conta criada antes do marco.
- Em teste controlado, valide `trial_offer_settings.launch_at` antes de aprovar a solicitação.

## Estados do convite (admin)

| Estado | Significado |
|---|---|
| `not_sent` | Aprovado, convite ainda não disparado |
| `sending` | Lease ativo (envio em andamento); não reenviar |
| `sent` | Provedor **aceitou** a mensagem — não é confirmação de entrega |
| `failed` | Falha conhecida (config, 4xx, erro do Supabase); reenviar |
| `unconfirmed` | Timeout/5xx/rede: resultado ambíguo; **sem reenvio automático** |
| `account_active` | Conta já ativa: orientação enviada para `/login`; sem troca de senha |
| `sent_unrecorded` | *(resposta, não persistido)* provedor aceitou, mas o registro local não foi confirmado; preserva o id da mensagem e não reenvia sozinho |
| `stale` | *(resposta, não persistido)* tentativa antiga perdeu o lease para uma mais recente; nada foi sobrescrito |

O lease tem um **token de tentativa**: a finalização só é aplicada se o token ainda for o atual. Uma tentativa lenta não sobrescreve nem libera a trava de outra. Falha no UPDATE de finalização nunca é reportada como “enviado”: vira `sent_unrecorded` (ou `unconfirmed`), e a falha de auditoria é exposta como aviso.

Tokens nunca são persistidos nem logados; mensagens de erro são redigidas (`token_hash=[redacted]`, URLs removidas).

## Teste real (somente com autorização explícita)

1. Aplicar a migration e publicar o deploy.
2. Conferir a tabela de pré-checagem acima.
3. Solicitar acesso com um e-mail controlado pelo usuário.
4. Aprovar no admin e confirmar `invite_status=sent` + e-mail recebido.
5. Abrir o link → `/convite` → “Aceitar convite” → definir senha → `/dashboard` → `PrivacyGate` → `/loja`.
6. Reabrir o mesmo link: deve orientar link inválido/expirado (sem sessão indevida).
7. Reenviar pelo admin: novo e-mail, sem reaprovar; `auth.users.created_at` inalterado.
8. Aceitar e abandonar antes da senha: o reenvio deve mandar `magiclink` (retomada), não `/login`.
9. Conta com senha concluída: reenvio deve orientar `/login` e não alterar a senha.
10. Conferir `admin_audit_log` (`access_request_invite`) e que **nenhum crédito** foi concedido antes do onboarding.

## Fora de escopo

Cadastro público (`VENDEO_PUBLIC_SIGNUP_ENABLED=false` permanece), sistema de créditos, F50.2 e Produto 1:1. Migration, ativação de envio, deploy e envio real exigem autorização própria.
