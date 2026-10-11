---
id: 261011-lc6
title: Incorporar o baseline aprovado do laboratório (quick 261009-u3h) na cópia produtiva Produto 1:1
status: complete
scope: product-1-1-prompt-incorporation
date: 2026-10-11
branch: feature/fase-56-1-contrato-produtivo-modelos-e-fallback
approval:
  by: responsável (owner)
  date: 2026-10-11
  origin: quick 261009-u3h
  baseline_commit: 99017f35
commits:
  - 66608889  # código produtivo + testes + fixture
  - 18696229  # specs OpenSpec + referências b1b
---

# Quick Summary — 261011-lc6

## Objetivo

Incorporar na **cópia produtiva** `src/lib/product-1-1` o baseline do laboratório validado e aprovado pelo responsável em 2026-10-11 (quick `261009-u3h`, domínio `99017f35`). Apenas os **quatro itens aprovados** foram copiados; nenhuma outra mudança experimental do laboratório foi trazida.

## Escopo aprovado (4 itens incorporados)

1. **Direção de fundo (`original`)** — `…; não o substitua por outro.` → `…; não substitua o ambiente por outro.` (`src/lib/product-1-1/background-direction.ts`).
2. **Intenções** — Oferta/Destaque/Exclusivo acrescentam a linha `Respeite a direção de fundo.` (`policies/oferta.ts`, `destaque.ts`, `exclusivo.ts`).
3. **Nome** — serializado em duas linhas: `Nome obrigatório na arte: "<nome>"` + orientação fixa `NAME_ARTWORK_GUIDANCE` em linha própria; sem ponto automático; pontuação original preservada (`prompt-composition.ts`).
4. **Versionamento** — `COMPOSER_VERSION` `v5→v6`; oferta `v1→v2`; destaque `v1→v2`; exclusivo `v3→v4`; nova `PRODUCT_1_1_BACKGROUND_DIRECTION_VERSION = "48.2.6-background-direction-v1"` exposta em `policyVersions.fundo` (`policies/registry.ts`) — mesmo record de evidência já persistido; **sem schema/migration**.

`prompt-base.ts` permanece **inalterado** (`48.2.6-produto-1-1-v1`); nenhuma instrução adicional além das aprovadas.

## Equivalência produtiva

- A fixture `src/lib/product-1-1/__tests__/fixtures/prompt-composition.baseline.json` foi **regenerada a partir do baseline aprovado `99017f35`** (o `domain/**` do laboratório é byte-idêntico a esse commit), para as **9 combinações** (3 intenções × 3 direções).
- A rastreabilidade do baseline anterior foi preservada em `previousBaseline` (sourceCommit `8f0b3fb0` + proveniência) sem sobrescrever o histórico; a nova proveniência registra a aprovação (responsável, 2026-10-11).
- O teste `prompt-composition.equivalence.test.ts` confronta o **runtime produtivo** com o baseline congelado (texto, blocos, versões) e agora também afirma a rastreabilidade do baseline anterior. Nenhuma importação do laboratório mutável.
- O gerador temporário foi removido; apenas teste + fixture foram mantidos.

## Reconciliação documental (só requisitos afetados; sem archives/histórico)

- `openspec/specs/product-1-1-prompt-composition/spec.md` — versão incorporada (compositor v6, oferta v2, destaque v2, exclusivo v4, `policyVersions.fundo`) e requisito de equivalência reescrito como **aderência ao baseline aprovado congelado**, preservando o baseline anterior e o isolamento lab×prod.
- `openspec/specs/lab-bench-prompt-policy/spec.md` — serialização do nome em duas linhas entre aspas sem ponto automático (compositor v6); linha `Respeite a direção de fundo.` nas intenções e versões oferta v2 / destaque v2 / exclusivo v4.
- `openspec/specs/lab-bench-image-roles/spec.md` — texto `original` atualizado, compositor v6 e `policyVersions.fundo`.
- b1b (`56.2.2-04-PLAN.md`, `56.2.2-PATTERNS.md`, `56.2.2-CONTEXT.md`) — referências de versão reconciliadas e **registro da aprovação e de sua origem**.
- **Não** editados: archives, UAT/checkpoints históricos (`48.2.6`), artefatos da F56.2a (concluída) e a própria quick `u3h`.

## Versões e compatibilidade

- `src/lib/product-1-1/**` é um módulo produtivo autônomo; `policyVersions.fundo` entra no mesmo `Record<string,string>` já persistido e comparado no preflight (sem schema/migration/flag).
- Equivalência significa **aderência ao baseline aprovado**, não igualdade permanente com a bancada mutável.

## Validação executada (resultados reais)

| Gate | Resultado |
|---|---|
| Testes focados afetados (equivalência + contrato) | **17/17 passed** |
| `src/lib/product-1-1` (10 arquivos) | **118/119** — única falha é `legacy-frontier.guard` (**pré-existente**, ver abaixo) |
| `npx openspec validate --changes --strict` | 2/2 passed |
| `npx openspec validate --specs --strict` | editei **3 specs** → **as 3 passam**; 75 specs não relacionadas falham (pré-existente) |
| `npm run typecheck` | limpo (baseline 0) |
| `npm run lint` | limpo (exit 0) |
| `npm run build` | `✓` (check:cnae + next build OK) |
| Suíte completa `vitest run` | 5079 passed / **20 failed** / 61 skipped (5160) |

**As 20 falhas da suíte completa são pré-existentes e não foram introduzidas por esta quick:** 14 no laboratório (`intent-schema` 5, `prompt-base` 3, `branding-service` 3, `form-parity` 2, `run-history` 1 — `bench_background_direction_required`/`bench_intent_price_incompatible`), 5 não relacionadas (DB/date/provider: `use-campaign-form-validity`, `legal-document-versions`, `ai-image-generator`, `openai-provider`, `image-generation-service`) e 1 `legacy-frontier.guard` (a fronteira F56.2a detecta alterações de commits anteriores — lab `u3h` e `src/lib/ai` — **antes** desta quick; `src/lib/product-1-1/**` não é caminho de fronteira). **Nenhuma falha nova**; nenhuma cobertura reduzida.

## Limites respeitados

- Somente cópia produtiva + testes/fixture + reconciliação documental autorizada; `src/lib/lab/bench` (exceto leitura para gerar a fixture) e demais módulos intocados.
- **Sem** execução da fase 56.2.2, chamada a provider, migration, `db push`, ativação de flags/autorização, deploy ou operação remota.
- Alterações preexistentes não relacionadas preservadas.

## Aprovação e origem (registro)

- **Aprovação:** responsável (owner), em **2026-10-11**; origem: quick **`261009-u3h`** (baseline do laboratório validado e aprovado). Escopo aprovado explicitamente: opção 1 (escopo completo), com os cuidados de gerar do commit `99017f35`, preservar o baseline anterior e manter o prompt-base inalterado.

## Pendência para o usuário

Parar para **revisão**. Nenhuma ação adicional autorizada (não executar 56.2.2, provider, migrations, ativação, deploy ou promoção remota).
