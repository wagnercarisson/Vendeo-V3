## 0. Revisão e aprovação

- [x] 0.1 Aprovar a proposta de composição do rodapé em `261108-j3p-DIAGNOSTIC.md` §4 (grupos “Explore o Vendeo” e “Institucional”, ordem dos links, ausência de “Início”, aviso legal somente na home). — Aprovado em 2026-11-08.
- [x] 0.2 Aprovar os dois ajustes editoriais e confirmar que nenhum outro texto de `/campanhas-para-sua-loja` muda. — Aprovado em 2026-11-08.
- [x] 0.3 Confirmar que a implementação permanece em quick, sem nova fase, commit, merge, push, deploy, sync/archive ou acesso à produção nesta rodada. — Confirmado em 2026-11-08.

## 1. Ajustes editoriais em `/campanhas-para-sua-loja`

- [x] 1.1 Trocar o H2 do bloco de rotina para `Feito para a rotina de quem atende, repõe e ainda divulga.`
- [x] 1.2 Trocar o início do parágrafo para `Quem administra uma loja precisa conciliar atendimento, estoque, fornecedores e divulgação.` preservando a continuação `O Vendeo encurta o caminho entre o produto que está na vitrine e a publicação que precisa sair.`
- [x] 1.3 Adicionar/atualizar testes que exijam os dois textos novos, a continuação preservada e a ausência dos dois textos antigos.
- [x] 1.4 Confirmar por diff que nenhum outro texto da página foi alterado.

## 2. Rodapé público compartilhado

- [x] 2.1 Criar `src/components/landing/public-footer-nav.ts` com a lista tipada dos três destinos aprovados, sem imports de React, `next/link` ou ambiente.
- [x] 2.2 Criar `src/components/landing/public-footer.tsx` como Server Component, com `currentPath`, contexto `home`/`marketing` e entries opcionais de Novidades.
- [x] 2.3 Renderizar “Explore o Vendeo” com os três links, `href` real e `aria-current="page"` somente no destino atual.
- [x] 2.4 Renderizar o grupo “Institucional” com as diferenças explícitas: Contato, Novidades e aviso legal na home; “Voltar ao Vendeo” nas páginas internas.
- [x] 2.5 Preservar logo, cores, fontes, bordas, `min-h-[44px]`, foco visível e o `mailto:` de contato com o fallback atual.
- [x] 2.6 Substituir os quatro rodapés inline pelos usos do componente, sem alterar header, main, oferta ou CTAs.
- [x] 2.7 Garantir layout desktop em grupos e mobile empilhado com quebra natural, sem overflow.

## 3. Testes

- [x] 3.1 Criar `src/components/landing/__tests__/public-footer.test.tsx` cobrindo: três links, destinos, `aria-current` por página, ausência de `aria-current` na home, grupos e diferenças home/marketing.
- [x] 3.2 Atualizar `src/__tests__/app/home-footer-links.test.tsx` para o rodapé compartilhado, preservando Contato, Novidades, aviso legal e “Entrar”.
- [x] 3.3 Atualizar `src/__tests__/app/floriculturas-page.test.ts` e `src/__tests__/app/padarias-page.test.ts` para “Explore o Vendeo”, `aria-current` e links existentes.
- [x] 3.4 Atualizar `src/__tests__/app/campanhas-para-sua-loja-page.test.tsx` para o rodapé e os dois ajustes editoriais.
- [x] 3.5 Confirmar que `sitemap.test.ts`, `robots.test.ts` e `route-indexation-policy.test.ts` seguem verdes sem alteração de contrato.

## 4. Validação e evidência local

- [x] 4.1 Rodar os testes focados dos arquivos alterados. — 96/96.
- [x] 4.2 Rodar `npm run typecheck`. — Bloqueado por erro preexistente em `bench-ui.contract.test.tsx`; nenhum erro nos arquivos desta quick.
- [x] 4.3 Rodar `npm run lint`. — exit 0 (limitação preexistente de cobertura TypeScript).
- [x] 4.4 Rodar `npm run build`. — exit 0.
- [x] 4.5 Rodar `git diff --check`. — limpo.
- [x] 4.6 Capturar desktop (1440×900) e mobile (390×844) dos quatro rodapés. — 8 capturas em `evidence/`.
- [x] 4.7 Conferir legibilidade, foco de teclado, ausência de overflow e preservação de oferta/acesso. — 0 px de overflow nos 8 cenários.
- [x] 4.8 Registrar resultados, limitações e a distinção local × produção no SUMMARY da quick.
