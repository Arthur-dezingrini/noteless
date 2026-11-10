"use client";

import { TIPOS_CONTA, type Organization, type OrganizationMetadata } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

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
      <Field label="Nome da conta">
        <Input name="nome" defaultValue={org.name} required />
      </Field>
      <Field label="Tipo">
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
      </Field>
      <Field label="CPF ou CNPJ" hint="(opcional)">
        <Input name="cnpj" defaultValue={meta.cnpj ?? ""} inputMode="numeric" />
      </Field>
      <Field label="Telefone">
        <Input name="telefone" type="tel" defaultValue={meta.telefone ?? ""} placeholder="(34) 99812-4471" />
      </Field>
      <Field label="E-mail" wide>
        <Input name="email" type="email" defaultValue={meta.email ?? ""} placeholder="contato@exemplo.com.br" />
      </Field>
      <Field label="Endereço" wide>
        <Input name="endereco" defaultValue={meta.endereco ?? ""} placeholder="Estrada, km, cidade, UF" />
      </Field>
      <div className="flex items-center justify-end gap-4 sm:col-span-2">
        {aviso && (
          <FormMessage tone={aviso.ok ? "ok" : "perigo"}>{aviso.msg}</FormMessage>
        )}
        <Button type="submit" variant="primario" loading={pending}>
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}
