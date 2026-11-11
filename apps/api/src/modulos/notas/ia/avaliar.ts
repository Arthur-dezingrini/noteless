import type { Operacao, TipoOperacao } from "@vocare/shared";

/**
 * Avaliação da interpretação: compara o que a IA propôs com o que um humano
 * diria que o áudio pede. Funções puras — quem chama a IA é
 * `avaliacao/rodar.ts`; aqui só se mede.
 */

/** O que um caso espera: tipo, alvo e só os campos que importam conferir. */
export type OperacaoEsperada = {
  tipo: TipoOperacao;
  animalId?: string | null;
  grupoId?: string | null;
  campos?: Record<string, string | number | null>;
};

export type ErroDeCampo = { tipo: TipoOperacao; campo: string; esperado: unknown; obtido: unknown };

export type ResultadoCaso = {
  esperadas: number;
  propostas: number;
  /** Propostas que casaram com uma esperada (mesmo tipo e mesmo alvo). */
  acertos: number;
  faltaram: OperacaoEsperada[];
  inventadas: Operacao[];
  camposConferidos: number;
  camposCertos: number;
  errosDeCampo: ErroDeCampo[];
  /** Uma por proposta: a confiança que a IA deu e se ela estava toda certa. */
  confiancas: { confianca: number; certa: boolean }[];
  porTipo: Partial<Record<TipoOperacao, { esperadas: number; acertos: number }>>;
};

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Igualdade tolerante ao jeito de escrever: número com folga de centavo,
 * texto sem acento/caixa e aceitando um contido no outro ("aftosa" ×
 * "vacina contra aftosa"). Data e hora caem na comparação de texto exata.
 */
export function iguais(esperado: unknown, obtido: unknown): boolean {
  const vazio = (v: unknown) => v === null || v === undefined || v === "";
  if (vazio(esperado) || vazio(obtido)) return vazio(esperado) && vazio(obtido);
  if (typeof esperado === "number") return Math.abs(esperado - Number(obtido)) < 0.01;
  const a = normalizar(String(esperado));
  const b = normalizar(String(obtido));
  if (a === b) return true;
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
  return curto.length >= 3 && !/^\d/.test(curto) && longo.includes(curto);
}

function mesmoAlvo(esp: OperacaoEsperada, op: Operacao): boolean {
  if (esp.tipo !== op.tipo) return false;
  if (op.tipo === "cadastrar_animal") return esp.campos?.nome === undefined || iguais(esp.campos.nome, op.nome);
  return (esp.animalId ?? null) === op.animalId && (esp.grupoId ?? null) === (op.grupoId ?? null);
}

function conferirCampos(esp: OperacaoEsperada, op: Operacao) {
  const atual = op as Record<string, unknown>;
  const erros: ErroDeCampo[] = [];
  const campos = Object.entries(esp.campos ?? {});
  for (const [campo, esperado] of campos) {
    if (!iguais(esperado, atual[campo])) erros.push({ tipo: esp.tipo, campo, esperado, obtido: atual[campo] ?? null });
  }
  return { conferidos: campos.length, erros };
}

/**
 * Casa cada esperada com a proposta do mesmo tipo e alvo que mais acerta os
 * campos. Alvo errado conta duas vezes, de propósito: faltou a certa e
 * apareceu uma que ninguém pediu — é o erro que mais custa ao revisor.
 */
export function avaliarCaso(esperado: OperacaoEsperada[], propostas: Operacao[]): ResultadoCaso {
  const usadas = new Set<number>();
  const certas = new Set<number>();
  const r: ResultadoCaso = {
    esperadas: esperado.length,
    propostas: propostas.length,
    acertos: 0,
    faltaram: [],
    inventadas: [],
    camposConferidos: 0,
    camposCertos: 0,
    errosDeCampo: [],
    confiancas: [],
    porTipo: {},
  };

  for (const esp of esperado) {
    const tipo = (r.porTipo[esp.tipo] ??= { esperadas: 0, acertos: 0 });
    tipo.esperadas++;

    let melhor: { i: number; conferidos: number; erros: ErroDeCampo[] } | null = null;
    for (const [i, op] of propostas.entries()) {
      if (usadas.has(i) || !mesmoAlvo(esp, op)) continue;
      const c = conferirCampos(esp, op);
      if (!melhor || c.erros.length < melhor.erros.length) melhor = { i, ...c };
    }
    if (!melhor) {
      r.faltaram.push(esp);
      continue;
    }
    const { i, conferidos, erros } = melhor;
    usadas.add(i);
    if (erros.length === 0) certas.add(i);
    r.acertos++;
    tipo.acertos++;
    r.camposConferidos += conferidos;
    r.camposCertos += conferidos - erros.length;
    r.errosDeCampo.push(...erros);
  }

  propostas.forEach((op, i) => {
    if (!usadas.has(i)) r.inventadas.push(op);
    r.confiancas.push({ confianca: op.confianca, certa: certas.has(i) });
  });
  return r;
}

const razao = (parte: number, todo: number) => (todo === 0 ? 1 : parte / todo);

export const FAIXAS_CONFIANCA = [
  { nome: "90–100", min: 90, max: 100 },
  { nome: "70–89", min: 70, max: 89 },
  { nome: "0–69", min: 0, max: 69 },
] as const;

export type Consolidado = {
  casos: number;
  casosPerfeitos: number;
  /** Das propostas, quantas o revisor aproveitaria (tipo e alvo certos). */
  precisao: number;
  /** Das esperadas, quantas a IA achou. */
  cobertura: number;
  f1: number;
  /** Dos campos conferidos nas operações que casaram, quantos vieram certos. */
  campos: number;
  /** A confiança diz a verdade? Taxa de propostas totalmente certas por faixa. */
  calibracao: { faixa: string; propostas: number; certas: number; taxa: number | null }[];
  porTipo: { tipo: TipoOperacao; esperadas: number; acertos: number; cobertura: number }[];
};

export function consolidar(resultados: ResultadoCaso[]): Consolidado {
  const soma = (f: (r: ResultadoCaso) => number) => resultados.reduce((t, r) => t + f(r), 0);
  const acertos = soma((r) => r.acertos);
  const precisao = razao(acertos, soma((r) => r.propostas));
  const cobertura = razao(acertos, soma((r) => r.esperadas));

  const confiancas = resultados.flatMap((r) => r.confiancas);
  const calibracao = FAIXAS_CONFIANCA.map((f) => {
    const naFaixa = confiancas.filter((c) => c.confianca >= f.min && c.confianca <= f.max);
    const certas = naFaixa.filter((c) => c.certa).length;
    return { faixa: f.nome, propostas: naFaixa.length, certas, taxa: naFaixa.length ? certas / naFaixa.length : null };
  });

  const tipos = new Map<TipoOperacao, { esperadas: number; acertos: number }>();
  for (const r of resultados) {
    for (const [tipo, v] of Object.entries(r.porTipo) as [TipoOperacao, { esperadas: number; acertos: number }][]) {
      const t = tipos.get(tipo) ?? { esperadas: 0, acertos: 0 };
      t.esperadas += v.esperadas;
      t.acertos += v.acertos;
      tipos.set(tipo, t);
    }
  }

  return {
    casos: resultados.length,
    casosPerfeitos: resultados.filter(
      (r) => r.faltaram.length === 0 && r.inventadas.length === 0 && r.camposCertos === r.camposConferidos,
    ).length,
    precisao,
    cobertura,
    f1: precisao + cobertura === 0 ? 0 : (2 * precisao * cobertura) / (precisao + cobertura),
    campos: razao(soma((r) => r.camposCertos), soma((r) => r.camposConferidos)),
    calibracao,
    porTipo: [...tipos].map(([tipo, v]) => ({ tipo, ...v, cobertura: razao(v.acertos, v.esperadas) })),
  };
}
