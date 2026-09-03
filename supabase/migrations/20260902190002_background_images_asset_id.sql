-- V2-L1 (Lot L, hebergement) — meme bascule que 20260902190001, pour
-- background_images.backdrop_image. `thumb_data_url` reste une colonne DB
-- (minuscule, deja une data URL prete a l'emploi, jamais un bytea) : seul
-- le backdrop plein format migre.

alter table background_images
  add column asset_id uuid references assets(id) on delete set null;
