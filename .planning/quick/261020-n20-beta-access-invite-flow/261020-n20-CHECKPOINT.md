---
quick_id: 261020-n20
slug: beta-access-invite-flow
type: publication-checkpoint
created: 2026-10-20
status: awaiting-authorization
---

# Checkpoint de publicação — convite de acesso ao beta

Nada foi aplicado, enviado, aprovado ou publicado nesta etapa. Verificações somente leitura.

## Destino

| Item | Estado |
|---|---|
| Vercel | projeto `vendeo-v3` (scope `wagnercarissons-projects`), alias de produção `https://vendeo.tech` |
| Deployment ativo | `dpl_3d7fiErdfikwyqA2wPDpUGay6toq`, `READY`, criado em 2026-10-20 15:57 (local) |
| Metadados Git no deployment | ausentes (deploy sem vínculo de commit no Vercel) |
| Supabase de produção | projeto `gvbzwihwgzujwsviufgy` |
| Git remoto | `origin` → `github.com/wagnercarisson/Vendeo-V3` |
| Branch | `main` |
| HEAD local | `382bfb8444b6a91c239b47d4ac6ebe194d9cb4b6` |
| `origin/main` | `05e81d90` |
| Divergência | **9 commits à frente, 0 atrás** (não enviados) |
| `/convite` em produção | **404** (código novo não está no ar) |

## Migration

| Item | Estado |
|---|---|
| Arquivo | `supabase/migrations/20261020000005_beta_access_invite.sql` |
| SHA-256 | `5DBA88ABCCC7EE5BDE640C64FB4509AABE90FC93D587B755C1E735BF860B8559` |
| Tamanho | 5.934 bytes |
| Estado no remoto | **PENDENTE** (`20261020000005` sem versão remota) |
| Últimas aplicadas | `20261020000001..04` (F50.2) |
| Natureza | aditiva: colunas de convite/`password_set_at` + CHECK de auditoria |

## Configuração de e-mail em produção (presença/estado)

Verificado via `vercel env ls` e leitura temporária com valores mascarados; nenhum segredo foi exibido e o arquivo temporário foi removido.

| Variável | Estado |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://vendeo.tech` |
| `VENDEO_PUBLIC_SIGNUP_ENABLED` | `false` |
| `VENDEO_EMAIL_ENABLED` | **AUSENTE** (não está ativo) |
| `RESEND_API_KEY` | **AUSENTE** |
| `VENDEO_EMAIL_FROM` | **AUSENTE** |
| `SUPPORT_EMAIL` | presente |
| `SUPABASE_SERVICE_ROLE_KEY` | presente |

Consequência: enquanto a configuração estiver ausente, aprovar uma solicitação **após o deploy** não envia e-mail; o convite fica `failed` com `email_not_configured` e a aprovação permanece válida (reenviável). **Se `VENDEO_EMAIL_ENABLED=true` for configurado**, aprovar passa a disparar o convite — e a mesma chave também controla outras notificações do app, portanto não deve ser alterada às cegas.

## Domínio remetente e rastreamento

**SMTP do Supabase Auth:** Resend (`smtp.resend.com:587`, remetente `noreply@vendeo.tech`), confirmado em 2026-10-20. Hostinger é registro histórico. Diagnóstico completo em `261020-n20-SMTP-DIAGNOSIS.md`.

| Verificação | Estado |
|---|---|
| `send.vendeo.tech` MX | `feedback-smtp.sa-east-1.amazonses.com` (infra típica do Resend) |
| `send.vendeo.tech` SPF | `v=spf1 include:amazonses.com ~all` |
| DKIM `resend._domainkey.vendeo.tech` | **NXDOMAIN — ausente** |
| SPF apex `vendeo.tech` | Hostinger |
| DMARC | `v=DMARC1; p=none` |
| Domínio verificado no Resend | **NÃO CONFIRMÁVEL**; DNS indica configuração incompleta (DKIM ausente) |
| Rastreamento de cliques desligado | **NÃO CONFIRMÁVEL** sem `RESEND_API_KEY`; deve ser verificado/desligado no painel do Resend |

**Bloqueio:** sem DKIM e sem chave, o envio real não deve ser habilitado.

## Pré-requisitos antes de qualquer envio real

1. Concluir verificação do domínio no Resend (adicionar o DKIM `resend._domainkey` fornecido pelo painel).
2. Confirmar/desligar rastreamento de cliques e abertura no domínio remetente.
3. Definir `RESEND_API_KEY` e `VENDEO_EMAIL_FROM` na Vercel (produção).
4. Manter `VENDEO_EMAIL_ENABLED=false` até a janela autorizada; ao ligar, assumir que **outras notificações** também serão habilitadas.
5. Aplicar a migration `20261020000005` **antes** do deploy (o código novo espera as colunas).
6. Confirmar `trial_offer_settings.launch_at` antes do primeiro convite real da conta de teste (o primeiro `generateLink` cria `auth.users`; reenvio não altera `created_at`).
7. Após o deploy, **não aprovar solicitações reais** até a autorização do teste controlado.

## Ordem recomendada (após autorização)

1. Migration no Supabase de produção.
2. Push dos 9 commits + deploy Vercel.
3. Verificar `/convite`, presença das envs e ausência de mudança de comportamento com a flag off.
4. Em janela autorizada: configurar Resend/flag e executar **um** teste com e-mail controlado.
5. Conferir `access_requests`, `admin_audit_log`, `auth.users.created_at` e ausência de crédito antes do onboarding.

## Autorizações necessárias (separadas)

- [ ] Aplicar a migration `20261020000005` em produção.
- [ ] Push/deploy dos 9 commits (`382bfb84`).
- [ ] Configurar `RESEND_API_KEY` / `VENDEO_EMAIL_FROM` e concluir o domínio no Resend.
- [ ] Ligar `VENDEO_EMAIL_ENABLED=true` (ciente do impacto em outras notificações).
- [ ] Executar o teste real com e-mail controlado (sem aprovar outras solicitações).

## Fora de escopo / não executado

Nenhuma migration aplicada em produção; nenhum push; nenhum deploy; nenhuma aprovação; nenhum convite real; nenhuma env alterada; `.dev.log` e credenciais fora do commit.
