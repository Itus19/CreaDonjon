-- V2-L1 (Lot L, hebergement) — premiere etape de la bascule de
-- block_images.image (bytea) vers l'interface de stockage commune deja
-- eprouvee par les cartes/portraits (storage.ts, bucket "assets").
--
-- Colonne nullable pour l'instant : le code applicatif continue de lire
-- l'ancien bytea tant que le script de bascule (scripts/migrate-block-images.ts)
-- n'a pas rempli asset_id pour les lignes existantes. `image`/`mime_type`/
-- `width`/`height` seront retirees dans une migration separee, une fois la
-- bascule verifiee en direct (meme sequence que entity_portraits).

alter table block_images
  add column asset_id uuid references assets(id) on delete set null;
