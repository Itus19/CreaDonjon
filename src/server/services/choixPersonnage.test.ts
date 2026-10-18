import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";

/**
 * V3.1-82 — la liste enrichie du carrousel. Critères : « une seule requête
 * pour la liste enrichie » (une lecture par nature de donnée, jamais une par
 * PJ) et « un PJ caché à la joueuse n'apparaît pas » — ici, plus finement :
 * rien de ce qu'elle ne peut pas voir ne sort (bloc ou segment réservé au MJ).
 */
const joueuse: Viewer = { kind: "user", userId: "u-joueuse", worldRole: null, campaignRoles: { c1: "player" } };

const bloc = (id: string, entity: string, type: string, data: unknown, niveau = "players", ordre = 0) => ({
  id,
  entity_id: entity,
  block_type: type,
  display: "default",
  data,
  display_order: ordre,
  version: 1,
  visibility_level: niveau,
  visibility_scope_id: null,
  created_by: null,
  created_at: "",
  updated_at: "",
});
const segment = (v: string, niveau = "players") => ({
  id: v,
  blockType: "paragraph",
  visibility: { level: niveau, scopeId: null },
  content: [{ t: "text", v }],
  align: "left",
});
const perso = (classe: string, niveau: number) => ({ classes: [{ class: { kind: "rule", key: classe }, level: niveau }], species: { kind: "rule", key: "elf" } });

const appels = { blocs: 0, portraits: 0, lecteur: 0, noms: 0 };
vi.mock("@/src/server/services/campaigns", () => ({
  listClaimableCharacters: async () => ({
    characters: [
      { entityId: "a", entityName: "Naivara" },
      { entityId: "b", entityName: "Brom" },
      { entityId: "c", entityName: "Cael" },
    ],
    startOn: { kind: "new" },
  }),
}));
vi.mock("@/src/server/repos/blocks", () => ({
  listBlocksByTypesForEntities: async () => {
    appels.blocs++;
    return [
      bloc("1", "a", "character", perso("ranger", 3)),
      bloc("2", "a", "text", { __v: 1, segments: [segment("Secret du MJ.", "gm"), segment("Éclaireuse des Hautes-Landes. Elle traque.")] }),
      bloc("3", "b", "character", perso("fighter", 1), "gm"),
      bloc("4", "b", "text", { __v: 1, segments: [segment("Un forgeron bourru.")] }, "gm"),
    ];
  },
}));
vi.mock("@/src/server/repos/entityPortraits", () => ({
  listEntityIdsWithPortrait: async () => {
    appels.portraits++;
    return new Set(["a"]);
  },
}));
vi.mock("@/src/server/services/visibility", () => ({
  buildViewerForWorld: async () => {
    appels.lecteur++;
    return joueuse;
  },
}));
vi.mock("@/src/server/services/resolvedRuleset", () => ({
  resolveEntryNames: async () => {
    appels.noms++;
    return new Map([
      ["elf", "Elfe"],
      ["ranger", "Rôdeuse"],
    ]);
  },
}));

const { listCartesPersonnage } = await import("./choixPersonnage");
const client = {} as SupabaseClient<Database>;
const params = { campaignId: "c1", rulesetId: "r1", worldId: "w1", userId: "u-joueuse", locale: "fr" as const };

describe("listCartesPersonnage (V3.1-82)", () => {
  beforeEach(() => {
    appels.blocs = appels.portraits = appels.lecteur = appels.noms = 0;
  });

  it("trois PJ : une lecture de blocs, une de portraits, un lecteur, une lecture de noms", async () => {
    await listCartesPersonnage(client, params);
    expect(appels).toEqual({ blocs: 1, portraits: 1, lecteur: 1, noms: 1 });
  });

  it("la carte porte portrait, phrase visible et identité ; rien de réservé au MJ ne sort", async () => {
    const { cartes } = await listCartesPersonnage(client, params);
    expect(cartes[0]).toEqual({
      entityId: "a",
      entityName: "Naivara",
      portraitUrl: "/api/entities/a/portrait",
      phrase: "Éclaireuse des Hautes-Landes.",
      identite: { speciesLabel: "Elfe", classesLabel: "Rôdeuse 3", level: 3 },
    });
    // Bloc personnage et texte de Brom réservés au MJ : ni identité, ni phrase.
    expect(cartes[1]).toMatchObject({ entityId: "b", portraitUrl: null, phrase: null, identite: null });
    expect(cartes[2]).toMatchObject({ entityId: "c", phrase: null, identite: null });
  });
});
