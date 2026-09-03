// V2-L1 (Lot L, hebergement) — meme bascule que migrate-block-images.ts,
// pour `background_images.backdrop_image` vers `assets`/Storage
// (`asset_id`). Copie les octets TELS QUELS (deja redimensionnes/encodes en
// webp par l'ancien pipeline, BACKDROP_MAX_DIMENSION=1920/qualite 72
// qu'aujourd'hui) : jamais une re-compression. `thumb_data_url` n'est PAS
// touchee (reste une colonne DB, jamais migree — voir la migration de
// schema).
//
// visibility_level "user" scope a owner_id — un fond d'ecran est un reglage
// de compte, jamais partage. `worldId` de stockage : n'importe quel monde
// possede par ce compte, sinon n'importe quel monde dont il est membre
// (pure organisation du bucket, voir src/server/repos/worlds.ts#getAnyWorldIdForUser).
//
// Idempotent : ignore toute ligne qui a deja un `asset_id`. Ne retire JAMAIS
// `backdrop_image` — colonne retiree dans une migration separee, une fois
// la bascule verifiee en direct.
//
// Lancement : npm run migrate:background-images           (simulation, lit seulement)
//             npm run migrate:background-images -- --write (ecrit pour de vrai)

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

interface OldBackgroundImageRow {
  id: string;
  owner_id: string;
  backdrop_image: string;
  asset_id: string | null;
}

async function resolveStorageWorldId(ownerId: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(ownerId)) return cache.get(ownerId)!;
  const { data: owned, error: ownedError } = await supabase
    .from("worlds")
    .select("id")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownedError) throw new Error(ownedError.message);
  if (owned) {
    cache.set(ownerId, owned.id);
    return owned.id;
  }
  const { data: member, error: memberError } = await supabase
    .from("world_members")
    .select("world_id")
    .eq("user_id", ownerId)
    .order("added_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  const worldId = member?.world_id ?? null;
  cache.set(ownerId, worldId);
  return worldId;
}

async function main() {
  const { data: images, error: imagesError } = await supabase
    .from("background_images")
    .select("id, owner_id, backdrop_image, asset_id")
    .returns<OldBackgroundImageRow[]>();
  if (imagesError) throw new Error(imagesError.message);
  console.log(`${images.length} image(s) de fond trouvee(s) dans background_images.`);

  const worldIdByOwner = new Map<string, string | null>();
  let migrated = 0;
  let skipped = 0;

  for (const row of images) {
    if (row.asset_id) {
      skipped++;
      continue;
    }
    const worldId = await resolveStorageWorldId(row.owner_id, worldIdByOwner);
    if (!worldId) {
      console.warn(`  ! aucun monde resoluble pour le compte ${row.owner_id} (image ${row.id}), ignoree.`);
      continue;
    }

    const buffer = byteaToBuffer(row.backdrop_image);
    const assetId = randomUUID();
    const storagePath = `${worldId}/${assetId}.webp`;

    console.log(`  -> image ${row.id} (compte ${row.owner_id}) : ${buffer.byteLength} octets`);

    if (WRITE) {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: "image/webp",
        upsert: false,
      });
      if (uploadError) throw new Error(`upload ${row.id}: ${uploadError.message}`);

      const { error: assetError } = await supabase.from("assets").insert({
        id: assetId,
        world_id: worldId,
        storage_path: storagePath,
        mime_type: "image/webp",
        byte_size: buffer.byteLength,
        width: null,
        height: null,
        alt_text: null,
        visibility_level: "user",
        visibility_scope_id: row.owner_id,
        uploaded_by: row.owner_id,
      });
      if (assetError) throw new Error(`insert assets ${row.id}: ${assetError.message}`);

      const { error: pointerError } = await supabase.from("background_images").update({ asset_id: assetId }).eq("id", row.id);
      if (pointerError) throw new Error(`update background_images ${row.id}: ${pointerError.message}`);
    }
    migrated++;
  }

  console.log(`\n${WRITE ? "Migrees" : "A migrer (simulation, relancer avec --write pour ecrire)"} : ${migrated}. Deja migrees : ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
