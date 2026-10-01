---
phase: 48.2.5-estabilizacao-experimental-oferta-1-1
plan: 48-2-5-03
subsystem: lab-bench
tags: [text-integrity, deterministic-rules, unicode, vitest]
requires:
  - phase: 48.2.5-estabilizacao-experimental-oferta-1-1
    provides: Normative field coverage and local isolation contracts from Plans 01–02
provides:
  - Pure, versioned detector and stable alert contract
  - Canonical collector for the four operator-editable text fields
  - SHA-256 revision fingerprint over exact field/value pairs
affects: [lab-bench-text-integrity, lab-admin-api, lab-bench-prompt-preflight]
tech-stack:
  added: []
  patterns: [canonical-text-field-order, deterministic-review-fingerprint, conservative-rule-catalog]
key-files:
  created: [src/lib/lab/bench/domain/text-integrity-detector.ts, src/lib/lab/bench/__tests__/text-integrity-detector.test.ts]
  modified: [src/lib/lab/bench/domain/schemas.ts]
key-decisions:
  - "A revisão usa SHA-256 dos pares em serialização JSON e preserva a forma exata, inclusive whitespace e Unicode sem normalização."
  - "O catálogo alerta sobre padrões pequenos e explícitos, sem dicionário, rede, provider ou correção automática."
requirements-completed: []
requirements-reviewed: [lab-bench-text-integrity]
duration: 16min
completed: 2026-09-30
---

# F48.2.5 Plan 03 Summary

**Detector local e versionado examina somente os quatro textos editáveis do operador, devolvendo alertas sugestivos e revisões determinísticas sem alterar a entrada.**

## Accomplishments

- Criado `text-integrity-detector.ts` com versão `48.2.5-text-integrity-v1`, contrato de pares e alertas tipados e função de coleta na ordem canônica: `product.name`, `product.description`, `product.mandatoryArtworkText`, `promptBase`.
- Campos opcionais ausentes viram strings vazias estáveis. Coleta não faz trim, normalização nem alteração; preço, validade, enums, texto controlado do aviso ilustrativo e branding importado não entram.
- `createBenchTextIntegrityRevision` calcula SHA-256 da serialização dos pares exatos. Valores Unicode composto/decomposto ou com whitespace diferente produzem revisões diferentes.
- Regras conservadoras e identificadas alertam pontuação repetida (preservando `...`), caracteres alfanuméricos repetidos três ou mais vezes, espaços anormais, palavras adjacentes repetidas e um conjunto curto de grafias PT-BR sem acento (`voce`, `nao`, `promocao`, `imperdivel`, `tambem`, `otimo`, `preco`, `liquidacao`). Alertas são ordenados por campo canônico, posição e `ruleId`, com `field`, `excerpt`, `reason`, `ruleId`.
- JSDoc registra falsos positivos possíveis para marcas, nomes próprios, abreviações e termos técnicos, e falsos negativos para padrões fora da lista; nenhum alerta corrige, substitui ou bloqueia texto por si só.

## Validation

- `npm.cmd test -- --run src/lib/lab/bench/__tests__/text-integrity-detector.test.ts` — **1 arquivo, 13 testes passaram**.
- `npm.cmd run typecheck` — passou.
- `npm.cmd run lint` — passou.
- Tests cover positive/negative rules, canonical field inclusion/exclusion, optional fields, ordering, Unicode, exact value preservation, excerpt bounds, determinism and absence of network/provider dependencies.
- Nenhum provider, serviço remoto, tabela ou migration foi acessado ou alterado.

## Task commit

- **Tasks 3.1–3.4: contrato, regras e testes do detector** — `f77493da`.

## Requirement status

`lab-bench-text-integrity` foi revisada e parcialmente atendida pelo detector. A capability permanece incompleta até os Planos 04 e 07 implementarem e validarem o gate integrado `/compose` → `/runs` e seus testes de contrato.

## Next

Plano 04 — evidência e gate de revisão entre `/compose` e `/runs`, incluindo o teste requerido de stale ao alterar somente `promptBase`. CHECKPOINT A/B permanecem pendentes; este plano não autoriza geração paga.
