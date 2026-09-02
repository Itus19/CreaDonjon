// Phase F2 (Lot I) — bascule les portraits existants de `entity_portraits`
// (bytea, stockage direct en base) vers `assets`/Storage + `entity_assets`
// (role='portrait'), la meme interface deja utilisee par les cartes (ADR
// 0017 decision 3). Copie les octets TELS QUELS (deja redimensionnes/
// encodes en webp par l'ancien pipeline de televersement, meme borne
// PORTRAIT_MAX_DIMENSION=640/qualite 82 qu'aujourd'hui) : jamais une
// re-compression, qui degraderait une image deja finalisee sans aucun
// benefice.
//
// Idempotent : ignore toute fiche qui a deja une ligne `entity_assets`
// role='portrait' (deja migree), donc relancable sans risque apres un essai
// partiel. Ne supprime JAMAIS `entity_portraits` — la table reste en place
// comme filet de securite jusqu'a une migration separee qui la retire,
// ecrite seulement une fois la bascule verifiee en direct.
//
// Lancement : npm run migrate:entity-portraits           (simulation, lit seulement)
//             npm run migrate:entity-portraits -- --write (ecrit pour de vrai)

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WRITE = process.argv.includes("--write");
const BUCKET = "assets";

function byteaToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/^\\x/, ""), "hex");
}

interface OldPortraitRow {
  entity_id: string;
  image: string;
  mime_type: string;
  width: number;
  height: number;
  display_size_pct: number;
  align: string;
}

async function main() {
  const { data: portraits, error: portraitsError } = await supabase
    .from("entity_portraits")
    .select("entity_id, image, mime_type, width, height, display_size_pct, align")
    .returns<OldPortraitRow[]>();
  if (portraitsError) throw new Error(portraitsError.message);
  console.log(`${portraits.length} portrait(s) trouve(s) dans entity_portraits.`);

  const { data: alreadyMigrated, error: migratedError } = await supabase
    .from("entity_assets")
    .select("entity_id")
    .eq("role", "portrait");
  if (migratedError) throw new Error(migratedError.message);
  const migratedIds = new Set(alreadyMigrated.map((r) => r.entity_id));

  const { data: entities, error: entitiesError } = await supabase.from("entities").select("id, world_id, name, created_by");
  if (entitiesError) throw new Error(entitiesError.message);
  const entityById = new Map(entities.map((e) => [e.id, e]));

  const { data: worlds, error: worldsError } = await supabase.from("worlds").select("id, owner_id");
  if (worldsError) throw new Error(worldsError.message);
  const worldOwnerById = new Map(worlds.map((w) => [w.id, w.owner_id]));

  let migrated = 0;
  let skipped = 0;

  for (const portrait of portraits) {
    if (migratedIds.has(portrait.entity_id)) {
      skipped++;
      continue;
    }
    const entity = entityById.get(portrait.entity_id);
    if (!entity) {
      console.warn(`  ! fiche ${portrait.entity_id} introuvable (portrait orphelin), ignoree.`);
      continue;
    }
    const uploadedBy = entity.created_by ?? worldOwnerById.get(entity.world_id) ?? null;
    if (!uploadedBy) {
      console.warn(`  ! aucun proprietaire resoluble pour la fiche "${entity.name}" (${entity.id}), ignoree.`);
      continue;
    }

    const buffer = byteaToBuffer(portrait.image);
    const assetId = randomUUID();
    const ext = portrait.mime_type === "image/png" ? "png" : portrait.mime_type === "image/jpeg" ? "jpg" : "webp";
    const storagePath = `${entity.world_id}/${assetId}.${ext}`;

    console.log(`  -> "${entity.name}" (${entity.id}) : ${buffer.byteLength} octets, ${portrait.width}x${portrait.height}, ${portrait.mime_type}`);

    if (WRITE) {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: portrait.mime_type,
        upsert: false,
      });
      if (uploadError) throw new Error(`upload ${entity.id}: ${uploadError.message}`);

      const { error: assetError } = await supabase.from("assets").insert({
        id: assetId,
        world_id: entity.world_id,
        storage_path: storagePath,
        mime_type: portrait.mime_type,
        byte_size: buffer.byteLength,
        width: portrait.width,
        height: portrait.height,
        alt_text: null,
        visibility_level: "public",
        visibility_scope_id: null,
        uploaded_by: uploadedBy,
      });
      if (assetError) throw new Error(`insert assets ${entity.id}: ${assetError.message}`);

      const { error: pointerError } = await supabase.from("entity_assets").insert({
        entity_id: entity.id,
        asset_id: assetId,
        role: "portrait",
        display_size_pct: portrait.display_size_pct,
        align: portrait.align,
      });
      if (pointerError) throw new Error(`insert entity_assets ${entity.id}: ${pointerError.message}`);
    }
    migrated++;
  }

  console.log(`\n${WRITE ? "Migres" : "A migrer (simulation, relancer avec --write pour ecrire)"} : ${migrated}. Deja migres : ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
