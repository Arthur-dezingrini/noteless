import { env } from "../env";

export class IaNaoConfigurada extends Error {
  constructor(oQue: string) {
    super(`${oQue} não está configurada nesta api. Veja .env.example.`);
  }
}

/**
 * Áudio → texto, pela API de transcrição compatível com a OpenAI
 * (`/audio/transcriptions`). Serve OpenAI, Groq e afins — muda só a base e o
 * modelo no .env. Português forçado: o Whisper acerta mais quando sabe a
 * língua, e sotaque de campo já é desafio suficiente.
 */
export async function transcrever(audio: File): Promise<string> {
  if (!env.TRANSCRICAO_API_KEY) throw new IaNaoConfigurada("A transcrição de áudio");

  const form = new FormData();
  form.set("file", audio, audio.name || "audio.webm");
  form.set("model", env.TRANSCRICAO_MODELO);
  form.set("language", "pt");
  form.set("response_format", "json");

  const res = await fetch(`${env.TRANSCRICAO_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TRANSCRICAO_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Transcrição falhou (${res.status}): ${corpo.slice(0, 300)}`);
  }

  const { text } = (await res.json()) as { text?: string };
  return (text ?? "").trim();
}
