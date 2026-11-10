## Context

As páginas públicas `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja`
consolidaram um padrão técnico e visual: Server Component estático, abertura com
CTA, demonstração foto → campanha, kit de texto em HTML, exemplo complementar,
aviso demonstrativo único, card compacto de oferta e metadata fail-closed. Esse
padrão prova o valor do aplicativo sem executar geração, provider, crédito ou
autenticação.

O material aprovado para esta change é composto por:

- foto horizontal do coxão mole no açougue (PNG, 1536×1024, 3.048.371 B);
- campanha quadrada da Mercearia Tio João (JPEG, 1024×1024, 289.145 B);
- exemplo complementar do café Melitta (PNG, 1024×1024, 1.570.960 B), já
  disponível em WebP no repositório.

A campanha da carne contém preço anterior riscado, preço promocional, validade,
selo “Oferta” e “Imagem meramente ilustrativa”. O exemplo do café contém a marca
Melitta e a mesma Mercearia Tio João. A marca é fictícia e não deve ser
apresentada como cliente real. O aviso único aprovado cobre expressamente a
Melitta.

A revisão de 2026-11-09 aprovou uma consolidação editorial: o antigo texto de
apoio sob a demonstração e a explicação seguinte foram reunidos em um único
parágrafo após o par, com o título “Uma oferta clara, com a identidade da sua
loja.”. O texto usa “período de validade da oferta” e a página segue diretamente
para o kit, sem repetir os mesmos atributos.

**Conflito de spec identificado:** `seo-discovery-foundation` hoje declara
exatamente quatro superfícies indexáveis e o rodapé central tem três destinos.
A nova rota exige atualização explícita das duas specs, sem transformar a exceção
em regra implícita nem acoplar navegação e indexação.

## Goals / Non-Goals

**Goals**

- Criar uma página objetiva, específica para mercados, mercearias e minimercados,
  que identifique o Vendeo como aplicativo de criação de campanhas.
- Demonstrar a transformação de uma foto horizontal de produto em uma campanha
  quadrada com preço anterior, preço promocional, validade e marca preservada.
- Exibir o kit de publicação completo em HTML, sem controles de cópia.
- Mostrar o café como exemplo complementar da mesma marca fictícia, sem segundo
  kit e sem segundo par antes/depois.
- Manter um único card de oferta, alimentado pela fonte central, com os dois
  estados da flag.
- Entregar duas variantes WebP por imagem, com dimensões explícitas, sem recorte,
  sem upscale e com prioridade definida por medição.
- Declarar metadata própria, canonical absoluto e indexação apenas sob produção
  confirmada com origem válida.
- Preservar as páginas existentes, a oferta central, o acesso e o rodapé
  compartilhado.

**Non-Goals**

- Posicionar o Vendeo como mercado, açougue, vendedor de alimentos, encarte
  multiproduto, agência ou gestor de anúncios pagos.
- Criar encarte, catálogo, carrossel, stories, vídeo, agenda, calendário
  editorial, publicação automática ou integração com redes sociais.
- Prometer aumento de vendas, alcance, tráfego, posição no Google, conversão ou
  resultado comercial.
- Criar nova fase, migration, dependência, backend, autenticação, créditos ou
  flags.
- Gerar imagens, chamar provider ou consumir créditos.
- Alterar a política de oferta, elegibilidade, onboarding ou configuração externa.
- Commitar, sincronizar, arquivar, mesclar, publicar ou fazer deploy nesta rodada.

## Decisions

### D1 — Componentes locais de mercados

Os componentes visuais ficam em `src/components/landing/mercados/**`, seguindo o
padrão local de `/padarias` e `/campanhas-para-sua-loja`. O grupo de acesso também
é local, reutilizando `AcquisitionCta` e `PUBLIC_ACCESS_COPY`. Extrair um
componente compartilhado exigiria tocar nas páginas aprovadas; a duplicação fica
limitada à composição visual, enquanto textos e comportamentos continuam vindo das
fontes centrais.

Alternativa descartada: importar o grupo de `/padarias`. Menos código, porém
acopla segmentos e dificulta evolução independente.

### D2 — Página sem bloco de “como funciona”

A composição aprovada já contém abertura, demonstração, explicação, kit, exemplo
complementar, aviso e encerramento. Um bloco extra de passos ou um tutorial de
formulário aumentaria a página sem prova visual nova. O funcionamento fica
explícito na abertura, na demonstração e na explicação.

### D3 — Aviso demonstrativo único após o café

O aviso aprovado aparece uma única vez, imediatamente após o exemplo complementar,
cobrindo as três imagens, as duas categorias e a Melitta. Não há segunda
advertência, repetição no rodapé ou texto novo de aviso.

### D4 — Duas variantes 480w/1024w por imagem

A foto é 3:2 e a campanha é 1:1. No tablet, a grade centrada usa `3fr/4fr`; no
desktop, `minmax(0,360px) auto minmax(0,480px)`. A foto de entrada fica menor e
verticalmente centralizada, e a campanha ganha destaque, sem crop ou distorção.
480w atende 1x e 1024w atende 2x. Em DPR 3 a resolução fica limitada ao original,
sem upscale. Títulos usam `text-balance` e parágrafos usam `text-pretty` para
evitar palavras isoladas, sem reduzir fontes, inserir quebras manuais ou forçar
`nowrap`.

O café reutiliza a variante de 480w e o WebP base de 1024×1024 já existentes. Não
há novo derivado de café nem dependência nova.

### D5 — Um único card de oferta, consumido da fonte central

O encerramento usa exatamente um `OfferCard` compacto, com ID estável
`ofertas-mercados-oferta`, e todos os textos vêm de `public-offer-copy.ts`. A
página não reescreve números, condições ou rótulos. A abertura não repete o
resumo, o complemento ou o expansível.

### D6 — Sem dados estruturados nesta entrega

A loja é fictícia; a página não está oferecendo os alimentos para compra; não há
avaliações ou dados autoritativos. `GroceryStore`/`Butcher`/`LocalBusiness` para a
Mercearia Tio João seria incorreto; `Product`/`Offer` não são adequados porque a
página demonstra uma campanha, não vende o produto; `Review`/`AggregateRating` não
têm dados reais. A decisão é não incluir JSON-LD nesta change e registrar a
avaliação para uma futura camada global `Organization`/`WebSite`, fora deste
escopo.

### D7 — Novo destino somente na lista central do rodapé

A única alteração de navegação é acrescentar `Mercados e mercearias` →
`/ofertas-para-mercados` em `public-footer-nav.ts`, depois de “Padarias” e antes
de “Campanhas sem complicação”. Nenhum dos quatro consumidores atuais é editado
manualmente. A lista continua independente de sitemap, robots, canonical,
metadata e política de indexação.

### Carregamento e prioridade (não é decisão numerada)

A demonstração principal fica na primeira área de leitura e usa `eager`. O exemplo
do café fica abaixo da dobra e usa `loading="lazy"` com `decoding="async"`.
Nenhuma imagem recebe `fetchpriority="high"` antes da medição de LCP; se o
vencedor for o H1, as imagens continuam sem competir por prioridade.

### Preço demonstrativo (não é decisão numerada)

O preço e os detalhes comerciais existem dentro das artes aprovadas e no kit de
publicação. Eles não são reproduzidos em title, description, canonical, Open
Graph, Twitter ou JSON-LD. O caráter demonstrativo decorre do contexto do exemplo
e do aviso único, não do recorte da imagem.

## Risks / Trade-offs

- **Página percebida como mercado, açougue ou encarte.** Mitigação: copy e
  composição tratam o Vendeo como aplicativo; um produto por campanha; nenhuma
  lista multiproduto.
- **Promessa de funcionalidade inexistente.** Mitigação: a copy fala apenas em
  criar arte e texto a partir de foto e informações; não menciona agenda,
  publicação automática, anúncios, tráfego, integração ou resultado.
- **Preço ou marca lidos como oferta do Vendeo.** Mitigação: o conteúdo interno
  das artes é demonstrativo, coberto pelo aviso único; a página não reproduz preço
  em metadata nem em dado estruturado.
- **Recorte ou desproporção entre foto e campanha.** Mitigação: grid 3:2 / 1:1 com
  `object-contain`, sem `object-cover`, e medição de proporção no navegador.
- **Seta desalinhada pelos rótulos.** Mitigação: o rótulo da foto acompanha a
  imagem centralizada e o rótulo da campanha fica no topo da coluna; a seta é
  centralizada apenas entre as áreas visuais.
- **Kit confundido com copy alterada.** Mitigação: a copy permanece exata; o card
  acompanha a coluna `max-w-3xl`, alargamento revisado e aceito explicitamente.
- **Duplicação do grupo de acesso.** Mitigação: o grupo local usa as mesmas fontes
  de texto e o mesmo `AcquisitionCta`; testes cobrem os dois estados da flag.
- **Indexação acidental de preview.** Mitigação: manter o contrato fail-closed e
  cobrir a matriz por teste.
- **Reuso indevido de material não aprovado.** Mitigação: escopo fixa a foto do
  açougue, a campanha quadrada e o café; a campanha 9:16 e a foto gastronômica
  anterior ficam fora.
- **Derivados redundantes do café.** Mitigação: reutilizar 480w + base 1024
  existentes; não criar nova variante.

## Migration Plan

Sem migration. Alteração de página, componentes, assets, política de indexação,
sitemap, lista central do rodapé e testes. Deploy, Search Console e PageSpeed
ficam em checklist pós-deploy separado.

## Open Questions

Nenhuma bloqueante. As decisões D1–D7 e a copy completa aguardam revisão antes da
implementação. A ordem do novo link no rodapé, a description da metadata, o
diretório `public/mercados/` e o reuso do café são as decisões propostas que
precisam de confirmação explícita.
