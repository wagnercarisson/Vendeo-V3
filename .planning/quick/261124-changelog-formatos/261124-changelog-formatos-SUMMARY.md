---
quick_id: 261124-changelog-formatos
date: 2026-11-24
status: complete-local-publication-pending
scope: changelog-editorial
---

# Resultado

Criada `content/changelog/2026-11-24-sua-campanha-em-mais-de-um-formato.md`.

A entrada consolida a indicação de formatos pelos chips, a versão vertical a
partir de uma campanha quadrada compatível e a versão quadrada em campanhas
verticais novas compatíveis. Informa custo de 1 crédito por formato adicional,
confirmação antes da operação, preservação da arte/textos anteriores e seleção
e download sem nova cobrança por repetição.

Comunicação voltada ao lojista, sem explicar armazenamento interno nem prometer
elegibilidade de todas as campanhas. A escolha `feature/major/card` dá destaque
leve no painel, sem modal. O seletor existente retorna apenas o anúncio mais
recente; as entradas históricas não foram alteradas.

## Verificação

- Testes do changelog, componentes, estado de leitura, página Novidades e
  catálogos: **13 arquivos / 77 testes PASS**, exit 0.
- Teste de diretório real atualizado para a nova ordem; valida IDs únicos e
  renderização de todas as entradas pelo renderer de Markdown existente.
- Teste do anúncio mais recente confere os dois formatos, custo,
  elegibilidade e ausência de nova cobrança por alternar/baixar novamente.
- Typecheck: exit 0.
- Lint: exit 0.
- Diff-check: exit 0.
- Build, suíte global e inspeção visual autenticada não reexecutados: alteração
  editorial e de testes, sem mudança no renderer ou no comportamento do app.

## Atualização final (2026-11-24)

A entry também registra que o formato quadrado já gerado abre direto na campanha
(sem depender da versão vertical) e que a cobrança aparece como **Geração 1:1**
no extrato de créditos. Os testes do changelog foram estendidos para travar esses
dois pontos. Verificação final: **11 arquivos / 65 testes PASS**, typecheck 0,
lint 0, diff-check 0.

## Publicação e limites

Conteúdo preparado localmente em `main`, sem commit/push/deploy. Não está
incluído automaticamente no deploy que o responsável já estava aguardando.
A publicação desta entrada deve acompanhar a confirmação de disponibilidade
dos formatos em produção; não houve validação de produção nesta quick.

Sem banco, Storage, cobrança, geração, flags, segredos ou migrations.
`.f62-check/` preexistente preservada e não versionada.
