---
status: complete
date: 2026-10-26
quick_id: 261026
slug: openai-pricing-sync
branch: feature/fase-47-1-modelos-assinatura-visual
phase: quick
type: execute
tasks_completed: 8/8
db_touched: false
provider_touched: false
env_touched: false
migrations_touched: true
migration_applied: false
code_commit: 89994b1d
---

# Quick 261026 — Sincronização diária das tarifas OpenAI + painel admin

## One-liner

Cron diário próprio consulta a tabela **Standard** oficial da OpenAI, valida os
7 modelos/11 linhas do inventário, versiona somente o que mudou via RPC atômica,
registra cada tentativa em `pricing_sync_attempts` e o `/admin` passa a exibir
“Tarifas OpenAI” com os valores **persistidos** e o estado da sincronização —
sem recalcular histórico e sem alterar `vs-image-usage-v1`.

## Inventário coberto (7 modelos / 11 linhas)

| Modelo | Tipo | Qualidades | Dimensões |
|---|---|---|---|
| gpt-4o | texto/visão | null | entrada/cache/saída textual |
| gpt-4o-mini | texto/visão | null | entrada/cache/saída textual |
| gpt-5.5 | texto + orquestrador | null | entrada/cache/saída textual |
| gpt-6-luna | texto/visão + orquestrador | null | entrada/cache/saída textual |
| gpt-image-2 | imagem | null, low, medium | entrada/cache textual + entrada/cache/saída de imagem |
| gpt-image-2.5-flare | imagem | low, medium | idem |
| gpt-image-2.5-sunburst | imagem | low, medium | idem |

`gpt-image-2` mantém a linha legada `quality IS NULL` e as linhas low/medium;
Flare/Sunburst mantêm low/medium. Low e Medium usam a mesma tarifa por token;
a diferença de consumo permanece na estimativa `vs-image-usage-v1`.

## Contrato de preços e correção da divergência

- `input_token_usd_per_1m` = entrada **textual**.
- `cached_input_token_usd_per_1m` = cache **textual**.
- `output_token_usd_per_1m` = saída **textual** (modelos de imagem usam `-`).
- `image_token_usd_per_1m` = saída **de imagem** (mantido).
- Novas colunas aditivas:
  - `image_input_token_usd_per_1m` (entrada de imagem);
  - `image_cached_input_token_usd_per_1m` (cache de imagem).
- `image_unit_usd` não é extraído da tabela por token; o apply preserva o valor
  da linha vigente ao versionar (não quebra Produto 1:1).
- A linha Flare/Sunburst será corrigida pelo primeiro sync: texto 5, cache texto
  1,25, imagem 8, cache imagem 2, saída imagem 30. Nenhum preço foi alterado
  nesta execução.

## Parsing e fetch

- `src/lib/ai-cost/openai-pricing-parser.ts`: parser determinístico de Markdown,
  restrito à modalidade **Standard**; Batch/Flex/Fast/Ultrafast são ignorados.
  Modelo/dimensão vêm do cabeçalho/rótulo, não de posição global.
- `-`/célula vazia = ausência; `$0.00` = zero explícito; valor inválido/ausente
  obrigatório = erro. Modelo/dimensão duplicada ou modalidade inesperada = erro.
- `src/lib/ai-cost/openai-pricing-fetch.ts`: leitura pública de
  `pricing.md`, timeout 15s, limite 2 MB, hash SHA-256, ETag/Last-Modified,
  redirect rejeitado, origem `developers.openai.com` obrigatória.
- Leitura real read-only do documento em 2026-10-26 (não persistida) extraiu
  corretamente os 7 modelos; ETag `"d8a3f57fae394d714c07f56e84ff0c88"`,
  Last-Modified `Mon, 26 Oct 2026 18:29:12 GMT` (evidências auxiliares).

## Persistência e atomicidade

Migration criada e **não aplicada**:
`supabase/migrations/20261026191931_quick_openai_pricing_sync.sql`.

- `pricing_sync_attempts`: id, status (`running`/`success`/`failed`), início/fim,
  `failure_stage`/`failure_code` seguros, URL, hash, ETag, Last-Modified,
  `models_checked`, `prices_checked`, `prices_changed`. RLS service_role only.
- Índice único parcial garante no máximo UMA tentativa `running`.
- `pricing_sync_start`: lock de advisory, recupera `running` > 15 min como
  `failed/interrupted`, retorna `already_running` se houver execução vigente.
- `pricing_sync_apply`: uma transação/lock, valida todas as linhas, fecha a
  vigência antiga e insere a nova somente quando há mudança; preserva
  `image_unit_usd` e IDs antigos; marca a tentativa como success na MESMA
  transação. Qualquer falha reverte tudo.
- `pricing_sync_fail`: marca apenas `running` como failed; nunca sobrescreve
  sucesso.
- O RPC manual `admin_set_ai_model_price` foi recriado com a mesma assinatura,
  preservando `image_input_token_usd_per_1m`/`image_cached_input_token_usd_per_1m`
  na nova versão.
- `updated_by` do sync é NULL (sem usuário fictício).

## Cron

- `GET /api/cron/sync-openai-pricing` com `CRON_SECRET` existente.
- `maxDuration = 30`; fetch limitado a 15s.
- 200 sucesso; 409 `pricing_sync_in_progress`; 500 falha com `stage`/`code`
  seguros. Não altera os crons de créditos.
- `vercel.json`: `0 8 * * *` (diário), mantendo monthly-credits (06h) e
  demo-credits (07h).
- Serviço testável offline por injeção de fetch/store; nenhum teste dispara
  atualização real.

## Dashboard /admin

Seção `OpenAiPricingSection` inserida **antes** do card “Últimas Ações”:

- título “Tarifas OpenAI” e unidade “US$ por 1 milhão de tokens”;
- tabela dos valores efetivamente persistidos em `ai_model_pricing` (não dos
  recém-extraídos), com modelo legível + ID completo, qualidade, entrada/cache/
  saída textual, entrada/cache/saída de imagem; dimensão não aplicável = “—”
  (nunca zero); colunas opcionais vazias são ocultadas; precisão até 6 casas;
- preços por unidade (`image_unit_usd`) em tabela separada “Preços por unidade
  de imagem” / “US$ por imagem”;
- acima da tabela: última conferência, última tentativa/resultado, link para a
  fonte e última alteração de preços (separada da conferência), em
  `America/Sao_Paulo` via `formatDateTimeBR`;
- aviso adaptado para falha após sucesso, atraso >36h, nunca confirmada,
  execução interrompida (>15min) e estado indisponível. Sucesso fresco não
  mostra aviso. Atualização manual de preço não cria sucesso de sync.

## Arquivos

**Criados**
- `src/lib/ai-cost/openai-pricing-{inventory,parser,fetch,sync-store,sync,sync-state,dashboard}.ts`
- `src/app/api/cron/sync-openai-pricing/route.ts`
- `src/app/(app)/admin/openai-pricing-section.tsx`
- fixture + 7 arquivos de teste
- migration `20261026191931_quick_openai_pricing_sync.sql`

**Modificados**
- `src/app/(app)/admin/page.tsx` (seção antes de Últimas Ações)
- `vercel.json` (schedule diário)

## Testes e gates

| Gate | Resultado |
|---|---|
| 7 arquivos novos/focados | **53/53** |
| Regressão afetada (`ai-cost`, `ai`, `visual-signature`, admin, cron, product-1-1, formatters) sem integrações/guard | **147 arquivos / 2069 passed, 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | limpo |

Cobertura offline: Standard vs Batch/Flex/Fast; texto vs imagem; modelo/dimensão
ausente/duplicado/ambíguo; zero explícito vs ausência; HTTP inválido/timeout/
documento inesperado; sucesso com e sem mudanças; falha sem apply; concorrência
(`start=false`); registro de falha e recuperação posterior; estado nunca/atrasado/
interrompido/indisponível; tabela admin com valores persistidos, unidades, datas
e avisos; contrato da migration (atomicidade/versionamento/preservação).

**Não declarado verde:** suítes de integração `product-1-1` exigem runner/DB
isolado (`isolated_integration_requires_runner_and_redacted_preflight`); o guard
`legacy-frontier` continua acusando as mudanças da quick anterior
(`vs-image-usage-v1`), não desta quick. Nenhuma dessas falhas foi “corrigida”
artificialmente aqui.

## Limitações e próximos passos

- Migration **não aplicada**; nenhum banco, Docker, Supabase CLI, `psql` ou
  provider foi acessado.
- Nenhuma tarifa real foi atualizada; a primeira execução do cron fará a
  correção Flare/Sunburst e criará/versionará as linhas necessárias.
- A tabela do admin só consultará as novas colunas/estado após a migration ser
  aplicada; antes disso, ela mostra erro explícito de consulta, sem afirmar que
  está atualizada.
- O parser foi validado contra o documento real em leitura única, mas os testes
  são offline/fixtures — não provam disponibilidade contínua da fonte.
- Aplicação autorizada posterior: revisar migration, aplicar no ambiente alvo,
  executar o endpoint com `CRON_SECRET` (ou aguardar o cron), conferir a tabela
  e o estado no `/admin`, e só então fazer a geração manual conjunta com a quick
  anterior.
- Parado para revisão do Codex.
