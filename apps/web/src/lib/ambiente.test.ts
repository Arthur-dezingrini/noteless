import { describe, expect, it } from "vitest";

import { rotuloDoAmbiente } from "./ambiente";

describe("rótulo do ambiente", () => {
  it("homologação ganha aviso; produção e desenvolvimento não", () => {
    expect(rotuloDoAmbiente("hom")).toBe("Homologação");
    expect(rotuloDoAmbiente(undefined)).toBeNull();
    expect(rotuloDoAmbiente("")).toBeNull();
  });
});
