# Quick 261109-mrc — Checklist pós-deploy

**Este checklist é separado do fechamento local.** Nenhum item deve ser marcado como concluído antes da publicação autorizada. Ele não bloqueia implementação, verificação, sync ou archive da change.

## 1. Pré-publicação

- [ ] Confirmar que o deploy contém a rota `/ofertas-para-mercados`.
- [ ] Confirmar `VERCEL_ENV=production` na execução publicada.
- [ ] Confirmar `NEXT_PUBLIC_SITE_URL=https://vendeo.tech` exatamente (sem `www`, caminho, query ou fragmento).
- [ ] Confirmar que a flag pública de cadastro está no estado esperado e que os dois estados foram validados localmente.
- [ ] Confirmar que nenhum preço, marca fictícia ou JSON-LD comercial entrou em metadata.
- [ ] Confirmar que `/seo/vendeo-og-1200x630.png` continua disponível.

## 2. SEO e descoberta

- [ ] `GET https://vendeo.tech/ofertas-para-mercados` retorna 200 sem redirect para login.
- [ ] `robots` da página é `index, follow`.
- [ ] `rel=canonical` absoluto é `https://vendeo.tech/ofertas-para-mercados`.
- [ ] Open Graph e Twitter usam a mesma URL e a imagem institucional.
- [ ] `https://vendeo.tech/sitemap.xml` contém exatamente as cinco URLs aprovadas, incluindo `/ofertas-para-mercados`.
- [ ] `https://vendeo.tech/robots.txt` referencia o sitemap e não bloqueia a leitura do `noindex`.
- [ ] Nenhuma rota privada, legal ou transitória entrou no sitemap.
- [ ] Nenhum subcaminho de `/ofertas-para-mercados` é indexável.
- [ ] Nenhum JSON-LD de `GroceryStore`, `Butcher`, `LocalBusiness`, `Product`, `Offer`, `Review` ou `AggregateRating`.

## 3. Conteúdo e composição

- [ ] H1, rótulos, kit e aviso correspondem exatamente ao aprovado.
- [ ] Um único card de oferta, no encerramento.
- [ ] Um único aviso demonstrativo, após o exemplo do café.
- [ ] Nenhum botão “Copiar”.
- [ ] Foto horizontal e campanha quadrada sem recorte, com proporções preservadas.
- [ ] Seta centralizada entre as áreas visuais, sem influência dos rótulos.
- [ ] Nenhum overflow horizontal em 1440, 834 e 390.
- [ ] Texto do kit legível e sem truncamento.
- [ ] Rodapé com “Mercados e mercearias” e `aria-current="page"` na página atual.
- [ ] Demais links do rodapé preservados.

## 4. Flags e acesso

- [ ] Flag fechada: abertura leva a `#ofertas-mercados-oferta`; card usa `/#acesso`; “Conheça o Vendeo” vai para `/`.
- [ ] Flag aberta: abertura usa âncoras locais; card usa Google/OAuth e `/signup`; “Conheça o Vendeo” vai para `/`.
- [ ] Nenhum clique em autenticação, nenhuma conta criada e nenhuma operação paga durante a verificação.
- [ ] Nenhuma chamada a provider ou API de geração.

## 5. Performance e imagens

- [ ] `currentSrc` coerente com o DPR e a largura real em desktop, tablet e mobile.
- [ ] Dimensões renderizadas mantêm as proporções 3:2 (foto) e 1:1 (campanha e café).
- [ ] Nenhuma imagem sofre upscale.
- [ ] Café carrega com `loading="lazy"` e `decoding="async"`.
- [ ] Nenhuma imagem recebe `fetchpriority="high"` sem medição.
- [ ] LCP observado registrado; não presumir que seja uma imagem.
- [ ] Nenhuma fonte externa, nova dependência ou requisição a `/api/`.

## 6. Rollback / contenção

- [ ] Em caso de falha de conteúdo ou SEO, reverter o deploy para a versão anterior.
- [ ] Se a rota tiver sido indexada incorretamente, remover do sitemap e aplicar `noindex` antes de corrigir a causa.
- [ ] Não alterar migrations, banco, flags ou configuração externa como parte do rollback da página.

## 7. Registro

- [ ] Registrar URL do deploy, commit publicado, data/hora, evidências de canonical, sitemap, robots e capturas.
- [ ] Separar falhas preexistentes das falhas desta entrega.
- [ ] Registrar explicitamente que a validação local não equivale a aprovação de produção.
