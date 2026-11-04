# Copy e composição — `/padarias`

Status: **proposta para revisão**. Nenhum texto abaixo está implementado.
A copy é definitiva para aprovação; se aprovada, deve ser transcrita exatamente.

## 1. Metadata

| Campo | Conteúdo |
|---|---|
| Title | Crie posts e campanhas para padarias com IA \| Vendeo |
| Description | Transforme fotos e informações dos produtos da sua padaria em artes e textos prontos para divulgar nas redes sociais. Sem precisar saber design. |
| Canonical | `https://vendeo.tech/padarias` (somente produção confirmada + origem válida) |
| OG/Twitter | título e descrição acima, locale `pt_BR`, `siteName` Vendeo, imagem `/seo/vendeo-og-1200x630.png` |
| Robots | `index, follow` somente na condição combinada; caso contrário `noindex, nofollow` |

Justificativa: o title cobre “posts” e “campanhas para padarias”, a description
cobre “artes e textos”, “divulgar” e “sem saber design”. Nenhum volume de busca é
afirmado.

## 2. Abertura

**H1**

> Transforme os produtos da sua padaria em campanhas prontas para divulgar.

**Texto de abertura**

> O Vendeo é o aplicativo que cria artes e textos para divulgar os produtos da sua padaria nas redes sociais. Envie uma foto, conte o que quer destacar e receba uma campanha com a identidade da sua loja — sem precisar saber design.

**Grupo de acesso**

- Cadastro fechado: botão principal “Solicitar acesso gratuito” (âncora local para `#padarias-oferta`) e link “Conheça o Vendeo” para `/`.
- Cadastro aberto: “Continuar com Google” e “Continuar com email” como âncoras locais para `#padarias-oferta`, com “Conheça o Vendeo” para `/`.

Não há card, resumo ou expansível na abertura.

## 3. Demonstração principal — bolo

**H2**

> Da foto do bolo à campanha pronta para publicar.

**Rótulo da foto**

> Foto enviada ao Vendeo

**Alt da foto**

> Bolo naked fruit com frutas vermelhas sobre um balcão de padaria

**Rótulo da campanha**

> Campanha criada com o Vendeo

**Alt da campanha**

> Campanha da Panificadora Dona Maria para o Bolo Naked Fruit, com selo Novidade e descrição da massa e do recheio

**Composição**

- Desktop: foto à esquerda, seta discreta no centro, campanha à direita; ambas 1:1, sem recorte.
- Mobile: foto, seta para baixo, campanha; ambas na largura útil.
- Nenhuma legenda adicional, tabela de entrada ou dado de geração.

## 4. Explicação e kit de publicação

**Parágrafo de explicação**

> Uma foto do bolo, o nome da Panificadora Dona Maria e as informações que você quer destacar. O Vendeo reúne esses elementos em uma campanha com a marca da loja, o produto em destaque e uma mensagem pronta para acompanhar a publicação.

**Título do card**

> Além da arte, o texto para acompanhar sua publicação.

**Conteúdo do card — transcrição exata**

| Campo | Texto |
|---|---|
| Título | Bolo Naked Fruit: um destaque à mesa |
| Legenda | Conheça o Bolo Naked Fruit, destaque da vitrine da Panificadora Dona Maria. Com uma apresentação que valoriza cada detalhe, é uma escolha especial para compartilhar bons momentos em família. Qualidade da nossa família para a sua! |
| Hashtags | #BoloNakedFruit #Confeitaria #DestaqueDaVitrine #PanificadoraDonaMaria |
| Chamada | Venha conhecer na loja! |

Formato: `<dl>` com `<dt>` em caixa alta discreta e `<dd>` em texto legível.
Sem botões “Copiar”, sem captura de tela, sem controles.

Nota: `#Confeitaria` integra o kit fornecido e não descreve o Vendeo. A página
segue posicionada como aplicativo para padarias, não como confeitaria.

## 5. Situações comerciais

**H2**

> Crie posts para sua padaria sem começar do zero.

**Introdução**

> A rotina da padaria rende assunto todos os dias. O Vendeo ajuda a transformar o que já acontece na loja em uma campanha pronta para divulgar.

**Três situações — leitura escaneável**

1. **Novidades da vitrine.**
   > Apresente um bolo, um doce ou um produto novo que chegou para vender no balcão.
2. **Fornadas do dia.**
   > Mostre os pães que acabaram de sair e convide o cliente a passar na padaria.
3. **Bolos e encomendas.**
   > Divulgue as opções de bolo e as informações que o cliente precisa para fazer a encomenda.

Nenhuma situação promete agenda, encomenda online, controle de estoque,
publicação automática ou gestão de pedidos.

## 6. Exemplo complementar — pão

**H2**

> Saiu uma fornada? Prepare a divulgação.

**Texto**

> Mostre os pães que acabaram de sair, destaque os produtos disponíveis no dia e convide seus clientes para passar na padaria.

**Alt da campanha**

> Campanha da Panificadora Dona Maria para o Pão Francês Fresquinho, com a chamada “Saiu uma nova fornada, corre!”

**Composição**

- Desktop: texto à esquerda, campanha à direita, centralizados verticalmente.
- Mobile: texto acima, imagem abaixo, na largura útil.
- Somente a campanha final; sem novo antes/depois e sem segundo kit.
- Imagem com `loading="lazy"` e `decoding="async"`.

## 7. Aviso demonstrativo único

Após o exemplo do pão, em `text-xs text-text-secondary`, uma única vez:

> As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas

Sem segunda ocorrência no rodapé ou em qualquer outro bloco.

## 8. Encerramento

**H2**

> Como ficaria uma campanha com os produtos da sua padaria?

**Apoio**

> Sua padaria, sua marca, uma campanha pronta para divulgar.

**Card**

- Um único `OfferCard` compacto, `id="padarias-oferta"`, `tabindex="-1"`,
  `scroll-mt-24`.
- Textos vindos de `public-offer-copy.ts`: resumo, complemento, expansível,
  CTA/apoio fechado e nota.
- Ações reais somente aqui: `/#acesso` com a flag desligada; Google/OAuth e
  `/signup` com a flag ligada.
- Nenhum número, condição ou rótulo da oferta é reescrito nesta página.

## 9. Rodapé da página

- Logo Vendeo.
- “Voltar ao Vendeo” → `/`.
- “Termos de Uso” → `/termos`.
- “Política de Privacidade” → `/privacidade`.
- “Uso Aceitável” → `/uso-aceitavel`.
- “Entrar” → `/login`.
- Mesmas classes, alturas de toque e foco do rodapé de `/floriculturas`.

## 10. Home — única alteração

No rodapé, ao lado do link existente “Floriculturas”:

> Padarias

Destino: `/padarias`. Nenhum outro texto, bloco, imagem, CTA, ordem ou metadata
da home muda.

## 11. Composição visual

### Desktop (≥ 1024 px, conteúdo útil de 976 px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [logo Vendeo]                                              [Entrar]  │
├──────────────────────────────────────────────────────────────────────┤
│ Transforme os produtos da sua padaria em campanhas prontas           │
│ para divulgar.                                                       │
│                                                                      │
│ O Vendeo é o aplicativo que cria artes e textos para divulgar os     │
│ produtos da sua padaria nas redes sociais. Envie uma foto, conte     │
│ o que quer destacar e receba uma campanha com a identidade da sua    │
│ loja — sem precisar saber design.                                    │
│                                                                      │
│ [Solicitar acesso gratuito] [Conheça o Vendeo]                       │
├──────────────────────────────────────────────────────────────────────┤
│ Da foto do bolo à campanha pronta para publicar.                     │
│                                                                      │
│ FOTO ENVIADA AO VENDEO         CAMPANHA CRIADA COM O VENDEO          │
│ ┌───────────────────┐   →    ┌───────────────────┐                   │
│ │   foto 1:1        │        │   campanha 1:1    │                   │
│ │   452 × 452       │        │   452 × 452       │                   │
│ └───────────────────┘        └───────────────────┘                   │
├──────────────────────────────────────────────────────────────────────┤
│ Uma foto do bolo, o nome da Panificadora Dona Maria e as             │
│ informações que você quer destacar. O Vendeo reúne esses elementos   │
│ em uma campanha com a marca da loja, o produto em destaque e uma     │
│ mensagem pronta para acompanhar a publicação.                        │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Além da arte, o texto para acompanhar sua publicação.            │ │
│ │ TÍTULO      Bolo Naked Fruit: um destaque à mesa                  │ │
│ │ LEGENDA     Conheça o Bolo Naked Fruit, destaque da vitrine...   │ │
│ │ HASHTAGS    #BoloNakedFruit #Confeitaria #DestaqueDaVitrine...   │ │
│ │ CHAMADA     Venha conhecer na loja!                              │ │
│ └──────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ Crie posts para sua padaria sem começar do zero.                     │
│                                                                      │
│ A rotina da padaria rende assunto todos os dias. O Vendeo ajuda      │
│ a transformar o que já acontece na loja em uma campanha pronta       │
│ para divulgar.                                                       │
│                                                                      │
│ Novidades da vitrine.   Fornadas do dia.     Bolos e encomendas.     │
│ Apresente um bolo...    Mostre os pães...    Divulgue as opções...   │
├──────────────────────────────────────────────────────────────────────┤
│ Saiu uma fornada? Prepare a divulgação.                              │
│                                                                      │
│ Mostre os pães que            ┌───────────────────────────────┐      │
│ acabaram de sair, destaque    │      campanha do pão 1:1      │      │
│ os produtos disponíveis no    │      468 × 468                │      │
│ dia e convide seus clientes   │      lazy, sem recorte        │      │
│ para passar na padaria.       └───────────────────────────────┘      │
│                                                                      │
│ As lojas e campanhas apresentadas são exemplos demonstrativos e não  │
│ representam lojas reais nem ofertas comerciais válidas               │
├──────────────────────────────────────────────────────────────────────┤
│ Como ficaria uma campanha com os produtos da sua padaria?            │
│ Sua padaria, sua marca, uma campanha pronta para divulgar.           │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ 28 dias gratuitos e até 20 créditos.                             │ │
│ │ Sem cartão de crédito. Oferta para novas contas elegíveis.       │ │
│ │ [Solicitar acesso gratuito] [Conheça o Vendeo]                   │ │
│ │ Como funciona o teste gratuito?                                  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ [logo]  Voltar ao Vendeo  Termos  Privacidade  Uso Aceitável  Entrar  │
└──────────────────────────────────────────────────────────────────────┘
```

Classes de referência: `max-w-5xl px-6`, `font-heading`, `text-text-primary`,
`text-text-secondary`, `border-border`, `bg-bg-deep`, `accent-green`. Nenhuma
altura é forçada; o texto não preenche vazio.

### Mobile (390 px, largura útil de 342 px)

Ordem: abertura → CTAs → demonstração (foto, seta, campanha) → explicação → kit →
situações empilhadas → exemplo do pão (texto, imagem) → aviso → encerramento →
card → rodapé. Imagens ocupam a largura útil, sem overflow.

## 12. Contratos de imagem

| Asset | Variantes | Dimensão | `sizes` provisório |
|---|---|---|---|
| `foto-bolo-naked-fruit` | `-480w.webp`, `-1024w.webp` | 480×480, 1024×1024 | `(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))` |
| `campanha-bolo-naked-fruit-dona-maria` | `-480w.webp`, `-1024w.webp` | 480×480, 1024×1024 | idem |
| `campanha-pao-frances-fresquinho-dona-maria` | `-480w.webp`, `-1024w.webp` | 480×480, 1024×1024 | `(min-width: 1024px) 468px, (min-width: 768px) calc(50vw - 44px), min(448px, calc(100vw - 48px))` |

Regras:

- `src` é a variante 1024w; o 480w vem primeiro no `srcset`.
- `width` e `height` explícitos; caixa 1:1.
- Demonstração principal: `eager`, `decoding="async"`, sem `fetchpriority="high"`
  enquanto o LCP medido for o H1.
- Exemplo do pão: `lazy`, `decoding="async"`.
- Nenhum upscale; DPR 3 fica limitado ao original de 1024 px.
- Pesos finais ≤ original correspondente (1.877.770 B / 291.804 B / 266.104 B).

## 13. Frases proibidas nesta página

- “Agende seus posts.”
- “Publique automaticamente.”
- “Calendário editorial.”
- “Anúncios pagos” / “tráfego pago” / “impulsione”.
- “Aumente suas vendas” / “mais clientes” / “mais alcance”.
- “Gestão de redes sociais.”
- “Somos uma agência.”
- “Os mais buscados.”
- “Grátis para sempre.”
- Qualquer preço em texto, metadata ou JSON-LD.

## 14. Critérios de aceite da copy

- A copy acima aparece exatamente como transcrita.
- O kit tem quatro campos e nenhum botão “Copiar”.
- O aviso aparece uma única vez, após o exemplo do pão.
- Nenhuma promessa de funcionalidade não existente.
- Nenhum dado de loja real, avaliação, endereço, telefone ou preço em HTML.
- O Vendeo é descrito como aplicativo de criação de campanhas, artes e textos,
  nunca como padaria, confeitaria, agência ou gestor de anúncios.
