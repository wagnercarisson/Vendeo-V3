import { LayoutDashboard, Megaphone, Store, Search } from "lucide-react";
import type { EmptyStateCopy } from "@/lib/onboarding/types";

export const DASHBOARD_NO_STORE: EmptyStateCopy = {
  icon: Store,
  title: "Configure sua loja",
  description:
    "Para começar a criar campanhas, primeiro precisamos conhecer sua loja.",
  ctaLabel: "Configurar loja",
  ctaHref: "/loja",
};

export const DASHBOARD_NO_CAMPAIGNS: EmptyStateCopy = {
  icon: Megaphone,
  title: "Crie sua primeira campanha",
  description:
    "Sua loja está pronta! Agora é hora de criar sua primeira campanha profissional.",
  ctaLabel: "Criar campanha",
  ctaHref: "/campanhas/nova",
};

export const DASHBOARD_PLACEHOLDER: EmptyStateCopy = {
  icon: LayoutDashboard,
  title: "Seu dashboard está sendo preparado",
  description:
    "Em breve você verá aqui suas métricas e campanhas recentes.",
};

export const CAMPAIGNS_NO_STORE: EmptyStateCopy = {
  icon: Store,
  title: "Configure sua loja",
  description:
    "Suas campanhas aparecerão aqui depois que você configurar sua loja.",
  ctaLabel: "Configurar loja",
  ctaHref: "/loja",
};

export const CAMPAIGNS_NO_CAMPAIGNS: EmptyStateCopy = {
  icon: Megaphone,
  title: "Nenhuma campanha ainda",
  description:
    "Crie sua primeira campanha e comece a divulgar seus produtos.",
  ctaLabel: "Criar campanha",
  ctaHref: "/campanhas/nova",
};

export const CAMPAIGNS_SEARCH_EMPTY: EmptyStateCopy = {
  icon: Search,
  title: "Nenhuma campanha encontrada",
  description:
    "Tente ajustar sua busca ou limpar os filtros.",
};
