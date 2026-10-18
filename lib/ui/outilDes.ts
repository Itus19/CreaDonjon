import { DIE_TYPES, type DieType } from "@/src/core/dice/roll";
import type { AdvantagePair } from "@/src/core/dice/diceTool";
import type { DiceGroup, RollChip } from "@/src/core/dice/parseRollDetail";
import type { AdvantageState } from "@/src/core/rules/action";
import type { Ability, Skill } from "@/src/core/rules/sheet";

/**
 * Logique pure de l'outil de dés unique (V3.1-33) : l'état de la réserve, ce
 * que le préréglage verrouille, le nombre de carrés vides attendus, la
 * bande d'après-jet. Rien ici n'est aléatoire ni ne calcule un résultat : le
 * serveur lance (règle 8), l'écran ne fait que décrire le jet et lire la réponse.
 */

export type Reserve = Record<DieType, number>;

/** Plafond par type de dé : celui de la route (`lib/diceRolls/schemas.ts`). */
export const MAX_PAR_TYPE = 20;
export const MODIFICATEUR_MIN = -99;
export const MODIFICATEUR_MAX = 99;
export const DD_MIN = 1;
export const DD_MAX = 50;
/** Valeur de départ quand on touche ▲ ou ▼ sur un DD vide. */
export const DD_DEPART = 10;

export function reserveVide(): Reserve {
  return { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 };
}

/** « Jet libre » : un d20, sans modificateur. */
export function reserveLibre(): Reserve {
  return { ...reserveVide(), d20: 1 };
}

export function reserveDepuis(dice: Partial<Record<DieType, number>>): Reserve {
  const reserve = reserveVide();
  for (const type of DIE_TYPES) reserve[type] = Math.max(0, Math.min(MAX_PAR_TYPE, Math.trunc(dice[type] ?? 0)));
  return reserve;
}

/** Toucher un dé de la grille : +1, dans la limite de la route. */
export function ajouterDe(reserve: Reserve, type: DieType): Reserve {
  return { ...reserve, [type]: Math.min(MAX_PAR_TYPE, reserve[type] + 1) };
}

export function totalDes(reserve: Reserve): number {
  return DIE_TYPES.reduce((n, type) => n + reserve[type], 0);
}

/** L'avantage ne s'applique qu'à un jet qui contient exactement un d20 (sinon on ne saurait pas lequel doubler). */
export function avantagePossible(reserve: Reserve): boolean {
  return reserve.d20 === 1;
}

/** L'avantage choisi, ramené à « normal » quand la réserve ne le permet plus. */
export function avantageEffectif(reserve: Reserve, avantage: AdvantageState): AdvantageState {
  return avantagePossible(reserve) ? avantage : "normal";
}

/** Les faces de chaque carré attendu au prochain jet : un d20 avec avantage en occupe deux. */
export function facesAttendues(reserve: Reserve, avantage: AdvantageState): number[] {
  const faces: number[] = [];
  for (const type of DIE_TYPES) {
    const nombre = type === "d20" && avantageEffectif(reserve, avantage) !== "normal" ? 2 : reserve[type];
    for (let i = 0; i < nombre; i++) faces.push(Number(type.slice(1)));
  }
  return faces;
}

/** Nombre de carrés vides de la zone de résultat avant le lancer (deux pour un d20 avec avantage). */
export function carresAttendus(reserve: Reserve, avantage: AdvantageState): number {
  return facesAttendues(reserve, avantage).length;
}

/** Un carré vide attendu : un dé, ou la paire étiquetée d'un d20 avec avantage ou désavantage. */
export type Emplacement = { type: "de"; faces: number } | { type: "paire"; mode: "advantage" | "disadvantage" };

/** Les emplacements de la zone de résultat avant le lancer, dans l'ordre de la grille. */
export function emplacementsAttendus(reserve: Reserve, avantage: AdvantageState): Emplacement[] {
  const effectif = avantageEffectif(reserve, avantage);
  const emplacements: Emplacement[] = [];
  for (const type of DIE_TYPES) {
    if (type === "d20" && effectif !== "normal") {
      emplacements.push({ type: "paire", mode: effectif });
      continue;
    }
    for (let i = 0; i < reserve[type]; i++) emplacements.push({ type: "de", faces: Number(type.slice(1)) });
  }
  return emplacements;
}

export function peutLancer(reserve: Reserve): boolean {
  return totalDes(reserve) > 0;
}

/** Le titre de l'outil : le nom du bouton touché, ou « Jet libre ». */
export function titreOutil(libelle: string | null | undefined, libelleJetLibre: string): string {
  const propre = libelle?.trim();
  return propre ? propre : libelleJetLibre;
}

// ---- modificateur et DD ------------------------------------------------------

export function pasModificateur(modificateur: number, sens: 1 | -1): number {
  return Math.max(MODIFICATEUR_MIN, Math.min(MODIFICATEUR_MAX, modificateur + sens));
}

/** « +3 », « -1 », « 0 » : le signe explicite pour un modificateur positif. */
export function formaterModificateur(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** ▲ ou ▼ sur le DD : un DD vide part de 10 ; les bornes sont celles de la route. */
export function pasDd(dd: number | null, sens: 1 | -1): number {
  if (dd === null) return DD_DEPART;
  return Math.max(DD_MIN, Math.min(DD_MAX, dd + sens));
}

/** La saisie du DD : chiffres seulement, vide ou zéro = pas de DD, plafonné à 50. */
export function ddDepuisSaisie(saisie: string): number | null {
  const chiffres = saisie.replace(/[^0-9]/g, "").slice(0, 2);
  if (chiffres === "") return null;
  const valeur = Number(chiffres);
  if (valeur < DD_MIN) return null;
  return Math.min(DD_MAX, valeur);
}

// ---- préréglage --------------------------------------------------------------

/** Le test de la fiche que « Lancer » demande au serveur (la grille et le modificateur sont alors verrouillés). */
export type ActionFiche =
  | { kind: "ability"; entityId: string; ability: Ability }
  | { kind: "skill"; entityId: string; skill: Skill }
  | { kind: "save"; entityId: string; ability: Ability }
  | { kind: "initiative"; entityId: string };

/** Réponse du serveur à un jet (`RollOutcome`, checkRolls.ts) — la partie que l'écran lit. */
export interface SortieJet {
  who: string;
  what: string;
  chips: RollChip[];
  total: number;
  dc: number | null;
  verdict: "success" | "fail" | null;
  hidden: boolean;
  trace: { text: string; value: number }[];
  pair: AdvantagePair | null;
  naturalD20: number | null;
  dcPrivate: boolean;
}

/** Un `lancer` qui échoue avec un message à AFFICHER dans l'outil (réponse du serveur, par exemple). */
export class ErreurLancer extends Error {}

export interface PreReglage {
  label: string;
  dice: Partial<Record<DieType, number>>;
  modifier: number;
  advantage?: AdvantageState;
  secret?: boolean;
  action?: ActionFiche;
  /** Points d'Inspiration héroïque de la fiche : au moins 1 ouvre la bande « Relancer » après un échec. */
  inspiration?: number;
  /** Appelé après une relance payée (la fiche se recharge). */
  apresRelance?: () => void;
  /**
   * V3.1-36 : un jet qui n'a pas de route de jet à lui (le tour solo). « Lancer »
   * l'appelle à la place d'une route : le serveur lance et encaisse, la fonction
   * rend de quoi afficher le jet. Grille, modificateur, avantage et DD sont alors
   * figés (ils le sont dans la demande). Échec : `null`, ou une `ErreurLancer`.
   */
  lancer?: () => Promise<SortieJet | null>;
  /** Avec `lancer` : le DD posé par la demande, affiché figé avant le lancer (`null` : aucun, ou une CA que le serveur lit). */
  dc?: number | null;
}

/** Ce que la fiche montre de son test avant le lancer. */
export interface ApercuFiche {
  label: string;
  modifier: number;
  inspiration?: number;
  apresRelance?: () => void;
}

export function preReglageDepuisFiche(action: ActionFiche, advantage: AdvantageState, apercu: ApercuFiche): PreReglage {
  return {
    label: apercu.label,
    dice: { d20: 1 },
    modifier: apercu.modifier,
    advantage,
    action,
    inspiration: apercu.inspiration,
    apresRelance: apercu.apresRelance,
  };
}

/** La route de la fiche pour un test (`app/api/entities/[id]/actions/...`). */
export function cheminAction(action: ActionFiche): "ability-check" | "skill-check" | "saving-throw" | "initiative-check" {
  switch (action.kind) {
    case "ability":
      return "ability-check";
    case "skill":
      return "skill-check";
    case "save":
      return "saving-throw";
    case "initiative":
      return "initiative-check";
  }
}

/** La partie propre au test dans le corps de la requête (`ability`, `skill`, ou rien pour l'initiative). */
export function corpsAction(action: ActionFiche): { ability: Ability } | { skill: Skill } | Record<string, never> {
  if (action.kind === "ability" || action.kind === "save") return { ability: action.ability };
  if (action.kind === "skill") return { skill: action.skill };
  return {};
}

export type TestRelancable = { kind: "ability"; ability: Ability } | { kind: "skill"; skill: Skill } | { kind: "save"; ability: Ability };

/** Le champ `check` de `heroic-reroll` ; `null` pour une initiative (qui ne se relance pas). */
export function testARelancer(action: ActionFiche | undefined): TestRelancable | null {
  if (!action || action.kind === "initiative") return null;
  if (action.kind === "skill") return { kind: "skill", skill: action.skill };
  return { kind: action.kind, ability: action.ability };
}

/**
 * La bande d'après-jet : « Relancer · Inspiration héroïque » seulement sur
 * un échec de test de la fiche, quand elle a au moins un point, et une
 * seule fois par jet. Rien sur une réussite.
 */
export function bandeRelanceVisible(input: {
  verdict: "success" | "fail" | null;
  action: ActionFiche | undefined;
  inspiration: number;
  dejaRelance: boolean;
}): boolean {
  return input.verdict === "fail" && testARelancer(input.action) !== null && input.inspiration >= 1 && !input.dejaRelance;
}

// ---- résultat ----------------------------------------------------------------

/** Un jet tel que l'écran l'affiche : réponse du serveur ou ligne Realtime, même forme. */
export interface JetAffiche {
  id: string;
  who: string;
  what: string;
  chips: RollChip[];
  total: number;
  dc: number | null;
  /** DD privé : les joueurs lisent « contre DD ? », jamais la valeur. */
  dcPrivate: boolean;
  verdict: "success" | "fail" | null;
  naturalD20: number | null;
  /** Jet secret (vu de son auteur et du MJ seulement). */
  secret: boolean;
  groups: DiceGroup[];
  pair: AdvantagePair | null;
  createdAt: string;
}

/** `detail.dcPrivate` d'un jet Realtime (le détail est un JSON libre : on rétrécit, on ne suppose pas). */
export function lireDcPrive(detail: unknown): boolean {
  if (!detail || typeof detail !== "object") return false;
  return (detail as { dcPrivate?: unknown }).dcPrivate === true;
}

/**
 * Ce que le MJ diffuse du DD (Realtime broadcast, jamais persisté) : une
 * valeur, ou `{ dc: null, private: true }` quand le DD est privé — le joueur
 * lit alors « contre DD ? » et lance sans DD.
 */
export function lireDiffusionDd(payload: unknown): { dc: number | null; prive: boolean } {
  if (!payload || typeof payload !== "object") return { dc: null, prive: false };
  const { dc, private: prive } = payload as { dc?: unknown; private?: unknown };
  return { dc: typeof dc === "number" && Number.isFinite(dc) ? dc : null, prive: prive === true };
}

/** Un jet Realtime est secret dès que sa visibilité n'est pas `public` (`gm` ou `roller`). */
export function estSecret(visibilityLevel: string): boolean {
  return visibilityLevel !== "public";
}

export type EtatDe = "maximum" | "un" | "normal";

/** Le max d'un dé en ambre, le 1 en rouge. Un dé à une face n'existe pas ici. */
export function etatDe(valeur: number, faces: number): EtatDe {
  if (valeur === faces) return "maximum";
  if (valeur === 1) return "un";
  return "normal";
}

export interface CarreSimple {
  type: "de";
  faces: number;
  valeur: number;
}
export interface CarrePaire {
  type: "paire";
  mode: "advantage" | "disadvantage";
  rolls: [number, number];
  keptIndex: 0 | 1;
}
export type Carre = CarreSimple | CarrePaire;

/** Les carrés du résultat : un par dé, sauf la paire d'un jet avec avantage qui n'en fait qu'un (deux dés étiquetés). */
export function carresDuJet(groups: readonly DiceGroup[], pair: AdvantagePair | null): Carre[] {
  const carres: Carre[] = [];
  let paireUtilisee = false;
  for (const groupe of groups) {
    if (pair && !paireUtilisee && groupe.faces === 20 && groupe.rolls.length === 2) {
      carres.push({ type: "paire", mode: pair.mode, rolls: pair.rolls, keptIndex: pair.keptIndex });
      paireUtilisee = true;
      continue;
    }
    for (const valeur of groupe.rolls) carres.push({ type: "de", faces: groupe.faces, valeur });
  }
  return carres;
}

/** Les jets les plus récents d'abord, plafonnés ; sans doublon. */
export function fusionnerJets(historique: JetAffiche[], enDirect: JetAffiche[], limite: number): JetAffiche[] {
  const ids = new Set(historique.map((r) => r.id));
  const plusRecent = historique[0]?.createdAt ?? "";
  const recus = enDirect.filter((r) => !ids.has(r.id) && r.createdAt > plusRecent);
  return [...recus, ...historique].slice(0, limite);
}
