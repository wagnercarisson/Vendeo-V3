---
quick_id: 261103-qew
artifact: copy-e-proposta-visual
status: awaiting_approval
created: 2026-11-03
brand: Donna Flor (fictícia)
product_photo: orquídea roxa sintética (arquivo pendente)
campaign: campanha demonstrativa gerada no Vendeo (arquivo pendente)
---

# Copy e proposta visual — `/floriculturas`

> Nada aqui foi publicado. Não há depoimento, cliente real, resultado comercial ou número inventado.
> Nenhum dado de geração (produto, preço, oferta, legenda) foi inventado: onde ele é necessário, está marcado como **PENDENTE**.

## 1. Identificação demonstrativa (obrigatória e discreta)

**Aviso de topo (texto pequeno, abaixo do H1):**
> Exemplo demonstrativo. A foto de orquídea foi criada artificialmente e a floricultura Donna Flor é fictícia — não representa uma loja, cliente ou resultado real.

**Aviso de rodapé (reutilizando o mesmo tom da home):**
> As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas. A foto deste exemplo é sintética e a marca Donna Flor é fictícia.

## 2. Texto completo da página

### 2.1 Apresentação

**H1:** Sua foto vira uma campanha pronta para divulgar sua floricultura

**Subheadline:**
> O Vendeo transforma a foto de um produto e algumas informações da loja em uma campanha com arte e texto, pronta para você revisar e publicar — sem precisar saber design.

**Parágrafo curto:**
> Você informa o básico. O Vendeo monta a peça: composição, marca, chamada e legenda. Você confere antes de publicar.

**Aviso de demonstração** (bloco 1).

### 2.2 Foto enviada / campanha gerada

**Legenda da esquerda:** `Foto enviada`
**Legenda da direita:** `Campanha gerada no Vendeo`

**Alt da foto:** `Foto sintética de uma orquídea roxa sobre um balcão, usada como entrada deste exemplo`

**Alt da campanha:** `Campanha demonstrativa da floricultura fictícia Donna Flor gerada no Vendeo a partir da foto da orquídea`

**Texto de apoio abaixo do par:**
> A mesma orquídea, a mesma loja fictícia: a foto de balcão vira uma peça 1:1 com identidade, texto e chamada para publicação.

### 2.3 Explicação da transformação

**H2:** O que mudou entre a foto e a campanha

> A foto enviada mostra o produto como ele está na loja. A campanha reorganiza essa imagem em uma peça de divulgação: define o enquadramento, aplica a identidade da marca fictícia, escreve a chamada e a legenda, e prepara o arquivo para as redes sociais.

> O que a campanha **não** faz: ela não garante que o produto apareça exatamente igual à foto, não mede tempo de geração e não promete aumento de vendas. O resultado é uma peça para você revisar e decidir se publica.

**Bloco "Entrada" (rótulos, sem valores inventados):**

| Campo | Conteúdo |
|---|---|
| Produto | **PENDENTE — dado informado na geração** |
| Oferta / descrição | **PENDENTE — dado informado na geração** |
| Preço | **PENDENTE — dado informado na geração** |
| Selo ou intenção | **PENDENTE — dado informado na geração** |
| Loja | Donna Flor (fictícia) |
| Foto | Orquídea roxa sintética sobre balcão |

**Legenda entregue pela campanha:** **PENDENTE — texto exato da legenda gerada**
> Se a legenda não for exibida na página, remover este bloco em vez de resumir ou reescrever o conteúdo gerado.

### 2.4 Como funciona

**H2:** Como funciona

1. **Você informa o básico** — produto, oferta, preço e alguns detalhes da campanha.
2. **O Vendeo prepara a campanha** — o Vendeo cria a arte e o texto a partir dessas informações.
3. **Você confere** — revisa a campanha e decide antes de publicar.
4. **Basta baixar para publicar** — a campanha fica pronta para as redes sociais.

*(Mesma redação da home, para não criar duas explicações divergentes do produto.)*

### 2.5 CTA

**H2:** Quer ver como fica com a sua loja?

**Texto:**
> Informe o produto, a oferta e o preço. O Vendeo prepara a campanha para você revisar.

**Botão:** componente `AcquisitionCta`
- Flag `publicSignupEnabled` ligada → Google / e-mail (`/signup`)
- Flag desligada → `Solicitar acesso free` apontando para `/#acesso` (na home)

### 2.6 Rodapé

Logo Vendeo · `Voltar ao Vendeo` (`/`) · `Termos de Uso` · `Política de Privacidade` · `Uso Aceitável` · `Entrar`
Aviso demonstrativo do item 1.

## 3. Composição visual (simples, sem redesenhar a home)

**Container:** `max-w-5xl px-6`, fundo `bg-bg-surface`/`bg-bg-deep`, texto `text-text-primary`, fontes locais (Poppins headings, Open Sans body).

**Ordem no DOM (mobile):** header → H1 → subheadline → aviso → foto → campanha → explicação → como funciona → CTA → rodapé.
(O CTA nunca fica abaixo de uma imagem grande no mobile; a página não repete o hero da home.)

**Desktop (≥640px):**
- Header enxuto (logo + Entrar).
- Bloco 1: uma coluna de leitura, `max-w-2xl`.
- Bloco 2: duas colunas — foto (proporcional, largura máx. ~320px) e campanha (`CampaignImage` 1:1, `contain`, sem corte), com seta `ArrowRight` entre elas.
- Bloco 3: texto em `max-w-2xl` + tabela de entrada em card `border-border` `bg-bg-deep`.
- Bloco 4: `ol` com 4 itens, mesmo padrão da home.
- Bloco 5: CTA centralizado; rodapé com borda superior.

**Mobile (<640px):**
- Tudo em coluna única.
- Foto e campanha empilhadas com `ArrowDown` decorativa.
- Campanha com largura `min(320px, calc(100vw - 48px))`.
- Tipografia: H1 `text-3xl`, H2 `text-2xl`, corpo `text-base`.

**Estados e acessibilidade:**
- `alt` em ambas as imagens; aviso demonstrativo em texto (nunca só cor).
- Foco visível (`focus:ring-2 focus:ring-accent-blue`), alvos ≥44px.
- Sem animação de entrada; sem carrossel; sem modal.

## 4. Informações ainda necessárias (bloqueiam a implementação fiel)

1. **Caminho do arquivo da foto** da orquídea roxa sintética (formato, dimensões, peso) e confirmação de que é sintética e liberada para uso público.
2. **Caminho do arquivo da campanha** da Donna Flor gerada no Vendeo (formato, dimensões; se não for 1024×1024, autorizar redimensionamento determinístico).
3. **Dados informados na geração:** produto, descrição/oferta, preço, selo/intenção, formato/abordagem e identidade de marca informada (logo, cores, nome).
4. **Legenda entregue** pela campanha: texto exato, se será exibida na página.
5. **Confirmação da grafia da marca:** "Donna Flor" (dois "n") no material novo, distinta de "Dona Flor" (um "n") do asset antigo `identidade-floricultura.webp`.
6. **Confirmação de que este par é o mais recente** e que o par anterior (buquê de rosas) não deve ser usado.
7. **Decisão de OG:** reutilizar `/seo/vendeo-og-1200x630.png` ou produzir imagem própria da página (follow-up).
8. **Decisão sobre o link na home:** autorizar um link de rodapé `Exemplo: campanha para floricultura` ou manter apenas sitemap + links de saída.

Sem esses itens, a página pode ser construída com placeholders, mas **não pode ser aprovada** — os blocos marcados como PENDENTE não devem ir ao ar com texto inventado.
