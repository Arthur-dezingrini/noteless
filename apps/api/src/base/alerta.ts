import { env } from "../env";
import { APP_ENV } from "../load-env";
import { enviarEmail, type Email } from "./email";

/**
 * Alerta por e-mail quando algo quebra na api. Leva tipo, hora, rota, empresa
 * e a mensagem do erro, nunca transcrição, resumo ou áudio. O mesmo tipo sai
 * no máximo uma vez a cada 15 min por instância: o controle fica em memória,
 * então numa queda com várias instâncias pode chegar mais de um.
 */
export type DetalheAlerta = { mensagem: string; rota?: string; orgId?: string };
type Envio = { enviado: boolean };

export const JANELA_ALERTA_MS = 15 * 60 * 1000;
const MAX_MENSAGEM = 500;

const horaDeBrasilia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "medium",
});

/** Diz se o tipo pode sair agora; ao dizer que sim, já conta o envio. */
export function criarLimitador(janelaMs: number, agora: () => number = Date.now): (tipo: string) => boolean {
  const ultimo = new Map<string, number>();
  return (tipo) => {
    const t = agora();
    const antes = ultimo.get(tipo);
    if (antes !== undefined && t - antes < janelaMs) return false;
    ultimo.set(tipo, t);
    return true;
  };
}

export function criarAlerta(deps: {
  enviar: (e: Email) => Promise<Envio>;
  destinatarios: string[];
  ambiente: string;
  agora?: () => number;
}): (tipo: string, detalhe: DetalheAlerta) => Promise<Envio> {
  const agora = deps.agora ?? Date.now;
  const pode = criarLimitador(JANELA_ALERTA_MS, agora);
  return async (tipo, d) => {
    if (deps.destinatarios.length === 0 || !pode(tipo)) return { enviado: false };
    const texto = [
      `Tipo: ${tipo}`,
      `Quando: ${horaDeBrasilia.format(new Date(agora()))} (Brasília)`,
      `Rota: ${d.rota ?? "—"}`,
      `Empresa: ${d.orgId ?? "—"}`,
      `Erro: ${d.mensagem.slice(0, MAX_MENSAGEM)}`,
    ].join("\n");
    try {
      return await deps.enviar({ para: deps.destinatarios, assunto: `[Noteless ${deps.ambiente}] ${tipo}`, texto });
    } catch (e) {
      console.error("[alerta] falha ao enviar:", e);
      return { enviado: false };
    }
  };
}

const ambiente = APP_ENV || (env.NODE_ENV === "production" ? "prod" : env.NODE_ENV);

/** Quem chama espera (`await`): na Vercel a função pode congelar depois de responder. */
export const alertar = criarAlerta({ enviar: (e) => enviarEmail(e), destinatarios: env.ALERTA_EMAILS, ambiente });

/** "/api/org/<id>/..." → "<id>". */
export function orgDaRota(caminho: string): string | undefined {
  return /^\/api\/org\/([^/]+)/.exec(caminho)?.[1];
}

export function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
