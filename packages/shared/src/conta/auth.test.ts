import { describe, expect, it } from "vitest";

import { esqueciSenhaSchema, novaSenhaSchema } from "./auth";

describe("pedido de esqueci a senha", () => {
  it("aceita e-mail com espaço em volta e recusa o que não é e-mail", () => {
    expect(esqueciSenhaSchema.parse({ email: " ana@fazenda.com " })).toEqual({ email: "ana@fazenda.com" });
    expect(esqueciSenhaSchema.safeParse({ email: "ana" }).success).toBe(false);
    expect(esqueciSenhaSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("senha nova", () => {
  it("aceita senha de 8 a 128 caracteres repetida igual na confirmação", () => {
    expect(novaSenhaSchema.safeParse({ password: "12345678", confirmPassword: "12345678" }).success).toBe(true);
  });

  it("recusa senha curta ou longa demais", () => {
    expect(novaSenhaSchema.safeParse({ password: "1234567", confirmPassword: "1234567" }).success).toBe(false);
    expect(novaSenhaSchema.safeParse({ password: "a".repeat(129), confirmPassword: "a".repeat(129) }).success).toBe(false);
  });

  it("recusa confirmação diferente, apontando o campo da confirmação", () => {
    const r = novaSenhaSchema.safeParse({ password: "12345678", confirmPassword: "12345679" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});
