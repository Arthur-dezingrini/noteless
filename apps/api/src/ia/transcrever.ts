import { transcricao } from "./provedor";

export class IaNaoConfigurada extends Error {
  constructor(oQue: string) {
    super(`${oQue} não está configurada nesta api. Veja .env.example.`);
  }
}

/**
 * Áudio → texto, pela API de transcrição compatível com a OpenAI
 * (`/audio/transcriptions`). Serve Groq, OpenAI e afins — muda só a base e o
 * modelo no .env. Português forçado: o Whisper acerta mais quando sabe a
 * língua, e sotaque de campo já é desafio suficiente.
 */
export async function transcrever(audio: File): Promise<string> {
  const cfg = transcricao();
  if (!cfg) throw new IaNaoConfigurada("A transcrição de áudio (GROQ_API_KEY)");

  const form = new FormData();
  form.set("file", audio, audio.name || "audio.webm");
  form.set("model", cfg.modelo);
  form.set("language", "pt");
  form.set("response_format", "json");

  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Transcrição falhou (${res.status}): ${corpo.slice(0, 300)}`);
  }

  const { text } = (await res.json()) as { text?: string };
  return (text ?? "").trim();
}
