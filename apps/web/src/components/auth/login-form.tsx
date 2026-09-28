"use client";

import { loginSchema } from "@vocare/shared";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
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
function destinoSeguro(valor?: string): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//")) {
    return "/dashboard";
  }
  return valor;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();

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
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor={emailId} className="block text-sm font-medium text-ink">
          E-mail
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@fazenda.com.br"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
          className={`${fieldClasses} ${
            fieldErrors.email ? "border-red-400" : "border-field-border"
          }`}
        />
        {fieldErrors.email && (
          <p id={`${emailId}-error`} className="text-xs text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor={passwordId}
            className="block text-sm font-medium text-ink"
          >
            Senha
          </label>
          <Link
            href="/recuperar-senha"
            className="text-xs font-medium text-brand hover:underline"
          >
            Esqueceu a senha?
          </Link>
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
            className={`${fieldClasses} pr-11 ${
              fieldErrors.password ? "border-red-400" : "border-field-border"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-ink-muted transition hover:text-ink"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {fieldErrors.password && (
          <p id={`${passwordId}-error`} className="text-xs text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {formError && (
        <p
          role="alert"
          className="rounded-field bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
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
