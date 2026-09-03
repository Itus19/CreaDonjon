-- V2-L1 — meme etape que 20260902190003, pour background_images :
-- `backdrop_image` n'est plus jamais ecrite par un nouveau televersement
-- (voir uploadBackgroundImage, src/server/services/backgroundImages.ts).

alter table background_images
  alter column backdrop_image drop not null;
