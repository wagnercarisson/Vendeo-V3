---
quick_id: 261020-n20
slug: beta-access-invite-flow
type: publication-checkpoint
created: 2026-10-20
updated: 2026-10-20
status: complete
---

# Checkpoint de publicação — convite de acesso ao beta

Documento final da quick `261020-n20`. Publicação, teste único e encerramento concluídos em 2026-10-20.

## Estado final

| Item | Estado |
|---|---|
| Vercel | projeto `vendeo-v3`, alias de produção `https://vendeo.tech` |
| Deploy com envio ligado | `dpl_G6aFPfXwW1vqkbxLEfSRLiX4x8C5` — **READY** |
| Código publicado | `51fd0770` (docs posteriores: `b39ac789`) |
| Migration | `20261020000005_beta_access_invite.sql` **aplicada** |
| SHA-256 da migration | `5DBA88ABCCC7EE5BDE640C64FB4509AABE90FC93D587B755C1E735BF860B8559` |
| Supabase produção | `gvbzwihwgzujwsviufgy` |
| SMTP Auth | Resend, `smtp.resend.com:587`, remetente `noreply@vendeo.tech` |
| Domínio Resend | verificado (DKIM `resend._domainkey.vendeo.tech` presente) |
| Tracking | não configurado; nenhum subdomínio de tracking criado |
| `VENDEO_PUBLIC_SIGNUP_ENABLED` | `false` |
| `VENDEO_EMAIL_ENABLED` final | **true** — permanece ligado |
| Fila de notificações | **0** pendentes/processing |
| F50.2 | **ativa**; `launch_at=2026-10-20T21:25:31.344856+00:00` |

## Teste único — envio e recebimento

| Item | Resultado |
|---|---|
| Solicitação | `2e9f8544-db99-4b87-a356-7dac06a7cb7a` — `comercial@vendeo.tech` |
| Status | `approved` em `2026-10-20T21:46:15Z` |
| Convite | `invite_status=sent`, tentativa 1, `invite_error=null` |
| `providerMessageId` | `01a15b47-85a2-736e-be1a-bbb53d85473c` |
| Envio ao provedor | `2026-10-20T21:46:16Z` |
| `auth.users.created_at` | `2026-10-20T21:46:16Z` — depois do `launch_at` |
| Recebimento | **confirmado pelo responsável** em `comercial@vendeo.tech` |
| Auditoria | `access_request_approve` + `access_request_invite` (`result=sent`) |

**Aceite do agente:** o envio e o recebimento são aceitos como evidência desta quick. O agente não aprovou a solicitação, não clicou no convite e não expôs token ou link completo.

## Validação humana posterior (compartilhada com a F50.2)

Após o recebimento, o responsável executou o aceite, a definição de senha e o onboarding. O agente **não executou** essas etapas; apenas as observou em leitura.

| Evidência | Valor |
|---|---|
| E-mail confirmado / sessão | `2026-10-20T21:48:16Z` |
| `password_set_at` | `2026-10-20T21:48:34Z` |
| Loja criada | `2026-10-20T21:50:25Z` — “Farmácia do Povo” (`is_test_store=false`) |
| Onboarding concluído | `2026-10-20T21:50:52Z` |
| Enrollment F50.2 | `started_at=2026-10-20T21:50:52Z`, `expires_at=2026-11-17T21:50:52Z`, `granted_total=5`, `last_granted_seq=0` |
| Créditos | **+5 demo** (`balance=5`, `demo_balance=5`, validade até 2026-11-17) |
| Campanhas pagas | **0** |
| Outras solicitações | intocadas (5 aprovadas no total: 4 anteriores + esta; 1 pendente alheia) |

**Atribuição:** aceite/senha/onboarding são **validação humana posterior transferida para a F50.2**, não execução do agente nem desta quick. Evidência compartilhada em `.planning/phases/50.2-oferta-teste-gratuito-28-dias/50.2-BETA-INVITE-EVIDENCE.md`.

## Link e token

O convite já havia sido consumido quando o estado foi conferido. Por isso não foi possível inspecionar o destino “sem consumir”. Nenhum token, link completo ou senha foi exposto. O template gera `https://vendeo.tech/convite` (validado no E2E isolado).

## Histórico

- `261020-n20-SMTP-DIAGNOSIS.md` — reconciliação Hostinger × Resend; SMTP vigente é Resend.
- Deploy inicial `dpl_5jnnxCnzN3cv43UBTXKZ9C9TGk3D` e deploy de envs `dpl_T7NYno2RL3AePRVV7WpwHqEonVMr`, ambos READY; o deploy final com envio ligado é `dpl_G6aFPfXwW1vqkbxLEfSRLiX4x8C5`.

## Não executado

- Nenhum novo teste ou envio após o teste único.
- Nenhuma outra solicitação aprovada.
- Nenhuma campanha paga.
- Nenhuma alteração de dados ou créditos pelo agente.
- Nenhuma alteração de DNS, credenciais ou configuração além de `VENDEO_EMAIL_ENABLED=true` e dos deploys autorizados.
