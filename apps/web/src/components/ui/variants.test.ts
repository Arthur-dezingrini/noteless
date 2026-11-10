import { describe, expect, it } from "vitest";

import { buttonClass, cx, fieldClass } from "./variants";

describe("cx", () => {
  it("junta classes e ignora vazios", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("sem nada devolve string vazia", () => {
    expect(cx()).toBe("");
  });
});

describe("buttonClass", () => {
  it("padrão é secundário", () => {
    expect(buttonClass()).toBe(buttonClass("secundario"));
  });

  it("primário usa a cor de marca e aceita classe extra no fim", () => {
    const c = buttonClass("primario", "w-full");
    expect(c).toContain("bg-brand");
    expect(c.endsWith("w-full")).toBe(true);
  });

  it("variantes diferentes geram classes diferentes", () => {
    expect(buttonClass("perigo")).not.toBe(buttonClass("perigoSolido"));
  });
});

describe("fieldClass", () => {
  it("tem altura padrão e marca campo inválido", () => {
    const c = fieldClass();
    expect(c).toContain("h-11");
    expect(c).toContain("aria-invalid:border-danger");
  });
});
