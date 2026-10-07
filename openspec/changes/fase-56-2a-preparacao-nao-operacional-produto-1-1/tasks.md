# Tasks — F56.2a Preparação não operacional do Produto 1:1

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit ou deploy antes da aprovação do responsável. A chave **não** deve encaminhar campanhas reais nesta fatia.

> **Validação isolada.** Resets/migrações/testes SHALL rodar apenas em instância Supabase descartável comprovadamente isolada.

## 1. Preparação

- [ ] 1.1 Confirmar por escrito o recorte F56.2a/F56.2b1/F56.2b2 e o mapeamento de requisitos da reconciliação
- [ ] 1.2 Fechar as decisões abertas da fatia (nomes das chaves, natureza dos componentes de seleção)
- [ ] 1.3 Confirmar a instância Supabase descartável isolada e registrar sua identidade
- [ ] 1.4 Registrar a baseline de equivalência (casos representativos da bancada F48.2.6)

## 2. Chaves e decisão server-side (inativas)

- [ ] 2.1 Registrar as duas chaves em `feature_flags` desligadas por padrão, sem interface de ativação
- [ ] 2.2 Implementar a função pura/server-side de decisão com precedência da chave geral e fail-closed
- [ ] 2.3 Cobrir com testes: desligado → legado; lojas de teste; chave geral; falha de leitura → legado; precedência
- [ ] 2.4 Testar que nenhum parâmetro do cliente força o novo fluxo
- [ ] 2.5 Testar a barreira de não-ativação: chave ligada não encaminha campanhas reais nesta fatia

## 3. Contratos e componentes de seleção (inativos)

- [ ] 3.1 Implementar o domínio de seleção explícita de intenção (Oferta/Destaque/Exclusivo)
- [ ] 3.2 Implementar contratos/componentes de direção de fundo (Estúdio/Ambientado/Original)
- [ ] 3.3 Implementar a regra de "Manter cenário original" exigindo exatamente uma imagem de produto, excluindo identidade
- [ ] 3.4 Garantir erro de campo para seleções inválidas (nunca `IMG-001`)
- [ ] 3.5 Cobrir com testes de domínio/componente: intenção, fundo, Original aceito/rejeitado, identidade não conta
- [ ] 3.6 Garantir que os componentes não são montados no fluxo produtivo do lojista (teste de não-exposição)

## 4. Módulo produtivo de composição versionada

- [ ] 4.1 Implementar o módulo produtivo que incorpora Produto v4/compositor v5 e as três intenções, com versões fixadas
- [ ] 4.2 Garantir nome completo, fidelidade, hierarquia protagonista/auxiliares, identidade fiel, textos obrigatórios uma única vez, matriz comercial por intenção e fundo escolhido
- [ ] 4.3 Impedir leitura de configuração mutável da bancada em runtime e troca silenciosa da intenção
- [ ] 4.4 Expor `composerVersion`, `promptBaseVersion` e `policyVersions` para registro no snapshot
- [ ] 4.5 Cobrir com testes de equivalência contra a bancada aprovada nos casos representativos
- [ ] 4.6 Confirmar que as políticas da bancada permanecem inalteradas e não são dependência de runtime

## 5. Estruturas de snapshot e histórico append-only

- [ ] 5.1 Criar a relação append-only de operações/tentativas vinculada à campanha e a um snapshot original pertencente à mesma campanha; rejeitar associação cruzada de IDs existentes
- [ ] 5.2 Implementar/validar o contrato de reuso do snapshot original (sem implementar a F56.3)
- [ ] 5.3 Garantir que o run/trace histórico do snapshot único não é sobrescrito
- [ ] 5.4 Cobrir com testes estruturais: append-only, pertencimento campanha-snapshot, FKs independentes, não sobrescrita, correlação por tentativa; incluir na integração real da seção 6 a rejeição de dois IDs válidos de campanhas diferentes

## 6. Verificação e checkpoint

- [ ] 6.1 Verificar não regressão do legado (fronteira produtiva vazia nos caminhos legados)
- [ ] 6.2 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)
- [ ] 6.3 Rodar UAT local sem provider na instância isolada; confirmar não-ativação
- [ ] 6.4 Rodar `openspec validate --strict` e registrar a verificação da fatia
- [ ] 6.5 Confirmar ausência de `db push`/alteração de produção e separar o fechamento local da etapa remota autorizada
- [ ] 6.6 Atualizar o tracking com o resultado e o checkpoint humano, sem iniciar GSD
