-- V0-06e (suite) : la migration precedente (20260801120001) renommait le
-- catalogue de types cote code (description->text, gallery->image) en
-- supposant qu'aucune ligne reelle n'utilisait ces types. Faux : des blocs
-- crees pendant les sessions de test manuel (`blocks.block_type`) portaient
-- encore les anciennes valeurs, rendues comme "Type de bloc inconnu" une
-- fois le code renomme (verifie en navigateur). Migration de donnees pure,
-- idempotente (un second passage ne trouve plus rien a renommer).

update blocks set block_type = 'text' where block_type = 'description';
update blocks set block_type = 'image' where block_type = 'gallery';
