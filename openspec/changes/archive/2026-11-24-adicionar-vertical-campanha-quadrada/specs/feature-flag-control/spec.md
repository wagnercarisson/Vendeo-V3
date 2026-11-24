## ADDED Requirements

### Requirement: Flag campaign_format_addition_enabled

O sistema SHALL adicionar a flag **`campaign_format_addition_enabled`** à infraestrutura existente de `feature_flags`, com:

- constante dedicada no serviço de flags;
- inclusão em `ALL_FEATURE_FLAG_KEYS`, para que a tela administrativa existente e a rota de flags a listem sem painel novo;
- leitura fail-closed `readFlag(key, false)`, sem `envOverride` para ativar;
- seed na migration com `enabled = false` e descrição administrativa, usando `ON CONFLICT (key) DO NOTHING`;
- alteração pela RPC administrativa existente (`admin_update_feature_flag`), com autor, motivo e auditoria, sem novo RPC ou novo CHECK.

A flag SHALL controlar somente a abertura de novas adições de formato. Desligá-la NÃO SHALL desligar o vertical individual, a entrega conjunta, o fluxo `1:1`, a consulta, o download, a reconciliação ou a finalização de operações já abertas.

#### Scenario: Seed desligado por padrão

- **WHEN** a migration é aplicada
- **THEN** existe uma linha `campaign_format_addition_enabled` com `enabled = false` e descrição administrativa
- **AND** a leitura inicial retorna desligado

#### Scenario: Leitura fail-closed

- **WHEN** a flag está desligada, ausente ou a leitura falha
- **THEN** a abertura de nova adição SHALL ser bloqueada
- **AND** nenhuma operação, reserva ou provider SHALL ser iniciado
- **AND** operações já abertas, consulta, download e finalização SHALL permanecer disponíveis

#### Scenario: Tela administrativa existente exibe a flag

- **WHEN** um admin abre a tela existente de feature flags
- **THEN** `campaign_format_addition_enabled` SHALL ser exibida com descrição e estado atual
- **AND** a alteração com motivo obrigatório SHALL ser persistida e auditada pela ação existente

#### Scenario: Rollback não derruba outros fluxos

- **WHEN** a flag é desligada para rollback
- **THEN** apenas novas adições SHALL ser bloqueadas
- **AND** o vertical individual, o conjunto, o `1:1` e as operações abertas NÃO SHALL ser desligados por essa flag
- **AND** a flag compartilhada do motor vertical NÃO SHALL ser usada como kill switch da adição
