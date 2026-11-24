---
quick_id: 261124-p2i
status: complete
date: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: b5f634c4862d37b58172217742633f0cd0817fd5
commit: a44fd298
scope: f62-modal-initial-checking-state
---

# Quick 261124-p2i — Summary

## Resultado

Corrigido o estado inicial da modal F62: a consulta GET pendente agora é
apresentada como **“Verificando disponibilidade…”**, sem anunciar geração,
sem acompanhamento e sem confirmação habilitada. A descrição normal permanece.
O estado elegível mostra custo/confirmação; o processamento real mantém
mensagem de geração, spinner, acompanhamento e bloqueios já aprovados.

Escopo versionado em `src/`: **6 arquivos** — 4 de produto/catálogo
(`add-vertical-dialog.tsx`, `messages.ts`, `pt-BR.ts`, `es-419.ts`) e 2 de
teste (`add-vertical-dialog.test.tsx`, `catalogs.test.ts`).

Nenhum backend, contabilidade, banco, migration, Storage, flag, segredo,
provider ou configuração foi alterado. Nenhum POST ou geração paga foi
executado.

## Aceite técnico e reexecuções (responsável, 2026-11-24)

- **Aceite:** correção aprovada tecnicamente, com a limitação visual
  preservada e explicitamente aceita.
- **Reexecuções do responsável:** gates afetados reexecutados e aprovados
  (testes afetados, typecheck, lint e diff-check), conforme o aceite. As
  contagens detalhadas da reexecução do responsável não foram repassadas nesta
  entrada e não são reconstituídas aqui; os números abaixo são os da execução
  do agente.
- **Contagem documental:** 6 arquivos em `src/`, incluindo os dois testes.

## Causa

`src/components/campaign/add-vertical-dialog.tsx` usava
`loading && !dto ? messages.processing : messages.description` na descrição e
o mesmo estado no bloco de conteúdo com spinner + `processing` + `tracking`.
Como `dto` ainda era `null`, `busy` era `false` e Cancelar ficava habilitado —
uma classificação visual incorreta, não uma segunda operação.

## Alterações

- `src/components/campaign/add-vertical-dialog.tsx`
  - `isCheckingAvailability = loading && !dto`;
  - descrição sempre `messages.description`;
  - ramo exclusivo de consulta: spinner acessível + uma única mensagem
    `checkingAvailability`, sem `tracking`;
  - ramo `busy` (submitting/processing) preservado;
  - rótulo de carregamento dos botões de nova consulta (expirada/unavailable)
    passou a `checkingAvailability` (é GET, não geração);
  - sessão, `seqRef`, abort do GET, não abort do POST, polling, expiração,
    tokens e payload inalterados.
- `src/lib/i18n/campaign-detail/messages.ts`: nova chave
  `checkingAvailability`.
- `src/lib/i18n/campaign-detail/catalogs/pt-BR.ts`:
  `Verificando disponibilidade…`.
- `src/lib/i18n/campaign-detail/catalogs/es-419.ts`:
  `Verificando disponibilidad…`.
- Testes do diálogo: 5 cenários novos (GET pendente, transição elegível,
  fechamento durante GET, GET processing existente, POST pendente).
- Teste de catálogos: chave nova na lista exata + textos pt-BR/es-419.

## Validação executada

| Comando | Resultado |
|---|---|
| `npx vitest run src/components/campaign/__tests__/add-vertical-dialog.test.tsx` | 26/26 PASS |
| `npx vitest run src/lib/i18n/campaign-detail/__tests__/catalogs.test.ts src/__tests__/app/campaign-detail-format.test.tsx` | 22/22 PASS |
| Reexecução conjunta dos 3 arquivos | 48/48 PASS (3 arquivos de teste) |
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd run lint` | exit 0 |
| `git diff --check` | exit 0 |

Build não executado (não necessário; servidor `next start -p 3100` permaneceu
intocado usando a `.next` existente).

## Evidência visual

Arquivos em `evidence/`:

- `01-consulta-pendente.png`: descrição normal, spinner e
  “Verificando disponibilidade…”, Cancelar habilitado, sem “Estamos gerando”,
  sem acompanhamento e sem Confirmar. `dom-checks.txt` registra a ausência dos
  textos de geração no DOM capturado.
- `02-elegivel.png`: após o GET elegível, “Custo: 1 crédito”,
  Cancelar e Confirmar adição; sem mensagem de consulta ou geração.
  `dom-checks.txt` registra a presença do custo/confirmação.

Método: harness **complementar fora do app** (sem página/rota no projeto) que
monta o componente real, o catálogo real e o CSS do build atual, atrasando
somente a resposta do GET em 8 s. Nenhum POST foi possível (bloqueado no
harness) e nenhum clique em Confirmar foi feito.

**Limitação explícita:** não houve validação automatizada da jornada
autenticada real (não há Playwright/Puppeteer instalado nem sessão autorizada
automatizável neste ambiente). A captura comprova o componente e os textos
reais com a resposta do GET atrasada; a jornada autenticada em si permanece
para confirmação humana no Review Stop.

## Invariantes / limites preservados

- Sem POST, reserva, cobrança, estorno ou geração.
- Sem alteração de banco, migration, Storage, flags, segredos, provider,
  contabilidade ou configuração.
- `.f62-check/` preservado e não versionado.
- Sem merge, push, deploy ou início da quick de entrega 1:1.
- `unknown`, `delivered`, `refunded`, `incompatible` e `unavailable`
  permanecem com os comportamentos aprovados.
