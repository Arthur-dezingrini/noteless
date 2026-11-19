"use client";

import { novaSenhaSchema } from "@vocare/shared";
import Link from "next/link";
import { useId, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { authClient } from "@/lib/auth/client";
import { Button, FormMessage, Input } from "@/components/ui";

type Erros = { password?: string; confirmPassword?: string };

/** Escolhe a senha nova com o token que veio no link do e-mail. */
export function NovaSenhaForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [erros, setErros] = useState<Erros>({});
  const [erro, setErro] = useState<{ texto: string; linkVencido: boolean } | null>(null);
  const [pronto, setPronto] = useState(false);
  const senhaId = useId();
  const confirmacaoId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const form = new FormData(event.currentTarget);
    const parsed = novaSenhaSchema.safeParse({
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErros({ password: flat.password?.[0], confirmPassword: flat.confirmPassword?.[0] });
      return;
    }
    setErros({});

    startTransition(async () => {
      const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token });
      if (error) {
        // As regras da senha já foram conferidas acima: 400 aqui é token vencido ou usado.
        setErro(
          error.status === 400
            ? { texto: "Este link venceu ou já foi usado.", linkVencido: true }
            : { texto: "Não foi possível trocar a senha agora. Tente de novo.", linkVencido: false },
        );
        return;
      }
      setPronto(true);
    });
  }

  if (pronto) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-field bg-surface px-3.5 py-3 text-sm text-ink">
          Senha alterada. Por segurança, as sessões abertas em outros aparelhos foram encerradas.
        </p>
        <Link href="/login" className="text-sm font-semibold text-brand-ink hover:underline">
          Entrar com a senha nova
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <label htmlFor={senhaId} className="block text-sm font-semibold text-ink">
          Senha nova
        </label>
        <Input
          id={senhaId}
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(erros.password)}
          aria-describedby={erros.password ? `${senhaId}-error` : undefined}
        />
        {erros.password && (
          <p id={`${senhaId}-error`} className="text-sm text-danger">
            {erros.password}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={confirmacaoId} className="block text-sm font-semibold text-ink">
          Repita a senha nova
        </label>
        <Input
          id={confirmacaoId}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(erros.confirmPassword)}
          aria-describedby={erros.confirmPassword ? `${confirmacaoId}-error` : undefined}
        />
        {erros.confirmPassword && (
          <p id={`${confirmacaoId}-error`} className="text-sm text-danger">
            {erros.confirmPassword}
          </p>
        )}
      </div>

      {erro && (
        <FormMessage className="rounded-field bg-danger-bg px-3.5 py-2.5">
          {erro.texto}{" "}
          {erro.linkVencido && (
            <Link href="/esqueci-senha" className="font-semibold underline">
              Pedir outro link
            </Link>
          )}
        </FormMessage>
      )}

      <Button type="submit" variant="primario" loading={pending} className="w-full">
        {pending ? "Salvando..." : "Salvar senha nova"}
      </Button>
    </form>
  );
}
