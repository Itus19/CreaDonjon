-- V2-L1 — etape finale : `block_images` ne contenait aucune ligne au moment
-- de la bascule (verifie via scripts/migrate-block-images.ts en simulation,
-- 0 image trouvee) — retire directement les colonnes bytea/metadonnees
-- devenues mortes, jamais utilisees par le nouveau chemin (`asset_id`), et
-- rend `asset_id` obligatoire.

alter table block_images
  drop column image,
  drop column mime_type,
  drop column width,
  drop column height,
  alter column asset_id set not null;
