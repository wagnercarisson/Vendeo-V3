---
id: 261108-kli
title: Corrigir typecheck do mock de estimativa atrasada na bancada
status: complete
date: 2026-11-08
branch: feat/fase-59-ajuste-de-1024-para-1152
commit: 88441016
---

# Quick 261108-kli — Correção do typecheck da bancada

## Falha reproduzida

Estado inicial (`npm run typecheck`):

```text
src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx(2081,18):
error TS2345: Argument of type
'{ ok: boolean; status: number; headers: Headers; json: () => Promise<unknown>; }'
is not assignable to parameter of type 'Response'.
  Type '{ ok: boolean; status: number; headers: Headers; json: () => Promise<unknown>; }'
  is missing the following properties from type 'Response':
  redirected, statusText, type, url, and 8 more.
```

## Causa

O teste `descarta resposta atrasada de estimativa após troca de configuração`
declara `resolveFirst: (value: Response) => void`, mas o helper `jsonResponse`
devolvia um objeto parcial que simulava apenas `ok`, `status`, `headers` e
`json()`. O trecho foi introduzido no commit `f79f4559`.

## Correção

`jsonResponse` passou a devolver uma `Response` HTTP real:

```ts
function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- sem `as unknown as Response`, sem `@ts-ignore` e sem relaxar o TypeScript;
- nenhum teste removido ou pulado;
- o cenário de descarte de estimativa atrasada permanece exercitado: a resposta
  antiga continua sendo resolvida depois da troca de `configRevision` e não
  reabre a confirmação nem exibe valor obsoleto;
- os demais usos do helper continuam válidos (`ok`, `status`, `headers`,
  `json()` são membros reais de `Response`).

## Diff

- `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`
  — 3 inserções, 5 remoções (apenas o helper `jsonResponse`).

Commit de implementação: `88441016`.

## Validações

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Teste focado | `npx vitest run "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"` | **75/75 passed** |
| Lint | `npm run lint` | exit 0 (sem cobertura TS — limitação preexistente) |
| Diff check | `git diff --check` | limpo |

O teste focado inclui o caso de descarte de estimativa atrasada que originou a
falha de tipo.

## Reconciliação dos registros de fechamento

Sem apagar as evidências anteriores:

- `.planning/quick/261108-j3p-.../261108-j3p-SUMMARY.md` — nota de reconciliação
  na seção Typecheck e na limitação correspondente.
- `.planning/quick/261108-j3p-.../261108-j3p-OPENSPEC-VERIFY.md` — nota de
  reconciliação na pendência externa, agora resolvida.
- `.planning/STATE.md` — nota na linha da quick `261108-j3p` e nova linha desta
  quick.
- `.planning/quick/261107-hcx-.../261107-hcx-SUMMARY.md` — nota histórica: o
  commit `f79f4559` introduziu o erro; o gate typecheck registrado refletia o
  estado anterior ao trecho.

## Fora do escopo (não alterado)

Dimensões, geração, expansão, créditos, banco, ambiente e providers. A geração
quadrada permanece em **1024**; a mudança para **1152** não foi implementada.
Nenhuma chamada paga, merge, push ou deploy.

## Limitações

- Não foi executada a suíte completa nem o build; o escopo pedia typecheck,
  teste focado, lint e diff check.
- O lint do projeto não cobre TypeScript (limitação preexistente); a prova de
  tipos vem do `tsc`.
- Alteração restrita a um arquivo de teste; nenhum código de produção mudou.
