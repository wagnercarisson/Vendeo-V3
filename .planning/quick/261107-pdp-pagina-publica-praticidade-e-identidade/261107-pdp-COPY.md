# Copy e composição — página pública de praticidade e identidade

Status: **aprovada, implementada e com aceite visual aprovado em 2026-11-07.**
A copy abaixo foi reconciliada com as decisões do responsável e é transcrita
exatamente na implementação.

Rota proposta: `/campanhas-para-sua-loja`.

## 1. Metadata

| Campo | Conteúdo |
|---|---|
| URL | `https://vendeo.tech/campanhas-para-sua-loja` (somente produção confirmada + origem válida) |
| Title | `Crie campanhas para sua loja sem complicação \| Vendeo` |
| Description | `Com o Vendeo, a foto de um produto e poucas informações viram arte e texto com a identidade da sua loja. Sem precisar saber design.` |
| H1 | `Sua loja não precisa de mais uma tarefa. Precisa de uma campanha pronta.` |
| OG/Twitter | título e descrição acima, locale `pt_BR`, `siteName` Vendeo, imagem `/seo/vendeo-og-1200x630.png` |
| Robots | `index, follow` somente na condição combinada; caso contrário `noindex, nofollow` |
| Canonical | absoluto, somente na condição combinada; omitido fora dela |

Justificativa: o title cobre “campanhas” e “divulgar sua loja”; a description
cobre foto, poucas informações, identidade da loja e “sem saber design”. A página
se diferencia da home (que fala em “o que seu negócio quer divulgar”) e das
páginas de segmento (que nomeiam padarias e floriculturas). Nenhum volume de
busca é afirmado.

### URL — alternativas avaliadas

| Opção | Avaliação |
|---|---|
| `/campanhas-para-sua-loja` | **Recomendada.** Intenção clara, sem segmento, sem colidir com `/campanhas` (prefixo privado do app) |
| `/praticidade` | Curta, mas abstrata para busca e pouco descritiva |
| `/demonstracao` | Descreve o formato, não o benefício; pode envelhecer |
| `/como-funciona` | Sugere manual/tutorial, contrariando o posicionamento |

## 2. Abertura

**H1**

> Sua loja não precisa de mais uma tarefa. Precisa de uma campanha pronta.

**Texto de abertura**

> O Vendeo é o aplicativo que transforma a foto de um produto e poucas informações em uma campanha com arte, texto e a identidade da sua loja. Depois de configurar sua loja, envie a foto e conte o que quer divulgar. Em poucos minutos, receba uma campanha para revisar, baixar e publicar.

**Linha de apoio**

> Sem precisar saber design ou aprender um editor complicado.

**Grupo de acesso**

- Cadastro fechado: botão principal “Solicitar acesso gratuito” (âncora local para `#campanhas-oferta`) e link “Conheça o Vendeo” para `/`.
- Cadastro aberto: “Continuar com Google” e “Continuar com email” como âncoras locais para `#campanhas-oferta`, com “Conheça o Vendeo” para `/`.

Não há card, resumo ou expansível na abertura.

## 3. Caso 1 — ração, campanha 1:1

**H2**

> Uma foto do produto. Uma campanha quadrada.

**Parágrafo**

> Com a foto da ração, o nome do produto e as informações da oferta, o Vendeo criou uma campanha com a marca do Pet Shop Bicho Fofo.

**Rótulo da foto**

> Foto enviada

**Alt da foto**

> Embalagem de ração Confiance Premium Adults 15 kg sobre uma mesa de madeira

**Rótulo da campanha**

> Campanha criada com o Vendeo

**Marcador de formato**

> 1:1

**Alt da campanha**

> Campanha quadrada do Pet Shop Bicho Fofo para a ração Confiance, com o produto em destaque e o nome da loja

**Composição**

- Desktop: foto à esquerda, seta discreta no centro, campanha à direita; ambas em caixa quadrada, com `object-contain`, sem recorte.
- Mobile: foto, seta para baixo, campanha; ambas na largura útil.
- Nenhuma tabela de entrada, dado de geração ou segundo kit.

## 4. Caso 2 — cama, campanha 9:16

**H2**

> Outro produto. Outro formato. A mesma identidade.

**Parágrafo**

> Agora a cama, para uma publicação vertical. Outro produto, apresentado em 9:16, com a identidade da mesma loja.

**Frase-alinhada (destaque)**

> Produtos diferentes. Formatos diferentes. A mesma identidade da sua loja.

**Rótulo da foto**

> Foto enviada

**Alt da foto**

> Cama pet bege com estampas de patinhas sobre uma mesa em uma loja de produtos para animais

**Rótulo da campanha**

> Campanha criada com o Vendeo

**Marcador de formato**

> 9:16

**Alt da campanha**

> Campanha vertical do Pet Shop Bicho Fofo para a Cama Pet Comfort, com o produto em destaque e o selo Top de Linha

**Composição**

- Desktop: foto à esquerda e campanha à direita, em seção própria (não compartilha grade com o caso 1). A campanha 9:16 tem largura controlada para caber inteira; `object-contain` e proporção 9:16 preservada.
- Tablet: colunas sem colisão; a campanha mantém a proporção e não é cortada.
- Mobile: um caso por vez; foto, seta para baixo, campanha. A campanha ocupa a largura útil e mantém a proporção 9:16, sem recorte.
- Nenhum carrossel, modal ou controle interativo.

## 5. Kit de publicação — cama

Exibido após o caso 2, em HTML, sem botões “Copiar” e sem captura da interface.
Somente este kit.

**H2**

> Além da arte, o texto para acompanhar a publicação.

**Título**

> Cama Pet Comfort: aconchego para seu pet

**Legenda**

> Um destaque cheio de carinho na vitrine do Pet Shop Bicho Fofo: a Cama Pet Comfort é macia e confortável, perfeita para dar ao seu companheiro um cantinho especial de descanso. Seu pet merece esse mimo! 🐾

**Hashtags**

> #CamaPetComfort #ConfortoPet #Petshop #DestaquePet #BichoFofo

**Chamada**

> Venha conhecer na loja!

Formato: `<dl>` com `<dt>` em caixa alta discreta e `<dd>` em texto legível. Os
quatro campos aparecem uma única vez cada.

## 6. Aviso demonstrativo único

Imediatamente após o kit, em `text-xs text-text-secondary`, uma única vez:

> As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas

Sem segunda ocorrência no rodapé ou em qualquer outro bloco desta página.

## 7. Rotina

**H2**

> Feita para a rotina de quem atende, repõe e ainda divulga.

**Parágrafo**

> Quem toca uma loja pequena acumula funções. O Vendeo encurta o caminho entre o produto que está na vitrine e a publicação que precisa sair.

**Itens — leitura escaneável**

1. **A foto pode ser a do celular.**
   > Você não precisa de estúdio nem de uma sessão de fotos.
2. **Poucas informações bastam.**
   > Produto, oferta e o que destacar. A configuração inicial da loja fica guardada.
3. **Arte e texto preparados pelo Vendeo.**
   > Você informa o que quer divulgar, e o aplicativo compõe a campanha com a identidade da sua loja.
4. **Você revisa antes de publicar.**
   > Baixe a campanha, confira o texto e publique quando quiser. A publicação é sua.

Nenhum item promete agenda, calendário, publicação automática, integração com
redes sociais, controle de estoque ou gestão de pedidos.

## 8. Encerramento

**H2**

> Sua próxima campanha pode ser mais simples com o Vendeo.

**Texto de apoio**

> Uma foto, poucas informações e a identidade da sua loja. Em poucos minutos, você recebe a arte e o texto para revisar e publicar.

**Card**

- Um único `OfferCard` compacto, `id="campanhas-oferta"`, `tabindex="-1"`,
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
- Mesmas classes, alturas de toque e foco do rodapé de `/padarias`.

## 10. Home — única alteração proposta

No rodapé, ao lado dos links existentes “Floriculturas” e “Padarias”, incluir:

> Campanhas sem complicação

Destino: `/campanhas-para-sua-loja`.

Rótulo aprovado pelo responsável. Alternativas avaliadas e descartadas:

| Rótulo | Avaliação |
|---|---|
| “Campanhas para sua loja” | Descrevia o benefício, mas foi substituído pela decisão do responsável |
| “Como funciona” | Mais convidativo, mas sugere tutorial e pode competir com a home |
| “Praticidade” | Curto, porém vago e pouco escaneável |

Nenhum outro texto, bloco, imagem, CTA, ordem ou metadata da home muda.

## 11. SEO — headings e diferenciação

| Nível | Texto | Papel |
|---|---|---|
| H1 | Sua loja não precisa de mais uma tarefa. Precisa de uma campanha pronta. | Benefício e praticidade |
| H2 | Uma foto do produto. Uma campanha quadrada. | Demonstração 1:1 |
| H2 | Outro produto. Outro formato. A mesma identidade. | Demonstração 9:16 + consistência |
| H2 | Além da arte, o texto para acompanhar a publicação. | Kit de texto |
| H2 | Feita para a rotina de quem atende, repõe e ainda divulga. | Dor operacional |
| H2 | Sua próxima campanha pode ser mais simples com o Vendeo. | Fecho comercial |
| H3 | Quatro itens da rotina | Leitura escaneável |

Diferenças deliberadas:

- **Home:** fala do negócio em geral e abre com “O que seu negócio quer divulgar…”. Esta página fala do cotidiano da loja e mostra a campanha em dois formatos.
- **`/floriculturas`:** nicho, orquídea e Floricultura Donna Flor. Esta página é cross-segmento; o pet shop é apenas o exemplo visual.
- **`/padarias`:** nicho, bolo/pão e Panificadora Dona Maria. Esta página não cria um novo segmento.
- **Intenção de busca:** “aplicativo para criar campanhas”, “criar arte e legenda para produtos”, “divulgar loja sem saber design”, “identidade da loja”. Sem “falta de tempo” como termo comprovado.

## 12. Composição visual

### Desktop (≥ 1024 px, conteúdo útil de 976 px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [logo Vendeo]                                              [Entrar]  │
├──────────────────────────────────────────────────────────────────────┤
│ Sua loja não precisa de mais uma tarefa. Precisa de uma campanha     │
│ pronta.                                                              │
│                                                                      │
│ O Vendeo é o aplicativo que transforma a foto de um produto e         │
│ poucas informações em uma campanha com arte, texto e a identidade     │
│ da sua loja. Depois de configurar sua loja, envie a foto e conte o    │
│ que quer divulgar. Em poucos minutos, receba uma campanha para        │
│ revisar, baixar e publicar.                                          │
│                                                                      │
│ Sem precisar saber design ou aprender um editor complicado.           │
│                                                                      │
│ [Solicitar acesso gratuito] [Conheça o Vendeo]                        │
├──────────────────────────────────────────────────────────────────────┤
│ Uma foto do produto. Uma campanha quadrada.                           │
│                                                                      │
│ FOTO ENVIADA                    CAMPANHA CRIADA COM O VENDE0   [1:1]  │
│ ┌───────────────────┐   →    ┌───────────────────┐                   │
│ │   foto 1,09:1     │        │   campanha 1:1    │                   │
│ │   452 × 414       │        │   452 × 452       │                   │
│ └───────────────────┘        └───────────────────┘                   │
│                                                                      │
│ Com a foto da ração, o nome do produto e as informações da oferta,    │
│ o Vendeo criou uma campanha com a marca do Pet Shop Bicho Fofo.       │
├──────────────────────────────────────────────────────────────────────┤
│ Outro produto. Outro formato. A mesma identidade.                     │
│                                                                      │
│ FOTO ENVIADA                    CAMPANHA CRIADA COM O VENDE0  [9:16]  │
│ ┌──────────────┐     →      ┌──────────────┐                         │
│ │  foto 2:3    │            │ campanha 9:16│                         │
│ │  300 × 450   │            │  270 × 480   │                         │
│ └──────────────┘            └──────────────┘                         │
│                                                                      │
│ Agora a cama, para uma publicação vertical. Outro produto,            │
│ apresentado em 9:16, com a identidade da mesma loja.                  │
│                                                                      │
│ “Produtos diferentes. Formatos diferentes. A mesma identidade da      │
│  sua loja.”                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ Além da arte, o texto para acompanhar a publicação.                   │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ TÍTULO    Cama Pet Comfort: aconchego para seu pet               │ │
│ │ LEGENDA   Um destaque cheio de carinho na vitrine do Pet Shop... │ │
│ │ HASHTAGS  #CamaPetComfort #ConfortoPet #Petshop...               │ │
│ │ CHAMADA   Venha conhecer na loja!                                │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ As lojas e campanhas apresentadas são exemplos demonstrativos...      │
├──────────────────────────────────────────────────────────────────────┤
│ Feita para a rotina de quem atende, repõe e ainda divulga.            │
│                                                                      │
│ A foto pode ser     Poucas informações   Arte e texto       Você      │
│ a do celular.       bastam.              preparados pelo    revisa    │
│                                          Vendeo.             antes.    │
├──────────────────────────────────────────────────────────────────────┤
│ Sua próxima campanha pode ser mais simples com o Vendeo.             │
│ Uma foto, poucas informações e a identidade da sua loja. Em poucos    │
│ minutos, você recebe a arte e o texto para revisar e publicar.        │
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

Ordem: abertura → CTAs → caso 1 (foto, seta, campanha) → explicação do caso 1 →
caso 2 (foto, seta, campanha) → frase-alinhada → kit → aviso → rotina →
encerramento → card → rodapé.

Um caso por vez. A campanha 9:16 ocupa a largura útil (342 × 608) e mantém a
proporção; não há recorte nem overflow horizontal.

## 13. Contratos de imagem

| Asset | Variantes | Dimensão | `sizes` provisório |
|---|---|---|---|
| `foto-racao-confiance` | `-480w.webp`, `-1024w.webp` | 480×440, 1024×939 | `(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))` |
| `campanha-racao-confiance-bicho-fofo` | `-480w.webp`, `-1024w.webp` | 480×480, 1024×1024 | idem |
| `foto-cama-pet-comfort` | `-480w.webp`, `-1024w.webp` | 480×720, 1024×1536 | `(min-width: 1024px) 300px, (min-width: 640px) calc(50vw - 70px), min(342px, calc(100vw - 48px))` |
| `campanha-cama-pet-comfort-bicho-fofo` | `-480w.webp`, `-1024w.webp` | 480×853, 1024×1820 | `(min-width: 1024px) 270px, (min-width: 640px) calc(45vw - 60px), min(342px, calc(100vw - 48px))` |

Regras:

- `src` é a variante 1024w; o 480w vem primeiro no `srcset`.
- `width` e `height` explícitos; caixa com `aspect-ratio` e `object-contain`.
- O caso 1 pode usar `loading="eager"` se estiver na primeira área de leitura; o
  caso 2 usa `lazy`. Nenhuma imagem recebe `fetchpriority="high"` antes da
  medição de LCP.
- Nenhum upscale; DPR 3 fica limitado ao original de 1024 px (a campanha 9:16
  tem original 1080 px de largura).
- Pesos finais ≤ original correspondente (1.899.777 B / 1.396.972 B /
  2.722.361 B / 660.163 B).
- Não aplicar o pipeline quadrado de `/padarias` ao 9:16.

## 14. Frases proibidas nesta página

- “Em 30 segundos” / “média de 30 segundos” / contador ou prazo garantido.
- “Agende seus posts.”
- “Publique automaticamente.”
- “Calendário editorial.”
- “Anúncios pagos” / “tráfego pago” / “impulsione”.
- “Aumente suas vendas” / “mais clientes” / “mais alcance” / “mais conversão”.
- “Gestão de redes sociais.”
- “Somos uma agência.”
- “Os mais buscados.”
- “Grátis para sempre.”
- Qualquer preço em texto, metadata ou JSON-LD.
- “Reprodução exata” / “a mesma foto” / “idêntica à foto”.
- “Manual de preenchimento” / lista de campos obrigatórios / explicação de badges.
- “Começar do zero” / “tela em branco” / variações como argumento da página.
- “Por que pagar por isso?” como título público.
- Afirmar que as fotos demonstrativas foram feitas com celular.

## 15. Critérios de aceite da copy

- A copy acima aparece exatamente como transcrita.
- O kit da cama tem quatro campos e nenhum botão “Copiar”.
- O aviso aparece uma única vez, após o kit.
- A frase-alinhada aparece uma única vez, no caso 2.
- Nenhuma promessa de funcionalidade não existente ou de resultado comercial.
- Nenhum dado de loja real, avaliação, endereço, telefone ou preço em HTML.
- O Vendeo é descrito como aplicativo de criação de campanhas, artes e textos,
  nunca como pet shop, agência ou gestor de anúncios.
- “Em poucos minutos” pode ser usado na comunicação; a média de ~30 segundos não
  é publicada sem conferência de evidência.
- O benefício geral “A foto pode ser a do celular.” é mantido, mas nenhuma foto
  demonstrativa é descrita como feita com celular.
