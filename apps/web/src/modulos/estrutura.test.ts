import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda o padrão de módulos (CLAUDE.md, "Estrutura por módulo"): fora do
 * próprio módulo, só se entra por `@/modulos/<m>` (componentes, tipos) ou
 * `@/modulos/<m>/dados` (busca server-only, que componente "use client"
 * nunca importa), e não há ciclo entre módulos.
 */

type Arquivo = { caminho: string; conteudo: string };

const IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

function especificadores(conteudo: string) {
  return [...conteudo.matchAll(IMPORT)].map((m) => m[1]!);
}

/** "src/modulos/notas/componentes/x.tsx" → "notas"; resto → null. */
function moduloDe(caminho: string) {
  const m = /^src\/modulos\/([^/]+)\//.exec(caminho);
  return m ? m[1]! : null;
}

/** Caminho importado, relativo à raiz do pacote e sem extensão; null se é pacote externo. */
function resolver(de: string, alvo: string) {
  if (alvo.startsWith("@/")) return posix.normalize("src/" + alvo.slice(2)).replace(/\.(tsx?|js)$/, "");
  if (!alvo.startsWith(".")) return null;
  return posix.normalize(posix.join(posix.dirname(de), alvo)).replace(/\.(tsx?|js)$/, "");
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
    // A diretiva pode vir depois de comentários.
    const cliente = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/.test(conteudo);
    for (const esp of especificadores(conteudo)) {
      const alvo = resolver(caminho, esp);
      if (!alvo) continue;
      const em = alvoEmModulo(alvo);
      if (!em) continue;
      const entrada = em.resto === "" || em.resto === "index" || em.resto === "dados";
      if (cliente && em.resto === "dados") erros.push(`${caminho} → ${alvo} (componente client não busca dados)`);
      else if (em.modulo !== meu && !entrada) erros.push(`${caminho} → ${alvo}`);
      // Dentro do módulo, voltar pela porta de entrada fecha um ciclo na carga.
      else if (em.modulo === meu && (em.resto === "" || em.resto === "index")) erros.push(`${caminho} → ${alvo} (use o caminho interno)`);
    }
  }
  return erros;
}

export function acharCiclos(arquivos: Arquivo[]): string[][] {
  const grafo = new Map<string, Set<string>>();
  for (const { caminho, conteudo } of arquivos) {
    const meu = moduloDe(caminho);
    if (!meu) continue;
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

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "../..");

function lerSrc(): Arquivo[] {
  const saida: Arquivo[] = [];
  function andar(dir: string) {
    for (const nome of readdirSync(dir)) {
      const cheio = join(dir, nome);
      if (statSync(cheio).isDirectory()) andar(cheio);
      else if (/\.tsx?$/.test(nome)) {
        const caminho = relative(RAIZ, cheio).split("\\").join("/");
        // Este arquivo cita imports proibidos nos exemplos: fica de fora.
        if (caminho !== "src/modulos/estrutura.test.ts") saida.push({ caminho, conteudo: readFileSync(cheio, "utf8") });
      }
    }
  }
  andar(join(RAIZ, "src"));
  return saida;
}

describe("estrutura por módulo", () => {
  it("acusa import que passa do index de outro módulo", () => {
    expect(
      acharViolacoes([{ caminho: "src/modulos/notas/componentes/a.tsx", conteudo: 'import { x } from "@/modulos/aviario/componentes/ficha";' }]),
    ).toEqual(["src/modulos/notas/componentes/a.tsx → src/modulos/aviario/componentes/ficha"]);
  });

  it("aceita import pelo index e dentro do próprio módulo", () => {
    expect(
      acharViolacoes([
        {
          caminho: "src/modulos/notas/componentes/a.tsx",
          conteudo: 'import { x } from "@/modulos/aviario";\nimport { y } from "./b";\nimport { z } from "../../aviario/index";',
        },
      ]),
    ).toEqual([]);
  });

  it("página do app/ entra pelo index ou pelo dados, nunca por dentro", () => {
    expect(
      acharViolacoes([
        { caminho: "src/app/(app)/lotes/page.tsx", conteudo: 'import { getLotes } from "@/modulos/aviario/dados";\nimport { Lista } from "@/modulos/aviario";' },
      ]),
    ).toEqual([]);
    expect(
      acharViolacoes([{ caminho: "src/app/(app)/lotes/page.tsx", conteudo: 'import { Lista } from "@/modulos/aviario/componentes/lista";' }]),
    ).toHaveLength(1);
  });

  it("acusa componente client importando dados", () => {
    expect(
      acharViolacoes([
        { caminho: "src/modulos/notas/componentes/lista.tsx", conteudo: '"use client";\nimport { getLotes } from "@/modulos/aviario/dados";' },
      ]),
    ).toHaveLength(1);
  });

  it("acusa ciclo entre módulos", () => {
    expect(
      acharCiclos([
        { caminho: "src/modulos/a/index.ts", conteudo: 'import "../b";' },
        { caminho: "src/modulos/b/index.ts", conteudo: 'import "../a";' },
      ]),
    ).toHaveLength(1);
  });

  it("acusa componente client com comentário antes da diretiva", () => {
    expect(
      acharViolacoes([
        {
          caminho: "src/modulos/notas/componentes/lista.tsx",
          conteudo: '// eslint-disable-next-line x\n/** Lista */\n"use client";\nimport { getLotes } from "@/modulos/aviario/dados";',
        },
      ]),
    ).toHaveLength(1);
  });

  it("acusa arquivo que importa a porta de entrada do próprio módulo (ciclo na carga)", () => {
    expect(
      acharViolacoes([{ caminho: "src/modulos/aviario/componentes/x.tsx", conteudo: 'import { FichaLote } from "@/modulos/aviario";' }]),
    ).toHaveLength(1);
  });

  it("o código real segue o padrão", () => {
    const arquivos = lerSrc();
    expect(acharViolacoes(arquivos)).toEqual([]);
    expect(acharCiclos(arquivos)).toEqual([]);
  });
});
