import { pickTitle } from "@/src/core/stats/playerStats";
import { TITLE_ACTION_KINDS, TITLE_FAMILIES, type PlayerTitleTier, type TitleFamily } from "@/src/core/stats/titleTiers";

/**
 * V3.1-92 — La logique pure de l'éditeur des titres (Administration › Titres
 * des joueurs) : édition de la liste des paliers, saisie décimale à la
 * française, plage de départ d'un nouveau palier, essai d'une valeur. Rien
 * n'est décidé ici sur les règles : le noyau (`src/core/stats`) choisit le
 * palier et repère trous et chevauchements, le serveur valide.
 */

export type ActionKind = (typeof TITLE_ACTION_KINDS)[number];

/** Lecture d'un champ de plage : `valeur: null` = champ vide (∞ pour la borne haute) ; `ok: false` = saisie illisible. */
export type SaisieDecimale = { ok: true; valeur: number | null } | { ok: false };

/** « 0,8 » ou « 0.8 » vaut 0.8 ; vide vaut `null` ; le reste (lettres, négatif, deux virgules) est refusé. */
export function lireDecimal(texte: string): SaisieDecimale {
  const propre = texte.trim();
  if (propre === "") return { ok: true, valeur: null };
  if (!/^\d+[.,]?\d*$|^[.,]\d+$/.test(propre)) return { ok: false };
  const valeur = Number(propre.replace(",", "."));
  return Number.isFinite(valeur) ? { ok: true, valeur } : { ok: false };
}

/** 0.8 s'écrit « 0,8 » ; `null` s'écrit vide. */
export function ecrireDecimal(valeur: number | null): string {
  return valeur === null ? "" : String(valeur).replace(".", ",");
}

/** Les paliers d'une famille, dans l'ordre de la liste. */
export function tiersDeFamille(tiers: readonly PlayerTitleTier[], family: TitleFamily): PlayerTitleTier[] {
  return tiers.filter((t) => t.family === family);
}

/** Remet le jeu COMPLET en ordre : familles dans l'ordre du noyau, `position` = rang dans la famille. */
function renumeroter(tiers: readonly PlayerTitleTier[]): PlayerTitleTier[] {
  return TITLE_FAMILIES.flatMap((family) => tiersDeFamille(tiers, family).map((t, position) => ({ ...t, position })));
}

/** Change un palier (par son rang dans sa famille). */
export function modifierPalier(tiers: readonly PlayerTitleTier[], family: TitleFamily, rang: number, patch: Partial<PlayerTitleTier>): PlayerTitleTier[] {
  const siens = tiersDeFamille(tiers, family);
  if (rang < 0 || rang >= siens.length) return [...tiers];
  const cible = siens[rang];
  return tiers.map((t) => (t === cible ? { ...t, ...patch } : t));
}

/** Retire un palier ; le dernier d'une famille reste (le serveur exige un palier par famille). */
export function retirerPalier(tiers: readonly PlayerTitleTier[], family: TitleFamily, rang: number): PlayerTitleTier[] {
  const siens = tiersDeFamille(tiers, family);
  if (siens.length <= 1 || rang < 0 || rang >= siens.length) return [...tiers];
  const cible = siens[rang];
  return renumeroter(tiers.filter((t) => t !== cible));
}

/** Où commence un nouveau palier chiffré : à la fin du précédent ; si celui-ci n'a pas de fin, un cran au-dessus de son début. */
export function departNouveauPalier(famille: readonly PlayerTitleTier[]): number {
  const dernier = famille[famille.length - 1];
  if (!dernier) return 0;
  if (dernier.range_to !== null) return dernier.range_to;
  return (dernier.range_from ?? 0) + 1;
}

/** Ajoute un palier en fin de famille. `nom` est le libellé du nouveau palier (venu de `messages/`). */
export function ajouterPalier(tiers: readonly PlayerTitleTier[], family: TitleFamily, nom: string): PlayerTitleTier[] {
  const siens = tiersDeFamille(tiers, family);
  const base = { family, position: siens.length, name: nom, icon_key: "star", color_token: "accent" } as const;
  const nouveau: PlayerTitleTier =
    family === "favorite_action"
      ? { ...base, range_from: null, range_to: null, action_kind: prochaineAction(siens), template: "{action}, ×{fois}" }
      : { ...base, range_from: departNouveauPalier(siens), range_to: null, action_kind: null, template: "" };
  return renumeroter([...tiers, nouveau]);
}

/** La première sorte d'action pas encore prise ; toutes prises : la dernière de la liste. */
function prochaineAction(siens: readonly PlayerTitleTier[]): ActionKind {
  const prises = new Set(siens.map((t) => t.action_kind));
  return TITLE_ACTION_KINDS.find((k) => !prises.has(k)) ?? TITLE_ACTION_KINDS[TITLE_ACTION_KINDS.length - 1];
}

/** La valeur d'essai de départ et le maximum du curseur, par famille chiffrée (planche). */
export const ESSAI: Record<Exclude<TitleFamily, "favorite_action">, { depart: number; max: number }> = {
  luck: { depart: 1.4, max: 3 },
  bad_luck: { depart: 1.3, max: 3 },
  purse: { depart: 0.7, max: 2 },
};

/** Le rang (dans sa famille) du palier où tombe une mesure d'essai ; -1 si aucun. */
export function rangTouche(tiers: readonly PlayerTitleTier[], family: TitleFamily, mesure: number | ActionKind | null): number {
  const palier = pickTitle(tiers, family, mesure);
  return palier ? tiersDeFamille(tiers, family).indexOf(palier) : -1;
}

/** Les chiffres d'exemple de l'aperçu (planche : « 14 × 20, 9 × 1, 3 d'affilée, −860 / +1 240 po, … ×47, record 27 »). */
export const CHIFFRES_EXEMPLE = { n20: 14, table20: 10, n1: 9, suite: 3, depense: "860", gagne: "1 240", fois: 47, record: 27 } as const;
