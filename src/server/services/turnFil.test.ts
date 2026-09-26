import { describe, expect, it } from "vitest";
import { mapSessionEventToFilItem } from "./turnFil";
import type { SessionEventRow } from "@/src/server/repos/sessions";

/**
 * V3-D4 — `mapSessionEventToFilItem` traduit une ligne `session_events`
 * brute (le format que chaque écriture de B1/B2/B4/B5 choisit pour SON
 * propre besoin) en la forme unique que le fil affiche. Verrouillé par
 * test parce que c'est le seul endroit qui doit connaître ces formes : le
 * jour où l'un des payloads change, ce fichier doit rougir avant l'écran.
 */

function row(overrides: Partial<SessionEventRow>): SessionEventRow {
  return {
    id: "evt-1",
    session_id: "sess-1",
    seq: 1,
    kind: "player_action",
    actor: "player",
    actor_user_id: "user-1",
    payload: {},
    created_at: "2026-09-24T10:00:00Z",
    ...overrides,
  };
}

describe("mapSessionEventToFilItem", () => {
  it("narration : texte et reaction de PNJ eventuelle", () => {
    const item = mapSessionEventToFilItem(
      row({ kind: "narration", payload: { __v: 1, text: "La porte grince.", npc_reaction: { npc_id: "pnj-1", text: "Qui va la ?" } } })
    );
    expect(item).toEqual({
      id: "evt-1",
      seq: 1,
      createdAt: "2026-09-24T10:00:00Z",
      kind: "narration",
      text: "La porte grince.",
      npcReaction: { npcId: "pnj-1", text: "Qui va la ?" },
    });
  });

  it("narration sans reaction de PNJ : npcReaction reste null, jamais absent", () => {
    const item = mapSessionEventToFilItem(row({ kind: "narration", payload: { text: "Le silence retombe.", npc_reaction: null } }));
    expect(item.kind).toBe("narration");
    expect((item as { npcReaction: unknown }).npcReaction).toBeNull();
  });

  it("player_action : reprend le texte de l'intention et les faits", () => {
    const item = mapSessionEventToFilItem(
      row({ kind: "player_action", payload: { intent: { text: "je regarde autour de moi" }, facts: ["Perrin : je regarde autour de moi"], resolution: "aucune" } })
    );
    expect(item).toMatchObject({ kind: "player_action", text: "je regarde autour de moi", facts: ["Perrin : je regarde autour de moi"] });
  });

  it("roll — test/sauvegarde : lit `check`", () => {
    const item = mapSessionEventToFilItem(
      row({
        kind: "roll",
        payload: {
          facts: ["Perrin — Athlétisme : 14 contre DD 12 — réussite."],
          check: { what: "Athlétisme", expression: "14 (annoncé) + 2", total: 14, dc: 12, verdict: "success", trace: [{ text: "annoncé", value: 12 }] },
          origin: "a_la_main",
        },
      })
    );
    expect(item).toMatchObject({
      kind: "roll",
      facts: ["Perrin — Athlétisme : 14 contre DD 12 — réussite."],
      total: 14,
      verdict: "success",
      origin: "a_la_main",
    });
  });

  it("roll — attaque : lit `attack`, traduit hit/miss en success/fail", () => {
    const hit = mapSessionEventToFilItem(
      row({ kind: "roll", payload: { facts: ["touché"], attack: { expression: "1d20+5", total: 18, critical: false, trace: [] }, ac: 15, verdict: "hit", damage: null, origin: "fiche" } })
    );
    expect(hit).toMatchObject({ kind: "roll", total: 18, verdict: "success", origin: "fiche" });

    const miss = mapSessionEventToFilItem(
      row({ kind: "roll", payload: { facts: ["raté"], attack: { expression: "1d20+5", total: 8, critical: false, trace: [] }, ac: 15, verdict: "miss", damage: null, origin: "fiche" } })
    );
    expect(miss).toMatchObject({ kind: "roll", total: 8, verdict: "fail" });
  });

  it("roll — degats : lit `damage`, jamais de verdict (un degat ne reussit ni n'echoue)", () => {
    const item = mapSessionEventToFilItem(
      row({ kind: "roll", payload: { facts: ["7 degats"], attack: null, ac: null, verdict: null, damage: { expression: "1d6+3", total: 7, trace: [] }, origin: "volet" } })
    );
    expect(item).toMatchObject({ kind: "roll", total: 7, verdict: null, origin: "volet" });
  });

  it("rule_application : relit changes_text/hints_text/ignored_text, jamais recalcule depuis `changes`", () => {
    const item = mapSessionEventToFilItem(
      row({
        kind: "rule_application",
        payload: { changes: [{ kind: "hp" }], changes_text: ["Gobelin 2 : 7 → 2 PV"], hints_text: ["une prose possible"], ignored_text: ["portee inconnue"] },
      })
    );
    expect(item).toEqual({
      id: "evt-1",
      seq: 1,
      createdAt: "2026-09-24T10:00:00Z",
      kind: "rule_application",
      changes: ["Gobelin 2 : 7 → 2 PV"],
      hints: ["une prose possible"],
      ignored: ["portee inconnue"],
    });
  });

  it("world_update : la note telle quelle, qu'elle vienne d'un tour ou d'une demande posee/abandonnee/honoree", () => {
    const item = mapSessionEventToFilItem(row({ kind: "world_update", payload: { entity_id: "e1", patch: {}, note: "Jet demandé : Discrétion" } }));
    expect(item).toEqual({ id: "evt-1", seq: 1, createdAt: "2026-09-24T10:00:00Z", kind: "world_update", note: "Jet demandé : Discrétion" });
  });

  it("note : la reponse du MJ a une question posee hors du temps de jeu (V3-D4, bouton MJ)", () => {
    const item = mapSessionEventToFilItem(row({ kind: "note", payload: { question: "Combien de PV me reste-t-il ?", answer: "Il t'en reste 7 sur 12." } }));
    expect(item).toEqual({
      id: "evt-1",
      seq: 1,
      createdAt: "2026-09-24T10:00:00Z",
      kind: "note",
      question: "Combien de PV me reste-t-il ?",
      answer: "Il t'en reste 7 sur 12.",
    });
  });

  it("un genre inattendu (system, jamais ecrit aujourd'hui) tombe sur un repli, jamais une exception", () => {
    const item = mapSessionEventToFilItem(row({ kind: "system", payload: { anything: true } }));
    expect(item).toEqual({ id: "evt-1", seq: 1, createdAt: "2026-09-24T10:00:00Z", kind: "other", label: "system" });
  });

  it("un roll sans check/attack/damage (ne devrait jamais arriver) ne casse pas l'ecran", () => {
    const item = mapSessionEventToFilItem(row({ kind: "roll", payload: { facts: ["?"], origin: null } }));
    expect(item).toMatchObject({ kind: "roll", total: null, verdict: null, trace: [] });
  });
});
