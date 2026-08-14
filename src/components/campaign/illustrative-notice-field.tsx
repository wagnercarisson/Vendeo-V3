"use client";

import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";

interface IllustrativeNoticeFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function IllustrativeNoticeField({ checked, onChange }: IllustrativeNoticeFieldProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border-light bg-bg-surface text-accent-green focus:ring-accent-green/20"
      />
      <span className="text-text-primary text-sm font-body">Exibir '{ILLUSTRATIVE_NOTICE_TEXT}'</span>
    </label>
  );
}
