# Vendeo V3

## What This Is

O Vendeo é um motor SaaS de geração de campanhas para lojistas de lojas físicas. O produto transforma informações simples da loja (produto, oferta, preço) em campanhas profissionais para redes sociais, combinando inteligência artificial comercial com renderização programática. O lojista informa o essencial, e o Vendeo entrega uma peça visual pronta para publicar — sem precisar aprender design, copywriting ou marketing.

## Core Value

Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais. Se tudo mais falhar, o Vendeo precisa ser capaz de transformar uma oferta simples em uma peça visual comercial, clara e publicável.

## Product and Users

O público principal são pequenos e médios lojistas físicos que acumulam funções operacionais, comerciais e administrativas e não têm tempo, criatividade ou recursos para design profissional.

A proposta de valor é reduzir o trabalho entre uma oferta comercial e uma campanha publicável: o lojista fornece produto, preço, oferta, contexto da loja e referências visuais; o Vendeo interpreta o briefing, produz copy e direção visual, aplica a identidade da loja e entrega uma arte revisável e exportável.

## Current State

- F50 — Demonstração Gratuita e Validade dos Créditos — está concluída.
- Não há fase ativa nem execução OpenSpec ativa.
- O beta permanece fechado; demonstração pública, e-mail e signup público continuam desativados.
- F50.1 — Formalização Legal e Ativação da Demonstração — é futura, não planejada e condicionada à constituição da PJ. Não é pendência da F50.
- Os documentos legais existem como minutas com placeholders e não estão publicados. Identidade da PJ, validação jurídica, publicação e ativação só podem ocorrer após a constituição da PJ.
- Não há requisitos de implementação ativos neste momento.
- Stripe e monetização pública estão diferidos para v1.7 ou posterior, fora da numeração de fases.

## Current Capabilities

- Aplicação SaaS multi-tenant com autenticação Supabase, sessão SSR, vínculo usuário-loja e isolamento de propriedade por RLS.
- Onboarding de loja, identidade visual, upload de logo e referências, análise de marca e aplicação de tokens de identidade.
- Brief guiado de produto e oferta, incluindo preço em BRL, validade da oferta, avisos comerciais e mídia de campanha com imagem principal e referências.
- Geração híbrida: IA interpreta contexto, copy e parâmetros visuais; renderização programática produz a arte final.
- Copy comercial, direção de arte contextual, templates/layouts e fallback visual controlado.
- Revisão obrigatória do brief antes da geração e aprovação da arte antes de liberar ações protegidas, conforme flags operacionais.
- Pipeline persistido de campanhas: estados de geração, resultado final em Storage, histórico, busca, filtros, paginação e download.
- App shell em PT-BR, dashboard, onboarding contextual, estados vazios, navegação mobile e controles acessíveis.
- Créditos operacionais com concessão, reserva, consumo, estorno, expiração/demo, extrato e controles administrativos auditáveis.
- Telemetria de chamadas de IA, gateway único, registry e seleção administrativa de modelos, além de laboratório mínimo isolado para experimentação controlada.
- Fluxos de suporte, observabilidade, controle de custos e flags de lançamento necessários à operação beta.

## Product Principles

- A oferta simples deve resultar em uma peça clara, comercial e publicável.
- Geração guiada e controlada é preferível a um editor visual livre.
- A IA decide copy e parâmetros; o renderer programático preserva previsibilidade, legibilidade e consistência.
- Identidade da loja deve ser aplicada sem comprometer a clareza da oferta.
- Falhas de geração não devem produzir cobrança indevida; créditos precisam ser tratados com atomicidade e rastreabilidade.
- Beta fechado, flags fail-closed e validação operacional precedem qualquer ativação pública.
- O produto deve permanecer simples para o lojista e operável pelo time.

## Technology and Constraints

- Stack: Next.js com App Router, TypeScript, Supabase para banco, Storage e Auth, e Vercel para deploy.
- IA: APIs externas via backend, atualmente com abstração de provedor, gateway e resolução de modelos.
- Geração visual: abordagem híbrida; IA decide parâmetros e copy, renderização programática executa a arte final.
- Fluxo: aplicação web no browser, formulário → geração → revisão/aprovação → exportação.
- Deploy: Vercel, sem infraestrutura adicional necessária para o escopo atual.
- Validação: mudanças de fase exigem validação automática (TypeScript, lint e build) e validação manual de fluxo, visual, copy e legibilidade.
- Ordem de produto: visão → direção visual → core de campanha → estrutura SaaS.
- A relação usuário-loja permanece 1:1; times, múltiplas lojas e permissões multiusuário não fazem parte do produto atual.

## Permanent Decisions

- A geração híbrida separa Intelligence, Spec e Render.
- APIs de IA são acessadas por uma camada de abstração, evitando acoplamento a um provedor.
- Supabase é a base integrada de banco, Storage e autenticação.
- `stores.user_id` é a fonte canônica de ownership; o cliente com sessão é o padrão e service role é excepcional.
- RLS com políticas específicas, proteção em camadas e CSRF same-origin são requisitos de segurança.
- BRL usa estado interno em centavos e formatação com `Intl.NumberFormat`.
- Regeneração é tratada como novo briefing; não há editor pós-geração livre.
- O saldo de créditos é visível e operações financeiras são auditáveis; falha de geração implica estorno conforme as regras do domínio.
- Copy Director é serviço de texto independente e pode executar em paralelo ao Image Director.
- Stripe não é caminho crítico do beta e permanece iniciativa futura não numerada.

## Deferred / Out of Scope

- F50.1: constituição da PJ, preenchimento de identidade e datas, validação jurídica, publicação dos documentos, ativação ordenada e smoke test pós-corte.
- Demonstração pública, novos usuários, e-mail com credenciais e signup público até os gates legais e operacionais serem aprovados.
- Stripe, checkout e monetização pública até v1.7 ou posterior.
- Integração de postagem automática em redes sociais, calendário inteligente, campanhas multi-formato e editor tipo Canva.
- Múltiplas lojas, times, permissões multiusuário e automações avançadas.
- Planos/assinaturas mensais como modelo público atual; o beta opera com controles internos e créditos.

## Sources of Truth

- Estado e continuidade operacional: `.planning/STATE.md`.
- Índice de fases e status atual: `.planning/ROADMAP.md`.
- Índice de requisitos ativos: `.planning/REQUIREMENTS.md`.
- Implementação e decisões específicas de cada fase: `.planning/phases/`, incluindo `SUMMARY.md` e `VERIFICATION.md`.
- Especificações e mudanças: `openspec/changes/`, especialmente o arquivo arquivado da fase correspondente.
- Histórico integral deste documento: `.planning/PROJECT-ARCHIVE.md`.

Em divergências históricas, o estado e roadmap atuais, e sobretudo o OpenSpec junto de `VERIFICATION.md` e `SUMMARY.md` da fase, prevalecem sobre archives, changelogs e registros antigos.

## Evolution Rules

- Este arquivo é uma referência permanente do produto, não um diário de execução.
- Atualizar apenas quando mudar o estado atual, uma capacidade, uma constraint, uma decisão estrutural ou uma regra permanente.
- Registrar fases concluídas como histórico curto ou removê-las da descrição ativa; não apresentar fase concluída como ativa.
- Não duplicar métricas, planos, checklists, requisitos históricos ou changelog aqui; manter esses detalhes nas fontes próprias.
- Ao concluir uma fase ou milestone, revisar Core Value, capacidades, decisões e itens diferidos contra STATE, ROADMAP, REQUIREMENTS e artefatos da fase.
- Antes de remover informação histórica, criar ou manter o archive integral correspondente; não alterar archives para corrigir o estado ativo.
