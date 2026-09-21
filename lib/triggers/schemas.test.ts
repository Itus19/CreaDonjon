import { describe, expect, it } from "vitest";
import { simulateTriggersSchema } from "./schemas";

const TRIGGER = {
  id: "mensonge",
  when: { event: "check_failed" },
  if: { op: "event_has", key: "skill:deception" },
  then: [{ action: "narrate_hint", text: "Il a vu le mensonge." }],
};

const BASE = {
  triggers: [TRIGGER],
  event: { event: "check_failed", subject: "moi", tags: ["skill:deception"] },
  actors: { moi: { conditions: [], features: [], numbers: {} } },
};

describe("entree du bac a sable de declencheurs", () => {
  it("accepte une simulation complete", () => {
    expect(simulateTriggersSchema.safeParse(BASE).success).toBe(true);
  });

  it("remplit les champs d'acteur omis — on saisit le minimum utile", () => {
    const out = simulateTriggersSchema.parse({ ...BASE, actors: { moi: {} } });
    expect(out.actors.moi).toEqual({ conditions: [], features: [], numbers: {} });
  });

  it("refuse une simulation sans acteur : un declencheur vise toujours quelqu'un", () => {
    expect(simulateTriggersSchema.safeParse({ ...BASE, actors: {} }).success).toBe(false);
  });

  it("refuse un evenement hors vocabulaire, jusque dans le bac a sable", () => {
    expect(
      simulateTriggersSchema.safeParse({ ...BASE, event: { event: "le_joueur_eternue", subject: "moi" } }).success,
    ).toBe(false);
  });

  it("refuse un declencheur mal forme plutot que de le simuler a moitie", () => {
    expect(simulateTriggersSchema.safeParse({ ...BASE, triggers: [{ ...TRIGGER, then: [] }] }).success).toBe(false);
  });

  it("borne le nombre de declencheurs simules a la meme valeur que le moteur", () => {
    const beaucoup = Array.from({ length: 33 }, (_, i) => ({ ...TRIGGER, id: `t${i}` }));
    expect(simulateTriggersSchema.safeParse({ ...BASE, triggers: beaucoup }).success).toBe(false);
  });

  it("exige au moins un declencheur : simuler le vide n'apprend rien", () => {
    expect(simulateTriggersSchema.safeParse({ ...BASE, triggers: [] }).success).toBe(false);
  });
});
