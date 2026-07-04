interface CheckEmailPageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const { type } = await searchParams;

  const title = "Verifique seu email";
  let message =
    "Enviamos um link para o email informado. Verifique sua caixa de entrada e siga as instruções.";

  if (type === "signup") {
    message =
      "Enviamos um link de confirmação para o email informado. Verifique sua caixa de entrada e clique no link para ativar sua conta.";
  } else if (type === "recovery") {
    message =
      "Enviamos um link de redefinição de senha para o email informado. Verifique sua caixa de entrada e clique no link para criar uma nova senha.";
  }

  return (
    <div className="text-center">
      <h2 className="mb-4 text-2xl font-bold text-slate-50">{title}</h2>
      <p className="text-slate-300">{message}</p>
    </div>
  );
}
