> **Propósito**: RPC atômica que cria loja + registra aceites contratuais + concede créditos em transação única.

## Requirements

### Requirement: Atomic store creation RPC

The system SHALL provide `create_store_with_legal_acceptance()` — a single RPC that creates the store, registers contractual acceptances, and grants initial credits in one transaction:

```sql
CREATE OR REPLACE FUNCTION public.create_store_with_legal_acceptance(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_city TEXT,
  p_state TEXT,
  p_brand_color TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_subsegment TEXT DEFAULT NULL,
  p_tone_of_voice TEXT DEFAULT NULL,
  p_positioning TEXT DEFAULT NULL,
  p_short_description TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_initial_grant_amount INTEGER DEFAULT 10,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  -- 1. Cria a loja (incluindo logo_url)
  INSERT INTO public.stores (user_id, name, segment, city, state, brand_color, logo_url, subsegment, tone_of_voice, positioning, short_description, slogan)
  VALUES (p_user_id, p_name, p_segment, p_city, p_state, p_brand_color, p_logo_url, p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan)
  RETURNING id INTO v_store_id;

  -- 2. Registra aceite de Termos de Uso
  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, accepted_at, ip_address, user_agent, acceptance_source)
  VALUES (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version, now(), p_ip_address, p_user_agent, 'onboarding');

  -- 3. Registra aceite de Uso Aceitável
  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, accepted_at, ip_address, user_agent, acceptance_source)
  VALUES (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version, now(), p_ip_address, p_user_agent, 'onboarding');

  -- 4. Concede créditos iniciais
  PERFORM public.grant_credits(v_store_id, p_initial_grant_amount, 'onboarding', 'onboarding_' || v_store_id, '{}'::jsonb, 'bonus_onboarding');

  RETURN jsonb_build_object('store_id', v_store_id);
END;
$$;
```

The function SHALL:
1. INSERT into `stores` with all provided data (including `logo_url`)
2. INSERT into `legal_acceptances` for `terms_of_service` with the provided version and `acceptance_source = 'onboarding'`
3. INSERT into `legal_acceptances` for `acceptable_use` with the provided version and `acceptance_source = 'onboarding'`
4. Call `grant_credits()` with 6 positional args
5. Return `{ store_id: ... }`

If any step fails, the entire transaction SHALL be rolled back.

#### Scenario: Atomic RPC creates store + acceptances + grant

- **WHEN** `create_store_with_legal_acceptance()` is called with valid parameters
- **THEN** a store SHALL be created
- **AND** both `terms_of_service` and `acceptable_use` acceptances SHALL be registered
- **AND** credits SHALL be granted
- **AND** all operations SHALL be in a single transaction

#### Scenario: Failure rolls back everything

- **WHEN** any step of the RPC fails
- **THEN** the entire transaction SHALL be rolled back
- **AND** no partial state SHALL exist

### Requirement: POST /api/store handler uses atomic RPC

The existing `POST /api/store` handler SHALL be updated to:
- Call `create_store_with_legal_acceptance()` instead of the previous multi-step flow
- Pass the current document versions, IP address, and user agent
- Accept and validate the new acceptance checkbox from the form

#### Scenario: Store creation with acceptance flows through RPC

- **WHEN** a user submits the store creation form with all checkboxes checked
- **THEN** the handler SHALL call the atomic RPC
- **AND** return the created store ID
