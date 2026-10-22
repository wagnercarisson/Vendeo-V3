## Why

O CNPJ alfanumérico já é emitido pela Receita Federal para novas inscrições (IN RFB nº 2.229/2024) e o Vendeo ainda assume 14 dígitos numéricos em normalização, validação, máscara, persistência, cache e integrações. Sem essa compatibilidade, novos lojistas com CNPJ alfanumérico não conseguem concluir o cadastro fiscal.

## What Changes

- Centralizar a representação canônica do CNPJ: 14 caracteres, posições 1–12 `[A-Z0-9]`, posições 13–14 `[0-9]`, letras sempre em maiúscula e pontuação removida sem descartar letras válidas.
- Implementar o cálculo oficial dos dois dígitos verificadores (módulo 11, valor do caractere = ASCII − 48, mesmos pesos do CNPJ numérico) para os formatos numérico e alfanumérico.
- Atualizar a máscara de exibição `XX.XXX.XXX/XXXX-DV`, inputs, colagem, edição e apresentação para preservar letras.
- Atualizar schemas, contratos de API e validações Zod para aceitar o formato canônico alfanumérico.
- Atualizar a constraint atômica do PostgreSQL (`chk_stores_cnpj_atomic`) e comentários de colunas para `[A-Z0-9]{12}[0-9]{2}`, preservando os registros numéricos existentes.
- Manter a unicidade global de `stores.cnpj_normalized`, a atomicidade entre CNPJ/raiz/dados oficiais/status e a canonicalização antes de `cnpj_root_hash`.
- Manter a chave do cache cadastral em CNPJ canônico, de modo que caixa e pontuação não gerem entradas duplicadas.
- Verificar o contrato da BrasilAPI para CNPJ alfanumérico e definir fallback seguro e fail-closed quando um provedor não reconhecer o formato, sem ativar provedores pagos.
- Incluir vetores oficiais da Receita (positivos e negativos) e regressão completa para CNPJs numéricos já cadastrados.
- Registrar a limitação do uso histórico de `substring(cnpj_normalized, 9, 4) = '0001'` como dependência de revisão futura, sem alterar a política atual.

Não há mudança de política comercial, ownership, freemium, trial de 28 dias, créditos ou modelo institucional.

## Capabilities

### New Capabilities

Nenhuma capability nova. A compatibilidade é uma evolução das capabilities de CNPJ já existentes.

### Modified Capabilities

- `cnpj-validation`: normalização, validação oficial de DV, máscara e hash passam a suportar o formato alfanumérico canônico.
- `cnpj-lookup-provider`: contrato dos provedores passa a distinguir formato não suportado de indisponibilidade e a chave de cache passa a usar o CNPJ canônico alfanumérico.
- `cnpj-verification-service`: orquestração propaga o resultado “formato não suportado” e aplica fallback seguro sem cachear falso `not_found`.
- `cnpj-lookup-api`: endpoint de consulta aceita CNPJ alfanumérico e retorna erro controlado quando o formato não é suportado pelos provedores.
- `legacy-store-cnpj-update`: RPC e formulário de atualização cadastral aceitam CNPJ alfanumérico, preservando atomicidade e ausência de concessão de créditos.
- `store-identity-foundation`: criação de loja, schema do banco e constraint atômica aceitam CNPJ alfanumérico sem transformar CNPJs numéricos existentes.
- `admin-cnpj-display`: mascaramento passa a preservar o sufixo de 4 caracteres alfanuméricos sem expor a raiz.

## Impact

**Código e contratos**
- `src/lib/cnpj/{normalize,validate,mask,hash,types,verification-service}.ts` e `lookup-providers/*`.
- `src/app/api/{store,store/update-cnpj,store/[id],store/[id]/reconsult-cnpj,cnpj/lookup,admin/stores/create-test}/route.ts`.
- Schemas Zod de criação/atualização e validações locais de formulário.
- `src/components/flow/store-identity-form.tsx`, `src/components/flow/use-store-form.ts`, `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx` e tela admin de loja de teste.
- Exibição mascarada em admin e respostas de API com `cnpj_masked`.

**Banco de dados**
- Nova migration corretiva da constraint `chk_stores_cnpj_atomic` e comentários de `stores.cnpj_normalized` e `cnpj_lookup_cache.cnpj_normalized`.
- Sem alteração de `stores.user_id`, RLS, `freemium_entitlements`, trial de 28 dias ou valores/saldos.
- Índices existentes (`idx_stores_cnpj_normalized`, `idx_stores_cnpj_root_hash`, PK de `cnpj_lookup_cache`) são preservados; nenhuma reescrita de CNPJ numérico.

**Integrações**
- BrasilAPI e CNPJá: contrato verificado por teste; fallback seguro quando o provedor rejeitar o formato. Nenhuma flag, provedor pago ou ambiente de produção é alterado.

**Fora de escopo**
- Oferta individualizada por CNPJ completo (F50.4), mudança de elegibilidade comercial, reativação do freemium legado, organizações/matriz-filial, migração de ownership, cobrança institucional, deploy ou aplicação remota.
