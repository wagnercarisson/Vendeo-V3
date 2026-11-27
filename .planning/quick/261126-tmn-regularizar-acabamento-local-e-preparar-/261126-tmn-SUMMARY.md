---
quick_id: 261126-tmn
slug: regularizar-acabamento-local-e-preparar-
status: complete
date: 2026-11-26
verification: manual
---

# Quick 261126-tmn — Summary

**Resultado:** warning de lint da F63 eliminado; worktree auditado e classificado; hashes das
migrations A/B/C conferidos; consolidação Git **não executada** — Review Stop aguardando
aprovação específica.

## 1. Correção do warning

`scripts/f63/preservation-report.mjs`:

- `buildSchemaComparison(baseline, current, stage)` → `buildSchemaComparison(baseline, current)`.
- Chamada em `main()` ajustada para `buildSchemaComparison(baseline, currentSchema)`.
- Nenhuma regra desabilitada, nenhuma supressão, nenhuma mudança de comportamento: `stage` não
  era lido no corpo da função nem influenciava o objeto retornado.

Validações executadas:

| Verificação | Resultado |
|---|---|
| `node --check scripts/f63/preservation-report.mjs` | exit 0 |
| `npx eslint scripts/f63/preservation-report.mjs` | exit 0, sem warning |
| import dinâmico do módulo (sem executar `main`) | exit 0 |
| `node scripts/f63/preservation-report.mjs --help` | exit 0 |
| `npm run lint` | exit 0, sem warning |
| `npm run test:scripts` | 119/119 PASS |
| `npm run test:gates` | exit 0 (gates não executados por ausência de ambiente) |
| `git diff --check` | exit 0, sem saída |

**Ressalva preservada:** o lint oficial continua **sem cobertura de TypeScript** (`.ts` é
ignorado pela configuração). Este resultado **não** valida lint TypeScript e não reformula o
ESLint.

## 2. Correção de classificação

O warning **não era anterior à F63**: foi introduzido durante esta entrega, na Task 63-03,
junto com `scripts/f63/preservation-report.mjs`. A classificação foi corrigida em:

- `.planning/phases/63-base-versionada-de-ofertas-2a/63-05-SUMMARY.md`
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-05-verification.md`

As demais pendências permanecem: lint TypeScript não validado, três falhas globais alheias e
comentário SQL desatualizado.

## 3. Auditoria do worktree (medida em 2026-11-26)

- **8 modificados** (contagem medida, confere com o fechamento).
- **61 não rastreados antes desta quick; 63 após criar o PLAN e o SUMMARY desta quick.**
- Nenhum arquivo removido; nenhum padrão amplo adicionado ao `.gitignore`.

### 3.1 Modificados (8)

Tracking: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`.
Configuração/test tooling: `package.json`, `scripts/testing/run-integration.mjs`,
`scripts/testing/test-categories.json`, `scripts/testing/test-status.mjs`, `vitest.shared.ts`.

### 3.2 Não rastreados — F63 (56)

Planejamento/evidências (36, `.planning/phases/63-base-versionada-de-ofertas-2a/`):
`63-01..63-05-PLAN.md`, `63-01..63-05-SUMMARY.md`, `63-CONTEXT.md`, `63-OPSX-VERIFY.md`,
`63-PATTERNS.md`, `63-PLAN-CHECK.md`, `63-UAT.md` e 21 arquivos em `evidence/`.

Código/ferramentas (3): `scripts/f63/apply-migration.mjs`, `scripts/f63/homolog-identity.mjs`,
`scripts/f63/preservation-report.mjs`.

Migrations (3): `supabase/migrations/20261126223854_offer_catalog_versions.sql`,
`20261126230735_offer_catalog_seed_v1.sql`, `20261126231022_offer_catalog_published_by_fix.sql`.

Testes/config (5): `src/lib/credit/__tests__/f63-offer-catalog-{schema,calendar,concurrency}.postgres.test.ts`,
`src/lib/credit/__tests__/trial-offer-offer.test.ts`, `vitest.integration-f63.config.ts`.

Módulo (2): `src/lib/credit/trial-offer/offer.ts`, `src/lib/credit/trial-offer/offer-contract.ts`.

OpenSpec (7): archive `openspec/changes/archive/2026-11-26-fase-2a-base-versionada-de-ofertas/`
(6 arquivos) e `openspec/specs/trial-offer-catalog/spec.md`.

### 3.3 Não rastreados — quick tasks de alinhamento (5, fora da F63)

- `.planning/quick/261126-n4n-registrar-linha-guia-do-onboarding-com-r/` (PLAN + SUMMARY)
- `.planning/quick/261126-nwg-complementar-alinhamento-onboarding-cpf-/` (PLAN + SUMMARY)
- `docs/alinhamento-onboarding-responsavel-cnpj-opcional.md` — criado pelas quicks acima e
  também ajustado editorialmente pelo 63-05. **Compartilhado entre F63 e alinhamento.**

## 4. Integridade da entrega

Hashes SHA-256 conferidos contra as evidências (idênticos):

| Migration | SHA-256 |
|---|---|
| A `20261126223854_offer_catalog_versions.sql` | `ed652a26fc9294cdc239a842c2aebb00ccc1a182ff39e9dae13def947f8329bc` |
| B `20261126230735_offer_catalog_seed_v1.sql` | `e511295e7b7419431f05b9a112258afd3c3651de23ecd85d384ee9d26115c4b7` |
| C `20261126231022_offer_catalog_published_by_fix.sql` | `817cbd8a946ac3ee4f1d3e8080cdba175866d9be44bdde6b83f03eb1cd1d549c` |

Nenhuma migration foi editada, renomeada ou reaplicada. Nenhum guarda, referência histórica ou
teste foi alterado para forçar a suíte global. Nenhum teste PostgreSQL foi reexecutado. Nenhum
acesso a produção, banco remoto, consumidores, concessões, Admin ou regras comerciais.

## 5. Varredura de segurança (sem valores impressos)

- Nenhuma URL PostgreSQL com senha real, JWT, bearer, chave privada, chave AWS, token ou
  `service_role` secreto encontrado.
- Ocorrências de `postgresql://`, `password=` e `service_role` são **regras de redação** em
  planos/guards e nomes de papel/grants, não credenciais.
- Nenhum dump, `.env`, backup, chave ou artefato binário não rastreado.
- E-mail encontrado em `.planning/STATE.md` é registro histórico já existente de conta de
  produto; não é segredo nem dado novo desta quick.
- Nenhum CPF/telefone/dado pessoal novo detectado.

## 6. Correção de codificação do `STATE.md`

O worktree estava com duplo encode (UTF-8 → cp1252 → UTF-8), BOM e CRLF. A correção usou
`git show HEAD:.planning/STATE.md` como referência histórica:

- apenas sequências reais de mojibake foram revertidas; caracteres corretos foram preservados;
- linhas históricas inalteradas foram mantidas **byte a byte** como em `HEAD`, inclusive eventuais
  corrupções já existentes no próprio `HEAD` (não ampliadas nem “corrigidas” fora de escopo);
- BOM removido; arquivo salvo em UTF-8, com CRLF consistente com o worktree.

Diff resultante: **11 inserções / 1 remoção** — `last_updated`, seção da F63 e as três entradas
de quick (`tmn`, `nwg`, `n4n`). Nenhuma linha histórica foi reescrita. O diff foi apresentado
para aprovação antes da consolidação.

## 7. Pendências preservadas

- Lint TypeScript **não validado** (ESLint ignora `.ts`).
- Suíte global com **três falhas alheias** (F60.4, F60.4-HEAD, F60.7), não corrigidas.
- **Comentário SQL desatualizado** em `trial_offer_versions_guard()` (SUGGESTION do opsx-verify).
- Consolidação Git, push, merge, deploy e qualquer operação remota **não executados**.
- Suíte global **não** declarada verde.

## 8. Review Stop

Commit, push, merge, deploy e migrations permanecem bloqueados até aprovação específica do
inventário e do agrupamento propostos.
