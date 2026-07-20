# Roteiro de UAT — 8 Cenários Mínimos

**Versão:** 1.0
**Pool:** 3-5 lojistas

## Cenário 1: Cadastro/Onboarding

**Setup:** Lojista convidado via admin, recebe link de acesso
**Passos:**
1. Lojista acessa o link de convite
2. Completa cadastro (email + senha)
3. Cria loja (nome, segmento)
4. Verifica saldo: 5 créditos concedidos
5. Verifica extrato: transação `grant` aparece
**Resultado esperado:** ✅ Loja criada, 5 créditos, extrato correto

## Cenário 2: Admin concede créditos

**Setup:** Admin logado no painel administrativo
**Passos:**
1. Admin acessa `/admin/users`
2. Localiza lojista
3. Concede 10 créditos com motivo "Teste UAT"
4. Lojista verifica saldo aumentou em 10
5. Lojista verifica extrato mostra transação de grant
**Resultado esperado:** ✅ Saldo reflete, extrato mostra concessão

## Cenário 3: Geração bem-sucedida

**Setup:** Lojista com saldo >= 1, produto e imagem disponíveis
**Passos:**
1. Lojista acessa `/campanhas/nova`
2. Preenche nome do produto, preço, badge
3. Faz upload de imagem
4. Clica "Criar campanha"
5. Aguarda geração
6. Verifica campanha criada em `/campanhas`
7. Verifica saldo decrementou 1
8. Verifica extrato mostra transação `deduction`
**Resultado esperado:** ✅ Campanha gerada, saldo -1, extrato correto

## Cenário 4: Geração com erro (simulado)

**Setup:** Lojista com saldo >= 1, usar imagem inválida ou produto conflitante
**Passos:**
1. Tenta gerar campanha com dados inválidos
2. Verifica mensagem de erro
3. Verifica saldo restaurado (estorno automático)
4. Verifica extrato mostra `refund`
**Resultado esperado:** ✅ Erro tratado, saldo restaurado, extrato correto

## Cenário 5: Saldo consistente

**Setup:** Lojista com saldo conhecido
**Passos:**
1. Verificar saldo na topbar
2. Verificar saldo no dashboard
3. Verificar saldo em `/conta`
4. Verificar saldo em `/campanhas/nova`
**Resultado esperado:** ✅ Saldo igual em todas as superfícies

## Cenário 6: Extrato correto

**Setup:** Lojista com histórico de transações
**Passos:**
1. Acessar `/conta`
2. Verificar tipos: grant, deduction, refund
3. Verificar valores corretos (sinais +/-)
4. Verificar saldo before/after consistente
5. Verificar datas em formato PT-BR
**Resultado esperado:** ✅ Tipos, valores, saldo, datas corretos

## Cenário 7: Admin visualiza erro

**Setup:** Admin logado, existe campanha com erro no sistema
**Passos:**
1. Admin acessa `/admin/campaigns/errors`
2. Ver lista de campanhas com erro
3. Ver produto, loja, erro, data
**Resultado esperado:** ✅ Admin vê campanhas com erro e detalhes

## Cenário 8: Admin visualiza audit log

**Setup:** Admin logado, existem ações registradas
**Passos:**
1. Admin acessa `/admin/audit-log`
2. Ver lista de ações administrativas
3. Ver ator, ação, alvo, motivo, data
4. Testar filtros por ação e tipo de alvo
**Resultado esperado:** ✅ Admin vê histórico com filtros funcionando
