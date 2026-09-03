// V2-L1 (Lot L, hebergement) — bascule les images de bloc existantes de
// `block_images.image` (bytea, stockage direct en base) vers `assets`/
// Storage (`asset_id`), meme interface deja utilisee par les cartes et les
// portraits (storage.ts). Copie les octets TELS QUELS (deja redimensionnes/
// encodes en webp par l'ancien pipeline de televersement, IMAGE_MAX_DIMENSION=1600/
// qualite 82 qu'aujourd'hui) : jamais une re-compression, qui degraderait
// une image deja finalisee sans aucun benefice.
//
// visibility_level "players" (jamais synchronise avec la visibilite REELLE
// du bloc, qui peut etre `gm`) — filet de securite uniforme, la garde qui
// compte reste `filterBlocks` cote service, deja verifiee AVANT ce script.
//
// Idempotent : ignore toute ligne qui a deja un `asset_id` (deja migree),
// donc relancable sans risque apres un essai partiel. Ne retire JAMAIS
// `image`/`mime_type`/`width`/`height` — ces colonnes restent en place comme
// filet de securite jusqu'a une migration separee qui les retire, ecrite
// seulement une fois la bascule verifiee en direct.
//
// Lancement : npm run migrate:block-images           (simulation, lit seulement)
//             npm run migrate:block-images -- --write (ecrit pour de vrai)

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

interface OldBlockImageRow {
  block_id: string;
  image: string;
  mime_type: string;
  width: number;
  height: number;
  asset_id: string | null;
}

async function main() {
  const { data: images, error: imagesError } = await supabase
    .from("block_images")
    .select("block_id, image, mime_type, width, height, asset_id")
    .returns<OldBlockImageRow[]>();
  if (imagesError) throw new Error(imagesError.message);
  console.log(`${images.length} image(s) de bloc trouvee(s) dans block_images.`);

  const blockIds = images.map((i) => i.block_id);
  const { data: blocks, error: blocksError } = await supabase.from("blocks").select("id, entity_id, created_by").in("id", blockIds);
  if (blocksError) throw new Error(blocksError.message);
  const blockById = new Map(blocks.map((b) => [b.id, b]));

  const entityIds = [...new Set(blocks.map((b) => b.entity_id))];
  const { data: entities, error: entitiesError } = await supabase.from("entities").select("id, world_id").in("id", entityIds);
  if (entitiesError) throw new Error(entitiesError.message);
  const entityById = new Map(entities.map((e) => [e.id, e]));

  const { data: worlds, error: worldsError } = await supabase.from("worlds").select("id, owner_id");
  if (worldsError) throw new Error(worldsError.message);
  const worldOwnerById = new Map(worlds.map((w) => [w.id, w.owner_id]));

  let migrated = 0;
  let skipped = 0;

  for (const row of images) {
    if (row.asset_id) {
      skipped++;
      continue;
    }
    const block = blockById.get(row.block_id);
    if (!block) {
      console.warn(`  ! bloc ${row.block_id} introuvable (image orpheline), ignoree.`);
      continue;
    }
    const entity = entityById.get(block.entity_id);
    if (!entity) {
      console.warn(`  ! fiche ${block.entity_id} introuvable pour le bloc ${row.block_id}, ignoree.`);
      continue;
    }
    const uploadedBy = block.created_by ?? worldOwnerById.get(entity.world_id) ?? null;
    if (!uploadedBy) {
      console.warn(`  ! aucun proprietaire resoluble pour le bloc ${row.block_id}, ignore.`);
      continue;
    }

    const buffer = byteaToBuffer(row.image);
    const assetId = randomUUID();
    const storagePath = `${entity.world_id}/${assetId}.webp`;

    console.log(`  -> bloc ${row.block_id} : ${buffer.byteLength} octets, ${row.width}x${row.height}`);

    if (WRITE) {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: row.mime_type,
        upsert: false,
      });
      if (uploadError) throw new Error(`upload ${row.block_id}: ${uploadError.message}`);

      const { error: assetError } = await supabase.from("assets").insert({
        id: assetId,
        world_id: entity.world_id,
        storage_path: storagePath,
        mime_type: row.mime_type,
        byte_size: buffer.byteLength,
        width: row.width,
        height: row.height,
        alt_text: null,
        visibility_level: "players",
        visibility_scope_id: null,
        uploaded_by: uploadedBy,
      });
      if (assetError) throw new Error(`insert assets ${row.block_id}: ${assetError.message}`);

      const { error: pointerError } = await supabase.from("block_images").update({ asset_id: assetId }).eq("block_id", row.block_id);
      if (pointerError) throw new Error(`update block_images ${row.block_id}: ${pointerError.message}`);
    }
    migrated++;
  }

  console.log(`\n${WRITE ? "Migrees" : "A migrer (simulation, relancer avec --write pour ecrire)"} : ${migrated}. Deja migrees : ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
