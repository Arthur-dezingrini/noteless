import { z } from "zod";

// Efeito colateral proposital: precisa rodar antes da validação abaixo.
import "./load-env";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "gere com: openssl rand -base64 32"),
  BETTER_AUTH_URL: z.string().url(),
  WEB_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // IA das ocorrências. Opcionais: sem elas a api sobe, e a rota de áudio
  // responde 503 explicando o que falta.
  ANTHROPIC_API_KEY: z.string().optional(),
  IA_MODELO: z.string().default("claude-sonnet-5"),
  // Transcrição por qualquer serviço compatível com a API da OpenAI
  // (OpenAI, Groq…): base + chave + modelo.
  TRANSCRICAO_API_KEY: z.string().optional(),
  TRANSCRICAO_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  TRANSCRICAO_MODELO: z.string().default("whisper-1"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Falhar na subida, com a lista exata, é muito mais barato que descobrir
  // uma variável faltando no primeiro request.
  console.error("Variáveis de ambiente inválidas:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
