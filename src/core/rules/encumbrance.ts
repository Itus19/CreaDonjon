import { SKILLS, SKILL_ABILITIES, type Ability } from "./abilities";
import type { Modifier } from "./sheet";
import type { InventoryItem } from "../schemas/blocks/inventory";
import type { EncumbranceRules } from "../schemas/rule-blocks/characterRules";

/**
 * Charge d'un personnage (V3.1-115) : les seuils viennent des règles de
 * personnage du ruleset (`character_rules.encumbrance`), jamais d'une
 * constante. En livres, unité native du SRD (l'écran convertit en kg).
 *
 * Capacité = FOR × `capacity_per_strength_lb`. Chaque palier s'applique
 * « en excès de » FOR × `above_per_strength_lb` (strictement) : le premier
 * rend « encombré », les suivants « lourdement encombré ». Règle 2024 : aucun
 * palier. Variante de 2014 : × 5 (vitesse −10) et × 10 (vitesse −20,
 * désavantage aux jets de FOR, DEX, CON).
 */
export type EncumbranceTier = "none" | "encumbered" | "heavily_encumbered";

export interface EncumbranceResult {
  carried: number;
  capacity: number;
  tier: EncumbranceTier;
  speedPenalty: number;
  disadvantageAbilities: readonly Ability[];
}

export function computeEncumbrance(strScore: number, carried: number, rules: EncumbranceRules): EncumbranceResult {
  const capacity = strScore * rules.capacity_per_strength_lb;
  const tiers = [...rules.tiers].sort((a, b) => a.above_per_strength_lb - b.above_per_strength_lb);
  let reached = -1;
  tiers.forEach((tier, index) => {
    if (carried > strScore * tier.above_per_strength_lb) reached = index;
  });
  if (reached < 0) return { carried, capacity, tier: "none", speedPenalty: 0, disadvantageAbilities: [] };
  const tier = tiers[reached];
  return {
    carried,
    capacity,
    tier: reached === 0 ? "encumbered" : "heavily_encumbered",
    speedPenalty: tier.speed_penalty_ft,
    disadvantageAbilities: tier.disadvantage,
  };
}

/**
 * Traduit un `EncumbranceResult` en modificateurs (couche 6, meme couche que
 * l'armure — l'encombrement est une consequence de l'equipement porte) :
 * penalite de vitesse, et desavantage sur les sauvegardes et competences
 * gouvernees par une caracteristique en `disadvantageAbilities`.
 */
export function encumbranceModifiers(result: EncumbranceResult, source: string, label: string): Modifier[] {
  const modifiers: Modifier[] = [];
  if (result.speedPenalty > 0) {
    modifiers.push({ target: "speed", op: "add", value: -result.speedPenalty, layer: 6, source, label });
  }
  for (const ability of result.disadvantageAbilities) {
    modifiers.push({ target: `save.${ability}`, op: "disadvantage", layer: 6, source, label });
    // V3.1-46 : le jet de caractéristique lui-même (les compétences le lisent aussi).
    modifiers.push({ target: `check.${ability}`, op: "disadvantage", layer: 6, source, label });
  }
  for (const skill of SKILLS) {
    if (result.disadvantageAbilities.includes(SKILL_ABILITIES[skill])) {
      modifiers.push({ target: `skill.${skill}`, op: "disadvantage", layer: 6, source, label });
    }
  }
  return modifiers;
}

const LB_TO_KG = 0.45359237;

/**
 * Conversion d'affichage uniquement (UI, unite kg demandee par l'utilisateur)
 * — le calcul interne (`computeEncumbrance`) reste en livres, unite native
 * de la formule SRD (FOR x 15) : convertir les seuils eux-memes en kg
 * n'aurait rien change au resultat, mais aurait introduit un risque
 * d'arrondi dans le moteur pour aucun benefice. Arrondi a une decimale.
 */
export function lbToKg(lb: number): number {
  return Math.round(lb * LB_TO_KG * 10) / 10;
}

/**
 * Inverse de `lbToKg` — l'AUTEUR (formulaire de creation d'arme maison,
 * V2, retour utilisateur : "le poids dans les armes maison est en livres,
 * il faut que ce soit en kg") saisit un poids en kg, comme partout ailleurs
 * dans l'interface ; la donnee stockee reste en livres (meme raison que
 * `lbToKg` : unite native SRD, coherence avec `totalCarriedWeight` qui
 * somme des poids d'armes SRD et maison sans jamais convertir).
 */
export function kgToLb(kg: number): number {
  return Math.round((kg / LB_TO_KG) * 100) / 100;
}

const FT_TO_M = 0.3048;

/**
 * Meme principe que `lbToKg` (conversion d'affichage uniquement, V1-D7 sur
 * retour utilisateur : "il faudrait que les poids soient en kilogramme...
 * pareil pour les mesures de distances"). La portee d'une arme
 * (`weapon.range`, zQuantity) reste stockee en pieds (unite native du SRD) ;
 * seul l'affichage passe en metres. Arrondi a une decimale.
 */
export function ftToM(ft: number): number {
  return Math.round(ft * FT_TO_M * 10) / 10;
}

/** Inverse de `ftToM`, meme raison que `kgToLb` — saisie en metres (portee d'arme maison), stockage en pieds. */
export function mToFt(m: number): number {
  return Math.round((m / FT_TO_M) * 10) / 10;
}

/**
 * Poids total porte : pour un objet de reference de regle, le poids vient
 * de `weightByKey` (resolu cote serveur/client depuis la fiche de regle,
 * `parseItemWeight`) ; pour un objet en ligne, son propre champ `weight`.
 * 0 si non resolu ou non renseigne — jamais une erreur, jamais une
 * estimation devinee.
 */
export function totalCarriedWeight(items: readonly InventoryItem[], weightByKey: Record<string, number | null>): number {
  let total = 0;
  for (const item of items) {
    const ref = (item as { ref?: { kind: "rule"; key: string } }).ref;
    const unitWeight = ref ? (weightByKey[ref.key] ?? 0) : ((item as { weight?: { value: number } }).weight?.value ?? 0);
    total += unitWeight * item.qty;
  }
  return total;
}
