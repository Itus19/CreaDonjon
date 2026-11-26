import { z } from "zod";

/**
 * V3.2-29 — Les archétypes de vie (`specs/vie-du-monde.md` §4, ADR 0115).
 *
 * Un archétype est une DONNÉE, pas du code : une routine en créneaux à
 * l'heure, une gigue et un taux d'absence. `position()` (`position.ts`) la
 * lit ; rien ici ne tire de hasard.
 *
 * Les clés JSON sont celles de la spécification (`jitter_minutes`,
 * `absence_days_per_10`) : un monde pourra ajouter ses archétypes en données,
 * comme ses pôles de psyché, et ce format est celui qu'on lui montrera.
 *
 * Module PUR : aucune dépendance hors de Zod.
 */

/**
 * Types de lieu. Jamais un lieu précis : chaque personne a les siens (sa
 * taverne, son atelier), tirés une fois avec elle. `home` est l'endroit où
 * l'on dort : la chambre d'auberge d'un voyageur, le manoir d'un noble.
 * `prison` ne sert qu'aux états, pas aux routines.
 */
export const PLACE_KINDS = ["home", "work", "tavern", "temple", "market", "barracks", "street", "prison"] as const;
export const zPlaceKind = z.enum(PLACE_KINDS);
export type PlaceKind = z.infer<typeof zPlaceKind>;

/**
 * Quels jours un créneau vaut :
 * - `all` : tous les jours ;
 * - `workdays` : tous sauf le dernier jour de la semaine du calendrier ;
 * - `restday` : le dernier jour de la semaine seulement ;
 * - `{ cycle, on }` : un cycle propre à la personne (les tours de garde sur
 *   trois jours), décalé par sa graine pour que toute la garde ne soit pas
 *   de service le même jour.
 */
export const zSlotDays = z.union([
  z.literal("all"),
  z.literal("workdays"),
  z.literal("restday"),
  z
    .object({ cycle: z.number().int().min(2).max(14), on: z.array(z.number().int().min(0)).min(1) })
    .refine((d) => d.on.every((j) => j < d.cycle), { message: "un jour du cycle dépasse sa longueur" }),
]);
export type SlotDays = z.infer<typeof zSlotDays>;

/**
 * Un créneau : de `from` à `to` (heures, `to` exclu). `to` inférieur à
 * `from` passe minuit (22 à 6 : la nuit de garde), et le créneau appartient
 * au jour où il commence.
 */
export const zRoutineSlot = z
  .object({
    where: zPlaceKind,
    from: z.number().int().min(0).max(23),
    to: z.number().int().min(1).max(24),
    days: zSlotDays,
    chance: z.number().min(0).max(1),
  })
  .refine((s) => s.from !== s.to % 24, { message: "un créneau vide" });
export type RoutineSlot = z.infer<typeof zRoutineSlot>;

export const zLifeArchetype = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  routine: z.array(zRoutineSlot).max(24),
  jitter_minutes: z.number().int().min(0).max(120),
  absence_days_per_10: z.number().min(0).max(10),
});
export type LifeArchetype = z.infer<typeof zLifeArchetype>;

const tous = "all" as const;

/**
 * La liste de départ (§4.2). Les créneaux sont lus dans l'ordre : le premier
 * qui vaut ce jour-là, couvre l'heure et passe son tirage l'emporte. Hors de
 * tout créneau, on est chez soi : c'est pourquoi la plupart des routines ne
 * disent pas « domicile ».
 *
 * Les probabilités sont réglées pour les critères du ticket : un pilier de
 * bar à 0,9 avec un jour d'absence sur dix est à la taverne environ huit
 * soirs sur dix. Un garde ne manque jamais un tour : ses jours libres sont
 * déjà dans son cycle.
 */
export const ARCHETYPES_DE_DEPART: readonly LifeArchetype[] = [
  {
    key: "personnel_de_lieu",
    label: "Personnel de lieu",
    routine: [{ where: "work", from: 6, to: 23, days: tous, chance: 1 }],
    jitter_minutes: 20,
    absence_days_per_10: 0.3,
  },
  {
    key: "artisan",
    label: "Artisan",
    routine: [
      { where: "work", from: 7, to: 18, days: "workdays", chance: 1 },
      { where: "tavern", from: 18, to: 21, days: "workdays", chance: 0.3 },
      { where: "temple", from: 9, to: 11, days: "restday", chance: 0.5 },
      { where: "market", from: 11, to: 13, days: "restday", chance: 0.4 },
    ],
    jitter_minutes: 30,
    absence_days_per_10: 0.5,
  },
  {
    key: "journalier",
    label: "Journalier",
    routine: [
      { where: "work", from: 6, to: 19, days: "workdays", chance: 0.7 },
      { where: "street", from: 6, to: 19, days: "workdays", chance: 0.8 },
      { where: "tavern", from: 19, to: 22, days: tous, chance: 0.4 },
    ],
    jitter_minutes: 30,
    absence_days_per_10: 0.5,
  },
  {
    key: "marchand_etabli",
    label: "Marchand établi",
    routine: [
      { where: "market", from: 7, to: 18, days: "workdays", chance: 0.95 },
      { where: "tavern", from: 19, to: 21, days: tous, chance: 0.25 },
      { where: "temple", from: 9, to: 11, days: "restday", chance: 0.5 },
    ],
    jitter_minutes: 30,
    absence_days_per_10: 0.3,
  },
  {
    key: "garde",
    label: "Garde",
    routine: [
      { where: "street", from: 6, to: 14, days: { cycle: 3, on: [0] }, chance: 1 },
      { where: "street", from: 14, to: 22, days: { cycle: 3, on: [1] }, chance: 1 },
      { where: "barracks", from: 22, to: 6, days: { cycle: 3, on: [2] }, chance: 1 },
      { where: "tavern", from: 18, to: 22, days: tous, chance: 0.4 },
    ],
    jitter_minutes: 15,
    absence_days_per_10: 0,
  },
  {
    key: "pretre",
    label: "Prêtre",
    routine: [
      { where: "street", from: 14, to: 16, days: "workdays", chance: 0.3 },
      { where: "temple", from: 5, to: 21, days: tous, chance: 1 },
    ],
    jitter_minutes: 20,
    absence_days_per_10: 0.2,
  },
  {
    key: "pilier_de_bar",
    label: "Pilier de bar",
    routine: [
      { where: "home", from: 0, to: 10, days: tous, chance: 1 },
      { where: "tavern", from: 11, to: 24, days: tous, chance: 0.9 },
      { where: "market", from: 10, to: 11, days: tous, chance: 0.3 },
    ],
    jitter_minutes: 45,
    absence_days_per_10: 1,
  },
  {
    key: "joueur",
    label: "Joueur",
    routine: [
      { where: "tavern", from: 20, to: 4, days: tous, chance: 0.7 },
      { where: "street", from: 14, to: 20, days: tous, chance: 0.4 },
    ],
    jitter_minutes: 60,
    absence_days_per_10: 1,
  },
  {
    key: "enfant",
    label: "Enfant",
    routine: [
      { where: "street", from: 8, to: 12, days: tous, chance: 0.7 },
      { where: "market", from: 12, to: 14, days: tous, chance: 0.3 },
      { where: "street", from: 14, to: 19, days: tous, chance: 0.6 },
    ],
    jitter_minutes: 30,
    absence_days_per_10: 1,
  },
  {
    key: "vieillard",
    label: "Vieillard",
    routine: [
      { where: "temple", from: 8, to: 10, days: tous, chance: 0.5 },
      { where: "street", from: 15, to: 17, days: tous, chance: 0.3 },
      { where: "tavern", from: 17, to: 19, days: tous, chance: 0.2 },
    ],
    jitter_minutes: 30,
    absence_days_per_10: 2,
  },
  {
    key: "voyageur",
    label: "Voyageur",
    routine: [
      { where: "street", from: 8, to: 12, days: tous, chance: 0.6 },
      { where: "market", from: 12, to: 14, days: tous, chance: 0.4 },
      { where: "tavern", from: 18, to: 23, days: tous, chance: 0.7 },
    ],
    jitter_minutes: 45,
    absence_days_per_10: 0,
  },
  {
    key: "marchand_ambulant",
    label: "Marchand ambulant",
    routine: [
      { where: "market", from: 7, to: 17, days: tous, chance: 0.9 },
      { where: "tavern", from: 18, to: 22, days: tous, chance: 0.6 },
    ],
    jitter_minutes: 30,
    absence_days_per_10: 0,
  },
  {
    key: "messager",
    label: "Messager",
    routine: [
      { where: "street", from: 6, to: 20, days: tous, chance: 0.8 },
      { where: "tavern", from: 20, to: 22, days: tous, chance: 0.5 },
    ],
    jitter_minutes: 45,
    absence_days_per_10: 0.5,
  },
  {
    key: "pelerin",
    label: "Pèlerin",
    routine: [
      { where: "temple", from: 6, to: 12, days: tous, chance: 0.9 },
      { where: "street", from: 12, to: 17, days: tous, chance: 0.5 },
      { where: "temple", from: 17, to: 20, days: tous, chance: 0.6 },
    ],
    jitter_minutes: 30,
    absence_days_per_10: 0,
  },
  {
    key: "malfrat",
    label: "Malfrat",
    routine: [
      { where: "street", from: 23, to: 4, days: tous, chance: 0.7 },
      { where: "tavern", from: 18, to: 23, days: tous, chance: 0.6 },
      { where: "market", from: 11, to: 13, days: tous, chance: 0.3 },
    ],
    jitter_minutes: 60,
    absence_days_per_10: 1,
  },
  {
    key: "noble",
    label: "Noble",
    routine: [
      { where: "temple", from: 9, to: 11, days: "restday", chance: 0.7 },
      { where: "street", from: 14, to: 16, days: tous, chance: 0.3 },
    ],
    jitter_minutes: 30,
    absence_days_per_10: 1,
  },
];

export function archetypeParCle(key: string): LifeArchetype | null {
  return ARCHETYPES_DE_DEPART.find((a) => a.key === key) ?? null;
}
