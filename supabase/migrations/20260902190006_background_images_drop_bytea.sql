-- V2-L1 — meme etape finale que 20260902190005, pour background_images :
-- aucune ligne au moment de la bascule (verifie via
-- scripts/migrate-background-images.ts en simulation, 0 image trouvee).
-- `thumb_data_url` n'est jamais touchee (reste une colonne DB, hors de
-- portee de ce ticket).

alter table background_images
  drop column backdrop_image,
  alter column asset_id set not null;
