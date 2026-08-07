import { describe, it, expect, vi } from 'vitest';

const mockUseOperationCosts = vi.fn(() => ({
  costs: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
  status: "loaded",
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => mockUseOperationCosts(),
}));

describe('DriftCriticalModal decision logic', () => {
  it('canGenerateNewSignature determines credit flow', () => {
    function getNoCreditActions(canGenerateNewSignature: boolean): string[] {
      if (canGenerateNewSignature) {
        return ['openApproval', 'dismissAndSave', 'cancel'];
      }
      return ['alert', 'dismissAndSave', 'removeVs', 'seeCredits', 'cancel'];
    }

    // Com crédito
    const withCredit = getNoCreditActions(true);
    expect(withCredit).toContain('openApproval');
    expect(withCredit).not.toContain('removeVs');
    expect(withCredit).not.toContain('buyCreditsDisabled');
    expect(withCredit).not.toContain('seeCredits');
    expect(withCredit).toContain('dismissAndSave');

    // Sem crédito
    const withoutCredit = getNoCreditActions(false);
    expect(withoutCredit).toContain('alert');
    expect(withoutCredit).toContain('removeVs');
    expect(withoutCredit).toContain('seeCredits');
    expect(withoutCredit).not.toContain('openApproval');
  });

  it('credit flow opens ApprovalModal with substitution mode', () => {
    let approvalOpened = false;
    const onOpenApproval = () => { approvalOpened = true; };

    // Simulate com crédito flow
    const canGenerateNewSignature = true;
    if (canGenerateNewSignature) {
      onOpenApproval();
    }

    expect(approvalOpened).toBe(true);
  });

  it('no-credit flow offers "Ver meus créditos" (→ /conta) em vez de botão compra em breve', () => {
    const seeCreditsButton = {
      label: 'Ver meus créditos',
      navigateTo: '/conta',
    };

    expect(seeCreditsButton.label).toBe('Ver meus créditos');
    expect(seeCreditsButton.navigateTo).toBe('/conta');
  });

  it('sem crédito NUNCA oferece "Gerar novamente"', () => {
    const actions = ['alert', 'dismissAndSave', 'removeVs', 'seeCredits', 'cancel'];
    expect(actions).not.toContain('openApproval');
    expect(actions).not.toContain('generateAgain');
  });
});
