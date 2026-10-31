import { describe, expect, it } from "vitest";
import { progressionClasse, sousEtapesNouvelles } from "./progressionClasse";
import type { Chemin, SousEtape } from "./cheminCreation";

const sous = (cle: string, niveau: number, fait = false): SousEtape => ({
  cle,
  etape: "classe",
  libelle: cle,
  source: "Roublard",
  nombre: 1,
  choisis: fait ? ["x"] : [],
  options: [],
  genre: "skill",
  impose: false,
  fait,
  attend: false,
  expertise: false,
  niveau,
  classKey: "rogue",
});

const base = {
  maxNiveau: 20,
  aptitudesParNiveau: { 1: ["Expertise", "Attaque sournoise"], 3: ["Archétype"], 4: ["Amélioration"] },
  sousClasse: { niveau: 3, choisie: false, libelle: "Sous-classe" },
  ameliorations: [
    { niveau: 4, fait: false, libelle: "Amélioration de caractéristique" },
    { niveau: 8, fait: false, libelle: "Amélioration de caractéristique" },
  ],
};

describe("la progression d'une classe (V3.1-51)", () => {
  it("vingt lignes : acquises sous le niveau, atteinte au niveau, la suite à venir", () => {
    const p = progressionClasse({ ...base, niveau: 3, choix: [] });
    expect(p.lignes).toHaveLength(20);
    expect(p.lignes.slice(0, 4).map((l) => l.etat)).toEqual(["acquis", "acquis", "atteint", "avenir"]);
    expect(p.lignes[0].aptitudes).toEqual(["Expertise", "Attaque sournoise"]);
  });

  it("chaque choix d'un niveau atteint est une pastille sur sa ligne ; la suite annonce ce qui viendra", () => {
    const p = progressionClasse({ ...base, niveau: 6, choix: [sous("rogue-expertise.skills", 1, true), sous("rogue-expertise.skills-6", 6)] });
    expect(p.lignes[0].pastilles.map((x) => [x.cle, x.fait])).toEqual([["rogue-expertise.skills", true]]);
    expect(p.lignes[2].pastilles.map((x) => [x.genre, x.fait])).toEqual([["sousclasse", false]]);
    expect(p.lignes[3].pastilles.map((x) => [x.genre, x.fait])).toEqual([["amelioration", false]]);
    expect(p.lignes[5].pastilles.map((x) => x.cle)).toEqual(["rogue-expertise.skills-6"]);
    expect(p.lignes[7].pastilles).toEqual([]);
    expect(p.lignes[7].aVenir).toEqual(["Amélioration de caractéristique"]);
  });

  it("« Choix de niveau · n à faire » : les pastilles à faire au-delà du niveau 1 (le niveau 1 est déjà sous l'étape)", () => {
    const p = progressionClasse({ ...base, niveau: 6, choix: [sous("rogue-expertise.skills", 1), sous("rogue-expertise.skills-6", 6)] });
    expect(p.aFaireAuDelaDuPremier).toBe(3);
  });

  it("à la montée de niveau, les niveaux acquis sont verrouillés et les nouveaux marqués", () => {
    const p = progressionClasse({ ...base, niveau: 5, niveauAvant: 2, choix: [] });
    expect(p.lignes.slice(0, 6).map((l) => l.etat)).toEqual(["acquis", "acquis", "nouveau", "nouveau", "nouveau", "avenir"]);
  });

  it("V3.1-118 : le don de niveau remplace la pastille d'amélioration (une seule pastille, comptée une fois)", () => {
    const p = progressionClasse({ ...base, niveau: 4, sousClasse: null, choix: [sous("rogue.l4.feat", 4)] });
    expect(p.lignes[3].pastilles.map((x) => [x.genre, x.cle])).toEqual([["choix", "rogue.l4.feat"]]);
    expect(p.aFaireAuDelaDuPremier).toBe(1);
  });

  it("le plafond de la classe borne les lignes", () => {
    expect(progressionClasse({ ...base, maxNiveau: 10, niveau: 1, choix: [] }).lignes).toHaveLength(10);
  });
});

describe("monter de niveau : ce qui change", () => {
  const chemin = (cles: string[]): Chemin => ({
    etapes: [{ cle: "classe", sous: cles.map((c) => sous(c, 1)), aFaire: cles.length }],
    ordre: ["classe", ...cles.map((c) => `c:${c}`)],
    aFaire: cles.length,
  });

  it("les sous-étapes qui n'existaient pas avant la montée", () => {
    const avant = chemin(["rogue.skills", "rogue-expertise.skills"]);
    const apres = chemin(["rogue.skills", "rogue-expertise.skills", "rogue-expertise.skills-6", "fighter.skills"]);
    expect(sousEtapesNouvelles(avant, apres).map((s) => s.cle)).toEqual(["rogue-expertise.skills-6", "fighter.skills"]);
  });
});
