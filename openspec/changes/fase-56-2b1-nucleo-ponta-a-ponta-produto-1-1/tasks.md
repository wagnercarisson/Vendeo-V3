# Tasks — F56.2b1 Núcleo ponta a ponta do Produto 1:1

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit ou deploy antes da aprovação do responsável. As chaves permanecem **desligadas**; geração paga e piloto ficam na F56.2b2.

> **Dependência:** esta fatia depende da **F56.2a** (contratos/componentes/estruturas inativos).

> **Recorte (B1-D10):** se a estimativa exceder **10 planos**, parar e propor novo corte antes de planejar.

> **Validação isolada.** Gates transacionais SHALL rodar apenas em instância Supabase descartável comprovadamente isolada.

## 1. Preparação e dependência

- [ ] 1.1 Confirmar por escrito a dependência da F56.2a e o mapeamento a/b1/b2
- [ ] 1.2 Fechar detalhes não bloqueantes (nome do prefixo em `campaign-images`, limiar de operação interrompida)
- [ ] 1.3 Confirmar a instância Supabase descartável isolada e registrar sua identidade

## 2. Roteamento efetivo, controles e download por fluxo

- [ ] 2.1 Ramificar o handler de geração conforme a decisão server-side (F56.2a), com chave geral prevalecendo
- [ ] 2.2 Expor os controles administrativos auditados de ativação/desativação
- [ ] 2.3 Implementar rollback: desligar chave volta novas campanhas ao legado sem migrar as existentes
- [ ] 2.4 Decidir o download pelo fluxo persistido da campanha
- [ ] 2.5 Garantir que falha de leitura mantém o legado sem reinterpretar campos novos como legados
- [ ] 2.6 Cobrir com testes: roteamento, precedência, falha de leitura, rollback, download por fluxo
- [ ] 2.7 Implementar a trava verificável de ativação (autorização server-side de ambiente/piloto) e testar que a tentativa de habilitação antes do piloto é recusada e mantém o legado

## 3. Formulário conectado

- [ ] 3.1 Montar os seletores de intenção e fundo (F56.2a) no formulário de produção
- [ ] 3.2 Transportar intenção e fundo no corpo da requisição de geração
- [ ] 3.3 Validar no servidor Original com exatamente uma imagem de produto (identidade não conta), como erro de campo
- [ ] 3.4 Cobrir com testes de UI e de servidor: seleção, transporte, Original aceito/rejeitado, não `IMG-001`

## 4. Composição, orquestração, preflight e política

- [ ] 4.1 Consumir a composição versionada (F56.2a) e registrar `composerVersion`/`promptBaseVersion`/`policyVersions`
- [ ] 4.2 Implementar o preflight de pricing `complete` para principal e fallback antes de reserva/provider
- [ ] 4.3 Construir o gateway isolado (`createNewFlowImageGateway`) com o par resolvido fail-closed
- [ ] 4.4 Executar a política: 2 no principal + 1 no fallback; `rate_limit` transitório; disponibilidade direto ao fallback; quota/faturamento sem fallback
- [ ] 4.5 Não invocar revisor automático nem gate de aprovação no novo fluxo
- [ ] 4.6 Cobrir com testes (fakes/provider simulados): preflight, todas as ramificações da política, teto de 3 chamadas

## 5. Snapshot e histórico operacionais

- [ ] 5.1 Persistir o snapshot no início da operação real e bloquear se falhar
- [ ] 5.2 Registrar append-only cada tentativa real vinculada à campanha e ao snapshot original
- [ ] 5.3 Reusar o snapshot original para nova geração/correção da mesma campanha
- [ ] 5.4 Preservar fluxo, briefing, intenção, fundo, referências e par no snapshot/histórico
- [ ] 5.5 Cobrir com testes transacionais: snapshot no início, append-only, reuso, não sobrescrita do run/trace

## 6. Crédito transacional: máquina de estados durável

- [ ] 6.1 Modelar a operação com identidade `campaignId + operation_id` e chave única `(campaign_id, operation_id)`, com reserva e criação do estado atômicas (ou dedução carregando a identidade estável para localizar dedução órfã)
- [ ] 6.2 Implementar as transições idempotentes `reserved → art_uploaded → delivered | refunded` com CAS
- [ ] 6.3 Reservar um crédito na entrada em `reserved` (idempotente)
- [ ] 6.4 Confirmar a entrega como transição para `delivered` (marcação própria, não `confirmCredit`)
- [ ] 6.5 Estornar como transição para `refunded` (idempotente, restaura o saldo)
- [ ] 6.6 Condicionar a entrega baixável ao estado `delivered` (sem crédito resolvido, arte não entregável)
- [ ] 6.7 Garantir que tentativas/fallback não somam crédito e não são operação separada
- [ ] 6.8 Implementar detecção de operação interrompida (limiar) e reconciliação agendada/manual idempotente
- [ ] 6.9 Resolver com segurança arte persistida/utilizável → `delivered` versus ausente/corrompida → `refunded`; ambíguo → quarentena/escalonamento
- [ ] 6.10 Cobrir com testes transacionais na instância isolada: queda **antes** da reserva (nada a estornar); queda **entre a dedução e a gravação do estado** (dedução órfã localizada pela identidade); interrupção entre reserva e upload; entre upload e `delivered`; **corrida entre worker e reconciliador**; duplicata concorrente; arte ausente/corrompida → estorno; estado ambíguo → quarentena; estorno restaura saldo
- [ ] 6.11 Garantir que o estorno só ocorra a partir de `reserved`/`art_uploaded` e que uma operação `delivered` nunca seja estornada pela reconciliação

## 7. Arte 1024×1024, download e copy não bloqueante

- [ ] 7.1 Persistir a arte 1:1 1024×1024 em `campaign-images` sob prefixo próprio e caminhos imutáveis, com dimensões reais
- [ ] 7.2 Impedir que qualquer registro declare 1080×1080 para arquivo 1024×1024
- [ ] 7.3 Disponibilizar o download direto quando a operação estiver `delivered`, sem aprovação/reprovação
- [ ] 7.4 Preservar as regras de download das campanhas antigas e impedir que a F37 governe o novo fluxo
- [ ] 7.5 Desacoplar a copy da entrega: arte e débito mantidos mesmo com falha de copy; estado de falha persistido
- [ ] 7.6 Não expor ação de nova tentativa de copy nesta fatia
- [ ] 7.7 Cobrir com testes: dimensões reais, prefixo/imutabilidade, download direto condicionado a `delivered`, regressão do download legado, copy não bloqueante sem retry

## 8. Instrumentação e diagnóstico operacionais

- [ ] 8.1 Emitir um envelope por tentativa real (modelo, qualidade, alvo, tentativa, run/trace, resultado)
- [ ] 8.2 Resolver custo por par modelo–qualidade por tentativa, preservando a contabilidade legada
- [ ] 8.3 Produzir `IMG-001` + referência opaca e persistir o diagnóstico durável por falha operacional
- [ ] 8.4 Expor a correlação referência → diagnóstico no admin/suporte
- [ ] 8.5 Cobrir com testes: envelope por tentativa, custo por par, não revelação, correlação durável, legado intacto

## 9. Verificação transacional e checkpoint

- [ ] 9.1 Verificar não regressão do legado com o novo fluxo desligado (fronteira produtiva vazia nos caminhos legados)
- [ ] 9.2 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)
- [ ] 9.3 Rodar os gates transacionais na instância isolada (máquina de estados, snapshot, append-only, rastreamento)
- [ ] 9.4 Confirmar ausência de `db push`/alteração de produção e separar o fechamento local da etapa remota autorizada
- [ ] 9.5 Rodar `openspec validate --strict` e registrar a verificação da fatia
- [ ] 9.6 Submeter a F56.2b1 à revisão humana; confirmar que a F56.2b2 e a F56.3 não foram antecipadas
