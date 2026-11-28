import type { PersonalityPoleKey, WorldviewPoleKey } from "../psyche/keys";
import type { LiensEnvers } from "./combatCamps";

/**
 * ADR 0122 — Le moral et le but d'un PNJ en combat.
 *
 * Fonctions pures, sans IA ni base : le serveur lit la psyché à l'ouverture
 * du combat, `espritDeCombat` en tire un but et un modificateur de moral, et
 * l'esprit vit ensuite dans l'état de scène (`combatMinds`). À chaque tour,
 * `declencheursDeMoral` dit s'il faut un test, `testDeMoral` le lance avec
 * les dés du serveur (règle 8).
 *
 * Convention des pôles (specs/psyche-pnj.md §1.5) : -100 à 100, le signe
 * porte le pôle, le premier mot de la clé est le pôle positif
 * (`impulse_prudence` > 0 : impulsif ; `peace_force` > 0 : tient à la paix).
 */

export type ButDeCombat = "arreter" | "piller" | "defendre" | "survivre" | "vaincre";
export type EtatDeCombat = "combat" | "fuite" | "rendu";

export interface EspritDeCombat {
  but: ButDeCombat;
  /** Celui qu'il défend (but `defendre`), sinon `null`. */
  protege: string | null;
  /** Le modificateur du test de moral, borné à ± 6. */
  mod: number;
  etat: EtatDeCombat;
  /** Les déclencheurs déjà testés : on ne teste pas deux fois la même chose. */
  testes: string[];
  /** Très dur (dureté forte) ou haineux envers l'adversaire : il achève qui est à terre. Absent : non. */
  impitoyable?: boolean;
}

export interface PsycheAuCombat {
  id: string;
  archetype: string | null;
  camp: "agresseur" | "defenseur";
  agresseurId: string;
  cibleId: string;
  /** Ses liens envers l'agresseur et la cible (comme `campsDuCombat`). */
  envers: Record<string, LiensEnvers>;
  poles: Partial<Record<PersonalityPoleKey, number>>;
  convictions: Partial<Record<WorldviewPoleKey, number>>;
  /** La somme des intensités de ses aspirations de toute une vie : ce qu'il a à perdre. */
  aspirationsDeVie: number;
}

/** La bande « fort » (`bands.ts`) : en dessous, un trait ne décide pas d'un but. */
const SEUIL = 34;
const MOD_MAX = 6;

const BONUS_DU_BUT: Record<ButDeCombat, number> = { arreter: 2, defendre: 2, vaincre: 0, piller: -2, survivre: -4 };
const BONUS_ARCHETYPE: Record<string, number> = { garde: 2, malfrat: -1 };

/** ADR 0122, point 1. L'ordre compte : la garde reste la garde, même prise pour cible. */
export function butDeCombat(p: PsycheAuCombat): { but: ButDeCombat; protege: string | null } {
  if (p.archetype === "garde") return { but: "arreter", protege: null };
  const egoiste = (p.poles.altruism_selfishness ?? 0) <= -SEUIL && (p.convictions.wealth_honor ?? 0) >= SEUIL;
  if (p.archetype === "malfrat" || egoiste) return { but: "piller", protege: null };
  if (p.id === p.cibleId) {
    const peur = p.envers[p.agresseurId]?.peur ?? 0;
    return { but: peur >= SEUIL || (p.convictions.peace_force ?? 0) >= SEUIL ? "survivre" : "vaincre", protege: null };
  }
  if (p.id === p.agresseurId) return { but: "vaincre", protege: null };
  return { but: "defendre", protege: p.camp === "defenseur" ? p.cibleId : p.agresseurId };
}

/** ADR 0122, point 2. La peur vise l'adversaire : l'agresseur pour la défense, la cible pour l'attaque. */
export function modificateurDeMoral(p: PsycheAuCombat, but: ButDeCombat): number {
  const adversaire = p.camp === "defenseur" ? p.agresseurId : p.cibleId;
  const peur = p.envers[adversaire]?.peur ?? 0;
  const mod =
    -Math.round(peur / 20) +
    Math.round((p.poles.impulse_prudence ?? 0) / 50) -
    Math.min(2, Math.floor(p.aspirationsDeVie / 3)) +
    (p.archetype ? (BONUS_ARCHETYPE[p.archetype] ?? 0) : 0) +
    BONUS_DU_BUT[but];
  return Math.max(-MOD_MAX, Math.min(MOD_MAX, mod)) || 0;
}

/** La bande « extrême » (`bands.ts`) : au-delà, on achève. */
const SEUIL_EXTREME = 67;

export function espritDeCombat(p: PsycheAuCombat): EspritDeCombat {
  const { but, protege } = butDeCombat(p);
  const adversaire = p.camp === "defenseur" ? p.agresseurId : p.cibleId;
  const impitoyable = (p.poles.empathy_hardness ?? 0) <= -SEUIL_EXTREME || (p.envers[adversaire]?.amitie ?? 0) <= -SEUIL_EXTREME;
  return { but, protege, mod: modificateurDeMoral(p, but), etat: "combat", testes: [], ...(impitoyable ? { impitoyable } : {}) };
}

export interface DeclencheurDeMoral {
  cle: string;
  dd: number;
}

/** ADR 0122, point 3 : à la moitié des PV, un allié tombé ou en fuite, seul contre plusieurs. */
export function declencheursDeMoral(s: {
  pv: number;
  pvMax: number;
  /** Les alliés à 0 PV, en fuite ou rendus. */
  alliesTombes: readonly string[];
  /** Les alliés encore au combat, lui exclu. */
  alliesDebout: number;
  ennemisDebout: number;
  testes: readonly string[];
}): DeclencheurDeMoral[] {
  const lot: DeclencheurDeMoral[] = [];
  if (s.pvMax > 0 && s.pv <= s.pvMax / 2) lot.push({ cle: "moitie", dd: 10 });
  for (const id of s.alliesTombes) lot.push({ cle: `allie:${id}`, dd: 10 });
  if (s.alliesDebout === 0 && s.ennemisDebout >= 2) lot.push({ cle: "seul", dd: 12 });
  return lot.filter((d) => !s.testes.includes(d.cle));
}

export interface JetDeMoral {
  naturel: number;
  total: number;
  dd: number;
  tient: boolean;
}

/**
 * Un seul jet, contre le plus haut DD des déclencheurs nouveaux, qui sont
 * tous notés. Raté : il fuit, sauf au contact à un quart de ses PV ou moins,
 * où il se rend (il ne peut plus s'échapper). Un 20 tient, un 1 lâche.
 */
export function testDeMoral(
  esprit: EspritDeCombat,
  declencheurs: readonly DeclencheurDeMoral[],
  s: { engage: boolean; pv: number; pvMax: number },
  rng: { nextInt(max: number): number }
): { esprit: EspritDeCombat; jet: JetDeMoral | null } {
  if (declencheurs.length === 0) return { esprit, jet: null };
  const dd = Math.max(...declencheurs.map((d) => d.dd));
  const naturel = rng.nextInt(20) + 1;
  const total = naturel + esprit.mod;
  const tient = naturel === 20 ? true : naturel === 1 ? false : total >= dd;
  const testes = [...esprit.testes, ...declencheurs.map((d) => d.cle)];
  const etat: EtatDeCombat = tient ? "combat" : s.engage && s.pv <= s.pvMax / 4 ? "rendu" : "fuite";
  return { esprit: { ...esprit, etat, testes }, jet: { naturel, total, dd, tient } };
}

/**
 * Un allié à terre qui meurt (0 PV, ni stabilisé ni mort) : celui qui le
 * défend vient le stabiliser plutôt que frapper, s'il n'est pas loin. Rend
 * l'identifiant de l'allié à secourir, ou `null`.
 */
export function aSecourir(esprit: Pick<EspritDeCombat, "but" | "protege"> | undefined, mourants: readonly string[], zone: "engaged" | "near" | "far"): string | null {
  if (!esprit || esprit.but !== "defendre" || esprit.protege === null || zone === "far") return null;
  return mourants.includes(esprit.protege) ? esprit.protege : null;
}

/** Stabiliser une créature mourante : Sagesse (Médecine) DD 10, règles 2024. Les dés viennent du serveur. */
export function jetDeSecours(modificateur: number, rng: { nextInt(max: number): number }): { naturel: number; total: number; reussi: boolean } {
  const naturel = rng.nextInt(20) + 1;
  const total = naturel + modificateur;
  return { naturel, total, reussi: total >= 10 };
}

export type SortDuVaincu = "capture" | "detrousse" | "acheve" | "laisse";

/**
 * ADR 0123 — Ce que les vainqueurs font de qui est à terre, selon leur but
 * (choix de l'auteur : le moteur décide). La garde l'arrête ; sinon un
 * pillard le détrousse ; sinon un impitoyable l'achève ; sinon on le laisse.
 * Rend l'issue et l'indice du vainqueur qui la porte (`null` sans vainqueur).
 */
export function sortDuVaincu(vainqueurs: readonly Pick<EspritDeCombat, "but" | "impitoyable">[]): { sort: SortDuVaincu; par: number | null } {
  const premier = (test: (e: Pick<EspritDeCombat, "but" | "impitoyable">) => boolean) => vainqueurs.findIndex(test);
  const garde = premier((e) => e.but === "arreter");
  if (garde >= 0) return { sort: "capture", par: garde };
  const pillard = premier((e) => e.but === "piller");
  if (pillard >= 0) return { sort: "detrousse", par: pillard };
  const bourreau = premier((e) => e.impitoyable === true && e.but !== "survivre" && e.but !== "defendre");
  if (bourreau >= 0) return { sort: "acheve", par: bourreau };
  return { sort: "laisse", par: vainqueurs.length > 0 ? 0 : null };
}
