"use client";

import { esqueciSenhaSchema } from "@vocare/shared";
import { useId, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { authClient } from "@/lib/auth/client";
import { Button, FormMessage, Input } from "@/components/ui";

/** Pede o link de redefinição de senha por e-mail. */
export function EsqueciSenhaForm() {
  const [pending, startTransition] = useTransition();
  const [erroEmail, setErroEmail] = useState<string>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const emailId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const parsed = esqueciSenhaSchema.safeParse({ email: new FormData(event.currentTarget).get("email") });
    if (!parsed.success) {
      setErroEmail(z.flattenError(parsed.error).fieldErrors.email?.[0]);
      return;
    }
    setErroEmail(undefined);

    startTransition(async () => {
      const { error } = await authClient.requestPasswordReset({
        email: parsed.data.email,
        // O link do e-mail passa pela api, que confere o token e devolve para cá.
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) {
        setErro(
          error.status === 429
            ? "Muitos pedidos seguidos. Espere um pouco e tente de novo."
            : "Não foi possível enviar agora. Tente de novo.",
        );
        return;
      }
      setEnviado(true);
    });
  }

  if (enviado) {
    // A mesma mensagem para qualquer e-mail: não revela quais contas existem.
    return (
      <p role="status" className="rounded-field bg-surface px-3.5 py-3 text-sm text-ink">
        Se esse e-mail estiver cadastrado, você vai receber um link para criar uma senha nova. O link vale por 1 hora.
        Confira também a caixa de spam.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <label htmlFor={emailId} className="block text-sm font-semibold text-ink">
          E-mail
        </label>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com.br"
          aria-invalid={Boolean(erroEmail)}
          aria-describedby={erroEmail ? `${emailId}-error` : undefined}
        />
        {erroEmail && (
          <p id={`${emailId}-error`} className="text-sm text-danger">
            {erroEmail}
          </p>
        )}
      </div>

      {erro && <FormMessage className="rounded-field bg-danger-bg px-3.5 py-2.5">{erro}</FormMessage>}

      <Button type="submit" variant="primario" loading={pending} className="w-full">
        {pending ? "Enviando..." : "Enviar link"}
      </Button>
    </form>
  );
}
