import { describe, expect, it } from "vitest";
import { resolveChoices, type ChoiceSource, type FeatChoiceData } from "@/src/core/rules/choices";
import type { ResolvedFeature } from "@/src/core/rules/sheet";
import type { ChoiceGrant } from "@/src/core/schemas/rule-blocks/choices";
import type { RemainingChoiceView } from "@/components/blocks/useResolvedRuleset";
import { choixOuverts, construireChemin, positionValide, voisin, type EntreeChemin } from "./cheminCreation";
import { ASI_FEAT_KEY, asiFeatSources } from "@/src/core/rules/abilityScoreImprovement";

const MAGIC_INITIATE: FeatChoiceData = {
  key: "magic-initiate",
  label: "Initié à la magie",
  category: "origin",
  modifiers: [],
  grants: [
    {
      id: "list",
      label: { fr: "Liste de sorts" },
      from: {
        kind: "option",
        options: (["cleric", "wizard"] as const).map((list) => ({
          id: list,
          label: { fr: list === "cleric" ? "Clerc" : "Magicien" },
          grants: [
            { id: "cantrips", label: { fr: "Sorts mineurs" }, count: 2, from: { kind: "spell", list, level: 0 } },
            { id: "spell", label: { fr: "Sort de niveau 1" }, from: { kind: "spell", list, level: 1 } },
          ],
        })),
      },
    },
    { id: "ability", label: { fr: "Caractéristique d'incantation" }, from: { kind: "ability", options: ["int", "wis", "cha"], spellcasting: true } },
  ] satisfies ChoiceGrant[],
};
const TOUGH: FeatChoiceData = { key: "tough", label: "Robuste", category: "origin", modifiers: [], grants: [] };
const FEATS = { "magic-initiate": MAGIC_INITIATE, tough: TOUGH };

const VERSATILE: ChoiceSource = { key: "versatile", label: "Polyvalent", layer: 2, origin: "species", grants: [{ id: "feat", label: { fr: "Polyvalent" }, from: { kind: "feat", category: "origin" } }] };
const SKILLFUL: ChoiceSource = { key: "skillful", label: "Compétent", layer: 2, origin: "species", grants: [{ id: "skills", label: { fr: "Compétent" }, from: { kind: "skill" } }] };
const EXPERTISE: ChoiceSource = {
  key: "rogue-expertise",
  label: "Expertise",
  layer: 3,
  origin: "class",
  classKey: "rogue",
  grants: [{ id: "skills", label: { fr: "Expertise" }, count: 2, from: { kind: "skill", expertise: true } }],
};
const THIEVES_CANT: ChoiceSource = {
  key: "rogue-thieves-cant",
  label: "Argot des voleurs",
  layer: 3,
  origin: "class",
  classKey: "rogue",
  grants: [
    { id: "cant", label: { fr: "Argot des voleurs" }, from: { kind: "language", options: ["thieves-cant"] } },
    { id: "language", label: { fr: "Une langue de plus" }, from: { kind: "language" } },
  ],
};

const LANGUES_PERSO: RemainingChoiceView = { id: "character.languages", label: "Langues", count: 2, options: ["elvish", "dwarvish", "giant"], kind: "language", origin: "character" };
const COMPETENCES_ROUBLARD: RemainingChoiceView = {
  id: "rogue.skills",
  label: "Roublard — compétences",
  count: 4,
  options: ["acrobatics", "stealth", "perception", "deception", "insight"],
  kind: "skill",
  origin: "class",
};

type Extra = Partial<EntreeChemin> & { otherFeatures?: ResolvedFeature[] };

function chemin(sources: ChoiceSource[], answers: Record<string, unknown>, { otherFeatures, ...extra }: Extra = {}) {
  const resolu = resolveChoices({
    sources,
    choices: answers,
    presets: { "rogue-thieves-cant.cant": ["thieves-cant"] },
    characterLevel: 1,
    classLevels: { rogue: 1 },
    feats: FEATS,
    otherFeatures: otherFeatures ?? [],
  });
  return construireChemin({
    restants: [LANGUES_PERSO],
    ouverts: resolu.open,
    sources,
    reponses: answers,
    avecPointsDeVie: false,
    avecSorts: false,
    langues: ["elvish", "dwarvish", "giant", "thieves-cant"],
    competencesMaitrisees: resolu.proficientSkills,
    dons: FEATS,
    ...extra,
  });
}

const sousDe = (c: ReturnType<typeof chemin>, etape: string) => c.etapes.find((e) => e.cle === etape)?.sous.map((s) => s.cle) ?? [];

describe("les étapes (V3.1-49)", () => {
  it("Identité, Espèce, Classe, Caractéristiques, Historique, Équipement, Aperçu : plus d'étape Compétences", () => {
    const c = chemin([], {});
    expect(c.etapes.map((e) => e.cle)).toEqual(["ident", "espece", "classe", "carac", "histo", "equip", "apercu"]);
  });

  it("Points de vie au-delà du niveau 1, Sorts pour un incantateur, à leur place", () => {
    const c = chemin([], {}, { avecPointsDeVie: true, avecSorts: true });
    expect(c.etapes.map((e) => e.cle)).toEqual(["ident", "espece", "classe", "carac", "pv", "histo", "equip", "sorts", "apercu"]);
  });

  it("les langues du personnage vivent sous Identité", () => {
    expect(sousDe(chemin([], {}), "ident")).toEqual(["character.languages"]);
  });
});

describe("la cascade de l'Humain (critère 1)", () => {
  it("Polyvalent → Initié à la magie → liste → sorts : chaque choix naît sous Espèce, à son tour", () => {
    expect(sousDe(chemin([VERSATILE], {}), "espece")).toEqual(["versatile.feat"]);
    const avecDon = chemin([VERSATILE], { "versatile.feat": ["magic-initiate"] });
    expect(sousDe(avecDon, "espece")).toEqual(["versatile.feat", "versatile.feat.magic-initiate.list", "versatile.feat.magic-initiate.ability"]);
    const avecListe = chemin([VERSATILE], { "versatile.feat": ["magic-initiate"], "versatile.feat.magic-initiate.list": ["cleric"] });
    expect(sousDe(avecListe, "espece")).toEqual([
      "versatile.feat",
      "versatile.feat.magic-initiate.list",
      "versatile.feat.magic-initiate.list.cleric.cantrips",
      "versatile.feat.magic-initiate.list.cleric.spell",
      "versatile.feat.magic-initiate.ability",
    ]);
  });

  it("…et disparaît quand l'espèce change, même si les réponses restent stockées", () => {
    const answers = { "versatile.feat": ["magic-initiate"], "versatile.feat.magic-initiate.list": ["cleric"] };
    expect(sousDe(chemin([], answers), "espece")).toEqual([]);
  });

  it("le sélecteur de don propose les dons de la bonne catégorie, avec leur nom", () => {
    const sous = chemin([VERSATILE], {}).etapes[1].sous[0];
    expect(sous.options).toEqual([
      { cle: "magic-initiate", libelle: "Initié à la magie" },
      { cle: "tough", libelle: "Robuste" },
    ]);
  });

  it("une option nommée porte son libellé", () => {
    const c = chemin([VERSATILE], { "versatile.feat": ["magic-initiate"] });
    const liste = c.etapes[1].sous.find((s) => s.cle === "versatile.feat.magic-initiate.list");
    expect(liste?.options).toEqual([
      { cle: "cleric", libelle: "Clerc" },
      { cle: "wizard", libelle: "Magicien" },
    ]);
  });
});

describe("le Roublard (critère 2)", () => {
  const sources = [EXPERTISE, THIEVES_CANT];
  const roublard = (answers: Record<string, unknown>, extra: Extra = {}) => chemin(sources, answers, { restants: [LANGUES_PERSO, COMPETENCES_ROUBLARD], ...extra });

  it("sous Classe : compétences, Expertise, Argot des voleurs (acquis) et une langue", () => {
    const c = roublard({});
    expect(sousDe(c, "classe")).toEqual(["rogue.skills", "rogue-expertise.skills", "rogue-thieves-cant.cant", "rogue-thieves-cant.language"]);
    const argot = c.etapes.find((e) => e.cle === "classe")?.sous.find((s) => s.cle === "rogue-thieves-cant.cant");
    expect(argot).toMatchObject({ impose: true, fait: true, choisis: ["thieves-cant"] });
  });

  it("l'Expertise attend les compétences : aucune option tant que rien n'est maîtrisé", () => {
    const expertise = roublard({}).etapes.find((e) => e.cle === "classe")?.sous.find((s) => s.cle === "rogue-expertise.skills");
    expect(expertise).toMatchObject({ attend: true, options: [], fait: false });
  });

  it("puis propose les compétences maîtrisées", () => {
    const maitrise = { key: "p", label: "Roublard", source: "class:rogue", modifiers: [{ target: "skill.stealth", op: "proficiency" as const, layer: 3 as const, source: "x", label: "x" }] };
    const expertise = roublard({}, { otherFeatures: [maitrise] }).etapes.find((e) => e.cle === "classe")?.sous.find((s) => s.cle === "rogue-expertise.skills");
    expect(expertise).toMatchObject({ attend: false, options: [{ cle: "stealth" }] });
  });

  it("une langue de plus : les langues du monde, sauf celles déjà acquises", () => {
    const langue = roublard({}).etapes.find((e) => e.cle === "classe")?.sous.find((s) => s.cle === "rogue-thieves-cant.language");
    expect(langue?.options.map((o) => o.cle)).toEqual(["elvish", "dwarvish", "giant"]);
  });
});

describe("compter et parcourir", () => {
  it("« n à faire » par étape et au total ; un choix imposé est fait", () => {
    const c = chemin([EXPERTISE, THIEVES_CANT], { "character.languages": ["elvish", "giant"] }, { restants: [LANGUES_PERSO, COMPETENCES_ROUBLARD] });
    expect(c.etapes.find((e) => e.cle === "ident")?.aFaire).toBe(0);
    expect(c.etapes.find((e) => e.cle === "classe")?.aFaire).toBe(3);
    expect(c.aFaire).toBe(3);
  });

  it("un ancien choix restant dont la clé est aussi un choix accordé n'apparaît qu'une fois", () => {
    const doublon: RemainingChoiceView = { id: "skillful.skills", label: "Humain — Compétent", count: 1, options: ["stealth"], kind: "skill", origin: "species" };
    expect(sousDe(chemin([SKILLFUL], {}, { restants: [doublon] }), "espece")).toEqual(["skillful.skills"]);
  });

  it("Précédent / Suivant parcourent chaque étape puis ses sous-étapes, dans l'ordre", () => {
    const c = chemin([VERSATILE], {});
    expect(c.ordre.slice(0, 4)).toEqual(["ident", "c:character.languages", "espece", "c:versatile.feat"]);
    expect(voisin(c, "ident", 1)).toBe("c:character.languages");
    expect(voisin(c, "c:character.languages", 1)).toBe("espece");
    expect(voisin(c, "ident", -1)).toBe("ident");
    expect(voisin(c, "apercu", 1)).toBe("apercu");
  });

  it("une position qui n'existe plus (sa source a changé) n'est plus valide", () => {
    const c = chemin([], {});
    expect(positionValide(c, "c:versatile.feat")).toBe(false);
    expect(positionValide(c, "espece")).toBe(true);
  });
});

describe("les choix ouverts, rappelés sur la fiche (critère 5)", () => {
  it("un choix accordé non répondu et un ancien choix incomplet ; ni l'imposé, ni le complet", () => {
    const resolu = resolveChoices({ sources: [THIEVES_CANT, VERSATILE], choices: { "versatile.feat": ["tough"] }, presets: { "rogue-thieves-cant.cant": ["thieves-cant"] }, characterLevel: 1, classLevels: { rogue: 1 }, feats: FEATS });
    expect(choixOuverts([LANGUES_PERSO, COMPETENCES_ROUBLARD], resolu.open, { "character.languages": ["elvish", "giant"], "rogue.skills": ["stealth"] })).toEqual([
      { cle: "rogue.skills", libelle: "Roublard — compétences" },
      { cle: "rogue-thieves-cant.language", libelle: "Une langue de plus" },
    ]);
  });
});


describe("le don de l'historique : une seule sous-étape à sections (V3.1-50)", () => {
  const INITIE_ACOLYTE: ChoiceSource = { key: "magic-initiate", label: "Initié à la magie", layer: 5, origin: "background", grants: MAGIC_INITIATE.grants };
  const cheminAcolyte = (answers: Record<string, unknown>) => {
    const resolu = resolveChoices({ sources: [INITIE_ACOLYTE], choices: answers, presets: { "magic-initiate.list": ["cleric"] }, characterLevel: 1, feats: FEATS });
    return construireChemin({
      restants: [],
      ouverts: resolu.open,
      sources: [INITIE_ACOLYTE],
      reponses: answers,
      avecPointsDeVie: false,
      avecSorts: false,
      langues: [],
      competencesMaitrisees: [],
      dons: FEATS,
    });
  };

  it("« Don : Initié à la magie (Clerc) », ses choix en sections ; la liste imposée n'en est pas une à faire", () => {
    const histo = cheminAcolyte({}).etapes.find((e) => e.cle === "histo");
    expect(histo?.sous.map((s) => s.cle)).toEqual(["don:magic-initiate"]);
    const don = histo!.sous[0];
    expect(don.libelle).toBe("Initié à la magie (Clerc)");
    expect(don.genre).toBe("groupe");
    expect(don.sections?.map((s) => s.cle)).toEqual(["magic-initiate.list.cleric.cantrips", "magic-initiate.list.cleric.spell", "magic-initiate.ability"]);
    expect([don.choisis.length, don.nombre, don.fait]).toEqual([0, 3, false]);
    expect(histo!.aFaire).toBe(1);
  });

  it("le compte suit les sections faites ; le don est fait quand toutes le sont", () => {
    const partiel = cheminAcolyte({ "magic-initiate.ability": ["wis"] }).etapes.find((e) => e.cle === "histo")!.sous[0];
    expect([partiel.choisis.length, partiel.fait]).toEqual([1, false]);
    const complet = cheminAcolyte({
      "magic-initiate.ability": ["wis"],
      "magic-initiate.list.cleric.cantrips": ["guidance", "light"],
      "magic-initiate.list.cleric.spell": ["bless"],
    }).etapes.find((e) => e.cle === "histo")!.sous[0];
    expect([complet.choisis.length, complet.fait]).toEqual([3, true]);
  });

  it("la cascade de Polyvalent sous Espèce reste en sous-étapes séparées", () => {
    expect(sousDe(chemin([VERSATILE], { "versatile.feat": ["magic-initiate"] }), "espece")).toEqual([
      "versatile.feat",
      "versatile.feat.magic-initiate.list",
      "versatile.feat.magic-initiate.ability",
    ]);
  });
});

describe("le don de niveau (V3.1-118) : l'amélioration n'est faite qu'avec son +2 / +1+1", () => {
  const ASI: FeatChoiceData = { key: ASI_FEAT_KEY, label: "Amélioration de caractéristique", category: "general", modifiers: [], grants: [] };
  const LUTTEUR: FeatChoiceData = { key: "grappler", label: "Lutteur", category: "general", modifiers: [], grants: [] };
  const dons = { [ASI_FEAT_KEY]: ASI, grappler: LUTTEUR };
  const sources = asiFeatSources({ fighter: [4] }, { fighter: "Guerrier" });
  function cheminGuerrier(reponses: Record<string, unknown>) {
    const resolu = resolveChoices({ sources, choices: reponses, characterLevel: 4, classLevels: { fighter: 4 }, feats: dons });
    return construireChemin({ restants: [], ouverts: resolu.open, sources, reponses, avecPointsDeVie: false, avecSorts: false, langues: [], competencesMaitrisees: [], dons });
  }
  const sousDuDon = (reponses: Record<string, unknown>) => cheminGuerrier(reponses).etapes.find((e) => e.cle === "classe")!.sous.find((s) => s.cle === "fighter.l4.feat")!;

  it("rangé sous Classe, au niveau 4, avec les dons généraux", () => {
    const sous = sousDuDon({});
    expect(sous).toMatchObject({ niveau: 4, classKey: "fighter", fait: false, genre: "feat" });
    expect(sous.options.map((o) => o.cle)).toEqual([ASI_FEAT_KEY, "grappler"]);
  });
  it("un autre don : fait d'un coup", () => {
    expect(sousDuDon({ "fighter.l4.feat": ["grappler"] }).fait).toBe(true);
  });
  it("l'amélioration : faite seulement quand le +2 / +1+1 est valide", () => {
    expect(sousDuDon({ "fighter.l4.feat": [ASI_FEAT_KEY] }).fait).toBe(false);
    expect(sousDuDon({ "fighter.l4.feat": [ASI_FEAT_KEY], "fighter.l4.asi": { kind: "asi", increases: { str: 1 } } }).fait).toBe(false);
    expect(sousDuDon({ "fighter.l4.feat": [ASI_FEAT_KEY], "fighter.l4.asi": { kind: "asi", increases: { str: 1, con: 1 } } }).fait).toBe(true);
  });
});
