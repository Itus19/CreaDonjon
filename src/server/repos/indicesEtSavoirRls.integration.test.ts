import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { cleanupCreated } from "../testUtils/cleanupCreated";

/**
 * V3.2-85 — La RLS des indices découverts (`entity_facet_discoveries`, ADR
 * 0118) et de ce que les PNJ savent du personnage (`npc_knowledge`, ADR 0122),
 * contre la vraie base, avec le groupe fixe de comptes (docs/TESTS.md §2) :
 *
 * - un membre d'une partie à table lit les indices de toute la table et les
 *   siens, jamais ceux qu'une autre personne a découverts seule ; il ne s'en
 *   accorde aucun ;
 * - `npc_knowledge` est un secret du MJ : une joueuse n'y lit, n'écrit ni ne
 *   supprime rien ; le MJ du monde et le MJ de la partie, si ;
 * - une personne hors de la partie ne voit rien.
 *
 * Se saute sans clés Supabase, comme les autres tests d'intégration.
 * Coût (docs/QUOTAS.md T1) : quatre connexions de comptes réutilisés, une
 * vingtaine de requêtes ; le monde créé est supprimé par identifiant.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("RLS des indices et du savoir des PNJ (intégration, base réelle)", () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;
  let gm: SupabaseClient;
  let player: SupabaseClient;
  let playerB: SupabaseClient;
  let outsider: SupabaseClient;
  const ids: Record<string, string> = {};
  let worldId: string;
  let campaignId: string;
  let npcId: string;
  let pcId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const comptes = await Promise.all(
      (["owner", "gm", "player", "playerB", "outsider"] as const).map(async (role) => [role, await getReusableTestAccount(admin, role)] as const)
    );
    for (const [role, compte] of comptes) ids[role] = compte.id;
    const client = (role: string) => comptes.find(([r]) => r === role)![1].client;
    owner = client("owner");
    gm = client("gm");
    player = client("player");
    playerB = client("playerB");
    outsider = client("outsider");

    const { data: world, error: e1 } = await admin
      .from("worlds")
      .insert({ name: "Monde de test indices", slug: `integration-test-indices-${Date.now()}`, owner_id: ids.owner })
      .select("id")
      .single();
    if (e1 || !world) throw new Error(e1?.message ?? "création du monde échouée");
    worldId = world.id;

    const { data: official, error: e2 } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (e2 || !official) throw new Error(e2?.message ?? "aucun ruleset officiel");
    const { data: campaign, error: e3 } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Partie de test indices", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (e3 || !campaign) throw new Error(e3?.message ?? "création de la partie échouée");
    campaignId = campaign.id;

    const { error: e4 } = await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: ids.gm, role: "gm" },
      { campaign_id: campaignId, user_id: ids.player, role: "player" },
      { campaign_id: campaignId, user_id: ids.playerB, role: "player" },
    ]);
    if (e4) throw new Error(e4.message);

    const { data: entites, error: e5 } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "mabelle", name: "Mabelle", entity_kind: "character", created_by: ids.owner },
        { world_id: worldId, slug: "perrin", name: "Perrin", entity_kind: "character", created_by: ids.owner },
      ])
      .select("id, slug");
    if (e5 || !entites) throw new Error(e5?.message ?? "création des entités échouée");
    npcId = entites.find((e) => e.slug === "mabelle")!.id;
    pcId = entites.find((e) => e.slug === "perrin")!.id;

    const { error: e6 } = await admin.from("entity_facet_discoveries").insert([
      { campaign_id: campaignId, entity_id: npcId, facet: "ac", user_id: null },
      { campaign_id: campaignId, entity_id: npcId, facet: "ability:str", user_id: ids.player },
      { campaign_id: campaignId, entity_id: npcId, facet: "item:pnj-1", user_id: ids.playerB },
    ]);
    if (e6) throw new Error(e6.message);

    // V3.2-87 : la fiche et l'équipement du PNJ, réservés au MJ.
    const { error: e8 } = await admin.from("blocks").insert([
      {
        entity_id: npcId,
        block_type: "statblock",
        visibility_level: "gm",
        data: {
          __v: 1, size: "medium", creature_type: "humanoïde", alignment: "neutre", ac: { value: 11 }, hp: { value: 9, hit_dice: "2d8" }, speed: "9 m",
          abilities: { str: 14, dex: 12, con: 11, int: 10, wis: 13, cha: 10 }, traits: [], actions: [{ name: "Gourdin", text: "+4" }], reactions: [], legendary_actions: [],
        },
      },
      {
        entity_id: npcId,
        block_type: "inventory",
        visibility_level: "gm",
        data: { __v: 1, items: [{ id: "pnj-1", qty: 1, equipped: true, concealed: true, conceal_dc: 13, label: "Couteau" }], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 3, cp: 4 } },
      },
    ]);
    if (e8) throw new Error(e8.message);

    const { error: e7 } = await admin.from("npc_knowledge").insert({
      campaign_id: campaignId,
      knower_entity_id: npcId,
      subject_entity_id: pcId,
      facet: "ac",
      is_true: true,
      source: "observation",
    });
    if (e7) throw new Error(e7.message);
  });

  afterAll(async () => {
    if (worldId) await cleanupCreated(admin, { worldIds: [worldId] });
  });

  const facettesLues = async (client: SupabaseClient) => {
    const { data, error } = await client.from("entity_facet_discoveries").select("facet").eq("campaign_id", campaignId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.facet as string).sort();
  };

  describe("entity_facet_discoveries", () => {
    it("une joueuse lit ce que la table sait et ce qu'elle sait seule, jamais ce qu'une autre a découvert seule", async () => {
      expect(await facettesLues(player)).toEqual(["ability:str", "ac"]);
      expect(await facettesLues(playerB)).toEqual(["ac", "item:pnj-1"]);
    });

    it("le MJ du monde lit tout ; une personne hors de la partie, rien", async () => {
      expect(await facettesLues(owner)).toEqual(["ability:str", "ac", "item:pnj-1"]);
      expect(await facettesLues(outsider)).toEqual([]);
    });

    it("une joueuse ne s'accorde pas un indice ; le MJ de la partie, si", async () => {
      const refus = await player.from("entity_facet_discoveries").insert({ campaign_id: campaignId, entity_id: npcId, facet: "hp", user_id: ids.player });
      expect(refus.error).not.toBeNull();
      // `trait:5` : un rang que la fiche n'a pas, pour ne rien changer à la vue testée plus bas.
      const accord = await gm.from("entity_facet_discoveries").insert({ campaign_id: campaignId, entity_id: npcId, facet: "trait:5", user_id: null });
      expect(accord.error).toBeNull();
    });
  });

  describe("npc_knowledge", () => {
    it("une joueuse ne lit rien de ce que les PNJ savent d'elle ; le MJ du monde et celui de la partie, si", async () => {
      const lu = async (client: SupabaseClient) => (await client.from("npc_knowledge").select("facet").eq("campaign_id", campaignId)).data ?? [];
      expect(await lu(player)).toEqual([]);
      expect(await lu(outsider)).toEqual([]);
      expect(await lu(owner)).toHaveLength(1);
      expect(await lu(gm)).toHaveLength(1);
    });

    it("une joueuse n'y écrit ni n'y supprime rien", async () => {
      const ecrit = await player
        .from("npc_knowledge")
        .insert({ campaign_id: campaignId, knower_entity_id: npcId, subject_entity_id: pcId, claim: "Perrin est un prince", is_true: false, source: "rumour" });
      expect(ecrit.error).not.toBeNull();
      const supprime = await player.from("npc_knowledge").delete().eq("campaign_id", campaignId).select("id");
      expect(supprime.data ?? []).toEqual([]);
      const reste = await admin.from("npc_knowledge").select("id").eq("campaign_id", campaignId);
      expect(reste.data).toHaveLength(1);
    });

    it("le MJ de la partie y écrit une rumeur", async () => {
      const ecrit = await gm
        .from("npc_knowledge")
        .insert({ campaign_id: campaignId, knower_entity_id: npcId, subject_entity_id: pcId, claim: "Perrin a tué un garde", is_true: false, source: "rumour" });
      expect(ecrit.error).toBeNull();
    });
  });

  describe("npc_player_view (V3.2-87)", () => {
    const vue = async (client: SupabaseClient) => {
      const { data, error } = await client.rpc("npc_player_view", { p_campaign: campaignId, p_entity: npcId });
      if (error) throw new Error(error.message);
      return data as { sheet: Record<string, unknown> | null; gear: { items: { id: string }[]; currency?: unknown } | null } | null;
    };

    it("une joueuse reçoit ce que la table sait et ce qu'elle sait seule, rien d'autre de la fiche", async () => {
      const v = await vue(player);
      expect(v?.sheet).toEqual({ abilities: { str: 14 }, ac: 11, actions: [], traits: [] });
      expect(v?.gear).toEqual({ items: [] });
    });

    it("une autre joueuse voit le couteau qu'elle a trouvé, sans son DD ni son drapeau caché", async () => {
      const v = await vue(playerB);
      expect(v?.gear?.items).toEqual([{ id: "pnj-1", qty: 1, equipped: true, label: "Couteau" }]);
      expect(v?.sheet).not.toHaveProperty("hp");
    });

    it("une personne hors de la partie n'obtient rien", async () => {
      expect(await vue(outsider)).toBeNull();
    });
  });
});
