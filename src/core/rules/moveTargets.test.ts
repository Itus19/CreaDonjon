import { describe, expect, it } from "vitest";
import { lieuxVoisins } from "./moveTargets";

const e = (source: string, target: string) => ({ source_entity_id: source, target_entity_id: target });

describe("lieuxVoisins — où l'IA peut proposer d'emmener le personnage", () => {
  const edges = [e("fanal", "gue"), e("cuisine", "fanal"), e("chambres", "fanal"), e("forge", "gue"), e("quais", "port")];

  it("les lieux contenus, le lieu qui contient, et les voisins du même parent", () => {
    expect(lieuxVoisins("fanal", edges).sort()).toEqual(["chambres", "cuisine", "forge", "gue"]);
  });

  it("depuis une pièce : le bâtiment et les autres pièces", () => {
    expect(lieuxVoisins("cuisine", edges).sort()).toEqual(["chambres", "fanal"]);
  });

  it("jamais le lieu courant, jamais deux fois le même", () => {
    const out = lieuxVoisins("fanal", [...edges, e("fanal", "gue")]);
    expect(out).not.toContain("fanal");
    expect(new Set(out).size).toBe(out.length);
  });

  it("un lieu isolé n'a aucun voisin", () => {
    expect(lieuxVoisins("ailleurs", edges)).toEqual([]);
  });
});
