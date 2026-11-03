---
quick_id: 261103-qew
slug: pagina-publica-demonstrativa-para-floric
status: awaiting_approval
mode: plan_only
reconciled: 2026-11-03
base_branch: main
base_commit: c86889e3
implementation_authorized: false
openspec_change: pagina-publica-demonstrativa-floriculturas
---

# Quick 261103-qew — Página pública demonstrativa para floriculturas (planejamento reconciliado)

## 1. O que mudou nesta reconciliação

A copy foi aprovada pelo responsável. Esta versão **substitui** integralmente a anterior:

- H1 e aviso demonstrativo aprovados substituem os textos propostos.
- Title, meta description, abertura, títulos, rótulos, explicação, passos e encerramento seguem a versão aprovada (ver `261103-qew-COPY.md`).
- **Removidos** da página: tabela de entrada, legenda gerada e qualquer advertência comercial (“não promete vendas”, “não mede tempo”, “foto criada com IA”). Restrições permanecem apenas como critério interno de aceite.
- **Removido** o bloco de "informações ainda necessárias" como pendência de conteúdo: os arquivos-fonte foram entregues e as dimensões conferidas.
- **Resolvida** a contradição do CTA: dois CTAs, um após a abertura e outro no encerramento, com o mesmo fluxo.
- **Resolvido** o enquadramento OpenSpec sem criar fase 59: change descritiva `pagina-publica-demonstrativa-floriculturas`.

Limites mantidos: uma página, sem geração paga, backend, créditos, oferta, localização, analytics, dependências novas, merge, push, deploy ou sync/archive.

## 2. Base e isolamento (conferidos)

| Item | Estado |
|---|---|
| Branch | `main` |
| HEAD de partida | `c86889e3` |
| Árvore antes da rodada | limpa |
| Quick de tradução `261103-cpv` | encerrada, não tocada |
| Par anterior (`identidade-floricultura.webp`, Dona Flor, um “n”) | **não reutilizar** |

## 3. Arquivos-fonte aprovados (conferidos)

| Material | Caminho | Dimensões | Peso |
|---|---|---|---|
| Foto sintética da orquídea roxa no balcão | `C:\Users\wagne\Downloads\OpenAI Playground 2026-11-03 at 18.28.13.png` | 1312×1199 PNG sRGB | 2.266.014 B |
| Campanha Donna Flor gerada no Vendeo | `C:\Users\wagne\Downloads\orqu_dea_phalaenopsis-2026-11-03 (1).jpg` | 1024×1024 JPEG sRGB | 254.571 B |

Os originais não são alterados; a página consome apenas derivados WebP.

## 4. SEO

| Campo | Valor |
|---|---|
| URL | `/floriculturas` |
| Title | `Campanhas para floriculturas: crie artes com IA \| Vendeo` |
| Description | `Transforme fotos de flores e arranjos em campanhas para divulgar sua floricultura nas redes sociais. Arte e texto com sua marca, sem precisar saber design.` |
| H1 | `A beleza das suas flores merece uma divulgação de qualidade.` |
| Canonical | absoluto (`https://vendeo.tech/floriculturas`) **somente** sob produção confirmada + origem canônica validada; omitido nos demais ambientes |
| OG/Twitter | URL da página + `/seo/vendeo-og-1200x630.png` |

Termos são candidatos, sem volume de busca comprovado. Não afirmar indexação, tráfego ou posição.

## 5. Plano técnico

### 5.1 Rota e página
- `src/app/(marketing)/floriculturas/page.tsx` — Server Component.
- O route group `(marketing)` não adiciona segmento de URL e não tem layout próprio: herda `src/app/layout.tsx`.
- `getLaunchConfig()` é lido **uma vez** no servidor; `publicSignupEnabled` vai para os dois CTAs.
- Sem `export const dynamic`; sem fetch; conteúdo estático.

### 5.2 Componentes
Novos, locais em `src/components/landing/floriculturas/`:
- `floriculturas-header.tsx` — logo `vendeo-logo-dark.webp` + `Entrar` (`/login`), mesmas classes do header da home.
- `image-sources.ts` — constantes dos quatro arquivos + strings de `srcset`/`sizes` (módulo puro, sem framework novo).
- `demonstration-pair.tsx` — rótulos, foto proporcional, seta decorativa, campanha 1:1 e aviso demonstrativo.

Reutilizados sem redesenho: `AcquisitionCta` (com `accessHref`), tokens Tailwind e fontes locais (`src/app/fonts.css`). **Não** usar `buildLandingSrcSet` nesta página: ele exige o contrato de 5 variantes da landing; aqui são 2 variantes por imagem.

### 5.3 CTA e acesso
- `AcquisitionCta` ganha prop opcional `accessHref?: string` com default `"#acesso"` — home preservada byte a byte no comportamento.
- Página nova usa `accessHref="/#acesso"`.
- Flag ligada: Google + e-mail (fluxo atual). Flag desligada: `Solicitar acesso free` → `/#acesso`.
- Dois CTAs usam o mesmo componente e o mesmo destino. Sem alterar oferta, créditos ou fluxo de acesso.
- `GoogleButton` não usa `id` fixo; duas instâncias não colidem.

### 5.4 Imagens (duas versões por imagem)
Saída em `public/floriculturas/`:

| Arquivo | Dimensão | Uso |
|---|---|---|
| `foto-orquidea-balcao-1024w.webp` | 1024×936 | candidato maior |
| `foto-orquidea-balcao-480w.webp` | 480×439 | candidato menor |
| `campanha-donna-flor-1024w.webp` | 1024×1024 | candidato maior |
| `campanha-donna-flor-480w.webp` | 480×480 | candidato menor |

- `sizes`: `(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))`.
- Larguras derivadas de ~452px CSS × DPR 2 ≈ 904px: 1024 cobre 2×; 480 cobre 1× e telas menores. Sem upscale; proporção preservada.
- Pipeline Sharp já existente (WebP q=82, effort 6, smartSubsample). Sem dependência nova.
- LCP = campanha (maior área pintada: 452×452 vs 452×413) → `loading="eager"` + `fetchPriority="high"`. Foto `eager` sem prioridade alta. **Nenhuma das duas com `lazy`.**
- Dimensões e pesos finais dos quatro arquivos são registrados no SUMMARY da implementação.

### 5.5 Indexação, canonical e sitemap
1. `src/lib/seo/indexation-policy.ts`: constante `FLORICULTURAS_CANONICAL_PATH = "/floriculturas"` e branch explícita `INDEX_POLICY`; todo o restante continua `NOINDEX_POLICY`.
2. `page.tsx`: `robots = isIndexableEnvironment() ? INDEX_ROBOTS : NOINDEX_ROBOTS`; canonical absoluto só quando indexável, omitido caso contrário.
3. `src/app/sitemap.ts`: home + `/floriculturas` **somente** na condição combinada; fora dela, lista vazia como hoje.
4. `src/app/robots.ts` e `robots-headers.ts`: sem alteração (o header global `/(.*)` já cobre preview/local).
5. `src/middleware.ts`: sem alteração (rota não casada permanece pública); teste confirma ausência de redirect para `/login`.
6. Rotas privadas e legais permanecem `noindex` e fora do sitemap.

### 5.6 Link interno contextual
Um link no rodapé da home: `Exemplo: campanha para floricultura` → `/floriculturas`, na mesma `nav` dos links legais. Não altera blocos, ordem, H1, imagens ou CTAs da home.

### 5.7 Fora de escopo
Backend, geração, créditos, oferta, localização/es-419, analytics, novas dependências, páginas por segmento, correção do canonical/OG global, redesign da home, substituição de `identidade-floricultura.webp`.

## 6. Testes e validação

- `src/__tests__/app/floriculturas-page.test.ts`: H1 único e exato; dois CTAs; `accessHref` correto com flag off; metadata index/noindex por ambiente; canonical absoluto só na condição combinada; aviso demonstrativo presente uma vez; ausência de tabela/legenda; ausência de chamada a API de geração.
- `src/__tests__/app/sitemap.test.ts`: 2 entradas sob produção válida; vazio nas demais combinações; proibições atuais mantidas.
- `src/lib/seo/__tests__/indexation-policy.test.ts`: `/floriculturas` → `INDEX_ROBOTS` + `inSitemap: true`; `/rota-nova` segue noindex.
- `src/components/landing/floriculturas/__tests__/image-sources.test.ts`: quatro arquivos existem, são WebP, têm as dimensões contratadas, peso ≤ original e `srcset`/`sizes` exatos. LCP sem `loading="lazy"` verificado na página.
- Gates: suíte focada, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`.
- Limitações a registrar, sem corrigir: lint não cobre TypeScript; exceção externa `ssl`/`pg` (F56), se persistir, impede declarar typecheck aprovado.

## 7. Checkpoint humano visual (antes do fechamento)
- Build local + screenshots desktop 1440 e mobile 390 em `evidence/`.
- Conferir: ordem dos blocos; dois CTAs; aviso demonstrativo único e discreto; foto sem distorção; campanha 1:1 sem corte; nenhuma tabela/legenda; sem overflow; foco de teclado e contraste.
- Aprovação explícita do responsável antes de qualquer fechamento.

## 8. OpenSpec

Change ativa proposta: `openspec/changes/pagina-publica-demonstrativa-floriculturas/`
- `floriculturas-demonstration-page` (nova capability)
- `seo-discovery-foundation` (MODIFIED: `/floriculturas` indexável; sitemap com home + página)
- `landing-conversion-experience`: **sem delta** — o link de rodapé não cria bloco novo, não altera a ordem e preserva os links existentes; a permissão explícita fica na fronteira da `seo-discovery-foundation`.

Nenhum lifecycle executado.

## 9. Critérios de aceite
- [ ] Change OpenSpec revisada e aprovada
- [ ] Copy aprovada implementada sem acréscimos
- [ ] Duas variantes WebP por imagem, com dimensões/pesos registrados
- [ ] Dois CTAs com o mesmo fluxo e `accessHref` correto
- [ ] Metadata/canonical/sitemap conforme a matriz de ambientes
- [ ] Checkpoint visual humano aprovado
