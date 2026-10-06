## Context

Esta change é a **F56.2b1**, núcleo ponta a ponta do novo fluxo Produto 1:1, com chaves **desligadas**. **Depende da F56.2a** (contratos/componentes/estruturas inativos). A change original `fase-56-2-novo-fluxo-geracao-produto-1-1` foi reconciliada em F56.2a + F56.2b1 + F56.2b2 e relocada para `openspec/changes/archive/2026-10-06-fase-56-2-novo-fluxo-geracao-produto-1-1/` (ver `RECONCILIATION.md`).

Estado relevante (pós-F56.1): o fluxo legado vive em `src/app/api/campaign/generate-image/route.ts` (reserva crédito, copy ∥ imagem, revisor automático, gate `campaign_approval_enabled`); a copy é **fatal**; `reserve_credit` **deduz** na reserva e `confirmCredit` é **no-op**; os componentes F56.1 (`createNewFlowImageGateway`, `resolveImageModelPairConfig`, `assertImagePairExecutable`, `nextImageGenerationAttempt`, `buildPublicGenerationFailure`, `recordDiagnosis`, `resolveImagePairCost`) não têm caller. Decisões do responsável já incorporadas (não reabrir).

O núcleo precisa fechar **junto** porque uma arte baixável sem o contrato transacional de cobrança não é uma entrega segura.

## Goals / Non-Goals

**Goals:**

- Roteamento efetivo e controles auditados; download pelo fluxo persistido.
- Formulário conectado com validação server-side.
- Orquestração real (preflight, política, snapshot/histórico, telemetria, `IMG-001`/diagnóstico).
- **Crédito transacional com máquina de estados durável** de reserva → upload → entrega/estorno.
- Arte 1024×1024 com download direto; legado preservado.
- Copy não bloqueante com estado de falha persistido (sem botão de retry).

**Non-Goals:**

- Botão "Tentar gerar copy novamente" e piloto controlado (F56.2b2).
- Aprovação/reprovação/correção (F56.3).
- Reativar regeneração da F37 ou revisor automático.
- Chamada paga, `db push`, deploy ou abertura geral por esta proposta.

## Decisions

### B1-D1 — Roteamento efetivo, controles auditados e rollback

O handler SHALL consultar a decisão server-side da F56.2a e ramificar para o novo fluxo quando habilitado. Chave **geral** prevalece; falha de leitura mantém o legado sem reinterpretar campos novos (intenção/fundo) como legados. Os controles administrativos SHALL ser auditados pela RPC existente. Rollback = desligar a chave (novas campanhas voltam ao legado; existentes preservam o fluxo persistido).

**Trava de ativação prematura:** a ativação efetiva SHALL exigir, além da chave, uma **autorização verificável de escopo**, server-side e testável. Distinguem-se dois escopos: **(a) autorização temporária de piloto**, restrita ao ambiente isolado e à geração paga aprovada — usada pela F56.2b2 para executar o piloto; **(b) autorização de lojas de teste**, concedida somente **após** a validação do piloto. Uma chave ligada **sem qualquer autorização aplicável permanece ineficaz** (roteamento no legado). "Deixar desligado" é decisão operacional, não proteção técnica. Sem a autorização aplicável, a habilitação SHALL ser recusada.

### B1-D2 — Download decidido pelo fluxo persistido

O download SHALL seguir o **fluxo em que a campanha nasceu**, não a flag atual. Campanhas legadas mantêm as regras anteriores; campanhas do novo fluxo têm download direto quando a operação estiver **entregue** (crédito resolvido — ver B1-D4).

### B1-D3 — Formulário conectado e validação server-side

O formulário SHALL exibir/transportar as seleções da F56.2a; o servidor SHALL validar (Original exige exatamente uma imagem de produto; identidade não conta) como erro de campo, nunca `IMG-001`. O legado permanece inalterado com chaves desligadas.

### B1-D4 — Máquina de estados durável de crédito (reserva → upload → entrega/estorno)

**Normativa e fechada** (não é questão aberta). A operação do novo fluxo SHALL ter uma máquina de estados durável, persistida, com:

- **Identidade estável:** `campaignId + operation_id`; chave única `(campaign_id, operation_id)`. Reenvios com a mesma identidade SHALL NOT duplicar reserva, entrega ou estorno.
- **Estados:** `reserved` → `art_uploaded` → `delivered` | `refunded`, com transições **idempotentes e atômicas** (CAS/condicional no estado atual). `delivered` **é** a confirmação e é **terminal**; **não** existe etapa separada de confirmação. Toda transição SHALL ser registrada append-only. O estorno (`refunded`) SHALL ser permitido **apenas** a partir de `reserved` ou `art_uploaded`; uma operação já `delivered` SHALL NOT ser estornada pela reconciliação.
- **Semântica de crédito:** `reserve_credit` já deduz; a **confirmação** é a transição para `delivered` (marcação idempotente própria), **não** o `confirmCredit` no-op; o estorno (transição para `refunded`) restaura o saldo de forma idempotente.
- **Reserva e estado nascem juntos:** como `reserve_credit` deduz, a reserva e a criação do estado SHALL ocorrer **na mesma transação** com a identidade `campaignId + operation_id`. Se a atomicidade for inviável, a dedução SHALL carregar a identidade estável (chave de idempotência/metadados) para que a reconciliação **localize a dedução órfã** entre a dedução e a gravação do estado e a resolva (estorno), sem dedução órfã remanescente.
- **Evidência de arte baixável:** a arte SHALL ser considerada disponível somente quando existir o registro da arte **e** o objeto imutável no storage com as dimensões reais registradas **e** a operação estiver em `delivered`. **Sem crédito resolvido, a arte NÃO é considerada entregável** e não é liberada para download.
- **Concorrência:** duplicatas concorrentes SHALL convergir para um único resultado; o ledger SHALL refletir exatamente um efeito por identidade.
- **Detecção de operação interrompida:** operações presas em `reserved`/`art_uploaded` além de um limiar SHALL ser marcadas para reconciliação; a detecção ocorre também em qualquer leitura/download da campanha.
- **Gatilho de reconciliação:** rotina **agendada** e **manual** (admin), idempotente, que inspeciona estado + evidência de storage + ledger e resolve **com segurança** por três desfechos: arte persistida e **íntegra** ⇒ `delivered` (um crédito consumido); arte **ausente ou comprovadamente corrompida** ⇒ `refunded` (saldo restaurado); **estado ambíguo/não classificável** ⇒ quarentena/escalonamento. Nunca cobrança silenciosa.
- **Cobertura de interrupções:** testes transacionais SHALL cobrir interrupções **antes** da reserva (nada a estornar), **entre a dedução e a gravação do estado** (dedução órfã localizada pela identidade), entre reserva e upload, e entre upload e `delivered` — além de **corrida entre worker e reconciliador** e duplicata concorrente. A reconciliação NÃO SHALL estornar uma operação `delivered`.

### B1-D5 — Orquestração real dos componentes F56.1

A orquestração SHALL: resolver a configuração fail-closed; persistir o snapshot no início; rodar o preflight de pricing `complete` antes de reserva/provider; executar a política (2+1) com `rate_limit` transitório e quota/faturamento sem fallback; emitir envelope e custo por tentativa; e, em falha, produzir `IMG-001` + referência com diagnóstico durável. Gateway sem retry/fallback internos.

### B1-D6 — Copy não bloqueante (sem ação de retry)

A entrega e o débito SHALL depender da **arte**, não da copy. Em falha apenas da copy: arte baixável (quando a operação estiver `delivered`) com o único débito, e o **estado de falha persistido**. Nesta fatia **não** existe botão de nova tentativa; a ação, seus controles e o custo interno pertencem à F56.2b2.

### B1-D7 — Arte 1024×1024 e download direto

A arte SHALL ser persistida em `campaign-images` com **prefixo próprio e caminhos imutáveis**, em 1:1 com **1024×1024 reais** e dimensões reais registradas; nenhum registro declara 1080×1080. Download direto sem revisor automático nem aprovação/reprovação, condicionado ao estado `delivered`.

### B1-D8 — Snapshot e histórico operacionais

O snapshot SHALL ser persistido no início da operação real e reutilizado por nova geração/correção da mesma campanha; cada tentativa SHALL ser registrada append-only na relação da F56.2a, sem sobrescrever o run/trace histórico.

### B1-D9 — Verificação isolada

Gates transacionais SHALL rodar em instância Supabase descartável comprovadamente isolada. Geração paga e piloto ficam na F56.2b2, com autorização humana específica.

### B1-D10 — Recorte em planos

Se a F56.2b1 exceder **10 planos**, parar e propor novo corte ao responsável **antes** de planejar.

## Risks / Trade-offs

- **[Débito duplo / interrupção entre reserva e entrega]** → máquina de estados durável (B1-D4), idempotência por identidade, CAS e reconciliação; arte não entregável sem crédito resolvido.
- **[Ativar fluxo errado]** → decisão server-side, chave geral prevalecendo, fail-closed.
- **[Download indevido]** → download pelo fluxo persistido e pela operação `delivered`.
- **[Reescrever histórico]** → append-only + snapshot imutável.
- **[Copy travar entrega]** → sucesso parcial com estado persistido.
- **[Regressão no legado]** → ramo aditivo atrás de chave + testes de fronteira.

## Migration Plan

1. Consumo operacional das estruturas da F56.2a + estado de operação (reserve/upload/delivered/refunded) e adaptações aditivas, sem `db push`.
2. Orquestração, roteamento, formulário, crédito+reconciliação, arte/download, instrumentação; typecheck/lint/build/testes locais.
3. Testes transacionais na instância isolada cobrindo interrupções em cada fronteira; não regressão do legado.
4. Migration remota/deploy somente em etapa posterior autorizada (piloto e geração paga = F56.2b2).

## Open Questions

- Nenhuma bloqueante. (Não bloqueante: nome literal do prefixo em `campaign-images`.)
