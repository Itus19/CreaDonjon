import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";
import { assignJournalEntry, cancelJournalAssignment, submitMyJournalAssignment, validateJournalAssignment } from "./sessionJournal";
import { listPlayerVisibleEntityIds, searchEntities } from "./entities";
import { getPlayerEntityDetail } from "./playerEntityDetail";
import { listWrittenEntriesForWorld } from "../repos/sessionJournal";

/**
 * V3.1-150 (ADR 0071) — le devoir de journal contre la base réelle :
 * assigner crée la page ; le brouillon n'existe que pour l'autrice et le MJ ;
 * l'autrice ne touche à son devoir que par `submit_journal_assignment` (elle
 * ne se valide pas, ne rend pas celui d'une autre) ; « Devoir fait » publie ;
 * le MJ seul valide ; annuler un devoir en cours efface sa page.
 *
 * Exige la migration `20261102130000_session_journal_devoir` : un échec sur
 * un refus veut d'abord dire « migration pas appliquée » (docs/TESTS.md §4 bis).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const DATE = { year: 1492, month: 2, day: 14, precision: "day" as const, end: null, label: null };

describe.skipIf(!hasCreds)("devoir de journal (V3.1-150, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let autre: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let devoirId: string;
  let pageId: string;
  let pageSlug: string;

  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;
  const etat = async (id: string) => (await admin.from("session_journal_entries").select("status").eq("id", id).single()).data?.status;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse, autre] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player"), getReusableTestAccount(admin, "playerB")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test devoir", slug: `integration-test-devoir-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: joueuse.id, role: "player" },
      { campaign_id: campaignId, user_id: autre.id, role: "player" },
    ]);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("assigner crée la page (non publique), l'octroi de l'autrice et le devoir en cours ; une joueuse ne peut pas assigner", async () => {
    expect(await assignJournalEntry(client(joueuse), { campaignId, ingameDate: DATE, assignedTo: joueuse.id, createdBy: joueuse.id })).toEqual({ ok: false, reason: "forbidden" });

    const r = await assignJournalEntry(client(gm), { campaignId, ingameDate: DATE, assignedTo: joueuse.id, createdBy: gm.id });
    if (!r.ok) throw new Error(r.reason);
    devoirId = r.assignment.id;
    expect(r.assignment.status).toBe("pending");
    pageId = r.assignment.entity_id!;
    const { data: page } = await admin.from("entities").select("slug, is_public, entity_kind").eq("id", pageId).single();
    expect(page).toMatchObject({ is_public: false, entity_kind: "session_journal" });
    pageSlug = page!.slug;
    const { data: octroi } = await admin.from("entity_grants").select("user_id").eq("entity_id", pageId);
    expect(octroi?.map((g) => g.user_id)).toEqual([joueuse.id]);
    const { data: blocs } = await admin.from("blocks").select("block_type").eq("entity_id", pageId);
    expect(blocs?.map((b) => b.block_type).sort()).toEqual(["session_journal_meta", "text"]);
  });

  it("le brouillon n'existe que pour l'autrice : ni liste, ni recherche, ni lecture directe pour une autre joueuse ; hors du Livre", async () => {
    expect((await listPlayerVisibleEntityIds(client(joueuse), worldId, [pageId], joueuse.id)).has(pageId)).toBe(true);
    expect((await listPlayerVisibleEntityIds(client(autre), worldId, [pageId], autre.id)).has(pageId)).toBe(false);
    expect((await searchEntities(client(autre), worldId, "Journal", autre.id)).map((e) => e.id)).not.toContain(pageId);
    expect(await getPlayerEntityDetail(client(autre), { worldId, entitySlug: pageSlug, userId: autre.id })).toBeNull();
    expect((await listWrittenEntriesForWorld(client(gm), worldId)).map((e) => e.entityId)).not.toContain(pageId);
  });

  it("l'autrice ne modifie pas son devoir à la main (ni rendu, ni validé) ; une autre ne le rend pas", async () => {
    await client(joueuse).from("session_journal_entries").update({ status: "validated" }).eq("id", devoirId);
    await client(joueuse).from("session_journal_entries").update({ status: "written" }).eq("id", devoirId);
    expect(await etat(devoirId)).toBe("pending");

    const { data: parAutre } = await client(autre).rpc("submit_journal_assignment", { p_assignment_id: devoirId });
    expect(parAutre).toBe(false);
    expect(await submitMyJournalAssignment(client(autre), { assignmentId: devoirId, userId: autre.id })).toEqual({ ok: false, reason: "forbidden" });
    expect(await etat(devoirId)).toBe("pending");
  });

  it("« Devoir fait » : la page devient publique et entre dans le Livre ; une seconde fois, refusé", async () => {
    expect(await submitMyJournalAssignment(client(joueuse), { assignmentId: devoirId, userId: joueuse.id })).toEqual({ ok: true, slug: pageSlug });
    expect(await etat(devoirId)).toBe("written");
    expect((await admin.from("entities").select("is_public").eq("id", pageId).single()).data?.is_public).toBe(true);
    expect((await listWrittenEntriesForWorld(client(autre), worldId)).map((e) => e.entityId)).toContain(pageId);
    expect((await listPlayerVisibleEntityIds(client(autre), worldId, [pageId], autre.id)).has(pageId)).toBe(true);

    expect(await submitMyJournalAssignment(client(joueuse), { assignmentId: devoirId, userId: joueuse.id })).toEqual({ ok: false, reason: "already_submitted" });
    // Rendu : il ne s'annule plus.
    expect(await cancelJournalAssignment(client(gm), { id: devoirId, campaignId, callerId: gm.id })).toEqual({ ok: false, reason: "already_submitted" });
  });

  it("le MJ seul valide un devoir rendu", async () => {
    expect(await validateJournalAssignment(client(joueuse), { campaignId, assignmentId: devoirId, callerId: joueuse.id })).toEqual({ ok: false, reason: "forbidden" });
    expect(await etat(devoirId)).toBe("written");
    expect(await validateJournalAssignment(client(gm), { campaignId, assignmentId: devoirId, callerId: gm.id })).toEqual({ ok: true });
    expect(await etat(devoirId)).toBe("validated");
    expect((await listWrittenEntriesForWorld(client(autre), worldId)).map((e) => e.entityId)).toContain(pageId);
  });

  it("annuler un devoir en cours efface aussi sa page ; une joueuse ne l'annule pas", async () => {
    const r = await assignJournalEntry(client(gm), { campaignId, ingameDate: DATE, assignedTo: autre.id, createdBy: gm.id });
    if (!r.ok) throw new Error(r.reason);
    const page = r.assignment.entity_id!;
    expect(await cancelJournalAssignment(client(autre), { id: r.assignment.id, campaignId, callerId: autre.id })).toEqual({ ok: false, reason: "forbidden" });
    expect(await cancelJournalAssignment(client(gm), { id: r.assignment.id, campaignId, callerId: gm.id })).toEqual({ ok: true });
    expect((await admin.from("session_journal_entries").select("id").eq("id", r.assignment.id)).data).toEqual([]);
    expect((await admin.from("entities").select("deleted_at").eq("id", page).single()).data?.deleted_at).not.toBeNull();
  });
});
