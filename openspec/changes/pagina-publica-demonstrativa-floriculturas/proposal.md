## Why

A landing atual prova a transformação de uma foto em campanha, mas não tem uma página pública dedicada a um segmento. Para uma floricultura, a dúvida prática é: “a foto do meu produto na loja vira uma campanha publicável?”. O material aprovado (foto sintética de orquídea roxa no balcão + campanha demonstrativa da floricultura fictícia Donna Flor, gerada no Vendeo) permite responder isso com um exemplo concreto, sem depender de geração ao vivo, de cliente real ou de resultado comercial inventado.

A entrega também precisa ser descobrível sem alterar a home aprovada e sem transformar a exceção de indexação da home em regra implícita: hoje a spec `seo-discovery-foundation` declara que **somente a home** é indexável e que o sitemap contém **somente** `${origin}/`. Esta change atualiza essa política de forma explícita e limitada.

## What Changes

- Criar a rota pública `/floriculturas` como página demonstrativa, em `pt-BR`, mobile-first, com a copy aprovada pelo responsável.
- Compor a página em: abertura com CTA → demonstração (foto enviada / campanha criada + aviso demonstrativo) → explicação → segundo bloco → funcionamento em 4 passos → encerramento com CTA.
- Usar **somente** o último par aprovado: foto sintética da orquídea roxa no balcão e campanha Donna Flor gerada no Vendeo. O par anterior (`identidade-floricultura.webp`, “Dona Flor”, buquê de rosas) não é reutilizado.
- Exibir o aviso demonstrativo aprovado uma única vez, discreto, junto ao exemplo; sem bloco de advertência comercial adicional.
- Não exibir tabela de entrada, legenda gerada ou dado de geração ausente.
- Entregar **duas variantes WebP por imagem** (menor e maior), com `srcset`/`sizes`, proporção preservada, sem upscale e sem framework novo; a imagem de LCP não recebe lazy-loading.
- Reutilizar `AcquisitionCta` com nova prop opcional `accessHref` (default `#acesso`, comportamento atual da home preservado); na página nova, a flag desligada aponta para `/#acesso`.
- Posicionar dois CTAs — após a abertura e no encerramento — usando o mesmo fluxo de acesso.
- Emitir metadata própria com H1, title, description e canonical absoluto por página; permitir `index, follow` e inclusão no sitemap **somente** sob produção confirmada + origem canônica validada.
- Preservar `noindex` de preview/local e de todas as rotas privadas, legais e transitórias.
- Adicionar um link contextual no rodapé da home: “Exemplo: campanha para floricultura”.
- Preparar apenas os contratos de imagem/teste necessários; sem migration, backend, créditos, oferta, localização, analytics ou dependência nova.

## Capabilities

### New Capabilities

- `floriculturas-demonstration-page`: rota pública `/floriculturas`, composição aprovada, copy aprovada, aviso demonstrativo único, conteúdo estático, entrega responsiva de duas variantes por imagem e limites de comunicação (sem depoimento, resultado comercial ou funcionalidade inventada).

### Modified Capabilities

- `seo-discovery-foundation`: `/floriculturas` passa a ser superfície indexável explicitamente aprovada, ao lado da home; o sitemap pode conter as duas URLs sob a condição combinada; canonical absoluto por página; default fail-closed e `noindex` das demais rotas inalterados; a fronteira da fatia passa a permitir o link contextual no rodapé da home.

## Impact

- **Rotas:** nova `src/app/(marketing)/floriculturas/page.tsx`.
- **Componentes:** novos componentes locais da página; `AcquisitionCta` ganha prop opcional `accessHref`; `src/app/page.tsx` recebe um link no rodapé.
- **SEO:** `src/lib/seo/indexation-policy.ts` e `src/app/sitemap.ts`. `src/app/robots.ts`, `robots-headers.ts`, `next.config.ts` e `middleware.ts` permanecem inalterados.
- **Assets:** quatro arquivos WebP novos em `public/floriculturas/`; originais em `Downloads` não são alterados.
- **Banco/API/dependências:** sem migration, sem rota de API, sem nova dependência, sem geração paga.
- **Validação:** testes de página, sitemap, política de indexação e contrato de imagens; typecheck, lint, build, `git diff --check` e checkpoint visual humano desktop/mobile.
