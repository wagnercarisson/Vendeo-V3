export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-50">Vendeo</h1>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
