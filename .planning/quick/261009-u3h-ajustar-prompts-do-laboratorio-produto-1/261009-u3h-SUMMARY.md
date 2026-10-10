---
id: 261009-u3h
title: Ajustar prompts/composição do laboratório Produto 1:1 (fundo, nome, intenções) com equivalência por fixture congelada
status: complete
scope: lab-prompts-experimental
date: 2026-10-10
branch: feature/fase-56-1-contrato-produtivo-modelos-e-fallback
commits:
  - 99017f35  # domínio do laboratório
  - b7ab7b1b  # testes + fixture congelada
---

# Quick Summary — 261009-u3h

## Objetivo

Ajustar **somente** os prompts/composição do laboratório Produto 1:1 (`src/lib/lab/bench/`), preservando a equivalência do runtime produtivo (`src/lib/product-1-1`) com uma **fixture congelada** do baseline aprovado anterior. Ajuste experimental; **não** incorpora o novo prompt à produção até validação manual do usuário.

## Baseline comprovado (antes da mudança)

- `src/lib/product-1-1/__tests__/prompt-composition.equivalence.test.ts` (lab × prod): **10/10 passed**.
- Commit de origem: `8f0b3fb0cb7fb3c9aecbe2c82abfc96ab50efd3f`.
- Working tree limpo no início.

## Alterações (runtime produtivo intocado)

1. **Direção de fundo (`original`)** — `Mantenha o cenário da imagem enviada como base; não o substitua por outro.` → `...; não substitua o ambiente por outro.` em `src/lib/lab/bench/domain/background-direction.ts`.
2. **Intenções** — Oferta/Destaque/Exclusivo preservam o literal atual e acrescentam a nova linha `Respeite a direção de fundo.` (uma vez por intenção).
3. **Nome** — serializado em duas linhas: `Nome obrigatório na arte: "<nome>"` e, na linha seguinte, `Inclua todas as palavras, números e unidades - nenhuma informação do nome deve ser omitida, as aspas não fazem parte do nome; capitalização, quebras de linha e arranjo livres.` Sem ponto automático; pontuação original do nome preservada. Instrução fixa separada da lógica de composição (`NAME_ARTWORK_GUIDANCE`).
4. **Versionamento** — `COMPOSER_VERSION` `48.2.4-prompt-composer-v5 → v6`; oferta `v1 → v2`; destaque `v1 → v2`; exclusivo `v3 → v4`; nova `BENCH_BACKGROUND_DIRECTION_VERSION = "48.2.6-background-direction-v1"` exposta em `policyVersions.fundo` (mesmo record de evidência já persistido/comparado; sem schema/migration).

## Equivalência produtiva (ajuste estreito autorizado)

- `src/lib/product-1-1/__tests__/prompt-composition.equivalence.test.ts` deixou de comparar o Produto 1:1 contra a bancada **mutável** e passou a confrontá-lo com a fixture congelada `src/lib/product-1-1/__tests__/fixtures/prompt-composition.baseline.json`.
- A fixture preserva as **9 combinações** (3 intenções × 3 direções) e a comparação de **texto, blocos e versões**; congela briefing, configuração, contribuições resolvidas, prompt-base, referências e saída esperada, além de `sourceCommit`/`provenance`.
- A fixture foi gerada a partir da bancada **pré-mudança** que passou na comparação lab×prod (não apenas da saída produtiva). O gerador temporário foi removido; apenas teste + fixture foram commitados.
- Mantida a asserção explícita do prompt-base produtivo (`PROMPT_BASE_CONTENT`/`PROMPT_BASE_VERSION`) contra o baseline.

## Registro de versões/hash (reuso, sem duplicar)

- Prompt final: `promptCompiled`/`promptApproved`; versões: `composerVersion` + `policyVersions` (+ `promptBaseVersion`). Nada novo foi criado.
- Não há hash do prompt compilado; o único SHA-256 do laboratório é a revisão textual dos campos livres do operador (`text-integrity-detector.ts`), inalterada.

## Validação executada

| Gate | Resultado |
|---|---|
| Baseline lab×prod (pré-mudança) | 10/10 passed (`8f0b3fb0`) |
| Testes focados alterados (composer, policy, bench-api, equivalência, bench-ui) | **284/284 passed** |
| Suíte completa `vitest run` | 5050 passed / 19 failed / 61 skipped |
| `npm run typecheck` | limpo |
| `npm run lint` | limpo |
| `npm run build` | `✓ Compiled successfully` (check:cnae OK) |

**As 19 falhas da suíte completa são pré-existentes no HEAD**, confirmadas ao rodar os mesmos arquivos com as mudanças em stash: 14 no laboratório (`intent-schema` 5, `prompt-base` 3, `branding-service` 3, `form-parity` 2, `run-history` 1 — erro `bench_background_direction_required`/fogo de validação de intenção) e 5 não relacionadas (DB/date/provider: `use-campaign-form-validity`, `legal-document-versions`, `visual-signature ai-image-generator`, `openai-provider`, `image-generation-service`). **Nenhuma falha nova** foi introduzida.

## Divergência normativa (a reconciliar)

- `openspec/specs/lab-bench-prompt-policy/spec.md` e `lab-bench-image-roles/spec.md` ainda fixam os textos/versões anteriores. Registrada como **divergência temporária e experimental desta quick**; a reconciliação do laboratório ocorre **após a avaliação manual do usuário** (etapa distinta da incorporação produtiva). As main specs **não** foram atualizadas silenciosamente.

## Limites respeitados

- Somente laboratório + teste de equivalência/fixture autorizados; `src/lib/product-1-1` runtime intocado.
- Sem gerações, chamadas a provider, migrations, operações remotas, ativação de flags ou deploy.
- F56.2b1b permanece parada; tracking limitado a esta quick.
- Alterações de outras sessões preservadas.

## Pendência para o usuário

Parar para **validação manual no laboratório**. O novo prompt **não** é tratado como aprovado visualmente até essa avaliação; a incorporação produtiva é etapa posterior e depende de aprovação explícita.
