## 1. Merge controlado e resolução dos conflitos

- [ ] 1.1 Confirmar `integracao/landing-app-atual` criada a partir da `main` (`8c4413de`), registrar os SHAs completos de `main`, `escopo/landing` (`7d0d6d96`) e merge-base (`e018c766`), e verificar que os artefatos OpenSpec e o planejamento estão commitados, a árvore está limpa e `.dev.log`/alterações preexistentes permanecem intocados.
- [ ] 1.2 Executar `git merge --no-commit --no-ff escopo/landing` na branch de integração e registrar a lista real de conflitos, sem commit automático, sem terceira worktree e sem copiar `node_modules`, `.next` ou credenciais.
- [ ] 1.3 Resolver `.planning/STATE.md`, `.planning/ROADMAP.md` e `.planning/REQUIREMENTS.md` a partir da base da `main`, acrescentando somente o registro histórico de F51.1/F51.2 e sem restaurar posições ou fases antigas.
- [ ] 1.4 Recompor `next.config.ts` com o bloco condicional do laboratório, `headers()` de SEO e os quatro redirects 301, sem redirect de `/` e sem `Disallow`.
- [ ] 1.5 Recompor `src/__tests__/next.config.test.ts` cobrindo isolamento do laboratório com/sem sentinel, headers por ambiente/rota e os quatro redirects no modo isolado.
- [ ] 1.6 Resolver `tsconfig.json`, `tsconfig.typecheck.json`, `eslint.config.mjs` e `.gitignore` preservando `.next/types/**/*.ts` no tsconfig principal, a exclusão de `.next` no tsconfig de typecheck e as exclusões específicas do laboratório; não adotar `supabase/.temp/` ou `node_modules.*` genéricos e não ocultar `src/**`.
- [ ] 1.7 Resolver `src/components/landing/access-request-section.tsx` adotando a estrutura da landing e preservando integralmente o texto atual de convite por e-mail e caixa de spam.
- [ ] 1.8 Manter `.opencode/**` na versão atual da `main`, salvo complemento aditivo indispensável, e revisar o diff contra o SHA completo da `main` registrado como base para garantir que backend, migrations, modelos, providers, créditos, trial-offer, product-1-1 e flags estão intocados.
- [ ] 1.9 Registrar o resultado da resolução e parar para revisão antes de tratar testes e validação, caso apareça conflito sem fonte de verdade definida.

## 2. Reconciliação funcional e dos testes

- [ ] 2.1 Confirmar a landing integrada com os sete blocos na ordem aprovada, imagens, CTAs por flag, Novidades no rodapé e rodapé legal, sem os blocos antigos “O Vendeo pode criar”/“Como funciona”.
- [ ] 2.2 Confirmar o formulário `#acesso`, o `POST /api/access-requests` e o cartão de sucesso com convite por e-mail e caixa de spam nos dois modos da flag.
- [ ] 2.3 Verificar que as quatro interações de Novidades (abrir, fechar com retorno de foco, `Escape`, estado vazio) já estão cobertas pelo teste vigente via gatilho do rodapé.
- [ ] 2.4 Migrar para a suíte vigente a asserção da `main` sobre “receberá um convite por e-mail” e “caixa de spam”.
- [ ] 2.5 Substituir a asserção obsoleta de que o CTA do hero desaparece após o envio pela cobertura do cartão de sucesso que substitui o formulário em `#acesso`, mantendo os CTAs dos blocos conforme a F51.1.
- [ ] 2.6 Remover `src/__tests__/app/landing-page.test.tsx` somente depois que a cobertura migrada de Novidades e convite/spam estiver verde, registrando a comparação de cobertura.
- [ ] 2.7 Auditar a comunicação da oferta contra a política `trial-offer` (28 dias, 4×5, máximo 20, acúmulo, vencimento, início no onboarding) e aplicar o texto aprovado em 2026-10-21: “Você recebe 5 créditos iniciais. Mais 5 são liberados a partir dos dias 7, 14 e 21, no processamento diário, até o máximo de 20 créditos no período.” e “Oferta para novas contas elegíveis.” A landing não deve exibir participação por raiz de CNPJ. Registrar como escopo futuro não aprovado avaliar elegibilidade por CNPJ completo.
- [ ] 2.8 Confirmar que os helpers de SEO, `robots.ts`, `sitemap.ts`, metadata da home e headers compilam com a política fail-closed e sem alterar `origin.ts`/`environment.ts`.
- [ ] 2.9 Rodar a suíte focada de landing, acesso/convite, SEO e `next.config` e corrigir apenas regressões da integração, sem alterar contratos de produto.

## 3. Validação integrada e tracking

- [ ] 3.1 Executar os testes relevantes — landing, acesso/convite, SEO, `next.config`, oferta F50.2 (`src/lib/credit/__tests__/trial-offer-*`, rotas admin/retry, painel e retry) e contratos F56 (`src/lib/product-1-1/__tests__/*.contract.test.ts`, `src/lib/ai/__tests__/image-generation-config-snapshot*.test.ts`, `image-generation-failure-policy.test.ts` e `new-flow-isolation.contract.test.ts`) — sem provider pago, e registrar arquivos/testes verdes.
- [ ] 3.2 Executar `npm run typecheck` e confirmar zero erros, sem reintroduzir a exceção `ssl`/`pg` e mantendo `.next/types/**/*.ts` no tsconfig principal.
- [ ] 3.3 Executar `npm run lint` e confirmar exit 0 sem ignores que ocultem produto.
- [ ] 3.4 Executar `npm run build` de forma sequencial, sem servidor de desenvolvimento ou laboratório disputando `.next`.
- [ ] 3.5 Iniciar a aplicação compilada em porta loopback e executar smoke HTTP de home, `robots.txt`, `sitemap.xml`, `X-Robots-Tag` e dos quatro redirects.
- [ ] 3.6 Validar o SEO compilado nos três cenários — produção válida, produção com origem inválida e preview/local — com fail-closed/noindex onde aplicável.
- [ ] 3.7 Validar mobile e desktop nos modos flag off/on, confirmando CTAs, formulário, convite/spam e ausência de ativação do signup público em produção, com alterações temporárias de ambiente restritas ao processo local e restauradas ao final.
- [ ] 3.8 Reconciliar `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` com F51.1/F51.2 integradas, preservando F50.2, F56 e o tracking de produto atuais.
- [ ] 3.9 Registrar o follow-up de canonical/OG em produção com origem inválida (`http://localhost:3000`) e a recomendação de omitir as URLs, sem corrigi-lo.
- [ ] 3.10 Executar `openspec validate --strict` da mudança e `git diff --check`, registrando o resultado.
- [ ] 3.11 Apresentar o diff final (contra o SHA registrado da `main`) e a evidência de validação para revisão humana, sem commit de merge antes da revisão, push, deploy, configuração externa, migration, e-mail real ou geração paga.
