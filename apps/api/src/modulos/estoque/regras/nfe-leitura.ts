import { arredondar, type NfeLida } from "@vocare/shared";
import { XMLParser, XMLValidator } from "fast-xml-parser";

import { falha, ok, type Resultado } from "../../../base/resultado";

const INVALIDA = "Arquivo não é uma NF-e válida.";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  // Texto continua texto: código "000123" não vira 123.
  parseTagValue: false,
  trimValues: true,
  isArray: (nome) => nome === "det" || nome === "rastro",
});

type No = Record<string, unknown>;
const no = (v: unknown): No => (v && typeof v === "object" ? (v as No) : {});
const texto = (v: unknown): string | null => (v == null || typeof v === "object" ? null : String(v).trim() || null);
const valor = (v: unknown) => {
  const n = Number(texto(v) ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** vICMSST mora num grupo que muda com o CST (ICMS10, ICMS30, ICMS70, ICMS90, ICMSSN201...). */
function icmsSt(imposto: No): number {
  const icms = no(imposto.ICMS);
  return Object.values(icms).reduce<number>((t, grupo) => t + valor(no(grupo).vICMSST), 0);
}

/**
 * Lê o XML da NF-e (modelo 55) ou NFC-e (65), com ou sem o `<nfeProc>`.
 * O custo de cada item é o que a fazenda paga por ele: produto + frete +
 * seguro + outras despesas − desconto + IPI + ICMS-ST.
 */
export function lerNfe(xml: string): Resultado<NfeLida> {
  if (XMLValidator.validate(xml) !== true) return falha(400, INVALIDA);
  let raiz: No;
  try {
    raiz = no(parser.parse(xml));
  } catch {
    return falha(400, INVALIDA);
  }

  const inf = no(no(no(raiz.nfeProc).NFe).infNFe ?? no(raiz.NFe).infNFe);
  const chave = (texto(inf["@_Id"]) ?? "").replace(/^NFe/, "");
  if (!/^\d{44}$/.test(chave)) return falha(400, INVALIDA);

  const ide = no(inf.ide);
  const modelo = texto(ide.mod);
  if (modelo !== "55" && modelo !== "65") return falha(400, "Só dá para importar NF-e (modelo 55) e NFC-e (modelo 65).");

  const emit = no(inf.emit);
  const dest = no(inf.dest);
  const emissao = (texto(ide.dhEmi) ?? texto(ide.dEmi) ?? "").slice(0, 10);
  const det = Array.isArray(inf.det) ? inf.det : [];
  if (det.length === 0) return falha(400, INVALIDA);

  return ok({
    chave,
    numero: texto(ide.nNF) ?? "",
    serie: texto(ide.serie) ?? "",
    emissao,
    modelo,
    emitente: {
      documento: texto(emit.CNPJ) ?? texto(emit.CPF) ?? "",
      nome: texto(emit.xNome) ?? "",
      telefone: texto(no(emit.enderEmit).fone),
    },
    destinatario: { documento: texto(dest.CNPJ) ?? texto(dest.CPF), nome: texto(dest.xNome) },
    valorTotal: valor(no(no(inf.total).ICMSTot).vNF),
    itens: det.map((d) => {
      const prod = no(no(d).prod);
      const imposto = no(no(d).imposto);
      const custo = valor(prod.vProd) + valor(prod.vFrete) + valor(prod.vSeg) + valor(prod.vOutro) - valor(prod.vDesc) + valor(no(no(imposto.IPI).IPITrib).vIPI) + icmsSt(imposto);
      const rastro = Array.isArray(prod.rastro) ? prod.rastro : [];
      return {
        codigo: texto(prod.cProd) ?? "",
        descricao: texto(prod.xProd) ?? "",
        unidade: texto(prod.uCom) ?? "",
        quantidade: arredondar(valor(prod.qCom), 4),
        custoTotal: arredondar(custo, 2),
        lotes: rastro.map((r) => ({ lote: texto(no(r).nLote) ?? "", quantidade: arredondar(valor(no(r).qLote), 3), validade: texto(no(r).dVal) })),
      };
    }),
  });
}
