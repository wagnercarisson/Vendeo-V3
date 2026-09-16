import Link from "next/link";

import { getLabEnvironment as readLabEnvironment } from "@/lib/lab/environment-guard";

import { DisabledNotice } from "./_components/disabled-notice";

/**
 * Layout do Laboratório de IA (F48.1, D1/D2/D12).
 *
 * Ordem obrigatória: guarda de ambiente **antes** de qualquer página filha. Com o
 * ambiente recusado, somente o aviso de indisponibilidade é renderizado — nenhuma
 * tabela `lab_*`, storage do laboratório ou provider é acessado (T-48-1-69).
 *
 * A navegação interna (Experimentos / Cenários / Avaliações) vive **aqui**, e não
 * na navegação principal do admin: existe um único link "Laboratório" naquela nav
 * (D1). O layout pai `src/app/(app)/admin/layout.tsx` já exige `requireAdmin()`.
 */

const LAB_NAV_ITEMS = [
  { href: "/admin/laboratorio", label: "Experimentos" },
  { href: "/admin/laboratorio/cenarios", label: "Cenários" },
  { href: "/admin/laboratorio#avaliacoes-pendentes", label: "Avaliações" },
];

export default function LaboratorioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = readLabEnvironment();

  if (!env.enabled) {
    return <DisabledNotice reason={env.reason} />;
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Navegação do laboratório"
        className="flex flex-wrap gap-4 border-b border-border pb-3 text-sm"
      >
        {LAB_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="font-medium text-text-secondary transition-colors duration-200 hover:text-accent-blue"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
