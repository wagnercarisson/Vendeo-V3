---
id: 261026-openai-pricing-sync
status: complete
date: 2026-10-26
branch: feature/fase-47-1-modelos-assinatura-visual
type: quick
---

# Quick 261026 — Atualização diária das tarifas OpenAI + dashboard

## Inventário coberto

Modelos OpenAI usados pelo runtime/catálogo atual:

| Modelo | Tipo | Qualidades | Dimensões obrigatórias |
|---|---|---|---|
| gpt-4o | texto/visão | null | entrada textual, cache textual, saída textual |
| gpt-4o-mini | texto/visão | null | entrada textual, cache textual, saída textual |
| gpt-5.5 | texto + orquestrador | null | entrada textual, cache textual, saída textual |
| gpt-6-luna | texto/visão + orquestrador | null | entrada textual, cache textual, saída textual |
| gpt-image-2 | imagem | null, low, medium | entrada textual, cache textual, entrada de imagem, cache de imagem, saída de imagem |
| gpt-image-2.5-flare | imagem | low, medium | idem |
| gpt-image-2.5-sunburst | imagem | low, medium | idem |

Total: 7 modelos, 11 linhas de pricing (qualidades repetem a mesma tarifa por token; a diferença de consumo fica em `vs-image-usage-v1`).

## Contrato de preços

- A tabela oficial distingue, nos modelos de imagem, linhas `Text` (input/cached input) e `Image` (input/output/cached input).
- `input_token_usd_per_1m` = entrada textual; `cached_input_token_usd_per_1m` = cache textual; `output_token_usd_per_1m` = saída textual.
- `image_token_usd_per_1m` = saída de imagem (mantido como dimensão existente).
- Novas colunas aditivas: `image_input_token_usd_per_1m` e `image_cached_input_token_usd_per_1m`.
- `image_unit_usd` (preço por imagem) não é extraído da tabela por token; é preservado no versionamento.
- A correção de Flare/Sunburst (input 5 textual + image input 8 + image cache 2) será aplicada pelo cron após a migration; nenhum dado é alterado nesta execução.

## Entregáveis

1. Parser determinístico da tabela Standard (ignora Batch/Flex/Fast/Ultrafast).
2. Fetch público com timeout, limite de tamanho, hash e evidências ETag/Last-Modified; redirects rejeitados.
3. Tabela `pricing_sync_attempts` + RPCs atômicas de start/apply/fail; migration criada e não aplicada.
4. Cron `/api/cron/sync-openai-pricing` com `CRON_SECRET` e agendamento diário.
5. Seção “Tarifas OpenAI” no `/admin`, antes de “Últimas Ações”, com valores persistidos e estado da sincronização.
6. Testes offline, typecheck, lint, build e diff-check.

## Fora do escopo

### Complemento autorizado: acesso do cron pelo middleware

Após aplicação autorizada da migration no homolog, a primeira chamada HTTP foi
bloqueada pelo middleware de sessão (401), antes de iniciar qualquer tentativa.
O usuário autorizou corrigir diretamente este gap na mesma quick e executar uma
sincronização no homolog. Adicionar somente a rota exata de pricing ao passthrough;
preservar CRON_SECRET no handler e testar middleware real + handler sem sessão,
com bearer ausente, inválido e válido, além de rota vizinha protegida.
Não autoriza produção, geração paga, push ou deploy.

Aplicar migration, atualizar tarifas reais, banco/Docker/provider, recálculo histórico, edição manual no painel, push/deploy.
