## 0. Revisão e aprovação

- [x] 0.1 Confirmar D7 (opção para o `h2` da home) e D6 (alcance da troca do rótulo). — Aprovado em 2026-11-04: opção 1 em ambas (h2 “Teste gratuitamente.”; rótulo restrito a home/`/floriculturas`).
- [x] 0.2 Aprovar as composições desktop/mobile do plano `261104-oac-PLAN.md`. — Aceite visual aprovado em 2026-11-04.
- [x] 0.3 Confirmar que a implementação permanece na quick, sem nova fase.

## 1. Fonte única de textos

- [x] 1.1 Criar `src/components/landing/public-offer-copy.ts` com `PUBLIC_OFFER_COPY` e `PUBLIC_ACCESS_COPY` exatamente como aprovados.
- [x] 1.2 Criar teste de valores exatos das constantes, incluindo ausência de regra de negócio e de leitura de env/rede.
- [x] 1.3 Remover dos componentes consumidores os literais antigos, importando apenas a fonte.

## 2. Acesso compartilhado

- [x] 2.1 Adicionar `label?: string` ao `GoogleButton`, com default `"Continuar com Google"`; preservar OAuth, escopos, redirect, captcha, loading e erro.
- [x] 2.2 Fazer `AcquisitionCta` consumir `PUBLIC_ACCESS_COPY.closedCta`, `.email` e `.google`, preservando destinos e as composições `stacked`/`inline`.
- [x] 2.3 Fazer `AccessCtaGroup` consumir `PUBLIC_ACCESS_COPY.institutional` e preservar a composição por estado da flag.
- [x] 2.4 Confirmar que login, cadastro, formulário e título de solicitação permanecem inalterados, salvo decisão contrária em D6. — Mantidos; troca restrita a home/`/floriculturas`.

## 3. Card compartilhado

- [x] 3.1 Criar `src/components/landing/offer-card.tsx` com `variant`, `publicSignupEnabled`, `headingId?` e slot `children`.
- [x] 3.2 Renderizar resumo, complemento, slot de acesso, apoio fechado condicional e `<details>` com as condições aprovadas.
- [x] 3.3 Exibir a nota “Solicitar acesso não inicia o período do teste.” somente com a flag desligada.
- [x] 3.4 Não criar IDs no card compacto; usar `headingId` apenas no card completo.
- [x] 3.5 Refatorar `offer-section.tsx` para a variante `full`, preservando `section`, `h2` e `id="oferta-heading"`.

## 4. `/floriculturas`

- [x] 4.1 Manter a abertura apenas com o `AccessCtaGroup` em modo âncora, sem card, resumo, complemento ou expansível.
- [x] 4.2 Adicionar `localHref` ao `AcquisitionCta`: na abertura, Google/e-mail/solicitação viram links locais; nenhum inicia OAuth ou `/signup`.
- [x] 4.3 Preservar “Conheça o Vendeo” → `/` e a composição por estado da flag na abertura.
- [x] 4.4 Envolver somente o conjunto do encerramento no card compacto único, com `id="floriculturas-oferta"`, `tabindex="-1"` e `scroll-mt-24`.
- [x] 4.5 Manter as ações reais somente no card final: Google/OAuth e e-mail (`/signup`) com a flag ligada; solicitação (`/#acesso`) com a flag desligada.
- [x] 4.6 Garantir quebra segura do rótulo “Solicitar acesso gratuito” e ausência de overflow no mobile. — Medido: 0 px de overflow em 390 e 1440.

## 5. Testes

- [x] 5.1 Atualizar `offer-section.test.tsx` para os novos textos, o apoio fechado e a nota condicional.
- [x] 5.2 Atualizar `access-cta-group.test.tsx` para o novo rótulo e a fonte única.
- [x] 5.3 Atualizar `acquisition-cta.test.tsx` e `landing-page.test.tsx` para “Solicitar acesso gratuito”.
- [x] 5.4 Atualizar `floriculturas-page.test.ts` para um único card, abertura local e ações reais somente no encerramento.
- [x] 5.5 Adicionar teste do card único com ID de âncora focável e expansível acionável.
- [x] 5.6 Adicionar guarda estática contra os literais antigos nos arquivos públicos alterados.
- [x] 5.7 Cobrir flags ligada/desligada em home e `/floriculturas`, incluindo ausência da nota fechada no estado aberto.
- [x] 5.8 Confirmar preservação de `#acesso`, `/#acesso`, `/signup`, `/` e `/login`, e do contrato de `POST /api/access-requests`. — Testes e diff confirmam; nenhuma rota/handler alterado.
- [x] 5.9 Comprovar que a abertura não renderiza `GoogleButton` funcional no estado aberto e que nenhum link da abertura sai da página.

## 6. Gates e aceite

- [x] 6.1 Executar a suíte focada, `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check`.
- [x] 6.2 Registrar as limitações de lint e de layout em jsdom.
- [x] 6.3 Capturar home e `/floriculturas` em 1440×900 e 390×844, flags off/on, e medir overflow; rolar a página antes da captura para carregar imagens lazy sem alterar o código.
- [x] 6.4 Registrar evidências e medições em `.planning/quick/261104-oac-.../evidence/`.
- [x] 6.5 Obter aceite visual explícito antes de qualquer fechamento; sem commit, merge, push ou deploy automáticos. — Aprovado em 2026-11-04.
