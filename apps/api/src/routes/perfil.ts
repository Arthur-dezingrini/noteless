import { atualizarPerfilSchema } from "@vocare/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/schema";

const imagemSchema = z.object({
  image: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Envie uma imagem PNG, JPEG ou WebP.")
    .max(2_800_000, "A imagem deve ter no máximo 2 MB."),
});

/** Atualizações pessoais que não pertencem à administração da organização. */
export const perfilRoutes = new Hono();

perfilRoutes.patch("/avatar", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Não autenticado." }, 401);

  const body = imagemSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Imagem inválida." }, 400);

  await db.update(user).set({ image: body.data.image }).where(eq(user.id, session.user.id));
  return c.json({ image: body.data.image });
});

/** Nome e e-mail da própria pessoa. E-mail novo não pode ser de outra conta. */
perfilRoutes.patch("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Não autenticado." }, 401);

  const body = atualizarPerfilSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const ctx = await auth.$context;
  const mudouEmail = body.data.email !== session.user.email.toLowerCase();
  if (mudouEmail) {
    const existente = await ctx.internalAdapter.findUserByEmail(body.data.email);
    if (existente && existente.user.id !== session.user.id) {
      return c.json({ error: `Já existe uma conta com o e-mail ${body.data.email}.` }, 409);
    }
  }

  await ctx.internalAdapter.updateUser(session.user.id, {
    name: body.data.name,
    ...(mudouEmail && { email: body.data.email, emailVerified: false }),
  });
  return c.json({ ok: true });
});
