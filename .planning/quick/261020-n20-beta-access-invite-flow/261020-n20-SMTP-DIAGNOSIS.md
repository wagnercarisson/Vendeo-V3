---
quick_id: 261020-n20
slug: beta-access-invite-flow
type: smtp-diagnosis
created: 2026-10-20
status: awaiting-authorization
---

# Diagnóstico — SMTP de produção e convites

Somente leitura. Nenhum DNS, credencial, configuração, mensagem ou publicação foi alterado.

## Método

- `GET /v1/projects/{ref}/config/auth` na Management API do Supabase, usando a credencial local do CLI (não exibida).
- Consultas DNS públicas (Google DNS e resolvedor local).
- Nenhum e-mail de teste foi enviado.

## SMTP vigente em produção

| Item | Valor |
|---|---|
| Provedor | **Resend** |
| Host | `smtp.resend.com` |
| Porta | `587` |
| Remetente | `noreply@vendeo.tech` |
| Nome do remetente | `Vendeo` |
| Usuário SMTP | presente (não exibido) |
| Senha SMTP | presente (não exibida) |
| `mailer_autoconfirm` | `false` (confirmação de e-mail ativa) |
| `external_email_enabled` | `true` |
| Limite de envio | 30 e-mails/hora (`rate_limit_email_sent`), frequência mínima 60s |
| `disable_signup` (GoTrue) | `false` — o fechamento do beta é feito pela flag da aplicação (`VENDEO_PUBLIC_SIGNUP_ENABLED=false`), não pelo Auth |

## Divergência documental reconciliada

| Fonte | Diz | Situação |
|---|---|---|
| `docs/archived-alignments/alinhamento-fase-8-ciclo-de-conta.md` | SMTP Hostinger (`smtp.hostinger.com`) | **Histórico/superado** |
| `.planning/phases/50.../50-CONTEXT.md` | Resend como SMTP do GoTrue | **Condiz com a produção** |
| Produção (Management API) | `smtp.resend.com:587`, `noreply@vendeo.tech` | **Fonte de verdade** |

**Conclusão:** a Hostinger **não é** o provedor vigente. O provedor atual é o Resend. O registro Hostinger deve ser marcado como histórico; nenhuma migração de provedor é necessária.

## Domínio remetente e rastreamento

| Verificação | Estado |
|---|---|
| `send.vendeo.tech` MX | `feedback-smtp.sa-east-1.amazonses.com` (infra Resend/SES) |
| `send.vendeo.tech` SPF | `v=spf1 include:amazonses.com ~all` |
| DKIM `resend._domainkey.vendeo.tech` | **NXDOMAIN (ausente)** |
| SPF apex `vendeo.tech` | Hostinger |
| DMARC | `v=DMARC1; p=none` |
| Verificação no Resend | **NÃO CONFIRMÁVEL** pela API — a senha SMTP armazenada não é utilizável como API key (64 caracteres, `400` na API do Resend) |
| Rastreamento de cliques | **NÃO CONFIRMÁVEL** sem acesso ao painel/API do Resend |

**Risco:** o registro DKIM ausente é incompatível com domínio verificado no Resend. Antes de habilitar convites reais, é necessário confirmar no painel do Resend se `vendeo.tech` está verificado e, se não estiver, concluir a verificação e desligar o rastreamento de cliques. Não alterar DNS sem autorização.

## Impacto nos convites

O convite já usa **Resend** (API do app), não o SMTP do Supabase Auth. Como o provedor vigente também é Resend, **não há troca de provedor a fazer**. O ajuste mínimo é apenas de configuração:

1. Criar/obter uma API key do Resend com permissão de envio.
2. Configurar na Vercel (produção):
   - `RESEND_API_KEY` (segredo)
   - `VENDEO_EMAIL_FROM=noreply@vendeo.tech`
   - `VENDEO_EMAIL_ENABLED=true` **somente na janela autorizada** (a chave também controla outras notificações)
3. Confirmar a verificação do domínio e desligar o rastreamento de cliques no Resend.
4. Aplicar a migration e publicar o código.
5. Executar **um** teste controlado; não aprovar outras solicitações.

Nenhum código novo é necessário para usar o Resend: o fluxo atual (`generateLink` + envio próprio) preserva aceite, reenvio, auditoria, `sent`/`failed`/`unconfirmed`/`sent_unrecorded`/`stale` e o lease por tentativa.

### Se a Hostinger fosse o provedor

Não é o caso. Ainda assim, o ajuste mínimo equivalente seria trocar apenas o transporte em `src/lib/email/access-invite.ts` por SMTP Hostinger (host/porta/credenciais), mantendo a mesma interface, os mesmos estados e o mesmo controle de reenvio. Não há motivo para adotar essa troca agora.

## Observações

- O SMTP do Supabase Auth (Resend) está configurado com limite de 30 e-mails/hora; isso afeta signup/recuperação, **não** o convite do app (que usa a API do Resend).
- `disable_signup=false` no GoTrue: o fechamento do beta continua dependendo da flag da aplicação. Não alterado; registrar como ponto de atenção separado.
- Nenhuma senha, token, chave ou URL completa foi exibida.

## Autorizações necessárias

- [ ] Confirmar/corrigir a verificação do domínio no Resend (sem alterar DNS sem autorização).
- [ ] Desligar rastreamento de cliques no domínio.
- [ ] Configurar `RESEND_API_KEY` e `VENDEO_EMAIL_FROM` na Vercel.
- [ ] Aplicar migration e publicar o código.
- [ ] Ligar `VENDEO_EMAIL_ENABLED=true` na janela autorizada.
- [ ] Executar teste real controlado (uma solicitação).

Nada será executado até a autorização.
