/**
 * O gravador de campo manda WAV μ-law (G.711, 8 bits por amostra): metade do
 * tamanho do PCM de 16 bits, e com Wi-Fi fraco o envio termina antes de a
 * conexão cair. Na chegada vira PCM de 16 bits — o que todo navegador toca no
 * player da nota e o que a transcrição recebe desde sempre.
 */

const FORMATO_MU_LAW = 7;

/** Uma amostra μ-law vira PCM linear de 16 bits (tabela G.711). */
export function muLawParaLinear(byte: number): number {
  const u = ~byte & 0xff;
  const t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4);
  return u & 0x80 ? 0x84 - t : t - 0x84;
}

/**
 * WAV μ-law → WAV PCM de 16 bits, mesma taxa e canais. Devolve `null` para o
 * que não for WAV μ-law (PCM, WebM do navegador...): esse passa como veio.
 */
export function wavMuLawParaPcm16(arquivo: Uint8Array): Uint8Array | null {
  if (arquivo.byteLength < 12) return null;
  const v = new DataView(arquivo.buffer, arquivo.byteOffset, arquivo.byteLength);
  const tag = (pos: number) => String.fromCharCode(...arquivo.subarray(pos, pos + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;

  let formato = 0, canais = 0, taxa = 0, bits = 0, inicio = -1, tamanho = 0;
  for (let pos = 12; pos + 8 <= arquivo.byteLength; ) {
    const id = tag(pos);
    const declarado = v.getUint32(pos + 4, true);
    if (id === "fmt " && pos + 24 <= arquivo.byteLength) {
      formato = v.getUint16(pos + 8, true);
      canais = v.getUint16(pos + 10, true);
      taxa = v.getUint32(pos + 12, true);
      bits = v.getUint16(pos + 22, true);
    } else if (id === "data") {
      inicio = pos + 8;
      const resta = arquivo.byteLength - inicio;
      // Gravação interrompida pode ter o tamanho zerado ou maior que o arquivo.
      tamanho = declarado > 0 && declarado <= resta ? declarado : resta;
      break;
    }
    pos += 8 + declarado + (declarado % 2);
  }
  if (formato !== FORMATO_MU_LAW || bits !== 8 || inicio < 0 || !canais || !taxa) return null;

  const saida = new Uint8Array(44 + tamanho * 2);
  const s = new DataView(saida.buffer);
  saida.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  s.setUint32(4, 36 + tamanho * 2, true);
  saida.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8); // WAVEfmt
  s.setUint32(16, 16, true);
  s.setUint16(20, 1, true); // PCM
  s.setUint16(22, canais, true);
  s.setUint32(24, taxa, true);
  s.setUint32(28, taxa * canais * 2, true);
  s.setUint16(32, canais * 2, true);
  s.setUint16(34, 16, true);
  saida.set([0x64, 0x61, 0x74, 0x61], 36); // data
  s.setUint32(40, tamanho * 2, true);
  for (let i = 0; i < tamanho; i++) s.setInt16(44 + i * 2, muLawParaLinear(arquivo[inicio + i]!), true);
  return saida;
}
