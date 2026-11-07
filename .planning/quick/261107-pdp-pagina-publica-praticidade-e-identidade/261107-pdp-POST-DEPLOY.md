# Checklist pós-deploy — `/campanhas-para-sua-loja`

**Fora da rodada de implementação.** Não marcar como concluído antes da
publicação autorizada. Não bloqueia sync/archive da change. A verificação em
produção simulada (canonical/indexação/sitemap) não equivale a produção publicada.

- [ ] `/campanhas-para-sua-loja` responde 200, sem redirect para `/login`, em
  produção.
- [ ] O link “Campanhas sem complicação” aparece no rodapé da home e aponta para
  a rota correta, sem quebrar “Floriculturas” nem “Padarias”.
- [ ] HTML servido contém title, description, H1, canonical absoluto
  `https://vendeo.tech/campanhas-para-sua-loja`, Open Graph e Twitter.
- [ ] `robots` é `index, follow` e não há `X-Robots-Tag: noindex` em produção.
- [ ] Preview/local continuam `noindex` e sem canonical de produção.
- [ ] `sitemap.xml` contém exatamente quatro URLs: `/`, `/floriculturas`,
  `/padarias` e `/campanhas-para-sua-loja`.
- [ ] As quatro imagens respondem 200; o navegador escolhe 480w em DPR 1 e 1024w
  em DPR 2/3; nenhuma imagem é recortada.
- [ ] A campanha 9:16 aparece inteira no desktop e no mobile.
- [ ] O aviso demonstrativo aparece uma única vez no HTML.
- [ ] Nenhum JSON-LD de `PetStore`, `LocalBusiness`, `Product`, `Offer`, `Review`
  ou `AggregateRating` no HTML servido.
- [ ] Nenhum preço (`R$`) no texto HTML ou metadata; preços existentes apenas
  dentro das artes.
- [ ] Search Console: solicitar indexação e acompanhar cobertura e consultas, sem
  prometer posição ou tráfego.
- [ ] PageSpeed mobile e desktop: LCP, CLS, INP, `currentSrc`, peso transferido e
  legibilidade.
- [ ] `og:image` responde 200, com 1200×630 e a imagem institucional existente.
- [ ] As duas flags de cadastro continuam funcionando: abertura em âncora e card
  final com as ações reais, sem clique de autenticação no aceite.
- [ ] Nenhum erro de console no carregamento da página.
