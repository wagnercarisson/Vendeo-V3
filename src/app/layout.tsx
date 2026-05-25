import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
