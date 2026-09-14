"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { login, type LoginState } from "@/lib/auth/actions";

const INITIAL_STATE: LoginState = {};

const fieldClasses =
  "w-full rounded-field border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);
  const [showPassword, setShowPassword] = useState(false);
  // O React 19 reseta o form depois da action. O e-mail fica controlado para
  // sobreviver a um erro de login; a senha é descartada de propósito.
  const [email, setEmail] = useState("");
  const emailId = useId();
  const passwordId = useId();

  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <form action={formAction} noValidate className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? `${emailId}-error` : undefined}
          className={`${fieldClasses} ${
            emailError ? "border-red-400" : "border-field-border"
          }`}
        />
        {emailError && (
          <p id={`${emailId}-error`} className="text-xs text-red-600">
            {emailError}
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
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            className={`${fieldClasses} pr-11 ${
              passwordError ? "border-red-400" : "border-field-border"
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
        {passwordError && (
          <p id={`${passwordId}-error`} className="text-xs text-red-600">
            {passwordError}
          </p>
        )}
      </div>

      {state.formError && (
        <p
          role="alert"
          className="rounded-field bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
        >
          {state.formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-field bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
