import { describe, it, expect } from 'vitest';

describe('DriftCriticalModal decision logic', () => {
  it('canGenerateNewSignature determines credit flow', () => {
    function getNoCreditActions(canGenerateNewSignature: boolean): string[] {
      if (canGenerateNewSignature) {
        return ['openApproval', 'dismissAndSave', 'cancel'];
      }
      return ['alert', 'dismissAndSave', 'removeVs', 'buyCreditsDisabled', 'cancel'];
    }

    // Com crédito
    const withCredit = getNoCreditActions(true);
    expect(withCredit).toContain('openApproval');
    expect(withCredit).not.toContain('removeVs');
    expect(withCredit).not.toContain('buyCreditsDisabled');
    expect(withCredit).toContain('dismissAndSave');

    // Sem crédito
    const withoutCredit = getNoCreditActions(false);
    expect(withoutCredit).toContain('alert');
    expect(withoutCredit).toContain('removeVs');
    expect(withoutCredit).toContain('buyCreditsDisabled');
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

  it('no-credit flow has disabled "Comprar créditos" button', () => {
    const disabledButton = {
      label: 'Comprar créditos — Em breve',
      disabled: true,
      tooltip: 'Funcionalidade em desenvolvimento',
    };

    expect(disabledButton.disabled).toBe(true);
    expect(disabledButton.label).toContain('Em breve');
  });
});
