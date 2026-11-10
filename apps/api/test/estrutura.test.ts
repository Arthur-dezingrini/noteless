import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda o padrão de módulos (CLAUDE.md, "Estrutura por módulo"): um módulo
 * só usa outro pela porta de entrada (`modulos/<m>/index.ts`), `base/` não
 * conhece módulo nenhum, e não há ciclo entre módulos.
 */

type Arquivo = { caminho: string; conteudo: string };

const IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

function especificadores(conteudo: string) {
  return [...conteudo.matchAll(IMPORT)].map((m) => m[1]!);
}

/** "src/modulos/notas/rotas.ts" → "notas"; "src/base/x.ts" → "base"; resto → null. */
function moduloDe(caminho: string) {
  const m = /^src\/modulos\/([^/]+)\//.exec(caminho);
  if (m) return m[1]!;
  return caminho.startsWith("src/base/") ? "base" : null;
}

/** Caminho importado, relativo à raiz do pacote e sem extensão; null se não é relativo. */
function resolver(de: string, alvo: string) {
  if (!alvo.startsWith(".")) return null;
  return posix.normalize(posix.join(posix.dirname(de), alvo)).replace(/\.(ts|js)$/, "");
}

/** "src/modulos/aviario/regras/aplicar" → { modulo: "aviario", resto: "regras/aplicar" }. */
function alvoEmModulo(caminho: string) {
  const m = /^src\/modulos\/([^/]+)(?:\/(.*))?$/.exec(caminho);
  return m ? { modulo: m[1]!, resto: m[2] ?? "" } : null;
}

export function acharViolacoes(arquivos: Arquivo[]): string[] {
  const erros: string[] = [];
  for (const { caminho, conteudo } of arquivos) {
    const meu = moduloDe(caminho);
    for (const esp of especificadores(conteudo)) {
      const alvo = resolver(caminho, esp);
      if (!alvo) continue;
      const em = alvoEmModulo(alvo);
      if (!em) continue;
      const portaDeEntrada = em.resto === "" || em.resto === "index";
      if (meu === "base") erros.push(`${caminho} → ${alvo}`);
      else if (em.modulo !== meu && !portaDeEntrada) erros.push(`${caminho} → ${alvo}`);
      // Dentro do módulo, voltar pela porta de entrada fecha um ciclo na carga.
      else if (em.modulo === meu && portaDeEntrada) erros.push(`${caminho} → ${alvo} (use o caminho interno)`);
    }
  }
  return erros;
}

export function acharCiclos(arquivos: Arquivo[]): string[][] {
  const grafo = new Map<string, Set<string>>();
  for (const { caminho, conteudo } of arquivos) {
    const meu = moduloDe(caminho);
    if (!meu || meu === "base") continue;
    for (const esp of especificadores(conteudo)) {
      const alvo = resolver(caminho, esp);
      const em = alvo ? alvoEmModulo(alvo) : null;
      if (!em || em.modulo === meu) continue;
      if (!grafo.has(meu)) grafo.set(meu, new Set());
      grafo.get(meu)!.add(em.modulo);
    }
  }
  const ciclos: string[][] = [];
  const vistos = new Set<string>();
  function visitar(no: string, pilha: string[]) {
    const i = pilha.indexOf(no);
    if (i >= 0) {
      ciclos.push([...pilha.slice(i), no]);
      return;
    }
    if (vistos.has(no)) return;
    vistos.add(no);
    for (const prox of grafo.get(no) ?? []) visitar(prox, [...pilha, no]);
  }
  for (const no of grafo.keys()) visitar(no, []);
  return ciclos;
}

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

function lerSrc(): Arquivo[] {
  const saida: Arquivo[] = [];
  function andar(dir: string) {
    for (const nome of readdirSync(dir)) {
      const cheio = join(dir, nome);
      if (statSync(cheio).isDirectory()) andar(cheio);
      else if (/\.ts$/.test(nome)) {
        const caminho = relative(RAIZ, cheio).split("\\").join("/");
        if (caminho !== "src/db/schema.ts") saida.push({ caminho, conteudo: readFileSync(cheio, "utf8") });
      }
    }
  }
  andar(join(RAIZ, "src"));
  return saida;
}

describe("estrutura por módulo", () => {
  it("acusa import que passa do index de outro módulo", () => {
    expect(
      acharViolacoes([{ caminho: "src/modulos/notas/rotas.ts", conteudo: 'import { x } from "../aviario/regras/aplicar";' }]),
    ).toEqual(["src/modulos/notas/rotas.ts → src/modulos/aviario/regras/aplicar"]);
  });

  it("aceita import pelo index e dentro do próprio módulo", () => {
    expect(
      acharViolacoes([
        {
          caminho: "src/modulos/notas/rotas.ts",
          conteudo: 'import { x } from "../aviario";\nimport { y } from "./regras/aplicar";\nimport { z } from "../aviario/index";',
        },
      ]),
    ).toEqual([]);
  });

  it("acusa arquivo fora de módulos que passa do index", () => {
    expect(acharViolacoes([{ caminho: "src/app.ts", conteudo: 'import { r } from "./modulos/aviario/rotas";' }])).toHaveLength(1);
  });

  it("acusa base importando módulo", () => {
    expect(acharViolacoes([{ caminho: "src/base/datas.ts", conteudo: 'import { x } from "../modulos/aviario";' }])).toHaveLength(1);
  });

  it("acusa ciclo entre módulos", () => {
    expect(
      acharCiclos([
        { caminho: "src/modulos/a/index.ts", conteudo: 'import "../b";' },
        { caminho: "src/modulos/b/index.ts", conteudo: 'import "../a";' },
      ]),
    ).toHaveLength(1);
  });

  it("acusa arquivo que importa a porta de entrada do próprio módulo (ciclo na carga)", () => {
    expect(
      acharViolacoes([{ caminho: "src/modulos/aviario/regras/x.ts", conteudo: 'import { aviarioRotas } from "../../aviario";' }]),
    ).toHaveLength(1);
    expect(acharViolacoes([{ caminho: "src/modulos/aviario/index.ts", conteudo: 'export { aviarioRotas } from "./rotas";' }])).toEqual([]);
  });

  it("o código real segue o padrão", () => {
    const arquivos = lerSrc();
    expect(acharViolacoes(arquivos)).toEqual([]);
    expect(acharCiclos(arquivos)).toEqual([]);
  });
});
