export const TRIAL_OFFER_KEY = "trial_28d_v1" as const;
export const TRIAL_CREDIT_PROGRAM = "trial_28d" as const;
export const TRIAL_INSTALLMENT_AMOUNT = 5;
export const TRIAL_INSTALLMENT_DAYS = [0, 7, 14, 21] as const;
export const TRIAL_MAX_GRANTED = 20;
export const TRIAL_DURATION_DAYS = 28;

export type TrialInstallmentSeq = 0 | 1 | 2 | 3;
