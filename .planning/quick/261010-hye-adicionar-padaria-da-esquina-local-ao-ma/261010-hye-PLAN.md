# Quick 261010-hye — adicionar Padaria da Esquina a bancada

Pedido humano: localizar a loja pelo nome e agregar a bancada.

1. Consultar somente o Supabase exclusivo do laboratorio (API 57321/DB 57322), sem chaves expostas.
2. Exigir correspondencia unica pelo nome. Adicionar somente ID/label/notas ao manifesto `fixtures/lab/bench/stores.json`, preservando lojas existentes.
3. Validar JSON, IDs unicos e contrato do manifesto. Sem alteracao em banco, producao, identidade, prompts ou chamadas pagas.

Aceite: Padaria local presente na allowlist; nenhuma geracao feita pelo agente. Rollback: remover somente a entrada adicionada.
