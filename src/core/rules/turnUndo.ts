/**
 * V3-F2 — annuler un tour du solo (PDD §29 « Annulation »). Fonctions pures
 * sur le journal (`session_events`), qui reste en ajout seul : une annulation
 * y écrit un événement `system` portant `undo_turn.event_ids`, jamais une
 * suppression. Un tour commence à une action de la joueuse (`player_action`
 * ou `roll` d'acteur `player`) et court jusqu'à la fin du journal non défait.
 */

export interface JournalEvent {
  id: string;
  seq: number;
  kind: string;
  actor: string;
  payload: Record<string, unknown>;
}

/** L'état relevé au début du tour (`undo_before` du premier événement) : le personnage, la scène et, depuis V3.2-8, l'inventaire. */
export interface TurnBefore {
  entity_id: string;
  runtime: unknown;
  scene: unknown;
  /** V3.2-8 : l'inventaire du personnage (`null` : il n'en avait pas). Absent d'un tour journalisé avant : rien à restaurer. */
  inventory?: unknown;
}

export interface UndoableTurn {
  startId: string;
  startSeq: number;
  /** Les événements du tour, dans l'ordre du journal. */
  eventIds: string[];
  /** `null` : un tour journalisé avant V3-F2, sans état relevé. */
  before: TurnBefore | null;
  /** ADR 0123 : les sacs d'autres fiches que le tour a remplis (un voleur), tels qu'avant le tour. Absent : aucun. */
  othersInventoryBefore?: { entity_id: string; inventory: unknown }[];
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Les événements déjà défaits par une annulation précédente. */
export function undoneEventIds(events: readonly JournalEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    const undo = e.payload.undo_turn;
    if (e.kind !== "system" || !estObjet(undo) || !Array.isArray(undo.event_ids)) continue;
    for (const id of undo.event_ids) if (typeof id === "string") out.add(id);
  }
  return out;
}

const estAnnulation = (e: JournalEvent): boolean => e.kind === "system" && estObjet(e.payload.undo_turn);
const commenceUnTour = (e: JournalEvent): boolean => e.actor === "player" && (e.kind === "player_action" || e.kind === "roll");

function avantDe(e: JournalEvent): TurnBefore | null {
  const b = e.payload.undo_before;
  if (!estObjet(b) || typeof b.entity_id !== "string") return null;
  return { entity_id: b.entity_id, runtime: b.runtime ?? null, scene: b.scene ?? null, ...("inventory" in b ? { inventory: b.inventory ?? null } : {}) };
}

/** Le dernier tour encore annulable, ou `null`. Un second appel, après annulation, remonte d'un tour. */
export function lastUndoableTurn(events: readonly JournalEvent[]): UndoableTurn | null {
  const defaits = undoneEventIds(events);
  const vivants = [...events].sort((a, b) => a.seq - b.seq).filter((e) => !defaits.has(e.id) && !estAnnulation(e));
  let debut = -1;
  for (let i = vivants.length - 1; i >= 0; i--) {
    if (commenceUnTour(vivants[i]!)) {
      debut = i;
      break;
    }
  }
  if (debut < 0) return null;
  const tour = vivants.slice(debut);
  const premier = tour[0]!;
  const autres = autresSacsAvant(tour);
  return { startId: premier.id, startSeq: premier.seq, eventIds: tour.map((e) => e.id), before: avantDe(premier), ...(autres.length > 0 ? { othersInventoryBefore: autres } : {}) };
}

/** Les relevés `others_inventory_before` du tour ; pour une fiche relevée deux fois, le premier (l'état d'avant le tour). */
function autresSacsAvant(tour: readonly JournalEvent[]): { entity_id: string; inventory: unknown }[] {
  const vus = new Map<string, unknown>();
  for (const e of tour) {
    const lot = e.payload.others_inventory_before;
    if (!Array.isArray(lot)) continue;
    for (const r of lot) {
      if (!estObjet(r) || typeof r.entity_id !== "string" || vus.has(r.entity_id)) continue;
      vus.set(r.entity_id, r.inventory ?? null);
    }
  }
  return [...vus].map(([entity_id, inventory]) => ({ entity_id, inventory }));
}
