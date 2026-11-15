import type { GalpaoParaIa } from "../../aviario";
import type { AnimalParaIa, GrupoParaIa } from "./instrucoes";

/**
 * Palavras que o Whisper não conhece e acaba trocando por outra parecida
 * ("landrace" virava "landraste", "lambrás"). Vão no `prompt` da
 * transcrição, que ele usa como o texto que veio antes do áudio — passa a
 * escrever do mesmo jeito. Por espécie, para não gastar o limite com bicho
 * que a empresa não tem.
 */
const RACAS: Record<string, string[]> = {
  bovino: ["Nelore", "Angus", "Brangus", "Girolando", "Gir", "Guzerá", "Holandesa", "Jersey", "Senepol", "Tabapuã"],
  suino: ["Landrace", "Large White", "Duroc", "Pietrain", "Hampshire", "Moura"],
  equino: ["Crioulo", "Mangalarga", "Quarto de Milha", "Campolina"],
  ovino: ["Santa Inês", "Dorper", "Texel", "Suffolk"],
  caprino: ["Boer", "Saanen", "Anglo-Nubiana", "Parda Alpina"],
  ave: ["Cobb", "Ross", "Hubbard", "Hy-Line", "Lohmann"],
  cao: ["Labrador", "Golden", "Pastor Alemão", "Shih Tzu", "Pinscher", "Border Collie"],
  gato: ["Siamês", "Persa", "Maine Coon"],
};

const MANEJO: Record<string, string[]> = {
  bovino: ["bezerro", "novilha", "garrote", "desmama", "inseminação", "prenhe", "mastite", "carrapato", "aftosa", "brucelose", "arroba"],
  suino: ["leitão", "leitoa", "leitegada", "porca", "cachaço", "marrã", "matriz", "maternidade", "creche", "terminação", "desmame", "cobertura"],
  equino: ["égua", "potro", "garanhão", "casqueamento", "cólica", "garrotilho"],
  ovino: ["cordeiro", "borrego", "carneiro", "tosquia", "Famacha"],
  caprino: ["cabrito", "cabra", "bode", "Famacha"],
  ave: ["matrizes", "galos", "pintinhos", "mortas", "eliminadas", "ovos incubáveis", "trincados", "duas gemas", "ração", "Gumboro", "Newcastle", "Bronquite", "Marek"],
  cao: ["filhote", "castração", "V10", "antirrábica", "giárdia", "antipulgas"],
  gato: ["filhote", "castração", "V5", "FIV", "FeLV"],
};

const GERAL = ["vacina", "vermífugo", "dose", "ml", "quilos", "brinco", "baia", "lote", "galpão", "piquete", "pariu", "carência"];

/** O Whisper lê só os últimos 224 tokens do prompt; ~600 caracteres cabem com folga. */
export const LIMITE_VOCABULARIO = 600;
/** Com muito animal, os nomes não tomam o lugar das raças e do manejo. */
const LIMITE_NOMES = 350;

/**
 * O prompt da transcrição de uma empresa: os nomes do cadastro primeiro
 * (o que mais erra), depois raças e termos das espécies que ela tem. Sem
 * nada cadastrado, vale o manejo de bovinos, suínos e aves.
 */
export function vocabulario(animais: AnimalParaIa[], grupos: GrupoParaIa[] = [], galpoes: GalpaoParaIa[] = []) {
  const especies = new Set(animais.map((a) => a.especie));
  if (galpoes.length) especies.add("ave");
  if (especies.size === 0) for (const e of ["bovino", "suino", "ave"]) especies.add(e);

  // Poucos e de todo dia (galpões, grupos, raças do rebanho) antes dos
  // animais, que podem ser centenas. Número sozinho o Whisper já escreve.
  const nomes = [
    ...galpoes.flatMap((g) => [g.nome, g.loteCodigo]),
    ...grupos.map((g) => g.nome),
    ...animais.map((a) => a.raca ?? ""),
    ...animais.map((a) => a.nome).filter((n) => /\p{L}{3,}/u.test(n)),
  ];
  const termos = [...especies].flatMap((e) => [...(RACAS[e] ?? []), ...(MANEJO[e] ?? [])]);

  const vistos = new Set<string>();
  let texto = "Anotação de manejo dos animais:";
  const acrescentar = (lista: string[], limite: number) => {
    for (const p of lista) {
      const palavra = p.trim();
      const chave = palavra.toLowerCase();
      if (!palavra || vistos.has(chave)) continue;
      const proximo = `${texto}${vistos.size ? "," : ""} ${palavra}`;
      if (proximo.length + 1 > limite) return;
      vistos.add(chave);
      texto = proximo;
    }
  };
  acrescentar(nomes, LIMITE_NOMES);
  acrescentar([...termos, ...GERAL], LIMITE_VOCABULARIO);
  return `${texto}.`;
}
