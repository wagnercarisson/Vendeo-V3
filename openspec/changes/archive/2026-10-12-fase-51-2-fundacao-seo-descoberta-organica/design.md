## Context

A F51.1 (concluída e arquivada) renovou a landing pública em `src/app/page.tsx` + `src/components/landing/*`, com superfície de fundo da landing em `#0F172A` (`--bg-surface`), texto `#F8FAFC`, acento `#22C55E`, Poppins + Open Sans e `lucide-react`; o design system (`openspec/design-system/MASTER.md`) define também `--bg-deep: #020617`. A publicação está **adiada** até a conclusão/integração da F56, que está em outro worktree e **não** deve ser tocada.

O código hoje **não** possui fundação de descoberta orgânica: a metadata da home está defasada, não há `metadataBase`/`canonical`/Open Graph, não existem `robots.txt`/`sitemap.xml` e não há política de indexação por rota/ambiente. A única env derivada de domínio é `NEXT_PUBLIC_SITE_URL` (`src/lib/supabase/site-url.ts`, throw se ausente, inlined no build). Os redirects de migração PT-BR vivem em `next.config.ts` (4 entradas 301); a spec `route-redirects` ainda lista um redirect `/` → `/dashboard` que não existe mais (A6). `sharp` já é dependência. Os logos oficiais existem apenas em caminhos locais do responsável.

Fora do escopo desta fatia: alterar a landing aprovada (H1, copy visível, layout, campanhas, logos, CTAs), instrumentação de conversão, oferta/créditos, autenticação, banco/migrations, F56, conteúdo editorial, dados estruturados, deploy/ativação pública e configuração externa (DNS/Vercel/Supabase/Search Console).

## Goals / Non-Goals

**Goals:**

- Definir origem canônica (`https://vendeo.tech`, sem `www`), `metadataBase` e URLs absolutas, **após auditar** host/protocolo/redirects sem presumir que estejam corretos.
- Aplicar à home a metadata aprovada e metadata de compartilhamento coerente, **sem** alterar H1 ou conteúdo visível.
- Instituir política explícita de indexação por rota e ambiente, com `robots.txt` e `sitemap.xml` restritos a URLs canônicas realmente indexáveis.
- Impedir indexação de previews e do ambiente local **sem** risco de levar `noindex` à home em produção.
- Tratar documentos legais e suas versões Markdown sem remover acesso legítimo.
- Preparar imagem de compartilhamento institucional com ativos oficiais, com checkpoint humano.
- Registrar diagnóstico de performance e plano de baseline no Search Console, sem alterar configuração externa.

**Non-Goals:**

- Prometer indexação, tráfego ou posição no Google.
- Alterar DNS/Vercel/Supabase/Search Console ou enviar sitemap.
- Alterar a landing aprovada, o pipeline de geração, a autenticação, o banco ou a F56.
- Criar páginas, blog ou conteúdo editorial; implementar dados estruturados (JSON-LD).
- Implementar mudanças de performance que afetem a landing ou componentes compartilhados.

## Decisions

### D1 — Origem canônica e auditoria de host/protocolo (sem alterar configuração externa)

`https://vendeo.tech` (sem `www`) é a origem canônica. A auditoria de host/protocolo/redirects é entregue como **achados registrados**; a canonicalização efetiva (`www` → apex, HTTPS, aliases de transição como `beta.vendeo.tech`) é **operacional externa** (Vercel/DNS) e não é implementada nem alterada nesta fatia. Os redirects de caminho existentes em `next.config.ts` permanecem intactos.

- **Alternativa considerada:** adicionar `host`-based redirects em `next.config.ts` — rejeitada nesta fatia porque a canonicalização real depende de domínio/DNS/Vercel e não pode ser validada em branch.

### D2 — `metadataBase` e origem canônica validada por ambiente

`metadataBase` é definido no `src/app/layout.tsx` a partir de um helper puro em `src/lib/seo/` (ex.: `resolveCanonicalOrigin()`).

- **Produção:** a origem canônica é `https://vendeo.tech` (sem `www`). O helper **valida** `NEXT_PUBLIC_SITE_URL` em vez de apenas verificar existência: interpreta a URL e exige protocolo `https`, host exatamente `vendeo.tech` e ausência de `www`, caminho, query ou fragmento.
- **Resposta do helper (nunca lança, nunca emite URL divergente):** `resolveCanonicalOrigin()` retorna um resultado explícito, por exemplo `{ origin: string | null, status: "valid" | "missing" | "invalid" | "non_canonical", indexable: boolean, diagnostic?: string }`.
  - `status: "valid"` → `origin = "https://vendeo.tech"` e `indexable` conforme o ambiente.
  - `status` diferente de `"valid"` → `origin = null`, `indexable = false`; `metadataBase`/canonical recaem sobre a origem de execução (ou são omitidos) e **nunca** apontam para uma origem divergente; o `diagnostic` é registrado de forma identificável (log/warning) antes da publicação.
  - O helper **não** lança exceção em nenhum caso, evitando falha inesperada da aplicação; a ausência crítico-operacional continua sinalizada pelo diagnóstico.
- **Valor ausente, inválido ou não canônico (produção):** tratado como **fail-closed** — não indexável, sem `index, follow`, sitemap sem URLs e `robots.txt` sem referência a sitemap divergente. O helper `src/lib/supabase/site-url.ts` (compartilhado com autenticação) **não** é alterado.
- **Preview/local:** `https://${VERCEL_URL}` quando disponível, senão `http://localhost:3000`; apenas para montar URLs absolutas, pois o ambiente já é `noindex` (D6).
- **`VERCEL_ENV`:** a exposição das variáveis de sistema é uma configuração da Vercel. Sua ausência continua **fail-closed** (não indexável) e é registrada como conferência operacional antes da publicação.

**Alternativa considerada:** derivar sempre de `NEXT_PUBLIC_SITE_URL` — rejeitada porque, na preview, a env pode conter o valor de produção e faria as previews emitirem canonical de produção. **Alternativa considerada:** reutilizar `getSiteUrl()` de `site-url.ts` — rejeitada porque o helper só valida existência e é compartilhado com o fluxo de autenticação (não deve ser alterado nesta fatia).

### D3 — Metadata da home aprovada

Aplicar em `src/app/page.tsx`, **sem** alterar H1 nem conteúdo visível:

- **Título:** `Vendeo | Crie campanhas para redes sociais com IA`
- **Descrição:** `Crie campanhas para redes sociais sem precisar saber design ou marketing. Arte e texto com a identidade da sua loja, prontos para revisar, baixar e publicar.`

Somente sob a condição combinada (produção confirmada e origem canônica validada) a home recebe `robots: index, follow` (D5/D6). A metadata de beta fechado deixa de orientar o snippet; a divergência apontada no plano original (metadata mencionando beta com signup aberto) fica resolvida pela copy aprovada, que não menciona beta.

### D4 — Metadata de compartilhamento

`openGraph` (type `website`, `locale: pt_BR`, `siteName: Vendeo`, título/descrição de D3, `url` absoluta) e `twitter` (`summary_large_image`) com URL absoluta, coerentes com `metadataBase`. A imagem é a composição institucional (D11).

### D5 — Matriz de indexação por rota (produção)

| Superfície | Indexação | Sitemap |
|---|---|---|
| `/` | `index, follow` (só sob produção confirmada **e** origem validada) | incluída somente sob essa condição |
| `/login`, `/signup`, `/check-email`, `/forgot-password`, `/update-password` | `noindex, nofollow` | fora |
| `/auth/confirm`, `/auth/callback`, `/auth/signout` | `X-Robots-Tag: noindex` | fora |
| `(app)/**` (`/dashboard`, `/loja`, `/campanhas/**`, `/conta`, `/novidades`, `/legal/reaccept`) | `noindex, nofollow` | fora |
| `/admin/**` | `noindex, nofollow` | fora |
| `/termos`, `/privacidade`, `/uso-aceitavel` | `noindex, nofollow` | fora |
| `/docs/legal/*.md` | `X-Robots-Tag: noindex` | fora |
| `/api/**` | `X-Robots-Tag: noindex` | fora |

Nenhuma página nova é incluída no índice/sitemap automaticamente. `Novidades` é **painel autenticado** (`(app)/layout.tsx` → `requirePageUser()`), não página pública (A5). `noindex`/`robots` **não** substituem autenticação nem controle de acesso.

**Padrão verificável:** o `noindex` é o default aplicado na **raiz** (`src/app/layout.tsx`, `robots: noindex, nofollow`), e somente a home sobrescreve para `index, follow` sob a condição combinada. Assim, rotas futuras herdam `noindex` sem depender de ação manual, e a única exceção é explícita e testada. Um sitemap vazio **não** é proteção suficiente contra indexação: a rota precisa de `noindex` (metadata ou `X-Robots-Tag`).

### D6 — Distinção de ambiente fail-closed (preview/local nunca indexável)

A condição única de indexabilidade é **produção confirmada (`VERCEL_ENV === "production"`) e origem canônica validada** (D2). Qualquer outra combinação (preview, development, build local com `NODE_ENV=production` sem `VERCEL_ENV`, `VERCEL_ENV` não exposto, ou produção com origem ausente/inválida/não canônica) é tratada como **não indexável**:

- `app/robots.ts`: sob a condição combinada, permite crawling das superfícies públicas e referencia o sitemap. **Fora dela, não bloqueia o rastreamento** — a diretiva é permissiva (sem `Disallow` que impeça a leitura do `noindex`), não referencia sitemap divergente e não publica sitemap.
- `next.config.ts` `headers()`: fora da condição combinada, adiciona `X-Robots-Tag: noindex, nofollow` a todas as rotas — este é o mecanismo que efetivamente impede a indexação, pois o robô consegue acessar a página e ler a instrução.
- Metadata da home: `robots: index, follow` somente sob a condição combinada; o default da raiz é `noindex`.
- `sitemap.ts`: lista a home somente sob a condição combinada; caso contrário, sem URLs.

A proteção de acesso já existente (`requirePageUser`, middleware de autenticação) permanece independente e não é substituída por `noindex`/`robots.txt`.

**Racional:** bloquear o rastreamento em previews impediria o robô de ler o `noindex` (contradição direta com D7); por isso a não indexação fora da condição combinada é feita por `X-Robots-Tag`, sitemap vazio e ausência de `index`, e não por `Disallow`.

**Alternativa considerada:** usar `NODE_ENV` — rejeitada porque build/serve local usam `NODE_ENV=production` e a home local acabaria indexável/`index`; `VERCEL_ENV` é o sinal confiável no alvo de deploy. **Alternativa considerada:** `Disallow: /` global fora de produção — rejeitada por impedir a leitura do `noindex`, contrariando a orientação do Google.

### D7 — Mecanismo e limites (sem tocar `middleware.ts`)

A política é aplicada por três mecanismos, **sem alterar `middleware.ts`** (arquivo compartilhado com autenticação e risco de regressão/F56):

1. metadata `robots` por rota (páginas client/Server Components);
2. `X-Robots-Tag` via `next.config.ts` `headers()` (route handlers, `/auth/**`, `/api/**`, `/docs/**` e, fora de produção, tudo);
3. `robots.txt` + `sitemap.xml`.

Regras de `robots.txt` **não** podem impedir a leitura do `noindex`: nenhuma superfície que dependa de `noindex` — sob a condição combinada **ou** fora dela — recebe `Disallow`. Fora da condição combinada, o `X-Robots-Tag` global (D6) e o default `noindex` da raiz (D5) são os mecanismos efetivos; `robots.txt` permanece permissivo para que o robô consiga ler a instrução.

### D8 — Sitemap restrito

`app/sitemap.ts` retorna somente URLs canônicas aprovadas e realmente indexáveis — nesta fatia, **apenas** `${origin}/` sob a condição combinada (produção confirmada e origem validada); caso contrário, retorna lista vazia. Não incluir `/api/**`, `/auth/**`, rotas autenticadas, admin, documentos legais, versões Markdown nem URLs com parâmetros.

### D9 — Documentos legais e versões Markdown

As páginas canônicas `/termos`, `/privacidade`, `/uso-aceitavel` recebem `noindex, nofollow` e ficam fora do sitemap, mas **permanecem acessíveis** pelos links existentes. As versões Markdown em `public/docs/legal/*.md` recebem `X-Robots-Tag: noindex` (via `headers()` em `/docs/:path*`), **sem** `Disallow` e sem remover o acesso legítimo (usadas por download/consulta). Estratégia compartilhada via constante em `src/lib/seo/`, sem introduzir layout novo.

### D10 — APIs

`/api/**` fica fora do sitemap e recebe `X-Robots-Tag: noindex` por `headers()`, sem alterar a lógica das rotas, seus códigos de resposta nem headers já existentes (cache/`Content-Disposition`). Isso é suficiente porque nenhuma API é destinada a indexação.

### D11 — Imagem de compartilhamento institucional

Composição **determinística e local** (por exemplo `sharp`, já disponível) montando a arte com os ativos oficiais:

- fontes locais de trabalho: `C:\Users\wagne\OneDrive\Vendeo\Logotipos\Logo\vendeo-logo-dark-1200-slogan.png` e `C:\Users\wagne\OneDrive\Vendeo\Logotipos\Logo\vendeo-logo-slogan-empilhado.png` — **nunca** referenciadas no código público;
- preservar proporção, marca e slogan, **sem** deformação nem recorte;
- fundo na paleta do design system (`--bg-surface` `#0F172A` — superfície aprovada da landing; `--bg-deep` `#020617` disponível para camadas mais profundas), acento `#22C55E`, **sem** light mode e **sem** emojis;
- alvo 1200×630 (Open Graph), salvo melhor decisão aprovada;
- **sem** geração por IA e **sem** chamadas pagas;
- a composição exata é apresentada visualmente ao responsável para aprovação **antes** da incorporação final (C1); o asset final entra em `public/` e o código referencia apenas o caminho público.

Os logos já usados na landing **não** são alterados.

### D12 — Performance: diagnosticar, não alterar

Registrar diagnóstico de carregamento e estabilidade visual (candidatos conhecidos: imagem hero em `public/landing/hero-oferta-cafe.webp` como LCP, carregamento de Google Fonts via `<link>` no `src/app/layout.tsx`, tamanho/peso das imagens `public/landing/*`, uso de `loading="lazy"` no rodapé) e recomendações. **Nenhuma** alteração de performance que afete a landing ou componentes compartilhados nesta fatia sem aprovação separada (C3).

### D13 — Search Console: baseline sem configuração externa

Documentar o procedimento de coleta de baseline (desempenho, consultas, páginas, países, inspeção da home, sitemap e indexação) conforme acesso/evidência disponível. O print disponível mostra "Insights" e **não** comprova configuração completa nem desempenho não relacionado à marca. Não inventar volumes/resultados; nenhuma configuração externa nem envio de sitemap sem autorização.

### D14 — Fronteira, não-regressão e exceção externa

Fronteira preferencial: `src/lib/seo/*`, `src/app/robots.ts`, `src/app/sitemap.ts`, metadata em `layout.tsx`/`page.tsx`/layouts de `(auth)`/`(app)`/`(marketing)`, `headers()` em `next.config.ts`, asset em `public/` e testes. Proibido alterar H1, copy visível, layout, campanhas, logos e CTAs; código, ledger, migrations, crédito, onboarding e telas autenticadas da F56; e a lógica de autenticação.

**Teste legado A9 (`src/__tests__/app/landing-page.test.tsx`):** antes de removê-lo, é obrigatória uma **comparação de cobertura** com o teste vigente `src/components/landing/__tests__/landing-page.test.tsx`: eliminar expectativas obsoletas, **preservar ou migrar** testes ainda válidos (em especial os de interação de Novidades — abertura, fechamento, `Escape`, retorno de foco e estado vazio) e **não** modificar o comportamento do produto apenas para satisfazer o teste antigo. A disposição é confirmada em C2.

**Exceção `ssl`/`pg` (F56):** é **externa**. O `typecheck` **não** é declarado aprovado enquanto a exceção persistir, e a F56 **não** é corrigida implicitamente. Se a correção da F56 eliminar a exceção, o `typecheck` pode voltar a ser declarado aprovado sem tornar esta fatia inconsistente.

### D15 — Checkpoints humanos

C1 (imagem de compartilhamento), C2 (teste legado A9) e C3 (qualquer ampliação de escopo: nova rota, conteúdo editorial, dados estruturados, alteração de performance na landing, configuração externa).

## Risks / Trade-offs

- **[`noindex` vazar para a home de produção]** → condição única de indexabilidade = produção confirmada **e** origem canônica validada (D2/D6); default `noindex` na raiz com exceção explícita da home (D5); testes cobrem produção válida, produção com origem inválida, preview/local e a herança de metadata; a home é o único item do sitemap.
- **[Previews indexadas]** → `X-Robots-Tag: noindex` em todas as rotas fora de produção + sitemap sem URLs + default `noindex`; `robots.txt` permanece permissivo (D6).
- **[`Disallow` impedir a leitura do `noindex`]** → nenhuma superfície que dependa de `noindex` recebe `Disallow`, inclusive fora de produção (D6/D7).
- **[`NEXT_PUBLIC_SITE_URL` ausente/inválida/não canônica]** → validação explícita (https + host `vendeo.tech` + sem `www`/caminho/query/fragmento) com fail-closed e sinal identificável; helper de autenticação intocado (D2).
- **[`VERCEL_ENV` não exposto]** → fail-closed (não indexável) + conferência operacional registrada antes da publicação (D2/D6).
- **[Rota futura indexada por esquecimento]** → `noindex` default na raiz, home como única exceção, herança de metadata verificada por teste e sitemap vazio não tratado como proteção (D5).
- **[Teste legado removido com perda de cobertura]** → comparação de cobertura obrigatória antes de remover A9, preservando/migrando os testes válidos de Novidades e sem alterar o produto (D14/C2).
- **[Canonical de produção emitido em preview]** → `metadataBase` por ambiente com `VERCEL_URL` (D2).
- **[Documentos legais/versões Markdown competindo no índice]** → `noindex` nos dois, sem remover acesso; sem `Disallow` (D9).
- **[Regressão em autenticação ao mexer em `middleware.ts`]** → `middleware.ts` não é alterado; a política usa metadata + `headers()` + `robots`/`sitemap` (D7).
- **[Suite relevante não verde por teste legado]** → A9 reconciliado com confirmação humana (C2/D14).
- **[Inferir dados de Search Console sem evidência]** → proibido inventar; baseline conforme acesso (D13).
- **[Composição da imagem distorcer a marca]** → composição determinística com preservação de proporção + aprovação humana antes da incorporação (D11/C1).
- **[Performance usada como desculpa para alterar a landing]** → nesta fatia só diagnóstico; mudanças exigem aprovação separada (D12/C3).
- **[Conflito com a F56]** → fronteira D14; publicação e validação pública adiadas à integração conjunta.

## Migration Plan

Separação explícita entre preparação e ativação:

**(a) Preparação técnica validada na branch**
1. Helper `src/lib/seo/*` (origem canônica **validada**, ambiente, política de indexação) com testes unitários, cobrindo valor ausente/inválido/não canônico de `NEXT_PUBLIC_SITE_URL` e ausência de `VERCEL_ENV` (D2).
2. `metadataBase` (D2), default `noindex` na raiz (D5) e metadata da home (D3) + compartilhamento (D4).
3. `robots.ts` (D6/D7) — permissivo fora de produção — e `sitemap.ts` (D8).
4. `headers()` com `X-Robots-Tag` por rota e por ambiente (D6/D7/D9/D10).
5. Metadata `noindex` nas superfícies de autenticação, app, admin e documentos legais, herdada do default da raiz.
6. Imagem de compartilhamento: composição apresentada e aprovada (C1), depois incorporada.
7. Diagnóstico de performance (D12) e procedimento de baseline do Search Console (D13) registrados.
8. Reconciliar o teste legado A9 com **comparação de cobertura** (C2/D14); rodar testes relevantes, lint, build e validação OpenSpec.

**(b) Ativação e validação pública (após integração/publicação com a F56)**
9. Auditar/ajustar host/protocolo e `www` → apex na Vercel/DNS (externo, com autorização) e confirmar a exposição de `VERCEL_ENV` (D2).
10. Validar metadata, canonical, robots, sitemap e indexação na origem pública.
11. Coletar baseline no Search Console e enviar o sitemap **somente** com autorização.

O planejamento e a execução GSD dependem de aprovação do responsável; o fechamento OpenSpec (verify/sync/archive) permanece sob condução conjunta. Deploy e configuração externa permanecem fora desta fatia.

**Rollback:** a fatia é aditiva e localizada. Reverter `src/lib/seo/*`, `robots.ts`, `sitemap.ts`, os blocos de metadata e as regras de `headers()` restaura o estado anterior sem afetar a landing, autenticação, pipeline ou F56. O asset de compartilhamento é removível sem impacto funcional.

## Open Questions

- Dimensão final da imagem de compartilhamento (1200×630) e variante para Twitter, a confirmar na aprovação visual (C1) — não bloqueante.
- Disposição do teste legado A9 (reconciliar vs. remover), a confirmar em C2 — sempre após comparação de cobertura (D14) — não bloqueante para a redação da base técnica.
- Provedor/serviço exato da canonicalização `www` → apex é externo e depende de auditoria operacional (fora da implementação).
- Confirmação operacional de que `VERCEL_ENV` está exposto no projeto Vercel (a ausência é fail-closed, mas deve ser identificada antes da publicação).
