-- Teinte/chroma derivees de l'image (V2-G13, fond de wiki par bloc image) :
-- calculees a chaque televersement (meme fonction pure deriveHueChroma que
-- background_images, src/core/theme/oklch.ts), stockees ici plutot que
-- recalculees a chaque affichage de la page wiki.
alter table block_images
  add column hue numeric,
  add column chroma numeric,
  add column available_modes text[];
