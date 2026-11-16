import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3.1-16, bug rapporté par l'auteur le 1ᵉʳ octobre : régler une date à la
 * main pendant une demande en cours fermait la demande — et les
 * disponibilités déjà cochées disparaissaient de l'écran. Le réglage à la
 * main est indépendant : seule une séance confirmée DEPUIS les
 * disponibilités répond à la demande et la ferme. V3.1-190 : plusieurs
 * demandes peuvent être ouvertes ; seule celle dont la date est fixée se
 * ferme.
 */

const closed: string[] = [];
vi.mock("@/src/server/repos/scheduling", () => ({
  insertRealSession: async () => ({ id: "s1" }),
  // V3.1-190 : plusieurs demandes ouvertes ; la séance nomme la sienne.
  getAvailabilityRequestById: async (_s: unknown, id: string) =>
    id === "demande-autre-campagne" ? { id, campaign_id: "autre", status: "open" } : id === "demande-close" ? { id, campaign_id: "c", status: "closed" } : { id, campaign_id: "c", status: "open" },
  closeAvailabilityRequest: async (_s: unknown, id: string) => {
    closed.push(id);
  },
}));
vi.mock("@/src/server/repos/campaigns", () => ({}));
vi.mock("@/src/server/repos/entities", () => ({}));
vi.mock("@/src/server/repos/activityJournal", () => ({}));

const { createRealSession } = await import("./scheduling");
const supabase = {} as SupabaseClient<Database>;
const base = { campaignId: "c", date: "2026-10-18", startsAt: "16:00", durationMinutes: 360, createdBy: "gabriel" };

beforeEach(() => {
  closed.length = 0;
});

describe("createRealSession", () => {
  it("une date réglée à la main laisse la demande en cours ouverte", async () => {
    await createRealSession(supabase, { ...base, source: "manual" });
    expect(closed).toEqual([]);
  });

  it("une date réglée à la main ne ferme rien, même si une demande est nommée", async () => {
    await createRealSession(supabase, { ...base, source: "manual", requestId: "demande-octobre" });
    expect(closed).toEqual([]);
  });

  it("une date confirmée depuis les disponibilités ferme SA demande, et elle seule", async () => {
    await createRealSession(supabase, { ...base, source: "availability", requestId: "demande-octobre" });
    expect(closed).toEqual(["demande-octobre"]);
  });

  it("ne ferme jamais une demande d'une autre campagne, ni une demande déjà close", async () => {
    await createRealSession(supabase, { ...base, source: "availability", requestId: "demande-autre-campagne" });
    await createRealSession(supabase, { ...base, source: "availability", requestId: "demande-close" });
    expect(closed).toEqual([]);
  });
});
