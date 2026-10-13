import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { addTimelineEvent, getWorldTimeline } from "./timeline";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-96 (ADR 0048, migration 20261013160000) : la Chronologie du monde.
 * Le MJ y ajoute un événement (la fiche système naît une seule fois) ; une
 * joueuse ne peut ni l'y ajouter, ni créer elle-même la fiche système, et ne
 * reçoit pas un événement réservé au MJ.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

const year = (y: number) => ({ year: y, month: null, day: null, precision: "year" as const, end: null, label: null });

describe.skipIf(!hasCreds)("Chronologie du monde (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let owner: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  let worldId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    owner = await getReusableTestAccount(admin, "owner");
    player = await getReusableTestAccount(admin, "player");
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test chronologie", slug: `integration-test-world-timeline-${Date.now()}`, owner_id: owner.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "creation monde echouee");
    worldId = world.id;
    const { error: memberError } = await admin.from("world_members").insert({ world_id: worldId, user_id: player.id, role: "viewer" });
    if (memberError) throw new Error(memberError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("AVANT toute fiche système : une joueuse ne peut ni ajouter à la frise générale, ni la créer elle-même (place encore libre : seule la RLS la refuse)", async () => {
    const refused = await addTimelineEvent(player.client, {
      worldId,
      userId: player.id,
      target: { kind: "world" },
      event: { date: year(1410), kind: "custom", title: "Intrusion", summary: "", visibility: { level: "public", scopeId: null } },
    });
    expect(refused).toEqual({ ok: false, reason: "forbidden" });
    const { error } = await player.client
      .from("entities")
      .insert({ world_id: worldId, slug: `squat-${Date.now()}`, name: "Squat", entity_kind: "world_timeline", created_by: player.id });
    expect(error).not.toBeNull();
  });

  it("le MJ ajoute deux événements : une seule fiche système, hors du wiki", async () => {
    const event = (title: string, level: "public" | "gm") => ({
      date: year(1400),
      kind: "war" as const,
      title,
      summary: "",
      visibility: { level, scopeId: null },
    });
    expect((await addTimelineEvent(owner.client, { worldId, userId: owner.id, target: { kind: "world" }, event: event("La Grande Guerre", "public") })).ok).toBe(true);
    expect((await addTimelineEvent(owner.client, { worldId, userId: owner.id, target: { kind: "world" }, event: event("Le complot", "gm") })).ok).toBe(true);
    const { data } = await admin.from("entities").select("id").eq("world_id", worldId).eq("entity_kind", "world_timeline").is("deleted_at", null);
    expect(data).toHaveLength(1);
  });

  it("une joueuse ne voit pas l'événement réservé au MJ", async () => {
    const { entries } = await getWorldTimeline(player.client, worldId, player.id);
    expect(entries.map((e) => e.entry.title)).toEqual(["La Grande Guerre"]);
    expect(entries[0].source).toEqual({ kind: "world" });
  });

});
