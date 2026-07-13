import type { LucideIcon } from "lucide-react";

export type OnboardingState =
  | "no_store"
  | "has_store_no_campaigns"
  | "has_store_with_campaigns";

export interface EmptyStateCopy {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}
