import { describe, expect, it } from "vitest";
import { partagerEgalement } from "./partage";

describe("partage égal entre personnages (V3.1-34, outil Table)", () => {
  it("10 po entre trois PJ : 3 chacun, 1 de reste", () => {
    expect(partagerEgalement(10, 3)).toEqual({ parPersonne: 3, reste: 1 });
  });
  it("une somme qui tombe juste : pas de reste", () => {
    expect(partagerEgalement(300, 3)).toEqual({ parPersonne: 100, reste: 0 });
  });
  it("moins que de personnages : rien chacun, tout en reste", () => {
    expect(partagerEgalement(2, 3)).toEqual({ parPersonne: 0, reste: 2 });
  });
  it("une perte se partage aussi (le reste garde le signe)", () => {
    expect(partagerEgalement(-10, 3)).toEqual({ parPersonne: -3, reste: -1 });
  });
  it("personne à qui partager, ou somme non entière : refusé", () => {
    expect(() => partagerEgalement(10, 0)).toThrow();
    expect(() => partagerEgalement(10.5, 2)).toThrow();
    expect(() => partagerEgalement(10, 1.5)).toThrow();
  });
});
