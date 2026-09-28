import { z } from "zod";

/** Espécies aceitas no cadastro. A chave vai ao banco; o rótulo, à tela. */
export const ESPECIES = [
  "cao",
  "gato",
  "coelho",
  "ave",
  "roedor",
  "bovino",
  "equino",
  "ovino",
  "caprino",
  "suino",
  "outro",
] as const;
export const especieSchema = z.enum(ESPECIES);
export type Especie = z.infer<typeof especieSchema>;

export const ROTULO_ESPECIE: Record<Especie, string> = {
  cao: "Cão",
  gato: "Gato",
  coelho: "Coelho",
  ave: "Ave",
  roedor: "Roedor",
  bovino: "Bovino",
  equino: "Equino",
  ovino: "Ovino",
  caprino: "Caprino",
  suino: "Suíno",
  outro: "Outro",
};

export const SEXOS = ["macho", "femea"] as const;
export const sexoSchema = z.enum(SEXOS);
export type Sexo = z.infer<typeof sexoSchema>;

export const ROTULO_SEXO: Record<Sexo, string> = {
  macho: "Macho",
  femea: "Fêmea",
};

export const STATUS_ANIMAL = ["ativo", "inativo"] as const;
export const statusAnimalSchema = z.enum(STATUS_ANIMAL);
export type StatusAnimal = z.infer<typeof statusAnimalSchema>;

export const ROTULO_STATUS_ANIMAL: Record<StatusAnimal, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

/** Datas viajam como "AAAA-MM-DD" — sem fuso, igual ao `date` do Postgres. */
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

/** Um animal como a lista mostra. */
export const animalSchema = z.object({
  id: z.string(),
  /** Número do brinco, coleira ou registro. */
  numero: z.string().nullish(),
  /** Pode vir vazio quando o animal só tem número. */
  nome: z.string(),
  especie: especieSchema,
  raca: z.string().nullish(),
  sexo: sexoSchema.nullish(),
  nascimento: dataIso.nullish(),
  pesoKg: z.number().nullish(),
  tutor: z.string().nullish(),
  tutorTelefone: z.string().nullish(),
  microchip: z.string().nullish(),
  /** "Onde fica": Casa, Baia 1, Lote 2… */
  local: z.string().nullish(),
  ultimaVisita: dataIso.nullish(),
  status: statusAnimalSchema,
  /** Tem tratamento em andamento (calculado pela api). */
  emTratamento: z.boolean().optional(),
  createdAt: z.coerce.date(),
});

export const animalListaSchema = z.array(animalSchema);
export type Animal = z.infer<typeof animalSchema>;

const texto = (max: number) => z.string().trim().max(max, `No máximo ${max} caracteres.`);

/** Campo opcional do formulário: vazio chega como null, não como "". */
const baseAnimalSchema = z.object({
  numero: texto(30).nullish(),
  nome: texto(80).nullish(),
  especie: especieSchema,
  raca: texto(60).nullish(),
  sexo: sexoSchema.nullish(),
  nascimento: dataIso.nullish(),
  pesoKg: z.coerce.number().positive("Peso inválido.").max(5000, "Peso inválido.").nullish(),
  tutor: texto(120).nullish(),
  tutorTelefone: texto(30).nullish(),
  microchip: texto(40).nullish(),
  local: texto(60).nullish(),
  ultimaVisita: dataIso.nullish(),
});
export type CriarAnimalInput = z.infer<typeof baseAnimalSchema>;

/** "Só o nome ou o número e a espécie são obrigatórios." */
const temNomeOuNumero = (d: { nome?: string | null; numero?: string | null }) => !!(d.nome || d.numero);
const nomeOuNumero = { message: "Informe o nome ou o número do animal.", path: ["nome"] };

/** A edição manda o cadastro inteiro de volta, mais o status. */
export const criarAnimalSchema = baseAnimalSchema.refine(temNomeOuNumero, nomeOuNumero);

export const atualizarAnimalSchema = baseAnimalSchema
  .extend({ status: statusAnimalSchema })
  .refine(temNomeOuNumero, nomeOuNumero);
export type AtualizarAnimalInput = z.infer<typeof atualizarAnimalSchema>;

/** "nº 07 Thor", "Thor" ou "nº 47" — como o animal aparece em toda a tela. */
export function rotuloAnimal(a: { numero?: string | null; nome?: string | null }): string {
  const nome = a.nome?.trim();
  if (a.numero && nome) return `nº ${a.numero} ${nome}`;
  if (a.numero) return `nº ${a.numero}`;
  return nome || "Sem nome";
}
