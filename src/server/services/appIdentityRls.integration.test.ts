import { beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Database } from "@/src/types/database";

/**
 * V3.1-84 (ADR 0061) — sur la vraie base : l'identité de l'application se lit
 * sans être connecté, et un compte qui n'est pas superadmin ne peut ni
 * l'écrire, ni la supprimer, ni déposer un logo. Exige la migration
 * 20261013120000. Aucune écriture réussie ici : rien à nettoyer.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

const WEBP_1PX = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "base64");

describe.skipIf(!hasCreds)("identité de l'application : RLS (integration, base reelle)", () => {
  let anon: SupabaseClient<Database>;
  let gm: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    const admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    anon = createSupabaseClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    gm = await getReusableTestAccount(admin, "gm");
  });

  it("un visiteur non connecté la lit sans erreur", async () => {
    const { error } = await anon.from("app_identity").select("name, tagline, logo_key, logo_storage_path").maybeSingle();
    expect(error).toBeNull();
  });

  it("un visiteur non connecté ne peut pas l'écrire", async () => {
    const { error } = await anon.from("app_identity").upsert({ id: true, name: "Piraté" });
    expect(error).not.toBeNull();
  });

  it("un compte qui n'est pas superadmin ne peut pas l'écrire", async () => {
    const { error } = await gm.client.from("app_identity").upsert({ id: true, name: "Piraté" });
    expect(error).not.toBeNull();
  });

  it("ni la supprimer (aucune ligne touchée)", async () => {
    const { data, error } = await gm.client.from("app_identity").delete().eq("id", true).select("id");
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("ni déposer un logo dans le bucket `brand`", async () => {
    const { error } = await gm.client.storage.from("brand").upload(`logo/test-${Date.now()}.webp`, WEBP_1PX, { contentType: "image/webp" });
    expect(error).not.toBeNull();
  });
});
