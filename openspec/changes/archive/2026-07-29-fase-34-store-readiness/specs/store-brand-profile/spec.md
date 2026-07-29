## ADDED Requirements

### Requirement: Três caminhos de direção visual convergem para brand profile synced

O Step 2 do onboarding (Direção Visual) SHALL oferecer três caminhos equivalentes para o usuário:

1. **Upload do logotipo** — upload → análise AI → inferência de brand profile
2. **Gerar assinatura visual** (VS) — geração → aprovação → inferência de brand profile
3. **Usar identidade em texto** (text-only) — salvar escolha → inferência de brand profile text-only

Qualquer caminho escolhido SHALL produzir um `store_brand_profiles` com `status = 'synced'` ao final. A tela só libera o botão "Confirmar direção visual" quando o profile estiver synced.

#### Scenario: Upload de logo cria brand profile synced

- **WHEN** usuário faz upload de logo no Step 2
- **AND** a análise de logo é concluída com sucesso
- **THEN** um `store_brand_profiles` é criado com `source = 'logo_analysis'` e `status = 'synced'`

#### Scenario: Geração de VS cria brand profile synced

- **WHEN** usuário gera e aprova uma assinatura visual no Step 2
- **THEN** um `store_brand_profiles` é criado com `source = 'without_logo'` e `status = 'synced'`

#### Scenario: Text-only cria brand profile synced

- **WHEN** usuário escolhe identidade em texto no Step 2
- **AND** confirma a escolha
- **THEN** um `store_brand_profiles` é criado com `source = 'text_only'` e `status = 'synced'`

#### Scenario: Confirmar direção visual só libera com profile synced

- **WHEN** usuário está no Step 2
- **AND** o brand profile ainda está `processing` ou `failed`
- **THEN** o botão "Confirmar direção visual" está desabilitado
- **AND** um indicador de carregamento/erro é exibido

- **WHEN** o brand profile é criado com `status = 'synced'`
- **THEN** o botão "Confirmar direção visual" é habilitado
