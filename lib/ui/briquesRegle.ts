/**
 * V3.1-132 — logique pure de l'éditeur de briques d'une règle (ADR 0060).
 *
 * L'écran ne manipule jamais de JSON : il édite un BROUILLON où chaque formule
 * est un texte (`{ability.cha}`, `max(1, {ability.cha})`), chaque liste un
 * tableau, chaque citation une chaîne portée par sa brique. Ce module fait
 * l'aller-retour brouillon <-> blocs `resources` / `activation` / `coverage`,
 * et valide avant l'envoi (le serveur revalide de toute façon par Zod).
 *
 * Aucun effet ici : pas de réseau, pas de React.
 */
import { containsDice, formatFormulaNode, FormulaError, parseFormula, type FormulaNode } from "@/src/core/formula";
import { pruneOrphanDurableEffects } from "@/src/core/rules/activationEditor";
import { OPS_BY_TARGET_CATEGORY, modifierOpNeedsValue, modifierTargetOption } from "@/src/core/rules/modifierTargets";
import type { ModifierOp } from "@/src/core/rules/sheet";
import { isRollTarget, type Aura, type EquipmentCondition, type Modifier, type Patch } from "@/src/core/schemas/rule-blocks/primitives";
import { zModifiersBlockData, type ModifiersBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import type { BudgetKind } from "@/src/core/rules/actionBudget";
import type { ConditionNode, EffectNode, TriggerZone } from "@/src/core/rules/triggers";
import {
  REACTION_MOMENTS,
  REACTION_ROLLS,
  REACTION_SUBJECTS,
  rollOperationProblems,
  zActivationBlockData,
  zCoverageBlockData,
  zRuleResourcesBlockData,
  type ActivationBlockData,
  type CastOption,
  type CoverageBlockData,
  type DurableEffect,
  type DurableEffectDuration,
  type DurableEffectEnd,
  type RollOperation,
  type RuleResourcesBlockData,
} from "@/src/core/schemas/rule-blocks/playable";

export type Localise = Record<string, string>;
export type RechargeRegle = RuleResourcesBlockData["resources"][number]["recharge"];
export type TypeAction = ActivationBlockData["activations"][number]["cost"]["action"];
export type GenreCible = ActivationBlockData["activations"][number]["targets"]["kind"];
export type QuiBrique = "self" | "target";

// --- Les formules, en texte --------------------------------------------------

/** Pourquoi un texte n'est pas une formule valide ; `null` s'il l'est. Jamais d'exception pour l'écran. `sansDes` : un dé y est refusé (cible fixe d'un modificateur, ADR 0074). */
export function erreurFormule(texte: string, options?: { sansDes?: boolean }): string | null {
  if (texte.trim() === "") return "Formule vide.";
  try {
    const noeud = parseFormula(texte);
    if (options?.sansDes && containsDice(noeud)) return MESSAGE_DE_SUR_CIBLE_FIXE;
    return null;
  } catch (erreur) {
    if (erreur instanceof FormulaError) return erreur.message;
    throw erreur;
  }
}

const MESSAGE_DE_SUR_CIBLE_FIXE = "Un dé ne s'ajoute qu'à un jet (attaque, dégâts, sauvegarde, test) : pas à cette cible.";

/** Les références que l'aide « insérer une référence » propose (clé de libellé dans `messages/`, texte à insérer). */
export const REFERENCES_FORMULE: readonly { cle: string; texte: string }[] = [
  { cle: "modFor", texte: "{ability.str}" },
  { cle: "modDex", texte: "{ability.dex}" },
  { cle: "modCon", texte: "{ability.con}" },
  { cle: "modInt", texte: "{ability.int}" },
  { cle: "modSag", texte: "{ability.wis}" },
  { cle: "modCha", texte: "{ability.cha}" },
  { cle: "ddSorts", texte: "{spell_save_dc}" },
  { cle: "niveau", texte: "{level}" },
  { cle: "niveauClasse", texte: "{class.level}" },
  { cle: "maitrise", texte: "{proficiency}" },
];

// --- Le brouillon ------------------------------------------------------------

export interface BrouillonRessource {
  uid: string;
  key: string;
  label: string;
  labelOrig: Localise;
  max: string;
  recharge: RechargeRegle;
  passage: string | null;
}

export interface BrouillonDepense {
  cle: string;
  quantite: string;
}

export interface BrouillonCout {
  action: TypeAction;
  depenses: BrouillonDepense[];
  /** V3.1-166 : un sort, son niveau de base (0 : sort mineur) ; `null` : pas un coût en emplacement. */
  emplacement: number | null;
  passage: string | null;
}

/** V3.1-170 (ADR 0077) : la zone d'une cible « zone » ; la taille et la largeur sont des textes (mètres). */
export interface BrouillonZone {
  forme: FormeZone;
  taille: string;
  /** Pour une ligne seulement ; vide : 1,5 m. */
  largeur: string;
  origine: "self" | "point";
}

export type FormeZone = NonNullable<ActivationBlockData["activations"][number]["targets"]["area"]>["shape"];
export const FORMES_ZONE: readonly FormeZone[] = ["cone", "line", "sphere", "cube"];

export const ARMURES = ["none", "light", "medium", "heavy"] as const;
export type CategorieArmure = (typeof ARMURES)[number];
/** Les propriétés d'arme que `when.wielding` reconnaît à l'écran (cases à cocher). */
export const PROPRIETES_ARME = ["finesse", "light", "heavy", "two-handed", "versatile", "thrown", "reach", "ammunition", "loading", "ranged"] as const;

/**
 * V3.1-170 (ADR 0077) : la condition d'équipement d'un modificateur ou d'une
 * activation (`when`) — armure portée, bouclier, propriété de l'arme tenue
 * (l'une des cochées suffit). Tout vide : aucune condition.
 */
export interface BrouillonCondition {
  armures: CategorieArmure[];
  bouclier: "" | "oui" | "non";
  armes: string[];
}

export function conditionVide(): BrouillonCondition {
  return { armures: [], bouclier: "", armes: [] };
}

export function conditionVersBrouillon(c: EquipmentCondition | undefined): BrouillonCondition {
  if (!c) return conditionVide();
  const armes = c.wielding === undefined ? [] : Array.isArray(c.wielding) ? [...c.wielding] : [c.wielding];
  return { armures: c.armor ? [...c.armor] : [], bouclier: c.shield === undefined ? "" : c.shield ? "oui" : "non", armes };
}

/** `undefined` quand rien n'est coché : le bloc n'écrit alors aucun `when`. Une seule propriété s'écrit en chaîne. */
export function conditionEcrite(c: BrouillonCondition): EquipmentCondition | undefined {
  const sortie: EquipmentCondition = {
    ...(c.armures.length > 0 ? { armor: ARMURES.filter((a) => c.armures.includes(a)) } : {}),
    ...(c.bouclier !== "" ? { shield: c.bouclier === "oui" } : {}),
    ...(c.armes.length === 1 ? { wielding: c.armes[0] } : c.armes.length > 1 ? { wielding: [...c.armes] } : {}),
  };
  return Object.keys(sortie).length > 0 ? sortie : undefined;
}

/** Coche ou décoche une valeur dans une liste, sans doublon. */
export function basculerDans<T>(liste: readonly T[], valeur: T): T[] {
  return liste.includes(valeur) ? liste.filter((x) => x !== valeur) : [...liste, valeur];
}

export function nouvelleZone(): BrouillonZone {
  return { forme: "cone", taille: "4.5", largeur: "", origine: "self" };
}

/** Changer « qui » : choisir « zone » en fait apparaître les champs ; le quitter les retire. */
export function avecGenreCible(c: BrouillonCibles, kind: GenreCible): BrouillonCibles {
  return { ...c, kind, zone: kind === "area" ? (c.zone ?? nouvelleZone()) : null };
}

export interface BrouillonCibles {
  kind: GenreCible;
  /** Seulement pour `kind: "area"`. */
  zone: BrouillonZone | null;
  nombre: string;
  portee: string;
  doitVoir: boolean;
  passage: string | null;
}

export interface BrouillonDuree {
  unit: DurableEffectDuration["unit"];
  amount: string;
  whose: "bearer" | "source";
  which: "current" | "next";
}

export interface BrouillonFin {
  /** Un événement de `TRIGGER_EVENTS`, ou `dismissed` (au choix de la source). */
  event: string;
  subject: "bearer" | "source";
}

export interface BrouillonModificateur {
  uid: string;
  cible: string;
  op: ModifierOp;
  /** Une formule en texte (`1d4`, `max(1, {ability.cha})`) ; vide pour un drapeau (avantage, maîtrise). */
  valeur: string;
  perLevel: boolean;
  /** V3.1-170 : ne s'applique que si l'équipement le permet. */
  quand: BrouillonCondition;
}

export type CorpsEffet =
  | { type: "saving_throw"; ability: string; dc: string; echec: BrouillonEffet[]; reussite: BrouillonEffet[] }
  | { type: "deal_damage"; montant: string; typeDegats: string }
  | { type: "heal"; montant: string }
  | { type: "apply_condition"; cle: string }
  | { type: "remove_condition"; cle: string }
  /** « Appliquer un état » : UNE brique à l'écran, un `apply_effect` ET son effet qui dure (ADR 0060 §3). */
  | { type: "apply_state"; effectId: string; cle: string; labelOrig: Localise; duree: BrouillonDuree; concentration: boolean; finSi: BrouillonFin[] }
  /** Un effet qui dure que le formulaire ne sait pas saisir (modificateurs, jeton) : conservé tel quel, jamais perdu. */
  | { type: "existing_durable"; effectId: string }
  /**
   * « Modificateur temporaire » et « Avantage / désavantage » (ADR 0074) : UNE brique à l'écran, un `apply_effect`
   * ET un effet qui dure porteur de modificateurs (Bénédiction : +1d4 aux attaques et aux sauvegardes, 1 minute, concentration).
   */
  | { type: "apply_boost"; effectId: string; nom: string; labelOrig: Localise; modificateurs: BrouillonModificateur[]; duree: BrouillonDuree; concentration: boolean; finSi: BrouillonFin[] }
  | { type: "grant_budget"; kind: BudgetKind; montant: string }
  | { type: "move"; zone: TriggerZone }
  | { type: "roll"; libelle: string; formule: string }
  | { type: "narrate_hint"; texte: string }
  /** V3.1-166 : « Lancer un sort » par son activation (clé du sort) ; `gratuit` : sans emplacement. */
  | { type: "cast_spell"; sort: string; gratuit: boolean }
  /** Un effet hors du formulaire (dépense de ressource, inspiration) : conservé tel quel. */
  | { type: "opaque"; effet: EffectNode };

export type BrouillonEffet = { uid: string; who: string; passage: string | null } & CorpsEffet;

// --- Les réactions à un jet (V3.1-161, ADR 0075) ----------------------------

type ActivationBloc = ActivationBlockData["activations"][number];
export type JetReaction = (typeof REACTION_ROLLS)[number];
export type SujetReaction = (typeof REACTION_SUBJECTS)[number];
export type MomentReaction = (typeof REACTION_MOMENTS)[number];
export type LimiteReaction = NonNullable<ActivationBloc["limit"]>["per"];

/** « En réaction à un jet » : quel jet, de qui, quand. `naturel` : la valeur du d20 du moment « naturel » (texte). */
export interface BrouillonDeclencheur {
  jet: JetReaction;
  sujet: SujetReaction;
  moment: MomentReaction;
  naturel: string;
  /** Sans fenêtre : s'applique d'office (Chance). */
  automatique: boolean;
  /** La portée du déclencheur (m), conservée telle quelle : elle ne se saisit pas encore ici. */
  portee: NonNullable<ActivationBloc["trigger"]>["range"];
}

/** Une opération sur le jet en cours ; les nombres et formules sont des textes. */
export type BrouillonOperation = { uid: string } & (
  | { op: "add_die"; nombre: string; faces: string; signe: 1 | -1 }
  | { op: "reroll"; bonus: string }
  | { op: "set_natural"; valeur: string }
  | { op: "ac_bonus"; valeur: string }
  | { op: "damage_multiplier"; facteur: string }
  | { op: "add_damage"; formule: string; typeDegats: string }
);
export type GenreOperation = RollOperation["op"];

/** V3.1-166 : une option de lancement offerte par une aptitude (Sort accéléré) : un identifiant, un libellé, un coût en ressources, un temps d'incantation changé. */
export interface BrouillonOptionLancement {
  uid: string;
  id: string;
  label: string;
  labelOrig: Localise;
  depenses: BrouillonDepense[];
  /** `""` : le temps d'incantation ne change pas. */
  action: "" | NonNullable<CastOption["changes"]["action"]>;
}

export interface BrouillonVariante {
  uid: string;
  id: string;
  label: string;
  labelOrig: Localise;
  effets: BrouillonEffet[];
  /** `null` : le coût de l'activation. */
  cout: BrouillonCout | null;
  /** Les opérations sur le jet propres à la variante : conservées telles quelles, elles ne se saisissent pas ici. */
  operationsConservees?: RollOperation[];
}

export interface BrouillonActivation {
  uid: string;
  id: string;
  label: string;
  labelOrig: Localise;
  /** Condition d'accès (« niveau 3 »), conservée telle quelle : elle ne se saisit pas ici. */
  requires: ConditionNode | undefined;
  cout: BrouillonCout;
  cibles: BrouillonCibles;
  effets: BrouillonEffet[];
  variantes: BrouillonVariante[];
  /** `null` : l'activation se joue au clic. */
  declencheur: BrouillonDeclencheur | null;
  operations: BrouillonOperation[];
  /** V3.1-170 : la condition d'équipement de l'activation (lue pour les réactions). */
  quand: BrouillonCondition;
  /** « Une fois par tour / par round » ; `null` : sans limite. */
  limite: LimiteReaction | null;
  /** V3.1-166 : les options que cette aptitude offre au lancer d'un sort. */
  optionsLancement: BrouillonOptionLancement[];
}

export interface BrouillonLacune {
  uid: string;
  texte: string;
  manque: string;
}

/** V3.1-170 (ADR 0077) : une aura — des modificateurs pour ceux que couvre son rayon (en mètres), tant que sa source n'a aucun des états qui l'éteignent. */
export interface BrouillonAura {
  uid: string;
  rayon: string;
  camp: Aura["affects"];
  soi: boolean;
  /** Des mots (clés d'états : `incapacitated`…), séparés par des virgules ou des espaces. */
  eteintePar: string;
  modificateurs: BrouillonModificateur[];
}

export const CAMPS_AURA: readonly Aura["affects"][] = ["allies", "enemies", "all"];
export const GENRES_RETOUCHE = ["aura", "resource", "durable_effect", "activation"] as const;
export type GenreRetouche = (typeof GENRES_RETOUCHE)[number];
export const UNITES_DUREE_RETOUCHE = ["round", "minute", "hour", "day"] as const;

/** V3.1-170 : la retouche d'une AUTRE règle, dans la liste fermée de `zPatch`. */
export interface BrouillonRetouche {
  uid: string;
  /** La clé de la règle retouchée. */
  regle: string;
  genre: GenreRetouche;
  /** L'identifiant de la ressource, de l'effet qui dure ou de l'activation ; vide pour le rayon d'une aura. */
  cible: string;
  /** Un nombre (rayon, portée, durée), ou une recharge (`long_rest`…). */
  valeur: string;
  /** Pour une durée seulement. */
  unite: string;
}

export interface Brouillon {
  ressources: BrouillonRessource[];
  /** V3.1-170 : les auras et retouches du bloc `modifiers` ; sa liste de modificateurs reste telle quelle. */
  auras: BrouillonAura[];
  retouches: BrouillonRetouche[];
  modificateursConserves: Modifier[];
  /** Les auras et retouches tels que lus : `modifiers` n'est envoyé que s'ils ont changé. */
  signatureAuras: string;
  activations: BrouillonActivation[];
  /** Les effets qui durent hors formulaire, gardés pour être réécrits. */
  durablesConserves: DurableEffect[];
  lacunes: BrouillonLacune[];
  /** Les blocs existaient déjà : les retirer s'envoie `null`. */
  existait: { resources: boolean; activation: boolean; coverage: boolean; modifiers: boolean };
}

let compteur = 0;
/** Un identifiant d'écran (clé React, survol) : jamais enregistré, jamais affiché. */
export function nouvelUid(): string {
  compteur += 1;
  return `b${compteur}`;
}

export function libelleFr(l: Localise): string {
  return l.fr ?? Object.values(l)[0] ?? "";
}

function localise(origine: Localise, texte: string): Localise {
  return { ...origine, fr: texte };
}

/** Un identifiant libre : `base`, puis `base-2`, `base-3`… */
export function idLibre(base: string, pris: ReadonlySet<string>): string {
  if (!pris.has(base)) return base;
  let n = 2;
  while (pris.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Un identifiant technique lisible à partir d'un libellé (`Conduit divin` -> `conduit-divin`). */
export function cleDepuisLibelle(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Brouillon vide et nouvelles briques ------------------------------------

export function brouillonVide(): Brouillon {
  const b: Brouillon = {
    ressources: [],
    auras: [],
    retouches: [],
    modificateursConserves: [],
    signatureAuras: "",
    activations: [],
    durablesConserves: [],
    lacunes: [],
    existait: { resources: false, activation: false, coverage: false, modifiers: false },
  };
  b.signatureAuras = signatureAuras(b);
  return b;
}

/** Les auras et retouches sans leurs identifiants d'écran : de quoi savoir s'ils ont changé. */
export function signatureAuras(b: Pick<Brouillon, "auras" | "retouches">): string {
  return JSON.stringify({ a: b.auras, r: b.retouches }, (cle, v) => (cle === "uid" ? undefined : v));
}

export function nouvelleAura(): BrouillonAura {
  return { uid: nouvelUid(), rayon: "3", camp: "allies", soi: false, eteintePar: "", modificateurs: [nouveauModificateur("ac", "add", "1")] };
}

export function nouvelleRetouche(): BrouillonRetouche {
  return { uid: nouvelUid(), regle: "", genre: "aura", cible: "", valeur: "", unite: "minute" };
}

function motsDe(texte: string): string[] {
  return texte.split(/[,\s]+/).filter((m) => m !== "");
}

function auraVersBrouillon(a: Aura): BrouillonAura {
  return {
    uid: nouvelUid(),
    rayon: String(a.radius),
    camp: a.affects,
    soi: a.self,
    eteintePar: (a.unless_conditions ?? []).join(", "),
    modificateurs: a.modifiers.map(modificateurVersBrouillon),
  };
}

function retoucheVersBrouillon(p: Patch): BrouillonRetouche {
  const [genre, cible = ""] = p.field.split(".");
  const base = { uid: nouvelUid(), regle: p.rule, unite: "minute" };
  if (genre === "resource") return { ...base, genre, cible, valeur: String(p.value) };
  if (genre === "durable_effect") {
    const d = p.value as { unit?: unknown; amount?: unknown };
    return { ...base, genre, cible, valeur: String(d.amount ?? ""), unite: typeof d.unit === "string" ? d.unit : "minute" };
  }
  if (genre === "activation") return { ...base, genre, cible, valeur: String(p.value) };
  return { ...base, genre: "aura", cible: "", valeur: String(p.value) };
}

export function nouvelleRessource(): BrouillonRessource {
  return { uid: nouvelUid(), key: "", label: "", labelOrig: {}, max: "1", recharge: "long_rest", passage: null };
}

export function nouveauCout(): BrouillonCout {
  return { action: "action", depenses: [], emplacement: null, passage: null };
}

export function nouvellesCibles(): BrouillonCibles {
  return { kind: "creature", zone: null, nombre: "", portee: "", doitVoir: false, passage: null };
}

export function nouvelleLacune(texte = ""): BrouillonLacune {
  return { uid: nouvelUid(), texte, manque: "" };
}

export function toutesLesActivationsIds(b: Brouillon): Set<string> {
  return new Set(b.activations.map((a) => a.id));
}

export function nouvelleActivation(b: Brouillon): BrouillonActivation {
  return {
    uid: nouvelUid(),
    id: idLibre("utilisation", toutesLesActivationsIds(b)),
    label: "",
    labelOrig: {},
    requires: undefined,
    cout: nouveauCout(),
    cibles: nouvellesCibles(),
    effets: [],
    variantes: [],
    declencheur: null,
    operations: [],
    quand: conditionVide(),
    limite: null,
    optionsLancement: [],
  };
}

export function nouvelleOptionLancement(a: BrouillonActivation): BrouillonOptionLancement {
  return { uid: nouvelUid(), id: idLibre("option", new Set(a.optionsLancement.map((o) => o.id))), label: "", labelOrig: {}, depenses: [], action: "" };
}

export function nouvelleVariante(a: BrouillonActivation): BrouillonVariante {
  return {
    uid: nouvelUid(),
    id: idLibre("variante", new Set(a.variantes.map((v) => v.id))),
    label: "",
    labelOrig: {},
    effets: [],
    cout: null,
  };
}

// --- Les réactions : ce qui a un sens, et les nouvelles briques ----------------

const MODELES_OPERATIONS: readonly RollOperation[] = [
  { op: "add_die", count: { op: "num", value: 1 }, faces: { op: "num", value: 6 }, sign: 1 },
  { op: "reroll" },
  { op: "set_natural", value: 20 },
  { op: "ac_bonus", value: { op: "num", value: 1 } },
  { op: "damage_multiplier", factor: 1 },
  { op: "add_damage", formula: { op: "num", value: 1 } },
];

/** Les opérations qui ont un sens sur le jet visé (le noyau en décide : `rollOperationProblems`). */
export function operationsPermises(jet: JetReaction): GenreOperation[] {
  return MODELES_OPERATIONS.filter((o) => rollOperationProblems({ on: "roll", roll: jet, subject: "any", when: "rolled" }, [o]).length === 0).map((o) => o.op);
}

/** Les moments qui ont un sens sur le jet visé : « touché » ne se dit que d'une attaque, un jet de dégâts n'a que « quand il est lancé ». */
export function momentsPermis(jet: JetReaction): MomentReaction[] {
  if (jet === "damage") return ["rolled"];
  return REACTION_MOMENTS.filter((m) => m !== "hit" || jet === "attack");
}

export function nouveauDeclencheur(): BrouillonDeclencheur {
  return { jet: "attack", sujet: "any", moment: "rolled", naturel: "", automatique: false, portee: undefined };
}

export function nouvelleOperation(op: GenreOperation): BrouillonOperation {
  const base = { uid: nouvelUid() };
  switch (op) {
    case "add_die":
      return { ...base, op, nombre: "1", faces: "4", signe: 1 };
    case "reroll":
      return { ...base, op, bonus: "" };
    case "set_natural":
      return { ...base, op, valeur: "20" };
    case "ac_bonus":
      return { ...base, op, valeur: "5" };
    case "damage_multiplier":
      return { ...base, op, facteur: "0.5" };
    case "add_damage":
      return { ...base, op, formule: "1d6", typeDegats: "" };
  }
}

/**
 * Change le déclencheur d'une activation (ou le crée / l'enlève avec `null`) et
 * remet d'équerre ce qui en dépend : un moment sans sens sur le nouveau jet
 * redevient « quand il est lancé », la valeur du d20 ne survit pas au moment
 * « naturel », et les opérations qui n'ont plus de sens sont retirées. Sans
 * déclencheur, plus d'opération.
 */
export function avecDeclencheur(a: BrouillonActivation, changement: Partial<BrouillonDeclencheur> | null): BrouillonActivation {
  if (changement === null) return { ...a, declencheur: null, operations: [] };
  const d: BrouillonDeclencheur = { ...(a.declencheur ?? nouveauDeclencheur()), ...changement };
  if (!momentsPermis(d.jet).includes(d.moment)) d.moment = "rolled";
  if (d.moment !== "natural") d.naturel = "";
  else if (d.naturel.trim() === "") d.naturel = "1";
  const permises = operationsPermises(d.jet);
  return { ...a, declencheur: d, operations: a.operations.filter((o) => permises.includes(o.op)) };
}

/** Ce que la liste « Ajouter une brique » propose (« Avantage / désavantage » et « Modificateur temporaire » écrivent le même effet). */
export const ENTREES_AJOUT = [
  "saving_throw",
  "deal_damage",
  "heal",
  "apply_state",
  "remove_condition",
  "advantage",
  "apply_modifier",
  "move",
  "grant_budget",
  "roll",
  "narrate_hint",
  "cast_spell",
] as const;
export type EntreeAjout = (typeof ENTREES_AJOUT)[number];

/** Tous les identifiants d'effets qui durent déjà posés ou conservés dans le brouillon. */
export function idsEffetsPris(b: Brouillon): Set<string> {
  const pris = new Set(b.durablesConserves.map((d) => d.id));
  const parcourir = (liste: readonly BrouillonEffet[]) => {
    for (const e of liste) {
      if (e.type === "apply_state" || e.type === "apply_boost" || e.type === "existing_durable") pris.add(e.effectId);
      if (e.type === "saving_throw") {
        parcourir(e.echec);
        parcourir(e.reussite);
      }
    }
  };
  for (const a of b.activations) {
    parcourir(a.effets);
    for (const v of a.variantes) parcourir(v.effets);
  }
  return pris;
}

export function nouveauModificateur(cible: string, op: ModifierOp, valeur: string): BrouillonModificateur {
  return { uid: nouvelUid(), cible, op, valeur, perLevel: false, quand: conditionVide() };
}

function nouveauBoost(base: { uid: string; passage: null }, b: Brouillon, premier: BrouillonModificateur): BrouillonEffet {
  return {
    ...base,
    who: "target",
    type: "apply_boost",
    effectId: idLibre("effet", idsEffetsPris(b)),
    nom: "",
    labelOrig: {},
    modificateurs: [premier],
    duree: { unit: "minute", amount: "1", whose: "bearer", which: "next" },
    concentration: false,
    finSi: [],
  };
}

export function nouvelEffet(entree: EntreeAjout, b: Brouillon): BrouillonEffet {
  const base = { uid: nouvelUid(), passage: null };
  switch (entree) {
    case "saving_throw":
      return { ...base, who: "target", type: "saving_throw", ability: "wis", dc: "{spell_save_dc}", echec: [], reussite: [] };
    case "deal_damage":
      return { ...base, who: "target", type: "deal_damage", montant: "1d6", typeDegats: "" };
    case "heal":
      return { ...base, who: "self", type: "heal", montant: "1d6" };
    case "apply_state":
      return {
        ...base,
        who: "target",
        type: "apply_state",
        effectId: idLibre("effet", idsEffetsPris(b)),
        cle: "",
        labelOrig: {},
        duree: { unit: "minute", amount: "1", whose: "bearer", which: "next" },
        concentration: false,
        finSi: [],
      };
    case "remove_condition":
      return { ...base, who: "target", type: "remove_condition", cle: "" };
    case "advantage":
      return nouveauBoost(base, b, nouveauModificateur("save.str", "advantage", ""));
    case "apply_modifier":
      return nouveauBoost(base, b, nouveauModificateur("ac", "add", "1"));
    case "move":
      return { ...base, who: "target", type: "move", zone: "far" };
    case "grant_budget":
      return { ...base, who: "self", type: "grant_budget", kind: "action", montant: "1" };
    case "roll":
      return { ...base, who: "self", type: "roll", libelle: "", formule: "1d20" };
    case "narrate_hint":
      return { ...base, who: "self", type: "narrate_hint", texte: "" };
    case "cast_spell":
      return { ...base, who: "self", type: "cast_spell", sort: "", gratuit: false };
  }
}

/** Les effets permis pour une cible de modificateur (jamais une opération que le moteur ignore). */
export function opsPourCible(cible: string): readonly ModifierOp[] {
  const option = modifierTargetOption(cible);
  return option ? OPS_BY_TARGET_CATEGORY[option.category] : ["add"];
}

// --- Listes immuables --------------------------------------------------------

export function remplacerA<T>(liste: readonly T[], i: number, valeur: T): T[] {
  return liste.map((x, k) => (k === i ? valeur : x));
}

export function retirerA<T>(liste: readonly T[], i: number): T[] {
  return liste.filter((_, k) => k !== i);
}

/** Décale l'élément `i` de `delta` rangs ; hors bornes, la liste est rendue inchangée. */
export function deplacerA<T>(liste: readonly T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (i < 0 || j < 0 || i >= liste.length || j >= liste.length) return [...liste];
  const copie = [...liste];
  const [x] = copie.splice(i, 1);
  copie.splice(j, 0, x);
  return copie;
}

// --- Blocs -> brouillon ------------------------------------------------------

function coutVersBrouillon(c: ActivationBlockData["activations"][number]["cost"], passage: string | null): BrouillonCout {
  return { action: c.action, depenses: depensesVersBrouillon(c.resources), emplacement: c.slot?.level ?? null, passage };
}

function depensesVersBrouillon(ressources: readonly { key: string; amount: FormulaNode }[]): BrouillonDepense[] {
  return ressources.map((r) => ({ cle: r.key, quantite: formatFormulaNode(r.amount) }));
}

function dureeVersBrouillon(d: DurableEffectDuration): BrouillonDuree {
  const base: BrouillonDuree = { unit: d.unit, amount: "1", whose: "bearer", which: "next" };
  if (d.unit === "until_turn_end") return { ...base, whose: d.whose, which: d.which };
  if (d.unit === "until_rest" || d.unit === "permanent") return base;
  return { ...base, amount: String(d.amount) };
}

function finVersBrouillon(f: DurableEffectEnd): BrouillonFin {
  return f.event === "dismissed" ? { event: "dismissed", subject: "bearer" } : { event: f.event, subject: f.subject };
}

/** Un effet qui dure que le formulaire sait saisir : un seul état, ni modificateur ni jeton. */
function durableSaisissable(d: DurableEffect): boolean {
  return d.conditions.length === 1 && d.modifiers.length === 0 && d.token === null;
}

/** Un effet qui dure porteur de modificateurs seuls (ni état, ni jeton) : ce que « Modificateur temporaire » écrit. */
function durableBoost(d: DurableEffect): boolean {
  return d.conditions.length === 0 && d.modifiers.length > 0 && d.token === null;
}

function modificateurVersBrouillon(m: DurableEffect["modifiers"][number]): BrouillonModificateur {
  const valeur = m.value === undefined ? "" : typeof m.value === "number" ? String(m.value) : formatFormulaNode(m.value);
  return { uid: nouvelUid(), cible: m.target, op: m.op, valeur, perLevel: m.per_level === true, quand: conditionVersBrouillon(m.when) };
}

interface CtxLecture {
  /** Tous les identifiants d'effets pris (pour nommer l'effet d'un `apply_modifier` converti). */
  pris: Set<string>;
  durables: Map<string, DurableEffect>;
  /** Identifiants déjà repris par une brique `apply_state`. */
  repris: Set<string>;
  conserves: Map<string, DurableEffect>;
  passages: Record<string, string> | undefined;
}

function declencheurVersBrouillon(t: NonNullable<ActivationBloc["trigger"]>): BrouillonDeclencheur {
  return { jet: t.roll, sujet: t.subject, moment: t.when, naturel: t.natural === undefined ? "" : String(t.natural), automatique: t.automatic === true, portee: t.range };
}

function operationVersBrouillon(o: RollOperation): BrouillonOperation {
  const base = { uid: nouvelUid() };
  switch (o.op) {
    case "add_die":
      return { ...base, op: "add_die", nombre: formatFormulaNode(o.count), faces: formatFormulaNode(o.faces), signe: o.sign };
    case "reroll":
      return { ...base, op: "reroll", bonus: o.bonus ? formatFormulaNode(o.bonus) : "" };
    case "set_natural":
      return { ...base, op: "set_natural", valeur: String(o.value) };
    case "ac_bonus":
      return { ...base, op: "ac_bonus", valeur: formatFormulaNode(o.value) };
    case "damage_multiplier":
      return { ...base, op: "damage_multiplier", facteur: String(o.factor) };
    case "add_damage":
      return { ...base, op: "add_damage", formule: formatFormulaNode(o.formula), typeDegats: o.damage_type ?? "" };
  }
}

function effetVersBrouillon(e: EffectNode, chemin: string, ctx: CtxLecture): BrouillonEffet {
  const base = { uid: nouvelUid(), passage: ctx.passages?.[chemin] ?? null };
  const liste = (effets: readonly EffectNode[] | undefined, prefixe: string) => (effets ?? []).map((x, i) => effetVersBrouillon(x, `${prefixe}.${i}`, ctx));
  switch (e.action) {
    case "saving_throw":
      return {
        ...base,
        who: e.who,
        type: "saving_throw",
        ability: e.ability,
        dc: formatFormulaNode(e.dc),
        echec: liste(e.on_fail, `${chemin}.on_fail`),
        reussite: liste(e.on_pass, `${chemin}.on_pass`),
      };
    case "deal_damage":
      return { ...base, who: e.who, type: "deal_damage", montant: formatFormulaNode(e.amount), typeDegats: e.damage_type ?? "" };
    case "heal":
      return { ...base, who: e.who, type: "heal", montant: formatFormulaNode(e.amount) };
    case "apply_condition":
      return { ...base, who: e.who, type: "apply_condition", cle: e.key };
    case "remove_condition":
      return { ...base, who: e.who, type: "remove_condition", cle: e.key };
    case "apply_modifier": {
      // Un `apply_modifier` déjà enregistré se relit comme un effet qui dure d'une minute : cible, effet, valeur et libellé sont gardés.
      const effectId = idLibre("effet", ctx.pris);
      ctx.pris.add(effectId);
      return {
        ...base,
        who: e.who,
        type: "apply_boost",
        effectId,
        nom: e.modifier.label,
        labelOrig: {},
        modificateurs: [{ uid: nouvelUid(), cible: e.modifier.target, op: e.modifier.op, valeur: e.modifier.value === undefined ? "" : String(e.modifier.value), perLevel: e.modifier.perLevel === true, quand: conditionVide() }],
        duree: { unit: "minute", amount: "1", whose: "bearer", which: "next" },
        concentration: false,
        finSi: [],
      };
    }
    case "grant_budget":
      return { ...base, who: e.who, type: "grant_budget", kind: e.kind, montant: formatFormulaNode(e.amount) };
    case "move":
      return { ...base, who: e.who, type: "move", zone: e.zone };
    case "roll":
      return { ...base, who: "self", type: "roll", libelle: e.label, formule: formatFormulaNode(e.formula) };
    case "narrate_hint":
      return { ...base, who: "self", type: "narrate_hint", texte: e.text };
    case "cast_spell":
      return { ...base, who: e.who, type: "cast_spell", sort: e.spell, gratuit: e.free };
    case "apply_effect": {
      const d = ctx.durables.get(e.effect);
      if (!d) return { ...base, who: e.who, type: "opaque", effet: e };
      if (durableSaisissable(d) && !ctx.repris.has(d.id)) {
        ctx.repris.add(d.id);
        return {
          ...base,
          passage: base.passage ?? d.passage ?? null,
          who: e.who,
          type: "apply_state",
          effectId: d.id,
          cle: d.conditions[0],
          labelOrig: d.label,
          duree: dureeVersBrouillon(d.duration),
          concentration: d.concentration,
          finSi: d.ends_on.map(finVersBrouillon),
        };
      }
      if (durableBoost(d) && !ctx.repris.has(d.id)) {
        ctx.repris.add(d.id);
        return {
          ...base,
          passage: base.passage ?? d.passage ?? null,
          who: e.who,
          type: "apply_boost",
          effectId: d.id,
          nom: libelleFr(d.label),
          labelOrig: d.label,
          modificateurs: d.modifiers.map(modificateurVersBrouillon),
          duree: dureeVersBrouillon(d.duration),
          concentration: d.concentration,
          finSi: d.ends_on.map(finVersBrouillon),
        };
      }
      ctx.conserves.set(d.id, d);
      return { ...base, who: e.who, type: "existing_durable", effectId: d.id };
    }
    case "spend_resource":
    case "grant_inspiration":
      return { ...base, who: e.who, type: "opaque", effet: e };
  }
}

/** Les blocs DÉJÀ validés d'une règle (ceux que `RuleEntryDetail` porte) vers un brouillon éditable. */
export function blocsVersBrouillon(blocs: readonly { blockType: string; data: unknown }[]): Brouillon {
  const b = brouillonVide();
  const res = blocs.find((x) => x.blockType === "resources");
  const act = blocs.find((x) => x.blockType === "activation");
  const cov = blocs.find((x) => x.blockType === "coverage");
  const mod = blocs.find((x) => x.blockType === "modifiers");
  b.existait = { resources: !!res, activation: !!act, coverage: !!cov, modifiers: !!mod };
  if (mod) {
    const donnees = mod.data as ModifiersBlockData;
    b.modificateursConserves = donnees.modifiers;
    b.auras = (donnees.auras ?? []).map(auraVersBrouillon);
    b.retouches = (donnees.patches ?? []).map(retoucheVersBrouillon);
  }

  if (res) {
    b.ressources = (res.data as RuleResourcesBlockData).resources.map((r) => ({
      uid: nouvelUid(),
      key: r.key,
      label: libelleFr(r.label),
      labelOrig: r.label,
      max: formatFormulaNode(r.max),
      recharge: r.recharge,
      passage: r.passage ?? null,
    }));
  }

  if (act) {
    const data = act.data as ActivationBlockData;
    const durables = new Map(data.durable_effects.map((d) => [d.id, d]));
    const repris = new Set<string>();
    const pris = new Set(data.durable_effects.map((d) => d.id));
    const conserves = new Map<string, DurableEffect>();
    b.activations = data.activations.map((a) => {
      const ctx: CtxLecture = { pris, durables, repris, conserves, passages: a.passages };
      return {
        uid: nouvelUid(),
        id: a.id,
        label: libelleFr(a.label),
        labelOrig: a.label,
        requires: a.requires,
        cout: coutVersBrouillon(a.cost, a.passages?.cost ?? null),
        cibles: {
          kind: a.targets.kind,
          zone: a.targets.area
            ? { forme: a.targets.area.shape, taille: String(a.targets.area.size), largeur: a.targets.area.width === undefined ? "" : String(a.targets.area.width), origine: a.targets.area.origin }
            : null,
          nombre: a.targets.count ? formatFormulaNode(a.targets.count) : "",
          portee: a.targets.range ? String(a.targets.range.value) : "",
          doitVoir: a.targets.must_see === true,
          passage: a.passages?.targets ?? null,
        },
        effets: a.effects.map((e, i) => effetVersBrouillon(e, `effects.${i}`, ctx)),
        variantes: (a.variants ?? []).map((v, k) => ({
          uid: nouvelUid(),
          id: v.id,
          label: libelleFr(v.label),
          labelOrig: v.label,
          effets: v.effects.map((e, i) => effetVersBrouillon(e, `variants.${k}.effects.${i}`, ctx)),
          cout: v.cost ? coutVersBrouillon(v.cost, null) : null,
          ...(v.roll_operations && v.roll_operations.length > 0 ? { operationsConservees: v.roll_operations } : {}),
        })),
        declencheur: a.trigger ? declencheurVersBrouillon(a.trigger) : null,
        operations: (a.roll_operations ?? []).map(operationVersBrouillon),
        quand: conditionVersBrouillon(a.when),
        limite: a.limit?.per ?? null,
        optionsLancement: (a.cast_options ?? []).map((o) => ({
          uid: nouvelUid(),
          id: o.id,
          label: libelleFr(o.label),
          labelOrig: o.label,
          depenses: depensesVersBrouillon(o.cost.resources),
          action: o.changes.action ?? "",
        })),
      };
    });
    b.durablesConserves = [...conserves.values()];
  }

  if (cov) {
    b.lacunes = (cov.data as CoverageBlockData).gaps.map((g) => ({ uid: nouvelUid(), texte: g.text, manque: g.missing }));
  }
  b.signatureAuras = signatureAuras(b);
  return b;
}

// --- Brouillon -> blocs ------------------------------------------------------

export type ResultatBlocs =
  | { ok: true; resources: RuleResourcesBlockData | null; activation: ActivationBlockData | null; coverage: CoverageBlockData | null; modifiers: ModifiersBlockData | null }
  | { ok: false; erreurs: string[] };

interface CtxEcriture {
  erreurs: string[];
  durables: DurableEffect[];
  conserves: Map<string, DurableEffect>;
  nomsEtats: Readonly<Record<string, string>>;
}

function formule(texte: string, contexte: string, ctx: CtxEcriture): FormulaNode {
  try {
    return parseFormula(texte);
  } catch (erreur) {
    if (!(erreur instanceof FormulaError)) throw erreur;
    ctx.erreurs.push(`${contexte} : ${texte.trim() === "" ? "formule vide" : erreur.message}`);
    return { op: "num", value: 0 };
  }
}

function nombrePositif(texte: string, contexte: string, ctx: CtxEcriture): number {
  const n = Number(texte.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) {
    ctx.erreurs.push(`${contexte} : un nombre supérieur à zéro est attendu`);
    return 1;
  }
  return n;
}

function depensesEcrites(depenses: readonly BrouillonDepense[], contexte: string, ctx: CtxEcriture): { key: string; amount: FormulaNode }[] {
  return depenses.map((d) => {
    if (d.cle === "") ctx.erreurs.push(`${contexte} : choisis la ressource dépensée`);
    return { key: d.cle || "?", amount: formule(d.quantite, `${contexte}, quantité`, ctx) };
  });
}

function coutEcrit(c: BrouillonCout, contexte: string, ctx: CtxEcriture): ActivationBlockData["activations"][number]["cost"] {
  return {
    action: c.action,
    resources: depensesEcrites(c.depenses, contexte, ctx),
    ...(c.emplacement !== null ? { slot: { level: c.emplacement } } : {}),
  };
}

function optionLancementEcrite(o: BrouillonOptionLancement, contexte: string, ctx: CtxEcriture): CastOption {
  const nom = o.label.trim();
  if (nom === "") ctx.erreurs.push(`${contexte} : donne-lui un libellé`);
  return {
    id: o.id,
    label: localise(o.labelOrig, nom),
    cost: { resources: depensesEcrites(o.depenses, `${contexte}, coût`, ctx) },
    changes: o.action !== "" ? { action: o.action } : {},
  };
}

function dureeEcrite(d: BrouillonDuree, contexte: string, ctx: CtxEcriture): DurableEffectDuration {
  if (d.unit === "until_turn_end") return { unit: "until_turn_end", whose: d.whose, which: d.which };
  if (d.unit === "until_rest" || d.unit === "permanent") return { unit: d.unit };
  return { unit: d.unit, amount: nombrePositif(d.amount, `${contexte}, durée`, ctx) };
}

function finEcrite(f: BrouillonFin): DurableEffectEnd {
  // Le cast est borné : `event` vient d'une liste fermée de l'écran, et Zod revalide juste après.
  return f.event === "dismissed" ? { event: "dismissed" } : ({ event: f.event, subject: f.subject } as DurableEffectEnd);
}

/** Un modificateur de l'écran vers le bloc : un nombre reste un nombre, le reste est une formule (dés permis sur une cible de jet seulement). */
function modificateurEcrit(m: BrouillonModificateur, contexte: string, ctx: CtxEcriture): DurableEffect["modifiers"][number] {
  let value: number | FormulaNode | undefined;
  if (modifierOpNeedsValue(m.op)) {
    const noeud = formule(m.valeur, `${contexte}, valeur`, ctx);
    if (!isRollTarget(m.cible) && containsDice(noeud)) ctx.erreurs.push(`${contexte} : ${MESSAGE_DE_SUR_CIBLE_FIXE}`);
    value = noeud.op === "num" ? noeud.value : noeud;
  }
  const quand = conditionEcrite(m.quand);
  return { target: m.cible, op: m.op, ...(value !== undefined ? { value } : {}), ...(m.perLevel ? { per_level: true } : {}), ...(quand ? { when: quand } : {}) };
}

/** La zone de l'écran vers le bloc : forme, taille en mètres, largeur d'une ligne, origine. */
function zoneEcrite(z: BrouillonZone | null, contexte: string, ctx: CtxEcriture): NonNullable<ActivationBlockData["activations"][number]["targets"]["area"]> {
  const zone = z ?? nouvelleZone();
  const largeur = zone.largeur.trim();
  return {
    shape: zone.forme,
    size: nombrePositif(zone.taille, `${contexte}, taille`, ctx),
    ...(zone.forme === "line" && largeur !== "" ? { width: nombrePositif(largeur, `${contexte}, largeur`, ctx) } : {}),
    origin: zone.origine,
  };
}

function auraEcrite(a: BrouillonAura, contexte: string, ctx: CtxEcriture): Aura {
  const eteintePar = motsDe(a.eteintePar);
  return {
    radius: nombrePositif(a.rayon, `${contexte}, rayon`, ctx),
    affects: a.camp,
    self: a.soi,
    ...(eteintePar.length > 0 ? { unless_conditions: eteintePar } : {}),
    modifiers: a.modificateurs.map((m, k) => modificateurEcrit(m, `${contexte}, modificateur ${k + 1}`, ctx)),
  };
}

function retoucheEcrite(r: BrouillonRetouche, contexte: string, ctx: CtxEcriture): Patch {
  if (r.regle.trim() === "") ctx.erreurs.push(`${contexte} : indique la règle retouchée`);
  const rule = r.regle.trim() || "?";
  const cible = r.cible.trim();
  if (r.genre !== "aura" && cible === "") ctx.erreurs.push(`${contexte} : indique l'identifiant visé`);
  if (r.genre === "aura") return { rule, field: "aura.radius", value: nombrePositif(r.valeur, `${contexte}, rayon`, ctx) };
  if (r.genre === "activation") return { rule, field: `activation.${cible}.range`, value: nombrePositif(r.valeur, `${contexte}, portée`, ctx) };
  if (r.genre === "resource") return { rule, field: `resource.${cible}.recharge`, value: r.valeur.trim() };
  return { rule, field: `durable_effect.${cible}.duration`, value: { unit: r.unite, amount: nombrePositif(r.valeur, `${contexte}, durée`, ctx) } };
}

function entierDansBornes(texte: string, contexte: string, ctx: CtxEcriture): number {
  const n = Number(texte.trim());
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    ctx.erreurs.push(`${contexte} : un nombre entier de 1 à 20 est attendu`);
    return 1;
  }
  return n;
}

function declencheurEcrit(d: BrouillonDeclencheur, contexte: string, ctx: CtxEcriture): NonNullable<ActivationBloc["trigger"]> {
  return {
    on: "roll",
    roll: d.jet,
    subject: d.sujet,
    when: d.moment,
    ...(d.moment === "natural" ? { natural: entierDansBornes(d.naturel, `${contexte}, valeur du d20`, ctx) } : {}),
    ...(d.portee ? { range: d.portee } : {}),
    ...(d.automatique ? { automatic: true } : {}),
  };
}

function operationEcrite(o: BrouillonOperation, contexte: string, ctx: CtxEcriture): RollOperation {
  switch (o.op) {
    case "add_die":
      return { op: "add_die", count: formule(o.nombre, `${contexte}, nombre de dés`, ctx), faces: formule(o.faces, `${contexte}, faces`, ctx), sign: o.signe };
    case "reroll":
      return { op: "reroll", ...(o.bonus.trim() !== "" ? { bonus: formule(o.bonus, `${contexte}, bonus`, ctx) } : {}) };
    case "set_natural":
      return { op: "set_natural", value: entierDansBornes(o.valeur, `${contexte}, valeur du d20`, ctx) };
    case "ac_bonus":
      return { op: "ac_bonus", value: formule(o.valeur, `${contexte}, bonus de CA`, ctx) };
    case "damage_multiplier":
      return { op: "damage_multiplier", factor: nombrePositif(o.facteur, `${contexte}, facteur`, ctx) };
    case "add_damage":
      return { op: "add_damage", formula: formule(o.formule, `${contexte}, dégâts`, ctx), ...(o.typeDegats.trim() !== "" ? { damage_type: o.typeDegats.trim() } : {}) };
  }
}

function effetEcrit(e: BrouillonEffet, contexte: string, activationId: string, ctx: CtxEcriture): EffectNode {
  const ou = `${contexte}`;
  switch (e.type) {
    case "saving_throw": {
      const echec = e.echec.map((x, i) => effetEcrit(x, `${ou}, si échec ${i + 1}`, activationId, ctx));
      const reussite = e.reussite.map((x, i) => effetEcrit(x, `${ou}, si réussite ${i + 1}`, activationId, ctx));
      return {
        action: "saving_throw",
        who: e.who,
        ability: e.ability,
        dc: formule(e.dc, `${ou}, DD`, ctx),
        ...(echec.length > 0 ? { on_fail: echec } : {}),
        ...(reussite.length > 0 ? { on_pass: reussite } : {}),
      };
    }
    case "deal_damage":
      return { action: "deal_damage", who: e.who, amount: formule(e.montant, `${ou}, dégâts`, ctx), ...(e.typeDegats ? { damage_type: e.typeDegats } : {}) };
    case "heal":
      return { action: "heal", who: e.who, amount: formule(e.montant, `${ou}, soins`, ctx) };
    case "apply_condition":
    case "remove_condition":
      if (e.cle === "") ctx.erreurs.push(`${ou} : choisis l'état`);
      return { action: e.type, who: e.who, key: e.cle || "?" };
    case "apply_state": {
      if (e.cle === "") ctx.erreurs.push(`${ou} : choisis l'état`);
      const nom = ctx.nomsEtats[e.cle] ?? e.cle;
      if (!ctx.durables.some((d) => d.id === e.effectId)) {
        ctx.durables.push({
          id: e.effectId,
          label: localise(e.labelOrig, nom),
          conditions: [e.cle || "?"],
          modifiers: [],
          duration: dureeEcrite(e.duree, ou, ctx),
          concentration: e.concentration,
          ends_on: e.finSi.map(finEcrite),
          token: null,
          ...(e.passage ? { passage: e.passage } : {}),
        });
      }
      return { action: "apply_effect", who: e.who, effect: e.effectId };
    }
    case "existing_durable": {
      const d = ctx.conserves.get(e.effectId);
      if (d && !ctx.durables.some((x) => x.id === d.id)) ctx.durables.push(d);
      return { action: "apply_effect", who: e.who, effect: e.effectId };
    }
    case "apply_boost": {
      const nom = e.nom.trim();
      if (nom === "") ctx.erreurs.push(`${ou} : donne un nom à l'effet`);
      if (e.modificateurs.length === 0) ctx.erreurs.push(`${ou} : ajoute au moins un modificateur`);
      if (!ctx.durables.some((d) => d.id === e.effectId)) {
        ctx.durables.push({
          id: e.effectId,
          label: localise(e.labelOrig, nom || e.effectId),
          conditions: [],
          modifiers: e.modificateurs.map((m, k) => modificateurEcrit(m, `${ou}, modificateur ${k + 1}`, ctx)),
          duration: dureeEcrite(e.duree, ou, ctx),
          concentration: e.concentration,
          ends_on: e.finSi.map(finEcrite),
          token: null,
          ...(e.passage ? { passage: e.passage } : {}),
        });
      }
      return { action: "apply_effect", who: e.who, effect: e.effectId };
    }
    case "grant_budget":
      return { action: "grant_budget", who: e.who, kind: e.kind, amount: formule(e.montant, `${ou}, montant`, ctx) };
    case "move":
      return { action: "move", who: e.who, zone: e.zone };
    case "roll":
      if (e.libelle.trim() === "") ctx.erreurs.push(`${ou} : donne un libellé au jet`);
      return { action: "roll", label: e.libelle.trim() || "?", formula: formule(e.formule, `${ou}, formule`, ctx) };
    case "narrate_hint":
      if (e.texte.trim() === "") ctx.erreurs.push(`${ou} : écris l'indication`);
      return { action: "narrate_hint", text: e.texte.trim() || "?" };
    case "cast_spell":
      if (e.sort.trim() === "") ctx.erreurs.push(`${ou} : donne la clé du sort`);
      return { action: "cast_spell", who: e.who, spell: e.sort.trim() || "?", free: e.gratuit };
    case "opaque":
      return e.effet;
  }
}

/** Les citations d'une liste d'effets, par chemin : le même ordre que `brickPaths`. */
function passagesEffets(prefixe: string, liste: readonly BrouillonEffet[], sortie: Record<string, string>): void {
  liste.forEach((e, i) => {
    const p = `${prefixe}.${i}`;
    if (e.passage) sortie[p] = e.passage;
    if (e.type === "saving_throw") {
      passagesEffets(`${p}.on_fail`, e.echec, sortie);
      passagesEffets(`${p}.on_pass`, e.reussite, sortie);
    }
  });
}

/**
 * Le brouillon, prêt à envoyer : blocs validés par les schémas, effets qui
 * durent orphelins retirés (`pruneOrphanDurableEffects`). Ou la liste des
 * erreurs à montrer à l'auteur. Un bloc vide devient `null` (retiré) s'il
 * existait, sinon reste `null` (rien à envoyer : l'appelant ne l'inclut pas).
 */
export function brouillonVersBlocs(b: Brouillon, nomsEtats: Readonly<Record<string, string>>): ResultatBlocs {
  const ctx: CtxEcriture = { erreurs: [], durables: [], conserves: new Map(b.durablesConserves.map((d) => [d.id, d])), nomsEtats };

  const ressources = b.ressources.map((r, i) => {
    const nom = r.label.trim();
    if (nom === "") ctx.erreurs.push(`Ressource ${i + 1} : donne-lui un libellé`);
    return {
      key: r.key.trim() || cleDepuisLibelle(nom) || `ressource-${i + 1}`,
      label: localise(r.labelOrig, nom),
      max: formule(r.max, `Ressource ${nom || i + 1}, maximum`, ctx),
      recharge: r.recharge,
      ...(r.passage ? { passage: r.passage } : {}),
    };
  });

  const activations = b.activations.map((a, i) => {
    const nom = a.label.trim();
    const nomAct = `Utilisation ${nom || i + 1}`;
    if (nom === "") ctx.erreurs.push(`${nomAct} : donne-lui un libellé`);
    const passages: Record<string, string> = {};
    if (a.cout.passage) passages.cost = a.cout.passage;
    if (a.cibles.passage) passages.targets = a.cibles.passage;
    passagesEffets("effects", a.effets, passages);
    a.variantes.forEach((v, k) => passagesEffets(`variants.${k}.effects`, v.effets, passages));

    const nombre = a.cibles.nombre.trim();
    const portee = a.cibles.portee.trim();
    return {
      id: a.id,
      label: localise(a.labelOrig, nom),
      ...(a.requires ? { requires: a.requires } : {}),
      cost: coutEcrit(a.cout, `${nomAct}, coût`, ctx),
      targets: {
        kind: a.cibles.kind,
        ...(nombre !== "" ? { count: formule(nombre, `${nomAct}, nombre de cibles`, ctx) } : {}),
        ...(portee !== "" ? { range: { value: nombrePositif(portee, `${nomAct}, portée`, ctx), unit: "m" as const } } : {}),
        ...(a.cibles.doitVoir ? { must_see: true } : {}),
        ...(a.cibles.kind === "area" ? { area: zoneEcrite(a.cibles.zone, `${nomAct}, zone`, ctx) } : {}),
      },
      effects: a.effets.map((e, k) => effetEcrit(e, `${nomAct}, effet ${k + 1}`, a.id, ctx)),
      variants:
        a.variantes.length === 0
          ? null
          : a.variantes.map((v, k) => {
              const nomV = v.label.trim();
              if (nomV === "") ctx.erreurs.push(`${nomAct}, variante ${k + 1} : donne-lui un libellé`);
              return {
                id: v.id,
                label: localise(v.labelOrig, nomV),
                effects: v.effets.map((e, j) => effetEcrit(e, `${nomAct}, variante ${nomV || k + 1}, effet ${j + 1}`, a.id, ctx)),
                ...(v.cout ? { cost: coutEcrit(v.cout, `${nomAct}, variante ${nomV || k + 1}, coût`, ctx) } : {}),
                ...(v.operationsConservees && v.operationsConservees.length > 0 ? { roll_operations: v.operationsConservees } : {}),
              };
            }),
      ...(a.declencheur ? { trigger: declencheurEcrit(a.declencheur, `${nomAct}, déclencheur`, ctx) } : {}),
      ...(a.declencheur && a.operations.length > 0 ? { roll_operations: a.operations.map((o, k) => operationEcrite(o, `${nomAct}, opération ${k + 1}`, ctx)) } : {}),
      ...(conditionEcrite(a.quand) ? { when: conditionEcrite(a.quand) } : {}),
      ...(a.limite ? { limit: { per: a.limite } } : {}),
      ...(a.optionsLancement.length > 0
        ? { cast_options: a.optionsLancement.map((o, k) => optionLancementEcrite(o, `${nomAct}, option de lancement ${o.label.trim() || k + 1}`, ctx)) }
        : {}),
      ...(Object.keys(passages).length > 0 ? { passages } : {}),
    };
  });

  const lacunes = b.lacunes.map((g, i) => {
    if (g.texte.trim() === "" || g.manque.trim() === "") ctx.erreurs.push(`Passage non exprimable ${i + 1} : le texte et ce qui manque sont tous deux requis`);
    return { text: g.texte.trim() || "?", missing: g.manque.trim() || "?" };
  });

  const auras = b.auras.map((a, i) => auraEcrite(a, `Aura ${i + 1}`, ctx));
  const retouches = b.retouches.map((r, i) => retoucheEcrite(r, `Retouche ${i + 1}`, ctx));

  if (ctx.erreurs.length > 0) return { ok: false, erreurs: ctx.erreurs };

  let resources: RuleResourcesBlockData | null = null;
  if (ressources.length > 0) {
    const r = zRuleResourcesBlockData.safeParse({ resources: ressources });
    if (!r.success) return { ok: false, erreurs: [r.error.issues[0]?.message ?? "Ressources invalides."] };
    resources = r.data;
  }

  let activation: ActivationBlockData | null = null;
  if (activations.length > 0) {
    const r = zActivationBlockData.safeParse({ activations, durable_effects: ctx.durables });
    if (!r.success) return { ok: false, erreurs: [r.error.issues[0]?.message ?? "Utilisations invalides."] };
    activation = pruneOrphanDurableEffects(r.data);
  }

  let coverage: CoverageBlockData | null = null;
  if (lacunes.length > 0) {
    const r = zCoverageBlockData.safeParse({ gaps: lacunes });
    if (!r.success) return { ok: false, erreurs: [r.error.issues[0]?.message ?? "Passages invalides."] };
    coverage = r.data;
  }

  let modifiers: ModifiersBlockData | null = null;
  if (auras.length > 0 || retouches.length > 0 || b.modificateursConserves.length > 0) {
    const r = zModifiersBlockData.safeParse({
      modifiers: b.modificateursConserves,
      ...(auras.length > 0 ? { auras } : {}),
      ...(retouches.length > 0 ? { patches: retouches } : {}),
    });
    if (!r.success) return { ok: false, erreurs: [r.error.issues[0]?.message ?? "Auras ou retouches invalides."] };
    modifiers = r.data;
  }
  return { ok: true, resources, activation, coverage, modifiers };
}

/** Le corps du PUT : absent = inchangé, `null` = retiré (seulement si le bloc existait). */
export function corpsEnregistrement(
  b: Brouillon,
  blocs: { resources: RuleResourcesBlockData | null; activation: ActivationBlockData | null; coverage: CoverageBlockData | null; modifiers?: ModifiersBlockData | null }
): { resources?: RuleResourcesBlockData | null; activation?: ActivationBlockData | null; coverage?: CoverageBlockData | null; modifiers?: ModifiersBlockData | null } {
  const corps: { resources?: RuleResourcesBlockData | null; activation?: ActivationBlockData | null; coverage?: CoverageBlockData | null; modifiers?: ModifiersBlockData | null } = {};
  // `modifiers` n'est envoyé que si les auras ou retouches ont changé ; le bloc part entier (sa liste de modificateurs reste telle quelle).
  if (signatureAuras(b) !== b.signatureAuras) {
    if (blocs.modifiers) corps.modifiers = blocs.modifiers;
    else if (b.existait.modifiers) corps.modifiers = null;
  }
  if (blocs.resources || b.existait.resources) corps.resources = blocs.resources;
  if (blocs.activation || b.existait.activation) corps.activation = blocs.activation;
  if (blocs.coverage || b.existait.coverage) corps.coverage = blocs.coverage;
  return corps;
}

// --- Citations et surlignage -------------------------------------------------

export type FamilleSurlignage = "cout" | "cibles" | "sauvegarde" | "etat" | "autre" | "lacune";

export interface Surlignage {
  /** Identifiant d'écran de la brique citante (jamais enregistré). */
  uid: string;
  texte: string;
  famille: FamilleSurlignage;
}

function famille(e: BrouillonEffet): FamilleSurlignage {
  if (e.type === "saving_throw") return "sauvegarde";
  if (e.type === "apply_state" || e.type === "apply_boost" || e.type === "apply_condition" || e.type === "existing_durable") return "etat";
  return "autre";
}

/** Toutes les citations du brouillon, pour surligner le texte de la règle. */
export function surlignagesDuBrouillon(b: Brouillon): Surlignage[] {
  const sortie: Surlignage[] = [];
  const ajouter = (uid: string, texte: string | null, f: FamilleSurlignage) => {
    if (texte) sortie.push({ uid, texte, famille: f });
  };
  const effets = (liste: readonly BrouillonEffet[]) => {
    for (const e of liste) {
      ajouter(e.uid, e.passage, famille(e));
      if (e.type === "saving_throw") {
        effets(e.echec);
        effets(e.reussite);
      }
    }
  };
  for (const r of b.ressources) ajouter(r.uid, r.passage, "cout");
  for (const a of b.activations) {
    ajouter(`${a.uid}:cout`, a.cout.passage, "cout");
    ajouter(`${a.uid}:cibles`, a.cibles.passage, "cibles");
    effets(a.effets);
    for (const v of a.variantes) effets(v.effets);
  }
  for (const g of b.lacunes) ajouter(g.uid, g.texte, "lacune");
  return sortie;
}

export interface Fragment {
  texte: string;
  /** La brique à laquelle le fragment est surligné ; absent pour le texte courant. */
  surlignage?: Surlignage;
}

function motif(texte: string): RegExp | null {
  const mots = texte.trim().split(/\s+/).filter((m) => m !== "");
  if (mots.length === 0) return null;
  return new RegExp(mots.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"));
}

/**
 * Découpe le texte de la règle en fragments, surlignés là où une citation
 * l'atteint (espaces et retours à la ligne indifférents). Deux citations qui
 * se recouvrent : la première dans le texte l'emporte, l'autre n'est pas
 * surlignée (elle reste enregistrée).
 */
export function decouperTexte(texte: string, surlignages: readonly Surlignage[]): Fragment[] {
  const trouves = surlignages
    .map((s) => {
      const m = motif(s.texte)?.exec(texte);
      return m ? { s, debut: m.index, fin: m.index + m[0].length } : null;
    })
    .filter((x): x is { s: Surlignage; debut: number; fin: number } => x !== null)
    .sort((a, b) => a.debut - b.debut);

  const fragments: Fragment[] = [];
  let curseur = 0;
  for (const t of trouves) {
    if (t.debut < curseur) continue;
    if (t.debut > curseur) fragments.push({ texte: texte.slice(curseur, t.debut) });
    fragments.push({ texte: texte.slice(t.debut, t.fin), surlignage: t.s });
    curseur = t.fin;
  }
  if (curseur < texte.length) fragments.push({ texte: texte.slice(curseur) });
  return fragments;
}

/** Une sélection du navigateur, nettoyée pour servir de citation (espaces compactés, bornée à 2000 caractères) ; `null` si vide. */
export function citationDepuisSelection(brut: string): string | null {
  const t = brut.replace(/\s+/g, " ").trim();
  return t === "" ? null : t.slice(0, 2000);
}

// --- Aperçu du bouton --------------------------------------------------------

export interface ApercuBouton {
  libelle: string;
  action: TypeAction;
  depenses: BrouillonDepense[];
  nombre: string;
  portee: string;
  genre: GenreCible;
  sauvegardes: { ability: string; dc: string }[];
}

function sauvegardesDe(liste: readonly BrouillonEffet[]): { ability: string; dc: string }[] {
  return liste.flatMap((e) => (e.type === "saving_throw" ? [{ ability: e.ability, dc: e.dc }, ...sauvegardesDe(e.echec), ...sauvegardesDe(e.reussite)] : []));
}

export function apercuBouton(a: BrouillonActivation): ApercuBouton {
  return {
    libelle: a.label.trim(),
    action: a.cout.action,
    depenses: a.cout.depenses,
    nombre: a.cibles.nombre.trim(),
    portee: a.cibles.portee.trim(),
    genre: a.cibles.kind,
    sauvegardes: sauvegardesDe(a.effets),
  };
}

// --- Écran : drapeaux --------------------------------------------------------

/** « Rendre jouable » (aucun bloc encore) ou « Modifier les briques ». */
export function aDesBriques(blocs: readonly { blockType: string }[]): boolean {
  return blocs.some((b) => b.blockType === "resources" || b.blockType === "activation" || b.blockType === "coverage");
}

/** Le texte de la règle (blocs `description`), paragraphes séparés par une ligne vide. */
export function texteDeLaRegle(blocs: readonly { blockType: string; data: unknown }[]): string {
  return blocs
    .filter((b) => b.blockType === "description")
    .flatMap((b) => ((b.data as { segments?: { text?: unknown }[] }).segments ?? []).map((s) => (typeof s.text === "string" ? s.text : "")))
    .filter((t) => t.trim() !== "")
    .join("\n\n");
}

/** Les numéros affichés des effets d'une activation (« 1, 2, 3 » à travers les branches), dans l'ordre de lecture. */
export function numeroterEffets(listes: readonly (readonly BrouillonEffet[])[]): Map<string, number> {
  const numeros = new Map<string, number>();
  let n = 0;
  const parcourir = (liste: readonly BrouillonEffet[]) => {
    for (const e of liste) {
      n += 1;
      numeros.set(e.uid, n);
      if (e.type === "saving_throw") {
        parcourir(e.echec);
        parcourir(e.reussite);
      }
    }
  };
  listes.forEach(parcourir);
  return numeros;
}
