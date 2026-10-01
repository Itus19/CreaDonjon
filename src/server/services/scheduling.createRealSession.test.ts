import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3.1-16, bug rapporté par l'auteur le 1ᵉʳ octobre : régler une date à la
 * main pendant une demande en cours fermait la demande — et les
 * disponibilités déjà cochées disparaissaient de l'écran. Le réglage à la
 * main est indépendant : seule une séance confirmée DEPUIS les
 * disponibilités répond à la demande et la ferme.
 */

const closed: string[] = [];
vi.mock("@/src/server/repos/scheduling", () => ({
  insertRealSession: async () => ({ id: "s1" }),
  getOpenAvailabilityRequest: async () => ({ id: "demande-octobre" }),
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

  it("une date confirmée depuis les disponibilités ferme la demande, comme avant", async () => {
    await createRealSession(supabase, { ...base, source: "availability" });
    expect(closed).toEqual(["demande-octobre"]);
  });
});
