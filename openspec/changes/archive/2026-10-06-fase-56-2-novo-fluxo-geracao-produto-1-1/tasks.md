# Tasks — F56.2 Novo fluxo de geração Produto 1:1

> **Checkpoint humano obrigatório antes da implementação.** Nenhuma task de código, migration, `db push`, chamada paga, commit ou deploy deve ser executada antes da aprovação explícita do responsável sobre as decisões técnicas abertas do `design.md`, o recorte de planos (F2-D11) e a primeira geração paga controlada em loja de teste.

> **Fronteiras.** A F56.2 entrega a geração real e a entrega direta (sem aprovação/reprovação e sem revisor automático). Aprovação, reprovação e correções pertencem à F56.3. O fluxo legado permanece intocado e é o default enquanto as chaves estiverem desligadas.

> **Validação isolada.** Resets/migrações/testes transacionais SHALL rodar apenas em instância Supabase descartável comprovadamente isolada, preservando a stack compartilhada e as evidências F48/F56.1. Sem instância isolada, o executor para antes de qualquer reset.

## 1. Preparação e checkpoint

- [ ] 1.1 Confirmar por escrito o recorte de planos (F56.2a/F56.2b, se aplicável) antes de planejar (F2-D11)
- [ ] 1.2 Fechar as decisões técnicas abertas do `design.md` (precedência das chaves, local do runtime de composição, persistência do vínculo por tentativa, modelagem reserva↔entrega↔estorno, bucket/prefixo, mecanismo das chaves)
- [ ] 1.3 Confirmar a instância Supabase descartável isolada e registrar sua identidade

## 2. Chaves de ativação e roteamento server-side

- [ ] 2.1 Criar as duas chaves de ativação (lojas de teste / todas as lojas) desligadas por padrão, com caminho de gravação auditável (autor, motivo, `operation_id`)
- [ ] 2.2 Implementar a leitura server-side fail-closed das chaves e a decisão de roteamento por loja (`is_test_store`) com precedência determinística
- [ ] 2.3 Cobrir com testes: chaves desligadas → legado; lojas de teste; chave geral; falha de leitura → legado; precedência
- [ ] 2.4 Garantir que o parâmetro do cliente não força o novo fluxo (teste de contrato)
- [ ] 2.5 Testar rollback: desligar chave impede novas campanhas no fluxo novo e não migra campanhas existentes

## 3. Seleção de intenção e fundo no formulário

- [ ] 3.1 Adicionar ao formulário de Produto a seleção explícita de intenção (Oferta/Destaque/Exclusivo) sem inferência silenciosa
- [ ] 3.2 Adicionar a seleção explícita de direção de fundo (Estúdio/Ambientado/Original) com labels conforme `openspec/design-system/MASTER.md`
- [ ] 3.3 Implementar a regra de "Manter cenário original" exigindo exatamente uma imagem de produto, excluindo a imagem de identidade
- [ ] 3.4 Validar as seleções no servidor como erro de campo (nunca `IMG-001`)
- [ ] 3.5 Cobrir com testes de UI e servidor: intenção respeitada, fundo aplicado, Original aceito/rejeitado, identidade não conta

## 4. Runtime de composição de prompt do novo fluxo

- [ ] 4.1 Incorporar (extrair ou portar) os prompts/regras Produto v4 + compositor v5 e as três intenções para o runtime do novo fluxo, com versões fixadas
- [ ] 4.2 Garantir nome completo, fidelidade às referências, hierarquia protagonista/auxiliares, identidade fiel, textos obrigatórios uma única vez, matriz comercial por intenção e fundo escolhido
- [ ] 4.3 Impedir leitura de configuração mutável da bancada em tempo de execução e troca silenciosa da intenção
- [ ] 4.4 Registrar `composerVersion`, `promptBaseVersion` e `policyVersions` no snapshot da campanha
- [ ] 4.5 Cobrir com testes de fidelidade ao prompt aprovado e de imutabilidade das versões

## 5. Snapshot e histórico append-only

- [ ] 5.1 Persistir o snapshot no início da operação real (antes de reservar crédito e antes do provider)
- [ ] 5.2 Bloquear a operação quando o snapshot não puder ser persistido
- [ ] 5.3 Implementar o reuso do snapshot original para nova geração/correção da mesma campanha
- [ ] 5.4 Implementar histórico append-only (ou correlação equivalente) por geração/tentativa, sem sobrescrever o run/trace histórico
- [ ] 5.5 Preservar fluxo, briefing, intenção, fundo, referências e par no snapshot/histórico
- [ ] 5.6 Cobrir com testes transacionais na instância isolada: snapshot no início, reuso, não sobrescrita, correlação por tentativa

## 6. Orquestração real, preflight e política de tentativas

- [ ] 6.1 Implementar o preflight de pricing `complete` para principal e fallback antes de reservar crédito/provider
- [ ] 6.2 Construir o gateway isolado (`createNewFlowImageGateway`) com o par resolvido fail-closed
- [ ] 6.3 Executar a política: 2 tentativas no principal + 1 no fallback; `rate_limit` transitório; disponibilidade direto ao fallback; quota/faturamento sem fallback
- [ ] 6.4 Emitir um envelope por tentativa real (modelo, qualidade, alvo, tentativa, run/trace, resultado) e resolver custo por par
- [ ] 6.5 Produzir `IMG-001` + referência opaca e persistir o diagnóstico durável por falha
- [ ] 6.6 Não invocar revisor automático nem gate de aprovação no novo fluxo
- [ ] 6.7 Cobrir com testes (fakes/provider simulados): todas as ramificações da política, custo por tentativa, referência/diagnóstico, teto de 3 chamadas

## 7. Cobrança transacional

- [ ] 7.1 Implementar reserva de um crédito no início, idempotente por `operationId`/campanha
- [ ] 7.2 Implementar a confirmação idempotente na entrega (arte persistida e baixável)
- [ ] 7.3 Implementar o estorno idempotente quando não houver arte utilizável
- [ ] 7.4 Garantir que tentativas e fallback não somam crédito e não são operação separada
- [ ] 7.5 Cobrir com testes transacionais na instância isolada: entrega = 1 crédito, falha sem arte = 0, reenvio idempotente, estorno restaura saldo

## 8. Copy não bloqueante e recuperação

- [ ] 8.1 Desacoplar a copy da entrega: arte pronta e um crédito mantidos mesmo com falha de copy
- [ ] 8.2 Implementar o estado de copy pendente/falha e a ação "Tentar gerar copy novamente" somente nesse estado
- [ ] 8.3 Implementar a ação com autenticação e ownership, tentando apenas os textos e sem alterar/regerar a imagem
- [ ] 8.4 Garantir que a ação não consome outro crédito e é protegida contra cliques duplicados/repetição abusiva
- [ ] 8.5 Registrar o custo interno da chamada de copy
- [ ] 8.6 Cobrir com testes: só copy falha → arte baixável + 1 débito; ação condicional; auth/ownership; sem regeneração; sem novo crédito; clique duplo

## 9. Persistência 1:1 e download

- [ ] 9.1 Persistir a arte em 1:1 com saída 1024×1024, registrando as dimensões reais do arquivo
- [ ] 9.2 Impedir que qualquer registro declare 1080×1080 para arquivo 1024×1024
- [ ] 9.3 Disponibilizar o download direto da arte do novo fluxo, sem aprovação/reprovação
- [ ] 9.4 Preservar as regras de download das campanhas antigas e impedir que a F37 governe o novo fluxo
- [ ] 9.5 Cobrir com testes: dimensões reais, download direto, regressão do download legado

## 10. Verificação isolada, UAT e implantação

- [ ] 10.1 Verificar não regressão do legado (seleção, pipeline, revisor, F37) com o novo fluxo desligado
- [ ] 10.2 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)
- [ ] 10.3 Rodar gates transacionais e UAT local sem provider na instância isolada
- [ ] 10.4 Confirmar ausência de `db push`/alteração de produção e registrar evidências
- [ ] 10.5 Obter autorização humana específica para UAT visual + **uma** geração paga controlada em loja de teste, com pricing completo
- [ ] 10.6 Separar o fechamento local da futura aplicação de migration remota, deploy e abertura da chave geral
- [ ] 10.7 Rodar `openspec validate --strict` e registrar a verificação da fase

## 11. Checkpoint final

- [ ] 11.1 Submeter a F56.2 à revisão humana antes de qualquer ativação geral
- [ ] 11.2 Confirmar que a F56.3 (aprovação/correção) não foi antecipada e que os dados/arquitetura necessários foram preservados
- [ ] 11.3 Atualizar `.planning/STATE.md`/`.planning/ROADMAP.md`/`.planning/REQUIREMENTS.md` com o resultado
