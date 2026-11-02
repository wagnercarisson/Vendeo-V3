import Link from "next/link";
import { X } from "lucide-react";
import type { MissingItem } from "@/lib/store-readiness";

export interface ReadinessMessages {
  title: string;
  cta: string;
  cadastroFiscal: string;
  brandProfile: string;
}

function missingToDisplay(
  item: MissingItem,
  messages?: ReadinessMessages,
): { label: string; href: string } {
  if (item.item === "cadastro_fiscal") {
    return {
      label: messages?.cadastroFiscal ?? "CNPJ cadastral",
      href: "/loja?tab=dados&fiscal=pending&returnTo=/dashboard",
    };
  }
  return {
    label: messages?.brandProfile ?? "Direção visual",
    href: "/loja?tab=direcao-visual&message=needs-visual-direction",
  };
}

export function ReadinessBanner({
  missing,
  messages,
}: {
  missing: MissingItem[];
  messages?: ReadinessMessages;
}) {
  if (missing.length === 0) return null;

  const firstHref = missingToDisplay(missing[0], messages).href;

  return (
    <div className="mb-6 border border-amber-700/30 rounded-lg overflow-hidden">
      <div className="bg-amber-900/20 px-4 py-3">
        <p className="text-sm font-heading font-semibold text-accent-amber mb-2">
          {messages?.title ?? "Sua loja não está pronta para gerar campanhas"}
        </p>
        <ul className="space-y-1">
          {missing.map((item) => {
            const display = missingToDisplay(item, messages);
            return (
              <li key={item.item} className="flex items-center gap-2 text-sm text-text-secondary">
                <X aria-hidden="true" className="h-4 w-4 text-accent-amber" />
                <Link href={display.href} className="underline hover:text-text-primary transition-colors">
                  {display.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href={firstHref}
          className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-accent-green px-4 py-2 text-xs font-semibold text-white hover:brightness-110 transition-all"
        >
          {messages?.cta ?? "Configurar agora"}
        </Link>
      </div>
    </div>
  );
}
