import { describe, expect, it } from "vitest";
import { isProseSlot, type GeneratorProseSlot, type GeneratorTableSlot } from "./types";

describe("isProseSlot", () => {
  it("reconnait un emplacement prose", () => {
    const slot: GeneratorProseSlot = { key: "ambiance_desc", prose: "Decris l'ambiance." };
    expect(isProseSlot(slot)).toBe(true);
  });

  it("rejette un emplacement table", () => {
    const slot: GeneratorTableSlot = { key: "nom", table: "noms-taverne" };
    expect(isProseSlot(slot)).toBe(false);
  });
});
