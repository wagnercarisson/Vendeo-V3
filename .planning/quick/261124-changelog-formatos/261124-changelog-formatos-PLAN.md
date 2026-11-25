---
quick_id: 261124-changelog-formatos
title: Comunicar os formatos de campanha no changelog
date: 2026-11-24
status: complete
entrypoint: /gsd-quick
scope: changelog-editorial
---

# Plano

Pedido: investigar as entregas de formatos e comunicar a novidade ao lojista.

## Fontes e limites

- Guia: `docs/changelog-update.md` e contrato `changelog-content`.
- Entregas: chips de formatos, F62 (1:1 para 9:16) e quick 261124-pmo
  (1:1 a partir de uma campanha nova 9:16 compatível).
- Custo da versão adicional: 1 crédito, com confirmação antes da operação.
- A versão e os textos já entregues permanecem preservados.
- Não anunciar elegibilidade universal, adaptação de qualquer campanha antiga
  ou geração de IA na entrega do quadrado. Usar comunicação de produto, sem
  detalhes de armazenamento, tabelas ou operações financeiras.
- Deploy funcional em andamento segundo o responsável; esta edição local não
  publica conteúdo nem comprova disponibilidade em produção.

## Tarefas

- [x] Criar uma entrada consolidada de formatos, com orientação de uso,
  restrição a campanhas compatíveis e custo explícito.
- [x] Usar `feature`, `major`, `card`: destaque leve no painel, sem modal.
  Preservar as entradas históricas; o leitor escolhe apenas o anúncio mais recente.
- [x] Atualizar os testes da entrada/anúncio mais recente e validar o Markdown real.
- [x] Executar testes afetados, typecheck, lint e diff-check; registrar resultados.

Sem banco, Storage, geração, cobrança, flags, segredos, migration, commit,
push ou deploy. Preservar `.f62-check/`.
