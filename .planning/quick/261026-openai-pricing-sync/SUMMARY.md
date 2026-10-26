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
gap_closure_commit: 99132b1e
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
| 7 arquivos novos/focados | **63/63** |
| Regressão afetada (`ai-cost`, `ai`, `visual-signature`, admin, cron, product-1-1, formatters) sem integrações/guard | **147 arquivos / 2079 passed, 7 skipped** |
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

## Gap closure pós-revisão (commit `99132b1e`)

1. **Cache aplicável não pode ser apagado.** O parser passou a distinguir três
   estados por célula: valor, **não aplicável** (`-`/`—`) e **informação
   ausente** (célula vazia). Entrada/cache/saída textual de modelos textuais e
   entrada/cache/saída de imagem de modelos de imagem são obrigatórias. Cache
   aplicável com `-` falha com `not_applicable_dimension`; célula vazia falha
   com `missing_information`; somente a saída textual de modelo de imagem aceita
   `-` como não aplicável. A falha ocorre antes do apply: GPT-4o com cache `-`
   preserva a tabela inteira. Regressões no parser e no serviço (apply não é
   chamado) cobrem o caso.
2. **Pendência continua destacada durante nova consulta.** A derivação de
   estado agora mantém `failed`/`stale`/`never` quando uma nova tentativa está
   `running`, adicionando `running: true` e `runningSince`; a UI acrescenta
   “Nova consulta em andamento desde [data]”. O aviso só é removido depois de
   um sucesso confirmado. Testes cobrem falha/atraso/nunca confirmada durante
   retry, sucesso fresco + retry e sucesso posterior limpando o aviso.
3. **Clareza da unidade por imagem.** A tabela separada “Preços por unidade de
   imagem” agora informa explicitamente que esses valores são preservados pelo
   versionamento e **não** são conferidos pela sincronização automática; o selo
   de conferência se refere apenas às tarifas por 1M de tokens.
4. **Comentário da migration.** `LOCAL-ONLY` foi substituído por “APLICAÇÃO
   PENDENTE DE AUTORIZAÇÃO — preparada para homolog e produção”.

Releitura real read-only do `pricing.md` continuou extraindo os 7 modelos após a
validação mais estrita. Migration continua **não aplicada**.

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

## Complemento autorizado — middleware e primeira sincronização no homolog

- Autorização humana para correção direta na mesma quick e sincronização no
  homolog, condicionada à compatibilidade com Vercel Hobby. A documentação
  oficial permite 100 jobs/projeto, cada job no máximo uma vez por dia:
  https://vercel.com/docs/cron-jobs/usage-and-pricing (consulta em 2026-10-26).
  O agendamento `0 8 * * *` é UTC; no Hobby pode ocorrer dentro da hora agendada.
- Migration `20261026191931` aplicada anteriormente, sob autorização, somente
  em `G:\Vendeo-Homolog` (Postgres 127.0.0.1:57782): ledger 137 → 138.
  As 17 linhas de pricing e seus valores originais foram preservados na aplicação;
  tabela de tentativas vazia, RLS ativo e RPCs restritas ao service_role.
- A chamada inicial foi bloqueada com 401 pelo middleware, antes do handler:
  nenhuma tentativa nem tarifa foi gravada. A rota exata de pricing foi adicionada
  ao passthrough de sessão; o handler mantém CRON_SECRET obrigatório. Não foi
  liberado um prefixo de rotas. Regressões usam middleware real + handler com
  secret ausente/inválido/válido e caminho vizinho que continua protegido.
- O app local deixou de estar disponível durante a retomada (ECONNREFUSED,
  nenhuma tentativa registrada). Foi iniciado novamente em 127.0.0.1:3000
  para concluir a operação autorizada, sem iniciar/reiniciar Docker.
- Corrigida somente a anotação de retorno do logger fake da suíte de sync,
  incompatível com os tipos atuais do Vitest; nenhuma mudança no logger runtime.
- Primeira sincronização efetiva: HTTP 200, tentativa
  `19397bc9-2b92-4ea9-9008-ebd593592596`, iniciada em
  `2026-10-26T20:14:17.339Z` e concluída em `2026-10-26T20:14:17.552Z`
  (17:14 em America/Sao_Paulo). Resultado confirmado por SELECT read-only:
  **success, 7 modelos, 11 preços conferidos, 9 alterados**.
- Flare/Sunburst low/medium agora persistem, em US$/1M: entrada textual 5,
  cache textual 1,25, saída textual NULL, entrada de imagem 8, cache de imagem 2,
  saída de imagem 30. Valores por unidade foram preservados. GPT-4o e mini
  receberam as tarifas de cache textual 1,25 e 0,075 respectivamente.
- Gates reexecutados: 9 suítes / **74 testes PASS**; TypeScript com
  `--incremental false` exit 0; `npm.cmd run lint` exit 0; diff-check limpo.
  O lint direcionado avisou que os arquivos TS não têm configuração aplicável;
  seu resultado não é prova de lint específico de TypeScript. Build não repetido.
- Sem nova geração/provider pago, recálculo de eventos, alteração remota, push
  ou deploy. O servidor local foi deixado disponível para o teste humano.
- Pendente: usuário recarregar `/admin`, confirmar a apresentação e gerar uma
  assinatura para validar conjuntamente a contabilização de imagem.
