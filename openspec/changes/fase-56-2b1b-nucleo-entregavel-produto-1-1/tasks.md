# Tasks — F56.2b1b Núcleo entregável

> Dependência obrigatória: b1a fechada/verificada separadamente, inclusive gate de isolamento/schema aprovado. Flags e autorização continuam `off`; nenhuma loja habilitada.

## 1. Formulário e roteamento
- [ ] 1.1 Obter elegibilidade server-side; montar/exibir seletores apenas para flag aplicável + autorização
- [ ] 1.2 Em `off`, omitir seletores/campos e preservar payload legado
- [ ] 1.3 Revalidar no POST e recusar payload exclusivo após revogação/leitura inválida, antes de crédito
- [ ] 1.4 Integrar roteamento novo sem conceder autorização ou habilitar lojas
- [ ] 1.5 Validar seleções server-side, Original com exatamente uma imagem de produto e erros de campo
- [ ] 1.6 Testar elegibilidade, UI, transporte, revogação entre renderização/POST e não regressão do legado

## 2. Geração, snapshot e histórico
- [ ] 2.1 Persistir snapshot imutável antes de reserva/provider; bloquear se falhar
- [ ] 2.2 Registrar cada tentativa append-only, preservando run/trace
- [ ] 2.3 Resolver configuração fail-closed e exigir pricing completo de principal/fallback
- [ ] 2.4 Executar política 2+1, rate_limit transitório, fallback conforme política e quota/billing sem fallback
- [ ] 2.5 Não invocar revisor automático; testar política sem provider real

## 3. Reserva, arte e download
- [ ] 3.1 Integrar RPC atômica da b1a: reserva temporária após preflight, consumo final em delivered, devolução em refunded
- [ ] 3.2 Persistir arte 1024×1024 real, caminho imutável e dimensões corretas
- [ ] 3.3 Liberar novo download somente com objeto íntegro e estado delivered
- [ ] 3.4 Preservar download de campanhas legadas e independência da F37
- [ ] 3.5 Provar interrupção/upload antes de delivered não libera download e reconciliação resolve sem cobrança indevida

## 4. Copy e instrumentação
- [ ] 4.1 Persistir estado de falha da copy sem bloquear arte entregue; não adicionar retry
- [ ] 4.2 Emitir envelope e custo por tentativa, preservando contabilidade legada
- [ ] 4.3 Produzir IMG-001 + referência opaca e diagnóstico durável sanitizado/correlacionável
- [ ] 4.4 Testar copy não bloqueante, telemetria, custo, suporte e legado

## 5. Validação e fechamento
- [ ] 5.1 Typecheck, lint, build e testes sem chamada paga
- [ ] 5.2 Confirmar flags/autorização off, nenhuma loja habilitada e sem db push/deploy
- [ ] 5.3 Validar OpenSpec estrito e matriz de rastreabilidade
- [ ] 5.4 Revisão humana separada da b1b; não antecipar b2/F56.3
