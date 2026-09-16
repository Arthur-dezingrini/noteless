"use client";

import { signupSchema } from "@vocare/shared";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { authClient } from "@/lib/auth/client";

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const fieldClasses =
  "w-full rounded-field border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";

export function SignupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const parsed = signupSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });

    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({
        name: flat.name?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
        confirmPassword: flat.confirmPassword?.[0],
      });
      return;
    }

    setFieldErrors({});

    startTransition(async () => {
      const { error } = await authClient.signUp.email({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        setFormError(
          error.status === 400 || error.status === 409
            ? "Não foi possível criar a conta com este e-mail. Verifique os dados e tente novamente."
            : "Não foi possível criar sua conta agora. Tente de novo.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor={nameId} className="block text-sm font-medium text-ink">
          Nome
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Seu nome completo"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? `${nameId}-error` : undefined}
          className={`${fieldClasses} ${
            fieldErrors.name ? "border-red-400" : "border-field-border"
          }`}
        />
        {fieldErrors.name && (
          <p id={`${nameId}-error`} className="text-xs text-red-600">
            {fieldErrors.name}
          </p>
        )}
      </div>

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
        <label
          htmlFor={passwordId}
          className="block text-sm font-medium text-ink"
        >
          Senha
        </label>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
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
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {fieldErrors.password && (
          <p id={`${passwordId}-error`} className="text-xs text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={confirmPasswordId}
          className="block text-sm font-medium text-ink"
        >
          Confirmar senha
        </label>
        <div className="relative">
          <input
            id={confirmPasswordId}
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repita sua senha"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={
              fieldErrors.confirmPassword
                ? `${confirmPasswordId}-error`
                : undefined
            }
            className={`${fieldClasses} pr-11 ${
              fieldErrors.confirmPassword
                ? "border-red-400"
                : "border-field-border"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={
              showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"
            }
            className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-ink-muted transition hover:text-ink"
          >
            {showConfirmPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <p id={`${confirmPasswordId}-error`} className="text-xs text-red-600">
            {fieldErrors.confirmPassword}
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
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-field bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Criando conta..." : "Criar conta"}
      </button>

      <p className="text-center text-xs text-ink-muted">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
