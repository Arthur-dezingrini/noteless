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
