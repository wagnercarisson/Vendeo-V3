# Phase 60 — Índice dos planos (F60: controle 9:16 em duas etapas + integração financeira)

**Fonte da verdade (arquivada):** `openspec/changes/archive/2026-11-09-product-9-16-two-stage-operation-control/` (proposta, design, specs e tasks aprovados; `--strict` OK).
**Contexto compacto:** `60-CONTEXT.md` · **Mapa de padrões:** `60-PATTERNS.md`
**Status (2026-11-09):** `60-01` **APPROVED**; `60-02` **CONCLUÍDO E APROVADO**; `60-03` **CONCLUÍDO E APROVADO — offline + Postgres (RUN 2 26/26 PASS, exit 0)**; `60-04` **CONCLUÍDO, VERIFICADO, SINCRONIZADO E ARQUIVADO**. GSD `PASS_WITH_FINDINGS` (11/11); OpenSpec **PASS** (55/55 tarefas, 35/35 requisitos); 2 specs atualizadas + 3 criadas. Quatro falhas globais conhecidas em acompanhamento separado. Produção, deploy e IA fora.

## Ondas e dependências

| Onda | Plano | Objetivo | Autônomo | Depende de |
|---|---|---|---|---|
| 1 | `60-01-PLAN.md` | Prova transacional bloqueante em homolog (schema mínimo + harness sem IA + 13 cenários + decisão) | não (checkpoint bloqueante) | — |
| 2 | `60-02-PLAN.md` | Módulo TS de controle da operação — **CONCLUÍDO E APROVADO (offline 25/25 + 8/8; Postgres 8/8)** | sim | `60-01` |
| 3 | `60-03-PLAN.md` | Integração financeira, leitura compartilhada e compatibilidade 1:1 / 9:16 direto — **CONCLUÍDO E APROVADO (offline 42/42 + 10/10; Postgres RUN 2 26/26 PASS)** | sim | `60-02` |
| 4 | `60-04-PLAN.md` | Gates finais, segurança, rastreabilidade e separação de estágios — **CONCLUÍDO, VERIFICADO, SINCRONIZADO E ARQUIVADO (GSD PASS_WITH_FINDINGS; OpenSpec PASS 55/55)** | sim | `60-03` |

**Regra dura:** `60-01`, `60-02`, `60-03` e `60-04` estão concluídos e aprovados. As quatro falhas globais conhecidas permanecem em acompanhamento separado; produção, deploy, flag e IA não foram autorizados.

## Requisitos por plano

| Requisito | Plano principal | Evidência âncora |
|---|---|---|
| REQ-60-01..07 (controle da operação) | `60-02` | tipos/cliente/serviço + testes + S03–S07 |
| REQ-60-08..13 (financeiro/leitura/origem) | `60-03` | `two-stage-financial-service` + suítes financeira/compatibilidade/origem + S01/S02/S10–S13 |
| REQ-60-14 (prova bloqueante) | `60-01` | S01–S13 + `60-01-PROOF-DECISION.md` |
| REQ-60-15 (separação de estágios) | `60-01` (início) e `60-04` (fechamento) | `60-04-STAGE-SEPARATION.md` |

## Critérios de aceite por plano

### 60-01 — Prova bloqueante — **EXECUTADO; 13/13 PASS; APPROVED**
- Baseline com alvo `127.0.0.1:57782/postgres`, ledger esperado 153 / última `20261105162052`; `F60 não aplicada` no estado anterior à execução (histórico; F60 aplicada na run `f60-20261109-02`).
- Quatro autorizações separadas (aplicar, escrever, provar, limpar) e janela de exclusividade — nenhuma presumida.
- Schema mínimo autorado: 4 tabelas, índice parcial `in_progress`, 3 views com anti-join (ativa, histórico e desfechos), `product_abandon_residual_attempts`, 5 RPCs (abertura atômica com reserva), 3 `CREATE OR REPLACE` localizados.
- 13 cenários executados com evidência persistida; abertura atômica reserva+operação, 1 crédito na entrega, 1 estorno na falha, `execute`/`query_only`, `unknown` sem retry, resposta tardia recusada, admin prevalece, origem sem duplicação, compatibilidade preservada.
- Integridade preexistente inalterada + delta esperado conferido; manifesto de cleanup com `deleted`/`retained`; `credit_transactions` append-only.
- Decisão `APPROVED`/`REJECTED` registrada; STOP duro. Em `REJECTED`, `revert_executed`/`pending_action` documentados para não deixar RPCs adaptadas ativas.
- Janela de exclusividade coordenada e registrada antes da prova, sem prazo arbitrário fixo.

### 60-02 — Módulo de controle
- Gate `APPROVED` verificado antes de qualquer código.
- Identidade durável, duas etapas, acquire/query_only, idempotência por `request_id`, base sem confirmação, continuidade, limite de expansão, política da base 2+1, `unknown` imutável, CAS de resposta tardia, retomada, estado financeiro derivado.
- Sem segunda verdade terminal, sem redesenho de RPC compartilhada.

### 60-03 — Integração financeira e leitura compartilhada
- Reserva única, expansão sem reserva, confirmação só na entrega vertical, estorno único, `delivered` não estornado, `unknown` sem estorno automático.
- Repositório e rota administrativa separam execução ativa, histórico e desfechos; origem/etapa vêm do registro canônico, inclusive entre etapas; sem segunda fila.
- Compatibilidade 1:1 e 9:16 direto idêntica antes/depois; origem canônica sem duplicação; nenhum ledger paralelo.
- Fence, epoch, assinaturas, grants, RLS e `SECURITY DEFINER search_path=''` preservados.

### 60-04 — Gates e fechamento
- Gates locais com saída literal: testes focados, compatibilidade, `tsc`, lint, build, `git diff --check`, `openspec validate --strict`, unicidade de migration.
- Revisão de segurança nos 10 itens, sem BLOQUEADOR aberto.
- 15 requisitos rastreados com veredito; lacunas explícitas.
- `60-04-STAGE-SEPARATION.md` declara que homolog **não é aceitação produtiva**; nenhum deploy/push/merge/flag/produção/chamada paga.

## Fora de escopo (não criar)

UI, flag, rota pública, seletor de formato, geração real de imagem/copy, expansor, preparação 1024→1152, armazenamento completo de artefatos, exportação, cron, fila, worker, limpeza automática, deploy, ativação, produção, refatoração dos orquestradores legados.

## Pré-condição de tracking

A Fase 60 está registrada no `.planning/ROADMAP.md` com status de planejamento concluído e execução não autorizada. O `60-01` continua exigindo autorização explícita por etapa antes de qualquer escrita em homolog.
