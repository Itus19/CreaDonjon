import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3.1-44 — le groupe de l'atelier de rencontres : les vrais PJ, leur niveau
 * total, leur part du budget. Trois lectures groupées, jamais une par PJ.
 */
const appels = { blocs: 0, fiches: 0 };
vi.mock("@/src/server/repos/campaigns", () => ({
  listCampaignCharacters: async () => [
    { campaign_id: "c1", entity_id: "e1", user_id: "u1", is_pc: true },
    { campaign_id: "c1", entity_id: "e2", user_id: "u2", is_pc: true },
    { campaign_id: "c1", entity_id: "e3", user_id: null, is_pc: false },
    { campaign_id: "c1", entity_id: "e4", user_id: "u4", is_pc: true },
  ],
}));
vi.mock("@/src/server/repos/entities", () => ({
  listEntitiesByIds: async (_s: unknown, ids: string[]) => {
    appels.fiches++;
    const noms: Record<string, string> = { e1: "Sakaburin", e2: "Ana", e4: "Fiche vide" };
    return ids.map((id) => ({ id, name: noms[id] }));
  },
}));
vi.mock("@/src/server/repos/blocks", () => ({
  listBlocksByTypeForEntities: async () => {
    appels.blocs++;
    return [
      { entity_id: "e1", data: { species: "dwarf", classes: [{ key: "fighter", level: 2 }, { key: "rogue", level: 1 }], abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } } } },
      { entity_id: "e2", data: { species: "elf", classes: [{ key: "wizard", level: 1 }], abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } } } },
    ];
  },
}));
vi.mock("@/src/server/services/encounters", () => ({}));

const { listEncounterParty, withBudgetShares } = await import("./encounterWorkshop");
const supabase = {} as SupabaseClient<Database>;
const TABLE = [
  { level: 1, low: 50, moderate: 75, high: 100 },
  { level: 3, low: 150, moderate: 225, high: 400 },
];

describe("listEncounterParty + withBudgetShares (V3.1-44)", () => {
  it("les PJ seulement, triés par nom, au niveau total de leurs classes ; une fiche sans classe est au niveau 0", async () => {
    const groupe = await listEncounterParty(supabase, "c1");
    expect(groupe).toEqual([
      { entityId: "e2", name: "Ana", level: 1 },
      { entityId: "e4", name: "Fiche vide", level: 0 },
      { entityId: "e1", name: "Sakaburin", level: 3 },
    ]);
    expect(appels).toEqual({ blocs: 1, fiches: 1 });
  });

  it("chaque PJ porte sa part ; un niveau absent de la table n'en a pas", async () => {
    const groupe = withBudgetShares(await listEncounterParty(supabase, "c1"), TABLE);
    expect(groupe.map((m) => m.shares)).toEqual([{ low: 50, moderate: 75, high: 100 }, null, { low: 150, moderate: 225, high: 400 }]);
    expect(withBudgetShares(groupe, null).every((m) => m.shares === null)).toBe(true);
  });
});
