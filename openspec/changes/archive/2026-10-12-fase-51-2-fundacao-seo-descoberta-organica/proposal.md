## Why

A landing aprovada na F51.1 comunica o produto, mas o Vendeo ainda não tem fundação técnica de descoberta orgânica: a metadata da home está defasada, não existe `metadataBase`/`canonical`/Open Graph, não existem `robots.txt` e `sitemap.xml`, e não há política explícita de indexação por rota e por ambiente. Sem essa base, não é possível preparar crawling/indexação de forma controlada nem impedir que previews, autenticação, app, admin, callbacks e documentos legais concorram no índice. Esta fatia prepara a base técnica **sem alterar a landing aprovada na F51.1** e **sem prometer indexação, tráfego ou posição no Google**.

## What Changes

- Auditar host/protocolo/redirects e inventariar rotas e recursos públicos existentes, registrando os achados; definir `https://vendeo.tech` (sem `www`) como origem canônica. **Não alterar configuração externa** (DNS/Vercel/Supabase) nesta fatia.
- Definir `metadataBase` e trabalhar sempre com URLs absolutas; aplicar à home a metadata aprovada (título e descrição) **sem alterar o H1 nem o conteúdo visível**.
- Aplicar metadata de compartilhamento coerente (Open Graph/Twitter) com URL absoluta e imagem institucional.
- Criar política explícita de indexação: home indexável **apenas sob produção confirmada e origem canônica validada** (caso contrário: `noindex`, sitemap vazio e diagnóstico); previews e ambiente local `noindex`; login, signup, recuperação, callbacks, app e admin `noindex` e fora do sitemap; documentos legais acessíveis por seus links, mas `noindex` e fora do sitemap; versões Markdown públicas dos documentos legais tratadas como `noindex` **sem remover o acesso legítimo**; `/api/**` fora do sitemap, com tratamento adequado por tipo de resposta.
- Criar `robots.txt` (via `app/robots.ts`) e `sitemap.xml` (via `app/sitemap.ts`) com apenas URLs canônicas aprovadas e realmente indexáveis; **evitar** regras de `robots.txt` que impeçam a leitura do `noindex`.
- Distinguir ambientes por sinal confiável e **fail-closed** — indexável somente sob **produção confirmada (`VERCEL_ENV === "production"`) e origem canônica validada** — para impedir a indexação das previews **sem** bloqueio de rastreamento que impeça a leitura do `noindex` e sem levar acidentalmente `noindex` à home em produção. O `noindex` é o padrão da raiz, com a home como única exceção explícita; produção com origem inválida também resulta em `noindex`, sitemap vazio e diagnóstico.
- Preparar imagem de compartilhamento institucional com ativos oficiais do Vendeo, por composição **determinística/local** (sem geração por IA, sem chamadas pagas), preservando proporção, marca e slogan, sujeita a **aprovação visual humana** antes da incorporação final; caminhos locais dos ativos são fontes de trabalho e **nunca** URLs no código público.
- Registrar, nesta fatia, **diagnóstico e recomendações** de carregamento e estabilidade visual; mudanças de performance que afetem a landing ou componentes compartilhados exigem **aprovação separada**.
- Preparar coleta de baseline no Search Console (desempenho, consultas, páginas, países, inspeção da home, sitemap e indexação) conforme acesso/evidência disponível; **não inventar** volumes, resultados ou dados ausentes; **nenhuma** configuração externa ou envio de sitemap sem autorização.
- Prever testes de metadata, canonical, sitemap e política de indexação por ambiente/rota; reexecutar testes relevantes, lint, typecheck, build e validação OpenSpec.
- Separar explicitamente (a) preparação técnica validada na branch e (b) ativação/validação pública após integração/publicação conjunta com a F56. Resultados reais de indexação e aquisição **não** são critérios executáveis antes da publicação.

**Fora de escopo nesta mudança:** instrumentação de conversão; oferta/créditos; autenticação; banco/migrations; qualquer alteração na F56; páginas editoriais, blog ou conteúdo novo; alterações comerciais da landing (layout, copy visível, campanhas, logos e CTAs); dados estruturados (JSON-LD); deploy e ativação pública; alteração de DNS, Vercel, Supabase ou Search Console.

## Capabilities

### New Capabilities

- `seo-discovery-foundation`: origem canônica e `metadataBase`; metadata da home e de compartilhamento; política de indexação (`index`/`noindex`) por rota e por ambiente; `robots.txt` e `sitemap.xml`; tratamento de documentos legais, versões Markdown e APIs; imagem de compartilhamento institucional; fronteira de escopo e proibição de prometer indexação.
- `organic-discovery-readiness`: registro do diagnóstico de carregamento/estabilidade visual e recomendações; procedimento de baseline no Search Console; limite de expectativa (sem prometer indexação, tráfego ou posição); plano de validação; separação entre preparação na branch e ativação pública.

### Modified Capabilities

- `route-redirects`: reconciliar a spec com o código — a rota `/` deixou de redirecionar para `/dashboard` (na F51.1 `/` passou a ser a landing pública) — e registrar que a canonicalização de host/protocolo (`vendeo.tech`, sem `www`, HTTPS) é responsabilidade **operacional externa**, auditada e **não** implementada em `next.config.ts`.

## Auditoria (achados)

| # | Achado | Evidência | Efeito nesta fatia |
|---|---|---|---|
| A1 | Metadata da home defasada | `src/app/page.tsx` usa título "Vendeo — Campanhas profissionais para sua loja" e descrição de beta fechado | Substituir pela metadata aprovada |
| A2 | Sem `metadataBase`/`canonical`/Open Graph/Twitter | `src/app/layout.tsx` define apenas `title`, `description`, `manifest` e `icons` | Adicionar metadata base e de compartilhamento |
| A3 | Sem `robots.txt`/`sitemap.xml` | Não existem `src/app/robots.ts`, `src/app/sitemap.ts` nem `public/robots.txt` | Criar via Metadata API / MetadataRoute |
| A4 | Inventário de rotas | Públicas: `/`, `/login`, `/signup`, `/check-email`, `/forgot-password`, `/update-password`, `/termos`, `/privacidade`, `/uso-aceitavel`, `/auth/confirm`, `/auth/callback`, `/auth/signout`, `/api/**`, `/docs/legal/*.md`; protegidas: `(app)/**` (inclusive `/novidades`) | Aplicar política de indexação por rota |
| A5 | `Novidades` é painel, não página pública | `src/app/(app)/novidades/page.tsx` vive sob `(app)/layout.tsx` → `requirePageUser()`; na landing aparece só como modal de rodapé (`NovidadesLink`) | `noindex` e fora do sitemap |
| A6 | Spec `route-redirects` divergente do código | A spec ainda lista `/` → `/dashboard`; `next.config.ts` mantém apenas 4 redirects 301 e `src/__tests__/next.config.test.ts` afirma a ausência do redirect de `/` | Reconciliar a spec (Modified Capability) |
| A7 | Documentos legais duplicados em Markdown | `public/docs/legal/*.md` servidos diretamente, além de `/termos`, `/privacidade`, `/uso-aceitavel` | `noindex` nos dois, sem `Disallow` |
| A8 | Única env derivada de domínio | `NEXT_PUBLIC_SITE_URL` em `src/lib/supabase/site-url.ts` (throw se ausente; inlined no build) | Base de `metadataBase`, com distinção por ambiente |
| A9 | Teste legado duplicado e falhando | `src/__tests__/app/landing-page.test.tsx` referencia blocos removidos na F51.1 ("O Vendeo pode criar"/"Como funciona"); execução atual = **13 falhas / 6 passes**. Contém ainda testes válidos de interação de Novidades (abertura, fechamento, `Escape`, retorno de foco, estado vazio) | Reconciliar com **comparação de cobertura** (eliminar o obsoleto, preservar/migrar o válido), sem alterar o produto; requer confirmação humana (C2) |
| A10 | Composição viável sem IA/pago | `sharp` já é dependência; logos oficiais existem apenas em caminho local | Composição determinística; sem IA; caminhos locais fora do código |
| A11 | Sem dados estruturados | Nenhum JSON-LD no código | Fora do escopo desta fatia (sem dados elegíveis além de identidade básica) |

## Pendências operacionais (separadas da implementação)

- Auditar e, se necessário, ajustar a canonicalização de host/protocolo e o redirect de `www` → apex **na Vercel/DNS** (externo; exige autorização).
- Confirmar a exposição de `VERCEL_ENV` no projeto Vercel (a ausência é fail-closed e precisa ser identificada antes da publicação).
- Confirmar acesso à propriedade do Search Console; o print disponível mostra "Insights", o que **não comprova** configuração completa nem desempenho não relacionado à marca.
- Enviar o sitemap ao Search Console **somente** com autorização, após a publicação.
- Reexecutar a validação pública (metadata, canonical, robots, sitemap, indexação) após integração/publicação conjunta com a F56.

## Checkpoints humanos

- **C1 — Imagem de compartilhamento:** aprovação visual da composição antes da incorporação final.
- **C2 — Teste legado (A9):** confirmação para reconciliar/remover o arquivo duplicado **após comparação de cobertura** (eliminar o obsoleto, preservar/migrar os testes válidos de Novidades, sem alterar o produto).
- **C3 — Ampliação de escopo:** qualquer necessidade de ultrapassar os limites definidos (nova rota, conteúdo editorial, dados estruturados, alteração de performance na landing, configuração externa) deve ser exposta para aprovação **antes** de implementar.

## Impact

- **Código (preferencial):** `src/app/layout.tsx` (`metadataBase` + default `noindex`), `src/app/page.tsx` (metadata da home), novos `src/app/robots.ts` e `src/app/sitemap.ts`, `next.config.ts` (`headers()` para `X-Robots-Tag`), `src/lib/seo/*` (helpers puros de origem **validada**, ambiente e política), `src/app/(marketing)/*` e `src/app/(auth)/*`/`src/app/(app)/*` (metadata `noindex`), asset de compartilhamento em `public/` e testes correspondentes.
- **Compartilhado (usar, não alterar contrato):** `src/lib/supabase/site-url.ts`, `src/lib/launch-config/config.ts`, `openspec/design-system/MASTER.md` (superfície da landing `#0F172A`/`--bg-surface`, `--bg-deep` `#020617`, acento `#22C55E`, Poppins + Open Sans, **sem** light mode, **sem** emojis), `app/manifest.ts`.
- **Justificativa obrigatória** antes de tocar `globals.css`, design system global, dependências, `middleware.ts` ou qualquer arquivo da F56.
- **Não alterar:** H1, copy visível, layout, campanhas, logos e CTAs da landing; código da F56; ledger, migrations, serviços de crédito, onboarding e telas autenticadas (além da metadata `noindex`).
- **Dependência registrada:** `www` → apex, HTTPS e permissões do Search Console dependem de configuração externa e de autorização, não desta fatia.
- **Validação:** testes de metadata/canonical/sitemap/política por ambiente e rota, incluindo herança de `noindex` e a exceção da home; lint, typecheck e build. A exceção `ssl`/`pg` (F56), **se ainda persistir**, é tratada como **externa**: `typecheck` **não** é declarado aprovado enquanto ela existir e a F56 **não** é corrigida implicitamente (se a F56 corrigir, o `typecheck` pode voltar a ser aprovado). Checkpoint humano da imagem de compartilhamento antes da incorporação final.
