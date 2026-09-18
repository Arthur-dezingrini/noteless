import { env } from "../env";

/**
 * Qual serviço faz cada etapa, a partir do que há no .env. A regra é
 * "funciona com uma chave grátis": só GROQ_API_KEY já resolve tudo; as outras
 * variáveis refinam.
 */
const GROQ_BASE = "https://api.groq.com/openai/v1";

export type Transcricao = { baseUrl: string; apiKey: string; modelo: string };

export function transcricao(): Transcricao | null {
  if (env.TRANSCRICAO_API_KEY) {
    return {
      baseUrl: env.TRANSCRICAO_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: env.TRANSCRICAO_API_KEY,
      modelo: env.TRANSCRICAO_MODELO ?? "whisper-1",
    };
  }
  if (env.GROQ_API_KEY) {
    return { baseUrl: GROQ_BASE, apiKey: env.GROQ_API_KEY, modelo: env.TRANSCRICAO_MODELO ?? "whisper-large-v3-turbo" };
  }
  return null;
}

export type Interpretacao =
  | { tipo: "anthropic"; apiKey: string; modelo: string }
  | { tipo: "openai"; baseUrl: string; apiKey: string; modelo: string };

export function interpretacao(): Interpretacao | null {
  if (env.ANTHROPIC_API_KEY) {
    return { tipo: "anthropic", apiKey: env.ANTHROPIC_API_KEY, modelo: env.IA_MODELO ?? "claude-sonnet-5" };
  }
  if (env.GROQ_API_KEY) {
    return { tipo: "openai", baseUrl: GROQ_BASE, apiKey: env.GROQ_API_KEY, modelo: env.IA_MODELO ?? "openai/gpt-oss-120b" };
  }
  return null;
}
