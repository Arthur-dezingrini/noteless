import type { AcaoEstoque } from "@vocare/shared";
import type { Context } from "hono";
import type { z } from "zod";

import { membroAtual, type MembroAtual } from "../../../base/membro-atual";
import { podeNoEstoque } from "../regras/permissao";

export const SEM_ACESSO = "Sem acesso a esta organização.";
export const SEM_PERMISSAO = "Seu perfil não permite isso no estoque.";

type Acesso = { eu: MembroAtual; resposta?: undefined } | { eu?: undefined; resposta: Response };

/** Confere que quem chama é da organização e pode fazer `acao` no estoque. */
export async function acesso(c: Context, orgId: string, acao: AcaoEstoque): Promise<Acesso> {
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return { resposta: c.json({ error: SEM_ACESSO }, 403) };
  if (!podeNoEstoque(eu.role, acao)) return { resposta: c.json({ error: SEM_PERMISSAO }, 403) };
  return { eu };
}

type Corpo<T> = { dados: T; resposta?: undefined } | { dados?: undefined; resposta: Response };

/** Lê e valida o JSON do corpo; o primeiro erro do schema vira 400. */
export async function corpo<S extends z.ZodType>(c: Context, schema: S): Promise<Corpo<z.infer<S>>> {
  const r = schema.safeParse(await c.req.json().catch(() => null));
  if (!r.success) return { resposta: c.json({ error: r.error.issues[0]?.message ?? "Dados inválidos." }, 400) };
  return { dados: r.data };
}
