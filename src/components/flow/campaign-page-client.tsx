"use client";

import { useState, useEffect, useCallback } from "react";
import type { Store } from "@/lib/store";
import { resolveStoreIdentity } from "@/lib/actions/store";
import { StoreIdentityBlock } from "./store-identity-block";
import { CampaignInputForm } from "./campaign-input-form";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";
import { Loader2, Store as StoreIcon, AlertCircle } from "lucide-react";
import Link from "next/link";

type PageState = "loading" | "blocked" | "error" | "ready";

const STORAGE_KEY = "store_id";

export function CampaignPageClient() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [store, setStore] = useState<Store | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadStore = useCallback(() => {
    const storeId = localStorage.getItem(STORAGE_KEY);

    if (!storeId) {
      setPageState("blocked");
      return;
    }

    setPageState("loading");

    fetch(`/api/store/${storeId}`)
      .then((res) => {
        if (res.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          setPageState("blocked");
          return null;
        }
        if (!res.ok) throw new Error("Erro ao carregar loja");
        return res.json() as Promise<Store>;
      })
      .then((data) => {
        if (!data) return;
        setStore(data);
        setPageState("ready");
      })
      .catch(() => {
        setErrorMessage("Não foi possível carregar os dados da loja. Tente novamente.");
        setPageState("error");
      });
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const [storeIdentity, setStoreIdentity] = useState<StoreIdentitySnapshot | null>(null);
  const [resolvingIdentity, setResolvingIdentity] = useState(false);

  useEffect(() => {
    if (!store) {
      setStoreIdentity(null);
      return;
    }
    setResolvingIdentity(true);
    resolveStoreIdentity(store)
      .then(setStoreIdentity)
      .catch(() => setStoreIdentity(null))
      .finally(() => setResolvingIdentity(false));
  }, [store]);

  if (pageState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent-green" />
        <p className="text-text-secondary text-sm font-body">
          Carregando dados da loja...
        </p>
      </div>
    );
  }

  if (pageState === "blocked") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 max-w-md mx-auto text-center">
        <StoreIcon className="w-12 h-12 text-text-muted" />
        <h2 className="text-text-primary font-heading font-bold text-xl">
          Cadastre sua loja primeiro
        </h2>
        <p className="text-text-secondary text-sm font-body">
          Para criar uma campanha, precisamos dos dados da sua loja.
        </p>
        <Link
          href="/store"
          className="px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
        >
          Cadastrar Loja
        </Link>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-accent-red" />
        <h2 className="text-text-primary font-heading font-bold text-xl">
          Algo deu errado
        </h2>
        <p className="text-text-secondary text-sm font-body">{errorMessage}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadStore}
            className="px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
          >
            Tentar Novamente
          </button>
          <Link
            href="/store"
            className="px-6 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
          >
            Ir para Cadastro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {store && (
        <div className="mb-6">
          <StoreIdentityBlock store={store} />
        </div>
      )}

      <h1 className="text-2xl font-heading font-bold text-text-primary mb-1">
        Dados da Campanha
      </h1>
      <p className="text-text-secondary text-sm font-body mb-8">
        Informe os dados do produto e da oferta
      </p>

      <CampaignInputForm storeIdentity={storeIdentity} />
    </div>
  );
}
