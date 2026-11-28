import { describe, expect, it } from "vitest";
import { lastUndoableTurn, undoneEventIds, type JournalEvent } from "./turnUndo";

/**
 * V3-F2 — annuler un tour du solo. Un tour commence à une action de la joueuse
 * (`player_action` ou `roll` d'acteur `player`) et court jusqu'à la fin du
 * journal ; le journal ne s'efface jamais, une annulation y écrit un événement
 * `system` qui nomme les événements défaits.
 */
const ev = (id: string, seq: number, kind: string, actor: string, payload: Record<string, unknown> = {}): JournalEvent => ({ id, seq, kind, actor, payload });

describe("lastUndoableTurn", () => {
  const journal = [
    ev("a1", 1, "player_action", "player", { undo_before: { entity_id: "pj", runtime: { hp: 10 }, scene: null } }),
    ev("n1", 2, "narration", "ai"),
    ev("r2", 3, "roll", "player", { undo_before: { entity_id: "pj", runtime: { hp: 9 }, scene: { time: 5 } } }),
    ev("u2", 4, "rule_application", "system"),
    ev("n2", 5, "narration", "ai"),
  ];

  it("le dernier tour : de la dernière action de la joueuse à la fin, avec l'état d'avant", () => {
    expect(lastUndoableTurn(journal)).toEqual({ startId: "r2", startSeq: 3, eventIds: ["r2", "u2", "n2"], before: { entity_id: "pj", runtime: { hp: 9 }, scene: { time: 5 } } });
  });

  it("après une annulation, le tour suivant remonte plus loin ; jamais deux fois le même", () => {
    const apres = [...journal, ev("x1", 6, "system", "player", { undo_turn: { event_ids: ["r2", "u2", "n2"] } })];
    expect(undoneEventIds(apres)).toEqual(new Set(["r2", "u2", "n2"]));
    expect(lastUndoableTurn(apres)).toMatchObject({ startId: "a1", eventIds: ["a1", "n1"] });
  });

  it("V3.2-8 : rend l'inventaire relevé, y compris « pas d'inventaire » (null), et rien pour un tour d'avant", () => {
    const releve = { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 1, ep: 0, sp: 0, cp: 0 } };
    expect(lastUndoableTurn([ev("a", 1, "player_action", "player", { undo_before: { entity_id: "pj", runtime: null, scene: null, inventory: releve } })])?.before?.inventory).toEqual(releve);
    expect(lastUndoableTurn([ev("a", 1, "player_action", "player", { undo_before: { entity_id: "pj", runtime: null, scene: null, inventory: null } })])?.before?.inventory).toBeNull();
    expect(lastUndoableTurn([ev("a", 1, "player_action", "player", { undo_before: { entity_id: "pj", runtime: null, scene: null } })])?.before?.inventory).toBeUndefined();
  });

  it("ADR 0123 : rend les sacs d'autres fiches remplis pendant le tour (un voleur), le plus ancien relevé par fiche", () => {
    const sac = { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 2, ep: 0, sp: 0, cp: 0 } };
    const tour = lastUndoableTurn([
      ev("a", 1, "player_action", "player", { undo_before: { entity_id: "pj", runtime: null, scene: null } }),
      ev("p", 2, "rule_application", "system", { others_inventory_before: [{ entity_id: "voleur", inventory: sac }, { entity_id: "x", inventory: null }] }),
      ev("q", 3, "rule_application", "system", { others_inventory_before: [{ entity_id: "voleur", inventory: { autre: 1 } }, { pas: "valide" }] }),
    ]);
    expect(tour?.othersInventoryBefore).toEqual([{ entity_id: "voleur", inventory: sac }, { entity_id: "x", inventory: null }]);
    expect(lastUndoableTurn(journal)?.othersInventoryBefore).toBeUndefined();
  });

  it("un tour sans état relevé (journal d'avant V3-F2) se défait sans restaurer d'état", () => {
    expect(lastUndoableTurn([ev("a", 1, "player_action", "player"), ev("n", 2, "narration", "ai")])).toMatchObject({ startId: "a", before: null });
  });

  it("rien à annuler : journal vide, ou seulement des événements sans action de la joueuse", () => {
    expect(lastUndoableTurn([])).toBeNull();
    expect(lastUndoableTurn([ev("n", 1, "narration", "ai"), ev("w", 2, "world_update", "system")])).toBeNull();
  });

  it("un jet du MJ ou du combat ne commence pas un tour du solo", () => {
    expect(lastUndoableTurn([ev("c", 1, "combat", "gm"), ev("r", 2, "roll", "gm")])).toBeNull();
  });
});
