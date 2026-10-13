# Tasks — B2.3 Autorização estreita e teste real local (Produto 1:1)

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. O **teste real** exige **autorização humana específica** e **teto de gasto**. Esta fatia **não** implementa copy (B2.1) nem imagem/estorno/D13 (B2.2).

> **Dependência:** **fechamento e comprovação de B2.1 e B2.2**. Deriva da change agregadora substituída (`RECONCILIATION.md`).

> **Tamanho estimado:** **3–4 planos**. Se exceder 8–10, **parar** e propor ajuste sem retirar segurança/testes.

## 1. Preparação e dependência

- [ ] 1.1 Confirmar por escrito a dependência de B2.1 e B2.2 comprovadas e o recorte B2.3 (autorização/teste real)
- [ ] 1.2 Confirmar que o novo fluxo segue inativo (chaves `false`, autorização `off`) e que a agregadora **não** é sincronizada/arquivada
- [ ] 1.3 Confirmar que archives/specs principais permanecem intocados

## 2. Autorização temporária estreita

- [ ] 2.1 Especificar/implementar a autorização restrita a **instância e lojas autorizadas**
- [ ] 2.2 Implementar **expiração**
- [ ] 2.3 Implementar **auditoria** (concessor, motivo, `operation_id`, escopo, instância)
- [ ] 2.4 Implementar **revogação**
- [ ] 2.5 Revalidar a decisão **server-side** a cada uso; nunca a partir do cliente
- [ ] 2.6 Preservar a **barreira global** (não remover a recusa de estágios habilitadores de escopo geral)
- [ ] 2.7 Cobrir com testes negativos: escopo geral continua recusado; recorte autorizado é o único permitido; expiração/revogação encerram

## 3. Validação local-primeiro

- [ ] 3.1 Rodar no **ambiente Docker/Supabase isolado**, com **lojas de teste** e **provider simulado**; nenhuma chamada paga
- [ ] 3.2 Cobrir pelo navegador: formulário, geração, estados, persistência, copy, recuperação, créditos e download
- [ ] 3.3 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)

## 4. Checkpoint humano e teste real controlado

- [ ] 4.1 **Checkpoint humano**: obter autorização humana específica e definir o **teto de gasto**
- [ ] 4.2 Executar o **teste real controlado local** apenas no recorte autorizado
- [ ] 4.3 Registrar evidências do teste real; sem deploy, sem migration remota, sem habilitação de lojas
- [ ] 4.4 Avaliar preview restrito (opcional/posterior) **somente** com configuração isolada de dados/credenciais

## 5. Fronteiras e checkpoint final

- [ ] 5.1 Garantir **não promoção automática** para produção/habilitação geral; separar rollback de deploy de banco/ledger
- [ ] 5.2 Confirmar que a **F56.3** não foi antecipada
- [ ] 5.3 Rodar `openspec validate --strict` desta change e `git diff --check`
- [ ] 5.4 Submeter a B2.3 à **revisão humana**
- [ ] 5.5 Registrar o resultado sem iniciar GSD
