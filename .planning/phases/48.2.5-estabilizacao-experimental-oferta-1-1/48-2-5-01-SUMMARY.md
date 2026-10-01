---
phase: 48.2.5-estabilizacao-experimental-oferta-1-1
plan: 48-2-5-01
subsystem: testing
tags: [bench, text-integrity, isolation, supabase]
requires:
  - phase: 48.2.4-experimento-deterministico-oferta-1-1
    provides: Bancada local, snapshots, preflight, prompts e persistência de runs existentes
provides:
  - Base SHA e baseline das fronteiras produtivas protegidas
  - Mapa de campos livres cobertos/excluídos pelo detector textual
  - Auditoria de evidência e persistência sem necessidade de tabela nova
  - Gate de teste que bloqueia rede fora de loopback no fluxo de fronteira
affects: [48.2.5, text-integrity, lab-admin-api]
tech-stack:
  added: []
  patterns: [evidência textual efêmera entre rotas, bloqueio de fetch não-local em contrato]
key-files:
  created: [.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-01-SUMMARY.md]
  modified: [src/lib/lab/bench/__tests__/bench-boundary.contract.test.ts, openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/design.md, openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/specs/lab-bench-text-integrity/spec.md, openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/specs/lab-admin-api/spec.md, openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/tasks.md, .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-01-PLAN.md]
key-decisions:
  - "O detector cobre product.name, product.description, product.mandatoryArtworkText e promptBase; exclui valores controlados e branding importado somente para leitura."
  - "textIntegrityEvidence permanece efêmera; snapshots, prompt_base, prompts e policy_versions existentes são suficientes sem tabela nova."
requirements-completed: []
requirements-reviewed: [lab-bench-text-integrity, lab-admin-api, lab-bench-candidate]
duration: 16min
completed: 2026-09-30
---

# F48.2.5 Plan 01 Summary

**Baseline protegido e contrato de evidência textual auditados; a revisão inclui `promptBase` byte a byte sem introduzir persistência nova.**

## Base SHA

Base SHA: 1003dc46996d2608097d1fe2027a7f24c2845cd4

Capturada com `git rev-parse HEAD` após commits documentais normativos/de planejamento e antes da primeira alteração de implementação da fase. Na captura, o worktree estava limpo. É a base temporal para `git diff BASE..HEAD` das fronteiras produtivas.

## Fronteiras protegidas — baseline

Fronteiras protegidas pelo D8 e conferidas contra a Base SHA:

- `src/components/campaign/types.ts`
- `src/lib/store-identity-service.ts`
- `src/lib/image-generation/services/art-director-briefing.ts`
- `src/lib/ai/adapters/images.ts`
- `src/lib/ai/adapters/responses.ts`
- `src/lib/ai/adapters/registry.ts`
- `src/lib/ai/model-registry.ts`
- `src/lib/ai/api-keys.ts`
- `src/lib/ai-cost/cost-estimator.ts`
- `src/components/flow/**`
- `src/lib/campaign/**`
- `src/app/api/campaign/**`
- `prompts/**`
- `supabase/migrations/**`

Baseline inicial: `git status --short -- supabase/migrations` vazio e `git diff --name-only BASE..HEAD` para a lista acima vazio. Nenhuma migration foi adicionada/editada; nenhum acesso remoto ou `db push` foi realizado.

## Mapa de campos da revisão textual

Conferido contra `BenchProductSchema`, `BenchOfferSchema`, `buildBenchCampaignSnapshot`, `buildBenchExperimentalBriefing`, `composePromptBlocks`, payloads da UI e schemas de `/compose` e `/runs`.

| Campo canônico | Origem/uso | Detector | Contrato |
|---|---|---:|---|
| `product.name` | Formulário, snapshot e bloco Produto | Sim | Nome integral/literal; preservar bytes após `keep_exactly`. |
| `product.description` | Formulário opcional, snapshot e bloco Produto | Sim | Campo livre; detector alerta sem reescrever. |
| `product.mandatoryArtworkText` | Campo livre opcional do formulário; combinado com aviso ilustrativo controlado antes do snapshot | Sim, somente trecho livre | Texto digitado é coberto; aviso constante `ILLUSTRATIVE_NOTICE_TEXT` não é texto editável do operador. |
| `promptBase` | Editor manual, enviado em `/compose`, incluído na evidência de preflight e reenviado por `/runs` | Sim | Coberto pela mesma revisão; `keep_exactly` preserva cada byte, sem correção automática nem julgamento semântico. Alteração isolada torna a evidência obsoleta. |
| `priceCents`, `originalPriceCents` | Valores inteiros estruturais, formatados como preços comerciais | Não | Validação comercial própria. |
| `validUntil`, `validity` e campos intermediários de validade | Dados/saída estruturada de validade | Não | Validação estrutural própria. |
| `badge`, `campaignIntent`, formato/dimensões, `showIllustrativeNotice`, `preserveImageContext` | Seleções, enums ou controles | Não | Valores controlados; não são campos de texto livre cobertos. |
| Branding (nome da loja, brief/diretrizes/estilo/tom/personalidade/direção tipográfica) | Snapshot carregado da loja/perfil em somente leitura | Não | Importado, não editável pelo operador neste fluxo; excluído explicitamente. |

A especificação OpenSpec foi atualizada antes do plano e explicita essa fronteira em design, specs da integridade textual/API e tasks. `promptBase` é parte do texto enviado ao modelo mesmo não pertencendo ao `product`/`offer`; por isso é associado à revisão textual entre as rotas.

## Auditoria de persistência e gates

- `lab_bench_runs` já armazena `campaign_snapshot`, `prompt_base`, `prompt_compiled`, `prompt_approved`, `prompt_sent`, `composer_version`, `policy_versions`, `prompt_base_version`, configuração, referências, linhagem e telemetria.
- O conteúdo coberto pode ser reconstituído do snapshot e `prompt_base`; a decisão e a revisão determinística são efêmeras entre `/compose` e `/runs`, como requerido pela spec. O servidor revalidará ambas antes de execução; não há necessidade demonstrada de persistir esses metadados nem de criar tabela.
- `createRecordingClient` impede acessos fora da allowlist e escritas em lojas/branding; `FakeGateway` cobre execução sem provider. `architecture-guard.test.ts` verifica fronteiras estáticas do bounded context.
- O contrato de fronteira foi estendido para rejeitar qualquer `fetch` cujo host não seja loopback, permitindo somente endpoints locais. A execução observou uma consulta de pricing em `127.0.0.1`; nenhum host remoto foi permitido.
- Estado das tarefas OpenSpec §1: **1.1, 1.2 e 1.4 concluídas** conforme evidências acima; **1.3 permanece pendente em parte**. Este ciclo acrescentou bloqueio de fetch não local e confirmou os doubles/gates existentes, mas não criou uma varredura estática abrangente sobre todos os testes/tasks para ausência de provider. O gate integrado de isolamento/no-provider permanece no escopo do Plano 07; a tarefa 1.3 não é marcada como concluída aqui.
- Verificação: `npm.cmd test -- --run src/lib/lab/bench/__tests__/bench-boundary.contract.test.ts src/lib/ai/__tests__/architecture-guard.test.ts` — 2 arquivos, 36 testes passaram.
- A regressão funcional que altera somente `promptBase` após `/compose` e exige stale/409 em `/runs` fica coberta no Plano 04, junto à implementação desses contratos; está especificada na change e foi adicionada explicitamente à ação e aos critérios de aceitação do Plano 04. Não foi antecipada como teste executável no Plano 01, pois a evidência textual ainda será implementada nesse plano posterior.

## Task commits

1. **Task 1.3: Gate de rede não local no contrato da bancada** — `3601c241`.
2. **Tasks 1.1, 1.2 e 1.4: Base SHA, mapa e auditoria** — registrados neste summary; commit de documentação do plano.

Commits de alinhamento normativo anteriores à Base SHA:
- `97c74c74` — OpenSpec: `promptBase` na integridade textual e evidência obsoleta em `/runs`.
- `1003dc46` — Plano 01: cobertura normativa de `promptBase`.

## Estado e próximos passos

Plano 01 concluiu as auditorias 1.1, 1.2 e 1.4; a tarefa 1.3 segue parcialmente pendente para fechamento do gate integrado no Plano 07. Não declara as capabilities inteiras como implementadas: `requirements-completed` permanece vazio e as três capabilities estão apenas registradas em `requirements-reviewed`; suas entregas funcionais dependem dos planos seguintes. Nenhuma alteração de runtime/persistência, geração ou chamada de provider foi realizada. O Plano 02 poderá implementar papéis de imagem segundo a mesma fronteira; tracking compartilhado `STATE.md`/`ROADMAP.md` permanece conforme instrução explícita do Plano 01 para não ser alterado nesta onda.
