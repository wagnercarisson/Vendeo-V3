# Phase 61 Plan 01: Fundação — modelo, catálogo e componente de chips

**Status:** ⛔ **NÃO ACEITO — AGUARDANDO REVISÃO** (execução parada no `## Review Stop`)

**Executado em:** 2026-11-21
**Branch:** `feat/campaign-format-chips`
**HEAD na captura do baseline:** `c971d631a190d426be21341f4616f6e4c7cb5135`

> Este documento é um REGISTRO DE EXECUÇÃO, não um aceite. O plano `61-01` foi
> executado isoladamente; `61-02` e `61-03` NÃO foram iniciados. Nenhuma fase foi
> marcada como concluída. Nenhum merge, push, deploy, sync ou archive foi feito.

---

## Objetivo executado

Criar a fundação da apresentação dos formatos, sem tocar superfícies, autoridades,
banco, Storage ou provider:

1. baseline técnico medido ANTES de qualquer edição em `src/`;
2. modelo puro `src/lib/campaign/format-presentation.ts`;
3. catálogo compartilhado `src/lib/i18n/campaign-formats/**` + wiring nos três namespaces;
4. componente `src/components/campaign/campaign-format-chips.tsx`.

---

## Commits locais

| Commit | Tipo | Conteúdo |
|---|---|---|
| `489c2107` | docs | Baseline técnico medido + evidência de chamadas (lista/dashboard/detalhe) |
| `73255179` | feat | Modelo puro de apresentação + matriz de testes |
| `cc093005` | feat | Catálogo compartilhado pt-BR/es-419 + wiring de list/dashboard/detail |
| `280d0c9a` | feat | Componente compartilhado de chips + testes de estados/a11y |
| `8db67eee` | fix | Remoção de literal que violava o contrato de fronteiras F60.7 |
| `655958c1` | fix | Revisão: remover prefetch (`<a>`), reconciliar explicação (clique/2º clique/hover/foco) e baseline imutável (sem recaptura silenciosa) |
| `c29b2195` | fix | Revisão final: primeiro clique fixa a explicação após hover/foco e texto do formato não incluído corrigido em pt-BR/es-419 |

Nenhum commit em `supabase/`, `src/lib/product-two-format/**` ou
`src/lib/campaign/format-resolution.ts`.

---

## Arquivos

### Criados

- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/baseline-calls.test.ts`
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/baseline-calls.json`
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/*.log` (evidências)
- `src/lib/campaign/format-presentation.ts`
- `src/lib/campaign/__tests__/format-presentation.test.ts`
- `src/lib/i18n/campaign-formats/messages.ts`
- `src/lib/i18n/campaign-formats/get-messages.ts`
- `src/lib/i18n/campaign-formats/index.ts`
- `src/lib/i18n/campaign-formats/catalogs/pt-BR.ts`
- `src/lib/i18n/campaign-formats/catalogs/es-419.ts`
- `src/lib/i18n/campaign-formats/__tests__/catalogs.test.ts`
- `src/lib/i18n/campaign-formats/__tests__/identity.test.ts`
- `src/lib/i18n/campaign-formats/__tests__/isolation.test.ts`
- `src/components/campaign/campaign-format-chips.tsx`
- `src/components/campaign/__tests__/campaign-format-chips.test.tsx`

### Alterados

- `.planning/phases/61-padronizar-chips-formatos-campanhas/61-BASELINE.md` (append do baseline medido)
- `src/lib/i18n/campaign-list/{messages.ts,catalogs/pt-BR.ts,catalogs/es-419.ts,__tests__/catalogs.test.ts}`
- `src/lib/i18n/dashboard/{messages.ts,catalogs/pt-BR.ts,catalogs/es-419.ts,__tests__/catalogs.test.ts}`
- `src/lib/i18n/campaign-detail/{messages.ts,catalogs/pt-BR.ts,catalogs/es-419.ts,__tests__/catalogs.test.ts}`

### Intocados (confirmado por diff)

- `supabase/**`
- `src/lib/product-two-format/**`
- `src/lib/campaign/format-resolution.ts`
- RPCs, flags, pricing, provider, copy, miniaturas, aprovação e recuperação.

---

## Gates — resultados reais (finais)

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| Typecheck | `npm.cmd run typecheck` | **0** | Sem erros (repetido após a revisão) |
| Lint | `npm.cmd run lint` | **0** | Sem erros (repetido após a revisão) |
| Suítes dirigidas do plano | `npx vitest run <modelo, i18n, componente, evidência>` | **0** | 13 arquivos, 93 testes |
| Regressão dirigida (baseline) | `npx vitest run <8 arquivos de list/dashboard/detail>` | **0** | 8 arquivos, 65 testes |
| Evidência em modo leitura | `npx vitest run .planning/.../evidence/baseline-calls.test.ts` | **0** | `toEqual` contra o JSON imutável |
| Baseline ausente (modo leitura) | mesmo teste com JSON temporariamente removido | **1** | Falha corretamente; JSON restaurado em seguida |
| Fronteiras F60.7 | `npx vitest run src/lib/product-two-format/orchestration/__tests__/joint-boundaries.contract.test.ts` | **0** | 6 testes |
| Suíte global | `npm.cmd run test` | **0** | 841 arquivos passaram, 2 skipped; 10375 testes passaram, 10 skipped |
| Build (baseline) | `npm.cmd run build` | **0** | `check:cnae OK`; 102 páginas estáticas |
| Diff-check do range | `git diff --check c971d631..HEAD` | **0** | Limpo |
| Status | `git status --porcelain` | — | Árvore limpa após o commit documental |

### Falhas preexistentes / limites

- Gates de integração (Postgres/homolog/local/app-env/Product 1:1/F60/F60.1)
  permanecem **NÃO EXECUTADOS** por ausência de ambiente. Nenhum banco/Storage/
  homolog/produção foi acessado.
- Nenhuma falha de teste/typecheck/lint/build foi introduzida no estado final.
- O `ROADMAP.md` agora registra a fase 61; o diff-check do range está limpo.
- A árvore de trabalho está limpa; a única advertência residual do Git é a
  conversão LF→CRLF em arquivos de planejamento (não é erro de whitespace).

---

## Contagens MEDIDAS (antes × depois)

Fonte: `evidence/baseline-calls.json`, produzido por `baseline-calls.test.ts` com
fixtures/mocks fixos. O teste foi executado em captura (`BASELINE_CAPTURE=1`) e em
leitura; após toda a implementação, a leitura continuou passando (`toEqual`),
provando **zero drift** de chamadas nesta wave (as superfícies ainda não consomem
os chips).

### Lista (`listCampaigns`)

| Cenário | `from` | `readTwoFormatListSummaries` | `createSignedUrl` | `createSignedUrls` |
|---|---:|---:|---:|---:|
| `list.joint` | 1 | 1 | 0 | 1 |
| `list.legacy_only` | 1 | 1 | 2 | 0 |
| `list.no_signable_thumbnail` | 1 | 1 | 0 | 0 |
| `list.batch_1` | 1 | 1 | 0 | 1 |
| `list.batch_3` | 1 | 1 | 0 | 1 |

### Dashboard (`queryEligibleCampaigns`)

| Cenário | `from` | `readTwoFormatListSummaries` | `generateBatchPreferredThumbnailUrls` | `generateBatchThumbnailUrls` |
|---|---:|---:|---:|---:|
| `dashboard.joint` | 1 | 1 | 1 | 1 |
| `dashboard.legacy_only` | 1 | 1 | 1 | 1 |
| `dashboard.no_signable_thumbnail` | 1 | 1 | 1 | 1 |

### Detalhe (página real, fixtures fixas)

| Cenário | control | delivery | durable | attemptStart | signedPreview | copyDelivery | copyCancel | copyRecovery | probes | createSignedUrl |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `detail.joint` | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| `detail.new_flow` | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| `detail.legacy` | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 1 |

---

## Testes por tarefa

| Tarefa | Arquivo | Testes |
|---|---|---:|
| Task 1 | `evidence/baseline-calls.test.ts` | 1 (captura + leitura) |
| Task 2 | `src/lib/campaign/__tests__/format-presentation.test.ts` | 19 |
| Task 3 | `src/lib/i18n/campaign-formats/__tests__/*` + três namespaces | 57 |
| Task 4 | `src/components/campaign/__tests__/campaign-format-chips.test.tsx` | 16 |

---

## Desvios do plano

### Corrigidos na revisão

**1. Navegação sem prefetch**
- `next/link` removido; o chip entregue usa `<a href>` como a navegação anterior.
- Teste estático proíbe `next/link`/`prefetch`; nenhuma consulta antecipada.

**2. Explicação reconciliada**
- Estado React controla `hidden`/`aria-expanded`; hover e foco abrem; saída de ponteiro/foco fecha.
- O primeiro clique após hover/foco **fixa** a explicação aberta; o segundo clique fecha.
- Testes cobrem `hover → foco → clique`, `foco → clique`, segundo acionamento e saída de ponteiro/foco, usando `toBeVisible`/`not.toBeVisible`.

**3. Baseline imutável**
- `baseline-calls.json` só é gravado com `BASELINE_CAPTURE=1`.
- Em modo leitura, JSON ausente falha (exit 1); não há recaptura silenciosa.
- JSON original preservado.

**4. Tracking e whitespace**
- Fase 61 registrada no `ROADMAP.md`; trailing whitespace corrigido.
- `git diff --check c971d631..HEAD` limpo.

**5. Texto do formato não incluído**
- pt-BR: “Este formato não foi incluído na criação da campanha.”
- es-419: “Este formato no fue incluido en la creación de la campaña.”
- Catálogo compartilhado e testes de catálogo atualizados; a explicação agora se refere
  ao formato não solicitado, não à campanha inteira.

### Auto-corrigidos

**1. [Rule 3 — bloqueio de fronteira] Guardião F60.7 rejeitou comentário literal**
- **Encontrado durante:** suíte global final (após Task 4).
- **Problema:** `src/lib/product-two-format/orchestration/__tests__/joint-boundaries.contract.test.ts`
  varre o código de produção por `@/lib/product-two-format` (inclusive em comentários).
  O cabeçalho de `format-presentation.ts` citava esse caminho literalmente.
- **Correção:** comentário reescrito sem o literal; nenhuma dependência de runtime foi
  adicionada. Commit `8db67eee`.
- **Verificação:** contrato de fronteiras 6/6; suíte global passou (exit 0).

Nenhum outro desvio de escopo. Nenhuma migration, RPC, flag, pricing, provider,
copy, miniatura, aprovação ou recuperação foi alterada.

---

## Riscos e pontos para revisão

- O componente e os campos `formats`/`jointNotes` ainda NÃO são consumidos pelas
  superfícies; isso é intencional nesta wave (integração em 61-02/61-03). Não há
  stub funcional — apenas fundação não plugada.
- O baseline de chamadas é comparativo; a integração futura deve reexecutar
  `baseline-calls.test.ts` e exigir `toEqual` (zero chamadas adicionais).
- O tracking da fase está em `STATE.md`, `ROADMAP.md` e nos artefatos da fase.
- A explicação do chip usa estado React (`hidden`/`aria-expanded`), não apenas
  CSS; o link é `<a>` sem prefetch do Next.

---

## Limites de execução

- Nenhum acesso a banco, Storage, homolog, produção, provider ou chamada paga.
- Nenhum merge, push, deploy, sync ou archive.
- Nenhuma migration/RPC/flag/pricing/copy/miniatura/aprovação/recuperação criada ou alterada.
- `61-02` e `61-03` NÃO executados.
- Fase NÃO marcada como concluída; `STATE.md` e `ROADMAP.md` registram a fase 61 e o estado de revisão.

---

## Review Stop

Parada obrigatória atingida. **Aguardando revisão e aprovação explícita** antes de
qualquer continuação (61-02). Este SUMMARY não constitui aceite.

## Self-Check: PASSED

- Arquivos criados/alterados conferidos no disco (todos FOUND, nenhum MISSING).
- Commits `489c2107`, `73255179`, `cc093005`, `280d0c9a`, `8db67eee` conferidos em `git rev-parse --verify`.
- `baseline-calls.json` presente e releitura passou (`toEqual`).
- Nenhum caminho proibido apareceu no diff desde o baseline.
