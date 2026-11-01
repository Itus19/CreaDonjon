import { beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { savePlayerTitleTiers, resetPlayerTitleTiers } = await import("./playerTitleTiersWrite");
const { DEFAULT_TITLE_TIERS } = await import("@/src/core/stats/titleTiers");

/**
 * V3.1-92 — Seul le superadmin écrit les paliers des titres. Un autre compte
 * est refusé par le service ET par la RLS ; rien ne change. (Aucun compte de
 * test n'est superadmin : l'écriture réussie se vérifie à la main.)
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("paliers des titres : écriture réservée (V3.1-92, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let joueuse: ReusableAccount;
  const client = () => joueuse.client as unknown as SupabaseClient<Database>;
  const nombre = async () => (await admin.from("player_title_tiers").select("id", { count: "exact", head: true })).count;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    joueuse = await getReusableTestAccount(admin, "player");
  });

  it("un compte ordinaire est refusé par le service, puis par la base ; rien ne change", async () => {
    const avant = await nombre();
    expect(await savePlayerTitleTiers(client(), { userId: joueuse.id, tiers: DEFAULT_TITLE_TIERS })).toEqual({ ok: false, reason: "forbidden" });
    expect(await resetPlayerTitleTiers(client(), joueuse.id)).toEqual({ ok: false, reason: "forbidden" });
    expect((await client().from("player_title_tiers").insert({ ...DEFAULT_TITLE_TIERS[0] })).error).not.toBeNull();
    await client().from("player_title_tiers").delete().neq("family", "");
    expect(await nombre()).toBe(avant);
  });
});
