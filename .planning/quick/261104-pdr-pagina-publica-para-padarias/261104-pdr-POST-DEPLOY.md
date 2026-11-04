# Checklist pós-deploy — `/padarias`

**Fora da rodada de implementação.** Não marcar como concluído antes da
publicação autorizada. Não bloqueia sync/archive da change. A verificação em
produção simulada (canonical/indexação/sitemap) não equivale a produção publicada.

- [ ] `/padarias` responde 200, sem redirect para `/login`, em produção.
- [ ] HTML servido contém title, description, H1, canonical absoluto
  `https://vendeo.tech/padarias`, Open Graph e Twitter.
- [ ] `robots` é `index, follow` e não há `X-Robots-Tag: noindex` em produção.
- [ ] Preview/local continuam `noindex` e sem canonical de produção.
- [ ] `sitemap.xml` contém exatamente três URLs: `/`, `/floriculturas`, `/padarias`.
- [ ] Rodapé da home exibe “Padarias” ao lado de “Floriculturas”.
- [ ] Search Console: solicitar indexação e acompanhar cobertura e consultas, sem
  prometer posição ou tráfego.
- [ ] PageSpeed mobile e desktop: LCP, CLS, INP, `currentSrc`, peso transferido e
  legibilidade.
- [ ] `og:image` responde 200, com 1200×630 e a imagem institucional existente.
- [ ] Nenhum JSON-LD de `Bakery`, `LocalBusiness`, `Product`, `Offer`, `Review` ou
  `AggregateRating` no HTML servido.
