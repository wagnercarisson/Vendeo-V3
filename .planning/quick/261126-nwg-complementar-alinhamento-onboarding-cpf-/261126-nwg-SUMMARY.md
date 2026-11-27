---
quick_id: 261126-nwg
date: 2026-11-26
status: complete
scope: documentation-only
---

# Decisões adicionais registradas

Atualizado `docs/alinhamento-onboarding-responsavel-cnpj-opcional.md` conforme aceite do usuário:

- Toda troca de CPF salvo exige modal e novo aceite; cancelar mantém os dados anteriores e confirmar persiste alteração/aceite consistentemente.
- Navegação com botão Salvar e salvamento ao avançar, validação, tratamento de falha e respeito à primeira dependência pendente. Voltar não pode descartar edições silenciosamente.
- Oferta inicial de 28 dias e até 20 créditos, em parcelas de 5 nos dias 0/7/14/21. Redução e painel do Admin são futuros.
- Base de oferta/versão/configuração vigente e concessão com condições adquiridas preservadas. Parcelas, vencimento e telas do beneficiário usam a concessão; divulgação e novas concessões usam a vigente.
- Versão nova não reinicia elegibilidade por conta/CPF; desativar adesões não cancela benefícios concedidos.
- Subfatias 2A (ofertas) e 2B (responsável), com dependências, entrega e fechamento; fatia 4 integra os consumidores da oferta. Usuários existentes permanecem na fatia 9.
- Pendências da fatia 1 reconciliadas, sem marcar campos pessoais ainda em discussão como aprovados.

Verificação: leitura crítica, 19 links locais resolvidos, nove fatias principais e duas subfatias, whitespace dos arquivos novos/editados e `git diff --check`. Sem testes de aplicação por se tratar exclusivamente de documentação.

Alterações locais, sem commit, push, merge, banco, migration, deploy ou ativação. Commit do workflow não executado. Tracking pontual em STATE; ROADMAP e progresso das fases preservados.
