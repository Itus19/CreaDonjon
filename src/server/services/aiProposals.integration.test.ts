import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyAiProposal, rejectAiProposal } from "./aiProposals";
import { createBlock } from "./blocks";
import { insertAiProposal } from "@/src/server/repos/aiProposals";
import { listRevisions } from "./entityHistory";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V1-F3 : sans ce test, rien ne prouve que "Accepter" ecrit reellement le
 * segment dans le bloc (avec une revision `changeSource: ai`) et que
 * "Rejeter" ne touche jamais au bloc — I/O reelle sur `blocks`,
 * `ai_proposals` et `entity_revisions` que les tests purs ne peuvent pas
 * exercer. Se saute silencieusement si .env.local n'est pas configure.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("applyAiProposal / rejectAiProposal (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let worldId: string;
  let entityId: string;
  let blockId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    userId = (await getReusableTestAccount(admin, "owner")).id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — proposals IA", slug: `test-aiproposals-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, name: "Village test", entity_kind: "location", slug: `village-test-${Date.now()}`, created_by: userId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;

    const created = await createBlock(admin, {
      entityId,
      blockType: "text",
      label: "Description",
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: userId,
    });
    if (!created.ok) throw new Error("creation bloc refusee");
    blockId = created.block.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("ai_proposals").delete().eq("target_entity_id", entityId);
      await admin.from("entities").delete().eq("created_by", userId);
      await admin.from("worlds").delete().eq("owner_id", userId);
    }
  });

  it("applique une proposition pending : le segment est ecrit et une revision changeSource=ai est creee", async () => {
    const proposal = await insertAiProposal(admin, {
      worldId,
      campaignId: null,
      kind: "update_block",
      targetEntityId: entityId,
      payload: { blockId, text: "Le village vit de la peche et du commerce fluvial." },
      status: "pending",
    });

    const outcome = await applyAiProposal(admin, { proposalId: proposal.id, userId });
    expect(outcome).toEqual({ ok: true });

    const { data: block } = await admin.from("blocks").select("data").eq("id", blockId).single();
    const segments = (block!.data as { segments: Array<{ content: Array<{ v: string }> }> }).segments;
    expect(segments.some((s) => s.content[0]?.v === "Le village vit de la peche et du commerce fluvial.")).toBe(true);

    const { data: updatedProposal } = await admin.from("ai_proposals").select("*").eq("id", proposal.id).single();
    expect(updatedProposal).toMatchObject({ status: "applied", reviewed_by: userId });

    const revisions = await listRevisions(admin, entityId);
    expect(revisions.some((r) => r.change_source === "ai")).toBe(true);
  });

  /**
   * V3.1-65, critere d'acceptation : « une proposition de l'IA ne modifie pas
   * le bloc tant qu'elle n'est pas acceptee ». Le test voisin couvrait le
   * REFUS ; celui-ci couvre le cas qui dure le plus longtemps en pratique —
   * une proposition simplement posee, que l'auteur laisse en attente le
   * temps de la relire. C'est l'etat dans lequel l'encart l'affiche en
   * pointille : visible a l'ecran, absente de la donnee.
   */
  it("une proposition laissee en attente ne touche pas le bloc", async () => {
    const { data: avant } = await admin.from("blocks").select("data, version").eq("id", blockId).single();

    await insertAiProposal(admin, {
      worldId,
      campaignId: null,
      kind: "update_block",
      targetEntityId: entityId,
      payload: { blockId, text: "Un paragraphe propose, pas encore accepte." },
      status: "pending",
    });

    const { data: apres } = await admin.from("blocks").select("data, version").eq("id", blockId).single();
    expect(apres!.version).toBe(avant!.version);
    expect(apres!.data).toEqual(avant!.data);
    expect(JSON.stringify(apres!.data)).not.toContain("pas encore accepte");
  });

  it("rejette une proposition pending sans jamais toucher au bloc", async () => {
    const { data: blockBefore } = await admin.from("blocks").select("data, version").eq("id", blockId).single();

    const proposal = await insertAiProposal(admin, {
      worldId,
      campaignId: null,
      kind: "update_block",
      targetEntityId: entityId,
      payload: { blockId, text: "Un texte que l'utilisateur va rejeter." },
      status: "pending",
    });

    const outcome = await rejectAiProposal(admin, { proposalId: proposal.id, userId });
    expect(outcome).toEqual({ ok: true });

    const { data: blockAfter } = await admin.from("blocks").select("data, version").eq("id", blockId).single();
    expect(blockAfter!.version).toBe(blockBefore!.version);
    expect(blockAfter!.data).toEqual(blockBefore!.data);

    const { data: updatedProposal } = await admin.from("ai_proposals").select("*").eq("id", proposal.id).single();
    expect(updatedProposal).toMatchObject({ status: "rejected", reviewed_by: userId });
  });

  it("V3-C5 — 'modifier' : le texte edite remplace le texte propose, jamais les deux", async () => {
    const proposal = await insertAiProposal(admin, {
      worldId,
      campaignId: null,
      kind: "update_block",
      targetEntityId: entityId,
      payload: { blockId, text: "Texte propose par le modele." },
      status: "pending",
    });

    const outcome = await applyAiProposal(admin, { proposalId: proposal.id, userId, overrideText: "Texte reecrit par l'auteur avant d'accepter." });
    expect(outcome).toEqual({ ok: true });

    const { data: block } = await admin.from("blocks").select("data").eq("id", blockId).single();
    const segments = (block!.data as { segments: Array<{ content: Array<{ v: string }> }> }).segments;
    expect(segments.some((s) => s.content[0]?.v === "Texte reecrit par l'auteur avant d'accepter.")).toBe(true);
    expect(segments.some((s) => s.content[0]?.v === "Texte propose par le modele.")).toBe(false);
  });

  it("V3-C3 — accepte auto_applied a l'ecriture (colonne reelle, pas simulee)", async () => {
    const proposal = await insertAiProposal(admin, {
      worldId,
      campaignId: null,
      kind: "create_entity",
      targetEntityId: entityId,
      payload: { name: "Grelin", trait: "cicatrice" },
      status: "applied",
      autoApplied: true,
      appliedAt: new Date().toISOString(),
    });
    expect(proposal.autoApplied).toBe(true);
    expect(proposal.status).toBe("applied");
    expect(proposal.sessionEventId).toBeNull();
  });

  it("refuse d'appliquer deux fois la meme proposition", async () => {
    const proposal = await insertAiProposal(admin, {
      worldId,
      campaignId: null,
      kind: "update_block",
      targetEntityId: entityId,
      payload: { blockId, text: "Texte applique une seule fois." },
      status: "pending",
    });

    const first = await applyAiProposal(admin, { proposalId: proposal.id, userId });
    expect(first).toEqual({ ok: true });

    const second = await applyAiProposal(admin, { proposalId: proposal.id, userId });
    expect(second).toEqual({ ok: false, reason: "not_pending" });
  });
});
