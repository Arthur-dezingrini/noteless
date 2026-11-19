import { describe, expect, it } from "vitest";

import { duracaoDoWav, muLawParaLinear, wavMuLawParaPcm16 } from "../../src/modulos/notas/regras/wav";

/** WAV mono como o gravador grava: `formato` 7 = μ-law (8 bits), 1 = PCM. */
function wav(formato: number, bits: number, taxa: number, dados: number[], tamanhoDeclarado = dados.length) {
  const b = new Uint8Array(44 + dados.length);
  const v = new DataView(b.buffer);
  b.set([...Buffer.from("RIFF")], 0);
  v.setUint32(4, 36 + dados.length, true);
  b.set([...Buffer.from("WAVEfmt ")], 8);
  v.setUint32(16, 16, true);
  v.setUint16(20, formato, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, (taxa * bits) / 8, true);
  v.setUint16(32, bits / 8, true);
  v.setUint16(34, bits, true);
  b.set([...Buffer.from("data")], 36);
  v.setUint32(40, tamanhoDeclarado, true);
  b.set(dados, 44);
  return b;
}

describe("muLawParaLinear", () => {
  it("decodifica pela tabela G.711", () => {
    expect(muLawParaLinear(0xff)).toBe(0); // zero
    expect(muLawParaLinear(0x7f)).toBe(0); // "zero negativo"
    expect(muLawParaLinear(0x80)).toBe(32124); // máximo positivo
    expect(muLawParaLinear(0x00)).toBe(-32124); // máximo negativo
    expect(muLawParaLinear(0xfe)).toBe(-muLawParaLinear(0x7e)); // simétrico
  });
});

describe("wavMuLawParaPcm16", () => {
  it("vira WAV PCM de 16 bits, mesma taxa, com as amostras decodificadas", () => {
    const pcm = wavMuLawParaPcm16(wav(7, 8, 16000, [0xff, 0x80, 0x00]))!;
    expect(pcm).not.toBeNull();
    const v = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    expect(Buffer.from(pcm.subarray(0, 4)).toString()).toBe("RIFF");
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(6);
    expect([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true)]).toEqual([0, 32124, -32124]);
    expect(pcm.byteLength).toBe(50);
  });

  it("gravação interrompida (tamanho zerado no cabeçalho): usa o que veio no arquivo", () => {
    const pcm = wavMuLawParaPcm16(wav(7, 8, 16000, [0xff, 0xff], 0))!;
    expect(new DataView(pcm.buffer, pcm.byteOffset).getUint32(40, true)).toBe(4);
  });

  it("o que não é WAV μ-law passa direto (null): PCM, WebM, lixo", () => {
    expect(wavMuLawParaPcm16(wav(1, 16, 16000, [0, 0, 1, 0]))).toBeNull();
    expect(wavMuLawParaPcm16(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).toBeNull();
    expect(wavMuLawParaPcm16(new Uint8Array(10))).toBeNull();
  });
});

describe("duracaoDoWav", () => {
  const segundos = (n: number, bytesPorSeg: number) => new Array<number>(n * bytesPorSeg).fill(0);

  it("PCM de 16 bits e μ-law: a conta usa os bytes por amostra do cabeçalho", () => {
    expect(duracaoDoWav(wav(1, 16, 16000, segundos(3, 32000)))).toBe(3); // firmware anterior
    expect(duracaoDoWav(wav(7, 8, 16000, segundos(3, 16000)))).toBe(3); // firmware de agora
  });

  it("gravação interrompida (tamanho zerado no cabeçalho): conta o que veio no arquivo", () => {
    expect(duracaoDoWav(wav(1, 16, 16000, segundos(2, 32000), 0))).toBe(2);
  });

  it("o que não é WAV não tem duração aqui (null)", () => {
    expect(duracaoDoWav(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).toBeNull();
    expect(duracaoDoWav(new Uint8Array(800))).toBeNull();
  });
});
