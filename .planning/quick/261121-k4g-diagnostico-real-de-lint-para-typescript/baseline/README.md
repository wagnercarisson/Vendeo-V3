# Baseline — quick 261121-k4g

Registros coletados **antes** de qualquer alteração de configuração, dependência ou código,
na branch `chore/lint-typescript-diagnostico` (HEAD `c9d68fbe`, árvore limpa).

## Origem de cada arquivo

| Arquivo | Comando | Resultado |
|---|---|---|
| `lint.txt` | `npm run lint` | exit 0, 0 problemas |
| `lint-json.relative.json` | `node node_modules/eslint/bin/eslint.js . --format json` (normalizado) | 80 arquivos, 80 `.mjs` + 1 `.js`, 0 mensagens |
| `typecheck.txt` | `npm run typecheck` | exit 0 |
| `build.txt` | `npm run build` | exit 0 |
| `test.txt` | `npm test` | 834 arquivos / 10.315 testes PASS; 2 arquivos e 10 testes skip |

## Sanitização aplicada

- `lint-json.relative.json` é a versão publicável do JSON do ESLint: todos os caminhos foram
  convertidos para o formato relativo ao repositório (separador `/`) e ordenados. O arquivo bruto
  com caminhos absolutos **não é versionado** e não é mantido.
- `test.txt` teve a linha `RUN v4.1.9 <caminho absoluto>` substituída por `RUN v4.1.9 <repo>`.
- Varredura final: nenhum dos arquivos contém caminho absoluto, nome de usuário ou caminho pessoal.

## Ruído conhecido

- Os logs foram capturados pelo console do Windows e exibem acentuação corrompida (mojibake).
  O conteúdo técnico (contagens, exit codes) é o que importa; a origem não foi reescrita.
- O lint oficial cobre apenas `.js`/`.mjs`/`.cjs`. Nenhum `.ts`/`.tsx` de `src/` foi analisado,
  o que é exatamente a limitação que esta quick diagnostica.
- `baseline/lint-json.relative.json` inclui 8 scripts gerados em
  `supabase/.temp/landing-lab/**` (diretório gitignored, gerado em runtime). Eles aparecem na
  baseline porque o lint oficial não os ignora; o diagnóstico os descarta com motivo explícito.
