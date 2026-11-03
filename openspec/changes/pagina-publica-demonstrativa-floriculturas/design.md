## Context

A base está em `main` (`c86889e3`), com a F58 concluída e as quicks de localização encerradas. A entrega é independente da quick `261103-cpv` (campanha pronta) e não mexe em campanha, créditos, oferta ou fluxo de geração.

Contratos existentes relevantes:

- `src/app/page.tsx` é a única landing pública; `src/app/(marketing)/` contém apenas documentos legais e não tem layout próprio (herda `src/app/layout.tsx`).
- `src/lib/seo/indexation-policy.ts` centraliza `INDEX_ROBOTS`, `NOINDEX_ROBOTS`, `HOME_CANONICAL_PATH` e `getSurfacePolicy()`; qualquer path desconhecido cai em `NOINDEX_POLICY`.
- `src/lib/seo/environment.ts` define a condição combinada: `VERCEL_ENV === "production"` **e** origem canônica validada.
- `src/app/sitemap.ts` publica somente `${origin}/` sob a condição combinada.
- `next.config.ts` aplica `X-Robots-Tag: noindex, nofollow` global fora de produção confirmada; `robots.ts` nunca usa `Disallow`.
- `src/middleware.ts` tem matcher explícito; rotas não listadas não passam por autenticação.
- `src/components/landing/campaign-image.tsx` oferece caixa 1:1 com `object-contain`; `buildLandingSrcSet` exige o contrato fechado de 5 variantes da landing e **não** será reutilizado aqui.
- `src/components/landing/acquisition-cta.tsx` lê `publicSignupEnabled` por prop e, com a flag desligada, aponta para `#acesso` — âncora que só existe na home.
- Fontes locais em `public/fonts/**` via `src/app/fonts.css`; tokens em `tailwind.config.ts`.

**Conflito de spec identificado:** `openspec/specs/seo-discovery-foundation/spec.md` afirma que somente a home é indexável e que o sitemap contém somente `${origin}/`. Uma segunda página indexável exige alteração explícita dessa spec — não é permitido incluir rota nova “automaticamente”.

## Goals / Non-Goals

**Goals:**

- Entregar `/floriculturas` com a copy aprovada e o par de imagens aprovado.
- Provar a transformação foto → campanha com conteúdo estático, sem geração ao vivo.
- Manter o aviso demonstrativo único e discreto.
- Garantir metadata, canonical e sitemap corretos por ambiente, sem enfraquecer o fail-closed.
- Entregar imagens leves e responsivas com duas variantes por imagem.
- Reutilizar componentes, fontes, tokens e fluxo de acesso atuais.
- Deixar a home visualmente inalterada, exceto o link contextual do rodapé.

**Non-Goals:**

- Redesenhar a home, o shell ou o design system.
- Criar páginas por segmento, CMS, blog ou framework de imagens.
- Alterar oferta, créditos, onboarding, autenticação, middleware ou geração.
- Corrigir o follow-up global de canonical/OG (`http://localhost:3000`).
- Prometer indexação, tráfego, posição, vendas, tempo de geração ou preservação exata do produto.
- Localizar a página para `es-419`.
- Reutilizar ou substituir `identidade-floricultura.webp` (par anterior, “Dona Flor”, um “n”).

## Decisions

### D1. URL `/floriculturas`

Curta, legível e sem colisão com prefixos privados (`/campanhas/**`, `/loja`, `/conta`, `/admin`) nem com o matcher do middleware. Alternativas descartadas: `/exemplos/floriculturas` (mais longa, sem ganho funcional) e `/para/floriculturas` (menos direta).

### D2. Rota no route group `(marketing)`

`src/app/(marketing)/floriculturas/page.tsx` não acrescenta segmento de URL, herda o layout raiz (fontes, tokens, `noindex` default) e mantém a separação entre páginas públicas e `(app)`.

### D3. Conteúdo estático, sem geração

A página não importa provider, não chama API de geração e não lê dados de campanha. O exemplo é composto por assets estáticos aprovados.

### D4. Aviso demonstrativo uma única vez

O texto aprovado aparece uma vez, abaixo do par de imagens, em `text-xs text-text-secondary`. Sem segundo aviso no rodapé e sem bloco de advertência comercial. A regra interna de não prometer vendas/tempo/preservação exata permanece como critério de aceite da spec, não como copy pública.

### D5. Duas variantes WebP por imagem

Layout: cada coluna do par mede ~452px CSS no desktop e `min(342px, 100vw - 48px)` no mobile. Adotando DPR 2, o maior candidato necessário é ~904px; 1024 cobre 2× com folga. O menor candidato 480 cobre 1× e telas pequenas.

| Asset | Maior | Menor |
|---|---|---|
| Foto (1312×1199) | 1024×936 | 480×439 |
| Campanha (1024×1024) | 1024×1024 | 480×480 |

Pipeline Sharp já existente (`quality: 82`, `effort: 6`, `smartSubsample: true`). Sem upscale, sem framework novo, sem gerar as 5 variantes da landing. `sizes`: `(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))`.

Como `buildLandingSrcSet` exige original 1024 quadrado e 5 candidatos, a página usa um módulo local `image-sources.ts` com as duas strings de `srcset`. A allowlist da landing permanece intocada.

### D6. Prioridade de carregamento definida por medição

A hipótese inicial era a campanha como LCP no desktop, por ocupar 452×452 contra 452×413 da foto. **A medição no navegador refutou a hipótese:** o LCP observado foi o `h1`, tanto em desktop (1440×900, 124 ms) quanto em mobile (390×844, 64 ms), com as fontes locais aplicando `font-display: swap`.

Conduta adotada:

1. Nenhuma imagem recebe `fetchPriority="high"` — a prioridade alta competiria com o texto que é o LCP real.
2. Ambas permanecem `loading="eager"` (ficam na área do primeiro viewport/no topo da demonstração) e nenhuma usa `lazy`.
3. A medição e o elemento vencedor ficam registrados em `evidence/lcp-measurement.json` e no SUMMARY.

Se uma medição futura, em rede lenta ou outro viewport, apontar a campanha (ou a foto) como LCP, a prioridade deve ser reavaliada com base nessa medição — não na área aparente.

### D7. Dois CTAs, mesmo fluxo

A contradição anterior (CTA só no encerramento) é resolvida com dois usos do mesmo `AcquisitionCta`: um imediatamente após a abertura e outro no encerramento. `GoogleButton` não usa `id` fixo, então duas instâncias não colidem. Com a flag desligada, ambos apontam para `/#acesso`; com a flag ligada, ambos oferecem Google e e-mail.

Na abertura, abaixo do CTA principal, entra o link secundário “Conheça o Vendeo” → `/` (mesma aba, topo da home). O encerramento mantém apenas o CTA de acesso. O link é renderizado ao lado do `AcquisitionCta`, sem nova prop e sem alterar os demais consumidores.

### D7.1 Texto gerado em card HTML

A entrega não é só a arte. O texto gerado pela campanha (título, legenda, hashtags e chamada final) é exibido em um card na mesma seção da explicação — ao lado no desktop, abaixo no mobile. É texto HTML, não captura de interface, e não reproduz os botões “Copiar”: a página demonstra a entrega, não opera o aplicativo. O card é visualmente secundário em relação ao par antes/depois.

### D8. `accessHref` opcional no `AcquisitionCta`

Nova prop opcional com default `"#acesso"`. A home não muda de comportamento. Alternativa descartada: duplicar o CTA na página nova, o que criaria dois contratos visuais divergentes.

### D9. Indexação como decisão explícita

`FLORICULTURAS_CANONICAL_PATH` entra em `indexation-policy.ts` como segunda superfície aprovada. O consumidor decide entre `INDEX_ROBOTS` e `NOINDEX_ROBOTS` via `isIndexableEnvironment()`. Canonical absoluto só é emitido quando a origem é validada; fora disso é omitido (não se herda canonical de produção em preview).

`robots.ts`, `robots-headers.ts`, `next.config.ts` e `middleware.ts` não mudam: o `X-Robots-Tag` global já cobre preview/local, e a rota não casada no matcher permanece pública.

### D10. Link contextual no rodapé da home

Um link na `nav` do rodapé: “Exemplo: campanha para floricultura” → `/floriculturas`. Não cria bloco, não altera ordem, H1, imagens, CTAs ou textos existentes. É a única mudança visível na home e precisa constar da fronteira da `seo-discovery-foundation`.

### D11. OG da página

Reutiliza `/seo/vendeo-og-1200x630.png`. Uma imagem OG específica exigiria composição determinística e aprovação visual separada — fica como follow-up.

## Risks / Trade-offs

- **Duas superfícies indexáveis reduzem a simplicidade da política.** Mitigação: allowlist explícita por constante, testes por path e default fail-closed preservado.
- **Duplicação mínima do header/footer da home.** Mitigação: componentes locais pequenos; extração para componente compartilhado fica como follow-up para não tocar a home nesta entrega.
- **Dois CTAs com a flag ligada podem parecer repetitivos.** Decisão do responsável; ambos usam o mesmo componente e fluxo, sem novo estado.
- **`1024` como maior candidato pode ficar levemente abaixo de 2× em telas muito largas.** O layout limita a coluna a ~452px CSS; 1024 cobre 2× com folga. Sem upscale.
- **`identidade-floricultura.webp` continua na home com a marca “Dona Flor”.** Não é alterado nesta entrega; a página nova usa “Donna Flor”. A diferença de grafia deve ser conferida no checkpoint visual.

## Migration Plan

Não há migration de banco. A publicação é apenas código + assets estáticos. Rollback: remover a rota, as constantes de indexação, as quatro entradas de sitemap/testes e o link do rodapé; nenhum dado é migrado.

## Open Questions

- Imagem OG própria da página: follow-up, não bloqueia esta entrega.
- Extração de header/footer compartilhados entre home e página de segmento: follow-up.
