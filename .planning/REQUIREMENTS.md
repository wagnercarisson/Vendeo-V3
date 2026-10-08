# Requirements: Vendeo V3

**Status operacional:** a **F56.1 — Contrato produtivo, modelos e fallback** está com **COBERTURA CONCLUÍDA** (11/11 planos GSD; UAT humano local aprovado; GSD 10/10; OpenSpec 55/55; verificada/sincronizada/arquivada em 2026-10-06 em `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/`), com os 27 REQ-IDs mapeados dos 8 specs OpenSpec da change agora arquivada.

**Estado atual:** F50 — Demonstração Gratuita e Validade dos Créditos — está concluída (17/17 planos, 17/17 summaries, 10 waves). F50.1 — Formalização Legal e Ativação da Demonstração — é futura, não ativa, ainda não planejada e aguarda a constituição da PJ. F50.1 ainda não possui REQ-IDs. F56.1 foi formalmente registrada no ROADMAP em 2026-10-05 e possui 27 REQ-IDs; a **F56.2a — Preparação não operacional do Produto 1:1** foi verificada, sincronizada e arquivada em 2026-10-07 com cobertura concluída (19 REQ-IDs; 6/6 planos, 31/31 tasks; UAT 4 pass + 1 N/A; segurança 20/20). **F56.2b1a** está planejada em GSD `56.2.1`, com 7 REQ-IDs mapeados abaixo e planos aguardando revisão humana; sua primeira etapa depende da investigação read-only/gate HTTP 502. F56.2b1b e F56.2b2 permanecem fora do planejamento atual e sem cobertura atribuída.

Este arquivo é um índice operacional, não uma tabela histórica. Checkboxes, tabelas e estados legados foram preservados integralmente em [`REQUIREMENTS-ARCHIVE.md`](./REQUIREMENTS-ARCHIVE.md) e não devem ser interpretados como pendências atuais.

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
| F56.1: contrato produtivo, modelos e fallback | Ativos abaixo; fonte `openspec/changes/fase-56-1-contrato-produtivo-modelos-fallback/` |
| F56.2a: preparação não operacional do Produto 1:1 | Cobertura concluída abaixo; fonte arquivada `openspec/changes/archive/2026-10-07-fase-56-2a-preparacao-nao-operacional-produto-1-1/` |
| Monetização pública / Stripe | Iniciativa diferida para v1.7+, fora da numeração e sem requisitos ativos |

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

## F56.2b1a — Cobertura planejada (Fundação inativa)

**Fonte normativa:** `openspec/changes/fase-56-2b1a-fundacao-inativa-produto-1-1/`. Estes REQ-IDs são rastreabilidade planejada, ainda não cobertura concluída. Plano 01 exige diagnóstico read-only do HTTP 502 e checkpoint humano antes de qualquer aplicação local de migrations ou teste transacional.

| REQ-ID | Requirement (OpenSpec) | Spec / origem | Plano(s) |
|--------|------------------------|---------------|----------|
| REQ-56.2b1a-01 | Diagnóstico somente leitura e gate verificável de identidade, isolamento, serviços e schema | Proposal critérios 1; design A1; tasks 1.1–1.4 | 56.2.1-01 |
| REQ-56.2b1a-02 | Autorização independente server-side, auditada e validada junto à flag aplicável após leituras válidas de ambas | product-1-1-flow-activation — Autorização independente e flags aplicáveis | 56.2.1-02 |
| REQ-56.2b1a-03 | Concessão operacional habilitadora bloqueada em b1a; testes de estágios por fixtures/harness sem ativação | product-1-1-flow-activation — Concessão operacional bloqueada nesta change | 56.2.1-02 |
| REQ-56.2b1a-04 | Payload incompatível recusado antes de crédito, preservando compatibilidade legada | Proposal critério 4; design A3; tasks 3.1–3.3 | 56.2.1-03 |
| REQ-56.2b1a-05 | Reserva reduz saldo temporariamente; `delivered` finaliza consumo e `refunded` restaura a reserva | product-1-1-campaign-credit-billing — Reserva temporária e cobrança final | 56.2.1-04, 56.2.1-05 |
| REQ-56.2b1a-06 | Transições CAS/idempotentes, concorrência por identidade e terminalidade de `delivered` | product-1-1-campaign-credit-billing — Concorrência e transições CAS | 56.2.1-04, 56.2.1-05 |
| REQ-56.2b1a-07 | Prova Postgres real de atomicidade/rollback/concorrência após gate aprovado; migrations b1a somente na instância local aprovada, sem `db push` | product-1-1-campaign-credit-billing — Testes Postgres reais; design A1/A5; tasks 4.5–4.6 | 56.2.1-01, 56.2.1-05 |

## Regras Operacionais

- Os REQ-IDs cobertos são os da F56.1 (`REQ-56.1-01`..`REQ-56.1-27`, cobertura concluída em 2026-10-06) e os da F56.2a (`REQ-56.2a-01`..`REQ-56.2a-19`, cobertura concluída em 2026-10-07). F56.2b1a tem 7 REQ-IDs planejados, nenhum marcado como cobertura concluída; b1b e b2 permanecem fora do planejamento atual; F56.3 permanece futura.
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
