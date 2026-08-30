import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getMergedJournalForWorld, getPlayerJournalForWorld } from "./activityJournal";

/**
 * Retour utilisateur (ecran d'accueil 3 colonnes) : `getPlayerJournalForWorld`
 * doit restreindre les revisions aux fiches PJ, jamais reveler qu'un PNJ
 * secret du MJ a ete modifie — `getMergedJournalForWorld` (vue MJ) reste
 * complet. Sans ce test, rien ne prouve que le filtre par `is_pc` marche
 * vraiment plutot que de simplement compiler.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("journal cote joueur restreint aux fiches PJ (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerId: string;
  let worldId: string;
  let pcEntityId: string;
  let npcEntityId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const { data: owner, error: ownerError } = await admin.auth.admin.createUser({
      email: `integration-test-journal-owner-${Date.now()}@creadonjon.local`,
      password: `integration-test-${Date.now()}`,
      email_confirm: true,
    });
    if (ownerError || !owner.user) throw new Error(ownerError?.message ?? "creation proprietaire echouee");
    ownerId = owner.user.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test journal joueur", slug: `integration-test-journal-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");

    const { data: pcEntity, error: pcEntityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "pj-test", name: "Personnage joueur", entity_kind: "character", created_by: ownerId })
      .select("id")
      .single();
    if (pcEntityError || !pcEntity) throw new Error(pcEntityError?.message ?? "creation fiche PJ echouee");
    pcEntityId = pcEntity.id;

    const { data: npcEntity, error: npcEntityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "pnj-secret", name: "PNJ secret du MJ", entity_kind: "character", created_by: ownerId })
      .select("id")
      .single();
    if (npcEntityError || !npcEntity) throw new Error(npcEntityError?.message ?? "creation fiche PNJ echouee");
    npcEntityId = npcEntity.id;

    const { error: characterError } = await admin
      .from("campaign_characters")
      .insert({ campaign_id: campaign.id, entity_id: pcEntityId, is_pc: true, user_id: null });
    if (characterError) throw new Error(characterError.message);
    const { error: npcCharacterError } = await admin
      .from("campaign_characters")
      .insert({ campaign_id: campaign.id, entity_id: npcEntityId, is_pc: false, user_id: null });
    if (npcCharacterError) throw new Error(npcCharacterError.message);

    const { error: pcRevisionError } = await admin
      .from("entity_revisions")
      .insert({ entity_id: pcEntityId, revision_number: 1, snapshot: {}, change_source: "user", changed_by: ownerId });
    if (pcRevisionError) throw new Error(pcRevisionError.message);
    const { error: npcRevisionError } = await admin
      .from("entity_revisions")
      .insert({ entity_id: npcEntityId, revision_number: 1, snapshot: {}, change_source: "user", changed_by: ownerId });
    if (npcRevisionError) throw new Error(npcRevisionError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  });

  it("getPlayerJournalForWorld ne montre que la revision de la fiche PJ, jamais celle du PNJ secret", async () => {
    const entries = await getPlayerJournalForWorld(admin, worldId);
    const entityNames = entries.map((e) => e.entityName);
    expect(entityNames).toContain("Personnage joueur");
    expect(entityNames).not.toContain("PNJ secret du MJ");
  });

  it("getMergedJournalForWorld (vue MJ) montre les deux fiches", async () => {
    const entries = await getMergedJournalForWorld(admin, worldId);
    const entityNames = entries.map((e) => e.entityName);
    expect(entityNames).toContain("Personnage joueur");
    expect(entityNames).toContain("PNJ secret du MJ");
  });
});
