# 62-08 — Página vertical 3001 + transporte Node HTTP + UX da modal

**Status:** **TRANSPORTE CORRIGIDO E VALIDADO NA PÁGINA REAL 3001; MODAL AJUSTADA; `62-08` NÃO CONCLUÍDO NO MOMENTO DESTA EVIDÊNCIA.**
> **Atualização 2026-11-24:** o `62-08` foi consolidado e aceito localmente em `62-ACCEPTANCE.md`/`62-08-SUMMARY.md`; o status acima permanece como registro histórico.
**Data:** 2026-11-24.
**Aba/instância:** Microsoft Edge, `http://localhost:3001`.
**Campanha:** `c06b16f5-f126-429c-b5b0-9567fe4adb95` (Jarra).
**Adição entregue:** operação `f0fd0e3c-1b1d-457e-b62f-9b579377fbf7` (linha `82f6a612-…`, `delivered`).
**Sem banco, migration, flags, provider, confirmação paga, merge, push ou deploy.**

## Causa comprovada

A arte vertical entregue:

| Campo | Valor |
|---|---|
| Artefato | `75a92932-…` |
| Dimensões | 1080×1920 JPEG |
| Bytes | 309.682 |
| SHA-256 | `843cee9927c8b5a89c4e7d7cb419fa6b8b805adb72ed08e7a1c9611894556b07` |

O probe direto em Node (`CompositionVerticalProbe`, `retrieveCompositionArtifact`, `CompositionArtifactStorage.downloadBytes`) retornou **integral**: os bytes/checksum/dimensões/MIME/proveniência estão corretos.

No Server Component da página 3001, o mesmo probe usando `storage-js` → `Blob.arrayBuffer()` falhou. Isolamento com uma página temporária no próprio app:

| Modo | Resultado |
|---|---|
| `skip` | **200** |
| `storage` (transporte antigo) | **TypeError: Failed to fetch**; o servidor 3001 caiu em seguida |
| `nodehttp` | **200**, `integral=true`, operação e `vertical.jpg` presentes |

A página temporária foi removida. O problema é o transporte binário dentro do Server Component, não a validação da arte.

## Correção do transporte

- `CompositionArtifactStorage` e `retrieveCompositionArtifact` aceitam um
  `DownloadBytesTransport` opcional.
- `CompositionVerticalProbe` repassa o transporte injetado ao retrieve.
- `createNodeHttpDownloadTransport` adapta `downloadStorageObjectViaNodeHttp`:
  - sucesso → `{ kind: "bytes" }`;
  - timeout, rede, 401/403, 404 ambíguo, payload inesperado ou qualquer exceção
    → `{ kind: "indeterminate" }`;
  - **sem fallback** para `storage-js`;
  - sem exceção escapando e sem presumir ausência.
- `additionSignedUrls` injeta o transporte no `CompositionVerticalProbe` usado
  pelo detalhe, com `timeoutMs: 15000`.
- O helper Node usa o mesmo ambiente/credenciais server-side do cliente da
  página (`SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` e
  `SUPABASE_SERVICE_ROLE_KEY`), sem misturar configurações.
- Checksum, dimensões, MIME, identidade, path, evidência de procedência e
  `retrieveCompositionArtifact` permanecem intactos.

## Validação real na aba 3001

Após reiniciar a instância 3001 (o probe antigo derrubou o processo), a aba
autenticada foi validada:

| Verificação | Resultado |
|---|---|
| `?format=9:16` | **200**, imagem `Jarra Finesse 1l` visível |
| Imagem vertical | **1080×1920**, storage=true |
| Chips | `Quadrado 1:1: Disponível`; `Vertical 9:16: Disponível, Selecionado` |
| Alternância para 1:1 | imagem **1024×1024**, chip 1:1 selecionado |
| Alternância para 9:16 | imagem **1080×1920**, chip 9:16 selecionado |
| Download real | `campanha-c06b16f5-…-9x16.jpg` |
| Arquivo baixado | **309.682 bytes**, **1080×1920 JPEG** |
| SHA-256 do arquivo | `843cee9927c8b5a89c4e7d7cb419fa6b8b805adb72ed08e7a1c9611894556b07` |
| Stack overflow | **não reproduzido** |

O resultado da página temporária foi usado apenas como diagnóstico; a página
definitiva foi validada na mesma aba/instância.

## UX da modal

- Descrição inicial: “Você pode gerar o formato vertical 9:16 para essa
  campanha.”
- Geração: “Estamos gerando a campanha no formato vertical.”
- Spinner acessível (`role="status"`, `aria-label`) e conteúdo principal de
  geração com spinner + texto, sem porcentagem fictícia.
- Durante POST e `processing`: Cancelar desabilitado; Escape e clique fora
  bloqueados; `data-submitting` exposto para diagnóstico.
- Falha/`unavailable`: nova consulta read-only via GET (“Tentar novamente”),
  sem POST automático.
- `unknown`: mensagem de resultado incerto + “Continuar acompanhamento”,
  permitindo recuperação e fechamento.
- Sessão/POST ID e `appliedSeqRef` preservados; nenhum abort de POST.
- Paridade es-419 aplicada.

## Testes

- Adaptador Node HTTP: sucesso, timeout, rede, 401, 403, 404 ambíguo e payload
  inválido → `indeterminate`, sem lançar.
- Retrieve com transporte injetado: integral, `indeterminate` sem presumir
  ausência e bytes inválidos → falha fechada.
- Modal: descrição aprovada; processing bloqueia Cancelar/Escape/clique fora;
  unknown permite continuar/fechar; falha oferece GET read-only; POST A/B com
  sessão antiga, sem abort de A e sem liberar o indicador de B.
- Página real: 3001, 9:16 1080×1920, 1:1 1024×1024, download/integridade.

## Gates

| Gate | Resultado |
|---|---|
| Testes afetados | **12 arquivos / 184 testes PASS** |
| Typecheck | **0** |
| Lint | **0** |
| Build | **0** |
| Regressão global | **867 arquivos / 10.805 testes PASS** (2 arquivos/10 skip) |
| `git diff --check` | limpo |

Os gates de integração que exigem `TEST_DATABASE_URL`/opt-in continuam “NÃO
EXECUTADO” no runner global; a página real foi validada manualmente na 3001.

## Estado final

- Nenhuma alteração de banco, migration, flags ou provider.
- Nenhuma confirmação paga foi repetida.
- App 3000 e 3001 rodando.
- `.f62-check/` permanece não rastreada e preservada.
- `62-08` **não** está concluído.
