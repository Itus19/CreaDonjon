import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3.1-43 — « Assigner, annuler un devoir ; chaque geste journalisé une
 * fois. » Le geste s'écrit dans `session_events` de la campagne (événement
 * `system` du MJ), comme les demandes de sauvegarde. Annuler un devoir déjà
 * effacé (ou que la RLS refuse d'effacer) ne journalise rien.
 */
const evenements: { kind: string; actor: string; actorUserId: string | null; payload: unknown }[] = [];
let supprime: { id: string; campaign_id: string; assigned_to: string } | null = null;

vi.mock("@/src/server/repos/sessionJournal", () => ({
  insertAssignment: async (_s: unknown, p: { campaignId: string; assignedTo: string }) => ({ id: "a1", campaign_id: p.campaignId, assigned_to: p.assignedTo, status: "pending" }),
  deleteAssignment: async () => supprime,
  getAssignmentById: async () => null,
  markWritten: async () => null,
  listAssignmentsForCampaign: async () => [],
  listPendingAssignmentsForUser: async () => [],
  claimJournalEntryGrant: async () => null,
}));
vi.mock("@/src/server/services/sessions", () => ({ getOrOpenSessionForCampaign: async () => "s1" }));
vi.mock("@/src/server/repos/sessions", () => ({
  nextEventSeq: async () => 7,
  insertSessionEvent: async (_s: unknown, p: { kind: string; actor: string; actorUserId: string | null; payload: unknown }) => {
    evenements.push(p);
    return { id: "ev" };
  },
}));
vi.mock("@/src/server/services/scheduling", () => ({ resolvePlayerNames: async () => new Map([["u-ines", "Inès"]]) }));
vi.mock("@/src/server/repos/campaigns", () => ({ listCampaignMembers: async () => [] }));
vi.mock("@/src/server/services/entities", () => ({ createEntity: async () => null }));
vi.mock("@/src/server/repos/blocks", () => ({ insertBlock: async () => null }));
vi.mock("@/src/server/services/worlds", () => ({ getCalendar: async () => null }));
vi.mock("@/src/server/services/sessionJournalTree", () => ({ SESSION_JOURNAL_KIND: "session_journal", getLatestSessionJournalSlug: async () => null, getSessionJournalTreeGroup: async () => null }));

const { assignJournalEntry, cancelJournalAssignment } = await import("./sessionJournal");
const supabase = {} as SupabaseClient<Database>;

beforeEach(() => {
  evenements.length = 0;
  supprime = null;
});

describe("gestes du Livre de sessions journalisés (V3.1-43)", () => {
  it("assigner un devoir : un événement, attribué au MJ, qui nomme l'autrice", async () => {
    await assignJournalEntry(supabase, { campaignId: "c1", ingameDate: { year: 1492, month: 2, day: 14, precision: "day", end: null, label: null }, assignedTo: "u-ines", createdBy: "u-mj" });
    expect(evenements).toHaveLength(1);
    expect(evenements[0]).toMatchObject({ kind: "system", actor: "gm", actorUserId: "u-mj" });
    // `note` : le libellé que le journal historique affiche.
    expect(evenements[0].payload).toMatchObject({ note: "Livre de sessions : devoir assigné à Inès." });
    expect(evenements[0].payload).toMatchObject({ journal_assignment: { action: "assign", assignmentId: "a1", assignedTo: "u-ines" } });
  });

  it("annuler un devoir effacé : un événement", async () => {
    supprime = { id: "a1", campaign_id: "c1", assigned_to: "u-ines" };
    await cancelJournalAssignment(supabase, { id: "a1", callerId: "u-mj" });
    expect(evenements).toHaveLength(1);
    expect(evenements[0].payload).toMatchObject({ journal_assignment: { action: "cancel", assignmentId: "a1", assignedTo: "u-ines" } });
  });

  it("annuler un devoir qui n'existe plus (ou refusé par la RLS) : rien n'est journalisé", async () => {
    await cancelJournalAssignment(supabase, { id: "a-x", callerId: "u-mj" });
    expect(evenements).toHaveLength(0);
  });
});
