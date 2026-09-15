"use client";

import type { Organization, OrganizationMetadata } from "@vocare/shared";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Card, CardHeader } from "@/components/app/card";
import { Toggle } from "@/components/app/toggle";
import { authClient } from "@/lib/auth/client";

const inputClasses =
  "w-full rounded-lg border border-field-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";

function Campo({
  label,
  children,
  className = "",
}: {
  label: string;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export function ClinicaForm({ org }: { org: Organization }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const meta = org.metadata ?? {};
  const [nome, setNome] = useState(org.name);
  const [cnpj, setCnpj] = useState(meta.cnpj ?? "");
  const [telefone, setTelefone] = useState(meta.telefone ?? "");
  const [email, setEmail] = useState(meta.email ?? "");
  const [endereco, setEndereco] = useState(meta.endereco ?? "");
  const [abertura, setAbertura] = useState(meta.horarioAbertura ?? "08:00");
  const [fechamento, setFechamento] = useState(meta.horarioFechamento ?? "19:00");
  const [confirmacao, setConfirmacao] = useState(
    meta.preferencias?.confirmacaoAutomatica ?? true,
  );
  const [alertasEstoque, setAlertasEstoque] = useState(
    meta.preferencias?.alertasEstoque ?? true,
  );

  function salvar() {
    setFeedback(null);
    const metadata: OrganizationMetadata = {
      cnpj,
      telefone,
      email,
      endereco,
      horarioAbertura: abertura,
      horarioFechamento: fechamento,
      preferencias: { confirmacaoAutomatica: confirmacao, alertasEstoque },
    };

    startTransition(async () => {
      // Sem tabela nova: nome tem coluna própria, o resto vai no metadata
      // (JSON) da organização. A api exige papel owner/admin para isso.
      const { error } = await authClient.organization.update({
        organizationId: org.id,
        data: { name: nome.trim(), metadata },
      });

      if (error) {
        setFeedback({
          ok: false,
          msg:
            error.status === 403
              ? "Só administradores podem alterar os dados da clínica."
              : "Não foi possível salvar. Tente de novo.",
        });
        return;
      }

      setFeedback({ ok: true, msg: "Alterações salvas." });
      // O nome aparece no menu lateral (layout) — refresh pra ele acompanhar.
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader title="Dados da clínica" />
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
          <Campo label="Nome da clínica">
            {(id) => (
              <input id={id} className={inputClasses} value={nome} onChange={(e) => setNome(e.target.value)} required />
            )}
          </Campo>
          <Campo label="CNPJ">
            {(id) => (
              <input id={id} className={inputClasses} value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" inputMode="numeric" />
            )}
          </Campo>
          <Campo label="Telefone">
            {(id) => (
              <input id={id} className={inputClasses} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 3456-7890" type="tel" />
            )}
          </Campo>
          <Campo label="E-mail de contato">
            {(id) => (
              <input id={id} className={inputClasses} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@clinica.com.br" type="email" />
            )}
          </Campo>
          <Campo label="Endereço completo" className="md:col-span-2">
            {(id) => (
              <input id={id} className={inputClasses} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade - UF, CEP" />
            )}
          </Campo>
          <fieldset className="md:col-span-2">
            <legend className="mb-1.5 block text-sm font-medium text-ink">
              Horário de funcionamento
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <input aria-label="Abertura" type="time" className={inputClasses} value={abertura} onChange={(e) => setAbertura(e.target.value)} />
              <input aria-label="Fechamento" type="time" className={inputClasses} value={fechamento} onChange={(e) => setFechamento(e.target.value)} />
            </div>
          </fieldset>
        </div>
      </Card>

      <Card>
        <CardHeader title="Preferências do sistema" />
        <ul className="divide-y divide-line px-5 pb-2">
          <li className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-ink">Confirmação automática de consultas</p>
              <p className="text-xs text-ink-muted">Enviar lembrete 24h antes via WhatsApp</p>
            </div>
            <Toggle checked={confirmacao} onChange={setConfirmacao} label="Confirmação automática de consultas" />
          </li>
          <li className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-ink">Alertas de estoque baixo</p>
              <p className="text-xs text-ink-muted">Notificar quando produto atingir estoque mínimo</p>
            </div>
            <Toggle checked={alertasEstoque} onChange={setAlertasEstoque} label="Alertas de estoque baixo" />
          </li>
        </ul>
      </Card>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
        {feedback && (
          <p
            role="status"
            className={`text-sm ${feedback.ok ? "text-brand" : "text-red-600"}`}
          >
            {feedback.msg}
          </p>
        )}
      </div>
    </form>
  );
}
