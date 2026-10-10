# Quick 261010-hye — Padaria da Esquina na bancada

2026-10-10: encontrada correspondencia unica no Supabase exclusivo local: `345508d7-59c6-48b8-adbd-8fdea74a909e`, segmento `padaria-confeitaria-doces`.

Adicionada entrada no manifesto `fixtures/lab/bench/stores.json`; Adega e NovaTek preservadas. A elegibilidade da bancada e a intersecao manifesto/banco local, nao a flag `is_test_store`. A flag local da Padaria permanece false, sem escrita em banco; nao executar importacao remota.

JSON/IDs unicos aprovados, `git diff --check` limpo, testes de manifesto 9/9 verdes. Nenhuma chamada paga, geracao, reinicio, alteracao de identidade ou acesso a producao. Usuario deve atualizar a bancada; selecao visual permanece humana.

Rollback: remover somente entrada da Padaria no manifesto.
