import { describe, expect, it } from "vitest";
import { attackSight, canSee, lightAt, targetingRefusal, type Perceiver, type PerceptionWorld } from "./perception";

/**
 * V3.1-180 (ADR 0078) — qui voit qui, en fonctions PURES : la lumière en un
 * point (ambiante et sources), les sens et leur portée, les états Aveuglé,
 * Invisible, Caché. Sans plan, seuls les états comptent.
 */

const nuit: PerceptionWorld = { ambient: "dark", sources: [], planned: true };
const jour: PerceptionWorld = { ambient: "bright", sources: [], planned: true };
const qui = (id: string, x: number, extra: Partial<Perceiver> = {}): Perceiver => ({ id, pos: { x, y: 0 }, conditions: [], senses: {}, ...extra });

describe("lightAt : la lumière en un point", () => {
  it("l'ambiante, sauf près d'une source : vive dans son rayon, faible au-delà jusqu'à son second rayon", () => {
    // Lumière de l'Aasimar : 3 m de lumière vive, puis 3 m de lumière faible.
    const monde = { ...nuit, sources: [{ pos: { x: 0, y: 0 }, bright: 3, dim: 3 }] };
    expect(lightAt({ x: 2, y: 0 }, monde)).toBe("bright");
    expect(lightAt({ x: 5, y: 0 }, monde)).toBe("dim");
    expect(lightAt({ x: 7, y: 0 }, monde)).toBe("dark");
  });

  it("une source n'assombrit jamais : en plein jour, tout est vif ; sans position, l'ambiante", () => {
    expect(lightAt({ x: 50, y: 0 }, { ...jour, sources: [{ pos: { x: 0, y: 0 }, bright: 3, dim: 3 }] })).toBe("bright");
    expect(lightAt(null, { ...nuit, sources: [{ pos: { x: 0, y: 0 }, bright: 3, dim: 3 }] })).toBe("dark");
  });
});

describe("canSee : qui voit qui", () => {
  it("en plein jour, on voit ; un observateur Aveuglé ne voit rien, sauf par perception aveugle à portée", () => {
    expect(canSee(qui("lia", 0), qui("gob", 9), jour)).toBe("clear");
    expect(canSee(qui("lia", 0, { conditions: ["blinded"] }), qui("gob", 9), jour)).toBe("unseen");
    expect(canSee(qui("lia", 0, { conditions: ["blinded"], senses: { blindsight: 3 } }), qui("gob", 2), jour)).toBe("clear");
    expect(canSee(qui("lia", 0, { conditions: ["blinded"], senses: { blindsight: 3 } }), qui("gob", 9), jour)).toBe("unseen");
  });

  it("un gobelin Invisible n'est pas vu, sauf par vision véritable ou perception aveugle à portée", () => {
    const invisible = qui("gob", 9, { conditions: ["invisible"] });
    expect(canSee(qui("lia", 0), invisible, jour)).toBe("unseen");
    expect(canSee(qui("lia", 0, { senses: { truesight: 18 } }), invisible, jour)).toBe("clear");
    expect(canSee(qui("lia", 0, { senses: { truesight: 6 } }), invisible, jour)).toBe("unseen");
  });

  it("dans les ténèbres, un nain (vision dans le noir 36 m) voit à 30 m comme en lumière faible, pas à 40 m", () => {
    const nain = qui("thorin", 0, { senses: { darkvision: 36 } });
    expect(canSee(nain, qui("gob", 30), nuit)).toBe("obscured");
    expect(canSee(nain, qui("gob", 40), nuit)).toBe("unseen");
    expect(canSee(qui("lia", 0), qui("gob", 30), nuit)).toBe("unseen");
  });

  it("en lumière faible : voilé, sauf pour la vision dans le noir, qui y voit comme en plein jour", () => {
    const pénombre: PerceptionWorld = { ...jour, ambient: "dim" };
    expect(canSee(qui("lia", 0), qui("gob", 9), pénombre)).toBe("obscured");
    expect(canSee(qui("thorin", 0, { senses: { darkvision: 18 } }), qui("gob", 9), pénombre)).toBe("clear");
  });

  it("la lumière de la cible compte, pas celle de l'observateur : un gobelin porteur d'une torche se voit de loin", () => {
    const monde = { ...nuit, sources: [{ pos: { x: 30, y: 0 }, bright: 6, dim: 6 }] };
    expect(canSee(qui("lia", 0), qui("gob", 30), monde)).toBe("clear");
  });

  it("Caché : pas vu tant qu'on ne l'a pas trouvé (Perception au moins égale au total de Discrétion)", () => {
    const cache = qui("ombre", 6, { conditions: ["hidden"], hiddenTotal: 17 });
    expect(canSee(qui("gob", 0), cache, jour)).toBe("unseen");
    expect(canSee(qui("gob", 0), cache, jour, { perception: 16 })).toBe("unseen");
    expect(canSee(qui("gob", 0), cache, jour, { perception: 17 })).toBe("clear");
  });

  it("sans plan, seuls les états comptent : ni lumière ni portée des sens", () => {
    const sansPlan: PerceptionWorld = { ...nuit, planned: false };
    expect(canSee(qui("lia", 0), qui("gob", 300), sansPlan)).toBe("clear");
    expect(canSee(qui("lia", 0), qui("gob", 300, { conditions: ["invisible"] }), sansPlan)).toBe("unseen");
    expect(canSee(qui("lia", 0, { senses: { truesight: 9 } }), qui("gob", 300, { conditions: ["invisible"] }), sansPlan)).toBe("clear");
  });

  it("on se voit toujours soi-même", () => {
    expect(canSee(qui("lia", 0, { conditions: ["blinded"] }), qui("lia", 0, { conditions: ["invisible"] }), nuit)).toBe("clear");
  });
});

describe("attackSight : ce que la vue fait à une attaque", () => {
  it("une cible non vue : désavantage ; un attaquant non vu : avantage ; les deux s'annulent ; voilé ne change rien", () => {
    expect(attackSight({ attackerSeesTarget: "unseen", targetSeesAttacker: "clear" })).toBe("disadvantage");
    expect(attackSight({ attackerSeesTarget: "clear", targetSeesAttacker: "unseen" })).toBe("advantage");
    expect(attackSight({ attackerSeesTarget: "unseen", targetSeesAttacker: "unseen" })).toBe("normal");
    expect(attackSight({ attackerSeesTarget: "obscured", targetSeesAttacker: "obscured" })).toBe("normal");
  });
});

describe("targetingRefusal : restrictions et immunités par étiquette (M15)", () => {
  it("une créature hors d'atteinte de la divination, ou immunisée à un sort précis, est refusée comme cible", () => {
    const amulette = { untargetable: ["divination"], immuneSpells: [] };
    expect(targetingRefusal(amulette, { tags: ["divination"], spellKey: "locate-creature" })).toBe("untargetable");
    expect(targetingRefusal(amulette, { tags: ["evocation"], spellKey: "fire-bolt" })).toBeNull();
    expect(targetingRefusal({ untargetable: [], immuneSpells: ["magic-missile"] }, { tags: [], spellKey: "magic-missile" })).toBe("immune_spell");
  });
});
