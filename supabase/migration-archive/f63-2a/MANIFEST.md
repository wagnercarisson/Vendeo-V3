# F63/2A — Arquivo histórico de migrations

Arquivos históricos das migrations A/B/C/D da F63/2A. Não devem ser aplicados em ambiente novo, produção ou reset local. D foi preparada e nunca aplicada; o comentário final está no arquivo consolidado.

| Label | Versão | Nome | SHA-256 | Status | Estágio |
|---|---|---|---|---|---|
| A | 20261126223854 | offer_catalog_versions | `ed652a26fc9294cdc239a842c2aebb00ccc1a182ff39e9dae13def947f8329bc` | applied | post-a |
| B | 20261126230735 | offer_catalog_seed_v1 | `e511295e7b7419431f05b9a112258afd3c3651de23ecd85d384ee9d26115c4b7` | applied | post-b |
| C | 20261126231022 | offer_catalog_published_by_fix | `817cbd8a946ac3ee4f1d3e8080cdba175866d9be44bdde6b83f03eb1cd1d549c` | applied | post-c |
| D | 20261127004704 | f63_trial_offer_versions_guard_comment | `ec12d10f7d4742d0f59608b5b408e5ba9bc0cfe47c0e81e74a48a311d6c5b833` | prepared_never_applied | — |

**Substituídas por:** `20261127162602/offer_catalog_consolidated_install` — SHA-256 `77421cced85a8f92d3eba16cafae2924d941072c7c3e90e074676a0505847acc`.

Estes arquivos não são executáveis pelo Supabase CLI e não devem ser aplicados em ambiente novo, produção ou reset local.
