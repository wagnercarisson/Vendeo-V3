## ADDED Requirements

### Requirement: Integração controlada a partir da main atual

A integração SHALL ocorrer na branch `integracao/landing-app-atual`, criada a partir da `main` atual, por `git merge --no-commit --no-ff escopo/landing`. Os artefatos OpenSpec aprovados e o planejamento SHALL estar commitados antes do merge, deixando a árvore limpa. O processo SHALL registrar os SHAs completos de `main`, `escopo/landing` e merge-base antes do merge, SHALL usar o SHA registrado da `main` como base das comparações de não-regressão, SHALL preservar `.dev.log` e alterações preexistentes e SHALL NOT criar terceira worktree nem copiar `node_modules`, `.next`, credenciais ou ambientes entre pastas.

#### Scenario: Pré-condições registradas

- **WHEN** a integração for iniciada
- **THEN** a branch de integração parte da `main` atual
- **AND** os artefatos OpenSpec e o planejamento estão commitados
- **AND** os SHAs completos das três referências estão registrados
- **AND** `.dev.log` e alterações preexistentes permanecem intocados

#### Scenario: Merge sem commit automático

- **WHEN** o merge de `escopo/landing` é executado
- **THEN** usa `--no-commit --no-ff`
- **AND** nenhum commit de merge é criado antes da revisão

#### Scenario: Merge interrompido com segurança

- **WHEN** um conflito não puder ser resolvido com segurança
- **THEN** `git merge --abort` restaura o estado anterior sem commit de merge
- **AND** nenhum push ou deploy é executado

### Requirement: Preservação do visual aprovado da landing

A landing integrada SHALL manter o visual e a composição aprovados na F51.1: os sete blocos na ordem fixa, hero com campanha protagonista, imagens e rodapé legal, CTAs de aquisição por flag e “Entrar” como ação secundária. A integração SHALL NOT substituir a landing aprovada pela versão antiga da `main` nem reintroduzir os blocos “O Vendeo pode criar” ou “Como funciona”.

#### Scenario: Landing aprovada permanece

- **WHEN** a página inicial é renderizada com a flag desligada
- **THEN** os sete blocos aprovados aparecem na ordem fixa
- **AND** o formulário de solicitação permanece em `#acesso`
- **AND** os blocos antigos não são renderizados

#### Scenario: Modo flag ligada preservado

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED=true`
- **THEN** os CTAs de aquisição apontam para Google e `/signup`
- **AND** o formulário de solicitação não é renderizado

### Requirement: Preservação da confirmação de convite por e-mail

A landing integrada SHALL preservar o estado de sucesso atual da solicitação de acesso, informando que a liberação é por convite, que o convite chega por e-mail ao endereço informado e que o usuário deve verificar a caixa de spam. O formulário, o contrato `POST /api/access-requests` e a resposta anti-enumeração SHALL permanecer inalterados.

#### Scenario: Sucesso informa convite e spam

- **WHEN** uma solicitação de acesso é enviada com sucesso
- **THEN** o cartão “Solicitação enviada” exibe a confirmação de convite por e-mail
- **AND** orienta a verificar a caixa de spam
- **AND** o formulário deixa de ser exibido dentro de `#acesso`

#### Scenario: Contrato de solicitação intacto

- **WHEN** o formulário é enviado
- **THEN** a requisição continua sendo `POST /api/access-requests`
- **AND** a resposta de sucesso continua idêntica para solicitação nova ou duplicada

### Requirement: Migração de cobertura válida antes da remoção do teste legado

A integração SHALL migrar para a suíte vigente toda cobertura ainda válida de `src/__tests__/app/landing-page.test.tsx` antes de removê-lo, incluindo as quatro interações de Novidades (abrir, fechar com retorno de foco, `Escape` e estado vazio) e a confirmação de convite por e-mail/caixa de spam. A asserção de que o CTA do hero desaparece após o envio SHALL ser substituída pela cobertura do comportamento aprovado da landing (cartão de sucesso substitui o formulário em `#acesso`), sem remover o arquivo legado antes de a cobertura migrada estar verde.

#### Scenario: Cobertura de Novidades preservada

- **WHEN** a suíte integrada é executada
- **THEN** abrir, fechar com foco, `Escape` e estado vazio de Novidades estão cobertos pelo gatilho do rodapé

#### Scenario: Remoção somente após verde

- **WHEN** o teste legado for removido
- **THEN** a cobertura migrada de convite/spam e Novidades já passou na suíte vigente
- **AND** nenhuma cobertura válida foi perdida silenciosamente

### Requirement: Composição de headers de SEO, isolamento do laboratório e redirects

`next.config.ts` SHALL manter, simultaneamente: o isolamento de build do laboratório sob o sentinel `VENDEO_LAB_ISOLATED_DIST=true`, a função `headers()` com a política de `X-Robots-Tag` e os quatro redirects 301 existentes. A integração SHALL NOT adicionar redirect para `/` nem regra `Disallow`, e o modo isolado do laboratório SHALL continuar servindo os mesmos quatro redirects e a mesma política de headers.

#### Scenario: Headers e redirects coexistem

- **WHEN** a configuração é carregada fora de produção confirmada
- **THEN** a regra global de `noindex, nofollow` e as três regras por rota são emitidas
- **AND** os quatro redirects 301 permanecem presentes
- **AND** `/` não é redirecionado

#### Scenario: Laboratório isolado preservado

- **WHEN** `VENDEO_LAB_ISOLATED_DIST=true`
- **THEN** `distDir` e `tsconfigPath` dedicados são ativados
- **AND** headers e os quatro redirects continuam disponíveis

### Requirement: Higiene de TypeScript, lint e ignores

A integração SHALL manter a configuração atual da `main` para typecheck e lint, acrescentando apenas exclusões específicas de artefatos gerados. O `tsconfig.json` principal SHALL preservar a inclusão de `.next/types/**/*.ts`; a exclusão de `.next` SHALL permanecer no `tsconfig.typecheck.json` dedicado ao typecheck. A integração SHALL NOT adotar, no ESLint, o ignore amplo `supabase/.temp/`, SHALL NOT excluir `node_modules.*` de forma genérica e SHALL NOT ocultar `src/**` ou testes. `npm run typecheck` e `npm run lint` SHALL passar sem a exceção externa `ssl`/`pg`.

#### Scenario: Nenhum código de produto oculto

- **WHEN** os arquivos de configuração são revisados
- **THEN** as exclusões apontam apenas para `node_modules`, o cache de typecheck e o diretório de build do laboratório
- **AND** o `tsconfig.json` principal mantém `.next/types/**/*.ts`
- **AND** nenhum caminho de `src/**` está excluído

#### Scenario: Gates de tipos e lint verdes

- **WHEN** `npm run typecheck` e `npm run lint` são executados
- **THEN** ambos terminam sem erro

### Requirement: Fronteira de escopo preservada

A integração SHALL NOT alterar backend, migrations, modelos, providers, créditos, trial-offer, product-1-1, flags operacionais, `middleware.ts` ou telas autenticadas. A landing e o SEO SHALL consumir apenas contratos existentes (`getLaunchConfig()` e `POST /api/access-requests`).

#### Scenario: Caminhos protegidos sem diff

- **WHEN** o diff da integração é comparado ao SHA completo da `main` registrado como base
- **THEN** não há alteração em `supabase/migrations/**`, `src/app/api/**`, `src/lib/ai/**`, créditos, trial-offer, product-1-1 ou flags operacionais

#### Scenario: Contratos existentes reutilizados

- **WHEN** a landing lê a flag ou envia solicitação
- **THEN** usa `getLaunchConfig()` e `POST /api/access-requests` sem novo contrato

### Requirement: Comunicação da oferta consistente e sujeita a aprovação

A landing integrada SHALL comunicar a oferta conforme a política `trial-offer` implementada: 28 dias, até 20 créditos, quatro parcelas de 5 nos dias 0/7/14/21, acúmulo, vencimento do gratuito restante ao final e início somente na conclusão do onboarding elegível. A comunicação secundária SHALL explicar que a oferta é para novas contas elegíveis e limitada a uma participação por raiz de CNPJ. O texto final, incluindo a frase de elegibilidade, depende de aprovação humana antes de ser aplicado.

#### Scenario: Mecânica consistente

- **WHEN** a comunicação da oferta é comparada à política implementada
- **THEN** total, parcelas, acúmulo, vencimento e início do período estão coerentes
- **AND** a liberação das parcelas considera o processamento diário, sem prometer o segundo exato
- **AND** a oferta não promete uso ilimitado nem 20 campanhas

#### Scenario: Elegibilidade comunicada

- **WHEN** o conteúdo secundário da oferta é revisado
- **THEN** informa que a oferta vale para novas contas elegíveis
- **AND** informa o limite de uma participação por raiz de CNPJ

#### Scenario: Ajuste não aplicado sem aprovação

- **WHEN** a auditoria identificar necessidade de ajuste de texto
- **THEN** o ajuste é registrado e apresentado para aprovação
- **AND** o texto público permanece inalterado até a decisão

### Requirement: Preservação do tracking e incorporação de F51.1/F51.2

A integração SHALL partir do tracking atual da `main` e acrescentar F51.1/F51.2 como frentes concluídas e integradas, com SHAs e resultado de validação. A integração SHALL NOT restaurar posições, status ou fases antigas, SHALL NOT sobrescrever F50.2 e a trilha F56 e SHALL NOT reintroduzir instrumentação de funil removida da F51.1. Os eventos de produto existentes SHALL permanecer inalterados.

#### Scenario: Tracking atual preservado

- **WHEN** `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` são reconciliados
- **THEN** F50.2 permanece concluída/ativa e a trilha F56 permanece no estado atual
- **AND** nenhuma posição antiga é restaurada

#### Scenario: F51 registrada como integrada

- **WHEN** a integração é concluída
- **THEN** F51.1 e F51.2 constam como concluídas/integradas com evidência
- **AND** nenhum evento de produto é criado ou alterado

### Requirement: Validação integrada e UAT nos dois modos

A integração SHALL validar testes relevantes, `typecheck`, lint, build, smoke HTTP da aplicação compilada, SEO compilado e UAT visual mobile/desktop nos modos flag off/on. Os testes relevantes SHALL incluir expressamente a oferta F50.2 e os contratos do fluxo F56, sem provider pago. A validação de SEO compilado SHALL conferir metadata/canonical/OG da home, `robots.txt`, `sitemap.xml` e `X-Robots-Tag` em três cenários: produção válida, produção com origem inválida e preview/local, sem ativar signup público, alterar flags ou configuração externa. Builds SHALL ser sequenciais, sem disputar `.next` com servidor de desenvolvimento nem com o laboratório; alterações temporárias de ambiente SHALL ficar restritas ao processo local e ser restauradas.

#### Scenario: Gates automatizados verdes

- **WHEN** a validação integrada é executada
- **THEN** testes relevantes, typecheck, lint e build passam
- **AND** os testes da oferta F50.2 e os contratos F56 relevantes foram executados sem provider pago
- **AND** `openspec validate --strict` da mudança é válido

#### Scenario: Smoke HTTP do aplicativo compilado

- **WHEN** a aplicação compilada é iniciada em porta loopback
- **THEN** home, `robots.txt`, `sitemap.xml`, `X-Robots-Tag` e os quatro redirects respondem conforme o esperado
- **AND** nenhum servidor de desenvolvimento ou laboratório disputa `.next` durante o build

#### Scenario: SEO compilado nos três cenários

- **WHEN** o SEO é validado em produção válida, produção com origem inválida e preview/local
- **THEN** produção válida permite indexação da home
- **AND** produção com origem inválida e preview/local permanecem fail-closed/noindex
- **AND** nenhuma configuração externa foi alterada

#### Scenario: UAT nos dois modos

- **WHEN** a landing é validada em mobile e desktop
- **THEN** os modos flag off e flag on apresentam os CTAs e formulários corretos
- **AND** o signup público não é ativado em produção

### Requirement: Follow-up de canonical/OG registrado sem correção implícita

A integração SHALL registrar como follow-up o comportamento de produção confirmada com origem inválida/ausente, em que `metadataBase` recai em `FALLBACK_ORIGIN` e a home emite `canonical`/`og:url` com `http://localhost:3000`. A integração SHALL NOT corrigir esse comportamento, alterar `resolveCanonicalOrigin()` ou mudar a metadata para mascarar a pendência.

#### Scenario: Pendência documentada

- **WHEN** o resultado da integração é registrado
- **THEN** o caso de origem inválida em produção está documentado como follow-up
- **AND** a recomendação de omitir canonical/OG nesse caso está registrada

#### Scenario: Nenhuma correção silenciosa

- **WHEN** o diff de SEO é revisado
- **THEN** `origin.ts`, `environment.ts`, `home-metadata.ts` e o comportamento de fallback permanecem como na F51.2
- **AND** nenhuma alteração de canonical/OG é feita sem mudança própria aprovada

### Requirement: Parada para revisão antes de publicação

A integração SHALL parar para revisão humana após a validação, sem commit de merge antes da revisão, push, deploy, configuração externa, migration, envio real de e-mail ou geração paga. A rodada de elaboração da proposta SHALL NOT autorizar merge, implementação ou GSD; a integração ocorre na branch de integração, e o merge para a `main`, push e publicação SHALL depender de aprovação explícita posterior.

#### Scenario: Nenhuma publicação automática

- **WHEN** a validação integrada termina
- **THEN** o resultado é apresentado para revisão
- **AND** nenhum commit de merge, push, deploy ou configuração externa é executado
- **AND** a branch de integração não é mesclada na `main` sem aprovação
