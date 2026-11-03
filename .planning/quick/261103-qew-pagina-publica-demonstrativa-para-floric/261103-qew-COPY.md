---
quick_id: 261103-qew
artifact: copy-e-composicao
status: approved_by_owner
approved_on: 2026-11-03
supersedes: versão anterior desta quick (não usar a copy antiga)
---

# Copy aprovada e composição — `/floriculturas`

> Esta é a única copy válida desta entrega. A versão anterior está substituída.
> Nenhum dado de geração, tabela de entrada ou legenda gerada é exibido.
> Aviso demonstrativo: uma única vez, discreto, junto ao exemplo.

## 1. Copy (texto final)

### 1.1 Abertura

**H1**
> A beleza das suas flores merece uma divulgação de qualidade.

**Abertura**
> Transforme fotos dos seus produtos em campanhas profissionais para divulgar sua floricultura. O Vendeo prepara a arte e o texto com a identidade da sua loja — sem você precisar saber design.

**CTA #1** — conjunto de acesso: `Solicitar acesso free` (verde) + `Conheça o Vendeo` (borda), lado a lado no desktop, empilhados no mobile.

**Link secundário**
> Conheça o Vendeo

→ `/` (mesma aba, topo da home). Mesmo conjunto repetido no encerramento.

### 1.2 Demonstração

**Título**
> Da foto no balcão à campanha pronta para publicar.

**Rótulo da esquerda:** Foto enviada ao Vendeo
**Rótulo da direita:** Campanha criada com o Vendeo

**Alt da foto:** `Orquídea roxa sobre um balcão de floricultura`
**Alt da campanha:** `Campanha da floricultura Donna Flor com a orquídea roxa`

**Aviso demonstrativo** (texto pequeno, uma única vez, abaixo do par):
> As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas

### 1.3 Explicação

> Uma foto da orquídea, o nome da floricultura e as informações que você quer destacar. O Vendeo combina esses elementos em uma campanha com sua marca, apresentação do produto e mensagem para acompanhar a divulgação.

**Card do texto gerado** (ao lado do parágrafo no desktop; abaixo no mobile)

Título do card:
> Além da arte, o texto para acompanhar sua publicação.

Conteúdo exato, em HTML (sem botões “Copiar”, sem captura de interface):

| Rótulo | Conteúdo |
|---|---|
| Título | Orquídea Phalaenopsis: beleza em cada cor |
| Legenda | Em destaque na Floricultura Donna Flor, a Orquídea Phalaenopsis encanta com sua beleza natural. São várias cores para escolher e se encantar — um gesto delicado que transforma qualquer ambiente. |
| Hashtags | #OrquídeaPhalaenopsis #Orquídeas #FloresEmDestaque #FloriculturaDonnaFlor |
| Chamada final | Venha conhecer na loja! |

### 1.4 Segundo bloco

**Título**
> Crie posts para sua floricultura sem começar do zero.

**Texto**
> Um arranjo para presentear, as flores que chegaram à loja ou o destaque da semana. Use as fotos dos seus produtos para criar campanhas e manter sua floricultura presente nas redes sociais.

### 1.5 Funcionamento

**Título**
> Você conhece seus produtos. O Vendeo ajuda a apresentá-los.

1. **Envie a foto do produto.** Escolha a flor ou o arranjo que quer divulgar.
2. **Conte o que deseja destacar.** Informe características, ocasião e preço, quando fizer parte da divulgação.
3. **Gere sua campanha.** Receba a arte e o texto com a identidade da sua loja.
4. **Revise, baixe e publique.** Confira os detalhes e leve a campanha para suas redes sociais.

### 1.6 Encerramento

**Chamada final**
> Como ficaria uma campanha com os produtos da sua floricultura?

**Apoio**
> Comece com uma foto e as informações do que você quer divulgar.

**CTA #2** — mesmo conjunto de acesso do CTA #1 (mesmo fluxo, mesma composição, centralizado no desktop)

### 1.7 Rodapé

Logo Vendeo · `Voltar ao Vendeo` (`/`) · `Termos de Uso` · `Política de Privacidade` · `Uso Aceitável` · `Entrar`
Sem segundo aviso demonstrativo (o aviso fica somente junto ao exemplo).

## 2. SEO

| Campo | Texto |
|---|---|
| URL | `/floriculturas` |
| Title | `Campanhas para floriculturas: crie artes com IA \| Vendeo` |
| Meta description | `Transforme fotos de flores e arranjos em campanhas para divulgar sua floricultura nas redes sociais. Arte e texto com sua marca, sem precisar saber design.` |
| Canonical | `https://vendeo.tech/floriculturas`, emitido somente sob produção confirmada + origem canônica validada |
| OG/Twitter | URL da página + imagem institucional `/seo/vendeo-og-1200x630.png` |

## 3. Composição desktop / mobile

**Ordem (igual nos dois):** header → abertura (H1 + abertura + CTA #1 + link “Conheça o Vendeo”) → demonstração (título + par de imagens + aviso) → explicação + card do texto gerado → segundo bloco → funcionamento → encerramento (chamada + apoio + CTA #2) → rodapé.

### Desktop (≥1024px)
- Container `max-w-5xl px-6`; coluna de leitura `max-w-2xl` para H1, textos e passos.
- Abertura: texto à esquerda, conjunto de acesso logo abaixo (CTA verde + “Conheça o Vendeo” com borda, lado a lado); sem imagem no hero.
- Demonstração: alinhada pelo topo — rótulos na mesma linha e imagens começando na mesma altura; a diferença de altura aparece na base, sem recorte.
- Demonstração: duas colunas `[minmax(0,1fr)_auto_minmax(0,1fr)]` com `gap-6`, seta `ArrowRight` (24px) no centro. Cada coluna ≈ 452px.
  - Esquerda: foto em proporção original (1312×1199 ≈ 1,094:1), `rounded-lg border border-border-light`.
  - Direita: campanha 1:1 em caixa `aspect-square` com `object-contain` (sem corte).
  - Rótulos acima de cada imagem (`text-xs uppercase tracking-wide text-accent-green`); aviso abaixo do par em `text-xs text-text-secondary`, `max-w-3xl`.
- Explicação e card: sequência vertical (parágrafo acima, card abaixo), ambos em `max-w-2xl`; o card não se estica pela largura da página.
- Funcionamento: `ol` com 4 itens, mesmo padrão da home (número em `accent-green`, título `font-heading`, descrição `text-sm`), separadores `border-b border-border`.
- Encerramento: centralizado, `max-w-2xl`, mesmo conjunto de acesso do início.
- Rodapé: borda superior, links em `text-sm`.

### Mobile (<640px)
- Tudo em coluna única; conteúdo `100vw - 48px`.
- Demonstração empilhada: rótulo → foto → `ArrowDown` → rótulo → campanha → aviso.
- Campanha com largura `min(342px, calc(100vw - 48px))`; foto acompanha a mesma largura.
- H1 `text-3xl`, H2 `text-2xl`, corpo `text-base`, passos `text-sm`.
- CTAs em largura total (`max-w-sm`), alvos ≥48px.

### Acessibilidade
- Um único `h1`; `h2` por bloco; `h3` nos passos.
- Setas decorativas com `aria-hidden="true"`.
- Foco visível nos links e botões (`focus:ring-2 focus:ring-accent-blue`).
- Imagens com `alt` descritivo; nenhuma informação transmitida só por cor.

## 4. Imagens — plano de entrega

Fonte (não alterar os originais):
- Foto: `C:\Users\wagne\Downloads\OpenAI Playground 2026-11-03 at 18.28.13.png` — 1312×1199 PNG sRGB, 2.266.014 B.
- Campanha: `C:\Users\wagne\Downloads\orqu_dea_phalaenopsis-2026-11-03 (1).jpg` — 1024×1024 JPEG sRGB, 254.571 B.

Saída (novos arquivos em `public/floriculturas/`, dois WebP por imagem):

| Arquivo | Origem | Dimensão | Papel |
|---|---|---|---|
| `foto-orquidea-balcao-1024w.webp` | foto | 1024×936 | candidato maior |
| `foto-orquidea-balcao-480w.webp` | foto | 480×439 | candidato menor |
| `campanha-donna-flor-1024w.webp` | campanha | 1024×1024 | candidato maior |
| `campanha-donna-flor-480w.webp` | campanha | 480×480 | candidato menor |

- `sizes`: `(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))`.
- Larguras escolhidas pelo layout (~452px CSS) e DPR 2 (≈904px): 1024 cobre 2× com folga; 480 cobre 1× e serve telas menores. Sem upscale; proporção preservada.
- WebP qualidade 82, `effort 6`, `smartSubsample` (mesmo pipeline Sharp já usado na landing). Sem dependência nova.
- LCP: **medido**, não presumido. O elemento vencedor foi o `h1` em desktop (1440×900) e mobile (390×844). Por isso nenhuma imagem recebe `fetchPriority="high"`; ambas ficam `loading="eager"`, sem `lazy`.
- Medição registrada em `evidence/lcp-measurement.json`.
- Registrar na implementação as dimensões e os pesos finais dos quatro arquivos.
