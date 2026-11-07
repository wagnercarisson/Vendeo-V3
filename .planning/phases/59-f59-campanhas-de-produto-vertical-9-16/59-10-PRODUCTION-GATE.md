# 59-10 — Gate de produção (EXECUTADO)

**Status:** deploy de produção realizado pelo responsável em 2026-11-06/07; flag
`product_9_16_enabled` **ON**; migration `20261105162052` presente no ledger
remoto. O fluxo e as telas foram validados manualmente pelo responsável. A
evidência técnica consultada e as ressalvas estão separadas abaixo.

> Este documento substitui o estado “NÃO EXECUTADO” anterior. O gate de homolog
> permaneceu separado; a produção foi promovida depois da integração de F59 +
> quick `261106-qxn`.

## 1. Estado da produção

| Campo | Registro | Origem |
|---|---|---|
| Deploy | `dpl_BBKyLDs5VFs5G9FgzusmpYHXN6Ld`, produção, `READY`, alias `vendeo.tech` | Vercel, consulta read-only |
| Horário | criado `2026-11-06 22:04:15 BRT` / `2026-11-07T01:04:15.604Z`; pronto `2026-11-06 22:06:15 BRT` / `2026-11-07T01:06:15.195Z` | Vercel |
| Commit publicado | `37bfb5277f7d48789526ef4e855cfd0dedf3e58d` — merge de F59 + quick | Vercel + Git |
| Confirmação manual | deploy realizado; fluxo e telas validados | **Responsável** |
| Flag `product_9_16_enabled` | `true`; atualizada em `2026-11-06 22:08:02 BRT` / `2026-11-07T01:08:02.454264+00:00` | Supabase, consulta read-only |
| Ativação auditada | `admin_audit_log` `a92f8fd0-...`: `feature_flag_update`, `old_value=false` → `new_value=true`, operação `b8477c83-...`, motivo “Habilitar para produção - 01” | Supabase, consulta read-only |
| Migration `20261105162052` | presente no ledger remoto; `enabled=false` na criação | `supabase migration list --linked` |
| Campanha de smoke | `fa2ebf20-43c8-4313-8e60-179ab6940bbc` — “Orquídea Phalaenopsis”, Floricultura Donna Flor | Supabase, consulta read-only |
| Operação | `e6f91009-9fb2-489e-93e0-fb0303f1623e` | Supabase |
| Formato | `9:16` / `f59-vertical-9-16-v1` | Snapshot persistido |
| Artefato | JPEG `1080×1920`; objeto presente com 455.524 B | DB + Storage info |
| Download | **não confirmado especificamente**; artefato presente; fluxo/telas confirmados manualmente | Limitação explícita |
| Crédito | 1 crédito deduzido; operação `delivered`; saldo 5 → 4 | Credit operations/transactions — **comprovado** |
| Custo calculado (usage/pricing) | US$ 0,033221 = imagem 0,033047 + copy 0,000174 | `generation_events` |
| Custo contabilizado no piloto | US$ 0,1107 = imagem 0,11 + copy 0,0007 | `product_1_1_pilot_paid_calls` |
| Custo informado pelo provider | não registrado (`provider_reported_cost_usd` nulo) | Metadata |

Apenas a campanha acima é posterior ao deploy. Campanhas anteriores da Donna Flor
são pré-deploy e não foram tratadas como smoke.

## 2. Pré-requisitos e ressalvas

1. Fora do escopo da F59: proteção contra perda de dados no reload e intenção de
   nova campanha continuam melhoria transversal separada, não implementada.
2. Caso D fechado em `error`; lacuna de auditoria do replay terminal aceita
   formalmente como exceção em `.planning/issues/59-AUDIT-REPLAY-GAP.md`
   (**não corrigida**).
3. Reels: **aceito com ressalva observada no Facebook**; não é aprovação irrestrita
   de todas as interfaces.
4. Custo permanece **calculado por usage e pricing**, não valor de fatura.
   `provider_reported_cost_usd` está nulo.
5. A migration data-only foi aplicada no homolog e em produção; o arquivo foi
   preservado sem alteração de SQL, timestamp ou nome.
6. O plano de rollback está definido; o teste de rollback em produção não foi
   executado nesta rodada.
7. O crédito foi comprovado pelo ledger (1 dedução, saldo 5 → 4). Download
   específico e fatura/custo informado pelo provider não têm confirmação técnica
   independente nesta consulta; a confirmação do responsável cobre o fluxo e as
   telas, não um evento específico de download.
8. O deploy não equivale a aceite integral de todos os cenários de produção.
   Deploy com flag OFF e smoke 1:1 não estão comprovados.

## 3. Sequência executada (histórico)

| Etapa | Ação | Evidência |
|---|---|---|
| 1 | Branch/commit e build confirmados | merge `37bfb527`; deployment `READY` |
| 2 | Deploy do código com flag OFF | **não comprovado diretamente.** `dpl_BBKy...` está `READY`; o audit log mostra `old_value=false` imediatamente antes da ativação, mas não prova o estado da flag durante o deploy. |
| 3 | Smoke 1:1 em loja de teste de produção | **não comprovado.** Nenhuma campanha 1:1 posterior ao deploy foi encontrada nesta consulta; a confirmação manual cobre fluxo/telas de forma genérica. |
| 4 | Ativação da flag por RPC auditada | **comprovada pelo `admin_audit_log`**: `feature_flag_update`, `old_value=false` → `new_value=true`, operação `b8477c83-...`, motivo e horário registrados. A chamada RPC em si não foi observada; a auditoria é a evidência disponível. |
| 5 | Smoke vertical em loja de teste | campanha `fa2ebf20...`; JPEG 1080×1920; 1 crédito **comprovado**; download específico não comprovado |
| 6 | Monitoramento de erros/custo/crédito | custo calculado e piloto registrados; custo do provider nulo; monitoramento contínuo não comprovado |
| 7 | Comunicação/rollback | deploy mantido; rollback não executado |

## 4. Rollback

- Desligar `product_9_16_enabled` pela RPC auditada com motivo.
- Reverter o deploy para o commit anterior, se necessário.
- **Não** reverter dados/ledger/Storage por rollback de código.
- Campanhas verticais já entregues permanecem consultáveis e baixáveis com a flag OFF.
- Registrar horário, ator, motivo e evidência do rollback.
- O rollback não foi executado nesta rodada.

## 5. Critérios de aborto

- Qualquer geração vertical sem arte íntegra 1080×1920.
- Cobrança dupla, crédito sem entrega ou entrega sem crédito.
- Erro de recuperação/resolução em campanha existente.
- Regressão 1:1 em payload, arte, path, crédito, download ou miniatura.
- Falha de leitura da flag ou comportamento não fail-closed.

## 6. Fora de escopo

- Migrar ou converter campanhas existentes.
- Ativar o formato para todas as lojas sem decisão de produto.
- Publicação automática em redes sociais.
- Alterar o prompt congelado, o pipeline ou o modelo.
- Filtro por formato na listagem, proteção de saída e “Limpar dados”.

## 7. Declaração

O deploy de produção foi realizado e a flag está ON. A confirmação do responsável
cobre deploy, fluxo e telas. **O crédito de 1 unidade está comprovado pelo ledger;
download específico e fatura/custo informado pelo provider não foram confirmados
por evidência técnica independente nesta consulta.** A auditoria do replay terminal
permanece como exceção aceita e não corrigida.

Checklist de integração/promoção:
`docs/operations/f59-quick-261106-qxn-promotion-checklist.md`.
O comportamento de deploy automático ao push na `main` **não foi verificado nesta
etapa** e deve ser confirmado fora desta preparação, sem alterar configurações de
publicação.
