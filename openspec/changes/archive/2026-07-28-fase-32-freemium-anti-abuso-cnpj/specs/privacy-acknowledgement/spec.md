## ADDED Requirements

### Requirement: Política de Privacidade v1.1 publicada

O sistema SHALL publicar `privacy_policy` versão `"v1.1"` em `legal_document_versions`. A nova versão documenta explicitamente as finalidades da coleta de CNPJ:
- Identificar a loja/empresa contratante
- Habilitar benefícios gratuitos/freemium
- Prevenir abuso, fraude e múltiplos cadastros promocionais
- Processar cobranças e emitir notas fiscais
- Cumprir obrigações legais e regulatórias
- Suporte, auditoria e segurança da conta

Base legal: Contrato (execução de termos) + legítimo interesse (antifraude).

#### Scenario: Privacy v1.1 é vigente

- **WHEN** `getCurrentVersion("privacy_policy")` é chamado
- **THEN** retorna `"v1.1"`