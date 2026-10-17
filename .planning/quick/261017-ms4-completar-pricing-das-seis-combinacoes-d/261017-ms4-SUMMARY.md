---
id: 261017-ms4
status: complete
date: 2026-10-17
---

# Readiness dos seis pares na vendeo-homolog — corrigida

## Causa e correção

O catálogo e os seletores já ofereciam três modelos × low/medium. O admin também já exibia cobertura incompleta como aviso (warn-not-block, conforme contrato). Não havia defeito do seletor a corrigir: faltavam as quatro linhas de pricing por qualidade de Flare/Sunburst no banco restaurado. Somente gpt-image-2 low/medium estavam preparadas no piloto anterior.

Quick iniciada por `gsd-tools.cjs init quick`, executada inline. Não reabre a fase 56.2.5 nem incrementa seus contadores. O responsável pediu a correção imediata antes dos testes manuais; não foi aberta outra fase/change.

Script: `scripts/f56-2b2c/complete-homolog-image-pricing.mjs` (dry-run com ROLLBACK por padrão; `--apply` para COMMIT). Foram inseridas quatro linhas ausentes pela RPC versionada `admin_set_ai_model_price`, com ator admin existente, fonte e cálculo. Não houve alteração de migrations ou código de runtime/UI. Linhas existentes, inclusive pricing legado com quality NULL, foram preservadas.

| Modelo | Low (USD estimados/chamada) | Medium (USD estimados/chamada) |
|---|---:|---:|
| gpt-image-2 | 0,042 (preservado) | 0,136 (preservado) |
| gpt-image-2.5-flare | 0,036 (novo) | 0,044 (novo) |
| gpt-image-2.5-sunburst | 0,036 (novo) | 0,044 (novo) |

## Fonte e distinção tarifa × estimativa

Fontes oficiais consultadas em 2026-10-17:

- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
- https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
- https://developers.openai.com/api/docs/guides/image-generation
- Calculadora oficial carregada pelo guia: https://developers.openai.com/_astro/GptImageTokenCalculator.react.C3_24G3l.js

Flare e Sunburst compartilham a opção de calculadora GPT Image 2.5. Em 1024×1024, sua fórmula publicada usa grid 16 para low e 24 para medium: `ceil(grid² × (2.000.000 + 1024²) / 4.000.000)`, resultando em 196 e 439 tokens de saída. O bundle foi apenas lido, não executado.

Tarifas Standard: saída de imagem USD30/M, entrada de imagem USD8/M, entrada de texto USD5/M. Saída estimada: USD0,00588 low / USD0,01317 medium. As quatro novas `image_unit_usd` representam **saída + provisão de entrada USD0,03**, arredondada para cima ao milésimo. São estimativas conservadoras, não tarifa oficial fixa nem garantia de custo máximo. A provisão de entrada segue a convenção já aprovada no piloto. A nota gravada explicita os valores e a diferença entre texto e imagem. As duas estimativas existentes de gpt-image-2 não foram recalculadas nem alteradas.

## Execução e preservação

- Destino: config real `G:\Vendeo-Homolog\supabase\config.toml`, project_id vendeo-homolog; container `supabase_db_vendeo-homolog` running; `.env.local` API http://127.0.0.1:57781 e geração pausada.
- Antes: ledger 126; duas flags false; último evento habilitador revogado/off. Modelos ativos no catálogo.
- Dry-run: seis coberturas positivas, ROLLBACK.
- Apply: quatro linhas ausentes, COMMIT; pós-consulta confirma seis preços vigentes atribuídos a admin.
- Nova execução dry-run/replay: seis coberturas; nenhuma nova linha necessária; ROLLBACK.
- A transação compara snapshots de par ativo, singleton de gasto (todos os campos), flags, preços legados e contagens de autorizações/chamadas/campanhas/migrations. Divergência aborta; nada é restaurado por sobrescrita.
- Depois: par preservado gpt-image-2/medium → gpt-image-2/low; cap USD1,00, spent USD0,156; flags false; ledger126. Nenhuma nova autorização, crédito, campanha ou geração. `.env.local`, chave, pausa e `.dev.log` não alterados.
- Sem reset, deploy, remoto ou provider de geração. Orçamento adicional USD2 da sessão manual não foi configurado nesta correção.

## Evidência por método

1. **Banco real:** leitura das seis linhas persistidas; transação local com pós-condições, sem fixtures de campanha.
2. **Serviço real de pricing:** prova opt-in read-only com `VENDEO_HOMOLOG_PRICING_PROOF=1`; lê as seis linhas do Docker e as injeta por adapter de transporte no serviço produtivo; testa as 36 combinações de principal/fallback e estimativas exatas. 41/41. Não é HTTP/browser ponta a ponta.
3. **Admin/render:** seleção de todas as seis combinações nos campos principal e fallback com cobertura completa; sem provider e sem alterar o par real.
4. **Wire do adapter:** seis testes parametrizados garantem modelo e qualidade exatos na chamada `images.edit` do SDK simulado. Inclui regressões de gateway e legado.
5. **Conta real, somente metadados:** GET `/v1/models/{id}` para os três modelos com a chave local existente, sem imprimi-la: HTTP200 e ID esperado nos três. Isso comprova visibilidade na conta; não comprova geração paga bem-sucedida em cada qualidade. Não foi chamado endpoint de geração.
6. Focados: sete arquivos / **132 testes verdes**. Typecheck exit0, lint completo exit0, diff-check limpo. Sem build adicional: nenhum arquivo de runtime da aplicação foi alterado (script operacional + testes + registro).

## Limite e próximo passo

As seis opções estão selecionáveis e com pricing executável. Não se promete equivalência de qualidade, custo ou sucesso entre modelos; a geração anterior validou gpt-image-2/medium. As próximas 2–3 gerações manuais testarão as escolhas sob o orçamento aprovado, após preparar a janela local separadamente. Fluxo permanece desligado.
