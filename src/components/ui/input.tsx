"use client";

import { useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...input }: InputProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-text-primary font-heading"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted transition-colors duration-200 focus:ring-2 focus:ring-accent-green focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-accent-red" : ""} ${className}`}
        {...input}
      />
      {error && (
        <p className="text-xs text-accent-red font-body">{error}</p>
      )}
    </div>
  );
}
