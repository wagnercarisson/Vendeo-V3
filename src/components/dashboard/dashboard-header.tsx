import type { DashboardMessages } from "@/lib/i18n/dashboard";

interface DashboardHeaderProps {
  greeting: string;
  storeName: string | null;
  nameSeparator: string;
  messages: DashboardMessages["header"];
}

/**
 * Cabeçalho do dashboard (F58).
 *
 * Saudação em destaque + subtítulo explicativo. O nome da loja é o único
 * elemento com `lang=""` (dado não traduzido). Nenhuma ação interna é
 * renderizada; a criação de campanha permanece na topbar/shell.
 */
export function DashboardHeader({
  greeting,
  storeName,
  nameSeparator,
  messages,
}: DashboardHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-2 lg:mb-8">
      <h1 className="min-w-0 break-words font-heading text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
        {greeting}
        {storeName ? (
          <>
            {nameSeparator}
            <span lang="">{storeName}</span>
          </>
        ) : null}
      </h1>
      <p className="font-body text-base leading-normal text-text-secondary">
        <span className="hidden sm:inline">{messages.subtitleDesktop}</span>
        <span className="sm:hidden">{messages.subtitleMobile}</span>
      </p>
    </header>
  );
}
