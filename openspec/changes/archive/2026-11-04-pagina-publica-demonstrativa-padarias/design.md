## Context

`/floriculturas` estabeleceu o padrão de página pública demonstrativa: Server
Component estático, abertura com CTA, par foto/campanha, kit de texto em HTML,
exemplo complementar, aviso demonstrativo único, card compacto de oferta e
metadata fail-closed. A página funciona como prova visual do aplicativo sem
executar geração, provider ou crédito.

`/padarias` reutiliza esse padrão técnico e visual, mas com conteúdo próprio do
segmento. O material aprovado é composto por três imagens 1024×1024:

- foto de entrada do bolo (PNG, 1.877.770 B);
- campanha do Bolo Naked Fruit da Panificadora Dona Maria (JPEG, 291.804 B);
- campanha do Pão Francês Fresquinho da mesma marca fictícia (JPEG, 266.104 B).

O texto exato do kit de publicação foi fornecido pelo responsável. A marca
Panificadora Dona Maria é fictícia e não deve ser apresentada como cliente real.

**Conflito de spec identificado:** `seo-discovery-foundation` hoje declara
exatamente duas superfícies indexáveis (home e `/floriculturas`) e um único link
contextual no rodapé da home. A nova rota exige atualização explícita dessa
política e do sitemap, sem transformar a exceção em regra implícita. O texto da
spec ainda registra o rótulo antigo “Exemplo: campanha para floricultura”,
enquanto o código aprovado usa “Floriculturas”; o delta reconcilia o rótulo
existente e acrescenta “Padarias”, sem alterar a home além do novo link.

## Goals / Non-Goals

**Goals**

- Criar uma página objetiva, específica para padarias, que identifique o Vendeo
  como aplicativo de criação de campanhas, artes e textos.
- Demonstrar a transformação da foto do bolo na campanha da Dona Maria.
- Exibir o kit de publicação completo em HTML, sem controles de cópia.
- Apresentar situações comerciais reais de padaria sem prometer funcionalidades
  inexistentes.
- Mostrar a campanha do pão como exemplo complementar, com texto e imagem
  organizados de forma distinta da demonstração principal.
- Manter um único card de oferta, alimentado pela fonte central, com os dois
  estados da flag.
- Entregar duas variantes WebP por imagem, com dimensões explícitas, sem recorte,
  sem upscale e com prioridade definida por medição.
- Declarar metadata própria, canonical absoluto e indexação apenas sob produção
  confirmada com origem válida.
- Preservar `/floriculturas`, a home (exceto o link de rodapé) e todas as demais
  superfícies.

**Non-Goals**

- Posicionar o Vendeo como padaria, confeitaria, vendedor de alimentos, agência ou
  gestor de anúncios pagos.
- Criar agenda, calendário editorial, publicação automática, carrossel, stories,
  vídeo, modal, galeria ou integração com redes sociais.
- Prometer aumento de vendas, alcance, tráfego, posição no Google ou resultado
  comercial.
- Criar nova fase, migration, dependência, backend, autenticação, créditos ou
  flags.
- Gerar imagens, chamar provider ou consumir créditos.
- Alterar a política de oferta, elegibilidade, onboarding ou configuração externa.
- Commitar, sincronizar, arquivar, mesclar, publicar ou fazer deploy nesta rodada.

## Decisions

### D1 — Componentes locais de padaria, sem tocar em `/floriculturas`

Os componentes visuais da página ficam em
`src/components/landing/padarias/**`, seguindo o padrão local já usado pelo
cabeçalho de `/floriculturas`. O grupo de acesso também é local, reutilizando
`AcquisitionCta` e `PUBLIC_ACCESS_COPY`, porque extrair o grupo existente para um
componente compartilhado exigiria alterar a página `/floriculturas` aprovada. A
duplicação é limitada à composição visual; textos e comportamentos continuam
vindo das fontes centrais.

Alternativa descartada: importar diretamente o grupo de `/floriculturas`. Isso
evitaria duplicação, mas acoplaria uma página de segmento ao diretório de outro e
dificultaria a evolução independente.

### D2 — Página sem bloco próprio de “como funciona”

A composição aprovada para esta entrega é: abertura, demonstração, explicação com
kit, situações comerciais, exemplo do pão, aviso e encerramento. Um bloco extra de
passos aumentaria a página sem acrescentar prova visual nova. O funcionamento do
aplicativo já fica explícito na abertura, na demonstração e na explicação.

Alternativa descartada: repetir o bloco de quatro passos de `/floriculturas`. Se o
responsável preferir, ele pode ser acrescentado depois como decisão explícita,
sem alterar os demais blocos.

### D3 — Aviso demonstrativo único após o exemplo do pão

O aviso aprovado aparece uma única vez, imediatamente após o exemplo complementar,
cobrindo as três imagens e a marca fictícia. Não há segunda advertência, repetição
no rodapé ou texto novo de aviso.

### D4 — Duas variantes 480w/1024w por imagem

As três imagens são quadradas (1:1) e têm 1024 px de lado na origem. A coluna da
demonstração mede cerca de 452 px CSS no desktop e a coluna do exemplo do pão cerca
de 468 px; no mobile, a largura útil é 342 px. 480w atende 1x e 1024w atende 2x.
Em DPR 3 a resolução fica limitada ao original de 1024 px, sem upscale. Os valores
de `sizes` serão reconciliados com a medição real antes do fechamento.

Alternativa descartada: 640w + 1024w. A variante menor ficaria mais pesada sem
ganho relevante em 1x.

### D5 — Um único card de oferta, consumido da fonte central

O encerramento usa exatamente um `OfferCard` compacto, com ID estável
`padarias-oferta`, e todos os textos vêm de `public-offer-copy.ts`. A página não
reescreve números, condições ou rótulos. A abertura não repete o resumo, o
complemento ou o expansível.

### D6 — Sem dados estruturados nesta entrega

O repositório não possui camada de JSON-LD hoje. `Bakery`/`LocalBusiness` para a
loja fictícia seria incorreto; `Product`/`Offer` não são adequados porque a página
**não está oferecendo esses alimentos para compra**; `Review`/`AggregateRating` não
têm dados reais. Um `SoftwareApplication` genérico exigiria campos e sinais que o
produto ainda não expõe de forma autoritativa, e `WebPage` isolado teria benefício
marginal. A decisão é não incluir dados estruturados nesta change e registrar a
avaliação para uma futura implementação global de `Organization`/`WebSite`, fora
deste escopo.

### D7 — Link “Padarias” ao lado de “Floriculturas” no rodapé

A única alteração na home é a inclusão de um link “Padarias” para `/padarias`,
imediatamente ao lado do link existente “Floriculturas”. Nenhum outro texto,
bloco, imagem, CTA, ordem ou metadata da home muda. O link usa as mesmas classes,
altura de toque e foco do link vizinho.

### Carregamento e prioridade (não é decisão numerada)

A demonstração principal fica na primeira área de leitura e usa `eager`. O exemplo
do pão fica abaixo da dobra e usa `loading="lazy"` com `decoding="async"`. Nenhuma
imagem recebe `fetchpriority="high"` antes da medição de LCP; se o vencedor for o
H1, como em `/floriculturas`, as imagens continuam sem competir por prioridade.

### Preço demonstrativo (não é decisão numerada)

O preço e os detalhes comerciais que já existem dentro das artes aprovadas
permanecem visíveis, mas não são reproduzidos como texto, metadata ou dado
estruturado. O caráter demonstrativo decorre do contexto do exemplo e do aviso
único, não do formato de entrega ou de recorte.

## Risks / Trade-offs

- **Página percebida como genérica de alimentos.** Mitigação: copy e situações
  específicas de padaria (vitrine, fornada, bolos e encomendas); a marca fictícia
  é sempre uma panificadora, nunca uma confeitaria genérica.
- **Promessa de funcionalidade inexistente.** Mitigação: a copy fala apenas em
  criar arte e texto a partir de foto e informações; não menciona agenda,
  publicação automática, anúncios, tráfego ou integração com redes sociais.
- **Preço ou marca lidos como oferta do Vendeo.** Mitigação: o conteúdo interno das
  artes é demonstrativo, coberto pelo aviso único; a página não reproduz preço em
  texto, metadata ou dado estruturado.
- **Duplicação do grupo de acesso.** Mitigação: o grupo local usa as mesmas fontes
  de texto e o mesmo `AcquisitionCta`; testes cobrem os dois estados da flag e a
  paridade de rótulos.
- **Divergência de `sizes` ou prioridade.** Mitigação: medir largura real,
  `currentSrc`, overflow e LCP em 1440×900 e 390×844 antes do aceite.
- **Indexação acidental de preview.** Mitigação: manter o contrato fail-closed já
  existente; canonical só é emitido sob produção confirmada com origem válida.

## Migration Plan

Sem migration. Alteração de página, componentes, assets, política de indexação,
sitemap, rodapé da home e testes. Deploy, Search Console e PageSpeed ficam em
checklist pós-deploy separado.

## Open Questions

Nenhuma bloqueante. As decisões D1–D7 e a copy completa aguardam revisão antes da
implementação.
