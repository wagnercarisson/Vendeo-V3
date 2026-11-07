## Context

As páginas `/floriculturas` e `/padarias` estabeleceram o padrão de demonstração
pública do Vendeo: Server Component estático, abertura com CTA, par foto/campanha,
kit de texto em HTML, aviso demonstrativo único, card compacto de oferta e metadata
fail-closed. Ambas são específicas de segmento.

A nova página tem outro papel: responder à objeção comercial do pequeno lojista
(“por que pagar?”) mostrando a rotina e a consistência entre dois produtos e dois
formatos. O pet shop é apenas o exemplo visual. A página não é manual de
preenchimento nem página de segmento.

O material aprovado é composto por quatro imagens:

- foto da ração, 1310×1201, PNG 1.899.777 B;
- campanha da ração, 1024×1024, PNG 1.396.972 B;
- foto da cama, 1024×1536, PNG 2.722.361 B;
- campanha da cama, 1080×1920, JPEG 660.163 B.

A marca fictícia Pet Shop Bicho Fofo é comum aos dois casos. O formato 9:16 está
funcional e disponível em produção (deploy READY, migration aplicada, flag
`product_9_16_enabled=true`, smoke vertical registrado). A página não executa
geração, provider ou crédito.

**Conflito de spec identificado:** `seo-discovery-foundation` hoje declara
exatamente três superfícies indexáveis (home, `/floriculturas` e `/padarias`) e
um link de rodapé para cada página de segmento. A nova rota exige atualização
explícita dessa política e do sitemap, sem transformar a exceção em regra
implícita.

## Goals / Non-Goals

**Goals**

- Criar uma página objetiva, cross-segmento, que identifique o Vendeo como
  aplicativo de criação de campanhas, artes e textos.
- Demonstrar a transformação de duas fotos em campanhas 1:1 e 9:16 com a mesma
  identidade de loja.
- Exibir um único kit de publicação em HTML, sem controles de cópia.
- Traduzir a rotina do lojista em quatro benefícios escaneáveis: celular, poucas
  informações, arte/texto preparados pelo Vendeo e revisão/download/publicação
  pelo lojista.
- Manter um único card de oferta, alimentado pela fonte central, com os dois
  estados da flag.
- Entregar duas variantes WebP por imagem, com proporção preservada, sem recorte,
  sem upscale e com prioridade definida por medição.
- Declarar metadata própria, canonical absoluto e indexação apenas sob produção
  confirmada com origem válida.
- Preservar `/floriculturas`, `/padarias`, a home (exceto o link de rodapé) e
  todas as demais superfícies.

**Non-Goals**

- Posicionar o Vendeo como pet shop, agência, gestor de tráfego, ferramenta de
  agendamento ou editor de design.
- Criar manual de preenchimento, lista de campos obrigatórios, explicação de
  badges, onboarding ou configuração técnica.
- Criar agenda, calendário editorial, publicação automática, carrossel, stories,
  vídeo, modal, galeria ou integração com redes sociais.
- Prometer aumento de vendas, alcance, tráfego, conversão, posição no Google ou
  resultado comercial.
- Publicar a média de ~30 segundos, contador ou prazo garantido.
- Criar nova fase, migration, dependência, backend, autenticação, créditos ou
  flags.
- Gerar imagens, chamar provider ou consumir créditos.
- Commitar, sincronizar, arquivar, mesclar, publicar ou fazer deploy nesta rodada.

## Decisions

### D1 — Componentes locais, sem refatoração compartilhada

Os componentes visuais ficam em `src/components/landing/campanhas/**`, seguindo o
padrão local de `/padarias`. O grupo de acesso reutiliza `AcquisitionCta` e
`PUBLIC_ACCESS_COPY`, mas replica a composição por estado da flag. Extrair um
`AccessCtaGroup` compartilhado exigiria alterar `/floriculturas` e `/padarias`,
ambas aprovadas, com risco de regressão. A duplicação é limitada à composição;
textos e comportamento continuam nas fontes centrais.

Alternativa descartada: extrair o grupo agora. Fica registrada como limpeza
futura, fora desta entrega.

### D2 — URL `/campanhas-para-sua-loja`

A rota descreve a intenção sem nomear segmento e não colide com o prefixo privado
`/campanhas` (`PRIVATE_APP_PREFIXES`). Alternativas descartadas: `/praticidade`
(abstrata), `/demonstracao` (foca o formato) e `/como-funciona` (sugere manual).

### D3 — Dois casos em seções próprias, sem grade única

Cada caso tem seu próprio par foto/campanha. O caso 1 usa caixa quadrada; o caso
2 usa caixa vertical com largura controlada no desktop, `aspect-ratio` e
`object-contain`. No mobile, um caso por vez, empilhado.

Alternativa descartada: uma grade única com quatro imagens — comprimiria o 9:16 e
contrariaria o requisito.

### D4 — Duas variantes WebP por imagem, com proporção preservada

As variantes são 480w e 1024w por imagem, calculadas pela exibição e pela
densidade de tela. O 9:16 não usa o pipeline quadrado: 480×853 e 1024×1820. A
foto 2:3 usa 480×720 e 1024×1536. A foto da ração usa 480×440 e 1024×939. A
campanha 1:1 usa 480×480 e 1024×1024. Nenhuma variante faz upscale; em DPR 3 a
resolução fica limitada ao original.

Alternativa descartada: reutilizar o pipeline de cinco variantes da landing ou o
pipeline quadrado de `/padarias`.

### D5 — Um único kit, o da cama, em HTML

O kit é exibido após o caso 2, com título, legenda, hashtags e chamada exatos, em
`<dl>`, sem botões “Copiar” e sem captura da interface. Não há segundo kit.

### D6 — Um único card de oferta, consumido da fonte central

O encerramento usa exatamente um `OfferCard` compacto, com ID estável
`campanhas-oferta`, e todos os textos vêm de `public-offer-copy.ts`. A abertura
não repete o resumo, o complemento ou o expansível.

### D7 — Quarta superfície indexável explícita

A política de indexação passa a aprovar explicitamente `/campanhas-para-sua-loja`,
ao lado de `/`, `/floriculturas` e `/padarias`. A indexação continua condicionada
a produção confirmada + origem canônica validada. Fora disso, `noindex` explícito,
canonical omitido e sitemap vazio. `/campanhas` e `/campanhas/**` permanecem
privados e fora do sitemap.

### D8 — Um único link novo na home

A única alteração visível na home é o link “Campanhas sem complicação” no rodapé, ao
lado de “Floriculturas” e “Padarias”, com as mesmas classes, altura de toque e
foco. Nenhum outro texto, bloco, imagem, CTA, ordem ou metadata muda.

### D9 — Sem dados estruturados nesta entrega

O repositório não possui camada de JSON-LD. `PetStore`/`LocalBusiness` para a
loja fictícia seria incorreto; `Product`/`Offer` não são adequados porque a página
não está oferecendo os produtos para compra; `Review`/`AggregateRating` não têm
dados reais. Um `SoftwareApplication` genérico exigiria campos autoritativos que o
produto não expõe aqui. A decisão é não incluir dados estruturados e registrar a
avaliação para uma futura camada global `Organization`/`WebSite`.

### Comunicação de tempo (não é decisão numerada)

“Em poucos minutos” é permitido como comunicação. A média de ~30 segundos não é
publicada sem conferência de evidência. Não há contador, prazo garantido ou
promessa de tempo por campanha.

### Publicação e identidade (não é decisão numerada)

A página mostra revisão, download e publicação pelo lojista; não sugere publicação
automática. Dois produtos e formatos mantêm a mesma marca demonstrativa; a página
não afirma reprodução visual exata da foto.

### Preço demonstrativo (não é decisão numerada)

A campanha 1:1 contém R$ 114,90 dentro da arte. O valor não é reproduzido como
texto, metadata ou dado estruturado. O caráter demonstrativo decorre do contexto
e do aviso único aprovado, não de recorte.

## Risks / Trade-offs

- **Página lida como página de pet shop.** Mitigação: H1, abertura e bloco de
  rotina falam de “sua loja”; o pet shop aparece apenas nos exemplos e nos alts.
- **Página lida como manual.** Mitigação: nenhuma lista de campos, badges,
  configuração ou onboarding; a rotina tem quatro benefícios, não um passo a
  passo de preenchimento.
- **Promessa de resultado.** Mitigação: a copy não menciona vendas, alcance,
  conversão, tráfego ou posição; o fecho fala de agilidade e consistência.
- **9:16 recortado ou comprimido.** Mitigação: seção própria, largura controlada,
  `object-contain`, `aspect-ratio` e medição em três viewports.
- **Indexação acidental de preview.** Mitigação: contrato fail-closed existente;
  canonical só é emitido sob produção confirmada com origem válida.
- **Regressão nas páginas aprovadas.** Mitigação: componentes locais; nenhuma
  alteração em `/floriculturas` ou `/padarias`; testes de regressão de SEO.
- **Duplicação do grupo de acesso.** Mitigação: mesmas fontes de texto e o mesmo
  `AcquisitionCta`; testes cobrem os dois estados da flag. Extração futura
  registrada.
- **Peso das imagens.** Mitigação: duas variantes, medição de `currentSrc` e peso
  transferido; sem `fetchpriority="high"` antes da evidência.

## Migration Plan

Sem migration. Alteração de página, componentes, assets, política de indexação,
sitemap, rodapé da home e testes. Deploy, Search Console e PageSpeed ficam em
checklist pós-deploy separado.

## Open Questions

Nenhuma bloqueante. A URL, a copy, o rótulo do link e as decisões D1–D9 aguardam
revisão antes da implementação.
