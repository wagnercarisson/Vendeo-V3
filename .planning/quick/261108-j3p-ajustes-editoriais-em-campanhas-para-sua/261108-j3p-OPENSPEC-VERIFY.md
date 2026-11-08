# OpenSpec Verify — `ajustes-editoriais-e-rodape-publico-compartilhado`

**Data:** 2026-11-08
**Change:** `openspec/changes/ajustes-editoriais-e-rodape-publico-compartilhado/`
**Schema:** `spec-driven`
**Quick:** `261108-j3p`

## Resumo

| Dimensão | Resultado |
|---|---|
| Completude | 27/27 tasks concluídas; proposal, specs e tasks presentes; `design.md` não produzido (decisões registradas no plano da quick) |
| Correção | 5/5 capabilities com implementação e testes correspondentes |
| Coerência | Implementação aderente ao proposal e às decisões aprovadas; sem divergência bloqueante |

## Verificação por capability

### `public-footer-navigation` (nova)

- Componente compartilhado: `src/components/landing/public-footer.tsx`.
- Lista central: `src/components/landing/public-footer-nav.ts`, com exatamente
  `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja`.
- Grupos: `footer-explore-heading` (“Explore o Vendeo”) e
  `footer-institutional-heading` (“Institucional”).
- `aria-current="page"` aplicado por comparação com `currentPath`; ausente na
  home.
- Server Component com links HTML e `href` real; único limite cliente é o
  `NovidadesLink` da home.
- Sem import em `sitemap.ts`, `robots`, política de indexação, metadata ou
  `middleware.ts`.
- Cobertura: `src/components/landing/__tests__/public-footer.test.tsx`.

### `campanhas-para-sua-loja-demonstration-page`

- Textos exatos no bloco de rotina, com a continuação preservada
  (`src/app/(marketing)/campanhas-para-sua-loja/page.tsx:202-207`).
- Ausência dos dois textos antigos coberta em
  `src/__tests__/app/campanhas-para-sua-loja-page.test.tsx:232-250`.
- Rodapé usa o componente compartilhado, com “Voltar ao Vendeo”, Termos,
  Privacidade, Uso Aceitável e Entrar.
- Requisito “Link único na home” reconciliado com o grupo “Explore o Vendeo”.

### `padarias-demonstration-page`

- Home preservada em H1, copy, blocos, imagens, CTAs, ordem e metadata; apenas o
  rodapé foi reorganizado.
- `/floriculturas` preservada fora do rodapé compartilhado.
- Contratos de indexação intactos.

### `seo-discovery-foundation`

- Nenhuma alteração em `src/app/sitemap.ts`, `src/lib/seo/**`, `robots` ou
  `layout.tsx`.
- Regressão: `sitemap.test.ts`, `robots.test.ts` e
  `route-indexation-policy.test.ts` — 52/52.
- A lista do rodapé não é fonte de indexação.

### `landing-conversion-experience`

- Home mantém Termos, Privacidade, Uso Aceitável, Contato, Novidades, Entrar e
  aviso legal.
- “Novidades” permanece no rodapé via `NovidadesLink`.
- Estrutura semântica e alvos de 44 px preservados.

## Issues

### CRITICAL

Nenhum.

### WARNING

Nenhum.

### SUGGESTION

- `aria-current="page"` é apenas semântico, sem diferenciação visual. Não foi
  solicitado estilo adicional; registrado como decisão, não como defeito.

## Pendência externa de typecheck

`npm run typecheck` apresenta erro em
`src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`
(mock de `Response` incompleto). O arquivo não foi tocado por esta change.

- **Origem não determinada** nesta verificação; não é atribuída à quick nem à
  fase como fato confirmado.
- Pendência externa a ser tratada no contexto da **F59**.

## Validação OpenSpec

```
openspec validate ajustes-editoriais-e-rodape-publico-compartilhado --strict
→ valid

openspec validate campanhas-para-sua-loja-demonstration-page --strict → valid
openspec validate padarias-demonstration-page --strict → valid
openspec validate seo-discovery-foundation --strict → valid
openspec validate landing-conversion-experience --strict → valid
```

## Veredito

**Sem issues críticas. Pronto para sync e archive.**

## Sync e archive executados

```
openspec archive ajustes-editoriais-e-rodape-publico-compartilhado --yes
→ campanhas-para-sua-loja-demonstration-page: 2 modificados
→ landing-conversion-experience: 1 modificado
→ padarias-demonstration-page: 1 modificado
→ public-footer-navigation: 5 adicionados (spec criada)
→ seo-discovery-foundation: 1 modificado
→ change arquivada em 2026-11-08-ajustes-editoriais-e-rodape-publico-compartilhado
```

Validação pós-sync (`--strict`): `public-footer-navigation`,
`campanhas-para-sua-loja-demonstration-page`, `padarias-demonstration-page`,
`seo-discovery-foundation` e `landing-conversion-experience` — **valid**.
