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
  avecDeclencheur,
  idLibre,
  momentsPermis,
  nouvelleOperation,
  operationsPermises,
  nouvelEffet,
  nouvelleActivation,
  nouveauModificateur,
  nouvelleRessource,
  opsPourCible,
  retirerA,
  surlignagesDuBrouillon,
  texteDeLaRegle,
  type Brouillon,
  avecGenreCible,
  conditionEcrite,
  conditionVersBrouillon,
  basculerDans,
  nouvelleAura,
  nouvelleRetouche,
} from "./briquesRegle";
import { zModifiersBlockData } from "@/src/core/schemas/rule-blocks/blocks";

const NOMS = { frightened: "Effrayé" };

/** Abjuration d'ennemis, saisie entièrement par l'éditeur (sans JSON). */
function abjuration(): Brouillon {
  const b = brouillonVide();
  const a = nouvelleActivation(b);
  a.id = "abjure";
  a.label = "Abjuration d'ennemis";
  a.cout = { action: "magic", depenses: [{ cle: "channel-divinity", quantite: "1" }], emplacement: null, passage: "l'action Magie" };
  a.cibles = { kind: "creature", zone: null, nombre: "max(1, {ability.cha})", portee: "18", doitVoir: true, passage: "cibler un nombre de créatures" };
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

/** Bénédiction, saisie entièrement par l'éditeur : 3 cibles, concentration, 1 minute, +1d4 aux attaques et aux sauvegardes. */
function benediction(): Brouillon {
  const b = brouillonVide();
  const a = nouvelleActivation(b);
  a.id = "benediction";
  a.label = "Bénédiction";
  a.cout = { action: "action", depenses: [], emplacement: null, passage: null };
  a.cibles = { kind: "creature", zone: null, nombre: "3", portee: "9", doitVoir: false, passage: null };
  const boost = nouvelEffet("apply_modifier", b);
  if (boost.type !== "apply_boost") throw new Error("type inattendu");
  boost.nom = "Bénédiction";
  boost.concentration = true;
  boost.duree = { unit: "minute", amount: "1", whose: "bearer", which: "next" };
  boost.modificateurs = [nouveauModificateur("attack", "add", "1d4"), nouveauModificateur("save", "add", "1d4")];
  a.effets = [boost];
  b.activations = [a];
  return b;
}

describe("brouillonVersBlocs : Bénédiction (effet qui dure porteur de modificateurs)", () => {
  it("écrit un apply_effect et un effet qui dure avec ses dés, sans apply_modifier", () => {
    const r = brouillonVersBlocs(benediction(), {});
    expect(r.ok).toBe(true);
    if (!r.ok || !r.activation) return;
    const a = r.activation.activations[0];
    expect(a.targets.count).toEqual({ op: "num", value: 3 });
    expect(a.effects[0]).toMatchObject({ action: "apply_effect", who: "target" });
    const d = r.activation.durable_effects[0];
    expect(d).toMatchObject({ label: { fr: "Bénédiction" }, conditions: [], concentration: true, duration: { unit: "minute", amount: 1 }, token: null });
    expect(d.modifiers.map((m) => m.target)).toEqual(["attack", "save"]);
    expect(d.modifiers[0].value).toMatchObject({ op: "dice" });
  });

  it("se relit en une seule brique et se réécrit à l'identique", () => {
    const r = brouillonVersBlocs(benediction(), {});
    if (!r.ok) throw new Error("écriture refusée");
    const relu = blocsVersBrouillon([{ blockType: "activation", data: r.activation }]);
    const e = relu.activations[0].effets[0];
    expect(e.type).toBe("apply_boost");
    if (e.type === "apply_boost") expect(e.modificateurs.map((m) => `${m.cible}:${m.valeur}`)).toEqual(["attack:1d4", "save:1d4"]);
    expect(brouillonVersBlocs(relu, {})).toEqual(r);
  });

  it("refuse un dé sur une cible fixe, et le dit", () => {
    const b = benediction();
    const e = b.activations[0].effets[0];
    if (e.type !== "apply_boost") throw new Error("type inattendu");
    e.modificateurs = [nouveauModificateur("ac", "add", "1d4")];
    const r = brouillonVersBlocs(b, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toContain("Un dé ne s'ajoute qu'à un jet");
    expect(erreurFormule("1d4", { sansDes: true })).not.toBeNull();
    expect(erreurFormule("1d4")).toBeNull();
  });

  it("demande un nom et au moins un modificateur", () => {
    const b = benediction();
    const e = b.activations[0].effets[0];
    if (e.type !== "apply_boost") throw new Error("type inattendu");
    e.nom = "";
    e.modificateurs = [];
    const r = brouillonVersBlocs(b, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(" ")).toContain("donne un nom");
  });

  it("garde une valeur en formule (max(1, mod. CHA)) et un drapeau sans valeur", () => {
    const b = benediction();
    const e = b.activations[0].effets[0];
    if (e.type !== "apply_boost") throw new Error("type inattendu");
    e.modificateurs = [nouveauModificateur("save", "add", "max(1, {ability.cha})"), nouveauModificateur("attack", "advantage", "")];
    const r = brouillonVersBlocs(b, {});
    expect(r.ok).toBe(true);
    if (r.ok && r.activation) {
      const [somme, avantage] = r.activation.durable_effects[0].modifiers;
      expect(somme.value).toMatchObject({ op: "max" });
      expect(avantage).toEqual({ target: "attack", op: "advantage" });
    }
  });
});

describe("un apply_modifier déjà enregistré", () => {
  const donnees: ActivationBlockData = zActivationBlockData.parse({
    activations: [
      {
        id: "a",
        label: { fr: "Bouclier" },
        cost: { action: "reaction", resources: [] },
        targets: { kind: "self" },
        effects: [{ action: "apply_modifier", who: "self", modifier: { target: "ac", op: "add", value: 5, source: "activation:a", label: "Bouclier", layer: 7 } }],
        variants: null,
      },
    ],
    durable_effects: [],
  });

  it("se relit en brique de modificateur temporaire sans perdre cible, valeur ni libellé", () => {
    const b = blocsVersBrouillon([{ blockType: "activation", data: donnees }]);
    const e = b.activations[0].effets[0];
    expect(e.type).toBe("apply_boost");
    if (e.type !== "apply_boost") return;
    expect(e.nom).toBe("Bouclier");
    expect(e.modificateurs.map((m) => [m.cible, m.op, m.valeur])).toEqual([["ac", "add", "5"]]);
    const r = brouillonVersBlocs(b, {});
    expect(r.ok).toBe(true);
    if (r.ok && r.activation) {
      expect(r.activation.activations[0].effects[0].action).toBe("apply_effect");
      expect(r.activation.durable_effects[0].modifiers).toEqual([{ target: "ac", op: "add", value: 5 }]);
    }
  });
});

describe("réactions à un jet (V3.1-161)", () => {
  const NOMS_VIDES = {};

  /** Esquive instinctive, saisie sans JSON : réaction, dégâts d'une attaque contre soi, moitié des dégâts. */
  function esquive(): Brouillon {
    const b = brouillonVide();
    let a = nouvelleActivation(b);
    a.id = "esquive-instinctive";
    a.label = "Esquive instinctive";
    a.cout = { action: "reaction", depenses: [], emplacement: null, passage: null };
    a.cibles = { ...a.cibles, kind: "self" };
    a = avecDeclencheur(a, { jet: "damage", sujet: "attack_against_self", moment: "rolled" });
    a = { ...a, operations: [nouvelleOperation("damage_multiplier")] };
    b.activations = [a];
    return b;
  }

  it("Esquive instinctive s'écrit en blocs valides, sans JSON", () => {
    const r = brouillonVersBlocs(esquive(), NOMS_VIDES);
    if (!r.ok) throw new Error(r.erreurs.join(" ; "));
    const a = r.activation?.activations[0];
    expect(a?.cost.action).toBe("reaction");
    expect(a?.trigger).toEqual({ on: "roll", roll: "damage", subject: "attack_against_self", when: "rolled" });
    expect(a?.roll_operations).toEqual([{ op: "damage_multiplier", factor: 0.5 }]);
  });

  it("une activation à déclencheur relue puis réécrite reste identique", () => {
    const r = brouillonVersBlocs(esquive(), NOMS_VIDES);
    if (!r.ok || !r.activation) throw new Error("écriture attendue");
    const b = blocsVersBrouillon([{ blockType: "activation", data: r.activation }]);
    const encore = brouillonVersBlocs(b, NOMS_VIDES);
    if (!encore.ok) throw new Error(encore.erreurs.join(" ; "));
    expect(encore.activation).toEqual(r.activation);
  });

  it("un déclencheur « naturel » avec limite, bonus de relance et automatique fait l'aller-retour", () => {
    const data: ActivationBlockData = zActivationBlockData.parse({
      activations: [
        {
          id: "chance",
          label: { fr: "Chance" },
          cost: { action: "none", resources: [] },
          targets: { kind: "self" },
          effects: [],
          variants: null,
          trigger: { on: "roll", roll: "d20", subject: "self", when: "natural", natural: 1, automatic: true },
          roll_operations: [{ op: "reroll", bonus: { op: "num", value: 2 } }],
          limit: { per: "turn" },
        },
      ],
      durable_effects: [],
    });
    const r = brouillonVersBlocs(blocsVersBrouillon([{ blockType: "activation", data }]), NOMS_VIDES);
    if (!r.ok) throw new Error(r.erreurs.join(" ; "));
    expect(r.activation?.activations[0].trigger).toEqual(data.activations[0].trigger);
    expect(r.activation?.activations[0].limit).toEqual({ per: "turn" });
    expect(r.activation?.activations[0].roll_operations).toEqual(data.activations[0].roll_operations);
  });

  it("ne propose que les opérations et les moments qui ont un sens sur le jet visé", () => {
    expect(operationsPermises("damage").sort()).toEqual(["add_damage", "add_die", "damage_multiplier"]);
    expect(operationsPermises("save")).not.toContain("ac_bonus");
    expect(operationsPermises("attack")).toContain("ac_bonus");
    expect(momentsPermis("damage")).toEqual(["rolled"]);
    expect(momentsPermis("save")).not.toContain("hit");
    expect(momentsPermis("attack")).toContain("hit");
  });

  it("changer de jet retire les opérations devenues absurdes et remet le moment d'équerre", () => {
    let a = nouvelleActivation(brouillonVide());
    a = avecDeclencheur(a, { jet: "attack", moment: "hit" });
    a = { ...a, operations: [nouvelleOperation("ac_bonus"), nouvelleOperation("add_die")] };
    a = avecDeclencheur(a, { jet: "save" });
    expect(a.declencheur?.moment).toBe("rolled");
    expect(a.operations.map((o) => o.op)).toEqual(["add_die"]);
  });

  it("le moment « naturel » demande la valeur du d20, et elle disparaît avec lui", () => {
    let a = avecDeclencheur(nouvelleActivation(brouillonVide()), { jet: "d20", moment: "natural" });
    expect(a.declencheur?.naturel).toBe("1");
    a = avecDeclencheur(a, { moment: "rolled" });
    expect(a.declencheur?.naturel).toBe("");
  });

  it("retirer le déclencheur retire les opérations", () => {
    let a = avecDeclencheur(nouvelleActivation(brouillonVide()), { jet: "damage" });
    a = { ...a, operations: [nouvelleOperation("damage_multiplier")] };
    expect(avecDeclencheur(a, null)).toMatchObject({ declencheur: null, operations: [] });
  });

  it("refuse une valeur de d20 hors bornes et un facteur nul, avec un message d'écran", () => {
    const b = esquive();
    b.activations[0] = { ...b.activations[0], operations: [{ uid: "x", op: "damage_multiplier", facteur: "0" }] };
    const r = brouillonVersBlocs(b, NOMS_VIDES);
    expect(r.ok).toBe(false);
    const c = brouillonVide();
    c.activations = [avecDeclencheur({ ...nouvelleActivation(c), label: "Chance" }, { jet: "d20", moment: "natural", naturel: "25" })];
    const r2 = brouillonVersBlocs(c, NOMS_VIDES);
    expect(r2.ok).toBe(false);
  });
});

const NOMS_VIDES = {};

describe("V3.1-166 : sort, options de lancement, lancer un sort", () => {
  it("Bénédiction se saisit sur la fiche du sort : niveau de base 1, aller-retour sans perte", () => {
    const b = benediction();
    b.activations[0].cout = { ...b.activations[0].cout, emplacement: 1 };
    const r = brouillonVersBlocs(b, NOMS_VIDES);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.activation) return;
    expect(r.activation.activations[0].cost.slot).toEqual({ level: 1 });
    expect(zActivationBlockData.safeParse(r.activation).success).toBe(true);
    const relu = blocsVersBrouillon([{ blockType: "activation", data: r.activation }]);
    expect(relu.activations[0].cout.emplacement).toBe(1);
    const r2 = brouillonVersBlocs(relu, NOMS_VIDES);
    expect(r2.ok && r2.activation).toEqual(r.activation);
  });

  it("un sort mineur garde le niveau 0 ; sans emplacement, aucun slot n'est écrit", () => {
    const b = benediction();
    b.activations[0].cout = { ...b.activations[0].cout, emplacement: 0 };
    const mineur = brouillonVersBlocs(b, NOMS_VIDES);
    expect(mineur.ok && mineur.activation?.activations[0].cost.slot).toEqual({ level: 0 });
    const sans = brouillonVersBlocs(benediction(), NOMS_VIDES);
    expect(sans.ok && sans.activation?.activations[0].cost).not.toHaveProperty("slot");
  });

  it("le coût « une attaque » s'écrit et se relit", () => {
    const b = benediction();
    b.activations[0].cout = { ...b.activations[0].cout, action: "attack" };
    const r = brouillonVersBlocs(b, NOMS_VIDES);
    expect(r.ok && r.activation?.activations[0].cost.action).toBe("attack");
    if (!r.ok) return;
    expect(blocsVersBrouillon([{ blockType: "activation", data: r.activation }]).activations[0].cout.action).toBe("attack");
  });

  it("une option de lancement (Sort accéléré) fait l'aller-retour : coût en ressources et temps d'incantation changé", () => {
    const b = benediction();
    b.activations[0].optionsLancement = [
      { uid: "o1", id: "twinned", label: "Sort accéléré", labelOrig: { fr: "Sort accéléré", en: "Quickened Spell" }, depenses: [{ cle: "sorcery-points", quantite: "2" }], action: "bonus" },
    ];
    const r = brouillonVersBlocs(b, NOMS_VIDES);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.activation) return;
    const o = r.activation.activations[0].cast_options?.[0];
    expect(o?.changes).toEqual({ action: "bonus" });
    expect(o?.label.en).toBe("Quickened Spell");
    const relu = blocsVersBrouillon([{ blockType: "activation", data: r.activation }]);
    expect(relu.activations[0].optionsLancement[0]).toMatchObject({ id: "twinned", label: "Sort accéléré", action: "bonus", depenses: [{ cle: "sorcery-points", quantite: "2" }] });
    const r2 = brouillonVersBlocs(relu, NOMS_VIDES);
    expect(r2.ok && r2.activation).toEqual(r.activation);
  });

  it("une option sans libellé est refusée avec un message d'écran", () => {
    const b = benediction();
    b.activations[0].optionsLancement = [{ uid: "o1", id: "x", label: "", labelOrig: {}, depenses: [], action: "" }];
    const r = brouillonVersBlocs(b, NOMS_VIDES);
    expect(r.ok).toBe(false);
  });

  it("« Lancer un sort » a son formulaire (clé, gratuit) et ne passe plus par le brouillon opaque", () => {
    const b = brouillonVide();
    const a = { ...nouvelleActivation(b), label: "Appeler le compagnon" };
    const e = nouvelEffet("cast_spell", b);
    expect(e).toMatchObject({ type: "cast_spell", sort: "", gratuit: false });
    expect(brouillonVersBlocs({ ...b, activations: [{ ...a, effets: [e] }] }, NOMS_VIDES).ok).toBe(false);
    if (e.type !== "cast_spell") return;
    const ok = brouillonVersBlocs({ ...b, activations: [{ ...a, effets: [{ ...e, sort: "summon-beast", gratuit: true }] }] }, NOMS_VIDES);
    expect(ok.ok && ok.activation?.activations[0].effects[0]).toEqual({ action: "cast_spell", who: "self", spell: "summon-beast", free: true });
    if (!ok.ok) return;
    const relu = blocsVersBrouillon([{ blockType: "activation", data: ok.activation }]);
    expect(relu.activations[0].effets[0]).toMatchObject({ type: "cast_spell", sort: "summon-beast", gratuit: true });
  });
  it("V3.1-170 : une cible « zone » (cône de 4,5 m depuis soi) fait l'aller-retour sans JSON", () => {
    const b = brouillonVide();
    const a = { ...nouvelleActivation(b), label: "Souffle" };
    a.cibles = avecGenreCible(a.cibles, "area");
    expect(a.cibles.zone).toMatchObject({ forme: "cone", origine: "self" });
    const r = brouillonVersBlocs({ ...b, activations: [a] }, NOMS_VIDES);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.activation) return;
    expect(r.activation.activations[0].targets.area).toEqual({ shape: "cone", size: 4.5, origin: "self" });
    const relu = blocsVersBrouillon([{ blockType: "activation", data: r.activation }]);
    expect(relu.activations[0].cibles.zone).toEqual({ forme: "cone", taille: "4.5", largeur: "", origine: "self" });
    // Quitter « zone » retire la zone ; elle ne s'écrit plus.
    expect(avecGenreCible(a.cibles, "creature").zone).toBeNull();
  });

  it("V3.1-170 : une ligne garde sa largeur, une taille invalide est refusée avec un message", () => {
    const b = brouillonVide();
    const a = { ...nouvelleActivation(b), label: "Souffle" };
    a.cibles = { ...avecGenreCible(a.cibles, "area"), zone: { forme: "line", taille: "9", largeur: "1.5", origine: "point" } };
    const r = brouillonVersBlocs({ ...b, activations: [a] }, NOMS_VIDES);
    expect(r.ok && r.activation?.activations[0].targets.area).toEqual({ shape: "line", size: 9, width: 1.5, origin: "point" });
    a.cibles = { ...a.cibles, zone: { forme: "sphere", taille: "", largeur: "", origine: "point" } };
    const mauvais = brouillonVersBlocs({ ...b, activations: [a] }, NOMS_VIDES);
    expect(mauvais.ok).toBe(false);
  });

  it("V3.1-170 : la condition d'équipement d'un modificateur (armure, bouclier, arme) fait l'aller-retour", () => {
    const b = brouillonVide();
    const a = { ...nouvelleActivation(b), label: "Rage" };
    const boost = nouvelEffet("apply_modifier", b);
    if (boost.type !== "apply_boost") throw new Error("type inattendu");
    boost.nom = "Rage";
    boost.modificateurs[0].quand = { armures: ["none", "light"], bouclier: "non", armes: ["finesse", "ranged"] };
    const r = brouillonVersBlocs({ ...b, activations: [{ ...a, effets: [boost] }] }, NOMS_VIDES);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.activation) return;
    expect(r.activation.durable_effects[0].modifiers[0].when).toEqual({ armor: ["none", "light"], shield: false, wielding: ["finesse", "ranged"] });
    const relu = blocsVersBrouillon([{ blockType: "activation", data: r.activation }]);
    const e = relu.activations[0].effets[0];
    expect(e.type === "apply_boost" && e.modificateurs[0].quand).toEqual({ armures: ["none", "light"], bouclier: "non", armes: ["finesse", "ranged"] });
  });

  it("V3.1-170 : une seule propriété d'arme s'écrit en chaîne ; rien de coché n'écrit aucun « when »", () => {
    expect(conditionEcrite({ armures: [], bouclier: "oui", armes: ["finesse"] })).toEqual({ shield: true, wielding: "finesse" });
    expect(conditionEcrite({ armures: [], bouclier: "", armes: [] })).toBeUndefined();
    expect(conditionVersBrouillon({ wielding: "ranged" })).toEqual({ armures: [], bouclier: "", armes: ["ranged"] });
    expect(basculerDans(["a"], "b")).toEqual(["a", "b"]);
    expect(basculerDans(["a", "b"], "a")).toEqual(["b"]);
  });

  it("V3.1-170 : la condition d'une activation est écrite et relue", () => {
    const b = brouillonVide();
    const a = { ...nouvelleActivation(b), label: "Frappe" };
    a.quand = { armures: [], bouclier: "", armes: ["finesse", "ranged"] };
    const r = brouillonVersBlocs({ ...b, activations: [a] }, NOMS_VIDES);
    expect(r.ok && r.activation?.activations[0].when).toEqual({ wielding: ["finesse", "ranged"] });
    if (!r.ok) return;
    expect(blocsVersBrouillon([{ blockType: "activation", data: r.activation }]).activations[0].quand.armes).toEqual(["finesse", "ranged"]);
  });
  it("V3.1-170 : l'Aura de protection et une retouche se saisissent sans JSON et font l'aller-retour", () => {
    const b = brouillonVide();
    const aura = nouvelleAura();
    aura.rayon = "3";
    aura.camp = "allies";
    aura.soi = false;
    aura.eteintePar = "incapacitated, Neutralisé";
    aura.modificateurs = [nouveauModificateur("save", "add", "max(1, {ability.cha})")];
    const retouche = nouvelleRetouche();
    retouche.regle = "paladin-aura-of-protection";
    retouche.genre = "aura";
    retouche.valeur = "9";
    b.auras = [aura];
    b.retouches = [retouche];

    const r = brouillonVersBlocs(b, NOMS_VIDES);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.modifiers) return;
    expect(zModifiersBlockData.safeParse(r.modifiers).success).toBe(true);
    expect(r.modifiers.auras?.[0]).toMatchObject({ radius: 3, affects: "allies", self: false, unless_conditions: ["incapacitated", "Neutralisé"] });
    expect(r.modifiers.auras?.[0].modifiers[0]).toMatchObject({ target: "save", op: "add" });
    expect(r.modifiers.patches).toEqual([{ rule: "paladin-aura-of-protection", field: "aura.radius", value: 9 }]);

    const relu = blocsVersBrouillon([{ blockType: "modifiers", data: r.modifiers }]);
    expect(relu.auras[0]).toMatchObject({ rayon: "3", camp: "allies", soi: false, eteintePar: "incapacitated, Neutralisé" });
    expect(relu.auras[0].modificateurs[0]).toMatchObject({ cible: "save", op: "add", valeur: "max(1, {ability.cha})" });
    expect(relu.retouches[0]).toMatchObject({ regle: "paladin-aura-of-protection", genre: "aura", valeur: "9" });
    const r2 = brouillonVersBlocs(relu, NOMS_VIDES);
    expect(r2.ok && r2.modifiers).toEqual(r.modifiers);
  });

  it("V3.1-170 : les autres retouches (recharge, durée, portée) s'écrivent dans la liste fermée", () => {
    const b = brouillonVide();
    const a = { ...nouvelleRetouche(), regle: "x", genre: "resource" as const, cible: "channel", valeur: "short_rest" };
    const d = { ...nouvelleRetouche(), regle: "x", genre: "durable_effect" as const, cible: "rage", valeur: "10", unite: "minute" };
    const p = { ...nouvelleRetouche(), regle: "x", genre: "activation" as const, cible: "breath", valeur: "18" };
    b.retouches = [a, d, p];
    const r = brouillonVersBlocs(b, NOMS_VIDES);
    expect(r.ok && r.modifiers?.patches).toEqual([
      { rule: "x", field: "resource.channel.recharge", value: "short_rest" },
      { rule: "x", field: "durable_effect.rage.duration", value: { unit: "minute", amount: 10 } },
      { rule: "x", field: "activation.breath.range", value: 18 },
    ]);
    if (!r.ok) return;
    const relu = blocsVersBrouillon([{ blockType: "modifiers", data: r.modifiers }]);
    expect(relu.retouches.map((x) => [x.genre, x.cible, x.valeur, x.unite])).toEqual([
      ["resource", "channel", "short_rest", "minute"],
      ["durable_effect", "rage", "10", "minute"],
      ["activation", "breath", "18", "minute"],
    ]);
  });

  it("V3.1-170 : `modifiers` ne part que si auras ou retouches ont changé, et garde la liste existante", () => {
    const origine = { modifiers: [{ target: "ac", op: "add" as const, value: 1 }], auras: [{ radius: 3, affects: "allies" as const, self: false, modifiers: [] }] };
    const intact = blocsVersBrouillon([{ blockType: "modifiers", data: origine }]);
    const ri = brouillonVersBlocs(intact, NOMS_VIDES);
    expect(ri.ok && corpsEnregistrement(intact, ri).modifiers).toBeUndefined();

    const change = blocsVersBrouillon([{ blockType: "modifiers", data: origine }]);
    change.auras[0].rayon = "9";
    const rc = brouillonVersBlocs(change, NOMS_VIDES);
    expect(rc.ok).toBe(true);
    if (!rc.ok) return;
    expect(corpsEnregistrement(change, rc).modifiers).toEqual({ modifiers: origine.modifiers, auras: [{ radius: 9, affects: "allies", self: false, modifiers: [] }] });

    // Tout retiré, mais la liste de modificateurs reste : le bloc part avec elle seule.
    change.auras = [];
    const rv = brouillonVersBlocs(change, NOMS_VIDES);
    expect(rv.ok && corpsEnregistrement(change, rv).modifiers).toEqual({ modifiers: origine.modifiers });

    // Une aura seule, retirée : le bloc est retiré (null).
    const seule = blocsVersBrouillon([{ blockType: "modifiers", data: { modifiers: [], auras: origine.auras } }]);
    seule.auras = [];
    const rs = brouillonVersBlocs(seule, NOMS_VIDES);
    expect(rs.ok && corpsEnregistrement(seule, rs).modifiers).toBeNull();
  });

  it("V3.1-170 : une aura sans rayon valide ou une retouche sans règle est refusée avec un message", () => {
    const b = brouillonVide();
    b.auras = [{ ...nouvelleAura(), rayon: "" }];
    b.retouches = [nouvelleRetouche()];
    const r = brouillonVersBlocs(b, NOMS_VIDES);
    expect(r.ok).toBe(false);
  });
});
