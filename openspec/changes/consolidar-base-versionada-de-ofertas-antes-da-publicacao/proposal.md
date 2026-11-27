## Why

A F63/2A foi validada no homolog por três migrations incrementais (A/B/C), uma delas contendo um guard defeituoso corrigido depois por C, e uma quarta migration (D, comentário) ainda não aplicada. Produção não recebeu nenhum objeto da F63. Instalar A/B/C/D em produção propagaria um histórico desnecessariamente frágil e obrigaria a produção a passar por estados intermediários já conhecidos como defeituosos.

Antes da primeira publicação, é necessário transformar o trabalho funcional já aprovado em um único pacote de instalação do estado final corrigido e provar, no homolog existente, que esse mesmo arquivo instala corretamente a partir da base anterior à F63. Esta change prepara essa consolidação; não implementa, não aplica e não publica.

## What Changes

- Substituir a sequência A/B/C/D por **uma única migration de instalação consolidada** contendo estrutura, constraints, funções, guard corrigido, comentário final, RLS/grants, oferta inicial v1 e vigência `NOT NULL`.
- Fazer a migration consolidada **falhar fechado** se qualquer objeto da F63 já existir, para impedir dupla aplicação ou instalação sobre estado parcial; ela não depende de A/B/C/D e não contém limpeza de homolog nem exclusão de ledger.
- Reconciliar **somente o homolog exclusivo**: remover estruturalmente os objetos e dados próprios da F63, apagar exatamente as três entradas de ledger de A/B/C por `(version, name)` e comprovar o retorno ao baseline pré-F63 antes de instalar o arquivo consolidado. Sem reset, banco novo, `CASCADE` amplo ou alteração de dados anteriores.
- Preservar o SQL original, os hashes e as evidências de A/B/C e da D preparada, movendo os arquivos para um diretório **não executável** com manifesto de substituição. Não reescrever a change arquivada.
- Atualizar os artefatos de validação da F63 para o novo artefato: stages, hashes, expectativas de ledger, testes e referências. Manter intacto o trabalho útil da quick `261126-u83` (guarda estrito e lint TypeScript).
- Registrar a divergência pré-existente de produção (`20261030185658_f50_legal_publication` ausente no homolog) como gate separado de compatibilidade, sem corrigi-la nesta change e sem usar igualdade de contagem de ledger como prova de paridade.
- Definir os gates de promoção futura: o **mesmo arquivo** validado no homolog é o candidato à produção; conferência de compatibilidade, ledger, permissões, aplicação e smoke permanecem etapas separadas e não autorizadas aqui.

## Capabilities

### New Capabilities

Nenhuma. Não há nova capacidade funcional, novo consumidor ou nova regra comercial.

### Modified Capabilities

- `trial-offer-catalog`: acrescenta garantias técnicas de instalação consolidada, reconciliação exclusiva do homolog, preservação dos contratos existentes, rastreabilidade histórica e promoção do mesmo artefato. As 12 requirements funcionais da 2A permanecem inalteradas e não são duplicadas.

## Impact

- `supabase/migrations/`: uma nova migration consolidada; remoção dos quatro arquivos históricos do diretório executável (A/B/C já aplicados no homolog; D preparada e nunca aplicada).
- Novo diretório histórico não executável com os quatro SQLs preservados byte a byte e manifesto de versões/hashes/evidências.
- `scripts/f63/`: extensão do aplicador/relatório para o novo stage e para o procedimento de reconciliação; reutilização de `homolog-identity.mjs`.
- `src/lib/credit/__tests__/f63-*.postgres.test.ts` e scripts de teste: atualização de expectativa de ledger, stages e referências antigas; nenhuma camada de compatibilidade desnecessária.
- `.planning/phases/63-.../evidence/` e `.planning/quick/261126-u83-.../`: novas evidências separadas das históricas; evidências antigas preservadas.
- `openspec/specs/trial-offer-catalog/spec.md` e change arquivada: spec funcional reutilizada; change arquivada não é editada.
- **Não altera**: `trial_offer_enrollments`, `credit_balances`, `credit_transactions`, `freemium_entitlements`, consumidores, RPCs de elegibilidade/concessão/parcelas, Admin, flags, copy pública, backfill ou regras comerciais.
- **Produção permanece fora de autorização** nesta change. Nenhum acesso remoto, DDL/DML, commit, push, merge ou deploy faz parte desta etapa.
