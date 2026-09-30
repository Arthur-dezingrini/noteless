import { z } from "zod";

// Efeito colateral proposital: precisa rodar antes da validação abaixo.
import "./load-env";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "gere com: openssl rand -base64 32"),
  // Front e api em projetos separados: o navegador só fala com o front, que
  // repassa /api/* para cá. As duas são a URL pública DO FRONT.
  BETTER_AUTH_URL: z.string().url(),
  WEB_URL: z.string().url(),
  // Outras origens que podem fazer login, separadas por vírgula.
  ORIGENS_EXTRAS: z
    .string()
    .optional()
    .transform((v) => v?.split(",").map((o) => o.trim()).filter(Boolean))
    .pipe(z.array(z.string().url("ORIGENS_EXTRAS: cada item precisa ser uma URL, como https://app.exemplo.com")).optional()),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // IA das ocorrências. Tudo opcional: sem chave nenhuma a api sobe e a rota
  // de áudio responde 503 explicando. A resolução de qual serviço usar fica
  // em src/ia/provedor.ts.
  GROQ_API_KEY: z.string().optional(), // grátis: transcrição + interpretação
  ANTHROPIC_API_KEY: z.string().optional(), // se presente, interpreta com Claude
  IA_MODELO: z.string().optional(), // sobrescreve o modelo padrão do provedor
  // Transcrição por outro serviço compatível com a API da OpenAI.
  TRANSCRICAO_API_KEY: z.string().optional(),
  TRANSCRICAO_BASE_URL: z.string().url().optional(),
  TRANSCRICAO_MODELO: z.string().optional(),
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

/**
 * Quem pode fazer login e chamar a api pelo navegador: o front (WEB_URL) e o
 * que vier em ORIGENS_EXTRAS — domínio próprio, endereço de preview.
 */
export const origensConfiaveis = [...new Set([env.WEB_URL, ...(env.ORIGENS_EXTRAS ?? [])])];
