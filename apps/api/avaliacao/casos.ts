import type { AnimalParaIa, GrupoParaIa } from "../src/modulos/notas/ia/analisar";
import type { OperacaoEsperada } from "../src/modulos/notas/ia/avaliar";

/**
 * Conjunto de avaliação da interpretação: transcrições como chegam do campo
 * (com erro de transcrição, apelido, data relativa, fala corrigida no meio)
 * e o que um revisor humano diria que cada uma pede.
 *
 * Só se confere o campo que tem resposta inequívoca: "2ª dose" × "segunda
 * dose" ou "Crioula" × "Crioulo" não entram — medir isso mediria a régua,
 * não a IA. Data relativa conta a partir de HOJE, uma terça-feira.
 */
export const HOJE = "2026-11-10";

export const ANIMAIS: AnimalParaIa[] = [
  { id: "a-mimosa", nome: "Mimosa", especie: "bovino", raca: "Nelore", tutor: null },
  { id: "a-estrela", nome: "Estrela", especie: "bovino", raca: "Girolando", tutor: null },
  { id: "a-brinco23", nome: "Brinco 23", especie: "bovino", raca: "Angus", tutor: null },
  { id: "a-trovao", nome: "Trovão", especie: "equino", raca: "Crioulo", tutor: null },
  { id: "a-pintada", nome: "Pintada", especie: "caprino", raca: "Boer", tutor: null },
  { id: "a-bolinha", nome: "Bolinha", especie: "suino", raca: null, tutor: null },
  { id: "a-thor", nome: "Thor", especie: "cao", raca: "Labrador", tutor: "Carla" },
  { id: "a-mel", nome: "Mel", especie: "gato", raca: "SRD", tutor: "Rafael" },
];

export const GRUPOS: GrupoParaIa[] = [
  { id: "g-bezerros", nome: "Lote dos bezerros", animais: 12 },
  { id: "g-baia2", nome: "Baia 2", animais: 8 },
];

export type Caso = {
  id: string;
  /** O que o caso testa, para ler o relatório sem abrir este arquivo. */
  testa: string;
  transcricao: string;
  esperado: OperacaoEsperada[];
};

export const CASOS: Caso[] = [
  // — pesagem
  {
    id: "peso-simples",
    testa: "número por extenso",
    transcricao: "A Mimosa pesou quatrocentos e doze quilos hoje.",
    esperado: [{ tipo: "registrar_peso", animalId: "a-mimosa", campos: { pesoKg: 412 } }],
  },
  {
    id: "peso-numero-quebrado",
    testa: "número partido pela transcrição",
    transcricao: "a estrela tá com 3 80 na balança",
    esperado: [{ tipo: "registrar_peso", animalId: "a-estrela", campos: { pesoKg: 380 } }],
  },
  {
    id: "peso-brinco",
    testa: "animal identificado pelo brinco",
    transcricao: "o brinco vinte e três bateu 298 quilos",
    esperado: [{ tipo: "registrar_peso", animalId: "a-brinco23", campos: { pesoKg: 298 } }],
  },
  {
    id: "peso-correcao-na-fala",
    testa: "operador corrige o número no meio da frase",
    transcricao: "a Estrela pesou 400, não, peraí, 420",
    esperado: [{ tipo: "registrar_peso", animalId: "a-estrela", campos: { pesoKg: 420 } }],
  },
  {
    id: "peso-arroba",
    testa: "unidade do campo (1 arroba = 15 kg)",
    transcricao: "a Mimosa tá com 27 arrobas",
    esperado: [{ tipo: "registrar_peso", animalId: "a-mimosa", campos: { pesoKg: 405 } }],
  },
  {
    id: "peso-dois-animais",
    testa: "uma frase, dois animais",
    transcricao: "a Mimosa deu 410 e a Estrela 385",
    esperado: [
      { tipo: "registrar_peso", animalId: "a-mimosa", campos: { pesoKg: 410 } },
      { tipo: "registrar_peso", animalId: "a-estrela", campos: { pesoKg: 385 } },
    ],
  },
  {
    id: "peso-animal-desconhecido",
    testa: "animal fora do cadastro: sem alvo, confiança baixa",
    transcricao: "o Zeca pesou 30 quilos",
    esperado: [{ tipo: "registrar_peso", animalId: null, campos: { pesoKg: 30 } }],
  },

  // — vacina
  {
    id: "vacina-reforco",
    testa: "data relativa da próxima dose",
    transcricao: "apliquei a V10 no Thor hoje, segunda dose, reforço daqui a 21 dias",
    esperado: [{ tipo: "aplicar_vacina", animalId: "a-thor", campos: { vacina: "V10", proximaData: "2026-12-01" } }],
  },
  {
    id: "vacina-grupo",
    testa: "operação no grupo inteiro",
    transcricao: "vacinei o lote dos bezerros contra aftosa",
    esperado: [{ tipo: "aplicar_vacina", grupoId: "g-bezerros", campos: { vacina: "aftosa" } }],
  },
  {
    id: "vacina-pelo-tutor",
    testa: "animal identificado pelo tutor",
    transcricao: "o cachorro da Carla tomou antirrábica hoje",
    esperado: [{ tipo: "aplicar_vacina", animalId: "a-thor", campos: { vacina: "antirrabica" } }],
  },
  {
    id: "vacina-nao-aplicada",
    testa: "não registrar o que não aconteceu",
    transcricao: "ia vacinar o Thor hoje mas não deu tempo, fica pra amanhã",
    esperado: [
      { tipo: "agendar_consulta", animalId: "a-thor", campos: { tipoConsulta: "vacinacao", data: "2026-11-11" } },
    ],
  },

  // — remédio
  {
    id: "remedio-completo",
    testa: "dose, duração e carência",
    transcricao: "comecei ivermectina na Pintada, 5 ml, por 3 dias, carência de 35 dias",
    esperado: [
      { tipo: "registrar_remedio", animalId: "a-pintada", campos: { remedio: "ivermectina", dias: 3, carenciaDias: 35 } },
    ],
  },
  {
    id: "remedio-grupo",
    testa: "tratamento do grupo",
    transcricao: "a baia 2 vai tomar oxitetraciclina por cinco dias",
    esperado: [{ tipo: "registrar_remedio", grupoId: "g-baia2", campos: { remedio: "oxitetraciclina", dias: 5 } }],
  },
  {
    id: "remedio-transcricao-ruim",
    testa: "nome do animal e do remédio quebrados",
    transcricao: "a mi mosa tomou e o vermectina dois dias",
    esperado: [{ tipo: "registrar_remedio", animalId: "a-mimosa", campos: { remedio: "ivermectina", dias: 2 } }],
  },
  {
    id: "remedio-suino",
    testa: "dose informal",
    transcricao: "o Bolinha tá tomando dipirona, meio comprimido, por dois dias",
    esperado: [{ tipo: "registrar_remedio", animalId: "a-bolinha", campos: { remedio: "dipirona", dias: 2 } }],
  },

  // — agenda
  {
    id: "consulta-sexta",
    testa: "dia da semana e hora por extenso",
    transcricao: "marca uma consulta pro Thor sexta às duas da tarde",
    esperado: [
      { tipo: "agendar_consulta", animalId: "a-thor", campos: { data: "2026-11-13", hora: "14:00", tipoConsulta: "consulta" } },
    ],
  },
  {
    id: "consulta-retorno",
    testa: "tipo retorno, amanhã",
    transcricao: "a Mel volta pra retorno amanhã às nove da manhã",
    esperado: [
      { tipo: "agendar_consulta", animalId: "a-mel", campos: { data: "2026-11-11", hora: "09:00", tipoConsulta: "retorno" } },
    ],
  },
  {
    id: "consulta-cirurgia",
    testa: "castração = cirurgia; dia do mês sem hora",
    transcricao: "agenda a castração do Bolinha pro dia 20",
    esperado: [
      { tipo: "agendar_consulta", animalId: "a-bolinha", campos: { data: "2026-11-20", hora: null, tipoConsulta: "cirurgia" } },
    ],
  },
  {
    id: "consulta-exame",
    testa: "daqui a N dias",
    transcricao: "daqui a três dias tem exame de sangue da Mel",
    esperado: [{ tipo: "agendar_consulta", animalId: "a-mel", campos: { data: "2026-11-13", tipoConsulta: "exame" } }],
  },
  {
    id: "consulta-grupo",
    testa: "checkup do grupo",
    transcricao: "agenda checkup da baia 2 pra sexta",
    esperado: [{ tipo: "agendar_consulta", grupoId: "g-baia2", campos: { data: "2026-11-13", tipoConsulta: "checkup" } }],
  },

  // — anotação
  {
    id: "anotacao-clinica",
    testa: "observação sem número",
    transcricao: "a Estrela tá mancando da pata traseira esquerda",
    esperado: [{ tipo: "registrar_anotacao", animalId: "a-estrela" }],
  },
  {
    id: "anotacao-grupo",
    testa: "observação do grupo",
    transcricao: "os bezerros tão com diarreia, tem que ficar de olho",
    esperado: [{ tipo: "registrar_anotacao", grupoId: "g-bezerros" }],
  },
  {
    id: "anotacao-apelido",
    testa: "\"a vinte e três\" = Brinco 23",
    transcricao: "a vinte e três tá com o olho inchado",
    esperado: [{ tipo: "registrar_anotacao", animalId: "a-brinco23" }],
  },

  // — parto e cadastro
  {
    id: "parto-sem-nome",
    testa: "parto ontem, filhote sem nome não vira cadastro",
    transcricao: "a Mimosa pariu ontem à noite, uma bezerra",
    esperado: [{ tipo: "registrar_parto", animalId: "a-mimosa", campos: { data: "2026-11-09", crias: 1 } }],
  },
  {
    id: "parto-com-cadastro",
    testa: "parto + cadastro do filhote com nome",
    transcricao: "a Pintada pariu hoje dois cabritinhos, um macho que vai se chamar Faísca",
    esperado: [
      { tipo: "registrar_parto", animalId: "a-pintada", campos: { crias: 2 } },
      { tipo: "cadastrar_animal", campos: { nome: "Faísca", especie: "caprino", sexo: "macho" } },
    ],
  },
  {
    id: "cadastro-egua",
    testa: "animal novo com espécie e sexo implícitos",
    transcricao: "chegou um cavalo novo, a Ventania, égua crioula de uns cinco anos",
    esperado: [{ tipo: "cadastrar_animal", campos: { nome: "Ventania", especie: "equino", sexo: "femea" } }],
  },
  {
    id: "cadastro-gato",
    testa: "cadastro trazido pelo tutor",
    transcricao: "a Carla trouxe um gatinho novo, o Pipoca, macho, nasceu mês passado",
    esperado: [{ tipo: "cadastrar_animal", campos: { nome: "Pipoca", especie: "gato", sexo: "macho" } }],
  },

  // — várias operações
  {
    id: "multi-peso-e-vacina",
    testa: "duas operações no mesmo animal",
    transcricao: "pesei o Trovão, 450 quilos, e já dei a vacina de influenza nele",
    esperado: [
      { tipo: "registrar_peso", animalId: "a-trovao", campos: { pesoKg: 450 } },
      { tipo: "aplicar_vacina", animalId: "a-trovao", campos: { vacina: "influenza" } },
    ],
  },

  // — nada a registrar
  {
    id: "sem-acao-conversa",
    testa: "conversa sem fato registrável",
    transcricao: "bom dia pessoal, hoje o tempo tá firme, depois eu volto aqui",
    esperado: [],
  },
  {
    id: "sem-acao-teste",
    testa: "teste de microfone",
    transcricao: "testando, testando, um dois três",
    esperado: [],
  },
];
