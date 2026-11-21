---
phase: quick/261121-iem
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/landing/__tests__/landing-page.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "O teste 'preserva os links legais e Contato no rodapé' volta a passar isoladamente e na suíte landing-page"
    - "A consulta da navegação do rodapé é unívoca pelo nome acessível 'Institucional' — não usa getByRole('navigation') nem first()/queryAllByRole[0]"
    - "As quatro asserções de destino (Termos de Uso, Política de Privacidade, Uso Aceitável, Contato/mailto) permanecem, verificadas com within(nav)"
    - "Nenhum link, navegação, aria-labelledby ou comportamento da landing é alterado"
  artifacts:
    - path: "src/components/landing/__tests__/landing-page.test.tsx"
      provides: "Consulta escopada à navegação 'Institucional' do rodapé, preservando as 4 asserções de href"
      contains: "name: \"Institucional\""
  key_links:
    - from: "src/components/landing/__tests__/landing-page.test.tsx"
      to: "src/components/landing/public-footer.tsx"
      via: "aria-labelledby=\"footer-institutional-heading\" no <nav> que contém os links legais e Contato"
      pattern: "footer-institutional-heading"
---

<objective>
Corrigir exclusivamente a falha de `src/components/landing/__tests__/landing-page.test.tsx`
no cenário "preserva os links legais e Contato no rodapé", que falha com
`TestingLibraryElementError: Found multiple elements with the role "navigation"`.

**Causa raiz confirmada:** o rodapé compartilhado (`PublicFooter`) renderiza **duas**
navegações legítimas, semanticamente identificadas por `aria-labelledby`:
`"Explore o Vendeo"` (`footer-explore-heading`) e `"Institucional"`
(`footer-institutional-heading`). Os links legais e o Contato estão na segunda. A
consulta `within(footer).getByRole("navigation")` não informa o nome acessível e por
isso é ambígua — é defeito de consulta do teste, não da landing.

**Baseline medido:** `Test Files 1 failed (1) | Tests 1 failed | 19 passed (20)`.

**Fora do escopo:** qualquer alteração em `public-footer.tsx`, copy, layout, acessibilidade,
guards, geração, créditos, backend, banco, Storage, provider ou migrations.

**Output:** menor alteração possível no teste (nome acessível explícito), com as quatro
asserções de destino preservadas e o rodapé intocado.
</objective>

<tasks>

<task type="auto">
  <name>Escopar a consulta da navegação do rodapé pelo nome acessível</name>
  <files>src/components/landing/__tests__/landing-page.test.tsx</files>
  <action>
    Na linha da consulta da navegação dentro de `within(footer as HTMLElement)`,
    trocar `getByRole("navigation")` por `getByRole("navigation", { name: "Institucional" })`.
    Manter exatamente as quatro asserções existentes de `href` (Termos de Uso,
    Política de Privacidade, Uso Aceitável, Contato com `mailto:`), todas via `within(nav)`.
    Não remover asserções, não usar `skip`, `queryAllByRole`, `first()` ou índice 0.
    Não tocar em `public-footer.tsx` nem em qualquer outro arquivo de produção.
  </action>
  <verify>
    `npx vitest run src/components/landing/__tests__/landing-page.test.tsx`
    → 20/20 passed, 0 failed. Inspecionar o diff: apenas 1 linha de consulta alterada
    (mais, no máximo, um comentário explicativo).
  </verify>
  <done>
    Cenário "preserva os links legais e Contato no rodapé" verde, com as quatro
    asserções de destino intactas e a landing inalterada.
  </done>
</task>

<task type="auto">
  <name>Validar regressões de rodapé, typecheck, diff e lint</name>
  <files>src/components/landing/__tests__/public-footer.test.tsx</files>
  <action>
    Executar a regressão diretamente relacionada ao rodapé
    (`public-footer.test.tsx`), `npm run typecheck`, `git diff --check` e `npm run lint`.
    Registrar no SUMMARY o alcance real do ESLint (config sem parser TS / sem cobertura
    de .tsx), sem apresentar lint verde como cobertura do arquivo de teste.
  </action>
  <verify>
    Rodapé focado verde; typecheck exit 0; `git diff --check` sem saída; lint exit 0 com
    limitação documentada.
  </verify>
  <done>
    Resultados reais e limitações registrados no SUMMARY; suíte global não declarada verde.
  </done>
</task>

</tasks>

<verification>
- Suíte landing-page completa: 20/20.
- `public-footer.test.tsx`: 6/6.
- Typecheck exit 0; `git diff --check` limpo; lint exit 0 (limitação TS documentada).
- `git status` confirma que os dois `__pycache__` preexistentes continuam fora dos commits.
- Sem merge, push ou deploy.
</verification>
