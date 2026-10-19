import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Database, Json } from "@/src/types/database";
import { getEntityTree } from "./entities";
import { listJournalAssignments } from "./sessionJournal";

/**
 * V3.1-43 — « La joueuse voit le Livre en tête de son sommaire, jamais une
 * entrée réservée au MJ. » Le groupe épinglé du Livre échappait au filtre
 * de visibilité du reste de l'arborescence : le titre d'une entrée dont
 * tous les blocs sont `gm` apparaissait à une joueuse.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

type Account = { id: string; client: SupabaseClient };
const typed = (a: Account) => a.client as SupabaseClient<Database>;

describe.skipIf(!hasCreds)("le Livre de sessions dans le sommaire d'une joueuse (V3.1-43, integration)", () => {
  let admin: SupabaseClient<Database>;
  let gm: Account;
  let player: Account;
  let worldId: string;
  let campaignId: string;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);

    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test livre de sessions", slug: `integration-test-livre-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaign.id, user_id: gm.id, role: "gm" },
      { campaign_id: campaign.id, user_id: player.id, role: "player" },
    ]);

    const { data: fiches } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "seance-1", name: "Séance publique", entity_kind: "session_journal", created_by: gm.id },
        { world_id: worldId, slug: "seance-2", name: "Séance secrète", entity_kind: "session_journal", created_by: gm.id },
      ])
      .select("id, slug");
    const publique = fiches!.find((f) => f.slug === "seance-1")!.id;
    const secrete = fiches!.find((f) => f.slug === "seance-2")!.id;
    const texte = (v: string) => ({ __v: 1, dropCap: false, segments: [{ id: "s", blockType: "paragraph", align: "left", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v }] }] }) as unknown as Json;
    await admin.from("blocks").insert([
      { entity_id: publique, block_type: "text", data: texte("Récit."), display: { label: "Texte", layout: "prose" }, display_order: 1000, visibility_level: "players", created_by: gm.id },
      { entity_id: secrete, block_type: "text", data: texte("Notes du MJ."), display: { label: "Texte", layout: "prose" }, display_order: 1000, visibility_level: "gm", created_by: gm.id },
    ]);
    const date = { year: 1492, month: 1, day: 1, precision: "day", end: null, label: null } as unknown as Json;
    await admin.from("session_journal_entries").insert([
      { campaign_id: campaign.id, ingame_date: date, assigned_to: gm.id, status: "written", entity_id: publique, created_by: gm.id, written_at: new Date().toISOString() },
      { campaign_id: campaign.id, ingame_date: date, assigned_to: gm.id, status: "written", entity_id: secrete, created_by: gm.id, written_at: new Date().toISOString() },
    ]);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("la joueuse a le Livre en tête, sans l'entrée réservée au MJ", async () => {
    const arbre = await getEntityTree(typed(player), worldId, player.id);
    expect(arbre[0]?.kind).toBe("session_journal");
    const noms = arbre[0]?.items.map((i) => i.name);
    expect(noms).toContain("Séance publique");
    expect(noms).not.toContain("Séance secrète");
  });

  it("la liste des devoirs du MJ porte le nom et le slug de chaque entrée rédigée", async () => {
    const devoirs = await listJournalAssignments(typed(gm), campaignId);
    expect(devoirs.map((d) => [d.entity_name, d.entity_slug]).sort()).toEqual([
      ["Séance publique", "seance-1"],
      ["Séance secrète", "seance-2"],
    ]);
  });

  it("le MJ voit les deux entrées", async () => {
    const arbre = await getEntityTree(typed(gm), worldId, gm.id);
    expect(arbre[0]?.items.map((i) => i.name).sort()).toEqual(["Séance publique", "Séance secrète"]);
  });
});
