import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { AiProvider } from "@/src/server/ai/provider";

/**
 * V3.2-54 — Même méthode que `soloWorldNotes.test.ts` : la base et l'IA sont
 * simulées ; on vérifie le câblage (quel bloc, quelle visibilité, quel rang,
 * quelle trace), pas l'écriture elle-même.
 */

type Bloc = { id: string; entity_id: string; block_type: string; display: { label: string }; data: unknown; display_order: number; version: number };
let blocs: Bloc[] = [];
let brouillon: { ok: true; portrait: { apparence: string; cache?: string } } | { ok: false; reason: string };
const entreesIa: unknown[] = [];
const crees: { entityId: string; label: string; visibilityLevel: string; data: unknown }[] = [];
const deplaces: { id: string; displayOrder: number }[] = [];
const propositions: { kind: string; status: string; payload: unknown }[] = [];
let admin = true;
let presents: { entityId: string; room?: string | null }[] = [];

vi.mock("@/src/server/repos/blocks", () => ({
  listBlocksForEntity: async (_s: unknown, entityId: string) => blocs.filter((b) => b.entity_id === entityId),
  listBlocksByTypesForEntities: async (_s: unknown, ids: string[], types: string[]) => blocs.filter((b) => ids.includes(b.entity_id) && types.includes(b.block_type)),
}));
vi.mock("@/src/server/repos/entities", () => ({ getEntityById: async (_s: unknown, id: string) => ({ id, name: "Aubergiste, d'âge mûr" }) }));
vi.mock("@/src/server/repos/sceneStates", () => ({ getSceneState: async () => ({ present: presents }) }));
vi.mock("@/src/core/rules/scenePresence", () => ({ presentsIci: (scene: { present: unknown[] }) => scene.present }));
vi.mock("@/src/server/repos/aiProposals", () => ({
  insertAiProposal: async (_s: unknown, p: { kind: string; status: string; payload: unknown }) => {
    propositions.push({ kind: p.kind, status: p.status, payload: p.payload });
    return { id: "prop" };
  },
}));
vi.mock("@/src/server/ai/npcPortrait", () => ({
  draftNpcPortrait: async (_s: unknown, _p: unknown, params: { input: unknown }) => {
    entreesIa.push(params.input);
    return brouillon;
  },
}));
vi.mock("@/src/server/services/blocks", () => ({
  createBlockWithData: async (_s: unknown, p: { entityId: string; label: string; visibilityLevel: string; data: unknown }) => {
    crees.push({ entityId: p.entityId, label: p.label, visibilityLevel: p.visibilityLevel, data: p.data });
    blocs = [...blocs, { id: `cree-${crees.length}`, entity_id: p.entityId, block_type: "text", display: { label: p.label }, data: p.data, display_order: 99000, version: 1 }];
    return { ok: true };
  },
  reorderBlock: async (_s: unknown, p: { id: string; displayOrder: number }) => {
    deplaces.push({ id: p.id, displayOrder: p.displayOrder });
    return { ok: true };
  },
}));
vi.mock("@/src/server/services/facetDiscoveries", () => ({
  nameInventoryItems: async (_s: unknown, p: { items: { id: string; label?: string; qty: number }[] }) => p.items.map((i) => ({ id: i.id, name: i.label ?? "objet", qty: i.qty })),
}));
vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => admin }));

const { ensureNpcAppearance, ensureNpcAppearancesForPresents } = await import("./npcAppearance");
const supabase = {} as SupabaseClient<Database>;
const provider = {} as AiProvider;
const PORTRAIT = "Une femme d'une cinquantaine d'années, petite et large d'épaules. ".repeat(4);
const base = { world: { id: "w", slug: "monde" }, campaignId: "c", sessionEventId: "ev", entityId: "pnj", callerId: "u", locale: "fr" as const };

const texte = (id: string, entity: string, label: string, ordre: number, paragraphes: { level: string; v: string }[]): Bloc => ({
  id,
  entity_id: entity,
  block_type: "text",
  display: { label },
  data: { __v: 1, segments: paragraphes.map((p, i) => ({ id: `${id}-${i}`, blockType: "paragraph", visibility: { level: p.level, scopeId: null }, content: [{ t: "text", v: p.v }], align: "left" })) },
  display_order: ordre,
  version: 1,
});

beforeEach(() => {
  blocs = [];
  brouillon = { ok: true, portrait: { apparence: PORTRAIT } };
  entreesIa.length = 0;
  crees.length = 0;
  deplaces.length = 0;
  propositions.length = 0;
  admin = true;
  presents = [];
});

describe("ensureNpcAppearance — V3.2-54", () => {
  it("crée le bloc Apparence lisible, en tête de fiche, et le trace dans ai_proposals", async () => {
    blocs = [texte("desc", "pnj", "Description", 1000, [{ level: "public", v: "Aubergiste" }])];
    const outcome = await ensureNpcAppearance(supabase, provider, base);
    expect(outcome).toEqual({ ok: true, created: true });
    expect(crees).toHaveLength(1);
    expect(crees[0]).toMatchObject({ label: "Apparence", visibilityLevel: "public" });
    expect(deplaces).toEqual([{ id: "cree-1", displayOrder: 0 }]);
    expect(propositions).toEqual([{ kind: "create_block", status: "applied", payload: { label: "Apparence", apparence: PORTRAIT } }]);
  });

  it("un détail caché part dans un bloc réservé au MJ, jamais dans l'Apparence", async () => {
    brouillon = { ok: true, portrait: { apparence: PORTRAIT, cache: "Un serpent tatoué sous la manche." } };
    await ensureNpcAppearance(supabase, provider, base);
    expect(crees.map((c) => [c.label, c.visibilityLevel])).toEqual([
      ["Apparence", "public"],
      ["Ce qui ne se voit pas", "gm"],
    ]);
    expect(JSON.stringify(crees[0]!.data)).not.toContain("serpent");
  });

  it("l'IA reçoit les objets portés visibles, jamais un objet caché ni un paragraphe du MJ", async () => {
    blocs = [
      texte("desc", "pnj", "Description", 1000, [
        { level: "public", v: "Aubergiste" },
        { level: "gm", v: "Elle doit de l'argent à la guilde." },
      ]),
      {
        id: "inv",
        entity_id: "pnj",
        block_type: "inventory",
        display: { label: "Équipement" },
        data: {
          __v: 1,
          items: [
            { id: "pnj-0", qty: 1, equipped: true, label: "Tablier" },
            { id: "pnj-1", qty: 1, equipped: true, concealed: true, label: "Couteau" },
          ],
          containers: [],
          currency: { pp: 0, gp: 0, ep: 0, sp: 3, cp: 0 },
        },
        display_order: 2000,
        version: 1,
      },
    ];
    await ensureNpcAppearance(supabase, provider, { ...base, narration: "Elle essuie une chope." });
    expect(entreesIa[0]).toEqual({ label: "Aubergiste, d'âge mûr", worn: ["Tablier"], description: "Aubergiste", narration: "Elle essuie une chope." });
  });

  it("ne refait jamais un portrait déjà là", async () => {
    blocs = [texte("app", "pnj", "Apparence", 0, [{ level: "public", v: PORTRAIT }])];
    expect(await ensureNpcAppearance(supabase, provider, base)).toEqual({ ok: true, created: false });
    expect(entreesIa).toHaveLength(0);
  });

  it("une sortie d'IA invalide n'écrit rien", async () => {
    brouillon = { ok: false, reason: "apparence : trop court" };
    expect(await ensureNpcAppearance(supabase, provider, base)).toEqual({ ok: false, reason: "apparence : trop court" });
    expect(crees).toHaveLength(0);
    expect(propositions).toHaveLength(0);
  });
});

describe("ensureNpcAppearancesForPresents — V3.2-54", () => {
  it("un seul portrait par tour, jamais pour le personnage joué ni une fiche de personnage", async () => {
    presents = [{ entityId: "pj" }, { entityId: "fiche-main" }, { entityId: "a" }, { entityId: "b" }];
    blocs = [{ id: "car", entity_id: "fiche-main", block_type: "character", display: { label: "Personnage" }, data: {}, display_order: 0, version: 1 }];
    const { given } = await ensureNpcAppearancesForPresents(supabase, provider, { ...base, actorEntityId: "pj" });
    expect(given).toEqual(["a"]);
  });

  it("réservé au MJ du monde", async () => {
    admin = false;
    presents = [{ entityId: "a" }];
    expect((await ensureNpcAppearancesForPresents(supabase, provider, { ...base, actorEntityId: "pj" })).given).toEqual([]);
  });
});
