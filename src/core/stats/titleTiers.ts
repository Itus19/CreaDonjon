import { z } from "zod";

/**
 * Les paliers des titres des joueurs (V3.1-89, ADR 0064) : des DONNÉES,
 * réglables par le superadmin (V3.1-92), globales à la plateforme. Table
 * `player_title_tiers`. Le noyau des statistiques (V3.1-90) choisit le palier
 * d'une mesure ; ce module dit ce qu'un palier valide peut contenir.
 */

export const TITLE_FAMILIES = ["luck", "bad_luck", "purse", "favorite_action"] as const;
export type TitleFamily = (typeof TITLE_FAMILIES)[number];

/** Les douze icônes que le code sait dessiner (jamais d'émoji). */
export const TITLE_ICON_KEYS = ["star", "clover", "d20", "shield", "cat", "purse", "coin", "dagger", "sword", "wand", "heart", "scroll"] as const;

/** Les jetons de couleur de la charte autorisés pour un titre. */
export const TITLE_COLOR_TOKENS = ["success", "danger", "accent", "link_entity", "link_rule"] as const;

/** Les natures d'action d'un titre « action favorite » ; l'attaque sournoise est distinguée de l'attaque d'arme, un test et une sauvegarde se confondent. */
export const TITLE_ACTION_KINDS = ["sneak_attack", "attack", "spell", "heal", "check"] as const;

/** Les variables qu'un texte de titre peut citer (`renderTemplate`, V3.1-90). */
export const TITLE_TEMPLATE_VARIABLES = ["n20", "table20", "n1", "suite", "depense", "gagne", "action", "fois", "record"] as const;

const zTemplate = z
  .string()
  .max(200)
  .refine((t) => [...t.matchAll(/\{([^}]*)\}/g)].every((m) => (TITLE_TEMPLATE_VARIABLES as readonly string[]).includes(m[1])), {
    message: "Variable de texte inconnue.",
  });

export const zPlayerTitleTier = z
  .object({
    family: z.enum(TITLE_FAMILIES),
    position: z.number().int().min(0),
    range_from: z.number().min(0).nullable(),
    /** `null` : sans borne haute. */
    range_to: z.number().min(0).nullable(),
    action_kind: z.enum(TITLE_ACTION_KINDS).nullable(),
    name: z.string().trim().min(1).max(60),
    template: zTemplate,
    icon_key: z.enum(TITLE_ICON_KEYS),
    color_token: z.enum(TITLE_COLOR_TOKENS),
  })
  .refine((t) => (t.family === "favorite_action" ? t.action_kind !== null && t.range_from === null && t.range_to === null : t.action_kind === null && t.range_from !== null), {
    message: "Une famille chiffrée a une plage (range_from) ; l'action favorite a une nature d'action, sans plage.",
  })
  .refine((t) => t.range_from === null || t.range_to === null || t.range_from < t.range_to, { message: "range_from doit être inférieur à range_to." });
export type PlayerTitleTier = z.infer<typeof zPlayerTitleTier>;

function ranged(family: Exclude<TitleFamily, "favorite_action">, position: number, from: number, to: number | null, name: string, template: string, icon: PlayerTitleTier["icon_key"], color: PlayerTitleTier["color_token"]): PlayerTitleTier {
  return { family, position, range_from: from, range_to: to, action_kind: null, name, template, icon_key: icon, color_token: color };
}
function action(position: number, kind: PlayerTitleTier["action_kind"], name: string, icon: PlayerTitleTier["icon_key"], color: PlayerTitleTier["color_token"]): PlayerTitleTier {
  return { family: "favorite_action", position, range_from: null, range_to: null, action_kind: kind, name, template: "{action}, ×{fois} ; record : {record} dégâts", icon_key: icon, color_token: color };
}

/**
 * Les paliers par défaut (décision du 9 octobre, ticket V3.1-90), insérés par
 * la migration de V3.1-89 comme RÉGLAGES. Couleurs : ambre = `accent`,
 * sarcelle = `link_entity`, vert = `success`, rouge = `danger`, violet =
 * `link_rule`. Mesures : luck et bad_luck = rapport à la moyenne de la
 * table ; purse = dépensé ÷ gagné.
 */
export const DEFAULT_TITLE_TIERS: readonly PlayerTitleTier[] = [
  ranged("luck", 0, 0, 0.8, "En attente d'un miracle", "{n20} × 20 naturels (table : {table20})", "star", "accent"),
  ranged("luck", 1, 0.8, 1.2, "Bonne étoile", "{n20} × 20 naturels (table : {table20})", "clover", "link_entity"),
  ranged("luck", 2, 1.2, null, "Béni des dés", "{n20} × 20 naturels — plus que toute la table", "d20", "success"),
  ranged("bad_luck", 0, 0, 0.8, "Pied ferme", "{n1} × 1 naturels", "shield", "link_entity"),
  ranged("bad_luck", 1, 0.8, 1.2, "Ça arrive", "{n1} × 1 naturels", "d20", "accent"),
  ranged("bad_luck", 2, 1.2, null, "Chat noir", "{n1} × 1 naturels, dont {suite} d'affilée", "cat", "danger"),
  ranged("purse", 0, 0, 0.5, "Écureuil", "−{depense} po dépensées pour +{gagne} gagnées", "purse", "success"),
  ranged("purse", 1, 0.5, 1, "Bon gestionnaire", "−{depense} po dépensées pour +{gagne} gagnées", "coin", "accent"),
  ranged("purse", 2, 1, null, "Bourse percée", "−{depense} po dépensées pour +{gagne} gagnées", "purse", "danger"),
  action(0, "sneak_attack", "Lame de l'ombre", "dagger", "link_rule"),
  action(1, "attack", "Bretteur", "sword", "accent"),
  action(2, "spell", "Arcaniste", "wand", "link_rule"),
  action(3, "heal", "Main secourable", "heart", "success"),
  action(4, "check", "Prudent", "shield", "link_entity"),
];
