---
id: 261026-access-request-admin-notice
status: complete
date: 2026-10-26
branch: main
base: fddd836f
type: quick
---

# Quick 261026 — aviso por e-mail de nova solicitação de acesso

## Objetivo

Avisar `comercial@vendeo.tech` quando uma NOVA solicitação de acesso for
persistida, reutilizando o Resend já integrado, sem expor a dashboard e sem
alterar aprovação/convite.

## Menor complemento escolhido

`credit_notifications` não é compatível: o `kind` é fechado, a deduplicação é
por `store_id` (solicitação não tem loja) e o outbox é do domínio de créditos.
Em vez de criar tabela/RPC/cron novo, foram adicionadas colunas
`admin_notice_*` em `access_requests`, espelhando o padrão já existente de
`invite_*` (status, tentativas, lease, attempt_token, provider_message_id,
sent_at, erro seguro).

## Fluxo

1. A rota pública valida e consulta duplicatas (pending/approved) como antes.
2. NOVA solicitação: insert com `admin_notice_status='pending'` e retorno do id.
3. Após persistência confirmada, o aviso é aguardado (não fire-and-forget):
   config → claim atômico → Resend → finalização condicionada ao attempt_token.
4. Falha/timeout do Resend não altera a resposta pública `{ ok: true }` nem
   apaga a solicitação; o estado fica em `failed`/`unconfirmed`/`suppressed`.
5. Duplicata não cria novo registro; se o MESMO aviso ainda estiver
   pendente/falho, o serviço pode retomá-lo com a mesma idempotency key.
6. Histórico (`admin_notice_status NULL`) nunca é notificado/backfilled.

## Conteúdo e segurança

- Destinatário fixo `comercial@vendeo.tech`.
- Assunto fixo `Vendeo — nova solicitação de acesso`.
- Nome e loja somente quando informados; data/hora em America/Sao_Paulo; link
  absoluto para `/admin/access-requests`.
- HTML escapa campos do visitante; sem WhatsApp, token ou dados desnecessários.
- `sent` = aceito pelo Resend, não entrega confirmada.
- Erros persistidos são códigos seguros; sem corpo bruto/credenciais.
- `Idempotency-Key: access-request-notice:<request_id>` quando suportado.

## Arquivos

- `src/lib/email/access-request-notice.ts` + teste
- `src/lib/access-requests/admin-notice.ts` + testes
- `src/app/api/access-requests/route.ts` + teste
- `supabase/migrations/20261026231324_quick_access_request_admin_notice.sql`

## Fora do escopo

Aprovação/convite/auth/onboarding/créditos, Telegram/WhatsApp/push, backfill,
dashboard de reenvio, novos crons, env/credenciais novas, envio real.
