# Tasks — B2.3 Autorização estreita e teste real local (Produto 1:1)

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. O **teste real** exige **autorização humana específica** e **teto de gasto**. Esta fatia **não** implementa copy (B2.1) nem imagem/estorno/D13 (B2.2).

> **Dependência:** **fechamento e comprovação de B2.1 e B2.2** — **ambas CONCLUÍDAS e ARQUIVADAS** (B2.1 com limitações preservadas e **sign-off de segurança pendente/separado**; B2.2 `approved_with_limitations` com **D13 NÃO resolvido**). Deriva da change agregadora substituída (`RECONCILIATION.md`).

> **Ambiente de validação fixado:** homologação permanente **`vendeo-homolog`** (workdir `G:\Vendeo-Homolog`, API `127.0.0.1:57781`, 123 migrations). Prontidão/dependências/decisões em `B2.3-READINESS.md` (documento desta rodada, somente documental).

> **Tamanho estimado:** **3–4 planos**. Se exceder 8–10, **parar** e propor ajuste sem retirar segurança/testes.

## 1. Preparação e dependência

- [ ] 1.1 Confirmar por escrito a dependência de B2.1 e B2.2 comprovadas e o recorte B2.3 (autorização/teste real)
- [ ] 1.2 Confirmar que o novo fluxo segue inativo (chaves `false`, autorização `off`) e que a agregadora **não** é sincronizada/arquivada
- [ ] 1.3 Confirmar que archives/specs principais permanecem intocados
- [ ] 1.4 **Checkpoint A (pré-implementação):** avaliar o **sign-off de segurança B2.1** (separado) e **aprovar o plano** — **antes** de implementar

## 2. Autorização temporária estreita

- [ ] 2.1 Especificar/implementar a autorização restrita à **instância e ao escopo de lojas de teste** (`test_stores`), **sem** granularidade por loja
- [ ] 2.2 **Respeitar a expiração existente quando informada** (sem nova expiração obrigatória; janela pela flag + revogação)
- [ ] 2.3 Implementar **auditoria** (concessor, motivo, `operation_id`, escopo, instância)
- [ ] 2.4 Implementar **revogação**
- [ ] 2.5 Revalidar a decisão **server-side** a cada uso; nunca a partir do cliente
- [ ] 2.6 Preservar a **barreira global** (não remover a recusa de estágios habilitadores de escopo geral)
- [ ] 2.7 Cobrir com testes negativos: escopo geral continua recusado; recorte autorizado é o único permitido; expiração/revogação encerram
- [ ] 2.8 Ajuste **mínimo** da barreira: permitir **`isolated_pilot` + `test_stores` + `isolated`** (recusando `all_stores` e os demais estágios habilitadores), **reaproveitando** os controles existentes (instância, autorização, auditoria, revogação) — **sem** `store_id`, allowlist, concessão/revogação/expiração por loja e **sem** novo subsistema

## 3. Validação local-primeiro

- [ ] 3.1 Rodar na **homologação permanente `vendeo-homolog`** (127.0.0.1:57781), com **lojas de teste** e **provider simulado**; nenhuma chamada paga
- [ ] 3.2 Cobrir pelo navegador: formulário, geração, estados, persistência, copy, recuperação, créditos e download
- [ ] 3.3 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)
- [ ] 3.4 Definir pricing **`complete` para principal E fallback** (por **modelo+qualidade**) na configuração **própria do fluxo novo** (`image_model_pair_config`); **não** preencher `ai_model_selection` (legado) por conveniência — valor do pricing permanece **decisão humana**

## 4. Checkpoint humano e teste real controlado

- [ ] 4.1 **Checkpoint humano**: obter autorização humana específica e definir **modelo/qualidade**, **pricing** e **teto de gasto**
- [ ] 4.2 Executar o **teste real controlado local** apenas no recorte autorizado
- [ ] 4.3 Registrar evidências do teste real; sem deploy, sem migration remota, sem habilitação de lojas
- [ ] 4.4 Avaliar preview restrito (opcional/posterior) **somente** com configuração isolada de dados/credenciais
- [ ] 4.5 Implementar o **controle de gasto mínimo** (**não** existe cap cumulativo hoje): **limitar chamadas** (imagem ≤3 = ≤2 principal + ≤1 fallback; copy 3+3=6), usar **estimativas conservadoras** para parar, **prevenir execuções simultâneas** (claims/acquire atômicos) e **parar**; **sem prometer garantia financeira** da cobrança final; **não** criar subsistema de orçamento
- [ ] 4.6 **Inspeção humana obrigatória** do resultado do teste real; falhas raras do provider cobertas por **simulação**
- [ ] 4.7 Testes negativos: **flag desligada**, **loja não-test**, **instância/ambiente não autorizado** e **escopo geral**; **Adega e NovaTek** validam o fluxo novo; **sem regressão** do legado

## 5. Fronteiras e checkpoint final

- [ ] 5.1 Garantir **não promoção automática** para produção/habilitação geral; separar rollback de deploy de banco/ledger
- [ ] 5.2 Confirmar que a **F56.3** não foi antecipada
- [ ] 5.3 Rodar `openspec validate --strict` desta change e `git diff --check`
- [ ] 5.4 Submeter a B2.3 à **revisão humana**
- [ ] 5.5 Registrar o resultado sem iniciar GSD
- [ ] 5.6 Explicitar a **ordem** dos checkpoints: **Checkpoint A** (**pré-implementação**) avalia o **sign-off de segurança B2.1** (separado); **Checkpoint B** (pré-teste-real) avalia **D13** + modelo/quality/pricing + controle de gasto + inspeção — **sem** considerá-los resolvidos nem ignorá-los
