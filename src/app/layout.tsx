import type { Metadata } from "next";
import "./globals.css";
import { AuthHeader } from "@/components/auth/auth-header";

export const metadata: Metadata = {
  title: "Vendeo",
  description: "Motor de geração de campanhas profissionais",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="flex items-center justify-end border-b border-slate-800 bg-slate-950 px-6 py-3">
          <AuthHeader />
        </header>
        {children}
      </body>
    </html>
  );
}
