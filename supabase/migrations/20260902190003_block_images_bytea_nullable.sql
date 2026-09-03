-- V2-L1 — deuxieme etape : un nouveau televersement n'ecrit plus jamais
-- `image`/`mime_type`/`width`/`height` (voir uploadBlockImage,
-- src/server/services/blockImages.ts), ces colonnes doivent donc devenir
-- facultatives pour que l'upsert ne les redemande plus. Les lignes
-- existantes gardent leurs valeurs telles quelles jusqu'au script de
-- bascule (scripts/migrate-block-images.ts) puis a la migration finale qui
-- retirera ces colonnes.

alter table block_images
  alter column image drop not null,
  alter column mime_type drop not null,
  alter column width drop not null,
  alter column height drop not null;
