import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/** V3-C5 — Même méthode que `sceneSketches.test.ts` : les dépôts sont simulés, ce qui se vérifie ici c'est l'assemblage (qui va où, les noms résolus une seule fois). */

interface Row {
  id: string;
  kind: string;
  targetEntityId: string | null;
  payload: unknown;
}

let pendingRows: Row[] = [];
let appliedRows: Row[] = [];
let sessionEventIds: string[] = [];
let entities: { id: string; name: string }[] = [];

vi.mock("@/src/server/repos/aiProposals", () => ({
  listPendingAiProposalsForCampaign: async () => pendingRows,
  listAppliedAiProposalsBySessionEventIds: async (_s: unknown, ids: string[]) => (ids.length > 0 ? appliedRows : []),
}));
vi.mock("@/src/server/repos/sessions", () => ({ listSessionEventIds: async () => sessionEventIds }));
vi.mock("@/src/server/repos/entities", () => ({ listEntitiesByIds: async (_s: unknown, ids: string[]) => entities.filter((e) => ids.includes(e.id)) }));

const { buildConsequencesDrawer } = await import("./consequencesDrawer");
const supabase = {} as SupabaseClient<Database>;

beforeEach(() => {
  pendingRows = [];
  appliedRows = [];
  sessionEventIds = ["ev-1"];
  entities = [];
});

describe("buildConsequencesDrawer", () => {
  it("resout le nom de la cible, une seule fois pour pending et applied", async () => {
    pendingRows = [{ id: "p-1", kind: "update_block", targetEntityId: "e-1", payload: { text: "Un ajout." } }];
    appliedRows = [{ id: "a-1", kind: "create_entity", targetEntityId: "e-2", payload: { name: "Grelin", trait: "cicatrice" } }];
    entities = [
      { id: "e-1", name: "Village test" },
      { id: "e-2", name: "Grelin" },
    ];

    const drawer = await buildConsequencesDrawer(supabase, { campaignId: "c", sessionId: "s" });
    expect(drawer.pending).toEqual([{ id: "p-1", kind: "update_block", text: "Un ajout.", targetName: "Village test" }]);
    expect(drawer.applied).toEqual([{ id: "a-1", kind: "create_entity", text: "Grelin — cicatrice", targetName: "Grelin" }]);
  });

  it("le tally ne compte que ce qui a ete APPLIQUE, jamais ce qui est en attente", async () => {
    pendingRows = [{ id: "p-1", kind: "create_entity", targetEntityId: null, payload: { name: "X" } }];
    appliedRows = [{ id: "a-1", kind: "create_entity", targetEntityId: null, payload: { name: "Y" } }];

    const drawer = await buildConsequencesDrawer(supabase, { campaignId: "c", sessionId: "s" });
    expect(drawer.tally).toEqual({ entities: 1, blocks: 0, relations: 0 });
  });

  it("aucun evenement de session : rien d'applique a montrer, sans requete inutile", async () => {
    sessionEventIds = [];
    appliedRows = [{ id: "a-1", kind: "create_entity", targetEntityId: null, payload: { name: "Y" } }];
    const drawer = await buildConsequencesDrawer(supabase, { campaignId: "c", sessionId: "s" });
    expect(drawer.applied).toEqual([]);
  });

  it("une cible sans nom resolu (entite disparue) : targetName reste null, jamais une erreur", async () => {
    pendingRows = [{ id: "p-1", kind: "update_block", targetEntityId: "fantome", payload: { text: "..." } }];
    const drawer = await buildConsequencesDrawer(supabase, { campaignId: "c", sessionId: "s" });
    expect(drawer.pending[0].targetName).toBeNull();
  });
});
