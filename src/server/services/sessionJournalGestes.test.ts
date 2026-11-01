import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * Le devoir de journal, côté service (V3.1-43, V3.1-150) : chaque geste
 * s'écrit une fois au journal de la campagne ; assigner crée la page,
 * « Devoir fait » la publie avant de changer l'état, le MJ seul valide.
 * Les dépôts sont des doublures : ce test vérifie l'ordre et les refus du
 * service. La base (RLS, `submit_journal_assignment`) a son test
 * d'intégration.
 */
const appels: string[] = [];
const evenements: { kind: string; actor: string; actorUserId: string | null; payload: unknown }[] = [];
type Devoir = { id: string; campaign_id: string; assigned_to: string; status: string; entity_id: string | null; ingame_date: unknown; written_at: string | null };
let devoir: Devoir | null = null;
let supprime: Devoir | null = null;
let admin = true;
let echecBloc = false;
let conflitPage = false;
let renduAccepte = true;

const DATE = { year: 1492, month: 2, day: 14, precision: "day", end: null, label: null } as const;

vi.mock("@/src/server/repos/sessionJournal", () => ({
  insertAssignment: async (_s: unknown, p: { campaignId: string; assignedTo: string; entityId: string }) => {
    appels.push(`devoir:${p.entityId}`);
    return { id: "a1", campaign_id: p.campaignId, assigned_to: p.assignedTo, status: "pending", entity_id: p.entityId };
  },
  deleteAssignment: async () => {
    appels.push("effacer-devoir");
    return supprime;
  },
  getAssignmentById: async () => devoir,
  getAssignmentByEntityId: async () => devoir,
  submitAssignment: async () => {
    appels.push("rendre");
    return renduAccepte;
  },
  markValidated: async () => {
    appels.push("valider");
    return devoir;
  },
  listAssignmentsForCampaign: async () => [],
  listOpenAssignmentsForUser: async () => [],
}));
vi.mock("@/src/server/services/entities", () => ({
  createEntity: async (_s: unknown, p: { name: string; entityKind: string }) => {
    appels.push(`page:${p.name}:${p.entityKind}`);
    return { id: "e1", slug: "52" };
  },
  updateEntity: async (_s: unknown, p: { isPublic: boolean }) => {
    appels.push(`publique:${p.isPublic}`);
    return conflitPage ? { ok: false, reason: "conflict" } : { ok: true };
  },
}));
vi.mock("@/src/server/services/blocks", () => ({
  updateBlockContent: async (_s: unknown, p: { data: { writtenAt: string | null } }) => {
    appels.push(`date:${p.data.writtenAt ? "posée" : "vide"}`);
    return { ok: true };
  },
}));
vi.mock("@/src/server/repos/blocks", () => ({
  insertBlock: async (_s: unknown, p: { blockType: string }) => {
    if (echecBloc) throw new Error("bloc refusé");
    appels.push(`bloc:${p.blockType}`);
    return {};
  },
  listBlocksForEntity: async () => [
    { id: "b1", block_type: "session_journal_meta", version: 1, display: {}, visibility_level: "players", visibility_scope_id: null, data: { __v: 1, ingameDate: DATE, writtenBy: null, writtenAt: null, realSession: null } },
  ],
}));
vi.mock("@/src/server/repos/entities", () => ({
  getEntityById: async () => ({ id: "e1", slug: "52", name: "Journal", entity_kind: "session_journal", aliases: [], is_public: false, version: 3 }),
  softDeleteEntity: async (_s: unknown, id: string) => {
    appels.push(`effacer-page:${id}`);
    return { deleted: true };
  },
}));
vi.mock("@/src/server/repos/entityGrants", () => ({
  grantEntityAccess: async (_s: unknown, p: { userId: string }) => {
    appels.push(`octroi:${p.userId}`);
    return {};
  },
}));
vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => admin }));
vi.mock("@/src/server/repos/campaigns", () => ({
  getCampaignById: async (_s: unknown, id: string) => (id === "c1" ? { id: "c1", world_id: "w1" } : null),
  listCampaignMembers: async () => [
    { user_id: "u-mj", role: "gm" },
    { user_id: "u-ines", role: "player" },
  ],
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
vi.mock("@/src/server/services/worlds", () => ({ getCalendar: async () => null }));
vi.mock("@/src/core/calendar/formatDate", () => ({ formatGameDate: () => "14 Mirtul 1492" }));
vi.mock("@/src/server/services/sessionJournalTree", () => ({ SESSION_JOURNAL_KIND: "session_journal", getLatestSessionJournalSlug: async () => null, getSessionJournalTreeGroup: async () => null }));

const { assignJournalEntry, cancelJournalAssignment, submitMyJournalAssignment, validateJournalAssignment } = await import("./sessionJournal");
const supabase = {} as SupabaseClient<Database>;

const unDevoir = (status: string, assignedTo = "u-ines"): Devoir => ({ id: "a1", campaign_id: "c1", assigned_to: assignedTo, status, entity_id: "e1", ingame_date: DATE, written_at: null });

beforeEach(() => {
  appels.length = 0;
  evenements.length = 0;
  devoir = null;
  supprime = null;
  admin = true;
  echecBloc = false;
  conflitPage = false;
  renduAccepte = true;
});

describe("assigner un devoir (V3.1-150 : la page naît avec lui)", () => {
  it("crée la page au titre provisoire, l'octroi à l'autrice, les deux blocs, puis le devoir qui la désigne ; un événement au nom du MJ", async () => {
    const r = await assignJournalEntry(supabase, { campaignId: "c1", ingameDate: DATE, assignedTo: "u-ines", createdBy: "u-mj" });
    expect(r.ok).toBe(true);
    expect(appels).toEqual(["page:Journal · 14 Mirtul 1492:session_journal", "octroi:u-ines", "bloc:session_journal_meta", "bloc:text", "devoir:e1"]);
    expect(evenements).toHaveLength(1);
    expect(evenements[0]).toMatchObject({ kind: "system", actor: "gm", actorUserId: "u-mj" });
    expect(evenements[0].payload).toMatchObject({ note: "Livre de sessions : devoir assigné à Inès.", journal_assignment: { action: "assign", assignmentId: "a1", assignedTo: "u-ines" } });
  });

  it("un non-MJ est refusé avant toute écriture", async () => {
    admin = false;
    expect(await assignJournalEntry(supabase, { campaignId: "c1", ingameDate: DATE, assignedTo: "u-ines", createdBy: "u-ines" })).toEqual({ ok: false, reason: "forbidden" });
    expect(appels).toEqual([]);
  });

  it("une autrice hors de la campagne est refusée : l'octroi lui donnerait l'édition d'une fiche du monde", async () => {
    expect(await assignJournalEntry(supabase, { campaignId: "c1", ingameDate: DATE, assignedTo: "u-etrangere", createdBy: "u-mj" })).toEqual({ ok: false, reason: "not_member" });
    expect(appels).toEqual([]);
  });

  it("une écriture ratée en chemin efface la page à moitié créée", async () => {
    echecBloc = true;
    await expect(assignJournalEntry(supabase, { campaignId: "c1", ingameDate: DATE, assignedTo: "u-ines", createdBy: "u-mj" })).rejects.toThrow("bloc refusé");
    expect(appels).toContain("effacer-page:e1");
    expect(appels.some((a) => a.startsWith("devoir:"))).toBe(false);
    expect(evenements).toHaveLength(0);
  });
});

describe("annuler un devoir", () => {
  it("en cours : le devoir et sa page sont effacés, un événement", async () => {
    devoir = unDevoir("pending");
    supprime = devoir;
    expect(await cancelJournalAssignment(supabase, { id: "a1", campaignId: "c1", callerId: "u-mj" })).toEqual({ ok: true });
    expect(appels).toEqual(["effacer-devoir", "effacer-page:e1"]);
    expect(evenements[0].payload).toMatchObject({ journal_assignment: { action: "cancel", assignmentId: "a1", assignedTo: "u-ines" } });
  });

  it("rendu : il ne s'annule plus (le rendu est définitif)", async () => {
    devoir = unDevoir("written");
    expect(await cancelJournalAssignment(supabase, { id: "a1", campaignId: "c1", callerId: "u-mj" })).toEqual({ ok: false, reason: "already_submitted" });
    expect(appels).toEqual([]);
  });

  it("d'une autre campagne que celle de l'adresse : introuvable", async () => {
    devoir = unDevoir("pending");
    expect(await cancelJournalAssignment(supabase, { id: "a1", campaignId: "c-autre", callerId: "u-mj" })).toEqual({ ok: false, reason: "not_found" });
    expect(appels).toEqual([]);
  });

  it("refusé par la RLS (une joueuse) : rien n'est effacé ni journalisé", async () => {
    devoir = unDevoir("pending");
    supprime = null;
    expect(await cancelJournalAssignment(supabase, { id: "a1", campaignId: "c1", callerId: "u-ines" })).toEqual({ ok: false, reason: "forbidden" });
    expect(appels).toEqual(["effacer-devoir"]);
    expect(evenements).toHaveLength(0);
  });
});

describe("« Devoir fait »", () => {
  it("publie la page, date le bloc Séance, PUIS rend le devoir ; un événement au nom de l'autrice", async () => {
    devoir = unDevoir("pending");
    expect(await submitMyJournalAssignment(supabase, { assignmentId: "a1", userId: "u-ines" })).toEqual({ ok: true, slug: "52" });
    expect(appels).toEqual(["publique:true", "date:posée", "rendre"]);
    expect(evenements[0]).toMatchObject({ actor: "player", actorUserId: "u-ines" });
    expect(evenements[0].payload).toMatchObject({ note: "Livre de sessions : Inès a rendu son devoir." });
  });

  it("le devoir d'une autre : refusé, rien n'est écrit", async () => {
    devoir = unDevoir("pending", "u-bruno");
    expect(await submitMyJournalAssignment(supabase, { assignmentId: "a1", userId: "u-ines" })).toEqual({ ok: false, reason: "forbidden" });
    expect(appels).toEqual([]);
  });

  it("déjà rendu : refusé, rien n'est écrit", async () => {
    devoir = unDevoir("written");
    expect(await submitMyJournalAssignment(supabase, { assignmentId: "a1", userId: "u-ines" })).toEqual({ ok: false, reason: "already_submitted" });
    expect(appels).toEqual([]);
  });

  it("la page n'a pas pu être publiée : le devoir reste à rendre", async () => {
    devoir = unDevoir("pending");
    conflitPage = true;
    expect(await submitMyJournalAssignment(supabase, { assignmentId: "a1", userId: "u-ines" })).toEqual({ ok: false, reason: "conflict" });
    expect(appels).not.toContain("rendre");
    expect(evenements).toHaveLength(0);
  });

  it("la base refuse le rendu : pas d'événement", async () => {
    devoir = unDevoir("pending");
    renduAccepte = false;
    expect(await submitMyJournalAssignment(supabase, { assignmentId: "a1", userId: "u-ines" })).toEqual({ ok: false, reason: "already_submitted" });
    expect(evenements).toHaveLength(0);
  });
});

describe("le MJ valide", () => {
  it("un non-MJ est refusé, avant même de savoir si le devoir existe", async () => {
    admin = false;
    expect(await validateJournalAssignment(supabase, { campaignId: "c1", assignmentId: "a1", callerId: "u-ines" })).toEqual({ ok: false, reason: "forbidden" });
    expect(appels).toEqual([]);
  });

  it("un devoir pas encore rendu ne se valide pas", async () => {
    devoir = unDevoir("pending");
    expect(await validateJournalAssignment(supabase, { campaignId: "c1", assignmentId: "a1", callerId: "u-mj" })).toEqual({ ok: false, reason: "not_submitted" });
    expect(appels).toEqual([]);
  });

  it("un devoir rendu : validé, un événement", async () => {
    devoir = unDevoir("written");
    expect(await validateJournalAssignment(supabase, { campaignId: "c1", assignmentId: "a1", callerId: "u-mj" })).toEqual({ ok: true });
    expect(appels).toEqual(["valider"]);
    expect(evenements[0].payload).toMatchObject({ note: "Livre de sessions : devoir de Inès validé." });
  });
});
