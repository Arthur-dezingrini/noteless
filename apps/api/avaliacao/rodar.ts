import { analisar } from "../src/modulos/notas/ia/analisar";
import { avaliarCaso, consolidar, type ResultadoCaso } from "../src/modulos/notas/ia/avaliar";
import { interpretacao } from "../src/modulos/notas/ia/provedor";
import { ANIMAIS, CASOS, GRUPOS, HOJE } from "./casos";

/**
 * Roda o conjunto de avaliação contra a IA configurada no .env e imprime o
 * relatório em Markdown. Chama a IA de verdade — cada execução gasta uma
 * chamada por caso.
 *
 *   npm run avaliar -w @vocare/api              → todos os casos
 *   npm run avaliar -w @vocare/api -- vacina    → só os ids que contêm "vacina"
 *
 * Para comparar modelos, troque IA_MODELO (ou a chave) no .env e rode de novo.
 */
const cfg = interpretacao();
if (!cfg) {
  console.error("Nenhuma IA configurada: preencha GROQ_API_KEY (grátis) ou ANTHROPIC_API_KEY em apps/api/.env.");
  process.exit(1);
}

const filtro = process.argv[2];
const casos = filtro ? CASOS.filter((c) => c.id.includes(filtro)) : CASOS;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const curto = (v: unknown) => JSON.stringify(v);

const resultados: ResultadoCaso[] = [];
const linhas: string[] = [];
const tempos: number[] = [];
let falhas = 0;

for (const caso of casos) {
  const inicio = performance.now();
  let r: ResultadoCaso;
  let erro = "";
  try {
    const analise = await analisar(caso.transcricao, HOJE, ANIMAIS, GRUPOS);
    r = avaliarCaso(caso.esperado, analise.operacoes);
  } catch (e) {
    // Resposta fora do formato também é erro da IA: conta como nada achado.
    falhas++;
    erro = e instanceof Error ? e.message : String(e);
    r = avaliarCaso(caso.esperado, []);
  }
  tempos.push(performance.now() - inicio);
  resultados.push(r);

  const problemas = [
    erro && `falhou: ${erro}`,
    ...r.faltaram.map((f) => `faltou ${f.tipo}${f.animalId || f.grupoId ? ` em ${f.animalId ?? f.grupoId}` : ""}`),
    ...r.inventadas.map((o) => `sobrou ${o.tipo} em ${o.animalId ?? o.grupoId ?? "—"} (conf. ${o.confianca})`),
    ...r.errosDeCampo.map((e) => `${e.tipo}.${e.campo}: esperado ${curto(e.esperado)}, veio ${curto(e.obtido)}`),
  ].filter(Boolean);
  const ok = problemas.length === 0;
  linhas.push(`| ${ok ? "✅" : "❌"} | \`${caso.id}\` | ${caso.testa} | ${problemas.join("<br>") || ""} |`);
  console.error(`${ok ? "✓" : "✗"} ${caso.id}`);
}

const c = consolidar(resultados);
tempos.sort((a, b) => a - b);
const mediana = tempos[Math.floor(tempos.length / 2)] ?? 0;

console.log(`# Avaliação da interpretação — ${cfg.modelo} (${cfg.tipo === "anthropic" ? "Anthropic" : cfg.baseUrl})

Data de referência dos casos: ${HOJE}. ${c.casos} casos, ${falhas} falha(s) de chamada.

| Métrica | Valor |
|---|---|
| Casos perfeitos | ${c.casosPerfeitos}/${c.casos} (${pct(c.casosPerfeitos / Math.max(c.casos, 1))}) |
| Precisão (propostas aproveitáveis) | ${pct(c.precisao)} |
| Cobertura (operações esperadas achadas) | ${pct(c.cobertura)} |
| F1 | ${pct(c.f1)} |
| Campos certos (nas operações achadas) | ${pct(c.campos)} |
| Tempo mediano por áudio | ${(mediana / 1000).toFixed(1)} s |

## A confiança diz a verdade?

| Confiança informada | Propostas | Totalmente certas |
|---|---|---|
${c.calibracao.map((f) => `| ${f.faixa} | ${f.propostas} | ${pct(f.taxa)} |`).join("\n")}

## Por tipo de operação

| Tipo | Esperadas | Achadas | Cobertura |
|---|---|---|---|
${c.porTipo.map((t) => `| ${t.tipo} | ${t.esperadas} | ${t.acertos} | ${pct(t.cobertura)} |`).join("\n")}

## Caso a caso

| | Caso | Testa | Problemas |
|---|---|---|---|
${linhas.join("\n")}
`);
