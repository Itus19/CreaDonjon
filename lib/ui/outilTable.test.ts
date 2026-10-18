import { describe, expect, it } from "vitest";
import type { TablePc, TableResource } from "@/src/server/services/tableParty";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import {
  apercuPieces,
  apercuXp,
  changeFait,
  desDeVie,
  fusionnerEtat,
  groupesDeCompteurs,
  ligneRepliee,
  lireMontant,
  progressionXp,
} from "./outilTable";

function etatDeJeu(patch: Partial<RuntimeState> = {}): RuntimeState {
  return {
    hp: { current: 10, temp: 0 },
    hit_dice: {},
    exhaustion: 0,
    inspiration: 0,
    xp: 0,
    resources: {},
    spell_slots_used: {},
    pact_slots_used: 0,
    conditions: [],
    death_saves: { success: 0, fail: 0 },
    attuned: [],
    pending_request: null,
    concentration: null,
    ...patch,
  };
}

function pj(patch: Partial<TablePc> = {}, etat: Partial<RuntimeState> = {}): TablePc {
  return {
    entityId: "e1",
    entitySlug: "perrin",
    name: "Perrin",
    playerName: "Gaby",
    speciesLabel: "Humain",
    classesLabel: "Guerrier · Champion",
    level: 2,
    sheet: { ac: { value: 15 } } as TablePc["sheet"],
    hitDiceTotals: { d10: 2 },
    runtimeState: { state: etatDeJeu(etat), hpMax: 20, hitDiceTotals: { d10: 2 } },
    resources: [],
    currency: { pp: 0, gp: 5, ep: 0, sp: 0, cp: 0 },
    ...patch,
  };
}

function compteur(id: string, recharge: TableResource["recharge"]): TableResource {
  return { id, label: id, recharge, max: 3, used: 1 };
}

describe("groupesDeCompteurs", () => {
  it("range par recharge : repos court (tout ou un), repos long, puis le reste", () => {
    const groupes = groupesDeCompteurs([
      compteur("rage", "short_rest_one"),
      compteur("aube", "dawn"),
      compteur("souffle", "short_rest"),
      compteur("conduit", "long_rest"),
      compteur("chance", "never"),
    ]);
    expect(groupes.map((g) => [g.cle, g.compteurs.map((c) => c.id)])).toEqual([
      ["reposCourt", ["rage", "souffle"]],
      ["reposLong", ["conduit"]],
      ["autres", ["aube", "chance"]],
    ]);
  });

  it("n'affiche pas un groupe vide", () => {
    expect(groupesDeCompteurs([compteur("conduit", "long_rest")]).map((g) => g.cle)).toEqual(["reposLong"]);
    expect(groupesDeCompteurs([])).toEqual([]);
  });
});

describe("desDeVie", () => {
  it("restants = état de jeu, sinon le total ; du plus petit au plus grand", () => {
    const pc = pj({ hitDiceTotals: { d10: 3, d8: 2 } }, { hit_dice: { d10: 1 } });
    expect(desDeVie(pc)).toEqual([
      { die: "d8", restants: 2, total: 2 },
      { die: "d10", restants: 1, total: 3 },
    ]);
  });

  it("ignore un dé que les routes n'acceptent pas", () => {
    expect(desDeVie(pj({ hitDiceTotals: { d4: 1 } }))).toEqual([]);
  });
});

describe("ligneRepliee", () => {
  it("compose nom, niveau, joueur, CA, PV, états et classe", () => {
    const ligne = ligneRepliee(pj({}, { conditions: ["À terre"] }));
    expect(ligne).toMatchObject({ nom: "Perrin", niveau: 2, joueur: "Gaby", ca: 15, pv: "10/20", etats: ["À terre"], classes: "Guerrier · Champion", etat: "vivant" });
  });

  it("à 0 PV : mourant, puis mort à trois échecs", () => {
    expect(ligneRepliee(pj({}, { hp: { current: 0, temp: 0 } })).etat).toBe("mourant");
    expect(ligneRepliee(pj({}, { hp: { current: 0, temp: 0 }, death_saves: { success: 0, fail: 3 } })).etat).toBe("mort");
  });
});

describe("progressionXp", () => {
  it("part de l'anneau entre le seuil du niveau et celui du suivant", () => {
    expect(progressionXp(2, 600)).toEqual({ xpCeiling: 900, xpPct: 50 });
  });
  it("au niveau 20, l'anneau est plein", () => {
    expect(progressionXp(20, 400000).xpPct).toBe(100);
  });
});

describe("fusionnerEtat", () => {
  it("remplace l'état de jeu et recalcule les consommations ; garde la bourse sans nouvelle", () => {
    const pc = pj({ resources: [compteur("rage", "long_rest")] });
    const neuf = fusionnerEtat(pc, {
      sheet: pc.sheet,
      hitDiceTotals: pc.hitDiceTotals,
      runtimeState: { state: etatDeJeu({ resources: { rage: 3 } }), hpMax: 20, hitDiceTotals: pc.hitDiceTotals },
    });
    expect(neuf.resources[0].used).toBe(3);
    expect(neuf.currency).toEqual(pc.currency);
  });
});

describe("lireMontant", () => {
  it("accepte un entier signé non nul", () => {
    expect(lireMontant("10")).toBe(10);
    expect(lireMontant(" -5 ")).toBe(-5);
    expect(lireMontant("+3")).toBe(3);
  });
  it("refuse le reste", () => {
    for (const texte of ["", "0", "1,5", "abc", "99999999999999999999"]) expect(lireMontant(texte)).toBeNull();
  });
});

describe("changeFait", () => {
  const avant = { pp: 0, gp: 9, ep: 0, sp: 0, cp: 0 };
  it("pas de change : la bourse suit l'écart", () => {
    expect(changeFait(avant, { gp: 1 }, { ...avant, gp: 10 })).toBe(false);
  });
  it("10 pa regroupés en 1 po : le serveur a fait du change", () => {
    expect(changeFait({ ...avant, sp: 9 }, { sp: 1 }, { ...avant, gp: 10, sp: 0 })).toBe(true);
  });
});

describe("apercuXp", () => {
  it("partage 1000 PX entre trois : 333 chacun, le reste (1) affiché", () => {
    const trois = [pj({ entityId: "a" }), pj({ entityId: "b" }), pj({ entityId: "c" })];
    const apercu = apercuXp(trois, 1000, "partager");
    expect(apercu.parPersonne).toBe(333);
    expect(apercu.reste).toBe(1);
    expect(apercu.lignes.map((l) => l.nouveauTotal)).toEqual([333, 333, 333]);
  });

  it("à chacun : le montant entier pour tous, aucun reste", () => {
    const apercu = apercuXp([pj(), pj({ entityId: "b" })], 300, "chacun");
    expect(apercu.parPersonne).toBe(300);
    expect(apercu.reste).toBe(0);
  });

  it("signale le niveau atteint, jamais sous le seuil", () => {
    const [ligne] = apercuXp([pj({ level: 2 }, { xp: 800 })], 100, "chacun").lignes;
    expect(ligne.monteAuNiveau).toBe(3);
    const [sous] = apercuXp([pj({ level: 2 }, { xp: 800 })], 99, "chacun").lignes;
    expect(sous.monteAuNiveau).toBeNull();
  });

  it("une perte ne descend pas sous 0", () => {
    expect(apercuXp([pj({}, { xp: 50 })], -100, "chacun").lignes[0].nouveauTotal).toBe(0);
  });

  it("personne de coché : aucune ligne", () => {
    expect(apercuXp([], 100, "partager")).toEqual({ lignes: [], parPersonne: 0, reste: 0 });
  });
});

describe("apercuPieces", () => {
  const trois = [pj({ entityId: "a" }), pj({ entityId: "b" }), pj({ entityId: "c" })];

  it("partage 10 po entre trois : 3 po chacun, reste 1", () => {
    const apercu = apercuPieces(trois, 10, "partager", "gp");
    expect(apercu.parPersonne).toBe(3);
    expect(apercu.reste).toBe(1);
    expect(apercu.lignes.map((l) => l.nouveauTotal)).toEqual([8, 8, 8]);
  });

  it("une dépense plus grosse que la bourse : pas de nouveau total", () => {
    const [ligne] = apercuPieces([pj()], -9, "chacun", "gp").lignes;
    expect(ligne.nouveauTotal).toBeNull();
  });
});
