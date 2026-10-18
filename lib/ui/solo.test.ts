import { describe, expect, it } from "vitest";
import type { EncashedTurnOutcome, PendingRequest, QuestColumnEntry, WikiColumnGroup } from "@/lib/solo/types";
import {
  adresseVue,
  deDeLaDemande,
  filtrerWiki,
  jaugesBande,
  jaugesEgales,
  memeDemande,
  preReglageDepuisDemande,
  progressionQuete,
  queteTerminee,
  sortieJetDepuisTour,
  trierQuetes,
  vueDepuisAdresse,
} from "./solo";

describe("vueDepuisAdresse", () => {
  it("lit les quatre vues", () => {
    expect(vueDepuisAdresse("monde")).toBe("monde");
    expect(vueDepuisAdresse("fiche")).toBe("fiche");
    expect(vueDepuisAdresse("quetes")).toBe("quetes");
    expect(vueDepuisAdresse("jeu")).toBe("jeu");
  });

  it("retombe sur le jeu pour une valeur absente ou inconnue", () => {
    expect(vueDepuisAdresse(null)).toBe("jeu");
    expect(vueDepuisAdresse("")).toBe("jeu");
    expect(vueDepuisAdresse("regles")).toBe("jeu");
  });
});

describe("adresseVue", () => {
  it("pose le parametre vue", () => {
    expect(adresseVue("/m/x/joueur/solo", "", "monde")).toBe("/m/x/joueur/solo?vue=monde");
  });

  it("retire le parametre pour le jeu (valeur par defaut)", () => {
    expect(adresseVue("/m/x/joueur/solo", "?vue=fiche", "jeu")).toBe("/m/x/joueur/solo");
  });

  it("garde les autres parametres", () => {
    expect(adresseVue("/m/x/joueur/solo", "?a=1&vue=monde", "quetes")).toBe("/m/x/joueur/solo?a=1&vue=quetes");
  });
});

describe("jaugesBande", () => {
  it("convertit la charge de livres en kg et calcule le pourcentage de PV", () => {
    const jauges = jaugesBande({ ac: 16, hpCurrent: 12, hpMax: 24, level: 3, exhaustion: 1, carriedLb: 50 });
    expect(jauges).toEqual({ ac: 16, hpCurrent: 12, hpMax: 24, pctPv: 50, level: 3, exhaustion: 1, chargeKg: 22.7 });
  });

  it("ne divise pas par zero quand le maximum est nul", () => {
    expect(jaugesBande({ ac: 10, hpCurrent: 0, hpMax: 0, level: 1, exhaustion: 0, carriedLb: 0 }).pctPv).toBe(0);
  });

  it("compare deux bandes par valeur", () => {
    const a = jaugesBande({ ac: 10, hpCurrent: 5, hpMax: 10, level: 1, exhaustion: 0, carriedLb: 0 });
    const b = jaugesBande({ ac: 10, hpCurrent: 5, hpMax: 10, level: 1, exhaustion: 0, carriedLb: 0 });
    expect(jaugesEgales(a, b)).toBe(true);
    expect(jaugesEgales(a, { ...b, hpCurrent: 4 })).toBe(false);
    expect(jaugesEgales(null, b)).toBe(false);
    expect(jaugesEgales(null, null)).toBe(true);
  });
});

const quete = (id: string, faits: boolean[]): QuestColumnEntry => ({
  id,
  title: `Quete ${id}`,
  giverName: null,
  rewardText: null,
  objectives: faits.map((done, i) => ({ id: `${id}-${i}`, text: `Etape ${i}`, done })),
});

describe("quetes", () => {
  const quetes = [quete("a", [true, false]), quete("b", [true, true]), quete("c", []), quete("d", [false])];

  it("une quete est terminee quand toutes ses etapes le sont (et qu'elle en a)", () => {
    expect(queteTerminee(quetes[0])).toBe(false);
    expect(queteTerminee(quetes[1])).toBe(true);
    expect(queteTerminee(quetes[2])).toBe(false);
  });

  it("trie en cours et terminees sans changer l'ordre", () => {
    expect(trierQuetes(quetes, "en_cours").map((q) => q.id)).toEqual(["a", "c", "d"]);
    expect(trierQuetes(quetes, "terminees").map((q) => q.id)).toEqual(["b"]);
  });

  it("dit la progression", () => {
    expect(progressionQuete(quetes[0])).toBe("1/2");
    expect(progressionQuete(quetes[2])).toBe("0/0");
  });
});

describe("filtrerWiki", () => {
  const groupes: WikiColumnGroup[] = [
    { kind: "location", label: "Lieux", entries: [{ id: "1", name: "Château d'Écume", slug: "chateau", excerpt: null }] },
    { kind: "pnj", label: "PNJ", entries: [{ id: "2", name: "Perrin", slug: "perrin", excerpt: null }] },
  ];

  it("rend tout sans recherche", () => {
    expect(filtrerWiki(groupes, "  ")).toEqual(groupes);
  });

  it("ignore casse et accents, et retire les groupes vides", () => {
    const resultat = filtrerWiki(groupes, "ECUME");
    expect(resultat).toHaveLength(1);
    expect(resultat[0].entries[0].name).toBe("Château d'Écume");
  });

  it("rend une liste vide quand rien ne correspond", () => {
    expect(filtrerWiki(groupes, "zzz")).toEqual([]);
  });
});

const demande = (surcharge: Partial<PendingRequest> = {}): PendingRequest => ({
  kind: "weapon_attack",
  action_id: "item-1",
  target_id: "entity:g",
  target_label: "Gobelin",
  advantage: "advantage",
  dc: 13,
  die_max: 20,
  modifier: 5,
  chips: [{ label: "FOR", value: 3 }],
  what: "Attaque — épée longue",
  actor_name: "Perrin",
  player_action_text: "je frappe",
  critical: false,
  ...surcharge,
});

describe("deDeLaDemande", () => {
  it("prend le de exact quand il existe", () => {
    expect(deDeLaDemande(20)).toBe("d20");
    expect(deDeLaDemande(6)).toBe("d6");
  });

  it("prend le plus petit de qui couvre une borne sans de (degats cumules)", () => {
    expect(deDeLaDemande(9)).toBe("d10");
    expect(deDeLaDemande(14)).toBe("d20");
    expect(deDeLaDemande(500)).toBe("d100");
  });
});

describe("preReglageDepuisDemande", () => {
  it("decrit le jet sans le resoudre", async () => {
    const lancer = async () => null;
    const pre = preReglageDepuisDemande(demande(), lancer);
    expect(pre).toMatchObject({ label: "Attaque — épée longue", dice: { d20: 1 }, modifier: 5, advantage: "advantage", dc: 13 });
    expect(pre.lancer).toBe(lancer);
  });
});

function tour(detail: Record<string, unknown>): EncashedTurnOutcome {
  return {
    record: { kind: "roll", facts: ["fait"], eventId: null, detail },
    changes: [],
    hints: [],
    ignored: [],
    time: null,
    narration: null,
    chained: null,
  };
}

describe("sortieJetDepuisTour", () => {
  it("lit une attaque : total, verdict, CA et de naturel", () => {
    const sortie = sortieJetDepuisTour(
      demande(),
      tour({ attack: { total: 19, trace: [{ text: "depuis la fiche", value: 14 }] }, ac: 13, verdict: "hit" })
    );
    expect(sortie).toMatchObject({ who: "Perrin", what: "Attaque — épée longue", total: 19, dc: 13, verdict: "success", naturalD20: 14, hidden: false });
    expect(sortie.trace).toEqual([{ text: "1d20 (14) = 14", value: 14 }]);
    expect(sortie.chips).toEqual([{ label: "FOR", value: 3 }]);
  });

  it("lit une attaque ratee", () => {
    const sortie = sortieJetDepuisTour(demande(), tour({ attack: { total: 8, trace: [{ text: "x", value: 3 }] }, ac: 13, verdict: "miss" }));
    expect(sortie.verdict).toBe("fail");
  });

  it("lit un test", () => {
    const sortie = sortieJetDepuisTour(
      demande({ kind: "skill_check", what: "Perception", dc: 12 }),
      tour({ check: { what: "Perception", total: 15, dc: 12, verdict: "success", trace: [{ text: "x", value: 10 }] } })
    );
    expect(sortie).toMatchObject({ total: 15, dc: 12, verdict: "success", naturalD20: 10 });
  });

  it("lit des degats : pas de verdict, pas de d20 naturel", () => {
    const sortie = sortieJetDepuisTour(
      demande({ kind: "weapon_damage", die_max: 8, modifier: 3, what: "Dégâts — épée longue" }),
      tour({ damage: { total: 9, trace: [{ text: "x", value: 6 }] } })
    );
    expect(sortie).toMatchObject({ total: 9, verdict: null, dc: null, naturalD20: null });
    expect(sortie.trace).toEqual([{ text: "1d8 (6) = 6", value: 6 }]);
  });

  it("n'invente pas de de quand le naturel depasse ses faces", () => {
    const sortie = sortieJetDepuisTour(
      demande({ kind: "weapon_damage", die_max: 12 }),
      tour({ damage: { total: 12, trace: [{ text: "x", value: 40 }] } })
    );
    expect(sortie.trace).toEqual([]);
  });

  it("retombe sur zero quand le detail manque", () => {
    const sortie = sortieJetDepuisTour(demande(), tour({}));
    expect(sortie.total).toBe(0);
    expect(sortie.trace).toEqual([]);
    expect(sortie.verdict).toBeNull();
  });
});

describe("memeDemande", () => {
  it("deux demandes identiques, même recopiées par une autre réponse du serveur", () => {
    expect(memeDemande(demande(), structuredClone(demande()))).toBe(true);
    expect(memeDemande(null, null)).toBe(true);
  });
  it("un champ qui change, ou une demande qui apparaît ou disparaît", () => {
    expect(memeDemande(demande(), demande({ dc: 14 }))).toBe(false);
    expect(memeDemande(demande(), demande({ chips: [{ label: "FOR", value: 4 }] }))).toBe(false);
    expect(memeDemande(null, demande())).toBe(false);
    expect(memeDemande(demande(), null)).toBe(false);
  });
});
