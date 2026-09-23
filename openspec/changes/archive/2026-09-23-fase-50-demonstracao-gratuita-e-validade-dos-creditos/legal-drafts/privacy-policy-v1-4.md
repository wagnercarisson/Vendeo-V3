# Política de Privacidade — v1.4 (minuta de alteração — delta)

> **Status:** minuta de **alteração** (delta sobre a v1.3). **Não é o documento integral pronto para publicação** — as demais cláusulas da v1.3 permanecem inalteradas e devem ser consolidadas na montagem (ver task 10.1). **Não substitui revisão de advogado.**
> **Placeholders permitidos (exclusivamente os marcados com `[ … ]`, idênticos aos Termos v1.5):** `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO FÍSICO]`. Todos **obrigatoriamente preenchidos antes da publicação** — a mesma identidade da PJ da cláusula 12.4 dos Termos.

As demais cláusulas da v1.3 permanecem inalteradas.

## Seção "Controlador e Contato" — substituição da identificação

```text
O controlador dos dados pessoais tratados no âmbito desta Política é [RAZÃO SOCIAL], inscrita no CNPJ nº [CNPJ], com endereço profissional em [ENDEREÇO FÍSICO] e contato eletrônico suporte@vendeo.tech. Dúvidas sobre esta Política ou o exercício dos direitos de titular podem ser encaminhados a esse contato.
```

## Cláusula 3.5 (acrescentada)

```text
3.5. O Vendeo poderá utilizar o endereço de email cadastrado para enviar comunicações estritamente operacionais relacionadas à conta e à execução do Serviço, incluindo concessão, prazo, esgotamento e expiração da Demonstração Gratuita, segurança, alterações contratuais e respostas de suporte. Essas comunicações são distintas das comunicações comerciais previstas na cláusula 3.4 e poderão ser enviadas independentemente do consentimento para marketing, quando necessárias à execução do Serviço, ao cumprimento de obrigação legal ou a outra base legal aplicável.
```

## Cláusula 3.6 (acrescentada — eventos de produto)

```text
3.6. Para operar a Demonstração Gratuita e melhorar o Serviço, o Vendeo registra eventos técnicos e de uso associados à conta e à loja, incluindo: a concessão da Demonstração Gratuita, a primeira geração concluída após a concessão, o esgotamento dos créditos de demonstração, a expiração da demonstração e a solicitação de créditos ao suporte. Esses registros são utilizados para executar o Serviço, controlar a elegibilidade e a validade, prevenir fraude e medir o funcionamento da Plataforma, com base na execução do contrato, no legítimo interesse e, quando aplicável, no cumprimento de obrigação legal, observadas a necessidade e a expectativa do titular.
```

## Cláusula 3.7 (acrescentada — solicitação de acesso e WhatsApp)

```text
3.7. Na solicitação de acesso ao beta, o WhatsApp é informado de forma opcional e utilizado somente para contato sobre a própria solicitação, sem finalidade de marketing e sem vincular a consentimento de comunicações comerciais. O Vendeo exibe aviso de privacidade e registra a versão apresentada. O número de WhatsApp é removido/anonimizado quando termina sua necessidade operacional.
```

## Cláusula 3.8 (acrescentada — papéis de tratamento e fornecedores)

```text
3.8. O Vendeo atua como CONTROLADOR para as finalidades de cadastro, conta, segurança, prevenção a fraude, elegibilidade e operação do produto. Para imagens e demais dados de terceiros enviados pelo lojista, o Vendeo atua como OPERADOR, na forma das instruções deste e sujeito à validação jurídica aplicável.

3.9. O Vendeo utiliza fornecedores de infraestrutura e inteligência artificial: Supabase (banco, autenticação e armazenamento), Vercel (hospedagem), OpenAI (inteligência artificial), Google OAuth (autenticação), Cloudflare (DNS/CDN) e Resend (email transacional). O Google/Gemini é utilizado somente de forma condicional, restrito ao ambiente de laboratório com dados controlados, enquanto não estiver no processamento produtivo, até validação contratual, operacional e de faturamento. O tratamento pode envolver transferência internacional de dados, mediante garantias e salvaguardas aplicáveis.
```

## Seção de retenção — SUBSTITUIR a seção atual de retenção

> A cláusula de retenção da v1.3 é **substituída** (não acrescentada como `4.x` dentro da seção de fornecedores).

```text
[x]. Os dados permanecem armazenados enquanto a conta estiver ativa, ainda que sem saldo ou atividade. No encerramento solicitado, há janela de 30 (trinta) dias para recuperação/exportação; depois, os dados operacionais são excluídos ou anonimizados, ressalvada a conservação mínima legal devidamente segregada. Pedidos de acesso, exportação, correção e exclusão podem ser atendidos pelo suporte com protocolo durante o beta.
```

## Correspondência com a v1.3 (diff)

| Cláusula | v1.3 | v1.4 | Tipo de mudança |
|---|---|---|---|
| Controlador e Contato | "a Plataforma Vendeo" | identificação do fornecedor (**PJ/CNPJ exclusivamente**) | substituída |
| 3.4 | comunicações comerciais (marketing) | inalterada | referência |
| 3.5 | — | comunicações operacionais por email (distintas de marketing, base legal) | acrescentada |
| 3.6 | — | eventos de produto com finalidade e base legal | acrescentada |
| 3.7 | — | solicitação de acesso e WhatsApp opcional (finalidade, descarte, aviso versionado) | acrescentada |
| 3.8/3.9 | — | **papéis duplos** (controlador/operador) + inventário de fornecedores (Gemini condicional/restrito ao lab) | acrescentadas |
| Retenção | "enquanto necessário" | **substituída**: enquanto ativa, encerramento com janela de 30 dias, direitos via suporte | **substituída** |
