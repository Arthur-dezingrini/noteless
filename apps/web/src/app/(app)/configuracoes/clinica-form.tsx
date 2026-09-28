"use client";

import type { Organization, OrganizationMetadata } from "@vocare/shared";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Card, CardHeader } from "@/components/app/card";
import { btn, campo } from "@/components/app/ui";
import { authClient } from "@/lib/auth/client";

const inputClasses = campo;

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

  function salvar() {
    setFeedback(null);
    const metadata: OrganizationMetadata = {
      cnpj,
      telefone,
      email,
      endereco,
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
        </div>
      </Card>

      <div className="flex items-center justify-end gap-4">
        {feedback && (
          <p
            role="status"
            className={`text-sm ${feedback.ok ? "text-brand" : "text-red-600"}`}
          >
            {feedback.msg}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={btn.primario}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
