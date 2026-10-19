import { describe, expect, it, vi } from "vitest";

/**
 * V3.1-45 — « Créer la fiche » crée une entité visible du MJ seul : tous ses
 * blocs en visibilité `gm`. Un joueur ne voit une entité dans l'arborescence
 * que si l'un de ses blocs lui est visible (`listPlayerVisibleEntityIds`) :
 * un PNJ ou une taverne inventés ne s'affichent donc à la table qu'une fois
 * que le MJ en rend un morceau visible.
 */
type Promotion = { ok: true; entity: { id: string; slug: string } };
const promoteToEntity = vi.fn<(supabase: unknown, params: unknown) => Promise<Promotion>>(async () => ({ ok: true, entity: { id: "e1", slug: "la-chope" } }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "fr" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u-mj" } } }) } }) }));
vi.mock("@/src/server/services/worlds", () => ({ getWorldBySlug: async () => ({ id: "w1" }) }));
vi.mock("@/src/server/repos/worlds", () => ({ getWorldDefaultRulesetId: async () => "r1" }));
vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => true }));
vi.mock("@/src/server/services/referenceChips", () => ({ resolveBlockReferences: async () => [] }));
vi.mock("@/src/server/services/promotion", () => ({ promoteToEntity: (_s: unknown, p: unknown) => promoteToEntity(_s, p) }));
vi.mock("@/src/server/services/rules", () => ({ getRuleEntryForWorld: async () => null }));

const { POST } = await import("@/app/api/worlds/[worldSlug]/mj/generateurs/[toolKey]/promote/route");

describe("POST …/generateurs/[toolKey]/promote (V3.1-45)", () => {
  it("crée la fiche en visibilité gm : le MJ seul la voit", async () => {
    const corps = { sections: { "taverne-nom": { text: "La Chope Fêlée" }, "taverne-apparence": { text: "Une salle basse et enfumée." } } };
    const res = await POST(new Request("http://x/api", { method: "POST", body: JSON.stringify(corps) }) as never, {
      params: Promise.resolve({ worldSlug: "banc", toolKey: "taverne" }),
    });
    expect(res.status).toBe(201);
    expect(promoteToEntity).toHaveBeenCalledTimes(1);
    expect(promoteToEntity.mock.calls[0][1]).toMatchObject({ name: "La Chope Fêlée", visibilityLevel: "gm", visibilityScopeId: null });
  });
});
