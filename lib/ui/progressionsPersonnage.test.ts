import { describe, expect, it } from "vitest";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { Chemin, SousEtape } from "./cheminCreation";
import { aptitudesParNiveau, cheminMontee, cleAmelioration, progressionsPersonnage } from "./progressionsPersonnage";

const bloc = {
  max_level: 3,
  columns: [
    { key: "level", label: { fr: "Niveau" }, kind: "level" },
    { key: "features", label: { fr: "Aptitudes" }, kind: "grants" },
  ],
  rows: [
    { level: 1, features: [{ feature: "rage" }, { choice: "Maîtrise d'arme" }] },
    { level: 2, features: [] },
    { level: 3, features: [{ feature: "sens-du-danger" }] },
  ],
};

const sous = (cle: string, niveau: number, fait = false): SousEtape => ({
  cle,
  etape: "classe",
  libelle: cle,
  source: "Clerc",
  nombre: 1,
  choisis: fait ? ["x"] : [],
  options: [],
  genre: "skill",
  impose: false,
  fait,
  attend: false,
  expertise: false,
  niveau,
  classKey: "cleric",
});

const chemin = (...choix: SousEtape[]): Chemin => ({ etapes: [{ cle: "classe", sous: choix, aFaire: choix.filter((s) => !s.fait).length }], ordre: [], aFaire: 0 });

const classes = (niveau: number): CharacterBlockData["classes"] => [{ class: { kind: "rule", key: "cleric" }, level: niveau, subclass: null, hp_rolls: [] }];

describe("les aptitudes de chaque niveau", () => {
  it("lit les aptitudes nommées et les choix libres de la progression", () => {
    const r = aptitudesParNiveau(bloc, (cle) => cle.toUpperCase());
    expect(r.maxNiveau).toBe(3);
    expect(r.parNiveau[1]).toEqual(["RAGE", "Maîtrise d'arme"]);
    expect(r.parNiveau[2]).toEqual([]);
    expect(r.parNiveau[3]).toEqual(["SENS-DU-DANGER"]);
  });

  it("un bloc illisible ne donne aucune aptitude, sans casser l'écran", () => {
    expect(aptitudesParNiveau({ nimporte: "quoi" }, (c) => c)).toEqual({ maxNiveau: 20, parNiveau: {} });
  });
});

describe("les progressions du personnage", () => {
  const entree = {
    blocs: {
      cleric: [
        { blockType: "class_progression", data: bloc },
        { blockType: "subclass_slot", data: { label: "Domaine divin", chosen_at_level: 3 } },
      ],
    },
    niveauxAmelioration: { cleric: [3] },
    reponses: {},
    nomAptitude: (c: string) => c,
    libelleAmelioration: "Amélioration",
  };

  it("compte les choix à faire au-delà du niveau 1 (sous-classe, amélioration, choix de niveau)", () => {
    const r = progressionsPersonnage({ ...entree, classes: classes(3), chemin: chemin(sous("a", 1), sous("b", 3)) });
    expect(r.parEmplacement[0]?.lignes.map((l) => l.etat)).toEqual(["acquis", "acquis", "atteint"]);
    expect(r.aFaireAuDelaDuPremier).toBe(3);
  });

  it("une amélioration valide est faite", () => {
    const reponses = { [cleAmelioration("cleric", 3)]: { kind: "asi", increases: { str: 2 } } };
    const r = progressionsPersonnage({ ...entree, reponses, classes: classes(3), chemin: chemin() });
    expect(r.parEmplacement[0]?.lignes[2].pastilles.find((p) => p.genre === "amelioration")?.fait).toBe(true);
  });

  it("un emplacement sans classe n'a pas de progression", () => {
    const vide: CharacterBlockData["classes"] = [{ class: { kind: "rule", key: "" }, level: 1, subclass: null, hp_rolls: [] }];
    expect(progressionsPersonnage({ ...entree, classes: vide, chemin: chemin() }).parEmplacement).toEqual([null]);
  });

  it("montée de niveau : les niveaux acquis n'ont plus de pastilles, seuls les nouveaux comptent", () => {
    const r = progressionsPersonnage({
      ...entree,
      classes: classes(3),
      niveauxAvant: new Map([["cleric", 1]]),
      chemin: chemin(sous("a", 1), sous("b", 3)),
    });
    const lignes = r.parEmplacement[0]?.lignes ?? [];
    expect(lignes.map((l) => l.etat)).toEqual(["acquis", "nouveau", "nouveau"]);
    expect(lignes[0].pastilles).toEqual([]);
    expect(r.aFaireAuDelaDuPremier).toBe(3);
  });
});

describe("le chemin de la montée de niveau", () => {
  it("se réduit à Classe, Points de vie, Sorts, Aperçu, les choix nouveaux sous Classe", () => {
    const c = cheminMontee([sous("b", 3), sous("c", 3, true)], { avecPointsDeVie: true, avecSorts: true });
    expect(c.etapes.map((e) => e.cle)).toEqual(["classe", "pv", "sorts", "apercu"]);
    expect(c.ordre).toEqual(["classe", "c:b", "c:c", "pv", "sorts", "apercu"]);
    expect(c.aFaire).toBe(1);
  });

  it("sans points de vie ni sorts, ces étapes disparaissent", () => {
    expect(cheminMontee([], { avecPointsDeVie: false, avecSorts: false }).ordre).toEqual(["classe", "apercu"]);
  });
});
