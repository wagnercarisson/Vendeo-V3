---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "10"
type: summary
status: complete
tags: [homolog, vertical, 9-16, gates, flag, recovery, concurrency, audit-exception]
---

# 59-10 — Summary de homologação e fechamento

## Resultado

F59 fechada tecnicamente e em homologação no escopo 9:16, com ressalvas e exclusões
documentadas. Produção não autorizada.

## Evidências principais

- Três campanhas verticais reais entregues (Bolo, Pão de Queijo, Pão Francês) em
  JPEG sRGB 1080×1920, 1 crédito por entrega, miniaturas 162×288.
- 1:1 preservado: 1024×1024, path `product-1-1/.../art-1024.jpg`, miniatura 288×288.
- Ciclo de flag OFF: 503 `format_unavailable`, sem campanha/reserva/provider.
- Recuperação vertical, resolução administrativa, `unknown` → `refunded`, reenvio,
  concorrência de rota e concorrência SQL executados no homolog.
- Geração em andamento concluída com flag OFF.
- Custo do Run B: **calculado por usage e pricing** 0,030441; piloto 0,1107;
  desvio 0,080259; `provider_reported_cost_usd` nulo.
- 53/53 tasks OpenSpec; 69 arquivos / 1196 testes focados; typecheck/lint/OpenSpec
  strict/diff check verdes.
- Build: último `next build` verde com 96 páginas; não reexecutado nesta rodada por
  não haver alteração de código desde então.

## Ressalvas e exclusões

- Bolo: validade na faixa inferior, exceção aceita.
- Pão Francês: “garanti” é erro de entrada.
- Reels: aceito com ressalva observada no Facebook.
- Proteção contra perda de dados no reload/“Limpar dados”: fora da F59, melhoria
  transversal separada.
- Três ajustes de UI: quick pós-F59.
- Auditoria do replay terminal: exceção aceita nesta fase, pendência separada
  `.planning/issues/59-AUDIT-REPLAY-GAP.md`, não corrigida.

## Produção

Gate separado, não executado. Flag de produção não alterada; sem push/deploy.
