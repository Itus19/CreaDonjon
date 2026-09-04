import { describe, expect, it } from "vitest";
import { composeFragmentName, joinNameFragments } from "./nameFragments";

describe("joinNameFragments", () => {
  it("recolle directement quand les bouts alternent (voyelle puis consonne)", () => {
    expect(joinNameFragments("Bar", "ard")).toBe("Barard");
  });

  it("recolle directement quand les bouts alternent (consonne puis voyelle)", () => {
    expect(joinNameFragments("Al", "amond")).toBe("Alamond");
  });

  it("insere un 'l' de liaison entre deux voyelles", () => {
    expect(joinNameFragments("Ala", "ithor")).toBe("Alalithor");
  });

  it("insere un 'a' de liaison entre deux consonnes", () => {
    expect(joinNameFragments("Bran", "dric")).toBe("Branadric");
  });
});

describe("composeFragmentName", () => {
  it("assemble debut + fin sans milieu", () => {
    expect(composeFragmentName("Al", null, "mond")).toBe("Alamond");
  });

  it("assemble debut + milieu + fin", () => {
    expect(composeFragmentName("Bar", "en", "ard")).toBe("Barenard");
  });
});
