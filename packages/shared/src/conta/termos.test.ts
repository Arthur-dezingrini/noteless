import { describe, expect, it } from "vitest";

import { aceitarTermosSchema, VERSAO_TERMOS } from "./termos";

describe("aceite dos termos", () => {
  it("aceita só a versão atual dos termos", () => {
    expect(aceitarTermosSchema.safeParse({ versao: VERSAO_TERMOS }).success).toBe(true);
    const velha = aceitarTermosSchema.safeParse({ versao: "2020-01-01" });
    expect(velha.success).toBe(false);
    expect(velha.error?.issues[0]?.message).toBe("Esta versão dos termos não é a atual. Recarregue a página.");
    expect(aceitarTermosSchema.safeParse({}).success).toBe(false);
  });
});
