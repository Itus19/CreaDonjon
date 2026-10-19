import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Database, Json } from "@/src/types/database";
import { getOrCreateNotebook } from "./notebook";
import { listSharedNotes, shareNotebookPage, unshareNotebookPage } from "./sharedNotes";
import { getEntityTree, searchEntities } from "./entities";
import { listPublicEntities } from "./publicShare";

/**
 * V3.1-41 (ADR 0037) — sur la vraie base : une page du cahier partagée avec
 * la table. Exige la migration 20261013130000 (`claim_shared_note_grant`).
 * Le monde de test est supprimé à la fin, avec tout ce qu'il contient.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

type Account = { id: string; client: SupabaseClient };
const typed = (a: Account) => a.client as SupabaseClient<Database>;

describe.skipIf(!hasCreds)("pages partagées du cahier (integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: Account;
  let author: Account;
  let other: Account;
  let worldId: string;
  let knownId: string;
  let secretId: string;
  let sharedEntityId: string;

  const PAGE_ID = "page-soupcons";

  async function textBlockOf(client: SupabaseClient, entityId: string) {
    const { data } = await client.from("blocks").select("id, version, data, visibility_level").eq("entity_id", entityId).eq("block_type", "text");
    return data ?? [];
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, author, other] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
    ]);

    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test pages partagees", slug: `integration-test-shared-notes-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    await admin.from("campaign_members").insert([
      { campaign_id: campaign.id, user_id: gm.id, role: "gm" },
      { campaign_id: campaign.id, user_id: author.id, role: "player" },
      { campaign_id: campaign.id, user_id: other.id, role: "player" },
    ]);

    // Une fiche connue de la table (bloc `players`), une autre que seul le MJ connaît (bloc `gm`).
    const { data: fiches } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "mira", name: "Mira", entity_kind: "character", created_by: gm.id },
        { world_id: worldId, slug: "roi", name: "Le Roi caché", entity_kind: "character", created_by: gm.id },
      ])
      .select("id, slug");
    knownId = fiches!.find((f) => f.slug === "mira")!.id;
    secretId = fiches!.find((f) => f.slug === "roi")!.id;
    const texte = (v: string) => ({ __v: 1, dropCap: false, segments: [{ id: "s", blockType: "paragraph", align: "left", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v }] }] }) as unknown as Json;
    await admin.from("blocks").insert([
      { entity_id: knownId, block_type: "text", data: texte("Une marchande."), display: { label: "Texte", layout: "prose" }, display_order: 1000, visibility_level: "players", created_by: gm.id },
      { entity_id: secretId, block_type: "text", data: texte("Secret du MJ."), display: { label: "Texte", layout: "prose" }, display_order: 1000, visibility_level: "gm", created_by: gm.id },
    ]);

    // Le cahier de l'autrice, avec une page qui cite les deux fiches.
    const notebook = await getOrCreateNotebook(typed(author), { worldId, userId: author.id });
    const page = {
      id: PAGE_ID,
      parentId: null,
      position: 1000,
      kind: "page",
      title: "Soupçons",
      content: [
        {
          id: "p",
          blockType: "paragraph",
          align: "left",
          visibility: { level: "public", scopeId: null },
          content: [
            { t: "ref", kind: "entity", id: knownId, label: "Mira" },
            { t: "text", v: " parle du " },
            { t: "ref", kind: "entity", id: secretId, label: "Roi caché" },
          ],
        },
      ],
    };
    const { error } = await author.client.from("blocks").update({ data: { __v: 1, items: [page] }, version: notebook.version + 1 }).eq("id", notebook.blockId);
    if (error) throw new Error(error.message);
  });

  afterAll(async () => {
    if (!worldId) return;
    const { data: fiches } = await admin.from("entities").select("id").eq("world_id", worldId);
    if (fiches?.length) await admin.from("blocks").delete().in("entity_id", fiches.map((f) => f.id));
    await admin.from("worlds").delete().eq("id", worldId);
  });

  it("une page privée n'est lue par personne d'autre que son autrice, MJ compris", async () => {
    const { data: notes } = await admin.from("entities").select("id").eq("world_id", worldId).eq("entity_kind", "notes").eq("created_by", author.id).single();
    for (const lecteur of [gm, other]) {
      const { data } = await lecteur.client.from("blocks").select("id").eq("entity_id", notes!.id).eq("block_type", "note_tree");
      expect(data ?? []).toEqual([]);
    }
    expect(await listSharedNotes(typed(gm), { worldId, userId: gm.id })).toEqual([]);
  });

  it("partagée : le MJ et l'autre joueuse la lisent ; le cahier garde un lien à sa place", async () => {
    const result = await shareNotebookPage(typed(author), { worldId, userId: author.id, itemId: PAGE_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    sharedEntityId = result.entityId;

    for (const lecteur of [gm, other]) {
      const notes = await listSharedNotes(typed(lecteur), { worldId, userId: lecteur.id });
      expect(notes.map((n) => [n.entityId, n.title, n.authorId, n.shared])).toEqual([[sharedEntityId, "Soupçons", author.id, true]]);
    }
    // V3.1-42 : l'autrice la retrouve aussi, avec de quoi l'écrire (bloc et version).
    const [sienne] = await listSharedNotes(typed(author), { worldId, userId: author.id });
    const [bloc] = await textBlockOf(author.client, sharedEntityId);
    expect(sienne).toMatchObject({ entityId: sharedEntityId, shared: true, blockId: bloc.id, version: bloc.version });
    const cahier = await getOrCreateNotebook(typed(author), { worldId, userId: author.id });
    expect(cahier.items).toEqual([{ id: PAGE_ID, parentId: null, position: 1000, kind: "shared_page", targetId: sharedEntityId }]);
  });

  it("un nom que la joueuse n'a pas découvert lui arrive sans identifiant de fiche ; le MJ garde le lien", async () => {
    const [pourJoueuse] = await listSharedNotes(typed(other), { worldId, userId: other.id });
    const json = JSON.stringify(pourJoueuse.segments);
    expect(json).not.toContain(secretId);
    expect(json).toContain(knownId);
    expect(json).toContain("Roi caché");
    const [pourMj] = await listSharedNotes(typed(gm), { worldId, userId: gm.id });
    expect(JSON.stringify(pourMj.segments)).toContain(secretId);
  });

  it("seule l'autrice l'écrit : l'autre joueuse est refusée", async () => {
    const [bloc] = await textBlockOf(other.client, sharedEntityId);
    const { data } = await other.client.from("blocks").update({ version: bloc.version + 1 }).eq("id", bloc.id).select("id");
    expect(data ?? []).toEqual([]);
    const [parAutrice] = await textBlockOf(author.client, sharedEntityId);
    const { data: ecrit } = await author.client.from("blocks").update({ version: parAutrice.version + 1 }).eq("id", parAutrice.id).select("id");
    expect(ecrit).toHaveLength(1);
  });

  it("repasser en privée : plus personne d'autre ne la lit, le texte est intact", async () => {
    expect(await unshareNotebookPage(typed(author), { worldId, userId: author.id, itemId: PAGE_ID })).toEqual({ ok: true });
    for (const lecteur of [gm, other]) {
      expect(await listSharedNotes(typed(lecteur), { worldId, userId: lecteur.id })).toEqual([]);
      expect(await textBlockOf(lecteur.client, sharedEntityId)).toEqual([]);
    }
    const [bloc] = await textBlockOf(author.client, sharedEntityId);
    expect(JSON.stringify(bloc.data)).toContain("Roi caché");
    // V3.1-42 : l'autrice la retrouve dans la liste, marquée privée — c'est elle seule qui la lit.
    const siennes = await listSharedNotes(typed(author), { worldId, userId: author.id });
    expect(siennes.map((n) => [n.entityId, n.shared])).toEqual([[sharedEntityId, false]]);
    // Le nom de l'entité, lisible de tout membre, ne dit rien du titre.
    const { data: ligne } = await other.client.from("entities").select("name").eq("id", sharedEntityId).single();
    expect(ligne?.name).toBe("Page du cahier");
  });

  it("la repartager la rend à la table (idempotent, même entité)", async () => {
    expect(await shareNotebookPage(typed(author), { worldId, userId: author.id, itemId: PAGE_ID })).toEqual({ ok: true, entityId: sharedEntityId });
    expect((await listSharedNotes(typed(other), { worldId, userId: other.id })).map((n) => n.entityId)).toEqual([sharedEntityId]);
  });

  it("le MJ retire l'octroi : l'autrice ne l'écrit plus, et ne peut pas se le redonner", async () => {
    const { error } = await gm.client.from("entity_grants").delete().eq("entity_id", sharedEntityId).eq("user_id", author.id);
    expect(error).toBeNull();
    const [bloc] = await textBlockOf(author.client, sharedEntityId);
    const { data } = await author.client.from("blocks").update({ version: bloc.version + 1 }).eq("id", bloc.id).select("id");
    expect(data ?? []).toEqual([]);
    const { data: repris } = await author.client.rpc("claim_shared_note_grant", { p_entity_id: sharedEntityId });
    expect(repris).toBe(false);
  });

  it("une page partagée n'apparaît ni dans l'arborescence, ni dans la recherche, ni dans le wiki public", async () => {
    const arbre = JSON.stringify(await getEntityTree(typed(gm), worldId, gm.id));
    expect(arbre).not.toContain(sharedEntityId);
    expect((await searchEntities(typed(gm), worldId, "Page du cahier")).map((r) => r.id)).not.toContain(sharedEntityId);
    await admin.from("entities").update({ is_public: true }).eq("id", sharedEntityId);
    expect((await listPublicEntities(worldId)).map((e) => e.id)).not.toContain(sharedEntityId);
  });
});
