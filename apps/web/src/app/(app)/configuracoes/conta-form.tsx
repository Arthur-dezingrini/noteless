"use client";

import { TIPOS_CONTA, type Organization, type OrganizationMetadata } from "@vocare/shared";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { authClient } from "@/lib/auth/client";

function Campo({ label, dica, children, largo }: { label: string; dica?: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${largo ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-semibold text-ink">
        {label}
        {dica && <span className="font-normal text-ink-muted"> {dica}</span>}
      </span>
      {children}
    </label>
  );
}

/** Dados da conta: serve para sítio, casa, clínica, canil… */
export function ContaForm({ org }: { org: Organization }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string } | null>(null);
  const meta = org.metadata ?? {};

  function salvar(form: HTMLFormElement) {
    setAviso(null);
    const f = new FormData(form);
    const nome = String(f.get("nome") ?? "").trim();
    if (nome.length < 2) return setAviso({ ok: false, msg: "Informe o nome da conta." });
    const metadata: OrganizationMetadata = {
      tipo: String(f.get("tipo") ?? ""),
      cnpj: String(f.get("cnpj") ?? "").trim(),
      telefone: String(f.get("telefone") ?? "").trim(),
      email: String(f.get("email") ?? "").trim(),
      endereco: String(f.get("endereco") ?? "").trim(),
    };
    start(async () => {
      // Nome tem coluna própria; o resto vai no metadata (JSON) da organização.
      const { error } = await authClient.organization.update({ organizationId: org.id, data: { name: nome, metadata } });
      if (error) {
        return setAviso({
          ok: false,
          msg: error.status === 403 ? "Só administradores podem alterar os dados da conta." : "Não foi possível salvar. Tente de novo.",
        });
      }
      setAviso({ ok: true, msg: "Alterações salvas." });
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar(e.currentTarget);
      }}
      className="grid max-w-[640px] gap-4 sm:grid-cols-2"
    >
      <Campo label="Nome da conta">
        <input name="nome" className={campo} defaultValue={org.name} required />
      </Campo>
      <Campo label="Tipo">
        <Select name="tipo" defaultValue={meta.tipo ?? ""}>
          <option value="" disabled>
            Escolha
          </option>
          {TIPOS_CONTA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo label="CPF ou CNPJ" dica="(opcional)">
        <input name="cnpj" className={campo} defaultValue={meta.cnpj ?? ""} inputMode="numeric" />
      </Campo>
      <Campo label="Telefone">
        <input name="telefone" type="tel" className={campo} defaultValue={meta.telefone ?? ""} placeholder="(34) 99812-4471" />
      </Campo>
      <Campo label="E-mail" largo>
        <input name="email" type="email" className={campo} defaultValue={meta.email ?? ""} placeholder="contato@exemplo.com.br" />
      </Campo>
      <Campo label="Endereço" largo>
        <input name="endereco" className={campo} defaultValue={meta.endereco ?? ""} placeholder="Estrada, km, cidade, UF" />
      </Campo>
      <div className="flex items-center justify-end gap-4 sm:col-span-2">
        {aviso && (
          <p role="status" className={`text-sm ${aviso.ok ? "text-brand-ink" : "text-danger"}`}>
            {aviso.msg}
          </p>
        )}
        <button type="submit" disabled={pending} className={btn.primario}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Salvar alterações
        </button>
      </div>
    </form>
  );
}
