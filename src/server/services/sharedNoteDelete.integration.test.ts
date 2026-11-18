import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Database } from "@/src/types/database";
import { getOrCreateNotebook } from "./notebook";
import { deleteSharedNotebookPage, listSharedNotes, shareNotebookPage } from "./sharedNotes";

/**
 * V3.1-144 — supprimer une page partagée depuis le cahier. Avant, aucune
 * route ne retirait l'entité `shared_note` : la page restait lisible de la
 * table, et son autrice n'avait plus aucun moyen de s'en défaire.
 *
 * Un fichier à part de `sharedNotes.integration.test.ts` : celui-là finit par
 * retirer l'octroi d'écriture de l'autrice, et une suppression qui suivrait
 * ne prouverait plus rien. Monde jetable, comptes réutilisés (docs/TESTS.md).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

type Account = { id: string; client: SupabaseClient };
const typed = (a: Account) => a.client as SupabaseClient<Database>;

describe.skipIf(!hasCreds)("supprimer une page partagée (V3.1-144, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: Account;
  let author: Account;
  let other: Account;
  let worldId: string;
  let sharedEntityId: string;

  const PAGE_ID = "page-a-supprimer";

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, author, other] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
    ]);

    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test suppression de page partagée", slug: `integration-test-shared-delete-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;

    const { data: campaign } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    await admin.from("campaign_members").insert([
      { campaign_id: campaign!.id, user_id: gm.id, role: "gm" },
      { campaign_id: campaign!.id, user_id: author.id, role: "player" },
      { campaign_id: campaign!.id, user_id: other.id, role: "player" },
    ]);

    const notebook = await getOrCreateNotebook(typed(author), { worldId, userId: author.id });
    const page = {
      id: PAGE_ID,
      parentId: null,
      position: 1000,
      kind: "page",
      title: "Une page de trop",
      content: [
        { id: "p", blockType: "paragraph", align: "left", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: "À supprimer." }] },
      ],
    };
    const { error: erreurArbre } = await author.client.from("blocks").update({ data: { __v: 1, items: [page] }, version: notebook.version + 1 }).eq("id", notebook.blockId);
    if (erreurArbre) throw new Error(erreurArbre.message);

    const partage = await shareNotebookPage(typed(author), { worldId, userId: author.id, itemId: PAGE_ID });
    if (!partage.ok) throw new Error(`partage : ${partage.reason}`);
    sharedEntityId = partage.entityId;
  });

  afterAll(async () => {
    if (!worldId) return;
    const { data: fiches } = await admin.from("entities").select("id").eq("world_id", worldId);
    if (fiches?.length) await admin.from("blocks").delete().in("entity_id", fiches.map((f) => f.id));
    await admin.from("worlds").delete().eq("id", worldId);
  });

  it("une autre joueuse ne la supprime pas : l'élément n'est pas dans SON cahier", async () => {
    expect(await deleteSharedNotebookPage(typed(other), { worldId, userId: other.id, itemId: PAGE_ID })).toEqual({ ok: false, reason: "not_found" });
    // La table la lit toujours.
    expect((await listSharedNotes(typed(other), { worldId, userId: other.id })).map((n) => n.entityId)).toContain(sharedEntityId);
  });

  it("l'autrice la supprime : l'entité part, le lien quitte son cahier, et plus personne ne la lit", async () => {
    expect(await deleteSharedNotebookPage(typed(author), { worldId, userId: author.id, itemId: PAGE_ID })).toEqual({ ok: true });

    const { data: entite } = await admin.from("entities").select("deleted_at").eq("id", sharedEntityId).single();
    expect(entite?.deleted_at).not.toBeNull();

    const cahier = await getOrCreateNotebook(typed(author), { worldId, userId: author.id });
    expect(cahier.items.map((i) => i.id)).not.toContain(PAGE_ID);

    expect((await listSharedNotes(typed(other), { worldId, userId: other.id })).map((n) => n.entityId)).not.toContain(sharedEntityId);
    expect((await listSharedNotes(typed(gm), { worldId, userId: gm.id })).map((n) => n.entityId)).not.toContain(sharedEntityId);
  });

  it("supprimer deux fois ne casse rien : l'élément a déjà quitté le cahier", async () => {
    expect(await deleteSharedNotebookPage(typed(author), { worldId, userId: author.id, itemId: PAGE_ID })).toEqual({ ok: false, reason: "not_found" });
  });
});
