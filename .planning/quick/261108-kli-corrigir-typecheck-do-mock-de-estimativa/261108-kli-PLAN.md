---
id: 261108-kli
title: Corrigir typecheck do mock de estimativa atrasada na bancada
status: ready
date: 2026-11-08
scope: typecheck-only
---

# Quick 261108-kli — Corrigir typecheck do mock de estimativa atrasada

## Contexto reproduzido

`npm run typecheck` falha com TS2345 em:

- arquivo: `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`
- linha: 2081
- causa: `resolveFirst` é declarado como `(value: Response) => void`, mas
  `jsonResponse(...)` devolve um objeto parcial `{ ok, status, headers, json }`.
  O objeto não é assignável a `Response` (faltam `redirected`, `statusText`,
  `type`, `url` e membros de `Body`).
- origem: trecho introduzido no commit `f79f4559`.

## Objetivo

Fazer o mock de resposta JSON ser uma `Response` HTTP real, preservando o cenário
de descarte de estimativa atrasada, sem casts, sem relaxar o TypeScript e sem
excluir testes.

## Tarefas

1. **Corrigir o helper `jsonResponse`**
   - files: `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`
   - action: trocar o objeto literal por `new Response(JSON.stringify(payload), { status, headers })`,
     mantendo o `Content-Type: application/json`.
   - verify: helper continua servindo todos os usos (`ok`, `status`, `headers`, `json()`)
     e passa a ser `Response` real.
   - done: TS2345 desaparece sem `as unknown as Response` nem `@ts-ignore`.

2. **Validar o contrato focado**
   - files: o mesmo arquivo de teste.
   - action: rodar o teste focado da bancada e confirmar que o cenário
     “descarta resposta atrasada de estimativa após troca de configuração” passa.
   - verify: `npx vitest run <arquivo>` verde.

3. **Gates e reconciliação documental**
   - action: rodar `npm run typecheck`, `npm run lint` e `git diff --check`;
     registrar o resultado em `261108-kli-SUMMARY.md` e reconciliar os registros
     de fechamento que citavam a pendência (quick `261108-j3p` e `STATE.md`),
     sem apagar as evidências anteriores.
   - verify: typecheck/lint exit 0, diff check limpo, registros antigos preservados
     com nota de resolução.
   - done: SUMMARY e STATE.md atualizados.

## Fora do escopo

Dimensões, geração, expansão, créditos, banco, ambiente e providers. A geração
quadrada permanece em 1024; a mudança para 1152 não será implementada.
Sem chamadas pagas, merge, push ou deploy.
