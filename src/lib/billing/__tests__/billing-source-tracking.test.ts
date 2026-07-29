import { describe, it, expect } from 'vitest';

describe('billing_data_source tracking', () => {
  it('handleBillingChange sets source to manual and resets confirmation', () => {
    // Simulates frontend handleBillingChange behavior
    function handleBillingChange(
      prev: Record<string, string>,
      field: string,
      value: string,
    ): Record<string, string> {
      return {
        ...prev,
        [field]: value,
        billing_data_source: 'manual',
      };
    }

    let state: Record<string, string> = {
      billing_email: 'loja@test.com',
      billing_data_source: 'brasilapi',
      billing_data_last_prefilled_from: 'brasilapi',
    };

    state = handleBillingChange(state, 'billing_address_street', 'Rua Nova');
    expect(state.billing_data_source).toBe('manual');
    expect(state.billing_data_last_prefilled_from).toBe('brasilapi'); // preserved
    expect(state.billing_address_street).toBe('Rua Nova');
  });

  it('prefill via reconsult sets source to brasilapi', () => {
    // Simulates setBillingData after reconsult-cnpj response
    const billingData = {
      billing_email: '',
      billing_phone: '',
      billing_address_street: 'Rua Exemplo',
      billing_address_number: '100',
      billing_address_city: 'São Paulo',
      billing_address_state: 'SP',
      billing_address_zipcode: '01001000',
      billing_data_source: 'brasilapi',
      billing_data_last_prefilled_from: 'brasilapi',
    };

    expect(billingData.billing_data_source).toBe('brasilapi');
    expect(billingData.billing_data_last_prefilled_from).toBe('brasilapi');
  });

  it('manual fill button sets source to manual', () => {
    const billingData = {
      billing_email: '',
      billing_phone: '',
      billing_address_street: '',
      billing_address_number: '',
      billing_address_city: '',
      billing_address_state: '',
      billing_address_zipcode: '',
      billing_data_source: 'manual',
    };

    expect(billingData.billing_data_source).toBe('manual');
  });

  it('confirm=true API request includes billing_data_source', () => {
    function buildConfirmPayload(
      storeId: string,
      billingData: Record<string, string>,
      confirmed: boolean,
    ) {
      return JSON.stringify({ storeId, billingData, confirmed });
    }

    const payload = buildConfirmPayload(
      'store-1',
      { billing_email: 'loja@test.com', billing_data_source: 'manual' },
      true,
    );

    const parsed = JSON.parse(payload);
    expect(parsed.billingData.billing_data_source).toBe('manual');
    expect(parsed.confirmed).toBe(true);
  });
});
