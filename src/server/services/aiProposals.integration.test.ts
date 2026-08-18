import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyAiProposal, rejectAiProposal } from "./aiProposals";
import { createBlock } from "./blocks";
import { insertAiProposal } from "@/src/server/repos/aiProposals";
import { listRevisions } from "./entityHistory";

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
    const email = `integration-test-aiproposals-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

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

    const block = await createBlock(admin, {
      entityId,
      blockType: "text",
      label: "Description",
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: userId,
    });
    blockId = block.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("ai_proposals").delete().eq("target_entity_id", entityId);
      await admin.from("entities").delete().eq("created_by", userId);
      await admin.from("worlds").delete().eq("owner_id", userId);
      await admin.auth.admin.deleteUser(userId);
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
