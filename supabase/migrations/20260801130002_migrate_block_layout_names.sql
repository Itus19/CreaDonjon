-- V0-06e (suite de 20260801130001) : le renommage du type de bloc ne
-- suffit pas — `display.layout` (jsonb) des lignes existantes porte encore
-- l'ancien nom "gallery" (specs/wiki-blocs.md §1), rejete par le nouvel
-- enum de zBlockDisplay (prose/key_values/image/table) a la prochaine
-- sauvegarde de ce bloc (400 sur le PATCH). Idempotent.

update blocks
set display = jsonb_set(display, '{layout}', '"image"')
where display ->> 'layout' = 'gallery';
