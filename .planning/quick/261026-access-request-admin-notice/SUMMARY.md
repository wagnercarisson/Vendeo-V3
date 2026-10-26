---
status: complete
date: 2026-10-26
quick_id: 261026
slug: access-request-admin-notice
branch: main
base: fddd836f
phase: quick
type: execute
tasks_completed: 5/5
db_touched: false
provider_touched: false
env_touched: false
migrations_touched: true
migration_applied: false
code_commit: 5ad439a5
---

# Quick 261026 — aviso por e-mail de nova solicitação de acesso

## One-liner

Toda NOVA solicitação de acesso persistida dispara (aguardado, não
fire-and-forget) um e-mail para **comercial@vendeo.tech** via Resend existente,
com estado durável em `access_requests.admin_notice_*`, idempotency key por
solicitação e resposta pública genérica preservada. Migration criada e **não
aplicada**.

## Por que não reutilizar `credit_notifications`

O outbox existente é do domínio de créditos: `kind` fechado, deduplicação por
`(store_id, kind, dedup_key)` e a solicitação de acesso não possui loja. Em vez
de abrir esse CHECK/domínio ou criar um sistema genérico, o menor complemento
foi adicionar `admin_notice_*` em `access_requests`, espelhando o padrão já
existente de `invite_*` (status, attempts, lease, attempt_token,
provider_message_id, sent_at, erro seguro). Sem tabela/RPC/cron novo.

## Comportamento

### Nova solicitação
- insert mantém os campos atuais e grava `admin_notice_status='pending'`;
- o aviso só é tentado após o insert retornar id (persistência confirmada);
- a rota **aguarda** a tentativa (sem fire-and-forget) e retorna `{ ok: true }`
  independentemente do resultado do Resend.

### Conteúdo
- destinatário exclusivo **comercial@vendeo.tech**;
- assunto **“Vendeo — nova solicitação de acesso”**;
- nome e loja somente quando informados;
- data/hora em **America/Sao_Paulo** via `formatDateTimeBR`;
- link absoluto configurado (`NEXT_PUBLIC_SITE_URL`) para
  `/admin/access-requests` (continua exigindo auth/admin);
- HTML escapa nome/loja; sem WhatsApp, token de aprovação/convite ou dados
  desnecessários.

### Estado durável e falhas
Estados: `pending → sending → sent | failed | unconfirmed | suppressed`
(histórico permanece `NULL`).

- `sent` = Resend **aceitou** a mensagem; não é entrega confirmada.
- 4xx → `failed`; 5xx/timeout/rede → `unconfirmed`.
- `VENDEO_EMAIL_ENABLED` desligado ou config ausente → `suppressed` (sem envio).
- Lease de 5 min + `attempt_token` impedem que tentativa antiga sobrescreva a
  atual; no máximo 3 tentativas finalizadas.
- Falha de envio nunca apaga/invalida a solicitação; a resposta pública
  permanece `{ ok: true }` após a persistência.
- Erros persistidos são apenas códigos seguros (`provider_http_500`, `timeout`,
  `network_error`, `email_disabled`, etc.); sem corpo bruto/credenciais/PII.
- `Idempotency-Key: access-request-notice:<request_id>` é enviada ao Resend
  quando suportada; não prometemos entrega exatamente uma vez.

### Duplicidade e reenvio
- e-mail com solicitação pending/approved continua sem segundo registro e com a
  mesma resposta genérica;
- duplicata **não cria novo aviso**;
- se o MESMO aviso estiver `failed`/`unconfirmed`/`suppressed` (ou `sending`
  com lease expirado), a duplicata pode retomá-lo com a mesma idempotency key;
- `sent` e histórico (`NULL`) nunca são reenviados.

### Configuração
Reutiliza `RESEND_API_KEY`, `VENDEO_EMAIL_FROM`, `VENDEO_EMAIL_ENABLED`,
`NEXT_PUBLIC_SITE_URL` e o endpoint Resend já usados pelo convite. Nenhuma
variável/credencial nova; nenhum cron novo.

## Migration

`supabase/migrations/20261026231324_quick_access_request_admin_notice.sql`
(timestamp UTC real; prefixo único conferido na worktree/branches conhecidas).

- colunas `admin_notice_status` (nullable), `sent_at`, `last_attempt_at`,
  `attempts`, `error`, `provider_message_id`, `locked_until`,
  `attempt_token`;
- CHECK de status, attempts >= 0 e erro <= 300 caracteres;
- sem backfill (histórico fica `NULL`);
- sem tabela/RPC/grant/RLS novos;
- **não aplicada** nesta execução.

## Arquivos

**Criados**
- `src/lib/email/access-request-notice.ts`
- `src/lib/access-requests/admin-notice.ts`
- testes de conteúdo/sender, estado durável e contrato da migration
- migration acima

**Modificados**
- `src/app/api/access-requests/route.ts` (insert com pending + tentativa
  aguardada + retomada segura em duplicata)
- `src/app/api/access-requests/__tests__/route.test.ts`

## Evidências

| Gate | Resultado |
|---|---|
| Suítes focadas (email, access-requests, admin access-requests, invite-completed, notifications; sem Postgres/integração) | **13 arquivos / 93 testes passed** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | limpo |

Cobertura offline:
- nova solicitação persistida → aviso ao destinatário fixo;
- duplicata `sent` → sem novo aviso; duplicata `failed` → retoma o mesmo aviso;
- falha de insert → nenhum envio;
- falha/timeout do Resend → solicitação preservada, resposta pública correta,
  estado `failed`/`unconfirmed` rastreável;
- reexecução: failed → sent → skipped;
- concorrência/lease: tentativa antiga vira `stale` sem sobrescrever;
- máximo de 3 tentativas;
- opcionais ausentes, escape de HTML, data brasileira e URL admin;
- configuração desabilitada/ausente → `suppressed`;
- HTML/text sem WhatsApp/token; erros sem corpo bruto.

## Limitações

- Testes são **offline/mocks**: não provam entrega real, Resend, banco ou
  aceitação em produção.
- A migration é **pré-requisito de publicação**; sem ela, o insert com
  `admin_notice_status` e a leitura do estado falham.
- `VENDEO_EMAIL_ENABLED` precisa estar ligado no ambiente para envio real; em
  homolog/teste ele pode estar desligado (estado `suppressed`).
- Não há painel/cron de reenvio nesta quick; o estado durável e o serviço
  permitem retomada segura (inclusive pela duplicata) sem novo sistema.
- Nenhum e-mail real, banco, provider, env, migration aplicada, aprovação,
  convite, crédito, push ou deploy.

## Próximo passo

Revisão do Codex. Depois: aplicar a migration autorizada, confirmar
`VENDEO_EMAIL_ENABLED`/Resend no ambiente e fazer um envio real controlado para
`comercial@vendeo.tech`; só então considerar a entrega publicada.
