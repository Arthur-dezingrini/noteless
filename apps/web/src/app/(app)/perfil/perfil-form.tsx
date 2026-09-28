"use client";

import { Camera, LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@vocare/shared";

import { Avatar } from "@/components/app/avatar";
import { btn } from "@/components/app/ui";

const TAMANHO_MAXIMO = 2 * 1024 * 1024;

function lerArquivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function PerfilForm({ user, papel }: { user: Session["user"]; papel: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [imagem, setImagem] = useState(user.image ?? "");
  const [alterada, setAlterada] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState("");

  async function selecionarImagem(file?: File) {
    setErro("");
    setSucesso("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErro("Escolha uma imagem PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > TAMANHO_MAXIMO) {
      setErro("A imagem deve ter no máximo 2 MB.");
      return;
    }
    setImagem(await lerArquivo(file));
    setAlterada(true);
  }

  async function salvar() {
    if (!imagem) return;
    setSalvando(true);
    setErro("");
    setSucesso("");
    try {
      const resposta = await fetch("/api/perfil/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imagem }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(dados?.error ?? "Não foi possível salvar a foto.");
      setAlterada(false);
      setSucesso("Foto de perfil atualizada.");
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a foto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-5 border-b border-line pb-7">
        <div className="relative">
          <Avatar name={user.name || user.email} image={imagem} className="size-24 text-2xl" />
          <span className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-sm"><Camera className="size-4" /></span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{user.name}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{papel || "Membro"}</p>
          <button type="button" onClick={() => inputRef.current?.click()} className={`${btn.secundario} mt-3`}>
            <Upload className="size-4" /> Escolher foto
          </button>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void selecionarImagem(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          <p className="mt-2 text-xs text-ink-muted">PNG, JPEG ou WebP de até 2 MB.</p>
        </div>
      </div>

      <dl className="mt-7 grid gap-5 sm:grid-cols-2">
        <div><dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">Nome</dt><dd className="mt-1 text-sm text-ink">{user.name}</dd></div>
        <div><dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">E-mail</dt><dd className="mt-1 break-all text-sm text-ink">{user.email}</dd></div>
      </dl>

      {(erro || sucesso || alterada) && <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        {sucesso && <p role="status" className="text-sm text-brand">{sucesso}</p>}
        {alterada && <button type="button" onClick={() => void salvar()} disabled={salvando} className={btn.primario}>{salvando && <LoaderCircle className="size-4 animate-spin" />}{salvando ? "Salvando..." : "Salvar foto"}</button>}
      </div>}
    </div>
  );
}
