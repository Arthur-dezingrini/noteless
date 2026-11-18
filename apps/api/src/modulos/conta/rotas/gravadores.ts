import { aprovarGravadorSchema, estadoGravadorSchema, mudarGravadorSchema } from "@vocare/shared";
import type { Context } from "hono";
import { Hono } from "hono";

import { credencialGravador } from "../../../base/gravador-atual";
import { membroAtual } from "../../../base/membro-atual";
import { quemNaPlataforma } from "../../../base/super-usuario";
import { listarFirmwares, pedacoDoFirmware } from "../consultas/firmware";
import { listarGravadores } from "../consultas/gravadores";
import { atualizarTodas, chavePrivadaFirmware, firmwareDaPlaca, publicarFirmware } from "../regras/firmware";
import { aprovarGravador, esquecerGravador, mudarGravador, receberEstado } from "../regras/gravadores";

const corpo = async (c: Context) => c.req.json().catch(() => null);
const invalido = (e: { issues: { message: string }[] }) => ({ error: e.issues[0]?.message ?? "Dados inválidos." });

/**
 * A placa avisando o estado, com a série e o segredo dela (sem conta). Placa
 * nova ou ainda não aprovada: 202, aguardando. Montado em /api/gravadores.
 */
export const gravadoresRoutes = new Hono();

gravadoresRoutes.post("/estado", async (c) => {
  const cred = credencialGravador(c.req.raw.headers);
  if (!cred) return c.json({ error: "Só o gravador avisa o estado (cabeçalho Authorization: Gravador <série> <segredo>)." }, 401);
  const body = estadoGravadorSchema.safeParse(await corpo(c));
  if (!body.success) return c.json(invalido(body.error), 400);
  const r = await receberEstado(cred, body.data);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  return c.json(r.valor.resposta, r.valor.aguardando ? 202 : 200);
});

/**
 * A placa baixando a versão do firmware que é o alvo dela, em pedaços (Range:
 * bytes=início-fim): com o Wi-Fi caindo, ela continua de onde parou.
 */
gravadoresRoutes.get("/firmware/:versao", async (c) => {
  const cred = credencialGravador(c.req.raw.headers);
  if (!cred) return c.json({ error: "Só o gravador baixa o firmware (cabeçalho Authorization: Gravador <série> <segredo>)." }, 401);
  const versao = c.req.param("versao");
  const r = await firmwareDaPlaca(cred, versao);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const { tamanho } = r.valor;
  const range = /^bytes=(\d+)-(\d*)$/.exec(c.req.header("range") ?? "");
  const inicio = range ? Number(range[1]) : 0;
  const fim = range?.[2] ? Math.min(Number(range[2]), tamanho - 1) : tamanho - 1;
  if (inicio >= tamanho || fim < inicio) return c.body(null, 416, { "Content-Range": `bytes */${tamanho}` });
  const dados = await pedacoDoFirmware(versao, inicio, fim - inicio + 1);
  return c.body(new Uint8Array(dados), range ? 206 : 200, {
    "Content-Type": "application/octet-stream",
    ...(range ? { "Content-Range": `bytes ${inicio}-${inicio + dados.length - 1}/${tamanho}` } : {}),
  });
});

/** Os gravadores que mandam notas para a empresa: administrador vê, sem mexer. Montado em /api/org. */
export const gravadoresOrgRoutes = new Hono();

gravadoresOrgRoutes.get("/:orgId/gravadores", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);
  if (eu.role === "member") return c.json({ error: "Só administradores veem os gravadores." }, 403);
  return c.json(await listarGravadores(orgId));
});

/** Todos os gravadores: ver, aprovar, renomear, escolher a empresa e esquecer. Só super usuário. Montado em /api/admin/gravadores. */
export const gravadoresAdminRoutes = new Hono();

gravadoresAdminRoutes.use(async (c, next) => {
  const q = await quemNaPlataforma(c.req.raw.headers);
  if (!q) return c.json({ error: "Faça login." }, 401);
  if (!q.ehSuper) return c.json({ error: "Só o super usuário mexe nos gravadores." }, 403);
  await next();
});

gravadoresAdminRoutes.get("/", async (c) => c.json(await listarGravadores()));

gravadoresAdminRoutes.get("/firmware", async (c) => c.json(await listarFirmwares()));

/** Publica um firmware (.bin, campo `firmware`): a versão vem de dentro dele. */
gravadoresAdminRoutes.post("/firmware", async (c) => {
  const chave = chavePrivadaFirmware();
  if (!chave) return c.json({ error: "Publicar firmware precisa da chave FIRMWARE_CHAVE_PRIVADA no servidor." }, 503);
  const body = await c.req.parseBody().catch(() => null);
  const arquivo = body?.firmware;
  if (!(arquivo instanceof File) || arquivo.size === 0) return c.json({ error: "Envie o arquivo .bin no campo 'firmware'." }, 400);
  const q = await quemNaPlataforma(c.req.raw.headers);
  const r = await publicarFirmware(new Uint8Array(await arquivo.arrayBuffer()), chave, q!.userId);
  return r.ok ? c.json(r.valor, 201) : c.json({ error: r.erro }, r.status);
});

/** Todas as placas aprovadas passam a ter essa versão como alvo. */
gravadoresAdminRoutes.post("/firmware/:versao/todas", async (c) => {
  const r = await atualizarTodas(c.req.param("versao"));
  return r.ok ? c.json(r.valor) : c.json({ error: r.erro }, r.status);
});

gravadoresAdminRoutes.post("/:id/aprovar", async (c) => {
  const body = aprovarGravadorSchema.safeParse(await corpo(c));
  if (!body.success) return c.json(invalido(body.error), 400);
  const r = await aprovarGravador(c.req.param("id"), body.data);
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.erro }, r.status);
});

gravadoresAdminRoutes.patch("/:id", async (c) => {
  const body = mudarGravadorSchema.safeParse(await corpo(c));
  if (!body.success) return c.json(invalido(body.error), 400);
  const r = await mudarGravador(c.req.param("id"), body.data);
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.erro }, r.status);
});

gravadoresAdminRoutes.delete("/:id", async (c) => {
  const r = await esquecerGravador(c.req.param("id"));
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.erro }, r.status);
});
