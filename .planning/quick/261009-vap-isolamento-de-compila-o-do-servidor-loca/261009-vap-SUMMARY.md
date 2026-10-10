---
status: complete
quick_id: 261009-vap
slug: isolamento-de-compila-o-do-servidor-loca
date: 2026-10-10
code_commit: 82f26e9c
---

# Quick 261009-vap — Isolamento de compilação do servidor local do laboratório

## Proteção do `next-env.d.ts` (complemento pós-revisão)

O inicializador foi reforçado: além do snapshot em memória, grava backup recuperável em disco
(`next-env.d.ts.snapshot` + `.sha256` sob o lab) e, após `app.prepare()`, restaura e **verifica o
hash antes de atender tráfego**; divergência de hash ou ausência indevida aborta o startup
(`process.exit(1)`) em vez de servir. Isso cobre interrupção abrupta em que o `finally` não roda.
Alteração aplicada em `start-web.mjs` (git-ignored), com `node --check` OK; **sem reinício agora** —
o processo em execução segue com o comportamento validado até o próximo restart.

## Pendente

- Conferência visual do logo renderizado na interface (a evidência atual cobre API e banco).
  Programada para o próximo ciclo, sem reinício agora.

## Resultado

O servidor Next.js do laboratório (`http://127.0.0.1:3002`) passou a compilar em um diretório
exclusivo (`supabase/.temp/landing-lab/.next-web`) e a usar um tsconfig dedicado, ativados
somente por sentinel definido pelo próprio inicializador local. Os arquivos compartilhados
(`tsconfig.json`, `tsconfig.typecheck.json`, `next-env.d.ts`) permaneceram intactos.

## Diagnóstico confirmado

- Next 15.5.18: `NextCustomServer.prepare()` não propaga `options.conf`; o router-server relê a
  configuração e usava o `.next` padrão. Confirmado no código instalado.
- Logs anteriores exibiam `Cannot find module './vendor-chunks/@supabase.js'` com stack em
  `C:\Projetos\Vendeo V3\.next\server\webpack-runtime.js` e HTTP 500 em rotas de loja/perfil/logo.
  Isso comprovava a falha de isolamento; não provava causa por processo concorrente.
- O `verifyTypeScriptSetup()` do Next chama `writeConfigurationDefaults()` (pode tocar o `include`
  do tsconfig) e `writeAppTypeDeclarations()` (escreve **sempre** `next-env.d.ts` na raiz).
  Por isso o isolamento não podia ser só `distDir`.

## Mudanças

- `next.config.ts`: `distDir` e `typescript.tsconfigPath` condicionais ao sentinel
  `VENDEO_LAB_ISOLATED_DIST=true`; redirects preservados; default inalterado sem sentinel.
- `supabase/.temp/landing-lab/start-web.mjs` (git-ignored): define o sentinel, copia
  `tsconfig.json` → `tsconfig.landing-lab.json`, faz snapshot de `next-env.d.ts` e o restaura em
  `finally`; removeu o `conf` ignorado.
- `tsconfig.json`, `tsconfig.typecheck.json`, `eslint.config.mjs`: excluem o cache do laboratório.
- `.gitignore`: ignora `tsconfig.landing-lab.json`.
- `src/__tests__/next.config.test.ts`: cobre default, sentinel, valor inválido e redirects.

## Baseline vs. pós-mudança (não-regressão)

| Gate | Baseline | Pós-mudança |
|---|---|---|
| `npm run typecheck` | exit 0 | exit 0 |
| `npm run lint` | exit 0 | exit 0 |
| `npm test -- src/__tests__/next.config.test.ts` | — | 7/7 pass |

Nenhum erro preexistente novo; nenhuma regressão introduzida.

## Isolamento comprovado no boot

- Startup logou `Using tsconfig file: tsconfig.landing-lab.json` e o `include`
  `supabase/.temp/landing-lab/.next-web/types/**/*.ts` foi escrito no tsconfig **dedicado**.
- `.next-web` foi criado com `server/`, `static/`, `types/`; `.next` principal manteve o mtime
  anterior (21:47 vs 22:46), sem nova escrita.
- `git status` de `tsconfig.json` e `next-env.d.ts`: vazio. `next-env.d.ts` restaurado ao conteúdo
  original (`./.next/types/routes.d.ts`), sha256 `F4E8976C...25C0`.

## UAT funcional (loja descartável dedicada, sem IA paga)

Loja descartável `ccf6b65d-ec40-40f1-b8a0-d2d4012f0c71` (`is_test_store=true`), dono
`ff6d2659-...` — usuário descartável local. NovaTek e Adega **não** foram tocadas.

| Passo | Resultado |
|---|---|
| GET `/api/store/[id]` | 200, sem erro de módulo |
| PATCH `/api/store/[id]` | 200, sem erro de módulo |
| POST `/api/store/[id]/logo` | 201, sem erro de módulo |
| GET `/api/store/[id]/logo` | 200 |
| GET `/api/store/[id]/brand-profile` | 200, `visual_style="mock — desenvolvimento"` |

Persistência local (`store_brand_assets`): `original, normalized, on_light, on_dark, square_safe,
horizontal_safe` — todas `active`. `stores`: `identity_state=logo`, `logo_status=uploaded`.
Perfil `logo_analysis` `synced`. Nenhum erro `vendor-chunks` nos logs novos.

Adega/NovaTek: 6 linhas de asset da Adega criadas no import de 18:44 (`updated_at == created_at`),
sem alteração por este quick.

## Separação de evidências (critério 6)

- (a) Upload/processamento/persistência **local**: comprovados.
- (b) Perfil de direção **mock de desenvolvimento**: `mock — desenvolvimento`.
- (c) Alinhamento real por IA: **não autorizado e não validado** neste quick.

## Limites e não-escopo

- Nenhuma chamada paga, geração de assinatura ou alteração em produção.
- Nenhuma migration, reset, `db push` ou alteração da stack Supabase.
- F56 permanece pausada; nenhum prompt/compositor/modelo/contrato alterado.
- `fixtures/lab/bench/stores.json` não alterado; novas lojas não cadastradas.
- Sem rota de exclusão de loja existente: a loja/usuário descartáveis ficam identificados e
  documentados como artefatos locais do lab (decisão registrada).
- Investigação de cookies/sessão entre portas não foi necessária: refresh token inválido não foi
  reproduzido como causa; não tratado como causa do erro de módulo.

## Rollback

Reverter `82f26e9c` (6 arquivos versionados); remover `tsconfig.landing-lab.json` (gerado, ignored)
e restaurar `next-env.d.ts` a partir do snapshot se necessário. Parar somente o processo do lab após
validar PID/linha de comando. Não apagar `.next` principal. Não alterar Adega/NovaTek.

## Artefatos de evidência

`supabase/.temp/landing-lab/quick-evidence/` (git-ignored): `baseline-*.txt`, `after-*.txt`,
`uat-report.json`, `uat-console.txt`, `list-stores.mjs`, `check-approved.mjs`, `uat-logo.mjs`.
