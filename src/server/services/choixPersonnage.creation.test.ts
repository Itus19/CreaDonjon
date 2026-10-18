import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";

/**
 * V3.1-83 — un PJ sans fiche se réclame à la FIN de l'assistant. Critères :
 * la réclamation précède l'écriture (c'est elle qui donne le droit d'écrire),
 * un PJ pris par quelqu'un d'autre n'est jamais écrit, et renvoyer
 * l'assistant après un échec d'écriture reprend sans se croire « pris ».
 */
const etat = { reclamationOk: true, dejaAElle: null as string | null, ecritureOk: true as boolean };
const journal: string[] = [];

vi.mock("@/src/server/services/campaigns", () => ({
  listClaimableCharacters: async () => ({ characters: [], startOn: { kind: "new" } }),
  claimOwnOpenCharacter: async () => {
    journal.push("reclame");
    return etat.reclamationOk ? { ok: true } : { ok: false, reason: "already_taken" };
  },
}));
vi.mock("@/src/server/repos/campaigns", () => ({
  getClaimedCharacterEntityId: async () => etat.dejaAElle,
}));
vi.mock("@/src/server/services/characterCreator", () => ({
  overwriteCharacterFromWizard: async () => {
    journal.push("ecrit");
    return etat.ecritureOk ? { ok: true, entity: { name: "Mirelle", version: 2 } } : { ok: false, reason: "conflict" };
  },
}));
vi.mock("@/src/server/repos/blocks", () => ({ listBlocksByTypesForEntities: async () => [] }));
vi.mock("@/src/server/repos/entityPortraits", () => ({ listEntityIdsWithPortrait: async () => new Set() }));
vi.mock("@/src/server/services/blocks", () => ({ filtrerBlocsVisibles: () => [] }));
vi.mock("@/src/server/services/visibility", () => ({ buildViewerForWorld: async () => null }));
vi.mock("@/src/server/services/worldPlayerCharacters", () => ({ libellesIdentite: async () => new Map() }));

const { reclamerEtCreerFiche } = await import("./choixPersonnage");

const supabase = {} as SupabaseClient<Database>;
const params = {
  campaignId: "c1",
  userId: "u-joueuse",
  entityId: "mirelle",
  expectedVersion: 1,
  name: "Mirelle Vantor",
  character: {} as CharacterBlockData,
  inventory: undefined,
  spellcasting: undefined,
};

beforeEach(() => {
  etat.reclamationOk = true;
  etat.dejaAElle = null;
  etat.ecritureOk = true;
  journal.length = 0;
});

describe("reclamerEtCreerFiche", () => {
  it("réclame puis écrit la fiche, dans cet ordre", async () => {
    expect(await reclamerEtCreerFiche(supabase, params)).toEqual({ ok: true });
    expect(journal).toEqual(["reclame", "ecrit"]);
  });

  it("n'écrit rien sur un PJ pris par quelqu'un d'autre", async () => {
    etat.reclamationOk = false;
    etat.dejaAElle = null;
    expect(await reclamerEtCreerFiche(supabase, params)).toEqual({ ok: false, reason: "already_taken" });
    expect(journal).toEqual(["reclame"]);
  });

  it("reprend à l'écriture quand le PJ est déjà à elle (seconde tentative)", async () => {
    etat.reclamationOk = false;
    etat.dejaAElle = "mirelle";
    expect(await reclamerEtCreerFiche(supabase, params)).toEqual({ ok: true });
    expect(journal).toEqual(["reclame", "ecrit"]);
  });

  it("rend la raison d'un échec d'écriture", async () => {
    etat.ecritureOk = false;
    expect(await reclamerEtCreerFiche(supabase, params)).toEqual({ ok: false, reason: "conflict" });
  });
});
