import { describe, expect, it } from "vitest";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import {
  actionsDeMonstre,
  adversairesSansInitiative,
  appliquerPv,
  classerSort,
  corpsJetCible,
  demandeDegatsApres,
  desDeLaFormule,
  effetDesChanges,
  estUneArme,
  fractionsAnneau,
  joueusesEnAttente,
  libellePv,
  menaceRestante,
  nomOrigine,
  ordonner,
  pasInitiative,
  peutCommencerRound,
  phaseDe,
  sortieDepuisJetCible,
  tousAdversairesVaincus,
  validationMjRequise,
} from "./initiative";

function participant(extra: Partial<CombatParticipantRow> & { id: string }): CombatParticipantRow {
  return {
    combat_id: "c1",
    source_kind: "statblock",
    entity_id: null,
    rule_key: null,
    label: extra.id,
    initiative: null,
    ac: 12,
    hp_max: 10,
    hp_current: 10,
    temp_hp: 0,
    conditions: [],
    concentration: null,
    is_ally: false,
    display_order: 0,
    created_at: "2026-10-24T00:00:00Z",
    ...extra,
  };
}

const pj = (id: string, extra: Partial<CombatParticipantRow> = {}) =>
  participant({ id, source_kind: "entity", entity_id: `e-${id}`, is_ally: true, ...extra });

describe("phaseDe", () => {
  it("reconnaît les cinq statuts et se replie sur « draft » pour une valeur inconnue", () => {
    expect(phaseDe("rolling")).toBe("rolling");
    expect(phaseDe("paused")).toBe("paused");
    expect(phaseDe("ended")).toBe("ended");
    expect(phaseDe("n'importe quoi")).toBe("draft");
  });
});

describe("ordonner", () => {
  it("trie par initiative décroissante, les sans-score en dernier, égalité par ordre d'ajout", () => {
    const rows = [
      participant({ id: "a", initiative: 10, display_order: 0 }),
      participant({ id: "b", initiative: null, display_order: 1 }),
      participant({ id: "c", initiative: 15, display_order: 2 }),
      participant({ id: "d", initiative: 10, display_order: 3 }),
    ];
    expect(ordonner(rows).map((p) => p.id)).toEqual(["c", "a", "d", "b"]);
  });
});

describe("qui manque", () => {
  const rows = [
    pj("p1", { initiative: 14 }),
    pj("p2"),
    participant({ id: "g1" }),
    participant({ id: "g2", initiative: 9 }),
  ];
  it("les joueuses en attente sont les PJ sans score", () => {
    expect(joueusesEnAttente(rows).map((p) => p.id)).toEqual(["p2"]);
  });
  it("les adversaires sans score sont les non-PJ sans score", () => {
    expect(adversairesSansInitiative(rows).map((p) => p.id)).toEqual(["g1"]);
  });
  it("le Round 1 attend que tout le monde ait un score, et au moins un participant", () => {
    expect(peutCommencerRound(rows)).toBe(false);
    expect(peutCommencerRound([pj("p1", { initiative: 3 }), participant({ id: "g", initiative: 5 })])).toBe(true);
    expect(peutCommencerRound([])).toBe(false);
  });
});

describe("menaceRestante", () => {
  const xp = { gob: 50, worg: 100 };
  it("rapporte l'XP des adversaires debout à celle de tous les adversaires", () => {
    const rows = [
      participant({ id: "w", rule_key: "worg" }),
      participant({ id: "g1", rule_key: "gob", hp_current: 0 }),
      participant({ id: "g2", rule_key: "gob" }),
      pj("p1"),
    ];
    expect(menaceRestante(rows, xp)).toEqual({ restant: 150, total: 200, pourcent: 75 });
  });
  it("ignore les adversaires sans XP connue (saisie libre) et rend null sans rien à mesurer", () => {
    expect(menaceRestante([participant({ id: "x", source_kind: "custom" }), pj("p1")], xp)).toBeNull();
  });
  it("un adversaire sans PV connus compte comme debout", () => {
    const rows = [participant({ id: "g", rule_key: "gob", hp_max: null, hp_current: null })];
    expect(menaceRestante(rows, xp)?.restant).toBe(50);
  });
});

describe("tousAdversairesVaincus", () => {
  it("vrai quand tous les adversaires à PV connus sont à 0", () => {
    const rows = [pj("p1"), participant({ id: "g1", hp_current: 0 }), participant({ id: "g2", hp_current: 0 })];
    expect(tousAdversairesVaincus(rows)).toBe(true);
  });
  it("faux dès qu'un adversaire tient debout", () => {
    expect(tousAdversairesVaincus([participant({ id: "g1", hp_current: 0 }), participant({ id: "g2" })])).toBe(false);
  });
  it("faux sans adversaire à PV connus : rien à confirmer", () => {
    expect(tousAdversairesVaincus([pj("p1")])).toBe(false);
    expect(tousAdversairesVaincus([participant({ id: "piege", hp_max: null, hp_current: null })])).toBe(false);
  });
  it("un allié (PNJ) à 0 PV n'est pas un adversaire", () => {
    expect(tousAdversairesVaincus([participant({ id: "pnj", is_ally: true, hp_current: 0 }), participant({ id: "g" })])).toBe(false);
  });
});

describe("appliquerPv", () => {
  it("les dégâts entament d'abord les PV temporaires", () => {
    expect(appliquerPv(participant({ id: "a", hp_current: 10, hp_max: 10, temp_hp: 3 }), -5)).toEqual({ hpCurrent: 8, tempHp: 0 });
    expect(appliquerPv(participant({ id: "a", hp_current: 10, hp_max: 10, temp_hp: 8 }), -5)).toEqual({ hpCurrent: 10, tempHp: 3 });
  });
  it("jamais sous 0 PV", () => {
    expect(appliquerPv(participant({ id: "a", hp_current: 2, hp_max: 10 }), -5)).toEqual({ hpCurrent: 0, tempHp: 0 });
  });
  it("un soin remonte jusqu'au maximum, sans toucher aux PV temporaires", () => {
    expect(appliquerPv(participant({ id: "a", hp_current: 9, hp_max: 10, temp_hp: 4 }), 5)).toEqual({ hpCurrent: 10, tempHp: 4 });
  });
});

describe("l'anneau de PV", () => {
  it("la fraction des PV, sa couleur, et l'arc des PV temporaires autour", () => {
    expect(fractionsAnneau(participant({ id: "a", hp_current: 15, hp_max: 15, temp_hp: 5 }))).toEqual({ pv: 100, temp: 33, ton: "plein" });
    expect(fractionsAnneau(participant({ id: "a", hp_current: 5, hp_max: 15 }))).toEqual({ pv: 33, temp: 0, ton: "bas" });
    expect(fractionsAnneau(participant({ id: "a", hp_current: 9, hp_max: 15 }))?.ton).toBe("moyen");
    expect(fractionsAnneau(participant({ id: "a", hp_current: 0, hp_max: 15 }))?.ton).toBe("hors");
  });
  it("les PV temporaires sont plafonnés à un tour complet", () => {
    expect(fractionsAnneau(participant({ id: "a", hp_current: 10, hp_max: 10, temp_hp: 40 }))?.temp).toBe(100);
  });
  it("sans PV maximum, pas d'anneau", () => {
    expect(fractionsAnneau(participant({ id: "a", hp_max: null, hp_current: null }))).toBeNull();
  });
  it("l'annotation « PV+temporaires / max »", () => {
    expect(libellePv(participant({ id: "a", hp_current: 15, hp_max: 15, temp_hp: 5 }))).toBe("20/15");
    expect(libellePv(participant({ id: "a", hp_current: 7, hp_max: 15 }))).toBe("7/15");
    expect(libellePv(participant({ id: "a", hp_max: null, hp_current: null }))).toBeNull();
  });
});

describe("nomOrigine", () => {
  const noms = { gobelin: "Gobelin", worg: "Worg" };
  it("rien tant que le nom affiché commence par le nom du monstre", () => {
    expect(nomOrigine(participant({ id: "a", rule_key: "gobelin", label: "Gobelin 1" }), noms)).toBeNull();
    expect(nomOrigine(participant({ id: "a", rule_key: "gobelin", label: "gobelin" }), noms)).toBeNull();
  });
  it("le nom d'origine quand l'adversaire est renommé", () => {
    expect(nomOrigine(participant({ id: "a", rule_key: "gobelin", label: "Monstre non identifié" }), noms)).toBe("Gobelin");
  });
  it("rien pour une saisie libre ou une clé inconnue", () => {
    expect(nomOrigine(participant({ id: "a", source_kind: "custom", label: "Piège" }), noms)).toBeNull();
    expect(nomOrigine(participant({ id: "a", rule_key: "inconnu", label: "X" }), noms)).toBeNull();
  });
});

describe("pasInitiative", () => {
  it("▲▼ d'un cran, dans les bornes de la table", () => {
    expect(pasInitiative(10, 1)).toBe(11);
    expect(pasInitiative(10, -1)).toBe(9);
    expect(pasInitiative(40, 1)).toBe(40);
    expect(pasInitiative(-10, -1)).toBe(-10);
  });
});

describe("actionsDeMonstre", () => {
  const caracteristiques = {
    kind: "monster" as const,
    statBlock: {} as never,
    actions: {
      actions: [
        { name: "Morsure", description: "Corps à corps.", attack_bonus: 5, damage: [{ dice: { op: "dice" as const, count: 1, faces: 6 }, type: "perçant" }] },
        { name: "Souffle", description: "Le monstre exhale. Jet de sauvegarde de Dextérité DD 13 pour éviter." },
        { name: "Posture", description: "Rien de mécanique." },
      ],
    },
  };
  it("une ligne par action, avec touche, dégâts ou DD quand ils existent", () => {
    const actions = actionsDeMonstre(caracteristiques);
    expect(actions[0]).toMatchObject({ nom: "Morsure", touche: 5, degats: "1d6 perçant", dd: null });
    expect(actions[1]).toMatchObject({ nom: "Souffle", touche: null, degats: null, dd: 13 });
    expect(actions[2]).toMatchObject({ nom: "Posture", touche: null, degats: null, dd: null });
  });
  it("rien pour un participant sans bloc d'actions", () => {
    expect(actionsDeMonstre({ kind: "none" })).toEqual([]);
  });
});

describe("classer les fiches de règle d'un personnage", () => {
  it("une arme a un bloc weapon", () => {
    expect(estUneArme([{ blockType: "weapon", data: {} }])).toBe(true);
    expect(estUneArme([{ blockType: "armor", data: {} }])).toBe(false);
    expect(estUneArme(undefined)).toBe(false);
  });
  const effet = (partiel: object) => [
    { blockType: "spell_casting", data: { level: 2 } },
    { blockType: "effects", data: { effects: [{ id: "e1", ...partiel }] } },
  ];
  it("un sort à attaque, à sauvegarde, de soin, et son niveau", () => {
    expect(classerSort(effet({ attack: { range: "ranged" }, damage_type: "fire" }))).toEqual({ genre: "spell_attack", niveau: 2 });
    expect(classerSort(effet({ save: { ability: "dex" }, damage_type: "fire" }))).toEqual({ genre: "spell_save", niveau: 2 });
    expect(classerSort(effet({ formula: { op: "dice", count: 1, faces: 8 } }))).toEqual({ genre: "heal", niveau: 2 });
  });
  it("un sort sans mécanique d'attaque, de sauvegarde ou de soin n'a pas de bouton", () => {
    expect(classerSort(effet({ damage_type: "force", formula: { op: "num", value: 3 } }))).toEqual({ genre: null, niveau: 2 });
    expect(classerSort(undefined)).toEqual({ genre: null, niveau: 0 });
  });
});

describe("corpsJetCible", () => {
  it("décrit le jet sans jamais en donner le résultat", () => {
    expect(
      corpsJetCible({
        kind: "attack",
        acteur: { kind: "participant", participantId: "p1" },
        action: { kind: "monster_action", name: "Morsure" },
        cibleId: "c1",
      })
    ).toEqual({
      kind: "attack",
      actor: { kind: "participant", participantId: "p1" },
      action: { kind: "monster_action", name: "Morsure" },
      targetId: "c1",
      advantage: "normal",
      critical: false,
      secret: true,
    });
  });
});

describe("sortieDepuisJetCible", () => {
  const libelle = (cle: string, cible: string) => `${cle} — ${cible}`;
  const base = { ok: true as const, verdict: null, amount: null, facts: [], changes: [], hints: [], ignored: [], targetOutOfFight: false, chained: null, rollEventId: "r", saveRequestId: null, dice: null };
  it("une touche se lit « touche » avec un verdict de réussite", () => {
    const sortie = sortieDepuisJetCible({ ...base, verdict: "hit" }, "attack", { acteur: "Worg", cible: "Léonie", libelle });
    expect(sortie).toMatchObject({ who: "Worg", what: "touche — Léonie", verdict: "success", total: 0, trace: [] });
  });
  it("un coup raté est un échec", () => {
    expect(sortieDepuisJetCible({ ...base, verdict: "miss" }, "attack", { acteur: "Worg", cible: "Léonie", libelle }).verdict).toBe("fail");
  });
  it("des dégâts portent le montant, sans verdict", () => {
    expect(sortieDepuisJetCible({ ...base, amount: 7 }, "damage", { acteur: "Worg", cible: "Léonie", libelle })).toMatchObject({ what: "degats — Léonie", total: 7, verdict: null });
  });
});

describe("jets ciblés : dés, avantage, suite (V3.1-38 suite)", () => {
  const libelle = (cle: string, cible: string) => `${cle} — ${cible}`;
  const base = { ok: true as const, verdict: null, amount: null, facts: [], changes: [], hints: [], ignored: [], targetOutOfFight: false, chained: null, rollEventId: "r", saveRequestId: null, dice: null };
  const demande = {
    kind: "attack" as const,
    acteur: { kind: "character" as const, entityId: "e1" },
    action: { kind: "weapon" as const, itemId: "i1" },
    cibleId: "c1",
  };

  it("une attaque montre ses dés : total de l'attaque, paire d'avantage, d20 gardé", () => {
    const dice = { total: 22, trace: [{ text: "2d20kh1 (7, 17)", value: 17 }, { text: "+5", value: 5 }], pair: { mode: "advantage" as const, rolls: [7, 17] as [number, number], keptIndex: 1 as const }, naturalD20: 17 };
    expect(sortieDepuisJetCible({ ...base, verdict: "hit", dice }, "attack", { acteur: "Naivara", cible: "Worg", libelle })).toMatchObject({
      total: 22,
      trace: dice.trace,
      pair: dice.pair,
      naturalD20: 17,
      verdict: "success",
    });
  });

  it("l'avantage et le critique choisis passent dans la demande", () => {
    expect(corpsJetCible(demande, { avantage: "disadvantage" })).toMatchObject({ advantage: "disadvantage", critical: false, secret: false });
    expect(corpsJetCible({ ...demande, kind: "damage" }, { critique: true })).toMatchObject({ kind: "damage", advantage: "normal", critical: true });
  });

  it("une touche propose les dégâts sur la même cible, critique compris ; un raté, rien", () => {
    const chained = { kind: "damage" as const, actor: demande.acteur, action: demande.action, targetId: "c1", critical: true };
    expect(demandeDegatsApres({ ...base, verdict: "hit", chained })).toEqual({
      demande: { kind: "damage", acteur: demande.acteur, action: demande.action, cibleId: "c1" },
      critique: true,
    });
    expect(demandeDegatsApres({ ...base, verdict: "miss" })).toBeNull();
  });
});

describe("effet d'un jet de dégâts (V3.1-106)", () => {
  const libelle = (cle: string, cible: string) => `${cle} — ${cible}`;
  const base = { ok: true as const, verdict: null, amount: 3, facts: [], changes: [], hints: [], ignored: [], targetOutOfFight: false, chained: null, rollEventId: "r", saveRequestId: null, dice: null };

  it("retire la note entre parenthèses du journal et joint les lignes", () => {
    expect(effetDesChanges(["Worg : 7 → 4 PV (Cibler — Naivara attaque)"])).toBe("Worg : 7 → 4 PV");
    expect(effetDesChanges(["Worg : 7 → 4 PV (n)", "Worg subit : prone"])).toBe("Worg : 7 → 4 PV · Worg subit : prone");
    expect(effetDesChanges([])).toBeNull();
  });
  it("des dégâts ciblés affichent l'effet à la place de « Dégâts — X », sans verdict", () => {
    const sortie = sortieDepuisJetCible({ ...base, changes: ["Worg : 7 → 4 PV (note)"] }, "damage", { acteur: "Naivara", cible: "Worg", libelle });
    expect(sortie).toMatchObject({ what: "Worg : 7 → 4 PV", verdict: null, total: 3 });
  });
  it("sans changement, le libellé du jet reste", () => {
    expect(sortieDepuisJetCible(base, "damage", { acteur: "Naivara", cible: "Worg", libelle }).what).toBe("degats — Worg");
  });
  it("un soin affiche aussi son effet", () => {
    expect(sortieDepuisJetCible({ ...base, changes: ["Tharnok : 3 → 10 PV (n)"] }, "heal", { acteur: "Naivara", cible: "Tharnok", libelle }).what).toBe("Tharnok : 3 → 10 PV");
  });
});

describe("validationMjRequise (V3.1-106)", () => {
  const monstre = { kind: "participant" as const, participantId: "p1" };
  const pj = { kind: "character" as const, entityId: "e1" };
  it("un monstre qui vise un allié attend la validation du MJ", () => {
    expect(validationMjRequise(monstre, { is_ally: true })).toBe(true);
  });
  it("un monstre qui vise un adversaire, ou un personnage qui vise un allié, non", () => {
    expect(validationMjRequise(monstre, { is_ally: false })).toBe(false);
    expect(validationMjRequise(pj, { is_ally: true })).toBe(false);
    expect(validationMjRequise(monstre, undefined)).toBe(false);
  });
});

describe("desDeLaFormule", () => {
  it("lit les dés et le modificateur d'une formule", () => {
    expect(desDeLaFormule("2d6+3 perçant")).toEqual({ dice: { d6: 2 }, modifier: 3 });
    expect(desDeLaFormule("1d8")).toEqual({ dice: { d8: 1 }, modifier: 0 });
    expect(desDeLaFormule("1d8-1")).toEqual({ dice: { d8: 1 }, modifier: -1 });
  });
  it("se replie sur un d6 quand la formule est illisible", () => {
    expect(desDeLaFormule(null)).toEqual({ dice: { d6: 1 }, modifier: 0 });
    expect(desDeLaFormule("1d7")).toEqual({ dice: { d6: 1 }, modifier: 0 });
  });
});
