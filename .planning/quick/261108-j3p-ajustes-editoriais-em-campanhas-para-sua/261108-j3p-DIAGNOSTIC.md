# Quick 261108-j3p — Diagnóstico

**Data:** 2026-11-08
**Status:** diagnóstico e planejamento concluídos; implementação NÃO iniciada
**Branch:** `quick/ajuste-rodape-textos-paginas`
**Base:** `main` (`2bda3e51`), branch local sem commits próprios (`git log main..HEAD` vazio)
**Worktree:** `C:\Projetos\Vendeo V3`, limpa (`git status` sem alterações)
**Changes OpenSpec ativas:** nenhuma (somente `archive/`)

## 1. Escopo confirmado

### 1.1 Ajustes editoriais em `/campanhas-para-sua-loja`

Arquivo: `src/app/(marketing)/campanhas-para-sua-loja/page.tsx`, bloco “Rotina”
(linhas ~195–207).

| Estado | Texto |
|---|---|
| Atual (H2) | “Feita para a rotina de quem atende, repõe e ainda divulga.” |
| Proposto (H2) | “Feito para a rotina de quem atende, repõe e ainda divulga.” |
| Atual (parágrafo) | “Quem toca uma loja pequena acumula funções. O Vendeo encurta o caminho entre o produto que está na vitrine e a publicação que precisa sair.” |
| Proposto (parágrafo) | “Quem administra uma loja precisa conciliar atendimento, estoque, fornecedores e divulgação. O Vendeo encurta o caminho entre o produto que está na vitrine e a publicação que precisa sair.” |

Regras:

- Alterar somente essas duas ocorrências.
- Preservar integralmente a continuação “O Vendeo encurta o caminho entre o
  produto que está na vitrine e a publicação que precisa sair.”
- Nenhum outro texto da página pode mudar, incluindo títulos dos itens de
  `ROUTINE_ITEMS`, kit, aviso, oferta e rodapé.

### 1.2 Rodapé público compartilhado

Páginas no escopo:

- `src/app/page.tsx` (`/`)
- `src/app/(marketing)/floriculturas/page.tsx` (`/floriculturas`)
- `src/app/(marketing)/padarias/page.tsx` (`/padarias`)
- `src/app/(marketing)/campanhas-para-sua-loja/page.tsx` (`/campanhas-para-sua-loja`)

Todos os quatro rodapés são blocos inline duplicados, com a mesma estrutura
visual (logo, `nav` com links, `border-t`), mas conteúdo ligeiramente diferente.

## 2. Inventário dos rodapés atuais

| Página | Logo | Voltar ao Vendeo | Termos | Privacidade | Uso Aceitável | Novidades (modal) | Contato | Entrar | Aviso legal demonstrativo |
|---|---|---|---|---|---|---|---|---|---|
| `/` | sim | não | sim | sim | sim | sim | sim | sim | sim |
| `/floriculturas` | sim | sim | sim | sim | sim | não | não | sim | não |
| `/padarias` | sim | sim | sim | sim | sim | não | não | sim | não |
| `/campanhas-para-sua-loja` | sim | sim | sim | sim | sim | não | não | sim | não |

Observações:

- `NovidadesLink` é Client Component (`src/components/landing/novidades-link.tsx`)
  e depende de `recentEntries` resolvido no Server Component da home.
- O aviso legal sobre lojas demonstrativas existe somente no rodapé da home.
- “Contato” existe somente na home e usa
  `mailto:${process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech"}`.
- As três páginas internas usam “Voltar ao Vendeo” → `/`.
- Nenhum link possui `aria-current`.
- O rodapé da home não tem comentário `eslint-disable` para `<img>`; as páginas
  internas têm (preservar o padrão atual ou centralizar a exceção no componente).

## 3. Diagnóstico técnico

- Duplicação: quatro cópias do mesmo esqueleto e das mesmas classes de link.
- Lista de destinos de conteúdo já existe na home, mas não nas páginas internas.
  `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja` não se linkam entre
  si pelo rodapé.
- A lista não é centralizada: adicionar uma página futura exige editar quatro
  arquivos.
- Não há diferença de metadata, canonical, robots ou sitemap causada pelo rodapé;
  a navegação é puramente HTML.
- O contrato de indexação vive em `src/lib/seo/indexation-policy.ts`,
  `src/lib/seo/environment.ts`, `src/lib/seo/origin.ts` e `src/app/sitemap.ts`.
  O rodapé não deve importar nem alterar essas fontes.
- O `footer` é renderizado como Server Component em todas as páginas. A única
  parte cliente é o `NovidadesLink` da home, que pode continuar sendo filho do
  componente servidor.

## 4. Proposta de composição

### 4.1 Fonte central de navegação

Criar `src/components/landing/public-footer-nav.ts` (módulo puro, sem React,
sem `next/link`, sem leitura de ambiente):

```ts
export const PUBLIC_FOOTER_EXPLORE_LINKS = [
  { href: "/floriculturas", label: "Floriculturas" },
  { href: "/padarias", label: "Padarias" },
  { href: "/campanhas-para-sua-loja", label: "Campanhas sem complicação" },
] as const;
```

Decisões:

- A lista contém exatamente os três destinos aprovados.
- Ela NÃO alimenta sitemap, robots, canonical, `INDEXABLE_CANONICAL_PATHS`,
  metadata nem qualquer política de indexação.
- Adicionar uma página futura = adicionar um item nessa lista.

### 4.2 Componente compartilhado

Criar `src/components/landing/public-footer.tsx` como Server Component.

Contrato proposto:

```ts
type PublicFooterPath =
  | "/"
  | "/floriculturas"
  | "/padarias"
  | "/campanhas-para-sua-loja";

interface PublicFooterProps {
  currentPath: PublicFooterPath;
  context: "home" | "marketing";
  novidadesEntries?: ChangelogEntry[]; // usado somente na home
}
```

Diferenças explícitas, sem condicionais espalhadas:

- `context="home"`:
  - renderiza “Contato” (`mailto:` com o mesmo fallback atual);
  - renderiza `NovidadesLink` com `variant="footer"` e as entries recebidas;
  - renderiza o aviso legal demonstrativo;
  - NÃO renderiza “Voltar ao Vendeo”.
- `context="marketing"`:
  - renderiza “Voltar ao Vendeo” → `/`;
  - NÃO renderiza “Contato”, “Novidades” nem o aviso legal.

O componente mantém logo, tipografia, cores, bordas, alturas de toque (44 px) e
classes de foco atuais.

### 4.3 Estrutura semântica proposta

```tsx
<footer className="border-t border-border">
  <div className="mx-auto w-full max-w-5xl px-6 py-10 text-sm text-text-secondary">
    <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
      <img ... /> {/* logo atual */}

      <div className="flex flex-col gap-8 sm:flex-row sm:gap-12">
        <nav aria-labelledby="footer-explore-heading">
          <h2 id="footer-explore-heading" className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Explore o Vendeo
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {PUBLIC_FOOTER_EXPLORE_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={item.href === currentPath ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-institutional-heading">
          <h2 id="footer-institutional-heading" className="...">
            Institucional
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {/* Voltar (marketing), Termos, Privacidade, Uso Aceitável,
                Contato (home), Novidades (home), Entrar */}
          </ul>
        </nav>
      </div>
    </div>

    {/* aviso legal somente home */}
  </div>
</footer>
```

Notas de composição:

- Desktop: logo à esquerda; dois grupos de navegação à direita, lado a lado.
- Mobile: coluna única; grupos empilhados; links com `flex-wrap` e espaçamento
  confortável; sem largura fixa e sem overflow.
- `aria-current="page"` é aplicado por comparação com `currentPath`. Na home,
  nenhum item de “Explore o Vendeo” aponta para `/`; o destino atual da home é
  representado pelo logo e pelo contexto da página, não por um item artificial.
- Os itens institucionais não recebem `aria-current` (não são destinos de
  conteúdo e incluem `mailto:`); isso evita marcar “Entrar” como página atual.
- Manter `min-h-[44px]` e `focus-visible:ring-2` em todos os links.
- O aviso legal da home conserva o texto e a largura atuais.

### 4.4 Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| `usePathname()` no cliente | exigiria Client Component desnecessário e perderia renderização 100% server-side. |
| Quatro variantes por página | repetiria condicionais e não resolveria a centralização. |
| Incluir “Início” na lista “Explore” | adicionaria destino não solicitado; `/` já é alcançável por “Voltar ao Vendeo” nas páginas internas e pelo logo na home. |
| Alimentar sitemap pela lista | violaria o limite explícito de não acoplar navegação e indexação. |

## 5. Specs afetadas

| Spec | Efeito |
|---|---|
| `campanhas-para-sua-loja-demonstration-page` | copy do bloco de rotina; composição do rodapé; requisito “Link único na home”. |
| `padarias-demonstration-page` | requisito “home inalterada exceto link Padarias” precisa admitir o rodapé compartilhado. |
| `seo-discovery-foundation` | requisito de conteúdo visível da home precisa admitir o reposicionamento dos links no rodapé, sem tocar em SEO. |
| `landing-conversion-experience` | rodapé legal da home passa a ser o componente compartilhado; links legais e “Novidades” preservados. |
| `public-footer-navigation` (nova) | contrato do rodapé compartilhado, lista central, `aria-current`, grupos e responsividade. |
| `floriculturas-demonstration-page` | sem conflito textual: “rodapé com links legais” continua verdadeiro. Nenhum delta necessário. |

## 6. Riscos e pontos de revisão

1. **Rótulo do segundo grupo.** Aprovado em 2026-11-08: “Institucional”.
   “Entrar” permanece nesse grupo.
2. **Ordem interna dos links institucionais.** Proposta: “Voltar ao Vendeo”
   (somente marketing), Termos, Privacidade, Uso Aceitável, Contato (somente
   home), Novidades (somente home), Entrar. A ordem pode ser revista.
3. **Home sem `aria-current` em “Explore o Vendeo”.** É consequência de não
   incluir `/` na lista. Se o responsável quiser marcar a home, será necessário
   adicionar “Início” — o que amplia o escopo aprovado.
4. **Aviso legal da home.** Permanece no rodapé somente na home. Se a intenção
   for exibi-lo nas quatro páginas, isso é mudança de conteúdo não solicitada.
5. **Capturas.** O projeto não tem Playwright nem script de screenshot. A
   validação visual prevista usará `next dev` + CDP (como em quicks anteriores);
   se o navegador/CDP não estiver disponível, a limitação será registrada.
6. **Lint sem cobertura TypeScript.** Limitação preexistente do projeto; será
   registrada, não corrigida nesta quick.

## 7. Limites respeitados no diagnóstico

- Nenhuma alteração de código, teste, spec principal, metadata, canonical,
  robots, sitemap, header, oferta, CTA, autenticação, flags, campanhas, créditos,
  onboarding, APIs, banco ou migrations.
- Nenhum commit, merge, push, deploy, tag, sync/archive ou acesso à produção.
- Alterações preexistentes preservadas (worktree estava limpa).

## 8. Classificação local × produção

Esta rodada é **planejamento local**. Ela não valida produção e não autoriza
publicação. A implementação futura produzirá evidência local (testes, typecheck,
lint, build, diff check, capturas). Indexação real, canonical absoluto e sitemap
em produção dependem do gate de produção já existente e não serão alterados por
esta quick.
