# F62 — Runbook de suporte da adição vertical

**Escopo:** campanha quadrada individual/legada que recebeu (ou tentou receber) a adição `9:16`.
**Natureza:** procedimento de diagnóstico e reconciliação. Não cria painel, RPC, migration ou crédito manual.
**Regra de ouro:** diagnóstico é **somente leitura**; qualquer encerramento usa exclusivamente as RPCs idempotentes da própria adição. Nunca criar reserva manual, apagar vínculo ou projetar o vertical em `campaigns.storage_path`.

## 1. Identidade e localização

Localizar a adição pela combinação server-side:

- `store_id` + `campaign_id` + `operation_id` da **adição** (não da operação original);
- ou `store_id` + `campaign_id` + `request_id` (replay);
- ou `source_artifact_id` (vínculo da fonte).

Tabelas/leituras de referência:

- `campaign_format_additions`: identidade, `source_origin`, `status`, `request_id`, `operation_id`, checksums e economia congelada.
- `product_9_16_two_stage_operations` / steps/claims: controle, tentativas, deadline e fences.
- `product_1_1_campaign_credit_operations`: reserva/entrega/estorno da adição (nunca da campanha quadrada).
- `product_generation_operation_outcomes_v`: `unknown` × `failed` durável.
- `campaign_composition_artifacts`: arte vertical e, quando aplicável, a fonte.
- `product_9_16_two_stage` views de claim/outcome usadas pelo suporte.

O `operation_id`/`request_id` é **interno**. Não o exponha ao lojista nem o aceite do navegador como autoridade.

## 2. Leitura de estado

Ordem de precedência:

1. `credit.status = delivered` ⇒ **delivered** (somente com arte vertical íntegra).
2. `credit.status = refunded` ou vínculo `refunded` ⇒ **refunded**.
3. `outcome = unknown` em operação não terminal ⇒ **unknown**.
4. `outcome = failed` durável em operação não terminal ⇒ **failed definitivo** (não confundir com `unknown`).
5. `credit.status = reserved`/`art_uploaded`, sem outcome terminal ⇒ **processing**.
6. leitura indisponível/identidade incompleta ⇒ **unknown/unavailable** (fail-closed); nunca ausência presumida.

`source_origin` deve ser `new_flow_1_1` ou `legacy_campaign`. Campanha legada aceita fonte 1024 no modo opt-in; 1080 legado é incompatível no caminho da adição.

## 3. Crédito, outcome e arte

- Verifique **uma única** operação de crédito da adição, o valor `1`, o `state_epoch` e o `publication_state`.
- Não consulte saldo como condição de retomada; a reserva existente é a autoridade.
- `unknown` NÃO autoriza estorno nem regeneração. Só uma sondagem de arte + estado durável podem fechar o caso.
- `failed` definitivo exige arte ausente comprovada, outcome gravado e estorno idempotente uma única vez.
- Se a arte vertical já existir íntegra, confirme a entrega sem nova chamada paga.

## 4. Reconciliação e encerramento

- Use as RPCs idempotentes da adição (`begin publication`, `deliver`, `refund`) com a identidade interna resolvida no servidor.
- Replays devem reutilizar `request_id`/operação; nunca abrir outra operação para “consertar”.
- Estorno é **exclusivo da adição**. A operação original 1:1, copy, quadrado e snapshot permanecem intocados.
- Se o outcome é `unknown`, acompanhe/sonde; não estorne por timeout, idade ou dúvida.
- Se a flag dedicada estiver desligada, novas aberturas/retries ficam bloqueados; operações abertas ainda podem ser reconciliadas/finalizadas. A flag compartilhada do motor não é rollback da adição.

## 5. Não fazer

- **não criar** reserva, crédito, operação ou vínculo manualmente;
- não apagar `campaign_format_additions`, arte, crédito ou outcome;
- não gravar o vertical em `campaigns.storage_path`, `status` ou `error`;
- não chamar projeção de entrega/encerramento da campanha para uma adição;
- não reutilizar token `start` antigo após estorno para reabrir cobrança;
- não prometer sucesso/estorno que o estado durável não confirme;
- não expor path, URL assinada, snapshot, bytes ou credenciais em ticket/log.

## 6. Código público de suporte

A adição ainda **não possui código público próprio** no catálogo. Use a referência interna da operação/request + classificação técnica segura (`unknown`, `failed`, `provider_error`, `artifact_absent`) e siga `docs/convencoes/codigos-de-erro-suporte.md` se um código público for aprovado no futuro. Não invente código, não trunque UUID e não use diagnóstico bruto do provider.

## 7. Idempotência e evidência

- Toda ação de encerramento deve ser idempotente e vinculada à mesma identidade; replay não duplica crédito nem auditoria.
- Registrar no ticket: loja, campanha, referência interna, estado lido, artefato (sim/não), crédito (reservado/entregue/estornado), outcome, ação executada e resultado.
- Não registrar secrets, URLs assinadas, conteúdo de imagem ou dados pessoais desnecessários.
