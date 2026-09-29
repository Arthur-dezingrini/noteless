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

/**
 * Na Vercel, o endereço público sai das variáveis que a plataforma injeta:
 * web e api ficam no mesmo domínio (vercel.json), então BETTER_AUTH_URL e
 * WEB_URL são a mesma URL. Definidas no painel (domínio próprio), elas vencem.
 */
const { VERCEL_ENV, VERCEL_PROJECT_PRODUCTION_URL, VERCEL_BRANCH_URL, VERCEL_URL } = process.env;
const https = (host: string | undefined) => (host ? `https://${host}` : undefined);
const hostsVercel = [VERCEL_PROJECT_PRODUCTION_URL, VERCEL_BRANCH_URL, VERCEL_URL].map(https).filter((u): u is string => !!u);
// Produção atende no domínio do projeto; preview, no endereço da branch.
const urlVercel = VERCEL_ENV === "production" ? https(VERCEL_PROJECT_PRODUCTION_URL) : https(VERCEL_BRANCH_URL ?? VERCEL_URL);
if (urlVercel) {
  process.env.BETTER_AUTH_URL ||= urlVercel;
  process.env.WEB_URL ||= urlVercel;
}

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
 * Quem pode fazer login e chamar a api pelo navegador: o front e, na Vercel,
 * também os endereços de preview (cada pull request tem o seu).
 */
export const origensConfiaveis = [...new Set([env.WEB_URL, ...hostsVercel])];
