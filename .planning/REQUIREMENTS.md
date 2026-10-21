# Requirements: Vendeo V3

**Status operacional:** a **F56.1 — Contrato produtivo, modelos e fallback** está com **COBERTURA CONCLUÍDA** (11/11 planos GSD; UAT humano local aprovado; GSD 10/10; OpenSpec 55/55; verificada/sincronizada/arquivada em 2026-10-06 em `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/`), com os 27 REQ-IDs mapeados dos 8 specs OpenSpec da change agora arquivada.

**Estado atual:** F50 — Demonstração Gratuita e Validade dos Créditos — está concluída (17/17 planos, 17/17 summaries, 10 waves). F50.1 — Formalização Legal e Ativação da Demonstração — é futura, não ativa, ainda não planejada e aguarda a constituição da PJ. F50.1 ainda não possui REQ-IDs. F56.1 foi formalmente registrada no ROADMAP em 2026-10-05 e possui 27 REQ-IDs; a **F56.2a — Preparação não operacional do Produto 1:1** foi verificada, sincronizada e arquivada em 2026-10-07 com cobertura concluída (19 REQ-IDs; 6/6 planos, 31/31 tasks; UAT 4 pass + 1 N/A; segurança 20/20). **F56.2b1a — Fundação inativa do Produto 1:1** (GSD `56.2.1`) foi verificada, sincronizada e arquivada em **2026-10-08** com cobertura concluída (7 REQ-IDs; 6/6 planos, 23/23 tasks OpenSpec com 1.4 N/A; UAT humano aprovado/reconfirmado; segurança 14/14; snapshot final contratos 152/152 / Postgres 20/20 / gate 12/12). **F56.2b1b — Núcleo entregável do Produto 1:1** (GSD `56.2.2`) foi **concluída** (10/10 planos; 39/39 tasks OpenSpec com 7.5 N/A; UAT humano aprovado 2026-10-12; matriz 13/13 REQ) e **verificada/sincronizada/arquivada** em **2026-10-12** em `openspec/changes/archive/2026-10-12-fase-56-2b1b-nucleo-entregavel-produto-1-1/`, com **cobertura concluída** (escopo INATIVO; D13 = gate bloqueante da b2). **F56.2b2 foi dividida em três fatias aprovadas** (B2.1/B2.2/B2.3); a **B2.1 — Recuperação de copy** (GSD `56.2.3`, `REQ-56.2.3-01..10`) foi **concluída (INATIVA) em 2026-10-15**, **verificada, sincronizada e arquivada** (46/46 tasks) com **cobertura concluída** (ver §F56.2b2a); a **B2.2 — Recuperação de imagem, estorno e D13** (GSD `56.2.4`, `REQ-56.2.4-01..11`) foi **concluída (INATIVA) em 2026-10-16** (10/10 planos; checkpoint `approved_with_limitations`; **OpenSpec verificado/sincronizado/arquivado — 45/45 tasks; archive `openspec/changes/archive/2026-10-16-fase-56-2b2b-recuperacao-de-imagem-estorno-e-d13-produto-1-1/`**); **B2.3 — Autorização estreita e teste real controlado do Produto 1:1** (GSD `56.2.5`, `REQ-56.2.5-01..12`) foi **concluída (LOCAL/INATIVA) em 2026-10-17** (4/4 planos): piloto pago **N=1** executado e aprovado na `vendeo-homolog` (campanha `20d54b1d…`, operação `355cc9bb…`); **indicadores de progresso implementados e aprovados visualmente** (reprodução controlada, sem provider); **D13 atendido somente no piloto local**; **sign-off B2.1 aprovado (escopo inativo)**; **lifecycle OpenSpec CONCLUÍDO (2026-10-17) — verify → sync → archive em `openspec/changes/archive/2026-10-17-fase-56-2b2c-autorizacao-estreita-e-teste-real-produto-1-1/`; 29/29 tasks com disposição (não todas executadas)**; **próxima ação: revisar e realinhar a base B2.3 — sem iniciar planejamento/execução**.

Este arquivo é um índice operacional, não uma tabela histórica. Checkboxes, tabelas e estados legados foram preservados integralmente em [`REQUIREMENTS-ARCHIVE.md`](./REQUIREMENTS-ARCHIVE.md) e não devem ser interpretados como pendências atuais.

**F51.1/F51.2/F51.3 — concluída, verificada, sincronizada e arquivada na branch local (2026-10-21) — não publicada.** Integração `12b39ae4`; correção MD-01 `bad3ce14`; sync/archive `9ac7a66e`. **12/12 requisitos**; MD-01 resolvido **após** a verificação inicial (4/4 teste real, 24/258, typecheck/lint 0), com cronologia preservada. Archive: `openspec/changes/archive/2026-10-21-integracao-landing-app-atual/`; spec principal `openspec/specs/landing-app-integration/spec.md` válida. **Pendências preservadas:** quatro falhas externas F56 (128/4; suíte não declarada verde), follow-up canonical/OG `http://localhost:3000`, observações Low/Info e futura avaliação de elegibilidade por CNPJ completo. F50.2/F56 preservados; sem merge para `main`, push, deploy ou tag.

## Índice Histórico

| Namespace / período | Fonte autoritativa atual |
|---|---|
| Requisitos legados v1.0–v1.2 | `.planning/milestones/*-REQUIREMENTS.md` e OpenSpec arquivado correspondente |
| F23–F30: fundação, pipeline, operação e base legal | `.planning/phases/23-*` a `.planning/phases/30-*`, summaries/verificações e `openspec/changes/archive/` |
| F31.1–F35: modelo comercial, elegibilidade, readiness e changelog | `.planning/phases/31-*` a `.planning/phases/35-*`, summaries/verificações e OpenSpec arquivado |
| F36–F43: onboarding, aprovação, custos, brief, mídia e signup | `.planning/phases/36-*` a `.planning/phases/43-*`, summaries/verificações e OpenSpec arquivado |
| F44.1.1, F45–F49: temas, direção de arte, gateway, catálogo, laboratório e orientação | `.planning/phases/44-*` a `.planning/phases/49-*`, summaries/verificações e OpenSpec arquivado |
| F50: demonstração gratuita e validade dos créditos | `.planning/phases/50-demonstracao-gratuita-validade-creditos/`, `50-VERIFICATION.md`, summaries e `openspec/changes/archive/2026-09-23-fase-50-demonstracao-gratuita-e-validade-dos-creditos/` |
| F50.1: formalização legal e ativação | Futura; fonte de planejamento será um novo plano/OpenSpec quando a fase for formalmente constituída |
| F50.2: oferta de teste gratuito de 28 dias | Planejada; 3 planos em `.planning/phases/50.2-oferta-teste-gratuito-28-dias/`; fonte ativa `openspec/changes/oferta-teste-gratuito-28-dias/` |
| F56.1: contrato produtivo, modelos e fallback | Cobertura concluída abaixo; fonte arquivada `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/` |
| F56.2a: preparação não operacional do Produto 1:1 | Cobertura concluída abaixo; fonte arquivada `openspec/changes/archive/2026-10-07-fase-56-2a-preparacao-nao-operacional-produto-1-1/` |
| F56.2b1a: fundação inativa do Produto 1:1 | Cobertura concluída abaixo; fonte arquivada `openspec/changes/archive/2026-10-08-fase-56-2b1a-fundacao-inativa-produto-1-1/` |
| F56.2b1b: núcleo entregável do Produto 1:1 | Cobertura concluída; concluída/verificada/sincronizada/arquivada em 2026-10-12; fonte arquivada `openspec/changes/archive/2026-10-12-fase-56-2b1b-nucleo-entregavel-produto-1-1/` |
| F56.2b2a (B2.1): recuperação de copy do Produto 1:1 | Cobertura concluída; concluída/verificada/sincronizada/arquivada em 2026-10-15 (46/46 tasks); fonte arquivada `openspec/changes/archive/2026-10-15-fase-56-2b2a-recuperacao-de-copy-produto-1-1/` |
| Monetização pública / Stripe | Iniciativa diferida para v1.7+, fora da numeração e sem requisitos ativos |

## F50.2 — Planejada (Oferta de teste gratuito de 28 dias)

**Fonte ativa:** `openspec/changes/oferta-teste-gratuito-28-dias/` (proposal, design, 4 specs, tasks; `validate --strict` valid). **Planos:** `50.2-01..03` em `.planning/phases/50.2-oferta-teste-gratuito-28-dias/`. **Status:** planejada, não executada; nenhuma aplicação em produção. Token `50.2` porque `50.1` está reservada à formalização legal/PJ.

| REQ-ID | Cobertura | Plano |
|---|---|---|
| REQ-50.2-01 | Chave `enabled` + `launch_at` imutável na primeira ativação; auditoria existente | 01 |
| REQ-50.2-02 | Elegibilidade por `auth.users.created_at`, raiz, loja de teste e benefício anterior | 01 |
| REQ-50.2-03 | Enrollment por beneficiário; unicidade por raiz/loja; início/vencimento/oferta | 01 |
| REQ-50.2-04 | Conclusão do onboarding; readiness; `onboarding_completed_at`; rotas reais | 01/02 |
| REQ-50.2-05 | Falha repetível (`retryable_failure`), distinção antes/depois da conclusão, janela vencida | 01/02/03 |
| REQ-50.2-06 | Quatro concessões fixas de 5; máximo 20; intervalos de 24h | 01 |
| REQ-50.2-07 | Episódio demo compartilhado; origem/ciclo/vencimento/contribuintes | 01 |
| REQ-50.2-08 | Idempotência, concorrência, recuperação e cron existente | 01/02/03 |
| REQ-50.2-09 | Expiração, estorno, graça de 24h e preservação de comprados/bônus | 01/03 |
| REQ-50.2-10 | Precedência com demo legada; chave desligada sem fallback | 01/03 |
| REQ-50.2-11 | Exclusão mensal permanente por enrollment; legado intacto | 01/03 |
| REQ-50.2-12 | UI/status/próxima parcela/cron diário/retry/pós-teste | 02/03 |

## F50.3 — Planejada (Compatibilidade integral com CNPJ alfanumérico)

**Fonte ativa:** `openspec/changes/fase-50-3-suporte-cnpj-alfanumerico/` (proposal, design, 7 delta specs, tasks; `validate --strict` valid). **Planos:** `.planning/phases/50.3-f50-3-compatibilidade-integral-com-cnpj-alfanumerico/`. **Status:** planejada, não executada; sem implementação, migration aplicada, deploy ou push.

| REQ-ID | Cobertura | Plano |
|---|---|---|
| REQ-50.3-01 | Normalização canônica estrita, DV oficial, hash de raiz e mascaramento fail-closed | 01 |
| REQ-50.3-02 | Inputs e formatadores fail-closed; erro local, bloqueio de lookup/submissão, autosave e respostas em voo | 04, 05 |
| REQ-50.3-03 | Provedores com capacidade alfanumérica, 404 ambíguo, fallback seguro e cache canônico sem falso not_found | 02 |
| REQ-50.3-04 | APIs, schemas e contratos de criação/atualização/reconsulta/lookup/admin aceitam o formato canônico | 03 |
| REQ-50.3-05 | Persistência atômica, constraint PostgreSQL e migration fail-closed sem reescrever dados | 06 |
| REQ-50.3-06 | Preservação de unicidade global, raiz/hash, freemium legado, F50.2, ownership, RLS, saldos e enrollments | 03, 05 |
| REQ-50.3-07 | Testes contratuais dos provedores distinguem mocks de evidência real; sem provedor pago ou flag | 02 |
| REQ-50.3-08 | Migration e provas em PostgreSQL local isolado com destino fixado, pré/pós-checagem e rollback documentado | 06 |
| REQ-50.3-09 | Regressão numérica e cobertura de criação, atualização, reconsulta, cache hit/miss, duplicidade e erros | 01, 07 |
| REQ-50.3-10 | Validação automática separada da aprovação visual humana; limitação 0001 registrada; F50.4 fora de escopo | 07 |

## F56.1 — Cobertura concluída (Contrato produtivo, modelos e fallback)

**Fonte (arquivada):** `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/` (8 specs). **Status:** COBERTURA CONCLUÍDA da F56.1 — 11/11 planos, UAT humano local aprovado, GSD 10/10, OpenSpec 55/55, verificada/sincronizada/arquivada em 2026-10-06 em `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/`. Cada requirement OpenSpec abaixo mapeia para um REQ-ID usado no frontmatter `requirements` dos planos e no gate de cobertura (todos concluídos).

| REQ-ID | Requirement (OpenSpec) | Spec |
|--------|------------------------|------|
| REQ-56.1-01 | Configuração global de par principal e fallback (modelo + qualidade) | image-generation-model-pair-config |
| REQ-56.1-02 | Catálogo elegível fechado de pares modelo–qualidade | image-generation-model-pair-config |
| REQ-56.1-03 | Escolha inicial registrada como decisão humana expressa | image-generation-model-pair-config |
| REQ-56.1-04 | Persistência auditável com RPC | image-generation-model-pair-config |
| REQ-56.1-05 | Leitura server-only e invalidação de cache | image-generation-model-pair-config |
| REQ-56.1-06 | Tratamento fail-closed de configuração inválida | image-generation-model-pair-config |
| REQ-56.1-07 | Isolamento do fluxo legado | image-generation-model-pair-config |
| REQ-56.1-08 | Snapshot imutável da configuração por campanha | image-generation-config-snapshot |
| REQ-56.1-09 | Alteração posterior do admin não muda o passado | image-generation-config-snapshot |
| REQ-56.1-10 | Correlação do snapshot com a telemetria | image-generation-config-snapshot |
| REQ-56.1-11 | Tolerância a operações legadas sem snapshot | image-generation-config-snapshot |
| REQ-56.1-12 | Taxonomia de falhas elegíveis e não elegíveis | image-generation-failure-policy |
| REQ-56.1-13 | Política de execução com teto de chamadas | image-generation-failure-policy |
| REQ-56.1-14 | Rate limit é transitório | image-generation-failure-policy |
| REQ-56.1-15 | Disponibilidade/capacidade aciona fallback sem repetição inútil | image-generation-failure-policy |
| REQ-56.1-16 | Falha técnica não é cobrada do lojista | image-generation-failure-policy |
| REQ-56.1-17 | Resposta pública identificável com código e referência | image-generation-support-reference |
| REQ-56.1-18 | A mensagem pública não revela o motivo interno | image-generation-support-reference |
| REQ-56.1-19 | Correlação segura no admin/suporte | image-generation-support-reference |
| REQ-56.1-20 | Referência não é credencial nem dado sensível | image-generation-support-reference |
| REQ-56.1-21 | Propagação da qualidade até o adapter | image-generation-instrumentation |
| REQ-56.1-22 | Observabilidade por tentativa (modelo–qualidade) | image-generation-instrumentation |
| REQ-56.1-23 | Cálculo de custo por par modelo–qualidade | image-generation-instrumentation |
| REQ-56.1-24 | Registro dos modelos elegíveis em capacidade própria do novo fluxo | ai-model-catalog |
| REQ-56.1-25 | Dimensão de qualidade no pricing de imagem (aditiva) | ai-model-pricing |
| REQ-56.1-26 | Cobertura de pricing ciente de qualidade para os pares elegíveis | ai-model-pricing |
| REQ-56.1-27 | Envelope de telemetria registra o par modelo–qualidade | ai-invocation-gateway |

## F56.2a — Cobertura concluída (Preparação não operacional do Produto 1:1)

**Fonte arquivada:** `openspec/changes/archive/2026-10-07-fase-56-2a-preparacao-nao-operacional-produto-1-1/` (5 specs principais sincronizadas: 2 atualizadas + 3 criadas). **Status:** COBERTURA CONCLUÍDA — 6/6 planos e summaries; 31/31 tasks OpenSpec; UAT 4 pass + 1 N/A; segurança 20/20 ameaças fechadas, 0 abertas; change verificada, sincronizada e arquivada em 2026-10-07. A anomalia do reset final (exit 1 / HTTP 502, causa desconhecida) permanece warning operacional, não sucesso de reset, e deve ser investigada antes de depender do procedimento na F56.2b1. F56.2a permaneceu inativa: sem rota/provider/crédito/entrega/download real.

| REQ-ID | Requirement (OpenSpec) | Spec |
|--------|------------------------|------|
| REQ-56.2a-01 | Estrutura das duas chaves de ativação, desligadas por padrão | product-1-1-flow-activation |
| REQ-56.2a-02 | Decisão server-side pura e fail-closed | product-1-1-flow-activation |
| REQ-56.2a-03 | Precedência determinística entre as chaves (geral prevalece) | product-1-1-flow-activation |
| REQ-56.2a-04 | Barreira de não-ativação nesta fatia | product-1-1-flow-activation |
| REQ-56.2a-05 | Contratos de seleção explícita de intenção | product-1-1-intent-background-selection |
| REQ-56.2a-06 | Contratos e componentes de direção de fundo | product-1-1-intent-background-selection |
| REQ-56.2a-07 | "Manter cenário original" exige exatamente uma imagem de produto (identidade não conta) | product-1-1-intent-background-selection |
| REQ-56.2a-08 | Validação de seleção como erro de campo (nunca `IMG-001`) | product-1-1-intent-background-selection |
| REQ-56.2a-09 | Componentes inativos não expostos ao lojista | product-1-1-intent-background-selection |
| REQ-56.2a-10 | Incorporação versionada e congelada dos prompts e regras aprovados (Produto v4/compositor v5) | product-1-1-prompt-composition |
| REQ-56.2a-11 | Conteúdo obrigatório do prompt | product-1-1-prompt-composition |
| REQ-56.2a-12 | Sem troca silenciosa da intenção | product-1-1-prompt-composition |
| REQ-56.2a-13 | Equivalência com a bancada aprovada (F48.2.6) | product-1-1-prompt-composition |
| REQ-56.2a-14 | Bancada não é dependência de runtime | product-1-1-prompt-composition |
| REQ-56.2a-15 | Estrutura append-only de operações/tentativas vinculada à campanha e ao snapshot original | image-generation-config-snapshot |
| REQ-56.2a-16 | Contrato de reuso do snapshot original | image-generation-config-snapshot |
| REQ-56.2a-17 | Não sobrescrever o run/trace histórico | image-generation-config-snapshot |
| REQ-56.2a-18 | Registro das duas chaves de ativação com default fail-closed | feature-flag-control |
| REQ-56.2a-19 | Alteração auditável das chaves pela RPC existente | feature-flag-control |

## F56.2b1a — Cobertura concluída (Fundação inativa)

**Fonte (arquivada):** `openspec/changes/archive/2026-10-08-fase-56-2b1a-fundacao-inativa-produto-1-1/`. **Status:** COBERTURA CONCLUÍDA — 6/6 planos e summaries; 23/23 tasks OpenSpec (task 1.4 N/A — gate aprovado); UAT humano aprovado e reconfirmado; segurança 14/14 ameaças fechadas, 0 abertas; snapshot final contratos **152/152** · Postgres **20/20** · gate **12/12** (verificação independente de escopo distinto: 128/128); verificada/sincronizada/arquivada em 2026-10-08. Duas specs principais sincronizadas: `product-1-1-flow-activation` (2 requirements adicionados) + `product-1-1-campaign-credit-billing` (criada). Stage `off`; flags `false`; nenhuma concessão habilitadora; sem `db push`/reset/provider/ativação.

| REQ-ID | Requirement (OpenSpec) | Spec / origem | Plano(s) |
|--------|------------------------|---------------|----------|
| REQ-56.2b1a-01 | Diagnóstico somente leitura e gate verificável de identidade, isolamento, serviços e schema | Proposal critérios 1; design A1; tasks 1.1–1.4 | 56.2.1-01 |
| REQ-56.2b1a-02 | Autorização independente server-side, auditada e validada junto à flag aplicável após leituras válidas de ambas | product-1-1-flow-activation — Autorização independente e flags aplicáveis | 56.2.1-02 |
| REQ-56.2b1a-03 | Concessão operacional habilitadora bloqueada em b1a; testes de estágios por fixtures/harness sem ativação | product-1-1-flow-activation — Concessão operacional bloqueada nesta change | 56.2.1-02 |
| REQ-56.2b1a-04 | Payload incompatível recusado antes de crédito, preservando compatibilidade legada | Proposal critério 4; design A3; tasks 3.1–3.3 | 56.2.1-03 |
| REQ-56.2b1a-05 | Reserva reduz saldo temporariamente; `delivered` finaliza consumo e `refunded` restaura a reserva | product-1-1-campaign-credit-billing — Reserva temporária e cobrança final | 56.2.1-04, 56.2.1-05 |
| REQ-56.2b1a-06 | Transições CAS/idempotentes, concorrência por identidade e terminalidade de `delivered` | product-1-1-campaign-credit-billing — Concorrência e transições CAS | 56.2.1-04, 56.2.1-05 |
| REQ-56.2b1a-07 | Prova Postgres real de atomicidade/rollback/concorrência após gate aprovado; migrations b1a somente na instância local aprovada, sem `db push` | product-1-1-campaign-credit-billing — Testes Postgres reais; design A1/A5; tasks 4.5–4.6 | 56.2.1-01, 56.2.1-05 |

## F56.2b1b — Cobertura concluída (Núcleo entregável do Produto 1:1)

**Fonte (arquivada):** `openspec/changes/archive/2026-10-12-fase-56-2b1b-nucleo-entregavel-produto-1-1/` (proposal, design B1B-D1..**D13**, tasks §0–§7, 11 specs e `TRACEABILITY.md`). **Status:** **COBERTURA CONCLUÍDA** — **concluída, verificada, sincronizada e arquivada** em 2026-10-12 (10/10 planos; 39/39 tasks OpenSpec com 7.5 N/A; UAT humano aprovado 9/9; matriz 13/13 REQ; lifecycle `/opsx-verify` → `/opsx-sync` 11/11 valid → `/opsx-archive`). Flags `false`; autorização `off`; nenhuma loja habilitada. **Decisão D13 — risco explicitamente aceito apenas na entrega inativa da b1b:** sem fonte operacional comprovada de encerramento, a resolução de claim `in_progress` residual permanece **bloqueada** (sem estorno, sem nova geração, sem retomada); **recuperabilidade completa não é declarada**; **evidência simulada (harness/fake) ≠ prova operacional**; **GATE OBRIGATÓRIO (bloqueante) antes do piloto/habilitação da b2** (comprovar **estratégia operacional segura de resolução de claims residuais**; plano/limites pode sustentar, mas isoladamente **não satisfaz**; evidência simulada não substitui comprovação operacional — Vercel Hobby / Supabase Free **informados**, limites **não verificados**). Os REQ-IDs abaixo têm **cobertura concluída** (escopo INATIVO; D13 = gate bloqueante da b2). Rastreabilidade detalhada por requisito OpenSpec em `TRACEABILITY.md`.

| REQ-ID | Requirement (OpenSpec) | Spec / origem | Tasks |
|--------|------------------------|---------------|-------|
| REQ-56.2.2-01 | Elegibilidade server-side; sem controles/campos em `off`; POST revalida e recusa antes de crédito; legado intacto | product-1-1-flow-activation; product-1-1-intent-background-selection | §1.1–1.6 |
| REQ-56.2.2-02 | Snapshot congelado antes da reserva/provider; tentativas append-only reconstruíveis | image-generation-config-snapshot; product-1-1-generation-orchestration | §2.1–2.2 |
| REQ-56.2.2-03 | Preflight exige pricing `complete` (principal `sunburst/medium` + fallback `image-2/medium`); política 2+1; sem revisor automático | product-1-1-generation-orchestration; image-generation-failure-policy; image-generation-model-pair-config | §2.3–2.5 |
| REQ-56.2.2-04 | Reserva temporária reduz saldo; só `delivered` consome e libera download; um crédito por entrega; sem cobrança por tentativa técnica | product-1-1-campaign-credit-billing | §3.3 |
| REQ-56.2.2-05 | Duas requisições simultâneas não chamam o provider duas vezes (início de tentativa atômico no Postgres, sem fila/cron/worker) | product-1-1-generation-orchestration | §3.1 |
| REQ-56.2.2-06 | Reenvio apenas consulta; recupera arte salva; resultado desconhecido não chama o modelo; não inicia tentativa/geração/cobrança | product-1-1-generation-orchestration; product-1-1-campaign-credit-billing; product-1-1-artifact-delivery | §3.2 |
| REQ-56.2.2-07 | Falha confirmada → `refunded` uma vez; resultado desconhecido sem repetição cega nem estorno por timeout; UI sem "Gerar novamente" | image-generation-failure-policy; product-1-1-campaign-credit-billing; product-1-1-flow-activation | §5.1–5.3 |
| REQ-56.2.2-08 | Resolução por administrador autorizado, motivo obrigatório e auditoria atômica (entregar ou estornar uma vez); lista de pendências sem re-queue/chamada automática | product-1-1-generation-orchestration; product-1-1-campaign-credit-billing | §5.4 |
| REQ-56.2.2-09 | Campanha concluída persistida/recuperável ao retornar; sem retomada de processamento | product-1-1-flow-activation | §0, §6.4, §7.4 |
| REQ-56.2.2-10 | Arte 1024×1024 em Storage privado, caminho imutável; download só após `delivered`; legado preservado | product-1-1-artifact-delivery | §3.4–3.7 |
| REQ-56.2.2-11 | Copy não bloqueante; sem retry; estados persistidos; cancelamentos separados | product-1-1-copy-recovery | §4.1–4.2 |
| REQ-56.2.2-12 | Instrumentação, custo por tentativa, `IMG-001` + diagnóstico durável sem expor motivo interno | image-generation-instrumentation; image-generation-support-reference | §4.3–4.4 |
| REQ-56.2.2-13 | Testes isolados (provider simulado + Postgres/Storage reais), sem bypass de autorização; flags/autorização `off`, nenhuma loja, sem `db push`/deploy/chamada paga | Proposal critérios 12–13 | §6.1–6.4, §7.1–7.4 |

## F56.2b2a — Cobertura concluída (B2.1 — Recuperação de copy do Produto 1:1; INATIVA)

**Fonte (arquivada):** `openspec/changes/archive/2026-10-15-fase-56-2b2a-recuperacao-de-copy-produto-1-1/` — proposal, design **B2A-D1..D6**, spec `product-1-1-copy-recovery` (**2 MODIFIED + 8 ADDED = 10 requirements**), tasks §1–§5 e UI-SPEC. **Status:** **COBERTURA CONCLUÍDA em 2026-10-15** para a entrega **INATIVA** (fase GSD `56.2.3`, 6/6 planos; UAT humano aprovado no escopo inativo; review HIGH/MEDIUM resolvidos `7dee0866`; security 69/69; backfill PASS em instância separada). Depende da F56.2b1b (arquivada em 2026-10-12). **B2.2** (`fase-56-2b2b-...`) e **B2.3** (`fase-56-2b2c-...`) foram **concluídas (INATIVA/LOCAL)** — B2.2 em 2026-10-16 (OpenSpec arquivado) e B2.3 em 2026-10-17 (piloto pago N=1 aprovado; indicadores aprovados; **lifecycle OpenSpec separado/pendente**); **D13** = gate da fatia de imagem/habilitação; lifecycle OpenSpec CONCLUÍDO em 2026-10-15 (verify → sync → archive; **46/46 tasks**; change arquivada em `openspec/changes/archive/2026-10-15-fase-56-2b2a-recuperacao-de-copy-produto-1-1/`).

Os 10 REQ-IDs abaixo derivam dos **10 requirements normativos** do spec `product-1-1-copy-recovery` (não dos critérios do proposal) e estão vinculados aos **10 critérios de aceite verificáveis** do proposal. *(Erratum documental 2026-10-13: a `RECONCILIATION.md` da base dizia "ADDED (7)"; corrigida para "ADDED (8)" — apenas contagem, sem mudança de escopo.)*

| REQ-ID | Requirement (OpenSpec `product-1-1-copy-recovery`) | Tipo | Critérios de aceite | Tasks |
|--------|---------------------------------------------------|------|---------------------|-------|
| REQ-56.2.3-01 | Falha de copy não bloqueia arte entregue: arte `delivered` permanece acessível; sem crédito adicional | MODIFIED | 1, 7, 9 | §3.4, §3.7, §4.1 |
| REQ-56.2.3-02 | Estados persistidos e feedback seguro; sem retomada automática; ação manual + suporte após esgotar as automáticas; cancelamento separado | MODIFIED | 2, 4 | §3.1, §3.8, §4.1 |
| REQ-56.2.3-03 | Ação de nova tentativa somente no estado pendente/falha; copy entregue encerra a recuperação | ADDED | 1 | §2.8, §3.1 |
| REQ-56.2.3-04 | Ação autenticada com ownership; sem ownership, negada sem chamada de IA | ADDED | 8 | §3.6, §4.1 |
| REQ-56.2.3-05 | Recuperação tenta somente os textos (`campaign_copy`); não regenera/altera a imagem; sem novo crédito | ADDED | 7, 9 | §3.4, §3.5 |
| REQ-56.2.3-06 | Política por tentativas: 1ª 30s; transitória → 5s → 2ª 30s; transitória → 10s → 3ª 30s; máx. 3 manuais (6 total); clique = 1 tentativa; sucesso encerra; falha definitiva sem repetição cega | ADDED | 2, 3, 6 | §2.4–§2.7 |
| REQ-56.2.3-07 | Tentativas identificadas (`attempt_seq`+`attempt_token`), histórico preservado, `stale_attempt`, terminal não sobrescrito | ADDED | 5 | §2.2, §3.2 |
| REQ-56.2.3-08 | Anti-duplicação e contabilização: clique duplo/reload/reenvio não duplicam nem reiniciam; chamadas técnicas/fallback contabilizadas | ADDED | 4 | §3.1, §3.3 |
| REQ-56.2.3-09 | Registro de custo interno sem crédito ao lojista | ADDED | 7 | §3.5 |
| REQ-56.2.3-10 | Recuperação de copy independente do estado da imagem (`delivered`), sem tocar operação financeira/arte | ADDED | 9 | §3.7, §4.1 |

## F56.2b2b — Planejamento (B2.2 — Recuperação de imagem, estorno e D13 do Produto 1:1; INATIVA)

**Fonte:** `openspec/changes/fase-56-2b2b-recuperacao-de-imagem-estorno-e-d13-produto-1-1/` (base aprovada em `b2edfb5b`) — proposal (17 critérios de aceite), design **B2B-D1..D9** (decisão **A-1 = 4a**), tres specs (`product-1-1-artifact-delivery` 1 MODIFIED + 2 ADDED; `product-1-1-campaign-credit-billing` 1 MODIFIED + 5 ADDED; `product-1-1-generation-orchestration` 1 MODIFIED + 2 ADDED = **12 requirements**; o requirement do fence de publicação mapeia-se aos REQ-IDs existentes, sem novo REQ-ID), tasks §1–§6 e **UI-SPEC APROVADA**. **Status:** **CONCLUÍDA (INATIVA) em 2026-10-16** na fase GSD **`56.2.4`** — **10/10 planos** (base OpenSpec aprovada em `b2edfb5b`; `gsd-plan-checker` 0 blockers após revisão), incluindo os reparos **08** (fence de publicação — CR-01/SEC-01), **09** (recuperação alcançável + terminal do iniciador — CR-02/CR-03) e **10** (fidelidade da restauração + ferramentas — WR-01..04/SEC-04/SEC-05/UF-01). **Checkpoint humano `approved_with_limitations`** (escopo **exclusivamente INATIVO/LOCAL**; inspeção visual adicional dos reparos **não** realizada; sem produção/ativação/provider real). Gates: typecheck/lint/build **0**; Camada 1 **711**; render **551**; Camada 2 isolada **99 + 9 (fence), 0 skipped**; `openspec validate --strict` **valid**; `git diff --check` limpo. **Gates INDEPENDENTES** reexecutados (code review **0 high/critical**; segurança **0 high/critical open**; achados anteriores **RESOLVED**). Migrations **LOCAL-ONLY** aplicadas só na instância isolada. **OpenSpec verificado/sincronizado/arquivado (45/45 tasks; archive `openspec/changes/archive/2026-10-16-fase-56-2b2b-recuperacao-de-imagem-estorno-e-d13-produto-1-1/`; commits `e148dc94`/`f628f724`/`aa8477e7`/`b526256d`).** **D13 NÃO resolvido** — gate bloqueante preservado; **sign-off de segurança B2.1 separado/pendente**; **B2.3/F56.3 NÃO iniciados**.

Os 11 REQ-IDs abaixo derivam dos **11 requirements normativos** das tres specs (nao dos criterios do proposal) e estao vinculados aos **17 criterios de aceite verificaveis** do proposal.

| REQ-ID | Requirement (OpenSpec B2.2) | Spec / Tipo | Criterios de aceite | Tasks |
|--------|-----------------------------|-------------|---------------------|-------|
| REQ-56.2.4-01 | Sem entrega sem arte íntegra e reenvio recupera arte salva | artifact-delivery MODIFIED | 1, 2, 8 | §2.1–§2.4 |
| REQ-56.2.4-02 | Recuperação da arte no Storage privado | artifact-delivery ADDED | 1, 8, 9 | §2.1–§2.3 |
| REQ-56.2.4-03 | Recuperação não regenera a imagem | artifact-delivery ADDED | 1 | §2.2 |
| REQ-56.2.4-04 | Falha confirmada e resultado desconhecido | credit-billing MODIFIED | 2, 3, 4, 8 | §3.1–§3.3 |
| REQ-56.2.4-05 | Encerramento local com estorno confirmado | credit-billing ADDED | 3, 4, 5, 15, 16 | §3.2–§3.7 |
| REQ-56.2.4-06 | Estorno idempotente e corrida entrega × estorno | credit-billing ADDED | 10 | §4.1–§4.2 |
| REQ-56.2.4-07 | Resultado atrasado de operação estornada não reabre nem libera | credit-billing ADDED | 9, 11 | §4.5, §4.6 |
| REQ-56.2.4-08 | Falha de Storage/banco não autoriza estorno nem anúncio de crédito | credit-billing ADDED | 8 | §2.4, §4.3 |
| REQ-56.2.4-09 | Limitação aceita da b1b e gate obrigatório antes da b2 | generation-orchestration MODIFIED | 12, 13, 17 | §6.1, §6.2 |
| REQ-56.2.4-10 | Recuperação server-side de operação sem delivered | generation-orchestration ADDED | 2, 3, 5, 6, 7, 14 | §3.x, §4.1–§4.7 |
| REQ-56.2.4-11 | Resultado atrasado não libera nem sobrescreve | generation-orchestration ADDED | 11 | §3.7, §4.6 |

## Regras Operacionais

- Os REQ-IDs cobertos são os da F56.1 (`REQ-56.1-01`..`REQ-56.1-27`, cobertura concluída em 2026-10-06), os da F56.2a (`REQ-56.2a-01`..`REQ-56.2a-19`, cobertura concluída em 2026-10-07) e os da F56.2b1a (`REQ-56.2b1a-01`..`REQ-56.2b1a-07`, cobertura concluída em 2026-10-08). A **F56.2b1b** (`REQ-56.2.2-01`..`REQ-56.2.2-13`, ver §F56.2b1b acima) foi **concluída** e tem **cobertura concluída** em 2026-10-12 (10/10 planos; 39/39 tasks OpenSpec com 7.5 N/A; verificada/sincronizada/arquivada). A **F56.2b2** foi dividida em B2.1/B2.2/B2.3; a **B2.1** (GSD `56.2.3`, `REQ-56.2.3-01..10`, ver §F56.2b2a) foi **concluída (INATIVA) em 2026-10-15**, **verificada, sincronizada e arquivada** (46/46 tasks) com **cobertura concluída** (6/6 planos; UAT humano aprovado no escopo inativo; review HIGH/MEDIUM resolvidos; security 69/69); a **B2.2** (GSD `56.2.4`, `REQ-56.2.4-01..11`, ver §F56.2b2b) foi **CONCLUÍDA (INATIVA) em 2026-10-16** (10/10 planos; checkpoint `approved_with_limitations`; gates independentes 0 high/critical; **OpenSpec verificado/sincronizado/arquivado — 45/45 tasks**); a **B2.3** (GSD `56.2.5`, `REQ-56.2.5-01..12`) foi **CONCLUÍDA (LOCAL/INATIVA) em 2026-10-17** (4/4 planos; piloto pago N=1 aprovado; indicadores aprovados visualmente; D13 só no piloto local; sign-off B2.1 aprovado no escopo inativo; **lifecycle OpenSpec = etapa separada**); F56.3 permanece futura.
- Novos REQ-IDs só devem ser adicionados quando uma nova fase for formalmente planejada, com fonte em OpenSpec e plano aprovado.
- Para uma fase concluída, consultar o OpenSpec arquivado, `VERIFICATION.md`, `SUMMARY.md`, contexto e planos da fase.
- Em caso de divergência histórica, OpenSpec arquivado + `VERIFICATION.md`/`SUMMARY.md` da fase prevalecem sobre este archive e sobre registros antigos.
- O status de fase e a continuidade operacional estão em `.planning/ROADMAP.md` e `.planning/STATE.md`.

## Referências

- Snapshot integral anterior à compactação: `.planning/REQUIREMENTS-ARCHIVE.md`.
- Índice de fases e estado atual: `.planning/ROADMAP.md` e `.planning/STATE.md`.
- Planos, contextos, summaries e verificações: `.planning/phases/`.
- Quick plans e summaries: `.planning/quick/`.
- Propostas, specs e tasks arquivadas: `openspec/changes/archive/`.
- Auditorias e decisões históricas: `.planning/` e `docs/`.
