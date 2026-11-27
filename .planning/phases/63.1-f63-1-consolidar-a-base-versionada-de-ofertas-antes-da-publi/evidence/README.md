# Evidências da Fase 63.1

Esta pasta contém as evidências novas da consolidação da base versionada de ofertas.

## Padrão

- `63.1-NN-*` — evidências do plano `63.1-NN`.
- Evidências históricas da F63/2A permanecem em `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/` e **não** são sobrescritas.
- JSONs de preflight são somente leitura (`read_only: true`) e registram `verdict: GO` ou `NO-GO`.

## Regras

- Não imprimir URL de conexão, senha, JWT, token ou valor de variável de ambiente.
- Não usar estas evidências como autorização de produção.
- Divergência de identidade, ledger, baseline, labels ou dependências resulta em `NO-GO` e interrupção; nenhum critério é flexibilizado.
- O timestamp registrado no plano 63.1-01 é candidato de preflight e deve ser gerado novamente no 63.1-02, no momento efetivo da criação da migration.
- `post-d` é não carregado no harness novo; D permanece apenas como preparação supersedida, sem evidência de execução.
- A proteção deste ambiente é de homolog local; ela não equivale a autorização de produção.
