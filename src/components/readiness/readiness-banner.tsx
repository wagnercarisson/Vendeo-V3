import Link from "next/link";
import type { MissingItem } from "@/lib/store-readiness";

function missingToDisplay(item: MissingItem): { label: string; href: string } {
  if (item.item === "cadastro_fiscal") {
    return { label: "CNPJ cadastral", href: "/loja?required=cadastro-fiscal&returnTo=/dashboard" };
  }
  return { label: "Direção visual", href: "/loja?required=visual-direction" };
}

export function ReadinessBanner({ missing }: { missing: MissingItem[] }) {
  if (missing.length === 0) return null;

  const firstHref = missingToDisplay(missing[0]).href;

  return (
    <div className="mb-6 border border-amber-700/30 rounded-lg overflow-hidden">
      <div className="bg-amber-900/20 px-4 py-3">
        <p className="text-sm font-heading font-semibold text-accent-amber mb-2">
          Sua loja não está pronta para gerar campanhas
        </p>
        <ul className="space-y-1">
          {missing.map((item) => {
            const display = missingToDisplay(item);
            return (
              <li key={item.item} className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="text-accent-amber">❌</span>
                <Link href={display.href} className="underline hover:text-text-primary transition-colors">
                  {display.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href={firstHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent-green px-4 py-2 text-xs font-semibold text-white hover:brightness-110 transition-all"
        >
          Configurar agora
        </Link>
      </div>
    </div>
  );
}
