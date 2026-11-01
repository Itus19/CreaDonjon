import { describe, expect, it } from "vitest";
import {
  biggestHit,
  checkTiers,
  d20Average,
  d20Histogram,
  familyMeasures,
  favoriteAction,
  longestStreak,
  pickTitle,
  playerTitles,
  renderTemplate,
  rollCount,
  type StatsRoll,
} from "./playerStats";
import { DEFAULT_TITLE_TIERS, type PlayerTitleTier } from "./titleTiers";

/** Un jet de test : `n` = le d20 GARDÉ (V3.1-89 l'a déjà choisi, avantage ou désavantage compris). */
let horloge = 0;
function jet(p: Partial<StatsRoll> & { n?: number | null }): StatsRoll {
  horloge += 1;
  return {
    naturalD20: p.n === undefined ? (p.naturalD20 ?? null) : p.n,
    kind: p.kind ?? "check",
    what: p.what ?? "Perception",
    result: p.result ?? 10,
    createdAt: p.createdAt ?? new Date(Date.UTC(2026, 9, 1, 0, 0, horloge)).toISOString(),
  };
}

describe("l'histogramme des d20 gardés (V3.1-90)", () => {
  it("aucun jet : vingt zéros, trop peu", () => {
    const h = d20Histogram([]);
    expect(h.counts).toEqual(Array(20).fill(0));
    expect(h.total).toBe(0);
    expect(h.tooFew).toBe(true);
  });

  it("compte le d20 GARDÉ : avec avantage (20 gardé) comme avec désavantage (1 gardé), un seul dé par jet", () => {
    // Avantage 20/7 → 20 gardé ; désavantage 1/15 → 1 gardé. Le chiffre des 20 égale sa barre.
    const h = d20Histogram([jet({ n: 20 }), jet({ n: 1 }), jet({ n: 20 }), jet({ n: 11 }), jet({ n: 11 })]);
    expect(h.counts[19]).toBe(2);
    expect(h.counts[0]).toBe(1);
    expect(h.counts[10]).toBe(2);
    expect(h.total).toBe(5);
    expect(h.tooFew).toBe(false);
  });

  it("un jet sans d20 (dégâts) n'entre pas dans l'histogramme ni dans le compte", () => {
    const rolls = [jet({ n: 12 }), jet({ kind: "damage", n: null, result: 9 })];
    expect(d20Histogram(rolls).total).toBe(1);
    expect(rollCount(rolls)).toBe(1);
  });
});

describe("moyenne et suites", () => {
  it("moyenne des d20 gardés au dixième ; null sans jet", () => {
    expect(d20Average([])).toBeNull();
    expect(d20Average([jet({ n: 20 }), jet({ n: 1 }), jet({ n: 12 })])).toBe(11);
    expect(d20Average([jet({ n: 3 }), jet({ n: 4 }), jet({ n: 4 })])).toBe(3.7);
  });

  it("la plus longue suite d'une face, dans l'ordre chronologique, sans compter les jets sans d20", () => {
    const rolls = [jet({ n: 1 }), jet({ n: 1 }), jet({ kind: "damage", n: null }), jet({ n: 1 }), jet({ n: 5 }), jet({ n: 1 }), jet({ n: 1 })];
    expect(longestStreak(rolls, 1)).toBe(3);
    expect(longestStreak(rolls, 20)).toBe(0);
    // L'ordre d'entrée ne compte pas : seul l'ordre des dates.
    expect(longestStreak([...rolls].reverse(), 1)).toBe(3);
  });
});

describe("action favorite et plus gros coup", () => {
  it("le genre le plus fréquent hors dégâts et jet libre, avec son libellé le plus fréquent", () => {
    const rolls = [
      jet({ kind: "attack", what: "Attaque — Rapière" }),
      jet({ kind: "attack", what: "Attaque — Rapière" }),
      jet({ kind: "attack", what: "Attaque — Dague" }),
      jet({ kind: "damage", what: "Dégâts — Rapière" }),
      jet({ kind: "damage", what: "Dégâts — Rapière" }),
      jet({ kind: "damage", what: "Dégâts — Rapière" }),
      jet({ kind: "damage", what: "Dégâts — Rapière" }),
      jet({ kind: "free", what: "Jet libre" }),
      jet({ kind: "free", what: "Jet libre" }),
      jet({ kind: "free", what: "Jet libre" }),
      jet({ kind: "free", what: "Jet libre" }),
      jet({ kind: "check", what: "Perception" }),
    ];
    expect(favoriteAction(rolls)).toEqual({ actionKind: "attack", what: "Attaque — Rapière", count: 3 });
  });

  it("un test et une sauvegarde se confondent ; l'attaque sournoise se distingue de l'attaque d'arme", () => {
    expect(favoriteAction([jet({ kind: "check" }), jet({ kind: "save", what: "Sauvegarde de Dextérité" })])?.actionKind).toBe("check");
    expect(favoriteAction([jet({ kind: "attack", what: "Attaque sournoise — Dague" }), jet({ kind: "attack", what: "Attaque sournoise — Dague" })])).toEqual({
      actionKind: "sneak_attack",
      what: "Attaque sournoise — Dague",
      count: 2,
    });
  });

  it("égalité : le plus récent l'emporte, pour le genre comme pour le libellé", () => {
    const rolls = [jet({ kind: "spell", what: "Sort — Projectile magique" }), jet({ kind: "heal", what: "Sort — Soins" }), jet({ kind: "spell", what: "Sort — Rayon de givre" }), jet({ kind: "heal", what: "Sort — Mot de guérison" })];
    expect(favoriteAction(rolls)).toEqual({ actionKind: "heal", what: "Sort — Mot de guérison", count: 2 });
  });

  it("aucun jet comptable : null ; plus gros coup : le plus grand résultat de dégâts, null sans dégâts", () => {
    expect(favoriteAction([jet({ kind: "damage" }), jet({ kind: "free" })])).toBeNull();
    expect(biggestHit([jet({ kind: "damage", result: 7 }), jet({ kind: "damage", result: 19 }), jet({ kind: "attack", result: 25 })])).toBe(19);
    expect(biggestHit([jet({ kind: "attack", result: 25 })])).toBeNull();
  });
});

describe("les mesures des familles", () => {
  it("chance et malchance : rapport à la moyenne de la table ; table d'une seule joueuse → 1", () => {
    const m = familyMeasures({ n20: 3, n1: 2, spentGp: 0, earnedGp: 0, favorite: null }, { average20: 3, average1: 2 });
    expect(m.luck).toBe(1);
    expect(m.bad_luck).toBe(1);
    expect(familyMeasures({ n20: 4, n1: 1, spentGp: 0, earnedGp: 0, favorite: null }, { average20: 2, average1: 2 })).toMatchObject({ luck: 2, bad_luck: 0.5 });
  });

  it("table sans aucun 20 : 0 pour 0 vaut 1 (comme la table), un 20 seul vaut l'infini", () => {
    expect(familyMeasures({ n20: 0, n1: 0, spentGp: 0, earnedGp: 0, favorite: null }, { average20: 0, average1: 0 })).toMatchObject({ luck: 1, bad_luck: 1 });
    expect(familyMeasures({ n20: 1, n1: 0, spentGp: 0, earnedGp: 0, favorite: null }, { average20: 0, average1: 0 }).luck).toBe(Infinity);
  });

  it("bourse : dépensé ÷ gagné ; rien gagné : infini, sauf si rien dépensé non plus (0)", () => {
    const base = { n20: 0, n1: 0, favorite: null };
    const table = { average20: 1, average1: 1 };
    expect(familyMeasures({ ...base, spentGp: 30, earnedGp: 120 }, table).purse).toBe(0.25);
    expect(familyMeasures({ ...base, spentGp: 30, earnedGp: 0 }, table).purse).toBe(Infinity);
    expect(familyMeasures({ ...base, spentGp: 0, earnedGp: 0 }, table).purse).toBe(0);
  });

  it("l'action favorite passe telle quelle", () => {
    expect(familyMeasures({ n20: 0, n1: 0, spentGp: 0, earnedGp: 0, favorite: { actionKind: "spell", what: "Sort", count: 4 } }, { average20: 1, average1: 1 }).favorite_action).toBe("spell");
  });
});

describe("le choix du palier", () => {
  it("range_from ≤ mesure < range_to ; range_to nul sans borne ; l'infini tombe dans le dernier", () => {
    expect(pickTitle(DEFAULT_TITLE_TIERS, "luck", 0.5)?.name).toBe("En attente d'un miracle");
    expect(pickTitle(DEFAULT_TITLE_TIERS, "luck", 0.8)?.name).toBe("Bonne étoile");
    expect(pickTitle(DEFAULT_TITLE_TIERS, "luck", 1.2)?.name).toBe("Béni des dés");
    expect(pickTitle(DEFAULT_TITLE_TIERS, "purse", Infinity)?.name).toBe("Bourse percée");
  });

  it("aucun palier, ou aucune mesure : null (la case reste vide)", () => {
    const sansHaut = DEFAULT_TITLE_TIERS.filter((t) => !(t.family === "luck" && t.range_to === null));
    expect(pickTitle(sansHaut, "luck", 5)).toBeNull();
    expect(pickTitle(DEFAULT_TITLE_TIERS, "luck", null)).toBeNull();
  });

  it("action favorite : le palier de sa nature", () => {
    expect(pickTitle(DEFAULT_TITLE_TIERS, "favorite_action", "sneak_attack")?.name).toBe("Lame de l'ombre");
    expect(pickTitle(DEFAULT_TITLE_TIERS, "favorite_action", "check")?.name).toBe("Prudent");
  });
});

describe("le gabarit du texte", () => {
  it("remplace les variables connues, laisse les inconnues et celles sans valeur telles quelles", () => {
    expect(renderTemplate("{n1} × 1 naturels, dont {suite} d'affilée", { n1: 6, suite: 3 })).toBe("6 × 1 naturels, dont 3 d'affilée");
    expect(renderTemplate("{n20} et {inconnue} et {record}", { n20: 2 })).toBe("2 et {inconnue} et {record}");
  });

  it("texte brut : une valeur n'est jamais réinterprétée ; un décimal s'écrit à la française", () => {
    expect(renderTemplate("{action}", { action: "<b>{n20}</b>", n20: 9 })).toBe("<b>{n20}</b>");
    expect(renderTemplate("table : {table20}", { table20: 2.25 })).toBe("table : 2,3");
  });
});

describe("le contrôle des plages, pour l'éditeur (V3.1-92)", () => {
  it("les paliers par défaut n'ont ni trou ni chevauchement", () => {
    expect(checkTiers(DEFAULT_TITLE_TIERS)).toEqual([]);
  });

  it("signale un trou, un chevauchement, un début après 0, une fin bornée, une nature d'action en double", () => {
    const t = (family: PlayerTitleTier["family"], from: number | null, to: number | null, kind: PlayerTitleTier["action_kind"] = null): PlayerTitleTier => ({
      family,
      position: 0,
      range_from: from,
      range_to: to,
      action_kind: kind,
      name: "x",
      template: "",
      icon_key: "star",
      color_token: "accent",
    });
    const problemes = checkTiers([t("luck", 0, 0.8), t("luck", 1, null), t("purse", 0, 0.6), t("purse", 0.5, 2), t("bad_luck", 0.2, null), t("favorite_action", null, null, "spell"), t("favorite_action", null, null, "spell")]);
    expect(problemes).toEqual(
      expect.arrayContaining([
        { family: "luck", kind: "gap", from: 0.8, to: 1 },
        { family: "purse", kind: "overlap", from: 0.5, to: 0.6 },
        { family: "purse", kind: "gap", from: 2, to: null },
        { family: "bad_luck", kind: "gap", from: 0, to: 0.2 },
        { family: "favorite_action", kind: "overlap", from: null, to: null, actionKind: "spell" },
      ])
    );
    expect(problemes).toHaveLength(5);
  });
});

describe("les titres d'une joueuse", () => {
  const economie = { spentGp: 30, earnedGp: 120 };

  it("moins de 5 jets à d20 : aucun titre", () => {
    const rolls = [jet({ n: 20 }), jet({ n: 20 }), jet({ n: 1 }), jet({ n: 5 }), jet({ kind: "damage", n: null, result: 30 })];
    expect(playerTitles({ rolls, table: { average20: 1, average1: 1 }, economy: economie, tiers: DEFAULT_TITLE_TIERS })).toEqual([]);
  });

  it("table d'une seule joueuse : Bonne étoile et Ça arrive ; textes remplis ; action et record", () => {
    const rolls = [
      jet({ kind: "attack", what: "Attaque — Rapière", n: 20 }),
      jet({ kind: "attack", what: "Attaque — Rapière", n: 1 }),
      jet({ kind: "attack", what: "Attaque — Rapière", n: 1 }),
      jet({ kind: "check", what: "Perception", n: 12 }),
      jet({ kind: "save", what: "Sauvegarde de Sagesse", n: 8 }),
      jet({ kind: "damage", what: "Dégâts — Rapière", n: null, result: 14 }),
    ];
    const titres = playerTitles({ rolls, table: { average20: 1, average1: 2 }, economy: economie, tiers: DEFAULT_TITLE_TIERS });
    const par = Object.fromEntries(titres.map((x) => [x.family, x]));
    expect(par.luck?.tier?.name).toBe("Bonne étoile");
    expect(par.luck?.text).toBe("1 × 20 naturels (table : 1)");
    expect(par.bad_luck?.tier?.name).toBe("Ça arrive");
    expect(par.purse?.tier?.name).toBe("Écureuil");
    expect(par.purse?.text).toBe("−30 po dépensées pour +120 gagnées");
    expect(par.favorite_action?.tier?.name).toBe("Bretteur");
    expect(par.favorite_action?.text).toBe("Attaque — Rapière, ×3 ; record : 14 dégâts");
  });

  it("une famille sans palier garde sa case, vide", () => {
    const rolls = [jet({ n: 2 }), jet({ n: 3 }), jet({ n: 4 }), jet({ n: 5 }), jet({ n: 6 })];
    const sansBourse = DEFAULT_TITLE_TIERS.filter((t) => t.family !== "purse");
    const titres = playerTitles({ rolls, table: { average20: 1, average1: 1 }, economy: economie, tiers: sansBourse });
    expect(titres.find((x) => x.family === "purse")).toEqual({ family: "purse", tier: null, text: null });
  });
});
