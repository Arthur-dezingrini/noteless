"use client";

import { loginSchema } from "@vocare/shared";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { authClient } from "@/lib/auth/client";
import { btn } from "@/components/app/ui";

type FieldErrors = { email?: string; password?: string };

const fieldClasses =
  "h-11 w-full rounded-field border bg-white px-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-field-border-focus focus:ring-2 focus:ring-brand/20";

/**
 * Só aceita caminho interno. Sem isso, `?next=https://site-falso` transformaria
 * o login num redirecionador aberto.
 */
function destinoSeguro(valor?: string): Route {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//")) {
    return "/dashboard";
  }
  return valor as Route;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHint, setShowForgotHint] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();
  const forgotHintId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      // O navegador chama /api/auth/sign-in/email; o rewrite leva à api, que
      // grava o cookie de sessão direto na resposta.
      const { error } = await authClient.signIn.email(parsed.data);

      if (error) {
        // Mensagem única de propósito: dizer "esse e-mail não existe" entrega a
        // quem está sondando quais contas são válidas.
        setFormError(
          error.status === 401 || error.status === 403 || error.status === 400
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar agora. Tente de novo.",
        );
        return;
      }

      router.push(destinoSeguro(next));
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <label htmlFor={emailId} className="block text-sm font-semibold text-ink">
          E-mail
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com.br"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
          className={`${fieldClasses} ${
            fieldErrors.email ? "border-danger" : "border-field-border"
          }`}
        />
        {fieldErrors.email && (
          <p id={`${emailId}-error`} className="text-sm text-danger">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={passwordId} className="block text-sm font-semibold text-ink">
            Senha
          </label>
          {/* Ainda não há recuperação por e-mail: quem redefine a senha é um
              administrador, em Configurações → Usuários. */}
          <button
            type="button"
            onClick={() => setShowForgotHint((v) => !v)}
            aria-expanded={showForgotHint}
            aria-controls={forgotHintId}
            className="cursor-pointer text-sm font-semibold text-brand-ink hover:underline"
          >
            Esqueci a senha
          </button>
        </div>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? `${passwordId}-error` : undefined
            }
            className={`${fieldClasses} pr-24 ${
              fieldErrors.password ? "border-danger" : "border-field-border"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-1 right-1 cursor-pointer rounded-lg px-3 text-sm font-semibold text-ink-soft transition hover:bg-hover hover:text-ink"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {fieldErrors.password && (
          <p id={`${passwordId}-error`} className="text-sm text-danger">
            {fieldErrors.password}
          </p>
        )}
        {showForgotHint && (
          <p id={forgotHintId} className="text-sm text-ink-soft">
            Peça ao administrador da sua fazenda para definir uma nova senha.
          </p>
        )}
      </div>

      {formError && (
        <p
          role="alert"
          className="rounded-field bg-danger-bg px-3.5 py-2.5 text-sm text-danger"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${btn.primario} w-full`}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
