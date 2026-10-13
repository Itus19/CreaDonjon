import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/src/types/database";
import { collectRefTargetIds } from "@/src/core/linker/refTargets";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { createEntity } from "./entities";
import { createBlock, updateBlockContent } from "./blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-48 : editer le prenom/nom d'un bloc `character` recompose le nom de
 * l'entite. Les mentions designent l'entite par `id` : elles continuent de
 * la resoudre, et le `label` ecrit par l'auteur n'est jamais reecrit
 * (specs/wiki-liens-et-personnages.md §A1).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("renommage par prenom/nom (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerClient: SupabaseClient;
  let ownerId: string;
  let worldId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const owner = await getReusableTestAccount(admin, "owner");
    ownerId = owner.id;
    ownerClient = owner.client;
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test renommage", slug: `integration-test-rename-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "creation monde echouee");
    worldId = world.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("renomme l'entite, et la mention qui la designe par id la resout toujours, label intact", async () => {
    const target = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Sans nom", entityKind: "character", aliases: [] });
    const other = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Autre fiche", entityKind: "location", aliases: [] });

    // Une mention de la cible, avec un label ecrit a la main.
    const textBlock = await createBlock(ownerClient, { entityId: other.id, blockType: "text", label: "Notes", visibilityLevel: "public", visibilityScopeId: null, createdBy: ownerId });
    if (!textBlock.ok) throw new Error("creation bloc texte refusee");
    const textData = {
      __v: 1,
      dropCap: false,
      segments: [
        {
          id: "s1",
          blockType: "paragraph",
          visibility: { level: "public", scopeId: null },
          content: [{ t: "ref", kind: "entity", id: target.id, label: "la voyageuse" }],
          align: "left",
        },
      ],
    };
    const savedText = await updateBlockContent(ownerClient, {
      id: textBlock.block.id,
      expectedVersion: textBlock.block.version,
      display: textBlock.block.display as unknown as Json,
      data: textData,
      visibilityLevel: "public",
      visibilityScopeId: null,
      changedBy: ownerId,
    });
    if (!savedText.ok) throw new Error("ecriture du texte refusee");

    // Le bloc personnage recoit un prenom et un nom.
    const characterBlock = await createBlock(ownerClient, { entityId: target.id, blockType: "character", label: "Personnage", visibilityLevel: "public", visibilityScopeId: null, createdBy: ownerId });
    if (!characterBlock.ok) throw new Error("creation bloc personnage refusee");
    const saved = await updateBlockContent(ownerClient, {
      id: characterBlock.block.id,
      expectedVersion: characterBlock.block.version,
      display: characterBlock.block.display as unknown as Json,
      data: { ...(characterBlock.block.data as Record<string, unknown>), given_name: "Mira", family_name: "Vance" },
      visibilityLevel: "public",
      visibilityScopeId: null,
      changedBy: ownerId,
    });
    expect(saved.ok).toBe(true);

    const renamed = await getEntityById(ownerClient, target.id);
    expect(renamed?.name).toBe("Mira Vance");
    expect(renamed?.slug).toBe(target.slug);

    // La mention pointe toujours la meme entite (par id), et son label n'a pas bouge.
    const reread = zTextBlockData.parse((await ownerClient.from("blocks").select("data").eq("id", textBlock.block.id).single()).data?.data);
    expect(collectRefTargetIds(reread.segments).entityIds).toEqual([target.id]);
    expect(reread.segments[0].content[0]).toMatchObject({ t: "ref", id: target.id, label: "la voyageuse" });
  });
});
