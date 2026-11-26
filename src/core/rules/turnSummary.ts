import { DAY_MINUTES, type GameTime } from "./scene";
import { estPhraseDuree, libelleDuree, SECONDES_PAR_ROUND } from "./elapsed";
import type { JournalEvent } from "./turnUndo";

/**
 * V3.2-27 — La ligne du tour (option A, ADR 0114) : sous chaque tour de la
 * personne qui joue, ce que ce tour a changé, en une ligne de pastilles.
 *
 * Rien n'est écrit pour la construire : elle se relit du journal tel qu'il
 * est. Le temps qui passe se lit des relevés `undo_before.scene` que chaque
 * tour pose déjà à son début (V3-F2) : l'heure du tour suivant, ou l'heure
 * actuelle de la scène pour le dernier, moins celle du début. Les autres
 * pastilles sont les changements du moteur (`rule_application`) et les
 * mises à jour du monde (`world_update`) nés pendant le tour.
 *
 * Fonctions pures. Les événements reçus sont ceux que le fil montre déjà
 * (ni défaits, ni annulations : `visibleInFil`).
 */

export type TurnTime =
  /** Hors combat : la durée du tour et l'heure atteinte. */
  | { kind: "elapsed"; minutes: number; after: GameTime; dayChanged: boolean }
  /** En combat : un round, 6 secondes (règles 2024). */
  | { kind: "combat" };

export interface TurnSummary {
  /** Le premier événement du tour (l'action de la personne qui joue). */
  startEventId: string;
  /** Le dernier événement du tour : la ligne se place juste après. */
  afterEventId: string;
  afterSeq: number;
  /** `null` : un tour journalisé sans relevé (avant V3-F2), ou une heure illisible. */
  time: TurnTime | null;
  /** Les changements du tour, dans l'ordre du journal, sans la phrase de durée (la pastille d'heure la dit). */
  changes: string[];
  /** Les conseils du moteur et ce qu'il n'a pas pu appliquer : montrés sur demande, jamais tus. */
  hints: string[];
  ignored: string[];
  /** Les notes du monde nées du tour (`world_update` de source `world_note`) : la ligne renvoie à l'onglet où on les corrige. */
  worldNotes: number;
  /** Le dernier tour : le seul qu'on peut annuler. */
  last: boolean;
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const estEntier = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

function heureDe(v: unknown): GameTime | null {
  if (!estObjet(v) || !estEntier(v.day) || !estEntier(v.hour) || !estEntier(v.minute)) return null;
  return { day: v.day, hour: v.hour, minute: v.minute };
}

const enMinutes = (t: GameTime): number => t.day * DAY_MINUTES + t.hour * 60 + t.minute;

/** La scène relevée au début d'un tour, telle que `turnIntent.ts` l'écrit. */
function sceneAvant(e: JournalEvent): { time: GameTime | null; combat: boolean } | null {
  const before = e.payload.undo_before;
  if (!estObjet(before) || !estObjet(before.scene)) return null;
  const combat = typeof before.scene.activeCombatId === "string" && before.scene.activeCombatId !== "";
  return { time: heureDe(before.scene.time), combat };
}

const commenceUnTour = (e: JournalEvent): boolean => e.actor === "player" && (e.kind === "player_action" || e.kind === "roll");

const textes = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : []);

/**
 * Une ligne par tour de la personne qui joue. `maintenant` : l'heure actuelle
 * de la scène (`null` : pas de scène), qui ferme le dernier tour.
 */
export function summarizeTurns(events: readonly JournalEvent[], maintenant: GameTime | null): TurnSummary[] {
  const tries = [...events].sort((a, b) => a.seq - b.seq);
  const debuts: number[] = [];
  tries.forEach((e, i) => {
    if (commenceUnTour(e)) debuts.push(i);
  });

  return debuts.map((debut, n) => {
    const fin = n + 1 < debuts.length ? debuts[n + 1]! : tries.length;
    const tour = tries.slice(debut, fin);
    const premier = tour[0]!;
    const dernier = tour[tour.length - 1]!;

    const avant = sceneAvant(premier);
    const suivant = n + 1 < debuts.length ? sceneAvant(tries[debuts[n + 1]!]!)?.time ?? null : maintenant;
    let time: TurnTime | null = null;
    if (avant?.combat) time = { kind: "combat" };
    else if (avant?.time && suivant && enMinutes(suivant) >= enMinutes(avant.time)) {
      time = { kind: "elapsed", minutes: enMinutes(suivant) - enMinutes(avant.time), after: suivant, dayChanged: suivant.day !== avant.time.day };
    }

    const changes: string[] = [];
    const hints: string[] = [];
    const ignored: string[] = [];
    let worldNotes = 0;
    for (const e of tour) {
      if (e.kind === "rule_application") {
        changes.push(...textes(e.payload.changes_text).filter((l) => !estPhraseDuree(l)));
        hints.push(...textes(e.payload.hints_text));
        ignored.push(...textes(e.payload.ignored_text));
      } else if (e.kind === "world_update" && typeof e.payload.note === "string" && e.payload.note !== "") {
        changes.push(e.payload.note);
        if (e.payload.source === "world_note") worldNotes += 1;
      }
    }

    return { startEventId: premier.id, afterEventId: dernier.id, afterSeq: dernier.seq, time, changes, hints, ignored, worldNotes, last: n === debuts.length - 1 };
  });
}

const hhmm = (t: GameTime): string => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;

/** Le texte de la pastille d'heure : « +8 h · 06:08, jour 2 », « +2 min · 22:56 », « Round · 6 s ». */
export function timeChipText(time: TurnTime): string {
  if (time.kind === "combat") return `Round · ${SECONDES_PAR_ROUND} s`;
  const duree = time.minutes === 0 ? "moins d'une minute" : `+${libelleDuree(time.minutes)}`;
  return `${duree} · ${hhmm(time.after)}${time.dayChanged ? `, jour ${time.after.day}` : ""}`;
}
