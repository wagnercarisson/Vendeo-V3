# Tasks — F56.2b2 Copy recuperável e piloto controlado

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit ou deploy antes da aprovação do responsável. O piloto exige autorização humana específica, pricing completo e loja de teste.

> **Dependência:** esta fatia depende da **F56.2b1b** (núcleo ponta a ponta) e, transitivamente, da F56.2b1a e F56.2a.

## 1. Preparação e dependência

- [ ] 1.1 Confirmar por escrito a dependência da F56.2b1b e o mapeamento a/b1a/b1b/b2
- [ ] 1.2 Confirmar a instância Supabase descartável isolada e registrar sua identidade

## 2. Ação de nova tentativa de copy

- [ ] 2.1 Expor a ação "Tentar gerar copy novamente" somente no estado pendente/falha da copy
- [ ] 2.2 Implementar a rota/handler da ação com autenticação e verificação de ownership
- [ ] 2.3 Garantir que a ação tenta somente os textos, sem alterar/regerar a imagem
- [ ] 2.4 Garantir que a ação não consome crédito adicional e mantém o débito da campanha
- [ ] 2.5 Exibir o botão condicional na UI conforme `openspec/design-system/MASTER.md`

## 3. Segurança, custo e anti-repetição

- [ ] 3.1 Implementar proteção contra cliques duplicados e repetição abusiva (idempotência/estado por operação de copy)
- [ ] 3.2 Registrar o custo interno da chamada sem convertê-lo em crédito do lojista
- [ ] 3.3 Cobrir com testes: ação condicional; auth/ownership; somente textos; sem novo crédito; clique duplo; custo interno

## 4. Testes integrados/E2E

- [ ] 4.1 Cobrir o fluxo completo (core da F56.2b1a + b1b + ação de copy) com testes integrados/E2E locais, sem chamada paga
- [ ] 4.2 Cobrir sucesso da nova tentativa, falha persistente, ausência de ownership e clique duplicado
- [ ] 4.3 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)

## 5. Piloto controlado e gate de lojas de teste

- [ ] 5.1 Verificar autorização independente server-side do estágio `piloto isolado`, além de autorização humana específica, ambiente isolado e pricing completo; flags isoladas não bastam
- [ ] 5.2 Executar o piloto controlado no ambiente isolado autorizado (antes de migration remota/deploy) e registrar evidências (sem abertura geral)
- [ ] 5.3 Somente após validar e registrar o piloto, avaliar e conceder (mediante autorização independente e autorização humana) o estágio `lojas de teste`
- [ ] 5.4 Separar o fechamento local da migration remota, deploy e abertura geral

## 6. Checkpoint final

- [ ] 6.1 Rodar `openspec validate --strict` e registrar a verificação da fatia
- [ ] 6.2 Submeter a F56.2b2 à revisão humana; confirmar que a F56.3 não foi antecipada
- [ ] 6.3 Atualizar o tracking com o resultado, sem iniciar GSD
