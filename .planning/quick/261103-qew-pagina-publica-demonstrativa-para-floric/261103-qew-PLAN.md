---
quick_id: 261103-qew
slug: pagina-publica-demonstrativa-para-floric
status: awaiting_approval
mode: plan_only
created: 2026-11-03
base_branch: main
base_commit: c86889e3
implementation_authorized: false
---

# Quick 261103-qew — Página pública demonstrativa para floriculturas (somente planejamento)

## 1. Enquadramento e limites desta rodada

- **Somente investigação e planejamento.** Nenhum código de produto, migração, dependência, merge, push ou deploy nesta rodada.
- Entrega de **uma página pública** que mostra a transformação foto de produto → campanha profissional, usando o par aprovado (orquídea roxa sintética + campanha Donna Flor gerada no Vendeo).
- **Não integra** a quick `261103-cpv` (localização da campanha pronta). Base conferida: `main` em `c86889e3`, árvore limpa, sem branch de trabalho paralela.
- **Não reutilizar** `public/landing/identidade-floricultura.webp` (par anterior: buquê de rosas, "Floricultura Dona Flor", grafia com um "n"). O novo material é "Donna Flor" (dois "n"), com orquídea roxa no balcão.
- Sem geração paga, backend, créditos, oferta, localização, analytics/funil, dependências novas e sem corrigir o follow-up global de canonical/OG (`http://localhost:3000`).
- Sem prometer aumento de vendas, tempo de geração não medido ou preservação exata do produto.

## 2. Estado atual relevante (evidência de leitura)

| Item | Situação encontrada |
|---|---|
| Rota pública | Só `/` é indexável; `(marketing)` contém apenas páginas legais |
| Indexação | `src/lib/seo/indexation-policy.ts` — default fail-closed `noindex, nofollow`; home é a única exceção |
| Sitemap | `src/app/sitemap.ts` — somente `${origin}/` sob produção confirmada + origem canônica validada |
| Robots | `src/app/robots.ts` — permissivo; referencia sitemap só na condição combinada |
| Headers | `next.config.ts` + `buildRobotsHeaders` — `X-Robots-Tag: noindex` global fora de produção confirmada |
| Middleware | `src/middleware.ts` — matcher explícito; rotas não listadas são públicas (novo path não exige entrada) |
| Imagens | `CampaignImage` (caixa 1:1), `buildLandingSrcSet` + allowlist fechada de 9 basenames + variantes 320/480/640/768 |
| CTA | `AcquisitionCta` (client) lê `publicSignupEnabled` via prop; com flag off aponta para `#acesso` (âncora que só existe na home) |
| Fontes | Locais em `public/fonts/**` (Poppins + Open Sans), servidas por `src/app/fonts.css` |
| Design | Tokens Tailwind `bg-surface`, `text-primary`, `accent-green`, `max-w-5xl`, `px-6` |

## 3. Proposta de URL e SEO (candidatos, sem volume comprovado)

**Recomendado:** `/floriculturas`
- Curto, não colide com prefixos privados (`/campanhas/**`, `/loja`, `/conta`) nem com o matcher do middleware.
- Alternativas: `/exemplos/floriculturas` (mais explícito como demonstração) e `/para/floriculturas`.

| Campo | Proposta |
|---|---|
| URL | `https://vendeo.tech/floriculturas` |
| Title | `Campanha para floricultura: da foto à arte \| Vendeo` |
| Meta description | `Veja como uma foto de orquídea enviada por uma floricultura se transformou em uma campanha com arte e texto prontos para revisar e publicar.` |
| H1 | `Sua foto vira uma campanha pronta para divulgar sua floricultura` |
| Canonical | absoluto, emitido **somente** sob produção confirmada + origem canônica validada; nos demais ambientes, omitido |
| OG/Twitter | `url` da página + imagem institucional atual `/seo/vendeo-og-1200x630.png` (imagem própria da página fica como follow-up) |

Termos são **candidatos**, sem volume de busca comprovado. Não afirmar indexação, tráfego ou posição.

## 4. Plano técnico

### 4.1 Arquivo da página
- `src/app/(marketing)/floriculturas/page.tsx` — server component.
- O route group `(marketing)` não adiciona segmento de URL e não tem layout próprio: herda `src/app/layout.tsx` (fonts, tokens, `noindex` raiz).
- A página lê `getLaunchConfig()` **uma vez** no servidor e passa `publicSignupEnabled` ao CTA.
- Nenhuma alteração em `src/app/page.tsx` além do link interno do item 4.6.

### 4.2 Componentes
Novos, locais em `src/components/landing/floriculturas/`:
- `floriculturas-header.tsx` — logo `vendeo-logo-dark.webp` + `Entrar` (`/login`), mesmas classes do header da home (duplicação mínima; extração para componente compartilhado fica como follow-up).
- `demo-notice.tsx` — aviso discreto de exemplo demonstrativo (topo e rodapé).
- `transformation-pair.tsx` — foto enviada (proporcional, `<img>` puro) + seta decorativa + campanha gerada (`CampaignImage` 1:1 com `contain`).

Reutilizados sem redesenho: `CampaignImage`, `buildLandingSrcSet`, `AcquisitionCta`, tokens/fontes.

### 4.3 CTA e acesso
Problema encontrado: `AcquisitionCta` com flag off aponta para `#acesso`, inexistente fora da home.

**Recomendado:** adicionar prop opcional `accessHref?: string` (default `"#acesso"`, preservando a home) e usar `accessHref="/#acesso"` na página nova. É uma extensão retrocompatível, sem redesenho da home.
Alternativa (sem tocar componente compartilhado): CTA local na página nova, duplicando o contrato visual. Fica como decisão para aprovação.

### 4.4 Entrega responsiva de imagens
- Campanha: exportar/redimensionar deterministicamente para **1024×1024 WebP** (a allowlist e `buildLandingSrcSet` assumem original 1024 quadrado). Registrar `nome-base.webp` em `landing-image-srcset.ts`, no gerador `scripts/generate-landing-image-variants.mjs` e em `landing-assets.test.ts`; gerar variantes 320/480/640/768 com o pipeline Sharp existente (sem dependência nova).
- Foto enviada: `<img>` proporcional com `width`/`height` reais do arquivo (evita CLS), `loading="lazy"`, sem `srcset` (o pipeline atual só produz variantes quadradas — fora do escopo criar outro).
- Ambos com `alt` descritivo, sem promessa de preservação exata.

### 4.5 Indexação, canonical e sitemap
1. `src/lib/seo/indexation-policy.ts`: nova constante `FLORICULTURAS_CANONICAL_PATH = "/floriculturas"` e branch explícita retornando `INDEX_POLICY`; todo o resto continua `NOINDEX_POLICY`.
2. `page.tsx`: `robots = isIndexableEnvironment() ? INDEX_ROBOTS : NOINDEX_ROBOTS`; `alternates.canonical` absoluto apenas quando indexável (`${origin}${path}`), omitido caso contrário.
3. `src/app/sitemap.ts`: incluir a página **somente** sob a condição combinada, mantendo a home; fora dela, lista vazia como hoje.
4. `src/app/robots.ts` e `robots-headers.ts`: **sem alteração** (fora de produção o `X-Robots-Tag` global `/(.*)` já cobre a rota; em produção não há regra extra necessária).
5. `src/middleware.ts`: **sem alteração** (rota não casada permanece pública). Confirmar por teste que não há redirect para login.
6. Preview/local: `noindex` explícito na metadata + header global + sitemap vazio.

### 4.6 Link interno contextual
Um único link discreto no rodapé da home (`Exemplo: campanha para floricultura` → `/floriculturas`), sem alterar blocos, ordem, H1 ou copy da landing.
Alternativa sem tocar a home: apenas o sitemap + links de saída da página nova (descoberta mais fraca). Requer aprovação.

### 4.7 Fora de escopo desta entrega
Backend, geração, créditos, oferta, tradução/es-419, analytics, novas dependências, página por segmento, correção do canonical/OG global da home, redesign da home, remoção/substituição de `identidade-floricultura.webp`.

## 5. Testes e validação

Novos/atualizados:
- `src/__tests__/app/floriculturas-page.test.ts`: metadata index/noindex por ambiente; canonical absoluto só na condição combinada; H1 único; aviso de demonstração presente; ausência de chamada a API de geração; CTA sem âncora quebrada.
- `src/__tests__/app/sitemap.test.ts`: 2 entradas sob produção válida (home + floriculturas); vazio nas demais combinações; lista de URLs proibidas inalterada.
- `src/lib/seo/__tests__/indexation-policy.test.ts`: `/floriculturas` → `INDEX_ROBOTS` + `inSitemap: true`; `/rota-nova` continua noindex.
- `src/components/landing/__tests__/landing-assets.test.ts`: novo basename e variantes.

Comandos: suíte focada, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`.
Limitações conhecidas a registrar, sem corrigir: lint não cobre TypeScript; exceção externa `ssl`/`pg` (F56), se persistir, impede declarar typecheck aprovado.

## 6. Checkpoint humano visual (antes do fechamento)
- Build local + screenshots desktop 1440 e mobile 390 em `evidence/`.
- Conferir: aviso de demonstração visível e discreto; foto e campanha sem corte; ordem apresentação → par → explicação → como funciona → CTA; CTA nos dois estados da flag; sem overflow; contraste e foco de teclado.
- Aprovação explícita do responsável antes de qualquer fechamento.

## 7. Enquadramento OpenSpec

Não existe change ativa em `openspec/changes/` (somente `archive/`). A spec vigente `seo-discovery-foundation` afirma que **somente a home** é indexável e que o sitemap contém **somente** `${origin}/`; adicionar outra página indexável contraria a spec. Portanto **é necessária uma nova change OpenSpec antes de implementar**:

- **ID proposto:** `fase-59-pagina-publica-floriculturas`
- **Delta `seo-discovery-foundation` (MODIFIED):** superfícies indexáveis passam a ser `/` e `/floriculturas`; sitemap pode conter as duas sob a condição combinada; canonical absoluto por página; default fail-closed e `noindex` das demais rotas inalterados.
- **Nova capability `floriculturas-demonstration-page`:** conteúdo, aviso de exemplo demonstrativo, proibições de prova inventada e de geração paga.
- **Delta `landing-conversion-experience` (MODIFIED, se aprovado o link na home):** permite um link contextual no rodapé sem alterar blocos, ordem ou copy.
- Nenhum lifecycle (`propose`/`verify`/`sync`/`archive`) é executado nesta rodada.

## 8. Critérios de aceite do plano
- [ ] Caminhos dos dois arquivos aprovados fornecidos e conferidos (orquídea sintética + campanha Donna Flor)
- [ ] Dados reais da geração e a legenda entregue fornecidos, ou decisão explícita de omiti-los
- [ ] URL, title/description/H1 e textos aprovados
- [ ] Decisão sobre `accessHref` no `AcquisitionCta` vs CTA local
- [ ] Decisão sobre o link contextual na home
- [ ] OpenSpec change criada e aprovada
- [ ] Checkpoint visual humano aprovado
