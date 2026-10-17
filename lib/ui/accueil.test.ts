import { describe, expect, it } from "vitest";
import {
  delaiEcoule,
  formaterSeance,
  monPersonnage,
  ongletsMondes,
  premierOnglet,
  prochainesSeances,
  repartirMondes,
  type MondeAccueil,
} from "./accueil";

function monde(id: string, surcharge: Partial<MondeAccueil> = {}): MondeAccueil {
  return { id, mode: "campaign", myRole: "gm", nextSession: null, myCharacter: null, players: [], ...surcharge };
}

describe("repartirMondes", () => {
  it("range chaque monde dans un seul groupe", () => {
    const r = repartirMondes([
      monde("a"),
      monde("b", { myRole: "player" }),
      monde("c", { mode: "solo" }),
      monde("d", { mode: null, myRole: null }),
      monde("e", { mode: "solo", myRole: "player" }),
    ]);
    expect(r.jeMene.map((m) => m.id)).toEqual(["a", "d"]);
    expect(r.jeJoue.map((m) => m.id)).toEqual(["b"]);
    expect(r.enSolo.map((m) => m.id)).toEqual(["c", "e"]);
  });

  it("garde l'ordre d'origine dans un groupe", () => {
    const r = repartirMondes([monde("z"), monde("a")]);
    expect(r.jeMene.map((m) => m.id)).toEqual(["z", "a"]);
  });
});

describe("ongletsMondes", () => {
  it("ajoute Solo s'il y a des mondes solo", () => {
    const r = repartirMondes([monde("c", { mode: "solo" })]);
    expect(ongletsMondes(r, false)).toEqual(["mene", "joue", "solo"]);
  });
  it("ajoute Solo si le compte peut en créer", () => {
    expect(ongletsMondes(repartirMondes([monde("a")]), true)).toEqual(["mene", "joue", "solo"]);
  });
  it("n'ajoute pas Solo sinon", () => {
    expect(ongletsMondes(repartirMondes([monde("a")]), false)).toEqual(["mene", "joue"]);
  });
});

describe("prochainesSeances", () => {
  it("ignore les mondes sans séance et trie par date", () => {
    const seances = prochainesSeances([
      monde("tard", { nextSession: { startsAt: "2026-11-02T18:00:00.000Z", durationMinutes: 120 } }),
      monde("aucune"),
      monde("tot", { nextSession: { startsAt: "2026-10-20T18:00:00.000Z", durationMinutes: 90 } }),
    ]);
    expect(seances.map((s) => s.monde.id)).toEqual(["tot", "tard"]);
    expect(seances[0].durationMinutes).toBe(90);
  });

  it("renvoie une liste vide s'il n'y a aucune séance", () => {
    expect(prochainesSeances([monde("a")])).toEqual([]);
  });
});

describe("delaiEcoule", () => {
  const maintenant = Date.parse("2026-10-17T12:00:00.000Z");
  it("dit maintenant sous la minute", () => {
    expect(delaiEcoule("2026-10-17T11:59:30.000Z", maintenant)).toEqual({ unite: "maintenant", nombre: 0 });
  });
  it("compte les minutes", () => {
    expect(delaiEcoule("2026-10-17T11:15:00.000Z", maintenant)).toEqual({ unite: "minutes", nombre: 45 });
  });
  it("compte les heures entières", () => {
    expect(delaiEcoule("2026-10-17T08:30:00.000Z", maintenant)).toEqual({ unite: "heures", nombre: 3 });
  });
  it("compte les jours entiers", () => {
    expect(delaiEcoule("2026-10-14T11:00:00.000Z", maintenant)).toEqual({ unite: "jours", nombre: 3 });
  });
  it("traite une date future ou illisible comme maintenant", () => {
    expect(delaiEcoule("2026-10-18T12:00:00.000Z", maintenant).unite).toBe("maintenant");
    expect(delaiEcoule("pas une date", maintenant).unite).toBe("maintenant");
  });
});

describe("formaterSeance", () => {
  it("donne la date et l'heure en français", () => {
    const texte = formaterSeance("2026-10-03T18:30:00.000Z", "fr", "UTC");
    expect(texte).toContain("3");
    expect(texte).toContain("18:30");
  });
});

describe("monPersonnage", () => {
  const joueur = monde("p", {
    myRole: "player",
    myCharacter: { entityId: "e1", name: "Aela" },
    players: [
      { entityId: "e0", speciesLabel: "Nain", classesLabel: "Guerrier" },
      { entityId: "e1", speciesLabel: "Elfe", classesLabel: "Magicien 3" },
    ],
  });
  it("retrouve l'espèce et les classes par identifiant", () => {
    expect(monPersonnage(joueur)).toEqual({ nom: "Aela", detail: "Elfe · Magicien 3" });
  });
  it("n'invente pas de détail", () => {
    expect(monPersonnage({ ...joueur, players: [] })).toEqual({ nom: "Aela", detail: null });
  });
  it("renvoie null sans personnage", () => {
    expect(monPersonnage(monde("x", { myRole: "player" }))).toBeNull();
  });
});

describe("premier onglet du téléphone (V3.1-35)", () => {
  const vide = { jeMene: [], enSolo: [], jeJoue: [] };
  it("le premier qui a des mondes", () => {
    expect(premierOnglet({ ...vide, jeJoue: [1] })).toBe("joue");
    expect(premierOnglet({ ...vide, enSolo: [1] })).toBe("solo");
    expect(premierOnglet({ jeMene: [1], enSolo: [1], jeJoue: [1] })).toBe("mene");
  });
  it("aucun monde : « Je mène »", () => {
    expect(premierOnglet(vide)).toBe("mene");
  });
});
