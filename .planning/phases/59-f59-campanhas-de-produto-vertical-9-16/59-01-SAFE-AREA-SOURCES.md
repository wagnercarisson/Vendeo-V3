# 59-01 — Fontes das áreas seguras (Task 1.8 / D-08/D-09)

**Data da conferência:** 2026-11-04
**Responsável:** execução do plano 59-01 (Wave 1), sem chamada paga e sem operação de banco.
**Política avaliada:** `safe-area-9-16-v1` (`src/lib/product-vertical-9-16/safe-area.ts`).

## Vocabulário de veredito

| Veredito | Significado |
|---|---|
| `documented` | Número confirmado em fonte oficial citável (texto/tabela oficial lido nesta sessão). |
| `conservative` | Recomendação do Vendeo, deliberadamente mais restritiva que a referência. |
| `pending` | Valor ainda não confirmado em fonte oficial citável; permanece em observação até captura/sonda em homolog. |

Nenhum valor desta rodada alcançou `documented`: a fonte oficial foi localizada, mas o conteúdo
numérico não pôde ser lido (renderização por JavaScript). O vocábulo acima fica registrado para
que a próxima conferência não invente uma classificação nova.

## Fonte oficial consultada

- **URL:** `https://www.facebook.com/business/help/980593475366490`
- **Título retornado:** “About text overlays and the safe zone for ads in Stories and Reels |
  Meta Business Help Center”.
- **Descrição retornada:** “Discover tips for using text overlays and the safe zone in Meta ad
  images for Reels and Stories.”
- **Resultado da leitura:** a página respondeu, mas o corpo do artigo é carregado por JavaScript.
  O HTML entregue ao cliente não contém a tabela de percentuais/pixels. Portanto os números
  **não foram confirmados na fonte oficial** nesta sessão.

Fontes secundárias consultadas apenas como indício (não elevam o veredito a `documented`):
resultados de busca de 2026 que citam, de forma convergente, topo 14% (269 px), base 35%
(672 px), laterais 6% (65 px) em 1080 × 1920, e um recorte inferior direito associado à pilha de
controles do Reels. Elas não substituem a fonte oficial.

## Veredito por valor da política

| Zona | Valor na política | Base | Fonte consultada | Veredito |
|---|---|---|---|---|
| Topo | 14% / 269 px (entrega) | percentual da altura | Meta Business Help Center (não legível) + indícios secundários | `pending` |
| Base | 35% / 672 px (entrega) | percentual da altura | Meta Business Help Center (não legível) + indícios secundários | `pending` |
| Laterais | 6% / 65 px (entrega) | percentual da largura, cada lado | Meta Business Help Center (não legível) + indícios secundários | `pending` |
| Canto inferior direito | 30% × 40% / 324 × 768 px (entrega) | percentual da largura × altura | decisão de produto do Vendeo para a pilha de controles | `conservative` |
| Validação geral | — | — | sobreposições reais de Stories/Reels em homolog | `pending` |

## Coerência com o código

`SAFE_AREA_POLICY` em `src/lib/product-vertical-9-16/safe-area.ts` declara:

- `top.provenance = "pending"`, `bottom.provenance = "pending"`, `sides.provenance = "pending"`;
- `bottomRight.provenance = "conservative"`;
- `validation = "pending"`.

O documento **não altera** a política v1: os literais de entrega (269/672/65/324 × 768) e os
percentuais (14/35/6/30/40) permanecem congelados. Uma futura confirmação oficial deve gerar nova
versão da política (`v2`), sem alterar campanhas já congeladas.

## Limites explícitos

- A política é orientação de composição do Vendeo; ela não representa cobertura integral de todas
  as superfícies, redes ou posicionamentos.
- O prompt deve continuar tratando o canto inferior direito como recomendação conservadora com
  validação pendente, nunca como regra homologada.
- A validação visual com sobreposições reais (Stories e Reels) continua pendente e pertence ao
  gate de homologação, fora desta wave.
