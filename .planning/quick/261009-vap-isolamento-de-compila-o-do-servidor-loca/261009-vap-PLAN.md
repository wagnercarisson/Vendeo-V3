---
name: "Isolamento de compilação do servidor local do laboratório"
created: 2026-10-09
mode: quick
status: pending-review
files_modified:
  - next.config.ts
  - supabase/.temp/landing-lab/start-web.mjs
  - tsconfig.json
  - tsconfig.typecheck.json
  - eslint.config.mjs
  - .gitignore
  - src/__tests__/next.config.test.ts
  - .planning/quick/261009-vap-isolamento-de-compila-o-do-servidor-loca/261009-vap-PLAN.md
---

# Plano quick — isolamento de compilação do servidor local do laboratório

## Objetivo

Corrigir o isolamento do build do servidor Next.js do laboratório em `127.0.0.1:3002`, sem alterar o comportamento padrão do projeto, Vercel ou outros processos. Este documento é somente um plano para revisão: nenhuma implementação, reinicialização ou UAT foi executada.

## Contexto e diagnóstico confirmado

- `supabase/.temp/landing-lab/start-web.mjs` inicia Next 15.5.18 com `conf.distDir` apontando para `supabase/.temp/landing-lab/.next-web`, mas o initializer instalado não propaga `options.conf` até `loadConfig`; o servidor volta a ler configuração e usar `.next` na raiz.
- Os logs do servidor em questão exibem stack sob `.next/server/webpack-runtime.js` e erro por `vendor-chunks/@supabase.js`. São evidência de configuração/build incompatível; não provam que outro processo causou o módulo ausente.
- `.next` existe e `.next-web` não existe no diagnóstico fornecido. Não presumir que limpar `.next` principal seja seguro ou necessário.
- `next.config.ts` contém quatro redirects; todos devem permanecer exatamente preservados.
- No Next instalado, `verifyTypeScriptSetup()` chama `writeConfigurationDefaults()` e `writeAppTypeDeclarations()`: um pode adicionar `${distDir}/types/**/*.ts` ao `include` do tsconfig; o outro escreve sempre em `<projectRoot>/next-env.d.ts` com referência a `${distDir}/types/routes.d.ts`. Mudar só `distDir` pode contaminar arquivos compartilhados.
- `tsconfig.json` inclui `**/*.ts` e `**/*.tsx` e exclui apenas `node_modules`; `tsconfig.typecheck.json` redefine `exclude` para `node_modules` e `.next`. Ambos precisam excluir o cache do laboratório. `eslint.config.mjs` ignora `.next/`, `node_modules/` e `dist/`, mas não o cache do laboratório.
- O inicializador define `OPENAI_API_KEY` vazio e mantém `OPENAI_BENCH_API_KEY` separado. Não chamar IA nem mudar configuração de ambiente.
- Sem chave de IA padrão, o diretor de marca executa extração/direção locais determinísticas e pode produzir campos `mock — desenvolvimento`; isso não é identidade final nem alinhamento autorizado por IA.
- Upload persistido do logo e variantes (`normalized`, `on_light`, `on_dark`, `square_safe`, `horizontal_safe`) comprovam processamento/persistência do arquivo, não alinhamento da identidade.
- Auth pode ter cookies compartilhados entre portas no mesmo host; localStorage/IndexedDB é por origin, incluindo porta. Logs de refresh token inválido são uma linha de investigação separada e não causa primária assumida do crash de módulos.

## Decisão técnica a implementar, sujeita à revisão

Manter `distDir` condicional em `next.config.ts`, ativado só por sentinel definido exclusivamente pelo `start-web.mjs`, com valor fixo `supabase/.temp/landing-lab/.next-web`. Para evitar que Next atualize o `tsconfig.json` comum, o inicializador prepara `tsconfig.landing-lab.json` dedicado na raiz a partir do config raiz; `typescript.tsconfigPath` aponta a esse arquivo apenas no modo laboratório. O arquivo dedicado será ignorado pelo Git, mantém globs/paths relativos à raiz e recebe o include de tipos do `distDir` sem escrever no config principal. Next escreve `next-env.d.ts` sempre no `projectRoot`; preservar snapshot e restaurar byte a byte em `finally` após `app.prepare()` (também em falha controlada), com cópia recuperável/hash se interrompido. Serializar startup: não iniciar enquanto build/typecheck/servidor F56 estiver lendo esses arquivos; se não puder garantir ausência de concorrência, pausar e pedir decisão. Excluir cache do laboratório dos dois tsconfigs gerais e do ESLint. Sem sentinel, manter `.next`, comportamento Vercel e redirects. Não usar `conf` ignorado.

## Escopo e exclusões

Fronteira mínima ampliada: `next.config.ts`, `supabase/.temp/landing-lab/start-web.mjs`, `tsconfig.json`, `tsconfig.typecheck.json`, `eslint.config.mjs`, `.gitignore` e teste existente `src/__tests__/next.config.test.ts`. `tsconfig.landing-lab.json` gerado/ignorado fica na raiz e não versionado; snapshot transitório de `next-env.d.ts` deve ser restaurado byte a byte e hash conferida antes do servidor atender tráfego. Não tocar worktrees/landing, prompts, compositor, modelos/contratos F56, tracking de fase, fixtures/lista de lojas, `.env.local` ou serviços Supabase. Não adicionar loja à fixture; isso requer alinhamento separado. Não considerar identidade mock pronta para exemplos finais.

## Autorização e pré-condições

Esta proposta exige aprovação humana antes de qualquer implementação, reinício ou UAT com efeitos colaterais. Na execução futura, verificar disponibilidade dos serviços locais do laboratório (API `57321`, DB `57322`), loja/logo/sessão de teste e a identidade do processo na porta 3002. PID e dono da porta são desconhecidos até verificação operacional. Não reiniciar Supabase nem outro serviço. Não editar env, fazer chamadas de IA, assinatura, produção ou provider pago. IA real/alinhamento de identidade e geração de assinatura exigem autorização independente.

---

## Tarefa 1 — baseline e isolamento de build, tipos e verificadores

**Arquivos:** `next.config.ts`, `supabase/.temp/landing-lab/start-web.mjs`, `tsconfig.json`, `tsconfig.typecheck.json`, `eslint.config.mjs`, `.gitignore`, `src/__tests__/next.config.test.ts`; `tsconfig.landing-lab.json` gerado localmente e snapshot de `next-env.d.ts` (não versionados; restauração obrigatória).

**Ação:** Antes de editar qualquer arquivo, executar e guardar resultado completo de `npm run typecheck` e `npm run lint` como baseline, com código, mensagem e localização. Depois, configurar sentinel + `distDir` fixo e `typescript.tsconfigPath` condicional. O inicializador prepara `tsconfig.landing-lab.json` na raiz a partir do config padrão antes de importar/preparar Next; incluir no `.gitignore`. Fazer snapshot de `next-env.d.ts`, permitir escrita durante `app.prepare()` e restaurar byte a byte em `finally`, com backup/hash; falha de restauração bloqueia startup. Não iniciar em paralelo com typecheck/lint/build ou uso F56 desses arquivos. Acrescentar exclusão do cache aos `exclude` dos dois tsconfigs e ao ignore ESLint. Atualizar o teste já existente para default, sentinel ausente/permitido/inválido, `tsconfigPath` condicional e redirects; carregar config isoladamente entre cenários de env para não depender do cache de módulo. Retirar `conf` do initializer. Não instalar dependências nem alterar chaves/conexões.

**Verificação automatizada:** repetir após alteração `npm run typecheck` e `npm run lint` nas mesmas condições/comandos, comparar os diagnósticos com baseline por código/mensagem/localização e classificar preexistentes, resolvidos e novos. Rodar `npm test -- src/__tests__/next.config.test.ts`; conferir tsconfig dedicado, exclusão do cache nos dois tsconfigs/ESLint e hash byte a byte do `next-env.d.ts` restaurado. Não tratar erro preexistente como regressão nem usá-lo para ocultar novo erro.

**Concluído quando:** baseline registrada; typecheck/lint pós-mudança sem novas regressões não explicadas; somente o lab usa distDir e tsconfig isolados; `next-env.d.ts` é restaurado/hash conferido; cache excluído dos verificadores; default e redirects preservados.

## Tarefa 2 — pré-flight e validação operacional estritamente local

**Arquivos:** sem novos arquivos de código; evidência e resultado no futuro summary do quick, somente após autorização e execução aprovada.

**Ação:** Antes de qualquer reinício, identificar porta 3002, PID, caminho completo da linha de comando e confirmar que o PID é exatamente o inicializador `supabase/.temp/landing-lab/start-web.mjs`. Se não for inequívoco, parar e pedir decisão; nunca encerrar processo Supabase ou outro servidor. Só então reiniciar exclusivamente esse PID. Não limpar cache por padrão; se necessário, validar caminho absoluto como descendente exclusivo de `supabase/.temp/landing-lab/.next-web`, guardar backup recuperável antes de qualquer limpeza. Confirmar no startup/artefatos que o laboratório usa esse distDir e que nenhuma compilação do laboratório grava na raiz `.next`.

**Verificação automatizada:** esta tarefa não repete typecheck/lint/build; comparar baseline e pós-mudança somente na Tarefa 1. A prova operacional é coleta read-only do PID/linha de comando, log de startup, `distDir` efetivo e inspeção dos caminhos de artefatos. Nenhum comando de inicialização antes da aprovação deste plano.

**Concluído quando:** PID alvo foi comprovadamente o inicializador do laboratório; somente ele foi reiniciado; distDir observado é o isolado e não há nova escrita lab em `.next` principal; qualquer cache alterado foi exclusivamente o isolado e recuperável; nenhum ambiente ou serviço alheio foi interrompido.

## Tarefa 3 — UAT do laboratório, separando persistência local de alinhamento de identidade

**Arquivos:** sem novos arquivos de código; registrar evidências no futuro summary/UAT do quick após autorização.

**Ação:** Criar/selecionar loja descartável dedicada exclusivamente a este UAT, marcada como loja de teste, com nome identificável e sem ativos anteriores. Confirmar a loja/destino antes do upload: a rota arquiva ativos anteriores da loja-alvo. Não usar Adega nem Novatek e não alterar seus logos, ativos ou exemplos aprovados. Com Supabase local exclusivo nas portas 57321/57322 e sessão apropriada, verificar GET/PATCH de edição, leitura de perfil/logo, upload de imagem, variantes disponíveis, releitura e persistência no Storage/DB local e exibição. Após registrar evidências, remover somente os dados da loja descartável se houver fluxo existente comprovadamente seguro; caso contrário, mantê-la identificada como descartável local e documentar. Diferenciar (a) processamento/persistência local, (b) perfil `mock — desenvolvimento`, (c) alinhamento real por IA não autorizado/não validado. Não acionar geração paga ou assinatura.

**Verificação automatizada:** não aplicável ao UAT manual; registrar URL local, IDs da loja/objeto descartável, operações observadas e evidência de persistência sem expor segredos. Gates automáticos permanecem os da Tarefa 1.

**Concluído quando:** edição/leitura funciona sem módulo faltante; logo e variantes persistem/exibem somente na loja descartável; Adega/Novatek e exemplos aprovados permanecem intocados; três níveis de evidência e limites/sessão ficam documentados.

---

## Tarefa 4 — conferência final pós-UAT de arquivos compartilhados

**Arquivos:** leitura de `next-env.d.ts`, `tsconfig.json`, `tsconfig.typecheck.json`, `eslint.config.mjs`, `.gitignore`; evidência no summary do quick.

**Ação:** Após a UAT e depois de encerrar o processo do laboratório, conferir que `next-env.d.ts` foi restaurado byte a byte (hash igual ao snapshot), que `tsconfig.json` raiz não reteve o caminho de tipos do cache nem entradas transitórias, que `tsconfig.landing-lab.json` só existe se esperado e está ignorado pelo Git, e que nenhum arquivo compartilhado/F56 sofreu alteração inesperada. Se qualquer arquivo compartilhado divergir do esperado, parar e reportar antes de qualquer ampliação de escopo.

**Verificação automatizada:** `git status --short` e `git diff` restritos aos arquivos compartilhados; comparação de hash de `next-env.d.ts`.

**Concluído quando:** todos os compartilhados conferem, o cache do laboratório não aparece em configs/verificadores e não há divergência inesperada.

## Critérios globais de aceite

1. O servidor do laboratório na porta 3002 usa efetivamente o diretório de build isolado.
2. Nenhuma compilação do laboratório grava na `.next` da raiz.
3. Dev/build padrão, Vercel e demais processos continuam usando o comportamento padrão.
4. É possível editar e ler a loja sem módulos faltantes.
5. Logo de teste persiste e é exibido, com variantes verificadas.
6. (a) Upload/processamento local, (b) perfil mock e (c) alinhamento real não autorizado são explicitamente diferenciados.
7. Nenhuma chamada paga, assinatura ou operação de produção ocorre.
8. Validação automática proporcional: teste pertinente de configuração, typecheck e lint/build somente se apropriados; UAT manual documentado e limites claramente registrados.
9. Rollback estrito: reverter somente as alterações declaradas neste quick; parar somente o processo de laboratório depois de validar PID e linha de comando. Nunca apagar `.next` principal. Cache isolado só pode ser limpo com caminho absoluto validado e backup recuperável.
10. `tsconfig.json` e `next-env.d.ts` compartilhados não retêm caminhos do cache do laboratório; ambos tsconfigs e ESLint excluem os artefatos gerados.
11. Baseline e resultados pós-mudança de typecheck/lint são comparados, com erros preexistentes separados de regressões novas.
12. UAT usa somente loja descartável dedicada; Adega, Novatek e exemplos aprovados não são alterados.

## Riscos e dependências

- `next.config.ts` é compartilhado com F56; qualquer mudança global tem risco de regressão, por isso a condicional deve ser inerte sem sentinel e coberta nos dois modos.
- Next escreve `next-env.d.ts` na raiz mesmo com `typescript.tsconfigPath` dedicado. Snapshot, restauração `finally` e hash são obrigatórios; essa janela requer execução serializada. Se não der para impedir concorrência com verificadores/F56, não iniciar e pedir decisão.
- Tsconfig dedicado será gerado na raiz para manter globs e aliases relativos corretos, mas explicitamente ignorado pelo Git; tsconfig geral/typecheck e ESLint precisam excluir o cache `.next-web`.
- Baseline de typecheck/lint pode revelar erros existentes; comparar antes/depois sem atribuir erros antigos ao quick nem mascarar novos.
- Next 15.5.18 lê/reavalia configuração no boot; testar comportamento real e evitar depender de opção `conf` ignorada ou de suposições de cache.
- Dono/PID atual da porta 3002 é desconhecido e precisa de confirmação operacional na execução.
- UAT depende do Supabase local e de loja descartável com imagem/sessão; upload arquiva ativos anteriores, portanto lojas com material aprovado são proibidas como alvo.
- Cookies podem ser compartilhados entre portas localhost; refresh token inválido deve ser investigado separadamente, não tratado como causa primária do erro de módulo.
- Aprovação humana deste plano é gate antes de implementação, reinício e UAT com efeitos colaterais. IA real e geração de assinatura requerem autorização separada. Inclusão de loja em fixtures exige alinhamento separado.

## Rollback

Restaurar somente as mudanças deste quick nos arquivos de implementação/teste listados; não reverter alterações preexistentes nem tocar arquivos F56. Restaurar `next-env.d.ts` do snapshot e conferir hash; tsconfig raiz sem entradas transitórias. Remover `tsconfig.landing-lab.json` apenas após confirmar que foi gerado pelo quick e não contém alterações externas. Parar somente processo lab após validar PID/linha de comando. Não apagar `.next` principal; cache isolado só com caminho absoluto e backup recuperável. Não alterar Adega/Novatek; eventual limpeza limita-se à loja descartável e somente por fluxo seguro existente.

## Parada solicitada

Após revisar este plano, parar para revisão humana. Não implementar, não reiniciar serviços, não executar baseline/validações ou testes funcionais, não chamar IA/provider, não despachar executor e não atualizar `.planning/STATE.md`, SUMMARY ou ROADMAP antes de aprovação explícita.
