import { z } from "zod";
import { TRIGGER_ZONES, type TriggerZone } from "./triggers";
import { budgetForTurn, zActionBudget, type ActionBudget } from "./actionBudget";

/**
 * V3-A4 — L'etat de scene (specs/moteur-de-jeu.md §6).
 *
 * Module PUR. Toutes les fonctions rendent une NOUVELLE scene : rien n'est
 * mute sur place, pour qu'une scene puisse etre comparee a la precedente et
 * qu'annuler un tour (V3-F2) reste possible.
 *
 * Le point qui justifie ce fichier : **le temps avance parce que le code le
 * fait avancer.** L'ADR 0009 a constate qu'un modele perd le fil du temps et
 * de qui est present — c'est la premiere cause d'incoherence en solo. Ici
 * franchir minuit est de l'arithmetique, pas une intuition.
 */

export const DAY_MINUTES = 24 * 60;

export type Lighting = "bright" | "dim" | "dark";

export interface GameTime {
  day: number;
  hour: number;
  minute: number;
}

export interface ScenePresence {
  entityId: string;
  /** Les trois zones abstraites, jamais une grille tactique (spec §6). */
  zone: TriggerZone;
  /** Un mot sur l'attitude ("mefiant"), pour la colonne « Présents » de V3-D3. */
  disposition?: string;
}

export interface SceneState {
  /**
   * V3-B2 : passe de 1 a 2 en ajoutant `budgets`. Aucune migration — la
   * scene est un `jsonb` valide par Zod, et SCHEMA.md §26 l'a voulu ainsi
   * précisément pour qu'un champ ajoute au moteur n'en demande pas. Aucune
   * reprise d'anciennes lignes non plus : la table etait vide (verifie le
   * 22 septembre), rien n'ecrivant encore de scene avant ce ticket.
   */
  __v: 2;
  locationId: string;
  present: ScenePresence[];
  time: GameTime;
  lighting: Lighting;
  activeCombatId: string | null;
  /** Les cinq derniers `session_events`, le plus recent en tete. */
  recentEvents: string[];
  /**
   * Le budget d'action de chaque acteur pour le tour EN COURS, indexe par
   * identifiant.
   *
   * Il vit dans la scene, et pas sur l'entite, parce qu'un budget de tour
   * est un fait de CETTE scene : annuler un tour (V3-F2) restaure une scene
   * entiere, et le budget doit suivre le meme sort que les zones et
   * l'heure. Le poser dans `entity_runtime_state` l'en aurait separe.
   */
  budgets: Record<string, ActionBudget>;
}

export const RECENT_EVENTS_KEPT = 5;

const zGameTime = z.object({
  day: z.number().int().nonnegative(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

export const zSceneState = z.object({
  __v: z.literal(2),
  locationId: z.string().min(1),
  present: z.array(
    z.object({
      entityId: z.string().min(1),
      zone: z.enum(TRIGGER_ZONES),
      disposition: z.string().min(1).optional(),
    }),
  ),
  time: zGameTime,
  lighting: z.enum(["bright", "dim", "dark"]),
  activeCombatId: z.string().min(1).nullable(),
  recentEvents: z.array(z.string().min(1)).max(RECENT_EVENTS_KEPT),
  budgets: z.record(z.string(), zActionBudget),
});

export function emptyScene(locationId: string, time: GameTime = { day: 1, hour: 8, minute: 0 }): SceneState {
  return {
    __v: 2,
    locationId,
    present: [],
    time,
    lighting: lightingAt(time),
    activeCombatId: null,
    recentEvents: [],
    budgets: {},
  };
}

/**
 * Ouvre le tour de quelqu'un : son budget repart neuf.
 *
 * C'est le CODE qui le remet a zero, jamais le joueur ni un modele — meme
 * discipline que l'horloge. Le budget de l'acteur precedent est conserve :
 * hors combat les tours ne s'alternent pas vraiment, et effacer celui d'un
 * autre ferait disparaitre une reaction deja depensee.
 */
export function startTurn(scene: SceneState, who: string, speed: number): SceneState {
  return { ...scene, budgets: { ...scene.budgets, [who]: budgetForTurn(speed) } };
}

/** Le budget courant de quelqu'un, ou celui d'un tour neuf s'il n'en a pas encore. */
export function budgetOf(scene: SceneState, who: string, speed: number): ActionBudget {
  return scene.budgets[who] ?? budgetForTurn(speed);
}

/**
 * Avance l'horloge de jeu. Refuse un delta negatif : le temps de jeu ne
 * remonte pas, et laisser passer un recul transformerait un bug d'appelant
 * en incoherence de partie difficile a retrouver. Annuler un tour (V3-F2)
 * restaurera une scene ENTIERE, il ne reculera pas l'horloge.
 */
export function advanceTime(time: GameTime, minutes: number): GameTime {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error(`Le temps de jeu n'avance que de minutes entieres positives (recu : ${minutes}).`);
  }
  const total = time.day * DAY_MINUTES + time.hour * 60 + time.minute + minutes;
  return {
    day: Math.floor(total / DAY_MINUTES),
    hour: Math.floor((total % DAY_MINUTES) / 60),
    minute: total % 60,
  };
}

/**
 * Eclairage naturel deduit de l'heure. Bornes volontairement grossieres :
 * une regle qui a besoin de plus precis pose son propre eclairage sur la
 * scene (une cave reste `dark` a midi). Le calendrier reel du monde —
 * saisons, latitude — n'existe pas et n'est pas simule.
 */
export function lightingAt(time: GameTime): Lighting {
  // Plein jour 8h-17h, penombre 6h-7h et 18h-21h, nuit 22h-5h.
  if (time.hour >= 8 && time.hour < 18) return "bright";
  if (time.hour >= 6 && time.hour < 22) return "dim";
  return "dark";
}

export function sceneZoneOf(scene: SceneState, entityId: string): TriggerZone | undefined {
  return scene.present.find((p) => p.entityId === entityId)?.zone;
}

/** Idempotent : quelqu'un de deja present n'entre pas deux fois. Arrive par defaut a portee de vue. */
export function enterScene(
  scene: SceneState,
  who: { entityId: string; zone?: TriggerZone; disposition?: string },
): SceneState {
  if (scene.present.some((p) => p.entityId === who.entityId)) return scene;
  return {
    ...scene,
    present: [...scene.present, { entityId: who.entityId, zone: who.zone ?? "far", disposition: who.disposition }],
  };
}

/** Faire sortir un absent ne change rien : une sortie est un etat vise, pas une transition a verifier. */
export function leaveScene(scene: SceneState, entityId: string): SceneState {
  if (!scene.present.some((p) => p.entityId === entityId)) return scene;
  return { ...scene, present: scene.present.filter((p) => p.entityId !== entityId) };
}

/**
 * Deplacer quelqu'un d'ABSENT leve, la ou le faire sortir ne leve pas : le
 * second decrit un etat vise deja atteint, le premier est une regle qui
 * croit agir sur quelqu'un qui n'est pas la — un silence ici cacherait un
 * declencheur mal ecrit.
 */
export function moveToZone(scene: SceneState, entityId: string, zone: TriggerZone): SceneState {
  if (!scene.present.some((p) => p.entityId === entityId)) {
    throw new Error(`"${entityId}" n'est pas dans la scene : impossible de le deplacer.`);
  }
  return { ...scene, present: scene.present.map((p) => (p.entityId === entityId ? { ...p, zone } : p)) };
}

/** Retient un evenement de session ; ne garde que les cinq plus recents, le plus recent en tete. */
export function rememberEvent(scene: SceneState, eventId: string): SceneState {
  return { ...scene, recentEvents: [eventId, ...scene.recentEvents].slice(0, RECENT_EVENTS_KEPT) };
}
