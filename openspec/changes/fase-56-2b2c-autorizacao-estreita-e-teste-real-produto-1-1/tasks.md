# Tasks — B2.3 Autorização estreita e teste real local (Produto 1:1)

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. O **teste real** exige **autorização humana específica** e **teto de gasto**. Esta fatia **não** implementa copy (B2.1) nem imagem/estorno/D13 (B2.2).

> **Dependência:** **fechamento e comprovação de B2.1 e B2.2** — **ambas CONCLUÍDAS e ARQUIVADAS** (B2.1 com limitações preservadas e **sign-off de segurança aprovado no escopo inativo em 2026-10-17**; B2.2 `approved_with_limitations`; **D13 atendido SOMENTE no piloto local**). Deriva da change agregadora substituída (`RECONCILIATION.md`).

> **Ambiente de validação fixado:** homologação permanente **`vendeo-homolog`** (workdir `G:\Vendeo-Homolog`, API `127.0.0.1:57781`; ledger **126** após B2.3).

> **Reconciliação (2026-10-17):** caixas conferidas **individualmente** com evidência GSD (`.planning/phases/56.2.5-…/`) e código; **sem presunção**. Itens sem evidência suficiente permanecem **abertos** e explicados. **D13: atendido SOMENTE no piloto local** (não produção). Resíduos: **F1/WR-02 aceitos no escopo local**; **L1–L3 dívidas**.

## 1. Preparação e dependência

- [x] 1.1 Confirmar por escrito a dependência de B2.1 e B2.2 comprovadas e o recorte B2.3 (autorização/teste real) — **`56.2.5-CONTEXT.md`; `STATE.md`; B2.1/B2.2 arquivadas**
- [x] 1.2 Confirmar que o novo fluxo segue inativo (chaves `false`, autorização `off`) e que a agregadora **não** é sincronizada/arquivada — **preflight PASS; flags `false`; change ATIVA (não sincronizada/arquivada)**
- [x] 1.3 Confirmar que archives/specs principais permanecem intocados — **`56.2.5-04-GATES.md`; nenhum archive reescrito**
- [x] 1.4 **Checkpoint A (pré-implementação)** — avaliar o **sign-off de segurança B2.1** (separado) e **aprovar o plano** — **`56.2.5-01-GATE.md` (`aprovado com limitações`)**

## 2. Autorização temporária estreita

- [x] 2.1 Autorização restrita à **instância e ao escopo de lojas de teste** (`test_stores`), **sem** granularidade por loja — **migration `20261017000001`; `admin_grant_product_flow_stage_authorization`**
- [x] 2.2 **Respeitar a expiração existente quando informada** — migration `…0001`; provas de expiração (`f56_2b2c_narrow_authorization_proofs.mjs`)
- [x] 2.3 **Auditoria** (concessor, motivo, `operation_id`, escopo, instância) — migration; provas
- [x] 2.4 **Revogação** — `admin_revoke_product_flow_stage_authorization`; prova
- [x] 2.5 Revalidar a decisão **server-side** a cada uso — `resolve-pilot-spend-gate.ts` + perfis negativos
- [x] 2.6 Preservar a **barreira global** — migration + testes (recusa de escopo geral)
- [x] 2.7 Testes negativos (escopo geral recusado; recorte autorizado; expiração/revogação encerram) — **autorização 8/8**
- [x] 2.8 Ajuste **mínimo** da barreira (`isolated_pilot`+`test_stores`+`isolated`; recusa `all_stores`; sem subsistema) — migration + provas

## 3. Validação local-primeiro

- [x] 3.1 Rodar na **`vendeo-homolog`** com **lojas de teste** e **provider simulado**; nenhuma chamada paga — **`56.2.5-04-HARNESS-RECONCILIATION.md`; preflight PASS; provas simuladas**
- [ ] 3.2 **ABERTO** — Cobertura **pelo navegador** de form/geração/estados/persistência/copy/recuperação/créditos/download: **não exercitada integralmente nesta fatia** (apenas 1 geração real pelo navegador em 4.2 + testes automatizados). Evidência insuficiente para marcar como concluída.
- [x] 3.3 Rodar typecheck, lint, build e suíte local — **typecheck 0 · lint 0 · build 0 · integração 24/24**
- [x] 3.4 Pricing **`complete` principal E fallback** por **modelo+qualidade** em `image_model_pair_config` — **`gpt-image-2/medium`+`gpt-image-2/low`; `ai_model_selection` preenchido **somente** para `campaign_copy` (gpt-4o), **não** para imagem** (decisão humana registrada)

## 4. Checkpoint humano e teste real controlado

- [x] 4.1 **Checkpoint humano** (autorização + modelo/qualidade + pricing + teto) — **`56.2.5-UAT.md`; cap US$1,00**
- [x] 4.2 Executar o **teste real controlado local** apenas no recorte autorizado — **`56.2.5-04-PILOT-EXECUTION.md` (N=1)**
- [x] 4.3 Registrar evidências; **sem deploy/remote migration** — campanha `20d54b1d…`; flag `test_stores` **temporária** no escopo local, revogada ao final (sem habilitação geral)
- [ ] 4.4 **ABERTO (opcional/posterior)** — Preview restrito com configuração isolada de dados/credenciais: **não executado** (condicional/posterior; não bloqueia).
- [x] 4.5 **Controle de gasto mínimo** (imagem ≤3; copy ≤6; estimativas conservadoras; anti-concorrência; parar; sem garantia financeira) — **`spend-control.ts` + migration `…0002`; gasto 13/13**
- [x] 4.6 **Inspeção humana** do resultado real; falhas raras por **simulação** — **UAT aprovado (arte/copy)** + D13 local (3/3)
- [ ] 4.7 **ABERTO/PARCIAL** — Negativos (flag off/loja não-test/instância/escopo geral) **cobertos**; porém **apenas 1 loja de teste** foi exercitada no fluxo novo (**Adega E NovaTek** não validaram ambas). Evidência insuficiente para marcar concluída.

## 5. Fronteiras e checkpoint final

- [x] 5.1 Não promoção automática; rollback de deploy separado de banco/ledger — **`56.2.5-VERIFICATION.md`**
- [x] 5.2 F56.3 **não** antecipada — `STATE.md`/ROADMAP
- [x] 5.3 `openspec validate --strict` + `git diff --check` — **reexecutado (ver VERIFICATION)**
- [x] 5.4 Submeter a B2.3 à **revisão humana** — **`56.2.5-UAT.md` (arte/copy + indicadores visuais)**
- [x] 5.5 Registrar o resultado **sem** iniciar GSD — **`56.2.5-04-SUMMARY.md`**
- [x] 5.6 Explicitar a **ordem** dos checkpoints (A: sign-off B2.1; B: D13 + modelo/qualidade/pricing + gasto + inspeção) — **`56.2.5-CONTEXT.md`/planos**

> **Abertas (3):** **3.2**, **4.4**, **4.7** — por **evidência insuficiente** (não por associação à fase). Reconciliação **documental**; sem reabrir código nem repetir o piloto.
