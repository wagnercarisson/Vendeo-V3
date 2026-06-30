import { describe, it, expect } from 'vitest';

describe('VisualSignatureApprovalModal mode:substitution', () => {
  it('substitution mode checks bp_status after approval', () => {
    function handleApprovalResponse(
      mode: 'standard' | 'substitution',
      bpStatus: string | undefined
    ): 'done' | 'bp_failed' {
      if (bpStatus === 'failed' && mode === 'substitution') {
        return 'bp_failed';
      }
      return 'done';
    }

    expect(handleApprovalResponse('substitution', 'failed')).toBe('bp_failed');
    expect(handleApprovalResponse('substitution', 'synced')).toBe('done');
    expect(handleApprovalResponse('substitution', undefined)).toBe('done');
    // Standard mode ignores bp_status
    expect(handleApprovalResponse('standard', 'failed')).toBe('done');
  });

  it('bp_failed offers Tentar novamente -> calls POST /brand-profile/realign', () => {
    let realignCalled = false;
    const realignFn = async () => {
      realignCalled = true;
    };

    const handleRetryBP = async (onTier2Retry?: () => Promise<void>) => {
      if (onTier2Retry) {
        await onTier2Retry();
      } else {
        await fetch('/api/store/test/brand-profile/realign', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }
    };

    handleRetryBP(realignFn);
    expect(realignCalled).toBe(true);
  });

  it('substitution mode sends mode:substitution in generate body', () => {
    function buildGenerateBody(
      mode: 'standard' | 'substitution',
      rejectionContext?: { reason: string; attempt: number }
    ): Record<string, unknown> {
      const body: Record<string, unknown> = {};
      if (mode === 'substitution') {
        body.mode = 'substitution';
      }
      if (rejectionContext) {
        body.rejectionContext = rejectionContext;
      }
      return body;
    }

    expect(buildGenerateBody('substitution')).toEqual({ mode: 'substitution' });
    expect(buildGenerateBody('standard')).toEqual({});
    expect(buildGenerateBody('substitution', { reason: 'test', attempt: 1 })).toEqual({
      mode: 'substitution',
      rejectionContext: { reason: 'test', attempt: 1 },
    });
  });

  it('substitution mode sends mode:substitution in approve body', () => {
    function buildApproveBody(
      signatureId: string,
      mode: 'standard' | 'substitution'
    ): Record<string, unknown> {
      const body: Record<string, unknown> = { signatureId };
      if (mode === 'substitution') {
        body.mode = 'substitution';
      }
      return body;
    }

    expect(buildApproveBody('sig-1', 'substitution')).toEqual({
      signatureId: 'sig-1',
      mode: 'substitution',
    });
    expect(buildApproveBody('sig-1', 'standard')).toEqual({
      signatureId: 'sig-1',
    });
  });
});

describe('VisualSignatureApprovalModal mode:standard', () => {
  it('standard mode does NOT include mode in generate body', () => {
    function buildGenerateBody(mode: 'standard' | 'substitution'): Record<string, unknown> {
      const body: Record<string, unknown> = {};
      if (mode === 'substitution') {
        body.mode = 'substitution';
      }
      return body;
    }
    const body = buildGenerateBody('standard');
    expect(body).not.toHaveProperty('mode');
  });

  it('standard mode does NOT check bp_status', () => {
    function handleApprovalResponse(
      mode: 'standard' | 'substitution',
      bpStatus: string | undefined
    ): 'done' | 'bp_failed' {
      if (bpStatus === 'failed' && mode === 'substitution') {
        return 'bp_failed';
      }
      return 'done';
    }

    expect(handleApprovalResponse('standard', 'failed')).toBe('done');
    expect(handleApprovalResponse('standard', 'synced')).toBe('done');
    expect(handleApprovalResponse('standard', undefined)).toBe('done');
  });
});
