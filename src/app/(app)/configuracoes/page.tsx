import { requirePageUser } from "@/lib/auth/require-user";
import { getUiRenderContext } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/i18n/get-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SettingsLanguageForm } from "@/components/settings/settings-language-form";
import { SettingsLoadError } from "@/components/settings/settings-load-error";

/**
 * F57.4 — `/configuracoes` autenticada e disponível sem loja.
 *
 * Depende apenas de conta + preferência de idioma. A leitura é server-side e
 * sem efeito de escrita: nenhuma linha é criada e nenhum PATCH é disparado.
 */
export default async function ConfiguracoesPage() {
  const user = await requirePageUser();
  const ui = await getUiRenderContext(user.userId);

  const locale = ui.ok ? ui.locale : "pt-BR";
  const { settings, common } = getCatalog(locale);
  const lang = locale === "es-419" ? "es-419" : undefined;

  return (
    <div lang={lang}>
      <PageHeader
        title={settings.title}
        breadcrumbs={[
          { label: settings.breadcrumbDashboard, href: "/dashboard" },
          { label: settings.title },
        ]}
      />

      <div className="space-y-6 max-w-lg">
        <Card>
          {ui.ok ? (
            <SettingsLanguageForm
              initialLocale={ui.preference.uiLocale}
              initialVersion={ui.preference.version}
              messages={settings}
              common={common}
              lang={lang}
            />
          ) : (
            <SettingsLoadError
              messages={settings}
              common={common}
              lang={lang}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
