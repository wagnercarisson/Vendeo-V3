---
phase: 48.2.6-validacao-experimental-produto-intencoes-1-1
status: ready
checkpoint_a: approved_local_readiness_only
readiness_scope: local-only
blocked: false
supabase_cli_version: 2.104.0
provider_calls: 0
paid_generations: 0
remote_reads: 0
---

# F48.2.6 — Readiness local-only do UAT

## Resultado

**Status: `ready` para readiness local e preparação documental.** CHECKPOINT A está aprovado somente nesse escopo; não houve provider, consulta remota, geração ou execução de run.

## Evidência da barreira local

| Verificação | Resultado |
|---|---|
| CLI Supabase | `npx --no-install supabase --version` → `2.104.0`. |
| Stack local | `npx --no-install supabase status -o env` → exit 0. API `http://127.0.0.1:54321`, DB `127.0.0.1:54322`, Studio `127.0.0.1:54323`, Inbucket `127.0.0.1:54324`; somente protocolo/host/porta foram registrados, sem chaves. |
| App/admin em localhost | `.env.local` indica `VENDEO_LAB_ENABLED=true` e Supabase `http://127.0.0.1:54321`; `getLabEnvironment()` permite loopback e bloqueia hosts Supabase de produção. Probe HTTP somente a `127.0.0.1:3100/admin/laboratorio/bancada` respondeu `302` por falta de sessão admin (guard esperado); server iniciado explicitamente em loopback e encerrado após o probe. |
| Manifesto local | `fixtures/lab/bench/stores.json` contém NovaTek Eletrônicos e Adega Mestre das Geladas; não foi editado nem reimportado. |
| Lojas materializadas no Supabase local | Consulta `npx --no-install supabase db query --local --output json` (somente SELECT nos IDs do manifesto): NovaTek `visual_signature`, perfil synced e assinatura ativa; Adega `logo`, perfil synced e asset de marca ativo. Nenhuma URL/segredo foi consultado ou exibido. |

## Pré-requisitos de preset, pricing e confirmação

- Preset `gpt-image-2.5-sunburst-medium`: enabled no registry, provider `openai`, protocol `images`, size `1024x1024`; `resolveBenchPreset` e allowlist local passaram.
- `resolveBenchCost` no pricing local devolveu `estimatedUsd: null`, `coverage: partial`, `mode: token_based`, `costSource: bench_local_pricing`, versão `2026-10-bench-3`. Estimativa numérica indisponível para Sunburst medium é estado suportado, não bloqueio; partial não é custo total nem teto.
- `OPENAI_BENCH_API_KEY`: estado **present** conferido sem ler/exibir o valor. Não foi usada para inicializar cliente ou chamar provider.
- Contrato UI `exibe a estimativa e exige confirmação sem POST` passou (1 teste); botão abre confirmação individual e `runCalls` permanece zero. Nenhum `POST /runs` final foi enviado.

## Operações explicitamente não realizadas

- Nenhuma consulta remota. A única leitura de tabela foi `SELECT` contra Supabase local com `--local`, descrita acima.
- Nenhuma chamada a provider, validação de valor de credencial, geração, custo cobrado ou execução de run. O cálculo local de estimate retornou `null`/`partial`.
- Nenhum upload, mutação local de loja/manifesto, migration ou `db push`.

## Resultado operacional e limites

Readiness local passou para o escopo permitido. Os nomes reais dos produtos, imagens de cada slot e resultados UAT permanecem por preencher pelo usuário; não foram inferidos. O Plano 09 pode preparar apenas os templates documentais. A aplicação local respondeu ao endpoint admin por loopback com 302 por ausência de sessão, sem iniciar login ou consultar outro host; o guard admin permanece aplicado. Nenhum slot/run foi preparado ou enviado.

O destino dos quatro fetches históricos do Plano 06 continua **não determinado**; os gates desta readiness não reinterpretam esse evento.
