import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/** V3.2-52 — La base et le dé sont simulés : on vérifie le jet (fiche, DD), le fait écrit et ce qu'il tait. */

let admin = true;
let fiche: unknown = null;
let de = 10;
const journal: { kind: string; payload: unknown }[] = [];

const statblock = {
  __v: 1,
  size: "medium",
  creature_type: "humanoïde",
  alignment: "neutre",
  ac: { value: 10 },
  hp: { value: 4, hit_dice: "1d8" },
  speed: "9 m",
  abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  traits: [],
  actions: [],
  reactions: [],
  legendary_actions: [],
};

vi.mock("server-only", () => ({}));
vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => admin }));
vi.mock("@/src/server/repos/blocks", () => ({ listBlocksByTypeForEntities: async () => (fiche ? [{ entity_id: "mabelle", data: fiche }] : []) }));
vi.mock("@/src/server/repos/entities", () => ({ listEntitiesByIds: async () => [{ id: "mabelle", name: "Mabelle" }] }));
vi.mock("@/src/server/repos/sessions", () => ({
  nextEventSeq: async () => 7,
  insertSessionEvent: async (_s: unknown, e: { kind: string; payload: unknown }) => {
    journal.push(e);
    return { id: `ev-${journal.length}` };
  },
}));
vi.mock("@/src/server/services/rng", () => ({ serverRng: { nextInt: () => de - 1 } }));
const appris: unknown[] = [];
vi.mock("@/src/server/services/npcKnowledge", () => ({
  PC_OBSERVATION_CHECKS: { reperer: "perception" },
  learnFromNpcCheckOnPc: async (_s: unknown, p: unknown) => {
    appris.push(p);
    return ["Épée longue"];
  },
}));

const { jouerJetDePnj, ddOpposeDuPnj, NPC_CHECK_SOURCE } = await import("./npcChecks");
const supabase = {} as SupabaseClient<Database>;
const tonneau = { worldId: "w", sessionId: "s", npcId: "mabelle", action: "soulever" as const, tier: "moyen" as const, callerId: "u" };

beforeEach(() => {
  admin = true;
  fiche = statblock;
  journal.length = 0;
  appris.length = 0;
});

describe("jouerJetDePnj — V3.2-52", () => {
  it("Mabelle soulève un tonneau : Athlétisme avec sa Force (+2) contre DD 15, l'issue journalisée", async () => {
    de = 13;
    expect(await jouerJetDePnj(supabase, tonneau)).toBe("Issue décidée par le moteur : Mabelle tente de soulever (DD 15) — réussite.");
    de = 12;
    expect(await jouerJetDePnj(supabase, tonneau)).toContain("échec");
    expect(journal).toHaveLength(2);
    expect(journal[0]).toMatchObject({ kind: "rule_application", payload: { source: NPC_CHECK_SOURCE, entity_id: "mabelle" } });
  });

  it("le fait tait le dé et le total, qui trahiraient la fiche", async () => {
    de = 13;
    const fait = await jouerJetDePnj(supabase, tonneau);
    expect(fait).not.toMatch(/13|\+2/);
    expect(JSON.stringify(journal[0]!.payload)).not.toMatch(/"total"|"naturel"/);
  });

  it("sans fiche allégée (une esquisse), aucun jet", async () => {
    fiche = null;
    expect(await jouerJetDePnj(supabase, tonneau)).toBeNull();
    expect(journal).toHaveLength(0);
  });

  it("réservé au MJ du monde, seul à lire la fiche", async () => {
    admin = false;
    expect(await jouerJetDePnj(supabase, tonneau)).toBeNull();
  });

  it("V3.2-80 — un jet qui jauge le personnage reste secret : ni verdict ni DD, et le PNJ retient ce qu'il a vu", async () => {
    de = 15;
    const surPj = { ...tonneau, action: "reperer" as const, onPc: { campaignId: "c", pcEntityId: "pj", pcName: "Aldric" } };
    const fait = await jouerJetDePnj(supabase, surPj);
    expect(fait).toBe("Issue décidée par le moteur : Mabelle tente de repérer Aldric ; ce qu'il ou elle en retient reste secret.");
    expect(appris).toEqual([{ campaignId: "c", npcId: "mabelle", pcEntityId: "pj", skill: "perception", total: 15, dc: 15, sourceEventId: "ev-1" }]);
    de = 2;
    expect(await jouerJetDePnj(supabase, surPj)).toBe(fait);
    expect(appris).toHaveLength(1);
  });

  it("soulever « sur » le personnage n'est pas un jet d'observation : l'issue se dit comme d'habitude", async () => {
    de = 13;
    expect(await jouerJetDePnj(supabase, { ...tonneau, onPc: { campaignId: "c", pcEntityId: "pj", pcName: "Aldric" } })).toContain("réussite");
    expect(appris).toHaveLength(0);
  });
});

describe("ddOpposeDuPnj — V3.2-82", () => {
  it("mentir à Mabelle (Sagesse 14, sans maîtrise) : le DD vaut le dé du serveur + 2", async () => {
    fiche = { ...statblock, abilities: { ...statblock.abilities, wis: 14 } };
    de = 11;
    expect(await ddOpposeDuPnj(supabase, { npcId: "mabelle", skill: "deception" })).toEqual({ dc: 13, label: "Perspicacité" });
  });

  it("sans fiche allégée, ou pour une compétence sans opposition : le palier habituel", async () => {
    expect(await ddOpposeDuPnj(supabase, { npcId: "mabelle", skill: "athletics" })).toBeNull();
    fiche = null;
    expect(await ddOpposeDuPnj(supabase, { npcId: "mabelle", skill: "stealth" })).toBeNull();
  });
});
