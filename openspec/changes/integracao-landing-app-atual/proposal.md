## Why

A landing da F51.1 e a fundação de SEO da F51.2 foram concluídas em uma frente paralela (`escopo/landing`, `7d0d6d96`), enquanto a `main` (`8c4413de`) avançou com F56, modelos/geração, convites de acesso e a oferta F50.2. O merge direto cruza 14 arquivos e produziria regressões concretas: perda da confirmação de convite por e-mail/caixa de spam, remoção do isolamento de build do laboratório, perda de cobertura de testes migrada e conflito de ignores. É necessário integrar a landing e o SEO preservando integralmente o aplicativo atual.

## What Changes

- Integrar `escopo/landing` na `main` por merge controlado em `integracao/landing-app-atual` (`--no-commit --no-ff`), resolvendo os conflitos sem descartar nenhuma das duas frentes e sem commit automático antes da revisão.
- Preservar o visual aprovado da landing F51.1 (sete blocos, hero, imagens, CTAs e rodapé legal) e incorporar a metadata/SEO da F51.2 (origem canônica, `robots`, `sitemap`, `X-Robots-Tag`, imagem de compartilhamento).
- Preservar o comportamento e o texto atuais da confirmação de solicitação de acesso: convite por e-mail e verificação da caixa de spam.
- Migrar a cobertura ainda válida dos testes legados antes de remover `src/__tests__/app/landing-page.test.tsx`, incluindo as interações de Novidades e a confirmação de convite/spam.
- Recompor `next.config.ts` com os quatro redirects 301 existentes, o isolamento de build do laboratório (`VENDEO_LAB_ISOLATED_DIST`) e os headers de SEO, sem sobreposição destrutiva.
- Reconciliar `tsconfig`, `tsconfig.typecheck`, `eslint` e `.gitignore` mantendo as exclusões específicas do laboratório e sem ocultar código de produto.
- Auditar a comunicação pública da oferta contra a política F50.2 implementada; qualquer ajuste de texto será apresentado para aprovação antes de alterar a landing.
- Preservar F56, backend, migrations, modelos, providers, créditos, flags operacionais e o tracking atual. Incorporar o histórico F51.1/F51.2 ao tracking sem restaurar estados anteriores da `main`.
- Registrar como follow-up, sem corrigir, o caso de produção confirmada com origem inválida em que `canonical`/`og:url` recaem em `http://localhost:3000`.

**Não autorizado nesta rodada de elaboração da proposta:** executar merge, implementar, planejar/executar GSD, push, deploy, configuração externa, migrations, envio real de e-mail, geração paga, correção do follow-up de canonical/OG e qualquer alteração funcional em F56, créditos, providers ou flags. A integração futura ocorre na branch `integracao/landing-app-atual`; merge para a `main`, push e publicação permanecem etapas posteriores e dependem de aprovação.

## Capabilities

### New Capabilities

- `landing-app-integration`: regras de coexistência entre a landing/SEO aprovados e o aplicativo atual — preservação visual e de convite, migração de cobertura de testes, composição de headers/isolamento/redirects, higiene de ignores, fronteira de escopo, auditoria da oferta, validação integrada e tracking.

### Modified Capabilities

<!-- Nenhuma. As specs F51.1/F51.2 chegam pelo merge já aprovadas; esta mudança não redefine seus requisitos. -->

## Impact

- **Branch:** `integracao/landing-app-atual` criada a partir de `main` (`8c4413de`), sem terceira worktree e sem tocar `.dev.log`. A integração ocorre nessa branch; o merge para `main`, push e publicação são posteriores.
- **Conflitos previstos (10 entradas):** nove conflitos textuais em `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `eslint.config.mjs`, `next.config.ts`, `src/__tests__/next.config.test.ts`, `src/components/landing/access-request-section.tsx`, `tsconfig.json` e `tsconfig.typecheck.json`, além de um modify/delete.
- **Modify/delete:** `src/__tests__/app/landing-page.test.tsx` (removido na landing, alterado na `main`).
- **Código:** `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/landing/**`, `src/lib/seo/**`, `src/app/robots.ts`, `src/app/sitemap.ts`, `public/landing/**`, `public/seo/**`, testes correspondentes e configuração de build/lint/type.
- **Preservado sem alteração:** `supabase/migrations/**`, `src/app/api/**`, `src/lib/ai/**`, `src/lib/credit*`, `src/lib/trial-offer*`, `src/lib/product-1-1/**`, flags operacionais e tracking atual.
- **Validação:** testes relevantes, `typecheck`, lint, build, SEO compilado (metadata/robots/sitemap/headers) e UAT visual mobile/desktop nos modos flag off/on.
- **Entrega desta rodada:** somente os artefatos OpenSpec, para revisão antes de qualquer merge ou implementação.
