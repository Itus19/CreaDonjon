import { describe, expect, it } from "vitest";
import { summarizeTurns, timeChipText } from "./turnSummary";
import { phraseDuree } from "./elapsed";
import type { JournalEvent } from "./turnUndo";

const scene = (day: number, hour: number, minute: number, activeCombatId: string | null = null) => ({ time: { day, hour, minute }, activeCombatId });
const action = (id: string, seq: number, before: unknown): JournalEvent => ({ id, seq, kind: "player_action", actor: "player", payload: { undo_before: { entity_id: "pj", runtime: null, scene: before } } });
const ev = (id: string, seq: number, kind: string, payload: Record<string, unknown> = {}, actor = "system"): JournalEvent => ({ id, seq, kind, actor, payload });

describe("summarizeTurns — la ligne de chaque tour", () => {
  it("le temps d'un tour va de son début au début du suivant ; le dernier, jusqu'à l'heure de la scène", () => {
    const events = [action("a1", 1, scene(1, 22, 0)), ev("n1", 2, "narration", {}, "ai"), action("a2", 3, scene(1, 22, 8)), ev("n2", 4, "narration", {}, "ai")];
    const [t1, t2] = summarizeTurns(events, { day: 2, hour: 6, minute: 8 });
    expect(t1).toMatchObject({ startEventId: "a1", afterEventId: "n1", time: { kind: "elapsed", minutes: 8, dayChanged: false }, last: false });
    expect(t2).toMatchObject({ afterEventId: "n2", time: { kind: "elapsed", minutes: 480, after: { day: 2, hour: 6, minute: 8 }, dayChanged: true }, last: true });
  });

  it("en combat, un tour est un round de 6 secondes", () => {
    const [t] = summarizeTurns([action("a1", 1, scene(1, 22, 0, "combat-1"))], { day: 1, hour: 22, minute: 0 });
    expect(t!.time).toEqual({ kind: "combat" });
    expect(timeChipText(t!.time!)).toBe("Round · 6 s");
  });

  it("rassemble les changements du moteur et du monde, sans répéter la phrase de durée", () => {
    const events = [
      action("a1", 1, scene(1, 22, 0)),
      ev("r1", 2, "rule_application", { changes_text: ["PV 20 → 25", phraseDuree(480, { day: 2, hour: 6, minute: 0 })], hints_text: ["Un conseil"], ignored_text: ["Effet inconnu"] }),
      ev("n1", 3, "narration", {}, "ai"),
      ev("w1", 4, "world_update", { note: "Pièce « une chambre » ajoutée" }),
      ev("w2", 5, "world_update", { note: "Ajouté au wiki : « Les chambres sentent le bois. »", source: "world_note" }),
    ];
    const [t] = summarizeTurns(events, null);
    expect(t).toMatchObject({ changes: ["PV 20 → 25", "Pièce « une chambre » ajoutée", "Ajouté au wiki : « Les chambres sentent le bois. »"], hints: ["Un conseil"], ignored: ["Effet inconnu"], worldNotes: 1, afterEventId: "w2", time: null });
  });

  it("V3.2-69 : la demande honorée est de la tenue de compte, pas un changement ; la demande posée ou abandonnée reste", () => {
    const events = [
      action("a1", 1, scene(1, 22, 0)),
      ev("w1", 2, "world_update", { note: "Jet demandé : Attaque — épée longue", patch: { pending_request: { what: "Attaque — épée longue" } } }),
      ev("w2", 3, "world_update", { note: "Demande honorée", patch: { pending_request: null } }),
    ];
    const [t] = summarizeTurns(events, null);
    expect(t!.changes).toEqual(["Jet demandé : Attaque — épée longue"]);
    expect(t!.afterEventId).toBe("w2");
  });

  it("ce qui précède la première action n'appartient à aucun tour ; un tour sans relevé n'a pas d'heure", () => {
    const events = [ev("w0", 1, "world_update", { note: "Scène posée" }), { ...action("a1", 2, null), payload: {} }];
    const tours = summarizeTurns(events, { day: 1, hour: 8, minute: 0 });
    expect(tours).toHaveLength(1);
    expect(tours[0]!.changes).toEqual([]);
    expect(tours[0]!.time).toBeNull();
  });

  it("une heure qui recule (scène réinitialisée) ne donne pas de durée négative", () => {
    const [t] = summarizeTurns([action("a1", 1, scene(2, 8, 0))], { day: 1, hour: 8, minute: 0 });
    expect(t!.time).toBeNull();
  });
});

describe("timeChipText", () => {
  it("la durée et l'heure, le jour seulement s'il change", () => {
    expect(timeChipText({ kind: "elapsed", minutes: 480, after: { day: 2, hour: 6, minute: 8 }, dayChanged: true })).toBe("+8 h · 06:08, jour 2");
    expect(timeChipText({ kind: "elapsed", minutes: 2, after: { day: 1, hour: 22, minute: 56 }, dayChanged: false })).toBe("+2 min · 22:56");
    expect(timeChipText({ kind: "elapsed", minutes: 0, after: { day: 1, hour: 9, minute: 0 }, dayChanged: false })).toBe("moins d'une minute · 09:00");
  });
});
