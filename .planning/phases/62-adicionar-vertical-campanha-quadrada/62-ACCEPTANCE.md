# F62 — Aceite final local (visual/funcional e desempenho)

**Data:** 2026-11-24
**Status:** **ACEITA LOCALMENTE; SPECS SINCRONIZADAS; CHANGE ARQUIVADA; PUBLICAÇÃO REMOTA PENDENTE.**
**Declarante:** responsável pelo produto (declaração registrada nesta sessão)
**Escopo aceito:** adição vertical 9:16 à campanha quadrada já entregue,
validada em produção local (`http://localhost:3100`).
**Natureza:** aceite **local/homologação local**. Não é aprovação de produção,
publicação, merge, push ou deploy. A change OpenSpec foi **sincronizada e
arquivada** em 2026-11-24; a publicação remota permanece pendente.

> Este documento separa explicitamente três fontes: (1) a **declaração
> visual/funcional do responsável**; (2) as **verificações técnicas do revisor**;
> e (3) as **evidências anteriores do executor**. Nenhuma medição foi inventada;
> quando um dado não foi medido, ele permanece marcado como não medido.

---

## 1. Declaração visual/funcional do responsável — Vellora

O responsável validou em produção local uma **nova campanha**:

| Campo | Valor |
|---|---|
| Produto | **Chaleira Elétrica Vellora** |
| `campaign_id` | `682dafa2-8b98-4ddf-aef8-88a9e37aefbc` |

Jornada aprovada:

1. geração **1:1**;
2. download do 1:1;
3. expansão **9:16**;
4. modal com spinner e **Cancelar desabilitado**;
5. entrega;
6. download do 9:16;
7. alternância entre os formatos.

O responsável declarou **ambas as artes publicáveis** e o **desempenho
aprovado**. Esta é a declaração visual/funcional; os números técnicos não foram
medidos nesta rodada e não são inferidos aqui.

## 2. Verificações técnicas do revisor — Vellora

A revisão confirmou:

- operações **original e adicional `delivered`**;
- expansão com **uma única dedução de 1 crédito**, saldo **6→5**, **sem
  estorno**;
- **referência principal da campanha preservada no quadrado**;
- **bytes, dimensões e checksums dos três artefatos** conferem;
- **ponte byte-idêntica** ao quadrado entregue;
- **56 arquivos / 861 testes PASS**; typecheck, lint e OpenSpec válidos;
- migration final **SHA-256
  `56dc3423c9be5d7363bd663a694a7e20f9bb9faed3569eb3e1c9574a76b9272a`**.

Esses itens são **verificação do revisor**, não uma nova execução do executor.

## 3. Evidências anteriores do executor — Jarra

O aceite anterior cobria a campanha Jarra
`c06b16f5-f126-429c-b5b0-9567fe4adb95`, com o artefato vertical **já entregue**:

| Item | Evidência |
|---|---|
| Vertical 9:16 | 1080×1920 JPEG, visível; chip selecionado |
| Quadrado 1:1 | 1024×1024 JPEG; chip selecionado |
| Download 9:16 | 309.682 B; SHA-256 `843cee99…556b07` |
| Download 1:1 | 178.723 B |
| Modal | spinner acessível; Cancelar/Escape/clique fora bloqueados em POST/processing |
| Stack overflow do detalhe | não reproduzido |
| PostgreSQL/Storage | 12/12 cenários + persistência/probe/download reais (documentos próprios) |

**Histórico preservado:** naquele aceite da Jarra, **não havia** uma nova
geração por IA para avaliar — o artefato já estava entregue. A campanha Vellora
é a nova geração que foi posteriormente avaliada e considerada publicável. As
duas afirmações coexistem: a Jarra não avaliou nova geração; a Vellora avaliou.

## 4. Desempenho (produção local, evidência do executor)

Medição da instância de produção local (`next start -p 3100`) na campanha Jarra:

| Métrica | Resultado |
|---|---:|
| Primeira abertura 9:16 — navegação | **517 ms** |
| Primeira abertura 9:16 — imagem carregada | **400 ms** |
| Aquecido 1:1 → 9:16 — clique→imagem | mediana **214 ms**; máx **221 ms** (n=6) |
| Aquecido 9:16 → 1:1 — clique→imagem | mediana **116 ms**; máx **128 ms** (n=5) |
| Documento 1:1 | 13.908 B comprimidos / **54.056 B decodificados** |
| Documento 9:16 | 14.001 B comprimidos / **54.729 B decodificados** |
| `GET /format-additions` (delivered) | **48–71 ms** (mediana 55 ms), 67 B |

O responsável declarou o desempenho **aprovado**. Não foram fornecidas
medições separadas da Vellora; este documento não as inventa.

## 5. P1–P3 — melhorias opcionais, não bloqueantes

Não foram implementadas. Permanecem como melhorias opcionais, sem autorização:

- **P1:** no caminho feliz do 9:16, sondar a vertical antes do quadrado e usar o
  quadrado só como fallback (até 11,4 MB menos no documento de dev; ~25 ms no
  fluxo real).
- **P2:** uma única transição após a entrega (`replace` ou `refresh`, nunca os
  dois).
- **P3:** não revalidar a fonte no GET de adição já `delivered` (~50 ms).

Nenhuma delas é necessária para o aceite atual.

## 6. Ressalvas preservadas

1. **Migration:** `20261123130252` aplicada **somente na homologação local**
   (ledger 157→158). Não aplicada em produção/remoto. O hash atual é
   `56dc3423…`; a aplicação local inicial usou `61c72719…` e, após a correção da
   RPC, somente a função foi reaplicada. Nenhuma migration corretiva foi criada
   e o ledger não foi alterado nesta rodada.
2. **Resíduo sintético:** 4 conjuntos de fixtures F62 de Storage permanecem
   identificados; cleanup bloqueado pelos guards intencionais.
3. **Geração/qualidade:** a nova geração **Vellora** foi avaliada visualmente e
   considerada publicável; o aceite da Jarra, anterior, cobria apenas o artefato
   já entregue. Nenhuma nova chamada paga foi feita nesta rodada de fechamento.
4. **Variantes não reexercitadas manualmente nesta aceitação:** es-419, legado
   1024, saldo zero, estorno/replay e rollback da flag. Permanecem cobertas por
   testes offline/DB quando aplicável; não são declaradas provas manuais novas.
5. **Gate F60.4:** fechado pela correção test-only da allowlist (5 caminhos do
   transporte) e pelo guard **8/8 PASS**; a suíte global foi reexecutada e ficou
   **867 arquivos/10.805 testes PASS + 2 arquivos/10 skipped, 0 falhas**.
6. **Release:** sync/archive concluídos; aplicação remota da migration, merge,
   push, deploy, ativação de flag e publicação continuam **não autorizados**.
7. **P1–P3:** opcionais e não bloqueantes; não implementados.

## 7. Estado operacional

- Instância disponível para teste manual: **somente `http://localhost:3100`**
  (3000/3001 encerradas).
- Página deixada em **9:16** (vertical 1080×1920).
- Nenhuma alteração de código de produto, banco, Storage, flag ou configuração
  nesta rodada de aceite.
- Relatório de desempenho: `62-09-PERF-DIAGNOSIS.md`.
- Consolidação técnica: `62-08-SUMMARY.md`.
- GSD verify-work: `62-GSD-UAT.md`; OpenSpec verify: `62-OPSX-VERIFY.md`.
- Encerramento documental: `62-CLOSURE-REPORT.md`; change arquivada em
  `openspec/changes/archive/2026-11-24-adicionar-vertical-campanha-quadrada/`.
