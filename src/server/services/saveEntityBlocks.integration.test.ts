import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import type { Database } from "@/src/types/database";
import { saveEntityBlocks, type BlockChangeInput } from "./blocks";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-31 — l'enregistrement groupe de l'editeur plein ecran
 * (`saveEntityBlocks` → `public.save_entity_blocks`) contre une vraie base :
 * deux blocs modifies et reordonnes en UNE ecriture (une seule revision) ;
 * une version perimee n'ecrit RIEN ; un joueur sans droit d'ecriture est
 * refuse ; un bloc d'une autre fiche est introuvable ; une donnee invalide est
 * rejetee avant toute ecriture.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

type Client = SupabaseClient<Database>;

const texte = (mot: string) => ({
  __v: 1,
  segments: [{ id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: mot }], align: "left" }],
  dropCap: false,
});

describe.skipIf(!hasCreds)("saveEntityBlocks (integration, base reelle)", () => {
  let admin: Client;
  let owner: { id: string; client: Client };
  let player: { id: string; client: Client };
  let worldId: string;
  let entityId: string;
  let otherEntityId: string;
  const blocs: Record<"a" | "b" | "autre", string> = { a: "", b: "", autre: "" };

  async function lireBloc(id: string) {
    const { data, error } = await admin.from("blocks").select("version, data, display_order").eq("id", id).single();
    if (error || !data) throw new Error(error?.message ?? "bloc introuvable");
    return data;
  }

  async function compterRevisions() {
    const { count, error } = await admin.from("entity_revisions").select("id", { count: "exact", head: true }).eq("entity_id", entityId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  function changement(id: string, version: number, mot: string, displayOrder: number): BlockChangeInput {
    return {
      id,
      version,
      display: { label: "Texte", layout: "prose" },
      data: texte(mot),
      visibilityLevel: "public",
      visibilityScopeId: null,
      displayOrder,
    };
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const [o, p] = await Promise.all([getReusableTestAccount(admin, "owner"), getReusableTestAccount(admin, "player")]);
    owner = { id: o.id, client: o.client as Client };
    player = { id: p.id, client: p.client as Client };

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test enregistrement groupe", slug: `integration-test-save-blocks-${Date.now()}`, owner_id: owner.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel");
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    const { error: memberError } = await admin.from("campaign_members").insert({ campaign_id: campaign.id, user_id: player.id, role: "player" });
    if (memberError) throw new Error(memberError.message);

    const { data: entities, error: entityError } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "fiche-editee", name: "Fiche éditée", entity_kind: "location", created_by: owner.id, is_public: true },
        { world_id: worldId, slug: "autre-fiche", name: "Autre fiche", entity_kind: "location", created_by: owner.id, is_public: true },
      ])
      .select("id, slug");
    if (entityError || !entities) throw new Error(entityError?.message ?? "creation entites echouee");
    entityId = entities.find((e) => e.slug === "fiche-editee")!.id;
    otherEntityId = entities.find((e) => e.slug === "autre-fiche")!.id;

    const ligne = (entity: string, ordre: number, mot: string) => ({
      entity_id: entity,
      block_type: "text",
      display: { label: "Texte", layout: "prose" },
      data: texte(mot),
      display_order: ordre,
      visibility_level: "public",
      visibility_scope_id: null,
      created_by: owner.id,
    });
    const { data: rows, error: blockError } = await admin
      .from("blocks")
      .insert([ligne(entityId, 1000, "un"), ligne(entityId, 2000, "deux"), ligne(otherEntityId, 1000, "ailleurs")])
      .select("id, entity_id, display_order");
    if (blockError || !rows) throw new Error(blockError?.message ?? "creation blocs echouee");
    blocs.a = rows.find((r) => r.entity_id === entityId && Number(r.display_order) === 1000)!.id;
    blocs.b = rows.find((r) => r.entity_id === entityId && Number(r.display_order) === 2000)!.id;
    blocs.autre = rows.find((r) => r.entity_id === otherEntityId)!.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("deux blocs modifies et reordonnes : une seule ecriture, une seule revision", async () => {
    const avant = await compterRevisions();
    const result = await saveEntityBlocks(owner.client, {
      entityId,
      changedBy: owner.id,
      changes: [changement(blocs.a, 1, "un modifié", 3000), changement(blocs.b, 1, "deux modifié", 500)],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blocks.map((b) => b.id).sort()).toEqual([blocs.a, blocs.b].sort());

    const [a, b] = await Promise.all([lireBloc(blocs.a), lireBloc(blocs.b)]);
    expect(a.version).toBe(2);
    expect(b.version).toBe(2);
    expect(Number(a.display_order)).toBe(3000);
    expect(Number(b.display_order)).toBe(500);
    expect(JSON.stringify(a.data)).toContain("un modifié");
    expect(await compterRevisions()).toBe(avant + 1);
  });

  it("une version perimee n'ecrit rien : le bloc a jour non plus", async () => {
    const result = await saveEntityBlocks(owner.client, {
      entityId,
      changedBy: owner.id,
      // `a` est a jour (version 2), `b` est perime (version 1) : TOUT est annule.
      changes: [changement(blocs.a, 2, "ne doit pas rester", 3000), changement(blocs.b, 1, "ni celui-ci", 500)],
    });
    expect(result).toEqual({ ok: false, reason: "conflict" });
    const a = await lireBloc(blocs.a);
    expect(a.version).toBe(2);
    expect(JSON.stringify(a.data)).not.toContain("ne doit pas rester");
  });

  it("un joueur sans droit d'ecriture est refuse, et rien ne change", async () => {
    const result = await saveEntityBlocks(player.client, {
      entityId,
      changedBy: player.id,
      changes: [changement(blocs.a, 2, "par le joueur", 3000)],
    });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect((await lireBloc(blocs.a)).version).toBe(2);
  });

  it("un bloc d'une autre fiche est introuvable", async () => {
    const result = await saveEntityBlocks(owner.client, {
      entityId,
      changedBy: owner.id,
      changes: [changement(blocs.autre, 1, "detourne", 1000)],
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect((await lireBloc(blocs.autre)).version).toBe(1);
  });

  it("une donnee invalide est rejetee avant toute ecriture", async () => {
    await expect(
      saveEntityBlocks(owner.client, {
        entityId,
        changedBy: owner.id,
        changes: [{ ...changement(blocs.a, 2, "x", 3000), data: { __v: 99 } }],
      })
    ).rejects.toBeInstanceOf(ZodError);
    expect((await lireBloc(blocs.a)).version).toBe(2);
  });
});
