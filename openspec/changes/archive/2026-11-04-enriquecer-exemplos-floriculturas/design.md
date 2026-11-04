## Context

`/floriculturas` é um Server Component com copy estática e dois exemplos visuais
aprovados: a foto sintética da orquídea e a campanha da Donna Flor. O bloco
“Crie posts para sua floricultura sem começar do zero.” hoje tem título e um
parágrafo corrido, sem imagem. A composição aprovada troca o parágrafo por uma
lista de três itens e acrescenta o exemplo complementar. O encerramento tem
título, apoio, um único card de oferta e o grupo de acesso.

A campanha da Flor Kalandiva já foi aprovada como arte final (1024×1024 JPEG,
242.089 B) e contém, na própria imagem, marca, produto, preço “R$ 4,99”, condição
“Enquanto durarem os estoques” e “Imagem meramente ilustrativa”. Não há geração,
provider ou crédito envolvidos.

**Conflito de spec identificado:** `floriculturas-demonstration-page` congela um
único par demonstrativo, a copy exata (sem os novos textos) e duas variantes por
imagem. A mudança exige atualização mínima dessa spec, sem tocar nas demais.

## Goals / Non-Goals

**Goals**

- Enriquecer apenas o bloco de criação de posts com um exemplo complementar.
- Manter título do bloco, título do encerramento e todo o restante da página.
- Preservar a imagem aprovada integralmente, sem recorte ou ocultação.
- Entregar duas variantes WebP responsivas, legíveis e sem upscale.
- Manter aviso demonstrativo único, CTAs, card, âncora, metadata e indexação.
- Manter o custo zero: nenhuma geração, provider ou crédito.

**Non-Goals**

- Galeria, carrossel, modal, novo antes/depois ou kit de textos.
- Alterar home, oferta, acesso, flags, regras de negócio ou navegação.
- Transformar o preço da arte em oferta do Vendeo ou dado comercial da página.
- Criar nova fase, migration, dependência, backend ou automação.
- Commit, merge, push ou deploy nesta rodada.

## Decisions

### D1 — Arquivo-fonte fora de `public/`

O JPEG original permanece intacto em `Downloads` e é copiado para
`.planning/quick/261104-kal-.../evidence/source/`, com dimensões, bytes e
SHA-256 registrados. O site serve apenas as variantes WebP. Isso mantém a
reprodução dos testes independente de caminhos locais e evita publicar o original.

### D2 — Aviso demonstrativo único ao fim do conjunto

O aviso aprovado continua com o mesmo texto e uma única ocorrência. Passa para o
fim do bloco enriquecido, imediatamente após a campanha Kalandiva, cobrindo os
dois exemplos. Não há segunda advertência, novo texto de aviso nem repetição no
rodapé.

### D3 — Duas variantes 480w/1024w

A coluna da imagem mede ~468 px CSS em 1440 e ~342 px em 390. 480w cobre 1x e
1024w cobre 2x. Em DPR 3, a resolução fica limitada pelo original de 1024 px, sem
upscale; a legibilidade real do preço e da condição será conferida na captura
mobile. O `sizes` final é reconciliado com a largura medida no navegador; o valor
provisório é
`(min-width: 1024px) 468px, (min-width: 768px) calc(50vw - 48px), min(448px, calc(100vw - 48px))`.

### D4 — Alt sem repetir o valor

O alt descreve a campanha e a presença de preço/condição, sem escrever “R$ 4,99”
em HTML. O valor permanece apenas na arte, fora de metadata, JSON-LD e copy.

### D5 — Um componente dedicado, sem estado

`offer-example.tsx` renderiza `h3`, parágrafo e `<img>`. Não recebe estado, não
busca dados, não tem controles e não cria IDs. A página apenas o posiciona.

## Risks / Trade-offs

- **Preço interpretado como oferta do Vendeo.** Mitigação: o preço integra uma
  arte demonstrativa exibida dentro de um bloco de exemplo, coberto pelo aviso
  único; nenhum texto, metadata ou dado estruturado o apresenta como oferta do
  Vendeo.
- **Legibilidade insuficiente em telas pequenas.** Mitigação: imagem ocupa a
  largura útil (342 px), sem redução artificial; captura e medição em 390 px.
- **Aviso distante do par da orquídea.** Mitigação: a spec passa a associá-lo ao
  conjunto de exemplos; ele fica imediatamente após o exemplo com preço.
- **Divergência de `sizes`.** Mitigação: medir a largura real antes de fechar e
  ajustar o valor; o contrato de variantes não muda.
- **Regressão em CTAs/card.** Mitigação: testes existentes permanecem e cobrem
  card único, âncora, `/#acesso` e `/signup`.

## Migration Plan

Sem migration. Alteração de página, componente, assets e testes. Deploy fica fora
desta rodada.

## Open Questions

Nenhuma bloqueante. D1–D4 aguardam confirmação na revisão do plano.
