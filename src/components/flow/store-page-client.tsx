"use client";

import { useState, useEffect } from "react";
import type { Store } from "@/lib/store";
import { StoreIdentityForm } from "./store-identity-form";
import { Loader2, Store as StoreIcon, AlertCircle } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "store_id";

export function StorePageClient() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storeId = localStorage.getItem(STORAGE_KEY);
    if (!storeId) {
      setLoading(false);
      return;
    }

    fetch(`/api/store/${storeId}`)
      .then((res) => {
        if (res.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        if (!res.ok) throw new Error("Erro ao carregar loja");
        return res.json() as Promise<Store>;
      })
      .then((data) => {
        setStore(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar loja");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
        <AlertCircle className="w-8 h-8 text-accent-red" />
        <p className="text-text-secondary text-sm font-body">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StoreIdentityForm />
    </div>
  );
}
