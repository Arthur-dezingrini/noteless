"use client";

import { atualizarPerfilSchema, type Session } from "@vocare/shared";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { initials } from "@/components/app/avatar";
import { btn, campo } from "@/components/app/ui";
import { chamarApi } from "@/lib/api-client";

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
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imagem, setImagem] = useState(user.image ?? "");
  const [fotoNova, setFotoNova] = useState(false);
  const [nome, setNome] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, start] = useTransition();
  const alterado = fotoNova || nome.trim() !== user.name || email.trim().toLowerCase() !== user.email.toLowerCase();

  async function escolherFoto(file?: File) {
    setAviso(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setAviso({ ok: false, msg: "Escolha uma imagem PNG, JPEG ou WebP." });
    if (file.size > TAMANHO_MAXIMO) return setAviso({ ok: false, msg: "A imagem deve ter no máximo 2 MB." });
    setImagem(await lerArquivo(file));
    setFotoNova(true);
  }

  function salvar() {
    setAviso(null);
    const parsed = atualizarPerfilSchema.safeParse({ name: nome, email });
    if (!parsed.success) return setAviso({ ok: false, msg: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    start(async () => {
      if (fotoNova && imagem) {
        const err = await chamarApi("/api/perfil/avatar", { method: "PATCH", body: JSON.stringify({ image: imagem }) });
        if (err) return setAviso({ ok: false, msg: err });
        setFotoNova(false);
      }
      const err = await chamarApi("/api/perfil", { method: "PATCH", body: JSON.stringify(parsed.data) });
      if (err) return setAviso({ ok: false, msg: err });
      setAviso({ ok: true, msg: "Perfil salvo." });
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
      className="flex max-w-[560px] flex-col gap-5"
    >
      <div className="flex items-center gap-4">
        {imagem ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL local, sem otimização possível
          <img src={imagem} alt="" className="size-[72px] rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="grid size-[72px] place-items-center rounded-full bg-[#e9e5dc] text-xl font-semibold text-ink">
            {initials(nome || user.email)}
          </span>
        )}
        <button type="button" onClick={() => inputRef.current?.click()} className={btn.secundario}>
          Trocar foto
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Escolher foto"
          onChange={(e) => {
            void escolherFoto(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} autoComplete="email" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Papel</span>
          <span className="text-[15px] text-ink-soft">{papel}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        {aviso && (
          <p role="status" className={`text-sm ${aviso.ok ? "text-brand-ink" : "text-danger"}`}>
            {aviso.msg}
          </p>
        )}
        <button type="submit" disabled={pending || !alterado} className={btn.primario}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Salvar
        </button>
      </div>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 className="text-base font-semibold text-ink">Atalhos de teclado</h2>
        <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-2 text-[15px] text-ink-soft">
          <dt>
            <kbd className="rounded-md border border-button-border bg-white px-2 py-0.5 text-[13px] font-semibold text-ink">Esc</kbd>
          </dt>
          <dd>Fechar janelas, menus e notificações</dd>
          <dt>
            <kbd className="rounded-md border border-button-border bg-white px-2 py-0.5 text-[13px] font-semibold text-ink">Tab</kbd>
          </dt>
          <dd>Andar pelos botões e listas. Enter abre.</dd>
        </dl>
      </section>
    </form>
  );
}
