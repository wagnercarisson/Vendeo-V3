# F60.7 — evidência diagnóstica C2/C6 (offline, 2026-11-20)

**Escopo:** investigação sem implementação. Nenhum ambiente, banco, Storage, provider, migration, RPC, pricing ou flag foi acessado.

## Arquivos

- `ndjson-and-rehydration.diagnostic.test.tsx.txt` — teste diagnóstico temporário executado contra o hook real.
- `ndjson-and-rehydration.diagnostic.log` — saída `vitest --reporter=verbose` da execução.

O teste temporário foi removido de `src/` após a coleta. Este diretório preserva a reprodução.

## Comando

```powershell
npx.cmd vitest run src/components/flow/__tests__/f607-c2-ndjson.diagnostic.test.tsx --reporter=verbose
```

**Resultado:** `1 arquivo / 3 testes PASS`.

## Reproduções

### 1. Terminal de continuação sem newline

Fluxo: reload com identidade persistida → `generation-status` inicial `processing` → continuação manual com `result` terminal **sem** `\n` final.

Resultado observado:

```text
[
  '/api/campaign/generation-status',
  '/api/campaign/11111111-1111-4111-8111-111111111111/continue',
  '/api/campaign/generation-status'
] statusCalls 2
```

- O terminal sem newline não foi consumido.
- O cliente disparou uma **consulta extra** de status.
- A consulta extra retornou 503 e o estado ficou `partial: "unavailable"`, sem navegação.

Com `\n` final, a sequência foi apenas `generation-status` inicial + `continue`, sem consulta extra.

**Causa localizada:** o leitor de continuação faz `buffer = lines.pop()` e, após `done`, não processa `buffer` (`use-campaign-form.ts`, ~2626–2634 e ~2804–2806). O leitor inicial já processa o buffer final (~1828–1838), mas também não faz o flush final do `TextDecoder`.

### 2. Reidratação concorrendo com o stream inicial

Fluxo: submissão normal com draft restaurado, stream inicial aberto (fase `running`, terminal ainda não emitido) e `generation-status` respondendo 503.

Resultado observado **enquanto `isSubmitting === true`**:

- `processingResult.partial === "unavailable"`;
- a tela cairia no aviso “Não foi possível confirmar o status agora...” antes de o stream terminar.

**Caminho localizado:** `persistSubmittedDraft` atualiza `draftScope`; o efeito de reidratação depende de `draftScope` e, com `processingResult` ainda nulo, dispara `refreshStatus` em paralelo ao stream (`use-campaign-form.ts`, ~2846–2917). Se a consulta falhar, `markUnavailable()` sobrescreve o estado com `partial: "unavailable"` (~2430–2442).

Isso prova um caminho reproduzível para o aviso durante geração normal. **Não prova** que foi a causa da execução observada pelo usuário: não há HTTP/log correspondente.

### 3. Contrato do servidor (leitura estática)

- O stream conjunto escreve cada evento com `\n` (`two-format-stream.ts:46`).
- `emitTerminal` marca `terminal = true` e ignora terminais posteriores (`two-format-stream.ts:80–103`).
- Cada resposta do orquestrador emite **um** terminal de resposta (`run-two-format.ts`, `responseTerminal: true`).
- Portanto, o caso sem newline é uma falha de robustez do cliente/transporte; não é o contrato normal do servidor.

## Limites da evidência

- Não houve acesso ao HTTP real, logs de produção/homolog ou estado persistido da operação observada.
- Não é possível afirmar qual dos caminhos ocorreu naquela execução.
- O teste diagnóstico reproduz comportamento do hook com `fetch` simulado; não substitui prova de integração real.
