# Quick Task 261003-jet Summary

Corrigida a identidade de cada linha do painel de políticas: a key React e o `data-testid` agora usam `policy.id`, permitindo exibir múltiplas políticas da dimensão `intencao` sem colisões.

## Alterações

- `bench-policies-panel.tsx`: `<li>` usa `key={policy.id}` e `data-testid={`bench-policy-${policy.id}`}`.
- `bench-ui.contract.test.tsx`: seletores existentes usam IDs completos; adicionada regressão simultânea para Oferta, Destaque e Exclusivo, verificando linhas/IDs/valores e ausência de aviso de duplicate key. O spy em `console.error` é restaurado em `finally`.

## Verificações

| Comando | Resultado |
|---|---|
| `npx vitest run "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"` | PASS — 1 arquivo, 68 testes |
| `npm run typecheck` | PASS — exit 0 |
| `npm run lint` | PASS — exit 0 |

## Commit de código

- `9e8f8e1c` — `fix(261003-jet): stabilize bench policy rows`
- Commit atômico com somente os dois arquivos fonte/teste listados acima.

## Limites confirmados

Definições/registries de políticas, composer, pricing, APIs, caminhos produtivos fora do componente nomeado e migrations não foram modificados. Não houve geração de imagens, execução da bancada nem chamadas a provedores.

STATE foi atualizado para registrar o quick task; ROADMAP permaneceu inalterado por ser uma correção ad hoc. O commit de código contém somente o componente e o teste.
