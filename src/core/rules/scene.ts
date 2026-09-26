import { z } from "zod";
import { TRIGGER_ZONES, type TriggerZone } from "./triggers";
import { budgetForTurn, zActionBudget, type ActionBudget } from "./actionBudget";
import { computeSortKey, dateFromSortKey } from "../calendar/sortKey";
import type { CalendarConfig, GameDate } from "../calendar/types";

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

/**
 * V3-C2 — Un personnage incident : un nom et un trait tires par le
 * generateur (jamais invente par le modele), un identifiant LOCAL a cette
 * scene, jamais un UUID d'entite — c'est ce qui empeche le modele de la
 * confondre avec une vraie fiche (ADR 0009, trou n° 4). « Aucune ligne en
 * base hors du journal » : elle ne vit que dans `scene_states.state`, et
 * disparait quand la scene change de lieu (`setScene`), sauf a etre
 * ancree en entite reelle avant (`promoteToEntity`).
 */
export interface SceneSketch {
  id: string;
  name: string;
  trait: string;
  zone: TriggerZone;
  disposition?: string;
  /** Combien de fois elle a pris la parole (`npc_reaction`) — au-dela de trois, elle s'ancre. */
  timesSpoken: number;
  /** Le lieu ou elle a ete tiree — ce qui la fait disparaitre quand la scene change de lieu. */
  locationId: string;
}

export interface SceneState {
  /**
   * V3-B2 : passe de 1 a 2 en ajoutant `budgets`. V3-C2 : passe de 2 a 3 en
   * ajoutant `sketches`. Aucune migration — la scene est un `jsonb` valide
   * par Zod, et SCHEMA.md §26 l'a voulu ainsi précisément pour qu'un champ
   * ajoute au moteur n'en demande pas.
   */
  __v: 3;
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
  /** V3-C2 — les personnages incidents de la scene courante, jamais persistants au-dela. */
  sketches: SceneSketch[];
}

export const RECENT_EVENTS_KEPT = 5;

const zGameTime = z.object({
  day: z.number().int().nonnegative(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

const zSceneSketch = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trait: z.string().min(1),
  zone: z.enum(TRIGGER_ZONES),
  disposition: z.string().min(1).optional(),
  timesSpoken: z.number().int().nonnegative(),
  locationId: z.string().min(1),
});

export const zSceneState = z.object({
  __v: z.literal(3),
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
  sketches: z.array(zSceneSketch),
});

export function emptyScene(locationId: string, time: GameTime = { day: 1, hour: 8, minute: 0 }): SceneState {
  return {
    __v: 3,
    locationId,
    present: [],
    time,
    lighting: lightingAt(time),
    activeCombatId: null,
    recentEvents: [],
    budgets: {},
    sketches: [],
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

/**
 * V3-C2 — Au-dela de ce nombre de repliques, une esquisse s'ancre : « elle a
 * parle plus de trois fois » (docs/BACKLOG_V3.md). Compte a part de
 * `RECENT_EVENTS_KEPT`, qui borne un contexte de prompt, pas une regle
 * d'ancrage.
 */
export const SKETCH_SPOKEN_ANCHOR_THRESHOLD = 3;

/** Ajoute une esquisse a la scene — jamais deux fois le meme identifiant local. */
export function addSketch(scene: SceneState, sketch: SceneSketch): SceneState {
  if (scene.sketches.some((s) => s.id === sketch.id)) return scene;
  return { ...scene, sketches: [...scene.sketches, sketch] };
}

/** Retire une esquisse — ancree en entite reelle, ou disparue avec la scene. Une esquisse absente ne leve pas : elle est deja dans l'etat vise. */
export function removeSketch(scene: SceneState, sketchId: string): SceneState {
  if (!scene.sketches.some((s) => s.id === sketchId)) return scene;
  return { ...scene, sketches: scene.sketches.filter((s) => s.id !== sketchId) };
}

/** Une esquisse absente ne leve pas : un `npc_reaction` sur une esquisse deja ancree ce meme tour n'a rien a incrementer. */
export function recordSketchSpoke(scene: SceneState, sketchId: string): SceneState {
  if (!scene.sketches.some((s) => s.id === sketchId)) return scene;
  return { ...scene, sketches: scene.sketches.map((s) => (s.id === sketchId ? { ...s, timesSpoken: s.timesSpoken + 1 } : s)) };
}

/** Vrai une fois le seuil d'ancrage par la parole franchi (docs/BACKLOG_V3.md, V3-C2). */
export function sketchShouldAnchorForSpeaking(sketch: SceneSketch): boolean {
  return sketch.timesSpoken > SKETCH_SPOKEN_ANCHOR_THRESHOLD;
}

/**
 * Les esquisses ne survivent qu'a LEUR lieu de tirage : changer de lieu
 * (`setScene`) les laisse derriere, ancrees ou non — « les esquisses non
 * ancrees disparaissent a la fin de la scene » (V3-C2). Elles restent
 * retrouvables : leur tirage est deja journalise (`world_update`), disparaitre
 * de `scene_states` ne les efface pas du journal.
 */
export function dropSketchesOutsideLocation(scene: SceneState, locationId: string): SceneState {
  const kept = scene.sketches.filter((s) => s.locationId === locationId);
  if (kept.length === scene.sketches.length) return scene;
  return { ...scene, sketches: kept };
}

/**
 * « Le joueur l'a nommee explicitement » (V3-C2) : le nom de l'esquisse
 * apparait comme un mot ENTIER dans le texte, jamais une sous-chaine
 * (« Bram » ne doit pas matcher dans « Brame », ni dans une phrase qui ne le
 * cite pas) — deterministe, jamais un jugement du modele.
 */
export function textNamesSketch(text: string, sketchName: string): boolean {
  const escaped = sketchName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (escaped === "") return false;
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "iu").test(text);
}

/**
 * V3-D2 — Convertit `GameTime.day` (un compteur relatif, sans ancrage
 * calendaire) en une date du calendrier du monde, en posant que le premier
 * jour d'une scene neuve (`day: 1`, `emptyScene`) tombe sur la date que le
 * MJ a marquee comme "aujourd'hui" (`calendar.currentDate`).
 *
 * `null` si aucune date n'a ete reglee, ou reglee a une precision plus
 * large que le jour (annee seule, decennie...) : afficher un jour et un
 * mois calcules a partir d'une precision plus grossiere inventerait une
 * exactitude que le MJ n'a jamais donnee — meme principe que la meteo
 * omise tant que V3-C6 n'existe pas.
 */
export function sceneCalendarDate(day: number, calendar: CalendarConfig): GameDate | null {
  const anchor = calendar.currentDate;
  if (anchor === null || anchor.precision !== "day" || anchor.month === null || anchor.day === null) return null;

  const totalDays = computeSortKey(anchor, calendar) + (day - 1);
  const { year, month, day: dayOfMonth } = dateFromSortKey(totalDays, calendar);
  return { year, month, day: dayOfMonth, precision: "day", end: null, label: null };
}
