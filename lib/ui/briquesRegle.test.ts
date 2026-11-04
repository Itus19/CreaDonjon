import { describe, expect, it } from "vitest";
import { brickPaths, zActivationBlockData, zRuleResourcesBlockData, type ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";
import { coverageSummary } from "@/src/core/rules/activationEditor";
import {
  blocsVersBrouillon,
  brouillonVersBlocs,
  brouillonVide,
  citationDepuisSelection,
  corpsEnregistrement,
  decouperTexte,
  deplacerA,
  erreurFormule,
  idLibre,
  nouvelEffet,
  nouvelleActivation,
  nouvelleRessource,
  opsPourCible,
  retirerA,
  surlignagesDuBrouillon,
  texteDeLaRegle,
  type Brouillon,
} from "./briquesRegle";

const NOMS = { frightened: "Effrayé" };

/** Abjuration d'ennemis, saisie entièrement par l'éditeur (sans JSON). */
function abjuration(): Brouillon {
  const b = brouillonVide();
  const a = nouvelleActivation(b);
  a.id = "abjure";
  a.label = "Abjuration d'ennemis";
  a.cout = { action: "magic", depenses: [{ cle: "channel-divinity", quantite: "1" }], passage: "l'action Magie" };
  a.cibles = { kind: "creature", nombre: "max(1, {ability.cha})", portee: "18", doitVoir: true, passage: "cibler un nombre de créatures" };
  const sauvegarde = nouvelEffet("saving_throw", b);
  if (sauvegarde.type !== "saving_throw") throw new Error("type inattendu");
  const etat = nouvelEffet("apply_state", b);
  if (etat.type !== "apply_state") throw new Error("type inattendu");
  etat.cle = "frightened";
  etat.duree = { unit: "minute", amount: "1", whose: "bearer", which: "next" };
  etat.finSi = [{ event: "damage_taken", subject: "bearer" }];
  etat.passage = "subir l'état Effrayé";
  sauvegarde.passage = "réussir un jet de sauvegarde de Sagesse";
  sauvegarde.echec = [etat];
  a.effets = [sauvegarde];
  b.activations = [a];
  b.lacunes = [{ uid: "g", texte: "une seule des choses suivantes", manque: "une seule chose par tour" }];
  return b;
}

describe("erreurFormule", () => {
  it("accepte les références et les fonctions", () => {
    expect(erreurFormule("max(1, {ability.cha})")).toBeNull();
    expect(erreurFormule("{spell_save_dc}")).toBeNull();
  });
  it("explique pourquoi une formule est refusée, sans lever", () => {
    expect(erreurFormule("")).not.toBeNull();
    expect(erreurFormule("max(1,")).not.toBeNull();
  });
});

describe("brouillonVersBlocs : Abjuration d'ennemis", () => {
  it("écrit l'activation, son effet qui dure et ses citations", () => {
    const r = brouillonVersBlocs(abjuration(), NOMS);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.activation) return;
    const a = r.activation.activations[0];
    expect(a.cost).toEqual({ action: "magic", resources: [{ key: "channel-divinity", amount: { op: "num", value: 1 } }] });
    expect(a.targets.range).toEqual({ value: 18, unit: "m" });
    expect(a.targets.must_see).toBe(true);
    const s = a.effects[0];
    expect(s.action).toBe("saving_throw");
    if (s.action !== "saving_throw") return;
    expect(s.ability).toBe("wis");
    expect(s.on_fail?.[0]).toMatchObject({ action: "apply_effect", who: "target" });
    expect(r.activation.durable_effects).toHaveLength(1);
    expect(r.activation.durable_effects[0]).toMatchObject({
      label: { fr: "Effrayé" },
      conditions: ["frightened"],
      duration: { unit: "minute", amount: 1 },
      concentration: false,
      ends_on: [{ event: "damage_taken", subject: "bearer" }],
      token: null,
    });
    expect(a.passages).toEqual({
      cost: "l'action Magie",
      targets: "cibler un nombre de créatures",
      "effects.0": "réussir un jet de sauvegarde de Sagesse",
      "effects.0.on_fail.0": "subir l'état Effrayé",
    });
    expect(r.coverage).toEqual({ gaps: [{ text: "une seule des choses suivantes", missing: "une seule chose par tour" }] });
    // Chaque chemin cité désigne une brique (le schéma le vérifie aussi).
    expect(Object.keys(a.passages ?? {}).every((c) => brickPaths(a).includes(c))).toBe(true);
  });

  it("revient au brouillon identique, sans perdre une citation", () => {
    const r = brouillonVersBlocs(abjuration(), NOMS);
    if (!r.ok) throw new Error("écriture refusée");
    const blocs = [
      { blockType: "activation", data: r.activation },
      { blockType: "coverage", data: r.coverage },
    ];
    const relu = blocsVersBrouillon(blocs);
    const encore = brouillonVersBlocs(relu, NOMS);
    expect(encore).toEqual(r);
    expect(coverageSummary(blocs)).toMatchObject({ state: "partial", cited: 5, gaps: 1 });
  });

  it("refuse une formule fausse et dit où", () => {
    const b = abjuration();
    b.activations[0].cibles.nombre = "max(1,";
    const r = brouillonVersBlocs(b, NOMS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toContain("nombre de cibles");
  });
});

describe("blocsVersBrouillon", () => {
  const donnees: ActivationBlockData = zActivationBlockData.parse({
    activations: [
      {
        id: "a",
        label: { fr: "Souffle" },
        cost: { action: "bonus", resources: [] },
        targets: { kind: "self" },
        effects: [{ action: "apply_effect", who: "self", effect: "jeton" }],
        variants: null,
      },
    ],
    durable_effects: [
      { id: "jeton", label: { fr: "Jeton" }, conditions: [], modifiers: [], duration: { unit: "permanent" }, concentration: false, ends_on: [], token: { uses: 1, grants: "a" } },
      { id: "orphelin", label: { fr: "Orphelin" }, conditions: ["x"], modifiers: [], duration: { unit: "permanent" }, concentration: false, ends_on: [], token: null },
    ],
  });

  it("conserve tel quel un effet qui dure que le formulaire ne saisit pas", () => {
    const b = blocsVersBrouillon([{ blockType: "activation", data: donnees }]);
    expect(b.activations[0].effets[0].type).toBe("existing_durable");
    const r = brouillonVersBlocs(b, {});
    expect(r.ok && r.activation?.durable_effects.map((d) => d.id)).toEqual(["jeton"]);
  });

  it("retire l'effet qui dure d'une brique supprimée", () => {
    const b = abjuration();
    b.activations[0].effets = [];
    const r = brouillonVersBlocs(b, NOMS);
    expect(r.ok && r.activation?.durable_effects).toEqual([]);
  });
});

describe("corpsEnregistrement", () => {
  it("n'envoie null que pour un bloc qui existait", () => {
    const b = brouillonVide();
    b.existait.coverage = true;
    const r = brouillonVersBlocs(b, {});
    if (!r.ok) throw new Error("écriture refusée");
    expect(corpsEnregistrement(b, r)).toEqual({ coverage: null });
  });
});

describe("ressources", () => {
  it("déduit la clé du libellé", () => {
    const b = brouillonVide();
    const r = nouvelleRessource();
    r.label = "Conduit divin";
    r.max = "{column.channel_divinity}";
    b.ressources = [r];
    const res = brouillonVersBlocs(b, {});
    expect(res.ok && res.resources?.resources[0].key).toBe("conduit-divin");
    expect(zRuleResourcesBlockData.safeParse(res.ok ? res.resources : null).success).toBe(true);
  });
});

describe("nouvelEffet", () => {
  it("donne un identifiant d'effet stable et libre", () => {
    const b = abjuration();
    const e = nouvelEffet("apply_state", b);
    expect(e.type === "apply_state" && e.effectId).not.toBe("effet");
    expect(idLibre("effet", new Set(["effet", "effet-2"]))).toBe("effet-3");
  });
  it("n'offre que les opérations qui valent pour la cible", () => {
    expect(opsPourCible("ac")).not.toContain("advantage");
    expect(opsPourCible("save.str")).toContain("advantage");
  });
});

describe("listes", () => {
  it("déplace et retire sans toucher l'original", () => {
    const l = [1, 2, 3];
    expect(deplacerA(l, 0, 1)).toEqual([2, 1, 3]);
    expect(deplacerA(l, 0, -1)).toEqual([1, 2, 3]);
    expect(retirerA(l, 1)).toEqual([1, 3]);
    expect(l).toEqual([1, 2, 3]);
  });
});

describe("citations", () => {
  const texte = "Chaque cible doit réussir un jet\nde sauvegarde de Sagesse sous peine de subir l'état Effrayé.";
  it("surligne un passage malgré un retour à la ligne", () => {
    const f = decouperTexte(texte, [{ uid: "x", texte: "réussir un jet de sauvegarde", famille: "sauvegarde" }]);
    expect(f.map((x) => x.texte).join("")).toBe(texte);
    expect(f.find((x) => x.surlignage)?.surlignage?.uid).toBe("x");
  });
  it("ignore une citation introuvable et une citation qui en recouvre une autre", () => {
    const f = decouperTexte(texte, [
      { uid: "a", texte: "Sagesse sous peine", famille: "autre" },
      { uid: "b", texte: "de sauvegarde de Sagesse", famille: "autre" },
      { uid: "c", texte: "absent du texte", famille: "autre" },
    ]);
    expect(f.filter((x) => x.surlignage).map((x) => x.surlignage?.uid)).toEqual(["b"]);
  });
  it("compacte la sélection du navigateur", () => {
    expect(citationDepuisSelection("  un  \n passage ")).toBe("un passage");
    expect(citationDepuisSelection("   ")).toBeNull();
  });
  it("liste les citations du brouillon, lacunes comprises", () => {
    const s = surlignagesDuBrouillon(abjuration());
    expect(s.map((x) => x.famille)).toEqual(["cout", "cibles", "sauvegarde", "etat", "lacune"]);
  });
});

describe("texteDeLaRegle", () => {
  it("assemble les paragraphes de la description", () => {
    expect(
      texteDeLaRegle([
        { blockType: "description", data: { segments: [{ text: "Un." }, { text: "Deux." }] } },
        { blockType: "activation", data: {} },
      ])
    ).toBe("Un.\n\nDeux.");
  });
});
