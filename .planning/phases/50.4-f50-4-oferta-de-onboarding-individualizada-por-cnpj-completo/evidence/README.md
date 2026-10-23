# Evidência durável — Plano 50.4-12

**Data de versionamento:** 2026-10-23
**Origem:** diretório temporário da execução do Plano 12 (já destruído). O caminho absoluto
não é reproduzido neste README por política; os arquivos abaixo são a cópia durável e
versionada daquele diretório.

## Arquivos

| Arquivo | Bytes | SHA-256 |
|---|---:|---|
| `50.4-12-concurrency-evidence.json` | 3794 | `657b340674c221dcf9fd22b00487ed2848d8a5fcf099e3547c3a21bdead6f1ca` |
| `50.4-12-db-evidence.json` | 7231 | `09435659183ed3b982e051227026376cfd409045a728f780da0bff31100da675` |
| `50.4-12-db-verification.txt` | 8638 | `beadb14a062f25ce33294e8d362bf9c2617e3ec5ba7e00a256bae0d97a47fe60` |
| `50.4-12-sql-default.txt` | 782 | `d9bee082f4e10db0584cab5522c0a76669964564d5e8ecdc004f07d7aab2126d` |
| `50.4-12-sql-explicit.txt` | 692 | `d209d7c6b681bf4c693d5aee2cf329e0a4375eb7bd391f04cb2caf18716d4add` |

Os cinco arquivos foram copiados byte a byte (nenhuma redação aplicada) e cada SHA-256 foi
conferido contra a tabela de origem.

## Varredura de segredos

Executada com script Node fora do repositório, sobre os cinco arquivos, com os padrões:

- URL de conexão `postgres(ql)?://`
- `password`, `senha`, `passwd`
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `service_role_key`
- JWT `eyJ[A-Za-z0-9_-]{10,}`
- chave privada `BEGIN .* PRIVATE KEY`
- HTML bruto `<!DOCTYPE|<html|<script`
- CNPJ formatado `\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}`
- `root_hash` e SHA de 64 hexadecimais

**Resultado: 0 achados reais.**

Falsos positivos classificados e não redigidos:

- **Versões de migration (14 dígitos):** ocorrem no array `ledger.versions` de
  `50.4-12-db-evidence.json` (por exemplo, `20261023000001`), não são CNPJs. Nenhuma
  ocorrência de 14 dígitos foi encontrada fora desse contexto.
- **`root_hash`:** aparece apenas como nome de coluna dentro de `indexdef` de índices
  (`uq_trial_offer_enrollments_root_legacy`), não como valor de hash.
- **Fingerprint de schema:** `2a299f49332bbef9b567e83ed95f0cab` é fingerprint (32 hex) e
  não é segredo. Nenhum SHA-256 de 64 hex foi encontrado nos arquivos.

## Resultados preservados

Os números de execução **não foram alterados** por esta reconciliação: verificador
**69/69**, SQL explícito **4/4**, regressão SQL **5/5**, concorrência **14/14** (0 deadlocks),
ledger **143** migrations. O ambiente descartável foi destruído durante o Plano 12.

> **Aviso:** não reconectar, recriar ou reaplicar migrations. O ambiente descartável não
> existe mais; esta evidência é o registro durável e somente-leitura.
