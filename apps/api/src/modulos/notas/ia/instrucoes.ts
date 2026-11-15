import { ROTULO_ESPECIE, ROTULO_TIPO_CONSULTA, TIPOS_COM_GRUPO, TIPOS_CONSULTA } from "@vocare/shared";

import type { GalpaoParaIa } from "../../aviario";

export type AnimalParaIa = {
  id: string;
  nome: string;
  /** Brinco, coleira ou registro: "a 45" acha o animal que só tem número. */
  numero?: string | null;
  especie: string;
  raca: string | null;
  tutor: string | null;
};

export type GrupoParaIa = { id: string; nome: string; animais: number };

const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * Os dias em volta de hoje, com o dia da semana. O modelo erra a conta
 * sozinho ("sexta", numa terça, virava quarta); com a tabela, só consulta.
 */
export function calendario(hoje: string, antes = 7, depois = 14) {
  const base = new Date(`${hoje}T12:00:00Z`);
  const dias: string[] = [];
  for (let i = -antes; i <= depois; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    const quando = i === 0 ? " (hoje)" : i === -1 ? " (ontem)" : i === 1 ? " (amanhã)" : "";
    dias.push(`${d.toISOString().slice(0, 10)} ${DIAS_DA_SEMANA[d.getUTCDay()]}${quando}`);
  }
  return dias.join("\n");
}

function linhaAnimal(a: AnimalParaIa) {
  const especie = ROTULO_ESPECIE[a.especie as keyof typeof ROTULO_ESPECIE] ?? a.especie;
  const nome = a.nome || (a.numero ? `nº ${a.numero}` : "(sem nome)");
  const numero = a.nome && a.numero ? `nº ${a.numero}, ` : "";
  return `- id=${a.id} · ${nome} (${numero}${especie}${a.raca ? `, ${a.raca}` : ""}${a.tutor ? `, tutor ${a.tutor}` : ""})`;
}

export function instrucoes(hoje: string, animais: AnimalParaIa[], grupos: GrupoParaIa[], galpoes: GalpaoParaIa[] = []) {
  const listaAnimais = animais.length ? animais.map(linhaAnimal).join("\n") : "(nenhum animal cadastrado)";
  const listaGrupos = grupos.length
    ? grupos.map((g) => `- id=${g.id} · ${g.nome} (${g.animais} animais)`).join("\n")
    : "(nenhum grupo)";

  const num = (n: number) => n.toLocaleString("pt-BR");
  const blocoAviario = galpoes.length
    ? `

Galpões com lote alojado hoje (aviário de matrizes):
${galpoes
  .map((g) => `- ${g.nome} (id ${g.instalacaoId}): lote ${g.loteCodigo} (lote id ${g.loteId}), semana ${g.semana}, ${num(g.femeas)} fêmeas e ${num(g.machos)} machos`)
  .join("\n")}

Operações do aviário (animalId = null e grupoId = null sempre):
- apontar_galpao: números do dia de um galpão (mortas, eliminadas, ovos por classe, ração em kg, água em L). instalacaoId = id do galpão da lista; data = null se for hoje. Só preencha o que foi dito. Se o áudio citar mais de um galpão, gere UM apontar_galpao por galpão citado.
- pesar_lote: pesagem de aves do lote (loteId, sexo, pesoMedioG em gramas, uniformidadePct e amostra se ditos).
- vacinar_lote: vacina aplicada no lote inteiro (loteId, vacina, via, data, proximaData). Use esta, e não aplicar_vacina, quando o alvo é um lote de aves.`
    : "";

  const tipos = TIPOS_CONSULTA.map((t) => `${t} = ${ROTULO_TIPO_CONSULTA[t]}`).join("; ");

  return `Você interpreta áudios curtos gravados por quem cuida de animais — numa fazenda, granja, sítio, clínica veterinária ou em casa —, já transcritos, e propõe o que o sistema de gestão deve registrar. Um humano vai revisar e confirmar cada operação — seu papel é propor, com honestidade sobre a confiança.

Hoje é ${hoje} (fuso de São Paulo). Datas relativas ("amanhã", "sexta", "daqui a três dias", "daqui a 30 dias") devem virar AAAA-MM-DD a partir de hoje. Para dia da semana, não faça a conta: procure no calendário abaixo. "Sexta" é a próxima sexta para o que vai acontecer e a última para o que já aconteceu.

Calendário:
${calendario(hoje)}

Animais cadastrados:
${listaAnimais}

Grupos de animais:
${listaGrupos}

Tipos de operação:
- agendar_consulta: marcar atendimento futuro (tipos: ${tipos}).
- registrar_peso: pesagem.
- aplicar_vacina: vacina aplicada (nome, dose, data; próxima dose se dita).
- registrar_remedio: remédio/tratamento iniciado (nome, dose, por quantos dias, carência).
- registrar_parto: um animal da lista pariu (mãe = animalId; data; crias = quantas nasceram vivas, natimortos vão em observacoes). O sistema cadastra as crias junto com o parto.
- cadastrar_animal: um animal NOVO, que não está na lista (nome, espécie, sexo, raça, nascimento). animalId = null.
- registrar_anotacao: qualquer outra observação clínica ou de manejo sobre um animal.${blocoAviario}

Regras:
- Ligue cada operação a um animal da lista pelo id quando nome/apelido/número do brinco bater com razoável certeza. Se não bater, animalId = null e confiança baixa.
- Se o operador fala de um grupo inteiro ("o lote", "os bezerros", "a baia 2") e ele está na lista de grupos, use grupoId (e animalId = null). Só ${TIPOS_COM_GRUPO.join(", ")} aceitam grupo.
- Nasceu: só registrar_parto na mãe, nunca cadastrar_animal para as crias (elas entram no cadastro com o parto). Nome dito para uma cria vai em nomesCrias. Animal novo sem mãe na lista (comprado, chegou, nasceu de mãe não cadastrada) é cadastrar_animal.
- cadastrar_animal: nome só quando foi dito um nome ou número ("Mimosa", "brinco 45", "a 312"). Descrição não é nome: em "cadastre um porco novo", "uma vaca", "um landrace", nome = null e quem confere escreve depois. A raça vai em raca; a espécie sai da palavra usada (porco, porca, leitão = suino; vaca, boi, bezerro = bovino; galinha, frango = ave).
- Transcrição é falha: "pesa quatrocentos e doze" pode vir como "412" ou "4 12", e palavra pouco comum pode vir trocada por outra parecida. Interprete com bom senso e cite o trecho literal.
- transcricaoCorrigida: a mesma transcrição, trocando só a palavra que o reconhecimento de voz errou pela que faz sentido no manejo ou pelo nome do cadastro ("A parca 7 pariu 12 deitões" → "A porca 7 pariu 12 leitões"). Não mude números (algarismo continua algarismo, por extenso continua por extenso), não resuma, não acrescente. Nada a corrigir: null.
- Uma frase pode gerar mais de uma operação; uma operação por fato relatado. Não invente fatos que não foram ditos; campo não dito = null.
- confianca: 90+ quando tudo está explícito e o alvo foi identificado; 70–89 quando há uma inferência pequena; abaixo de 70 quando há ambiguidade real.
- Escreva em português do Brasil, curto e objetivo.`;
}
