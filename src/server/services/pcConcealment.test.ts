import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/** V3.2-80 — La base est simulée : on vérifie qu'un jet réussi cache l'objet nommé, et ce qui n'écrit rien. */

let lectures = 0;
const ecrits: unknown[] = [];
const sac = {
  __v: 1,
  items: [
    { id: "pj-1", qty: 1, equipped: true, label: "Dague" },
    { id: "pj-2", qty: 1, equipped: true, label: "Lettre", concealed: true, conceal_dc: 12 },
  ],
  containers: [],
  currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
};

vi.mock("@/src/server/services/inventoryActions", () => ({
  readInventorySnapshot: async () => {
    lectures++;
    return sac;
  },
  setItemConcealment: async (_s: unknown, p: unknown) => {
    ecrits.push(p);
    return { inventory: sac };
  },
}));
vi.mock("@/src/server/services/facetDiscoveries", () => ({
  nameInventoryItems: async (_s: unknown, p: { items: { id: string; label?: string; qty: number }[] }) => p.items.map((i) => ({ id: i.id, name: i.label ?? "objet", qty: i.qty })),
}));

const { applyPcConcealment } = await import("./pcConcealment");
const supabase = {} as SupabaseClient<Database>;
const base = { world: { id: "w", slug: "m" }, locale: "fr" as const, pcEntityId: "pj", callerId: "u" };
const discretion = (total: number, verdict: "success" | "fail") => ({ intent: { kind: "skill_check", action_id: "stealth" }, check: { total, dc: 10, verdict } });

beforeEach(() => {
  lectures = 0;
  ecrits.length = 0;
});

describe("applyPcConcealment — V3.2-80", () => {
  it("« je cache ma dague sous ma cape », Discrétion 16 : la dague est cachée, DD 16", async () => {
    const fait = await applyPcConcealment(supabase, { ...base, text: "je cache ma dague sous ma cape", detail: discretion(16, "success") });
    expect(ecrits).toEqual([{ entityId: "pj", itemId: "pj-1", concealed: true, concealDc: 16, actorUserId: "u" }]);
    expect(fait).toBe("Le personnage a caché Dague : seule une fouille ou un regard attentif pourra le trouver.");
  });

  it("raté : rien n'est caché", async () => {
    expect(await applyPcConcealment(supabase, { ...base, text: "je cache ma dague", detail: discretion(7, "fail") })).toBeNull();
    expect(ecrits).toHaveLength(0);
  });

  it("« je sors la lettre » la remet en vue", async () => {
    await applyPcConcealment(supabase, { ...base, text: "je sors la lettre", detail: { intent: { kind: "free" }, check: null } });
    expect(ecrits).toEqual([{ entityId: "pj", itemId: "pj-2", concealed: false, actorUserId: "u" }]);
  });

  it("une phrase sans mot de dissimulation ne lit même pas l'inventaire", async () => {
    expect(await applyPcConcealment(supabase, { ...base, text: "je commande une bière", detail: { intent: { kind: "free" }, check: null } })).toBeNull();
    expect(lectures).toBe(0);
  });
});
