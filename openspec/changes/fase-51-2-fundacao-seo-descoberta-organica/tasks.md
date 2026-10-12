# Tasks — F51.2 Fundação SEO / descoberta orgânica

> **Escopo desta fatia:** preparar a base técnica de descoberta orgânica **sem** alterar a landing aprovada na F51.1 e **sem** prometer indexação, tráfego ou posição. Previews/local são `noindex`; a home é indexável **apenas** sob produção confirmada **e** origem canônica validada (caso contrário: `noindex`, sitemap vazio e diagnóstico).
> **Checkpoints humanos:** **C1** aprovação visual da imagem de compartilhamento; **C2** confirmação para reconciliar o teste legado A9; **C3** aprovação para qualquer ampliação de escopo (nova rota, conteúdo editorial, dados estruturados, alteração de performance na landing, configuração externa).
> **Limites:** não alterar H1/copy visível/layout/campanhas/logos/CTAs; não alterar a F56, autenticação, `middleware.ts`, ledger, migrations, crédito ou onboarding; não alterar configuração externa (DNS/Vercel/Supabase/Search Console); não publicar nem enviar sitemap.

## 1. Auditoria, fronteira e decisões

- [ ] 1.1 Registrar a auditoria de host/protocolo/redirects: origem canônica `https://vendeo.tech` (sem `www`); listar `next.config.ts` (4 redirects 301 de caminho), `src/lib/supabase/site-url.ts` (`NEXT_PUBLIC_SITE_URL`) e ausência de redirect de host; **não** presumir que os redirects estejam corretos nem alterar configuração externa (D1)
- [ ] 1.2 Registrar o inventário de rotas/recursos públicos e privados (A4) e confirmar que `Novidades` é painel autenticado (`(app)/novidades` sob `requirePageUser()`), não página pública; documentar `NovidadesLink` como modal de rodapé (D5)
- [ ] 1.3 Registrar a fronteira de arquivos (`src/lib/seo/*`, `src/app/robots.ts`, `src/app/sitemap.ts`, metadata em `layout.tsx`/`page.tsx` e layouts de `(auth)`/`(app)`/`(marketing)`, `headers()` em `next.config.ts`, asset em `public/`, testes) e justificar previamente qualquer necessidade de tocar `globals.css`, design system global, dependências, `middleware.ts` ou código da F56 (D14)
- [ ] 1.4 Confirmar os tokens do design system aplicáveis à imagem institucional em `openspec/design-system/MASTER.md` (superfície da landing `#0F172A`/`--bg-surface`, `--bg-deep` `#020617`, texto `#F8FAFC`, acento `#22C55E`, Poppins + Open Sans, **sem** light mode, **sem** emojis) (D11)
- [ ] 1.5 **C2** — apresentar o achado A9 (`src/__tests__/app/landing-page.test.tsx` duplicado, 13 falhas/6 passes) com uma **comparação de cobertura** frente ao teste vigente `src/components/landing/__tests__/landing-page.test.tsx` (eliminar expectativas obsoletas; identificar os testes válidos de Novidades — abertura, fechamento, `Escape`, retorno de foco, estado vazio) e obter confirmação humana da disposição, **sem** alterar o comportamento do produto

## 2. Helpers puros de SEO

- [ ] 2.1 Criar `src/lib/seo/` com `resolveCanonicalOrigin()` (produção: `NEXT_PUBLIC_SITE_URL` **validada** — `https`, host exatamente `vendeo.tech`, sem `www`/caminho/query/fragmento; preview/local: `VERCEL_URL` ou `http://localhost:3000`), retornando resultado explícito (`origin`/`status`/`indexable`/`diagnostic`) **sem lançar exceção** e **sem emitir URL divergente**; não reutilizar nem alterar `src/lib/supabase/site-url.ts` (D2)
- [ ] 2.2 Criar `isIndexableEnvironment()` fail-closed: verdadeiro **somente** com `VERCEL_ENV === "production"` **e** origem canônica validada; ausência de `VERCEL_ENV` permanece fail-closed e identificável (D6)
- [ ] 2.3 Criar constantes/tipos da política de indexação por superfície e helpers de metadata (`index`/`noindex`) reutilizáveis pelo default da raiz, pela home (exceção) e pelas superfícies privadas/legais (D5/D9)
- [ ] 2.4 Criar constantes do `X-Robots-Tag` e a matriz de regras de `headers()` (rotas privadas/transitórias/documentos/APIs + não-produção global) como função pura testável (D7/D9/D10)
- [ ] 2.5 Escrever testes unitários de 2.1–2.4: origem válida/inválida/ausente/não canônica; `VERCEL_ENV` ausente; produção indexável; preview/local `noindex`; nenhuma regra de `Disallow` para superfícies com `noindex`

## 3. metadataBase, metadata da home e compartilhamento

- [ ] 3.1 Definir `metadataBase` no `src/app/layout.tsx` a partir de `resolveCanonicalOrigin()` e aplicar o **default `robots: noindex, nofollow` na raiz**, preservando `manifest`, `icons`, `appleWebApp` e `viewport` atuais (D2/D5)
- [ ] 3.2 Aplicar em `src/app/page.tsx` o título e a descrição aprovados, **sem** alterar o H1 ("O que seu negócio quer divulgar vira uma campanha pronta para publicar.") nem o conteúdo visível (D3)
- [ ] 3.3 Aplicar `alternates.canonical: "/"` e `openGraph`/`twitter` (type `website`, `locale pt_BR`, `siteName Vendeo`, URL absoluta) coerentes com `metadataBase` (D4)
- [ ] 3.4 Aplicar `robots: index, follow` na home **somente** sob a condição combinada (produção confirmada com origem validada); caso contrário, herda `noindex` da raiz (D5/D6)
- [ ] 3.5 Escrever testes de metadata da home: título/descrição exatos, canonical absoluto, OG/Twitter com URL absoluta, H1 preservado ("O que seu negócio quer divulgar vira uma campanha pronta para publicar.") e `robots` por ambiente, incluindo **produção confirmada com origem inválida** cobrindo os três resultados — metadata `noindex`, `robots.txt` sem sitemap divergente e sitemap sem URLs

## 4. robots.txt e sitemap.xml

- [ ] 4.1 Criar `src/app/robots.ts`: sob a condição combinada (produção confirmada com origem validada), permitir crawling e referenciar `${origin}/sitemap.xml`; caso contrário, **não bloquear o rastreamento** (sem `Disallow` que impeça a leitura do `noindex`) e não referenciar sitemap divergente (D6/D7)
- [ ] 4.2 Garantir que o `robots.txt` **não** use `Disallow` em superfícies que dependem de `noindex` (`/login`, `/termos`, `/docs/**` etc.), tanto em produção quanto fora dela (D7)
- [ ] 4.3 Criar `src/app/sitemap.ts` retornando somente `${origin}/` sob a condição combinada (produção confirmada com origem validada) e lista vazia caso contrário; excluir `/api/**`, `/auth/**`, rotas autenticadas, admin, documentos legais, versões Markdown e URLs com parâmetros (D8)
- [ ] 4.4 Escrever testes de `robots.ts` e `sitemap.ts` (produção vs. não-produção; URLs absolutas; exclusões; ausência de `Disallow` bloqueando `noindex`)

## 5. Política de indexação por rota

- [ ] 5.1 Confirmar que as páginas de autenticação e recuperação (`/login`, `/signup`, `/check-email`, `/forgot-password`, `/update-password`) herdam o `noindex, nofollow` default (ou declaram explicitamente), sem alterar a lógica de autenticação (D5)
- [ ] 5.2 Confirmar que as superfícies autenticadas — `(app)/**` (incluindo `/novidades`) e `/admin/**` — herdam o `noindex, nofollow` default, sem alterar a lógica de autenticação (D5)
- [ ] 5.3 Garantir `noindex, nofollow` a `/termos`, `/privacidade` e `/uso-aceitavel` (por herança ou declaração explícita), mantendo-os acessíveis pelos links existentes (D9)
- [ ] 5.4 Adicionar `headers()` em `next.config.ts` com `X-Robots-Tag: noindex` para `/auth/:path*`, `/api/:path*` e `/docs/:path*`, sem alterar a lógica das rotas nem headers preexistentes (D9/D10)
- [ ] 5.5 Adicionar em `headers()` a regra global `X-Robots-Tag: noindex, nofollow` quando o ambiente não for produção (D6)
- [ ] 5.6 Escrever testes por rota/ambiente: **herança do default `noindex`** pela raiz em uma rota sem aprovação; `noindex` nas superfícies privadas/legais/Markdown/APIs; home `index` **apenas** em ambiente indexável; ausência de `Disallow` bloqueando `noindex`

## 6. Imagem de compartilhamento institucional

- [ ] 6.1 Preparar a composição institucional determinística (ex.: `sharp`, sem IA e sem chamadas pagas) usando os logos oficiais como fontes locais de trabalho, preservando proporção, marca e slogan em 1200×630 (D11)
- [ ] 6.2 **C1** — apresentar a composição ao responsável e obter aprovação visual **antes** da incorporação final (D11)
- [ ] 6.3 Incorporar o asset aprovado em `public/` e referenciá-lo na metadata de compartilhamento apenas pelo caminho público; confirmar que nenhum caminho local aparece no código (D11)
- [ ] 6.4 Confirmar que os logos já usados na landing **não** foram alterados (D11)

## 7. Performance e Search Console (diagnóstico, sem alteração)

- [ ] 7.1 Registrar diagnóstico de carregamento e estabilidade visual (LCP provável da imagem hero, carregamento de Google Fonts via `<link>`, peso/dimensões das imagens `public/landing/*`, `lazy`/`eager`) e recomendações (D12)
- [ ] 7.2 Registrar o procedimento de baseline do Search Console (desempenho, consultas, páginas, países, inspeção da home, sitemap, indexação) conforme acesso/evidência, sem inventar dados e sem configuração externa (D13)
- [ ] 7.3 Registrar a conferência operacional da exposição de `VERCEL_ENV` no projeto Vercel (a ausência é fail-closed e deve ser identificável antes da publicação) (D2/D6)
- [ ] 7.4 **C3** — registrar e expor para aprovação qualquer necessidade de ampliação de escopo (nova rota, conteúdo editorial, dados estruturados, alteração de performance na landing, configuração externa) antes de implementar

## 8. Testes e validação da preparação

- [ ] 8.1 Reconciliar o teste legado A9 conforme C2, com **comparação de cobertura**: eliminar expectativas obsoletas, preservar/migrar os testes válidos (Novidades: abertura, fechamento, `Escape`, retorno de foco, estado vazio) e **não** alterar o comportamento do produto; manter a suíte relevante da landing verde
- [ ] 8.2 Rodar os testes relevantes (helpers de SEO, metadata — incluindo herança do `noindex` default e exceção da home —, robots, sitemap, política por rota/ambiente, landing) e corrigir falhas introduzidas pela fatia
- [ ] 8.3 Rodar `lint` e `build` e registrar o resultado exato
- [ ] 8.4 Registrar `typecheck`: se a exceção `ssl`/`pg` (F56) ainda persistir, tratá-la como **externa** (não declarar `typecheck` aprovado enquanto ela existir e não corrigir a F56 implicitamente); se a F56 já tiver eliminado a exceção, o `typecheck` pode ser declarado aprovado (D14)
- [ ] 8.5 Rodar `openspec validate fase-51-2-fundacao-seo-descoberta-organica --strict` e registrar o resultado

## 9. Fechamento da preparação e pendências operacionais

- [ ] 9.1 Confirmar que nenhum arquivo da F56, `middleware.ts`, autenticação, ledger, migrations, crédito, onboarding ou a landing aprovada foi alterado (D14)
- [ ] 9.2 Separar explicitamente no registro de status (a) preparação técnica validada na branch de (b) ativação/validação pública após integração/publicação conjunta com a F56; resultados reais de indexação e aquisição **não** são critérios executáveis antes da publicação
- [ ] 9.3 Registrar as pendências operacionais (fora da implementação): canonicalização `www` → apex/HTTPS na Vercel/DNS; exposição de `VERCEL_ENV`; confirmação de acesso à propriedade do Search Console (o print disponível mostra "Insights" e não comprova configuração completa); envio do sitemap somente com autorização, após a publicação
- [ ] 9.4 Confirmar as fronteiras de processo: durante a **criação da proposta** nenhuma etapa GSD/verify/sync/archive/deploy foi executada; o **planejamento e a execução** GSD dependem de aprovação do responsável; o **fechamento OpenSpec** (verify/sync/archive) permanece sob condução conjunta; **deploy e configuração externa** permanecem fora desta fatia
