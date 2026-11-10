# Quick 261109-mrc — Copy completa para aprovação

**Rota proposta:** `/ofertas-para-mercados`
**Rótulo do rodapé:** Mercados e mercearias
**Status:** aguardando aprovação antes da implementação.

## 1. Metadata

**Title (aprovado):**

> Crie artes de ofertas para mercados e mercearias | Vendeo

**Description (proposta):**

> Crie artes e textos para divulgar as ofertas do seu mercado, mercearia ou minimercado nas redes sociais. Com a identidade do seu estabelecimento.

**Open Graph / Twitter:**

- `type`: `website`
- `locale`: `pt_BR`
- `siteName`: `Vendeo`
- `url`: `/ofertas-para-mercados`
- imagem: `/seo/vendeo-og-1200x630.png` (1200×630), alt “Vendeo — crie campanhas para redes sociais com IA”
- `twitter.card`: `summary_large_image`

A metadata não contém preço, nome de produto, nome da Mercearia Tio João, “Melitta” nem qualquer dado comercial fictício.

## 2. Header

Padrão público existente:

- logo Vendeo (`/landing/vendeo-logo-dark.webp`, 384×82, `h-9 sm:h-11`);
- link “Entrar” para `/login`;
- sem menu adicional, sem CTA de aquisição no header.

## 3. Abertura

**H1 (aprovado):**

> Sua oferta merece chamar atenção. Sem complicar sua rotina.

**Parágrafo de apresentação (proposto):**

> O Vendeo é o aplicativo que cria artes e textos para divulgar as ofertas do seu mercado, mercearia ou minimercado nas redes sociais. Envie a foto do produto, informe o preço e o que quer destacar, e receba uma campanha com a identidade do seu estabelecimento — sem precisar saber design.

**Grupo de acesso (proposto):**

- âncora local para `#ofertas-mercados-oferta`;
- flag fechada: “Solicitar acesso gratuito” + “Conheça o Vendeo” (`/`);
- flag aberta: “Continuar com Google” + “Continuar com email” lado a lado no desktop, com “Conheça o Vendeo” centralizado abaixo;
- nenhuma ação da abertura inicia OAuth, abre `/signup` ou navega para fora da página.

## 4. Demonstração principal — carne

**H2 (proposto):**

> Da foto do produto à campanha pronta para divulgar.

**Rótulo da foto (aprovado):**

> Foto do produto

**Rótulo da campanha (aprovado):**

> Campanha criada com o Vendeo

Não há parágrafo de apoio entre o par e o próximo bloco. A demonstração exibe apenas título, rótulos e imagens; a explicação consolidada vem logo depois.

**Imagens:**

- foto horizontal do açougue, proporção 3:2, integralmente visível;
- campanha quadrada da carne, proporção 1:1, integralmente visível;
- lado a lado no desktop e no tablet, com a foto à esquerda;
- empilhadas no mobile na ordem foto → seta → campanha.

**Alt da foto:**

> Coxão mole bovino sobre a bancada de um açougue, com peça inteira e fatia à mostra.

**Alt da campanha:**

> Campanha da Mercearia Tio João para o Coxão Mole Bovino, com preço anterior riscado, R$ 39,90/kg em destaque, selo Oferta e validade de 10 a 13 de novembro de 2026.

## 5. Explicação consolidada — aprovada

**H2 (aprovado):**

> Uma oferta clara, com a identidade da sua loja.

**Parágrafo único (aprovado):**

> Você informa o produto, o preço anterior, o preço promocional e o período de validade da oferta. O Vendeo organiza essas informações em uma campanha com o produto em destaque e a identidade da sua loja.

Este é o único parágrafo explicativo após o par. Ele substitui o antigo texto de apoio da demonstração e a explicação anterior, para não enumerar os mesmos atributos duas vezes. Depois dele, a página segue diretamente para o kit.

Não há lista de passos, tutorial de formulário, onboarding, tabela de geração ou explicação extensa de mecânica do aplicativo.

## 6. Kit de publicação — preservar exatamente

**H2 (proposto):**

> Além da arte, o texto para acompanhar a publicação.

**Título (aprovado):**

> Coxão Mole Bovino por R$ 39,90/kg

**Legenda (aprovado):**

> Vai preparar uma refeição caprichada? Aproveite o Coxão Mole Bovino por R$ 39,90 o kg, antes R$ 45,90! Um preço especial pra deixar o almoço ainda mais gostoso. Venha conferir na Mercearia Tio João!

**Hashtags (aprovado):**

> #CoxaoMole #Mercearia #OfertaDoDia #MerceariaTioJoao

**Chamada (aprovado):**

> Confira essa oferta na loja!

O kit é renderizado como HTML, em `<dl>`/`<dt>`/`<dd>`, sem botões “Copiar”, sem captura de tela e sem controles operacionais. Cada campo aparece uma única vez.

O card do kit acompanha a coluna de leitura `max-w-3xl` (antes `max-w-2xl`). A
largura maior foi revisada e aceita explicitamente; somente a copy é preservada
integralmente, não a largura anterior do card.

## 7. Exemplo complementar — café

**H2 (proposto):**

> Outra categoria, a mesma identidade.

**Parágrafo (proposto):**

> A Mercearia Tio João também divulga o café da loja com o mesmo padrão de campanha: produto em destaque, preço legível e a marca do estabelecimento preservada.

**Imagem:**

- campanha quadrada do Café Melitta 500 g Tradicional, 1:1, integralmente visível;
- texto à esquerda e imagem à direita no desktop, verticalmente centralizados;
- no mobile: título → parágrafo → imagem;
- `loading="lazy"` e `decoding="async"` por estar abaixo da dobra;
- sem segundo par antes/depois e sem segundo kit de publicação.

**Alt da imagem:**

> Campanha da Mercearia Tio João para o Café Melitta 500 g Tradicional, com preço promocional em destaque e a marca da loja.

## 8. Aviso demonstrativo único — texto aprovado

Uma única ocorrência, imediatamente após o exemplo do café, cobrindo os dois exemplos:

> As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas. As marcas de produtos pertencem aos respectivos titulares. O Vendeo não possui vínculo, parceria, patrocínio ou endosso das marcas ou dos fabricantes utilizados para ilustrar as campanhas.

O aviso cobre também a Melitta. Não é duplicado no rodapé, no card, na abertura ou em qualquer outro bloco.

## 9. Encerramento

**H2 (proposto):**

> Como ficaria uma campanha com a oferta da sua loja?

**Texto de apoio (proposto):**

> Sua oferta, sua marca, uma campanha pronta para revisar e publicar.

**Card:**

- um único `OfferCard` compacto, `id="ofertas-mercados-oferta"`, `tabindex="-1"`, `scroll-mt-24`;
- resumo, complemento, expansível, condições e nota de estado fechado vêm de `public-offer-copy.ts`;
- flag fechada: CTA real para `/#acesso` + “Conheça o Vendeo” (`/`);
- flag aberta: Google/OAuth + email (`/signup`) lado a lado no desktop, com institucional abaixo;
- mobile sem amontoamento: ações empilhadas em largura total, mantendo altura mínima de 48 px;
- nenhum outro card de oferta na página.

## 10. Rodapé

Componente compartilhado, `currentPath="/ofertas-para-mercados"`, `context="marketing"`.

Lista central proposta, nesta ordem:

| Rótulo | Destino |
|---|---|
| Floriculturas | `/floriculturas` |
| Padarias | `/padarias` |
| Mercados e mercearias | `/ofertas-para-mercados` |
| Campanhas sem complicação | `/campanhas-para-sua-loja` |

O destino atual recebe `aria-current="page"`. Os demais links institucionais, legais, “Voltar ao Vendeo” e “Entrar” permanecem como estão.

## 11. Composição desktop / tablet / mobile

### Desktop (1440×900)

- Container `max-w-5xl` com `px-6`; conteúdo útil de 976 px.
- Abertura em coluna de leitura `max-w-3xl`, alinhada à esquerda.
- Demonstração principal em grade centrada de três colunas: no tablet, `3fr/4fr`; no desktop, `minmax(0,360px) auto minmax(0,480px)`; `gap-6`.
- Rótulo da foto imediatamente acima da imagem, acompanhando a centralização vertical; rótulo da campanha no topo da coluna.
- Foto menor, com no máximo 360 px, verticalmente centralizada; campanha em destaque, com no máximo 480 px.
- Seta centralizada somente entre as áreas visuais, sem considerar os rótulos.
- Títulos com `text-balance` e parágrafos com `text-pretty`, sem reduzir fontes, inserir quebras manuais ou forçar `nowrap`.
- Explicação e kit em coluna `max-w-3xl`.
- O card do kit foi alargado de `max-w-2xl` para `max-w-3xl` nesta rodada; a
  copy e os campos permanecem exatamente os aprovados. O alargamento é aceito
  explicitamente, sem tratar o card como “preservado” na largura anterior.
- Café em duas colunas: texto à esquerda, imagem à direita, centralizados verticalmente.
- Aviso em `max-w-3xl`, tipografia secundária.
- Encerramento centralizado em `max-w-2xl`; card único com largura confortável.
- Títulos com `max-w-3xl`/`max-w-4xl` para não quebrar em linhas excessivas.

### Tablet (834×1112)

- Mesma grade da demonstração, reduzida proporcionalmente.
- Café mantém duas colunas.
- Nenhuma colisão entre rótulos, imagens, seta e textos.
- Nenhum overflow horizontal.

### Mobile (390×844)

- Tudo empilhado em coluna única.
- Foto → seta para baixo → campanha.
- Imagens com largura limitada ao conteúdo, sem corte.
- Café: texto → imagem.
- Kit em coluna única, com rótulos e valores legíveis.
- Card final com ações empilhadas em largura total.
- Rodapé com quebra natural e sem overflow.

## 12. Contrato de imagens

| Imagem | Origem | Variantes | Largura de exibição | Carregamento |
|---|---|---|---:|---|
| Foto do açougue | PNG 1536×1024 | 480×320, 1024×683 | até 360 px desktop; ~306 px tablet; até 420 px mobile | `eager` / `decoding="async"` |
| Campanha da carne | JPEG 1024×1024 | 480×480, 1024×1024 | até 480 px desktop; ~408 px tablet; até 420 px mobile | `eager` / `decoding="async"` |
| Campanha do café | WebP 1024×1024 existente | 480×480 existente + base 1024×1024 | ~468 px desktop; ~373 px tablet; até 420 px mobile | `lazy` / `decoding="async"` |

Regras:

- `src` aponta para a maior variante; `srcset` lista 480w e 1024w em ordem crescente;
- `sizes` derivado das larguras reais acima;
- `width`/`height` explícitos para reservar espaço;
- proporções preservadas, sem `object-cover` e sem upscale;
- nenhuma imagem recebe `fetchpriority="high"` antes da medição local de LCP;
- os originais ficam fora de `public/`, com dimensões, bytes e SHA-256 registrados em `evidence/source/`.

## 13. Frases e escolhas proibidas

Não usar:

- “loja pequena”;
- “começar do zero” ou “tela em branco”;
- “ofertas agressivas” como expressão central;
- promessa de vendas, conversão, alcance, tráfego, posicionamento ou resultado garantido;
- “publicação automática”, “publique automaticamente” ou integração com redes sociais;
- explicações extensas de formulário, onboarding, créditos ou mecânica interna;
- “foto tirada com celular”, “capturada por celular” ou equivalente;
- alegações de rastreabilidade técnica, dados de geração, custo, provider ou advertências públicas sobre a adaptação do par demonstrativo;
- preço, nome de produto, nome de loja ou marca em title, description, canonical, OG ou JSON-LD;
- “encarte”, “tabloide”, “catálogo multiproduto” ou “gestor de tráfego” como posicionamento do Vendeo.

Não afirmar que a foto foi realmente capturada por celular. A foto é tratada apenas como “Foto do produto”.

## 14. Critérios de aceite da copy

1. H1, rótulos, kit e aviso exatamente como acima.
2. Um único `h1`; títulos com hierarquia coerente.
3. A demonstração não tem parágrafo de apoio; a explicação consolidada aparece uma única vez após o par, antes do kit.
4. O rótulo da foto fica imediatamente acima da imagem; o rótulo da campanha permanece no topo da coluna.
5. O card do kit acompanha `max-w-3xl`; o alargamento é aceito explicitamente, mantendo a copy exata.
6. Um único card de oferta, no encerramento.
7. Um único aviso demonstrativo, após o exemplo do café.
8. Nenhum botão “Copiar”.
9. Nenhum preço em metadata, texto fora do kit/artes ou JSON-LD.
10. Nenhuma promessa de venda, automação, anúncio ou posicionamento.
11. Nenhuma menção a “loja pequena”, “começar do zero” ou “tela em branco”.
12. Nenhuma alegação sobre captura por celular.
13. A Mercearia Tio João é apresentada apenas como exemplo demonstrativo; a Melitta é coberta pelo aviso único.
