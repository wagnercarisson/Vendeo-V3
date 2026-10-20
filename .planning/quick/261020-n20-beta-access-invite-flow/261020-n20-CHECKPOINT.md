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
| Domínio verificado no Resend | **CONFIRMADO pelo responsável em 2026-10-20** (a checagem DNS anterior não substitui o painel) |
| Rastreamento de cliques desligado | **A confirmar no painel antes de ligar o envio** |

**Nota histórica:** a checagem DNS de 2026-10-20 encontrou `resend._domainkey` ausente; o responsável confirmou posteriormente que o domínio está verificado no Resend. A confirmação do painel prevalece.

## Execução da publicação (2026-10-20)

| Etapa | Resultado |
|---|---|
| Migration `20261020000005` | **APLICADA** via `supabase migration up --linked`; lista remota confirma a versão |
| Colunas em produção | `invite_status`, `invite_attempt_token`, `password_set_at` consultáveis |
| Push | `origin/main` = `51fd0770` |
| Deploy 1 | `dpl_5jnnxCnzN3cv43UBTXKZ9C9TGk3D` — READY, alias `vendeo.tech` |
| Deploy 2 (após envs de e-mail) | `dpl_T7NYno2RL3AePRVV7WpwHqEonVMr` — READY |
| `/convite` | 200, página de aceite renderizada |
| `/login?error=invite_failed` | 200, banner de orientação presente |
| `/signup` | 200, beta fechado preservado |
| `VENDEO_EMAIL_ENABLED` | **false** (envio desligado) |
| `RESEND_API_KEY` / `VENDEO_EMAIL_FROM` | presentes (`noreply@vendeo.tech`) |
| Notificações antigas pendentes | **0** |
| F50.2 | `enabled=false`, `launch_at=null` — **aguardando confirmação antes do primeiro convite** |

O deploy 2 foi necessário porque as variáveis de e-mail foram adicionadas após o deploy 1. Nenhum convite real foi enviado e nenhuma solicitação foi aprovada.

## Aguardando antes do teste

1. **Confirmação da ativação da F50.2** (preferencialmente pelo painel admin, com auditoria do ator real).
2. **E-mail da conta de validação** controlado pelo responsável.
3. Confirmação de que o rastreamento de cliques está desligado no painel do Resend.
4. Autorização para ligar `VENDEO_EMAIL_ENABLED=true` e redeployar (envio afeta também outras notificações; fila antiga está vazia).

## Fora de escopo / não executado

Migration, push e deploy foram executados nesta janela. **Não executado:** aprovação de qualquer solicitação, convite real, campanha paga, alteração de DNS/credenciais e ativação da F50.2. `.dev.log` e credenciais fora do commit.
