## Why

As condições da oferta de teste (28 dias, até 20 créditos, 5 créditos nos dias 0/7/14/21) hoje vivem em SQL e TypeScript. Sem uma versão imutável registrada no momento da concessão, qualquer mudança futura de parâmetros alcançaria também concessões antigas, e o Admin não teria uma base segura para publicar novas condições. A 2A cria o catálogo versionado, a referência vigente e a leitura centralizada **antes** de integrar os consumidores.

## What Changes

- Criar `public.trial_offer_versions` com as condições publicadas e imutáveis: `release_frequency` (`once`, `daily`, `weekly`, `monthly`), `credits_per_release` (obrigatório nas recorrentes e vazio em `once`), `duration_days`, `max_total_credits`, nome público, estado de publicação e registro administrativo.
- **Não** criar tabela filha nem JSON de parcelas. O calendário passa a ser derivado de frequência, créditos por liberação, duração e início da concessão: primeira liberação imediata, seguintes pela frequência e última limitada ao restante do total. A publicação rejeita configurações cujo calendário não alcance `max_total_credits` dentro de `duration_days`.
- Estender `public.trial_offer_settings` com `current_version_id`, apontando apenas para uma versão **publicada do mesmo programa**. `enabled` continua controlando a suspensão de novas adesões.
- Semear a versão inicial: “Teste gratuito de 28 dias”, 28 dias, até 20 créditos, frequência semanal, 5 créditos por liberação, publicada e vigente.
- Garantir no banco: imutabilidade das condições publicadas, validação de publicação, proteção contra publicação concorrente e vedação de referência vigente a rascunho.
- Corrigir forward-only o guard de publicação para `published_by`: rascunho sem publisher; primeira publicação aceita UUID; publicado só permite publisher→NULL; a Migration A já aplicada **não** é editada nem reaplicada — a correção é uma nova Migration C.
- Definir contratos de leitura centralizados: condições internas, projeção pública sem identificadores internos/dados pessoais e derivação de calendário a partir do início da concessão.
- Adicionar módulo TypeScript server-only de leitura, aditivo, sem religar consumidores.
- **BREAKING apenas no desenho futuro:** a integração da concessão passará a referenciar a versão imutável e resolver a vigente no ato da concessão. Isso **não** é implementado nesta subfatia.
- **Fora desta entrega:** backfill de concessões existentes, alteração de `trial_offer_enrollments`, mudança de RPCs de elegibilidade/concessão/parcelas, troca de páginas públicas, painel de edição do Admin e qualquer reserva antecipada de parcelas.

## Capabilities

### New Capabilities

- `trial-offer-catalog`: identidade estável da oferta, versões publicadas e imutáveis com frequência e créditos por liberação, referência vigente, derivação de calendário, contratos de leitura e garantias de publicação/auditoria.

### Modified Capabilities

Nenhuma. O comportamento descrito em `openspec/specs/trial-offer/spec.md` permanece inalterado nesta subfatia: os consumidores atuais continuam usando as constantes existentes até a fatia de integração. A 2A apenas cria o catálogo e seus contratos de leitura.

## Impact

- `supabase/migrations/`: três migrations (estrutura A já aplicada, seed B e correção forward-only C do publisher), aplicadas de forma incremental apenas no homolog local existente (`G:\Vendeo-Homolog`, container `supabase_db_vendeo-homolog`, PostgreSQL `127.0.0.1:57782`, banco `postgres`); produção e bancos remotos fora desta autorização. A migration A `20261126223854` não é editada nem reaplicada.
- `src/lib/credit/trial-offer/`: novo módulo aditivo de leitura; `constants.ts`, `status.ts`, `completion.ts` e `public-offer-copy.ts` intocados.
- `trial_offer_enrollments`, `credit_balances`, `credit_transactions` e `freemium_entitlements`: nenhuma alteração de esquema, dados ou comportamento nesta subfatia.
- Nenhuma mudança de API, UI, Admin, flags ou deploy.
- Nenhuma migração dos usuários reais; a transição de concessões existentes segue para a integração e o roteiro final.
