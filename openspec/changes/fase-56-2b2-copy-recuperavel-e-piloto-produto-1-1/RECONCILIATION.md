# Reconciliação — F56.2b2 (copy recuperável, recuperação de imagem/estorno e teste controlado)

> Documento de apoio da change `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1`. **Não** substitui `proposal.md`/`design.md`/`specs`/`tasks`. **Não** reescreve archives. Nenhuma decisão é declarada implementada.

## 1. Ponto de partida

- **F56.2b1b** concluída, verificada, sincronizada e arquivada em **2026-10-12** (`openspec/changes/archive/2026-10-12-fase-56-2b1b-nucleo-entregavel-produto-1-1/`).
- Novo fluxo **INATIVO** (chaves `false`, autorização `off`); deploy apenas em **preview**.
- Quick **`261013-hxm`** corrigiu as 18 falhas investigadas; ambiente isolado recuperado; **build + 54 testes reais** passaram.
- Archives e evidências históricas **intocados**.

## 2. Diff conceitual (especificação anterior → reconciliada)

| Dimensão | Antes (change original) | Depois (reconciliada) |
| --- | --- | --- |
| Recuperação de copy | botão único "Tentar gerar copy novamente"; anti-repetição genérica | **falha de entrega**; 3 automáticas (30s/5s/30s/10s/30s) + até 3 manuais (**máx. 6**); tentativas **identificadas**; histórico; proteção contra conclusão atrasada; sucesso encerra; falha definitiva não repete |
| Qualidade editorial | implícito: retry poderia "melhorar" | copy **entregue encerra**; texto ruim é **editável**; **não** autoriza nova geração |
| Recuperação de imagem | ausente | arte no Storage: **íntegra → concluir sem regenerar**; **ausência confirmada → estorno único** |
| D13 | limitação aceita + gate; resolução por admin | **estratégia substituta** (recuperação + estorno confirmado) com provas; **gate preservado**; **D13 não resolvido**; archive b1b intocado |
| Validação | E2E + piloto "no ambiente isolado" | **local-primeiro** (Docker/Supabase, provider simulado) → **teste real local controlado** (autorização humana + teto) → preview restrito **opcional/posterior** |
| Autorização | "autorização habilitadora" | **autorização temporária estreita** (instância + lojas, expiração, auditoria, revogação); **barreira global não removida** |
| Fronteira F56.3 | aprovação/correção | **inalterada** |

## 3. Contratos verificados na implementação (b1a/b1b)

- `COPY_BUDGET_MS = 30_000` (`src/lib/product-1-1/copy/copy-state.ts`).
- `completed`/`failed` são **terminais protegidos**; `product_1_1_apply_copy_state` devolve `rejected`/`conflict` e **recusa** reabrir/sobrescrever; `completed` exige conteúdo (`invalid_content`); cancelamento atômico separado.
- Operação de crédito idempotente `campaignId + operation_id`, `reserved → art_uploaded → delivered | refunded`, `delivered` terminal, `delivered_not_refundable`, reconciliação **adia**.
- Sonda de arte **tipada** (`integral | absent | invalid | indeterminate`); erro de Storage **não** colapsa com `absent`; bucket privado; caminho imutável.
- Autorização append-only; RPC administrativa **recusa** estágios habilitadores (`operational_activation_blocked_in_b1a`).
- Execução **dentro da requisição**, sem fila/worker/cron/outbox.

## 4. Como a política de copy cabe no ciclo de execução

Geração roda em **uma requisição**; não há execução durável. A recuperação usa **requisições explícitas**: 1ª tentativa no dreno da requisição original; 2ª/3ª automáticas e as manuais são novas requisições (cada uma com orçamento próprio de 30s), governadas por um **contador server-side de tentativas identificadas**. Fechar o navegador **interrompe** o ciclo automático (sem retomada prometida); a retomada é **manual**. Não se introduz cron/worker/fornecedor novo.

## 5. Estratégia substituta de D13 (não resolvida)

1. Operação **não terminal** (`reserved`/`art_uploaded`) → sonda no Storage privado.
2. `integral` → concluir entrega, sem regenerar.
3. Operação não terminal **e** arte ausente são **necessárias, mas NÃO suficientes** (é a situação normal durante a geração). O **gatilho persistido** de encerramento local é: **falha FINAL para a operação, sem retry/fallback pendente** (`outcome = 'failed'` de operação ou nenhuma tentativa adicional possível), **sem** nenhum claim `in_progress`, com arte `absent` confirmada. **Um `failed` de tentativa com retry/fallback pendente não estorna** (o orquestrador grava `failed` antes de decidir a próxima tentativa).
4. **Exceção reconhecida sem marcador já gravado:** a **finalidade** é provada server-side (operação terminalmente falha / nenhuma tentativa adicional). Quando não há essa prova — nenhum claim, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente, ou finalidade não provável — **não** há estorno automático: exige **encerramento local explicitamente autorizado e auditado** (motivo + evidência). **Consulta/reload durante a geração normal não estorna.** O encerramento (automático/autorizado) ocorre sob a **mesma trava** da linha de crédito e **impede atomicamente** tentativa posterior.
5. `invalid`/`indeterminate` → reverificar, feedback honesto, sem estorno.
6. Corrida entrega×estorno e estorno idempotente; resultado atrasado não reabre/sobrescreve; **`refunded` não retorna a `delivered`**.
7. Autorização de recuperação/gratuidade **server-side**; `delivered` nunca estorna.

**Separação imagem × copy:** a recuperação de copy independe do estado da imagem (pode ocorrer com a imagem já `delivered` e não toca a operação financeira); a **recuperação financeira** limita-se a operações **não terminais**.

**Provas exigidas:** (a) corrida entrega×estorno; (b) estorno idempotente; (c) resultado atrasado; (d) falha de Storage/banco; (e) formulário restaurado; (f) **geração normal (claim `in_progress`) → consulta/reload NÃO estorna**; (g) **principal falhou, fallback ainda será iniciado → NÃO estorna**; (h) **falha final sem marcador prévio → encerra e estorna uma vez**; (i) **sem sinal de finalidade → exige encerramento local autorizado e auditado**; (j) **o encerramento impede atomicamente tentativa posterior**. 

## 6. Lacunas honestas

- **D13 NÃO resolvido** até a **implementação e comprovação** da estratégia; o que falta é **prova operacional** (matriz real), **não** a resolução de uma fonte de encerramento externo do provider, que **não** é exigida.
- **Limites efetivos** de Vercel Hobby / Supabase Free **não verificados** — e **não** usados como justificativa de desenho.
- Schema de tentativas **fixado** (uma linha por tentativa em `copy_state`); restam apenas `transient × definitive` e limiares exatos.
- Nada aqui é declarado **implementado**.

## 7. Tamanho e corte proposto (a aprovar)

Estimativa **12–16 planos** se fase única (**acima** de 8–10). **Corte proposto** (fronteiras, dependências e aceite independente na tabela de `proposal.md`): **B2.1** copy; **B2.2** imagem/estorno/D13; **B2.3** autorização estreita + teste real. Checkpoint humano entre as fatias. Isto é uma **proposta a aprovar** — **não** o início automático de três fases GSD; cada fatia entra no GSD com planejamento e aceite próprios. Sem retirar segurança nem testes; sem antecipar migration remota, deploy, habilitação de lojas ou F56.3.
