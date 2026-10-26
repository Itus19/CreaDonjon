/**
 * V3.1-79 — noyau pur de la Fiche de créature (A). Le bloc `statblock` porte
 * des valeurs PLATES saisies à la main : seuls les modificateurs (règle 16),
 * la maîtrise et la perception passive se calculent ici, jamais stockés. Le
 * reste est de la lecture de texte : vitesses, jets d'une attaque, recharge.
 * Aucun nombre aléatoire (règle 8) : les formules ne servent qu'à pré-remplir
 * l'outil de dés, c'est le serveur qui lance.
 */

import { z } from "zod";
import { DIE_TYPES, type DieType } from "@/src/core/dice/roll";
import type { BlockAbility } from "@/src/core/schemas/blocks/abilities";
import type { StatblockBlockData } from "@/src/core/schemas/blocks/statblock";

export const CARACTERISTIQUES: readonly BlockAbility[] = ["str", "dex", "con", "int", "wis", "cha"];

/** Le modificateur d'une valeur de caractéristique : FOR 19 donne +4. Jamais stocké. */
export function modificateur(valeur: number): number {
  return Math.floor((valeur - 10) / 2);
}

/** « +4 », « -1 », « +0 ». */
export function signe(n: number): string {
  return `${n >= 0 ? "+" : "-"}${Math.abs(n)}`;
}

// ---- le facteur de puissance --------------------------------------------------

const FP_NUM: Record<string, number> = { "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 };

/** « 8 », « 1/4 », « 1/2 » : la valeur numérique, ou `null` si le champ est vide ou illisible. */
export function valeurFp(fp: string | undefined): number | null {
  const brut = (fp ?? "").trim();
  if (brut === "") return null;
  if (brut in FP_NUM) return FP_NUM[brut]!;
  return /^\d+$/.test(brut) && Number(brut) <= 30 ? Number(brut) : null;
}

/** PX d'une créature du FP donné (tableau du SRD, 0 à 30). Dérivé, jamais saisi. */
const XP_PAR_FP: Record<string, number> = {
  "0": 10, "0.125": 25, "0.25": 50, "0.5": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300,
  "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
  "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

export function xpDuFp(fp: string | undefined): number | null {
  const v = valeurFp(fp);
  return v === null ? null : (XP_PAR_FP[String(v)] ?? null);
}

/** Bonus de maîtrise selon le FP : +2 jusqu'au FP 4, puis +1 tous les quatre FP. */
export function bonusMaitrise(fp: string | undefined): number | null {
  const v = valeurFp(fp);
  return v === null ? null : 2 + Math.max(0, Math.ceil(v / 4) - 1);
}

/** « 3 900 » : espace insécable entre les milliers, sans dépendre de l'ICU du navigateur. */
export function formaterNombre(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ---- les vitesses ---------------------------------------------------------------

const MOTS_DEPLACEMENT = /^(vol|voler|nage|nager|escalade|escalader|creusement|creuser|fly|flying|swim|climb|burrow)\b/i;

export interface Vitesses {
  /** La vitesse de marche, telle que saisie (« 12 m »). Vide si la saisie n'en a pas. */
  principale: string;
  /** Les autres déplacements, chacun tel que saisi (« vol 24 m »). */
  autres: string[];
}

/** « 12 m, vol 24 m, nage 12 m » : la marche d'un côté, le reste dessous. */
export function lireVitesses(speed: string): Vitesses {
  const morceaux = speed
    .split(/[,;]/)
    .map((m) => m.trim())
    .filter((m) => m !== "");
  const autres = morceaux.filter((m) => MOTS_DEPLACEMENT.test(m));
  const marche = morceaux.filter((m) => !MOTS_DEPLACEMENT.test(m));
  return { principale: marche[0] ?? "", autres };
}

// ---- la perception passive -----------------------------------------------------

/** 10 + le bonus de Perception saisi, sinon 10 + le modificateur de Sagesse. */
export function perceptionPassive(data: { abilities: { wis: number }; skills?: Record<string, number> }): number {
  return 10 + (data.skills?.perception ?? modificateur(data.abilities.wis));
}

// ---- lire une capacité dans son texte ------------------------------------------

export interface RechargeLue {
  min: number;
  max: number;
  /** « 5–6 », ou « 6 ». */
  libelle: string;
}

/** « (Recharge 5–6) », « recharge 6 » : la plage du d6. `null` si le texte n'en parle pas. */
export function lireRecharge(texte: string): RechargeLue | null {
  const m = /recharge\s*(\d)(?:\s*[–—-]\s*(\d))?/i.exec(texte);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : min;
  if (min < 1 || max > 6 || min > max) return null;
  return { min, max, libelle: min === max ? String(min) : `${min}–${max}` };
}

export interface JetsLus {
  /** Bonus d'attaque (« +7 pour toucher »). */
  toucher?: number;
  /** Les formules de dégâts, dans l'ordre du texte (« 2d6+4 », « 2d6 »). */
  degats: string[];
  /** Le DD d'un jet de sauvegarde imposé. */
  dd?: number;
}

/** Ce qu'un texte d'action permet de lancer. Tout ce qui n'est pas reconnu reste du texte. */
export function lireJets(texte: string): JetsLus {
  const jets: JetsLus = { degats: [] };
  const toucher =
    /([+-]\s?\d+)\s*(?:pour toucher|to hit)/i.exec(texte) ??
    /(?:jet d'attaque|attack roll)\s*:?\s*([+-]\s?\d+)/i.exec(texte);
  if (toucher) jets.toucher = Number(toucher[1]!.replace(/\s/g, ""));
  const dd = /\b(?:DD|DC)\s*(\d+)/.exec(texte);
  if (dd) jets.dd = Number(dd[1]);
  for (const m of texte.matchAll(/\d+d\d+(?:\s*[+-]\s*\d+)?/gi)) jets.degats.push(m[0].replace(/\s/g, ""));
  return jets;
}

// ---- les sections d'actions ------------------------------------------------------

export interface EntreeAction {
  name: string;
  text: string;
  jets: JetsLus;
  recharge: RechargeLue | null;
}

export type CleSection = "attaques" | "capacites" | "reactions" | "legendaires";

export interface SectionActions {
  cle: CleSection;
  entrees: EntreeAction[];
}

const MULTIATTAQUE = /multiattaque|attaques? multiples?|multiattack/i;

function entree(e: { name: string; text: string }): EntreeAction {
  return { name: e.name, text: e.text, jets: lireJets(e.text), recharge: lireRecharge(`${e.name} ${e.text}`) };
}

/**
 * « Attaques » (un bonus pour toucher, ou la multiattaque), « Capacités » (le
 * reste des actions), « Réactions » (toujours là : « Aucune » quand elle est
 * vide), « Actions légendaires » (seulement si présentes). Ordre du bloc gardé
 * dans chaque section.
 */
export function sectionsActions(donnees: {
  actions: { name: string; text: string }[];
  reactions: { name: string; text: string }[];
  legendary_actions: { name: string; text: string }[];
}): SectionActions[] {
  const toutes = donnees.actions.map(entree);
  const attaques = toutes.filter((e) => e.jets.toucher !== undefined || MULTIATTAQUE.test(e.name));
  const capacites = toutes.filter((e) => !attaques.includes(e));
  const sections: SectionActions[] = [];
  if (attaques.length > 0) sections.push({ cle: "attaques", entrees: attaques });
  if (capacites.length > 0) sections.push({ cle: "capacites", entrees: capacites });
  sections.push({ cle: "reactions", entrees: donnees.reactions.map(entree) });
  if (donnees.legendary_actions.length > 0) sections.push({ cle: "legendaires", entrees: donnees.legendary_actions.map(entree) });
  return sections;
}

/** Les actions de base de tout personnage et de toute créature (SRD 2024), en clés ; les libellés vivent dans `messages/`. */
export const ACTIONS_DE_BASE = ["attack", "dash", "disengage", "dodge", "help", "hide", "influence", "magic", "ready", "search", "study", "utilize"] as const;

/** Les capacités à recharge : « Ce qui se recharge » n'existe que s'il y en a. */
export function capacitesARecharge(sections: SectionActions[]): (EntreeAction & { recharge: RechargeLue })[] {
  return sections
    .flatMap((s) => s.entrees)
    .filter((e): e is EntreeAction & { recharge: RechargeLue } => e.recharge !== null);
}

// ---- ce que chaque pastille envoie à l'outil de dés ----------------------------

/** La partie de `PreReglage` qu'une pastille fournit : le libellé, les dés, le modificateur. Le serveur lance. */
export interface JetPastille {
  label: string;
  dice: Partial<Record<DieType, number>>;
  modifier: number;
}

/** Un d20 plus un modificateur : test, sauvegarde, compétence, initiative, attaque. */
export function jetD20(label: string, mod: number): JetPastille {
  return { label, dice: { d20: 1 }, modifier: mod };
}

const DES_PERMIS = new Set<string>(DIE_TYPES);

/**
 * Plusieurs formules de dégâts (« 2d6+4 » et « 2d6 ») en UN seul jet : les dés
 * de même type s'additionnent, les modificateurs aussi. Un dé inconnu est
 * ignoré ; un jet vide donne un d6 (jamais un résultat, juste un point de départ).
 */
export function jetDegats(label: string, formules: readonly string[]): JetPastille {
  const dice: Partial<Record<DieType, number>> = {};
  let mod = 0;
  for (const f of formules) {
    const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(f.replace(/\s/g, ""));
    if (!m) continue;
    const faces = `d${m[2]}`;
    if (!DES_PERMIS.has(faces)) continue;
    const de = faces as DieType;
    dice[de] = Math.min(20, (dice[de] ?? 0) + Number(m[1]));
    mod += m[3] ? Number(m[3]) : 0;
  }
  if (Object.keys(dice).length === 0) return { label, dice: { d6: 1 }, modifier: 0 };
  return { label, dice, modifier: mod };
}

// ---- hors combat, en combat ----------------------------------------------------

export interface InstanceCombat {
  participantId: string;
  label: string;
  hpCurrent: number;
  hpMax: number;
  tempHp: number;
  conditions: string[];
}

export interface CombatCreature {
  campaignId: string;
  combatId: string;
  instances: InstanceCombat[];
}

const zInstance = z.object({
  participantId: z.string(),
  label: z.string(),
  hpCurrent: z.number(),
  hpMax: z.number(),
  tempHp: z.number(),
  conditions: z.array(z.string()),
});
const zReponseCombat = z.object({
  combat: z
    .object({ campaignId: z.string(), combatId: z.string(), instances: z.array(zInstance) })
    .nullable(),
});

/** La réponse de `creature-combat` : `null` (hors combat, joueur, réponse illisible ou sans instance) ou le combat. */
export function lireCombat(corps: unknown): CombatCreature | null {
  const lu = zReponseCombat.safeParse(corps);
  if (!lu.success || !lu.data.combat || lu.data.combat.instances.length === 0) return null;
  return lu.data.combat;
}

export type ModeFiche = "hors-combat" | "en-combat";

export function modeFiche(combat: CombatCreature | null): ModeFiche {
  return combat === null ? "hors-combat" : "en-combat";
}

/** L'instance choisie, sinon la première (une instance disparue du combat ne laisse jamais la fiche sans jauge). */
export function instanceChoisie(combat: CombatCreature, participantId: string | null): InstanceCombat {
  return combat.instances.find((i) => i.participantId === participantId) ?? combat.instances[0]!;
}

/** Les PV après un écart, bornés à 0 et au maximum : l'instance attend une valeur, pas un écart. */
export function pvApresEcart(instance: Pick<InstanceCombat, "hpCurrent" | "hpMax">, ecart: number): number {
  return Math.max(0, Math.min(instance.hpMax, instance.hpCurrent + ecart));
}

// ---- la taille en abrégé ----------------------------------------------------------

const TAILLES: [RegExp, string][] = [
  [/^(très petite|tres petite|tiny)/i, "TP"],
  [/^(petite|small)/i, "P"],
  [/^(moyenne|medium)/i, "M"],
  [/^(grande|large)/i, "G"],
  [/^(très grande|tres grande|huge)/i, "TG"],
  [/^(gigantesque|gargantuan)/i, "Gig."],
];

/** « Grande » donne « G » (la tuile de taille tient en quatre colonnes) ; une taille inconnue reste telle que saisie. */
export function tailleCourte(taille: string): string {
  const brut = taille.trim();
  // « Très grande » commence par « Très » : on teste les deux mots avant le mot seul.
  for (const [motif, court] of [...TAILLES].sort((a, b) => b[0].source.length - a[0].source.length)) {
    if (motif.test(brut)) return court;
  }
  return brut === "" ? "—" : brut;
}

/**
 * Les noms du sélecteur d'instance : « Gobelin ×4 » ajoutés depuis la même
 * fiche portent tous le même nom ; on les numérote dans l'ordre pour savoir
 * laquelle on règle. Un nom unique reste tel quel.
 */
export function libellesInstances(instances: readonly { participantId: string; label: string }[]): { value: string; label: string }[] {
  const total = new Map<string, number>();
  for (const i of instances) total.set(i.label, (total.get(i.label) ?? 0) + 1);
  const vus = new Map<string, number>();
  return instances.map((i) => {
    if ((total.get(i.label) ?? 0) < 2) return { value: i.participantId, label: i.label };
    const rang = (vus.get(i.label) ?? 0) + 1;
    vus.set(i.label, rang);
    return { value: i.participantId, label: `${i.label} · ${rang}` };
  });
}

// ---- le repaire et les défenses (V3.1-147) ---------------------------------------

export type CleDefense = "damage_immunities" | "damage_resistances" | "damage_vulnerabilities" | "condition_immunities";
export const CLES_DEFENSES: readonly CleDefense[] = ["damage_immunities", "damage_resistances", "damage_vulnerabilities", "condition_immunities"];

type Defenses = NonNullable<StatblockBlockData["defenses"]>;

/** Le bloc avec ces défenses ; aucune liste non vide : la clé `defenses` disparaît (jamais `undefined` écrit). */
function avecDefenses(data: StatblockBlockData, defenses: Defenses): StatblockBlockData {
  const { defenses: _ancien, ...reste } = data;
  void _ancien;
  const gardees = Object.fromEntries(Object.entries(defenses).filter(([, l]) => Array.isArray(l) && l.length > 0)) as Defenses;
  return Object.keys(gardees).length > 0 ? { ...reste, defenses: gardees } : reste;
}

/** Ajoute une valeur à une liste : espaces rognés, chaîne vide et doublon (sans tenir compte de la casse) refusés. */
export function ajouterDefense(data: StatblockBlockData, cle: CleDefense, saisie: string): StatblockBlockData {
  const valeur = saisie.trim();
  const liste = data.defenses?.[cle] ?? [];
  if (valeur === "" || liste.some((v) => v.toLowerCase() === valeur.toLowerCase())) return data;
  return avecDefenses(data, { ...data.defenses, [cle]: [...liste, valeur] });
}

/** Retire une valeur ; une liste vidée supprime sa clé, des défenses vides la leur. */
export function retirerDefense(data: StatblockBlockData, cle: CleDefense, valeur: string): StatblockBlockData {
  const liste = data.defenses?.[cle];
  if (!liste) return data;
  return avecDefenses(data, { ...data.defenses, [cle]: liste.filter((v) => v !== valeur) });
}

/** Le repaire : `null` supprime la clé `lair`. */
export function definirRepaire(data: StatblockBlockData, id: string | null): StatblockBlockData {
  const { lair: _ancien, ...reste } = data;
  void _ancien;
  return id === null ? reste : { ...reste, lair: { kind: "entity", id } };
}
