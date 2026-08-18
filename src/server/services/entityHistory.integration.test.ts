import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/src/types/database";
import { createEntity } from "./entities";
import { createBlock, updateBlockContent } from "./blocks";
import {
  compareRevisionsForViewer,
  getRevisionForViewer,
  listRevisions,
  restoreRevision,
} from "./entityHistory";

/**
 * V1-C3 : verifie, contre une vraie base, la propriete la plus subtile de
 * ce ticket — un instantane d'historique doit rester COMPLET (SCHEMA.md
 * §15 : "entite + blocs, en entier") meme quand c'est un JOUEUR qui
 * declenche l'ecriture. Depuis V1-C2, la RLS de `blocks` filtre par
 * visibilite fine : sans le contournement borne de la migration
 * 20260804160001 (public.entity_blocks_full, security definer, gate
 * is_world_member), le client du joueur ne recupererait meme pas, via sa
 * propre session, le bloc `gm` d'une autre personne sur la meme entite — et
 * la revision qu'il declenche l'omettrait silencieusement.
 *
 * Verifie aussi le filtrage cote LECTURE (getRevisionForViewer,
 * compareRevisionsForViewer) : le joueur ne doit jamais voir ce bloc `gm`
 * dans l'historique, meme s'il a lui-meme cause l'ecriture de la revision
 * qui le contient.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("historique du wiki (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerClient: SupabaseClient;
  let playerClient: SupabaseClient;
  let ownerId: string;
  let playerId: string;
  let worldId: string;
  let entityId: string;

  async function createProfile(key: string): Promise<{ id: string; client: SupabaseClient }> {
    const email = `integration-test-hist-${key}-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? `creation ${key} echouee`);
    const client = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const [owner, player] = await Promise.all([createProfile("owner"), createProfile("player")]);
    ownerId = owner.id;
    ownerClient = owner.client;
    playerId = player.id;
    playerClient = player.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test historique", slug: `integration-test-hist-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    // Le joueur est membre d'une CAMPAGNE de ce monde (role "player"), pas
    // simple "viewer" du monde : canSee()/visibility_permits exige une
    // appartenance a une campagne pour le niveau 'players' (SCHEMA.md §4.2)
    // — un simple world_members ne suffit pas, un premier essai avec
    // uniquement ce role a d'ailleurs echoue avec une erreur RLS a
    // l'insertion (la ligne inseree ne satisfaisait pas sa propre politique
    // de lecture), confirmant cette exigence en pratique.
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

    const { error: memberError } = await admin
      .from("campaign_members")
      .insert({ campaign_id: campaign.id, user_id: playerId, role: "player" });
    if (memberError) throw new Error(memberError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    for (const id of [ownerId, playerId]) if (id) await admin.auth.admin.deleteUser(id);
  });

  it("un bloc gm reste dans l'instantane meme quand un joueur declenche l'ecriture, et reste filtre a la lecture", async () => {
    const entity = await createEntity(ownerClient, {
      worldId,
      createdBy: ownerId,
      name: "Cible de test",
      entityKind: "character",
      aliases: [],
    });
    entityId = entity.id;

    // Bloc gm cree par le proprietaire (statblock reserve au MJ).
    await createBlock(ownerClient, {
      entityId,
      blockType: "text",
      label: "Secrets du MJ",
      visibilityLevel: "gm",
      visibilityScopeId: null,
      createdBy: ownerId,
    });

    // Le joueur edite SON propre bloc (visible de tous les joueurs) : ceci
    // declenche une nouvelle revision via son propre client, RLS-gate.
    await createBlock(playerClient, {
      entityId,
      blockType: "text",
      label: "Notes du joueur",
      visibilityLevel: "players",
      visibilityScopeId: null,
      createdBy: playerId,
    });

    const revisions = await listRevisions(ownerClient, entityId);
    const latest = revisions[0];
    expect(latest.revision_number).toBe(3); // creation entite (1) + bloc gm (2) + bloc joueur (3)

    // Lu par le proprietaire : l'instantane complet contient les DEUX blocs.
    const asOwner = await getRevisionForViewer(ownerClient, worldId, entityId, latest.revision_number, ownerId);
    expect(asOwner?.snapshot.blocks.map((b) => b.blockType).length).toBe(2);

    // Lu par le joueur : le bloc gm est filtre, un seul bloc visible.
    const asPlayer = await getRevisionForViewer(playerClient, worldId, entityId, latest.revision_number, playerId);
    expect(asPlayer?.snapshot.blocks).toHaveLength(1);
    expect((asPlayer?.snapshot.blocks[0].display as { label: string }).label).toBe("Notes du joueur");
  });

  it("le diff entre deux revisions est filtre AVANT comparaison : le joueur n'apprend meme pas qu'un bloc gm existe", async () => {
    const diffAsOwner = await compareRevisionsForViewer(ownerClient, worldId, entityId, 1, 3, ownerId);
    expect(diffAsOwner?.blocks).toHaveLength(2); // les deux blocs ajoutes, du point de vue du proprietaire

    const diffAsPlayer = await compareRevisionsForViewer(playerClient, worldId, entityId, 1, 3, playerId);
    expect(diffAsPlayer?.blocks).toHaveLength(1); // seul son propre bloc apparait
    expect(diffAsPlayer?.blocks[0].label).toBe("Notes du joueur");
  });

  it("restaurer une revision anterieure, meme declenchee par un joueur, reinstalle fidelement le bloc gm", async () => {
    // Revision 1 : entite fraichement creee, aucun bloc.
    const result = await restoreRevision(playerClient, { entityId, revisionNumber: 1, changedBy: playerId });
    expect(result.ok).toBe(true);

    const revisions = await listRevisions(ownerClient, entityId);
    expect(revisions[0].revision_number).toBe(4);
    expect(revisions[0].change_note).toContain("Restauration de la revision 1");

    // Les deux blocs ont disparu (revision 1 n'en avait aucun), y compris le
    // bloc gm : verifie du point de vue du proprietaire, qui le verrait
    // s'il existait encore (regression directe du contournement
    // restore_entity_blocks, migration 20260804160002).
    const asOwner = await getRevisionForViewer(ownerClient, worldId, entityId, 4, ownerId);
    expect(asOwner?.snapshot.blocks).toHaveLength(0);
  });

  it("une revision au format plat d'avant ce ticket (sans blocs captures) se lit et se restaure sans planter ni rien effacer", async () => {
    // Un bloc existe actuellement (aucun depuis la restauration precedente) :
    // on en recree un pour verifier que le format legacy ne l'efface pas.
    await createBlock(ownerClient, {
      entityId,
      blockType: "text",
      label: "Bloc actuel",
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: ownerId,
    });

    // Simule une revision ecrite par l'ancien snapshotOf() (V0-04) : l'entite
    // a plat, aucune cle `blocks` du tout — jamais produite par le code
    // actuel, mais presente dans des lignes reelles plus anciennes.
    const { error: legacyInsertError } = await admin.from("entity_revisions").insert({
      entity_id: entityId,
      revision_number: 100,
      snapshot: { id: entityId, world_id: worldId, slug: "cible-de-test", name: "Ancien nom", entity_kind: "character", aliases: [], version: 1 },
      change_source: "user",
      changed_by: ownerId,
    });
    if (legacyInsertError) throw new Error(legacyInsertError.message);

    const legacyDetail = await getRevisionForViewer(ownerClient, worldId, entityId, 100, ownerId);
    expect(legacyDetail?.snapshot.blocks).toEqual([]);
    expect(legacyDetail?.snapshot.entity.name).toBe("Ancien nom");

    const restoreResult = await restoreRevision(ownerClient, { entityId, revisionNumber: 100, changedBy: ownerId });
    expect(restoreResult.ok).toBe(true);
    if (restoreResult.ok) expect(restoreResult.entity.name).toBe("Ancien nom");

    // Le bloc actuel doit survivre : la revision legacy n'a jamais su qu'il
    // existait, restaurer ne doit donc pas l'effacer.
    const latestRevisions = await listRevisions(ownerClient, entityId);
    const afterRestore = await getRevisionForViewer(ownerClient, worldId, entityId, latestRevisions[0].revision_number, ownerId);
    expect(afterRestore?.snapshot.blocks).toHaveLength(1);
  });

  /**
   * Reproduction directe du bug de concurrence rapporte en jouant (hors
   * ticket V1-C3) : deux blocs de la MEME entite sauvegardes a quelques
   * millisecondes d'intervalle (handleBlockBlur sur deux blocs differents)
   * declenchaient chacun recordEntityRevision en parallele, et l'ancien
   * SELECT max()+1 puis INSERT separes (deux requetes) pouvait lire le meme
   * max et planter en 500 sur la contrainte unique
   * entity_revisions_entity_id_revision_number_key. Entite dediee, pour ne
   * pas perturber les numeros de revision fixes que les tests precedents
   * verifient en dur.
   */
  it("deux blocs de la meme entite sauvegardes en parallele ne collisionnent pas sur revision_number", async () => {
    const entity = await createEntity(ownerClient, {
      worldId,
      createdBy: ownerId,
      name: "Cible de test concurrence",
      entityKind: "character",
      aliases: [],
    });

    const blockA = await createBlock(ownerClient, {
      entityId: entity.id,
      blockType: "text",
      label: "Bloc A",
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: ownerId,
    });
    const blockB = await createBlock(ownerClient, {
      entityId: entity.id,
      blockType: "text",
      label: "Bloc B",
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: ownerId,
    });

    const [resultA, resultB] = await Promise.all([
      updateBlockContent(ownerClient, {
        id: blockA.id,
        expectedVersion: blockA.version,
        display: blockA.display as unknown as Json,
        data: blockA.data,
        visibilityLevel: blockA.visibilityLevel,
        visibilityScopeId: blockA.visibilityScopeId,
        changedBy: ownerId,
      }),
      updateBlockContent(ownerClient, {
        id: blockB.id,
        expectedVersion: blockB.version,
        display: blockB.display as unknown as Json,
        data: blockB.data,
        visibilityLevel: blockB.visibilityLevel,
        visibilityScopeId: blockB.visibilityScopeId,
        changedBy: ownerId,
      }),
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);

    const revisions = await listRevisions(ownerClient, entity.id);
    // Creation entite + 2 creations de bloc + 2 mises a jour = 5 revisions,
    // toutes distinctes : aucune collision malgre les deux ecritures paralleles.
    expect(revisions).toHaveLength(5);
    expect(new Set(revisions.map((r) => r.revision_number)).size).toBe(5);
  });
});
