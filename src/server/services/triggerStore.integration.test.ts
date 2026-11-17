import { describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

vi.mock("server-only", () => ({}));
const { loadTriggersForEntries } = await import("./triggerStore");

/**
 * V3.1-5, vérification en direct du 17 novembre — une espèce porte les
 * déclencheurs de ses traits. Ingénieux (trait de l'Humain, SRD 2024) donne
 * l'Inspiration héroïque au repos long ; la fiche dérivée ne liste que
 * `species:human`, jamais `resourceful` (un trait n'y devient aptitude que
 * s'il se joue, V3.1-163) : sans cette lecture, le repos long n'en tirait rien.
 * Lecture seule, sur la base officielle.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!SUPABASE_URL || !SERVICE_ROLE_KEY)("déclencheurs des traits d'espèce (V3.1-5, integration, base reelle)", () => {
  it("charger « human » charge Ingénieux et son repos long", async () => {
    const admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { triggers, rejected } = await loadTriggersForEntries(admin, official!.id, ["human"]);
    expect(rejected).toEqual([]);
    expect(triggers.map((t) => t.id)).toContain("resourceful-repos-long");
  }, 60000);
});
